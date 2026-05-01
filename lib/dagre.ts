import dagre from 'dagre'
import type { DiagramNode, DiagramEdge } from '~/types/diagram'
import {
  ATTACHMENT_GAP_X,
  ATTACHMENT_GAP_Y,
  BASE_NODE_HEIGHT,
  BASE_NODE_WIDTH,
  CHILD_GAP,
  CHILD_PADDING_X,
  CHILD_PADDING_Y,
  INTERNET_NODE_HEIGHT,
  INTERNET_NODE_WIDTH,
  MAX_SUBNET_COLUMNS,
  SUBNET_HEADER_HEIGHT,
  SUBNET_MIN_HEIGHT,
  SUBNET_MIN_WIDTH,
  VNET_HEADER_HEIGHT,
  VNET_MIN_HEIGHT,
  VNET_MIN_WIDTH,
} from '~/lib/layout'
import { NetworkComponentType } from '~/types/network'

const SUBNET_HOSTED = new Set<NetworkComponentType>([
  NetworkComponentType.VM,
  NetworkComponentType.VMSS,
  NetworkComponentType.AKS,
  NetworkComponentType.APP_SERVICE,
  NetworkComponentType.FUNCTIONS,
  NetworkComponentType.NVA,
  NetworkComponentType.VPN_GATEWAY,
  NetworkComponentType.APP_GATEWAY,
  NetworkComponentType.BASTION,
  NetworkComponentType.PRIVATE_ENDPOINT,
  NetworkComponentType.SERVICE_ENDPOINT,
])

const OUTSIDE_VNET_POLICY = new Set<NetworkComponentType>([
  NetworkComponentType.NSG,
  NetworkComponentType.ASG,
  NetworkComponentType.UDR,
])

const ROOT_MARGIN = 40
const OUTSIDE_POLICY_GAP_X = 24
const OUTSIDE_POLICY_GAP_Y = 32

type NodeData = DiagramNode['data'] & Record<string, any>
type Rect = { x: number; y: number; w: number; h: number }
type Maps = {
  subnetToVnet: Map<string, string>
  nicToSubnet: Map<string, string>
}

export function applyDagreLayout(nodes: DiagramNode[], edges: DiagramEdge[]): DiagramNode[] {
  if (nodes.length === 0) return nodes

  const nodeById = new Map(nodes.map(node => [node.id, node]))
  const maps = buildRelationshipMaps(nodes)

  const g = new dagre.graphlib.Graph({ compound: true })
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: 'LR',
    ranksep: CHILD_GAP,
    nodesep: CHILD_GAP,
    marginx: CHILD_PADDING_X,
    marginy: CHILD_PADDING_Y,
  })

  nodes.forEach(node => {
    const d = node.data as NodeData
    let w = BASE_NODE_WIDTH
    let h = BASE_NODE_HEIGHT
    if (d.type === NetworkComponentType.VNET) {
      w = VNET_MIN_WIDTH
      h = VNET_MIN_HEIGHT
    } else if (d.type === NetworkComponentType.SUBNET) {
      w = SUBNET_MIN_WIDTH
      h = SUBNET_MIN_HEIGHT
    } else if (d.type === NetworkComponentType.INTERNET) {
      w = INTERNET_NODE_WIDTH
      h = INTERNET_NODE_HEIGHT
    }
    g.setNode(node.id, { width: w, height: h, label: node.id })
  })

  nodes.forEach(node => {
    const parentId = resolveParentId(node.data as NodeData, maps)
    if (parentId && g.hasNode(parentId)) {
      g.setParent(node.id, parentId)
    }
  })

  edges.forEach(edge => {
    if (!g.hasNode(edge.source) || !g.hasNode(edge.target)) return
    const sourceParent = g.parent(edge.source) as string | undefined
    const targetParent = g.parent(edge.target) as string | undefined
    if (edge.target === sourceParent || edge.source === targetParent) return
    if (sourceParent !== targetParent) return
    // Dagre's compound-graph DFS ranker fails when an edge endpoint is itself a
    // cluster node (a node that has been assigned children via setParent).
    // Filter those out — visual layout is handled by the reflow passes anyway.
    const sourceChildren = (g.children(edge.source) as string[] | undefined) ?? []
    const targetChildren = (g.children(edge.target) as string[] | undefined) ?? []
    if (sourceChildren.length > 0 || targetChildren.length > 0) return
    g.setEdge(edge.source, edge.target)
  })

  dagre.layout(g)

  const absPos = new Map<string, Rect>()
  nodes.forEach(node => {
    const layoutNode = g.node(node.id)
    if (!layoutNode) return
    absPos.set(node.id, {
      x: layoutNode.x - layoutNode.width / 2,
      y: layoutNode.y - layoutNode.height / 2,
      w: layoutNode.width,
      h: layoutNode.height,
    })
  })

  const sorted = topoSort(nodes, g)
  reflowSubnetContainers(sorted, absPos, g, nodeById)
  reflowVnetContainers(sorted, absPos, g, nodeById)
  reflowOutsideVnetPolicies(sorted, absPos, nodeById, maps)
  positionPublicInternetNodes(sorted, absPos)
  normalizeAbsolutePositions(absPos)

  return sorted.map(node => {
    const abs = absPos.get(node.id)
    if (!abs) return node

    const parentId = g.parent(node.id) as string | undefined
    const d = node.data as NodeData
    const isContainer = d.type === NetworkComponentType.VNET || d.type === NetworkComponentType.SUBNET

    if (parentId) {
      const parentAbs = absPos.get(parentId)
      if (!parentAbs) return node

      return {
        ...node,
        parentNode: parentId,
        position: {
          x: Math.max(CHILD_PADDING_X, abs.x - parentAbs.x),
          y: Math.max(CHILD_PADDING_Y, abs.y - parentAbs.y),
        },
        width: abs.w,
        height: abs.h,
        extent: undefined,
      } as any
    }

    return {
      ...node,
      parentNode: undefined,
      position: { x: abs.x, y: abs.y },
      width: Math.max(
        abs.w,
        isContainer ? (d.type === NetworkComponentType.VNET ? VNET_MIN_WIDTH : SUBNET_MIN_WIDTH) : BASE_NODE_WIDTH
      ),
      height: abs.h,
      extent: undefined,
    } as any
  })
}

function buildRelationshipMaps(nodes: DiagramNode[]): Maps {
  const subnetToVnet = new Map<string, string>()
  const nicToSubnet = new Map<string, string>()

  nodes.forEach(node => {
    const d = node.data as NodeData
    if (d.type === NetworkComponentType.SUBNET && d.vnetId) {
      subnetToVnet.set(node.id, d.vnetId)
    }
    if (d.type === NetworkComponentType.NETWORK_IC && d.subnetId) {
      nicToSubnet.set(node.id, d.subnetId)
    }
  })

  return { subnetToVnet, nicToSubnet }
}

function resolveParentId(data: NodeData, maps: Maps): string | undefined {
  if (data.type === NetworkComponentType.SUBNET) return data.vnetId
  if (data.type === NetworkComponentType.NETWORK_IC) return data.subnetId
  if (OUTSIDE_VNET_POLICY.has(data.type)) return undefined
  if (data.type === NetworkComponentType.FIREWALL) return data.vnetId
  if (SUBNET_HOSTED.has(data.type)) return getSubnetContainerId(data)
  return data.parentId
}

function getSubnetContainerId(data: NodeData): string | undefined {
  return data.subnetId || data.vnetIntegrationSubnetId
}

function resolveAttachedVnetId(data: NodeData, maps: Maps): string | undefined {
  const attachedSubnetIds = collectAttachedSubnetIds(data, maps.nicToSubnet)
  for (const subnetId of attachedSubnetIds) {
    const vnetId = maps.subnetToVnet.get(subnetId)
    if (vnetId) return vnetId
  }
  return undefined
}

function collectAttachedSubnetIds(data: NodeData, nicToSubnet: Map<string, string>): string[] {
  const result: string[] = []
  const add = (value?: string) => {
    if (value && !result.includes(value)) result.push(value)
  }

  if (Array.isArray(data.subnetIds)) {
    data.subnetIds.forEach((id: string) => add(id))
  }

  if (Array.isArray(data.nicIds)) {
    data.nicIds.forEach((id: string) => add(nicToSubnet.get(id)))
  }

  if (data.subnetId) add(data.subnetId)

  return result
}

function isValidRect(rect: Rect | undefined): rect is Rect {
  return !!rect
    && Number.isFinite(rect.x)
    && Number.isFinite(rect.y)
    && Number.isFinite(rect.w)
    && Number.isFinite(rect.h)
}

function sortIdsByLayout(ids: string[], absPos: Map<string, Rect>): string[] {
  return [...ids].sort((leftId, rightId) => {
    const left = absPos.get(leftId)
    const right = absPos.get(rightId)
    if (!left && !right) return leftId.localeCompare(rightId)
    if (!left) return 1
    if (!right) return -1

    if (Math.abs(left.y - right.y) > 8) return left.y - right.y
    if (Math.abs(left.x - right.x) > 8) return left.x - right.x
    return leftId.localeCompare(rightId)
  })
}

function reflowSubnetContainers(
  nodes: DiagramNode[],
  absPos: Map<string, Rect>,
  g: dagre.graphlib.Graph,
  nodeById: Map<string, DiagramNode>
) {
  nodes.forEach(node => {
    const data = node.data as NodeData
    if (data.type !== NetworkComponentType.SUBNET) return

    const parentRect = absPos.get(node.id)
    if (!parentRect) return

    const childIds = sortIdsByLayout((g.children(node.id) as string[] | undefined) || [], absPos)
    if (childIds.length === 0) {
      parentRect.w = Math.max(parentRect.w, SUBNET_MIN_WIDTH)
      parentRect.h = Math.max(parentRect.h, SUBNET_MIN_HEIGHT)
      return
    }

    const groups = buildSubnetGroups(childIds, nodeById, absPos)
    const contentStartX = parentRect.x + CHILD_PADDING_X
    let cursorY = parentRect.y + SUBNET_HEADER_HEIGHT + CHILD_PADDING_Y
    let maxRight = parentRect.x + SUBNET_MIN_WIDTH - CHILD_PADDING_X
    let maxBottom = parentRect.y + SUBNET_MIN_HEIGHT - CHILD_PADDING_Y

    groups.forEach(group => {
      const { right, bottom } = placeSubnetGroup(group, contentStartX, cursorY, absPos)
      maxRight = Math.max(maxRight, right)
      maxBottom = Math.max(maxBottom, bottom)
      cursorY = bottom + CHILD_GAP
    })

    parentRect.w = Math.max(SUBNET_MIN_WIDTH, maxRight - parentRect.x + CHILD_PADDING_X)
    parentRect.h = Math.max(SUBNET_MIN_HEIGHT, maxBottom - parentRect.y + CHILD_PADDING_Y)
  })
}

function buildSubnetGroups(childIds: string[], nodeById: Map<string, DiagramNode>, absPos: Map<string, Rect>) {
  const nicIds = sortIdsByLayout(childIds.filter(
    id => (nodeById.get(id)?.data as NodeData | undefined)?.type === NetworkComponentType.NETWORK_IC
  ), absPos)
  const hostIds = sortIdsByLayout(childIds.filter(id => {
    const type = (nodeById.get(id)?.data as NodeData | undefined)?.type
    return type !== undefined && type !== NetworkComponentType.NETWORK_IC
  }), absPos)
  const nicToHosts = new Map<string, string[]>()
  const nicIdSet = new Set(nicIds)

  hostIds.forEach(hostId => {
    const data = nodeById.get(hostId)?.data as NodeData | undefined
    const attachedNicId = data?.nicIds?.find((nicId: string) => nicIdSet.has(nicId))
    if (!attachedNicId) return

    const current = nicToHosts.get(attachedNicId) || []
    current.push(hostId)
    nicToHosts.set(attachedNicId, sortIdsByLayout(current, absPos))
  })

  const usedHosts = new Set<string>()
  const groups: Array<{ nicId?: string; memberIds: string[] }> = []

  nicIds.forEach(nicId => {
    const attachedHosts = (nicToHosts.get(nicId) || []).filter(hostId => !usedHosts.has(hostId))

    if (attachedHosts.length > 0) {
      attachedHosts.forEach(id => usedHosts.add(id))
      groups.push({ nicId, memberIds: attachedHosts })
    }
  })

  hostIds.forEach(hostId => {
    if (!usedHosts.has(hostId)) groups.push({ memberIds: [hostId] })
  })

  nicIds.forEach(nicId => {
    const alreadyPlaced = groups.some(group => group.nicId === nicId)
    if (!alreadyPlaced) groups.push({ nicId, memberIds: [] })
  })

  return groups
}

function placeSubnetGroup(
  group: { nicId?: string; memberIds: string[] },
  startX: number,
  startY: number,
  absPos: Map<string, Rect>
) {
  const nicId = group.nicId
  const nicRect = nicId ? absPos.get(nicId) : undefined
  const memberRects = group.memberIds
    .map(id => ({ id, rect: absPos.get(id) }))
    .filter((entry): entry is { id: string; rect: Rect } => isValidRect(entry.rect))
  const nicOffset = nicRect ? nicRect.w + ATTACHMENT_GAP_X : 0

  let memberY = startY
  let maxMemberWidth = 0
  let membersBottom = startY

  memberRects.forEach(({ id, rect }) => {
    absPos.set(id, { ...rect, x: startX + nicOffset, y: memberY })
    membersBottom = memberY + rect.h
    memberY += rect.h + ATTACHMENT_GAP_Y
    maxMemberWidth = Math.max(maxMemberWidth, rect.w)
  })

  let nicBottom = startY
  let nicRight = startX

  if (nicId && nicRect) {
    let nicY = startY
    if (memberRects.length > 0) {
      const memberColumnHeight = membersBottom - startY
      nicY = startY + Math.max(0, (memberColumnHeight - nicRect.h) / 2)
    }
    absPos.set(nicId, { ...nicRect, x: startX, y: nicY })
    nicBottom = nicY + nicRect.h
    nicRight = startX + nicRect.w
  }

  const membersRight = memberRects.length
    ? startX + nicOffset + maxMemberWidth
    : nicRight
  const groupBottom = memberRects.length ? membersBottom : nicBottom

  return {
    right: Math.max(nicRight, membersRight),
    bottom: Math.max(nicBottom, groupBottom),
  }
}

function reflowVnetContainers(
  nodes: DiagramNode[],
  absPos: Map<string, Rect>,
  g: dagre.graphlib.Graph,
  nodeById: Map<string, DiagramNode>
) {
  nodes.forEach(node => {
    const data = node.data as NodeData
    if (data.type !== NetworkComponentType.VNET) return

    const parentRect = absPos.get(node.id)
    if (!parentRect) return

    const childIds = sortIdsByLayout((g.children(node.id) as string[] | undefined) || [], absPos)
    if (childIds.length === 0) {
      parentRect.w = Math.max(parentRect.w, VNET_MIN_WIDTH)
      parentRect.h = Math.max(parentRect.h, VNET_MIN_HEIGHT)
      return
    }

    const subnetIds = childIds.filter(id => (nodeById.get(id)?.data as NodeData | undefined)?.type === NetworkComponentType.SUBNET)
    const containedIds = childIds.filter(id => !subnetIds.includes(id))

    const contentStartX = parentRect.x + CHILD_PADDING_X
    let cursorY = parentRect.y + VNET_HEADER_HEIGHT + CHILD_PADDING_Y
    let maxRight = parentRect.x + VNET_MIN_WIDTH - CHILD_PADDING_X
    let maxBottom = parentRect.y + VNET_MIN_HEIGHT - CHILD_PADDING_Y

    if (containedIds.length > 0) {
      const containedPlacement = placeLinearRow(containedIds, contentStartX, cursorY, absPos)
      maxRight = Math.max(maxRight, containedPlacement.right)
      maxBottom = Math.max(maxBottom, containedPlacement.bottom)
      cursorY = containedPlacement.bottom + CHILD_GAP
    }

    if (subnetIds.length > 0) {
      const subnetPlacement = placeSubnetGrid(subnetIds, contentStartX, cursorY, absPos, g)
      maxRight = Math.max(maxRight, subnetPlacement.right)
      maxBottom = Math.max(maxBottom, subnetPlacement.bottom)
    }

    parentRect.w = Math.max(VNET_MIN_WIDTH, maxRight - parentRect.x + CHILD_PADDING_X)
    parentRect.h = Math.max(VNET_MIN_HEIGHT, maxBottom - parentRect.y + CHILD_PADDING_Y)
  })
}

function placeLinearRow(ids: string[], startX: number, startY: number, absPos: Map<string, Rect>) {
  let cursorX = startX
  let maxRight = startX
  let maxBottom = startY

  ids.forEach(id => {
    const rect = absPos.get(id)
    if (!rect) return

    absPos.set(id, { ...rect, x: cursorX, y: startY })
    maxRight = Math.max(maxRight, cursorX + rect.w)
    maxBottom = Math.max(maxBottom, startY + rect.h)
    cursorX += rect.w + CHILD_GAP
  })

  return { right: maxRight, bottom: maxBottom }
}

function placeSubnetGrid(
  ids: string[],
  startX: number,
  startY: number,
  absPos: Map<string, Rect>,
  g: dagre.graphlib.Graph
) {
  const subnetEntries = ids
    .map(id => ({ id, rect: absPos.get(id) }))
    .filter((entry): entry is { id: string; rect: Rect } => isValidRect(entry.rect))

  if (subnetEntries.length === 0) return { right: startX, bottom: startY }

  const columns = Math.min(MAX_SUBNET_COLUMNS, Math.max(1, subnetEntries.length))
  const columnWidths = Array.from({ length: columns }, () => 0)
  const rowHeights: number[] = []

  subnetEntries.forEach((entry, index) => {
    const col = index % columns
    const row = Math.floor(index / columns)
    columnWidths[col] = Math.max(columnWidths[col], entry.rect.w)
    rowHeights[row] = Math.max(rowHeights[row] || 0, entry.rect.h)
  })

  const columnOffsets: number[] = []
  let columnCursor = startX
  columnWidths.forEach(width => {
    columnOffsets.push(columnCursor)
    columnCursor += width + CHILD_GAP
  })

  const rowOffsets: number[] = []
  let rowCursor = startY
  rowHeights.forEach(height => {
    rowOffsets.push(rowCursor)
    rowCursor += height + CHILD_GAP
  })

  let maxRight = startX
  let maxBottom = startY

  subnetEntries.forEach((entry, index) => {
    const col = index % columns
    const row = Math.floor(index / columns)
    const x = columnOffsets[col]
    const y = rowOffsets[row]
    const dx = x - entry.rect.x
    const dy = y - entry.rect.y
    absPos.set(entry.id, { ...entry.rect, x, y })
    shiftDescendants(entry.id, dx, dy, absPos, g)
    maxRight = Math.max(maxRight, x + entry.rect.w)
    maxBottom = Math.max(maxBottom, y + entry.rect.h)
  })

  return { right: maxRight, bottom: maxBottom }
}

function shiftDescendants(
  nodeId: string,
  dx: number,
  dy: number,
  absPos: Map<string, Rect>,
  g: dagre.graphlib.Graph
) {
  if (dx === 0 && dy === 0) return

  const childIds = (g.children(nodeId) as string[] | undefined) || []
  childIds.forEach(childId => {
    const rect = absPos.get(childId)
    if (rect) {
      absPos.set(childId, {
        ...rect,
        x: rect.x + dx,
        y: rect.y + dy,
      })
    }
    shiftDescendants(childId, dx, dy, absPos, g)
  })
}

function reflowOutsideVnetPolicies(
  nodes: DiagramNode[],
  absPos: Map<string, Rect>,
  nodeById: Map<string, DiagramNode>,
  maps: Maps
) {
  const placedPolicies = new Set<string>()
  const vnetIds = sortIdsByLayout(
    nodes
      .filter(node => (node.data as NodeData).type === NetworkComponentType.VNET)
      .map(node => node.id),
    absPos
  )
  vnetIds.forEach(vnetId => {
    const vnetRect = absPos.get(vnetId)
    if (!vnetRect) return

    const subnetCenters = new Map<string, number>()
    maps.subnetToVnet.forEach((associatedVnetId, subnetId) => {
      if (associatedVnetId !== vnetId) return
      const subnetRect = absPos.get(subnetId)
      if (!subnetRect) return
      subnetCenters.set(subnetId, subnetRect.x + subnetRect.w / 2)
    })

    const policyEntries = sortIdsByLayout(
      nodes
        .filter(node => {
          const data = node.data as NodeData
          return OUTSIDE_VNET_POLICY.has(data.type)
            && !placedPolicies.has(node.id)
            && resolveAttachedVnetId(data, maps) === vnetId
        })
        .map(node => node.id),
      absPos
    )
      .map(id => {
        const rect = absPos.get(id)
        if (!rect) return null
        return {
          id,
          rect,
          anchor: resolveAttachmentAnchorX(id, nodeById, subnetCenters, maps.nicToSubnet) ?? (vnetRect.x + vnetRect.w / 2),
        }
      })
      .filter((entry): entry is { id: string; rect: Rect; anchor: number } => entry !== null)
      .sort((left, right) => left.anchor - right.anchor)

    if (policyEntries.length === 0) return

    const rowHeight = policyEntries.reduce((max, entry) => Math.max(max, entry.rect.h), BASE_NODE_HEIGHT)
    const baseRowY = vnetRect.y - rowHeight - OUTSIDE_POLICY_GAP_Y
    const laneGapY = Math.max(ATTACHMENT_GAP_Y, Math.round(OUTSIDE_POLICY_GAP_Y / 2))
    const lanes: Array<Array<{ id: string; rect: Rect; anchor: number; x: number }>> = []
    const laneNextX: number[] = []

    policyEntries.forEach(entry => {
      const preferredX = entry.anchor - entry.rect.w / 2
      let laneIndex = laneNextX.findIndex(nextX => {
        if (!Number.isFinite(nextX)) return true
        return nextX - preferredX <= OUTSIDE_POLICY_GAP_X
      })

      if (laneIndex === -1) {
        laneIndex = lanes.length
        lanes.push([])
        laneNextX.push(Number.NEGATIVE_INFINITY)
      }

      const laneX = Number.isFinite(laneNextX[laneIndex])
        ? Math.max(preferredX, laneNextX[laneIndex])
        : preferredX

      laneNextX[laneIndex] = laneX + entry.rect.w + OUTSIDE_POLICY_GAP_X
      lanes[laneIndex].push({ ...entry, x: laneX })
    })

    lanes.forEach((laneEntries, laneIndex) => {
      const desiredCenter = laneEntries.reduce((sum, entry) => sum + entry.anchor, 0) / laneEntries.length
      const clusterLeft = laneEntries[0]?.x ?? vnetRect.x
      const clusterRight = laneEntries.reduce((max, entry) => Math.max(max, entry.x + entry.rect.w), clusterLeft)
      const clusterCenter = (clusterLeft + clusterRight) / 2
      const clusterShift = desiredCenter - clusterCenter
      const rowY = baseRowY - laneIndex * (rowHeight + laneGapY)

      laneEntries.forEach(entry => {
        absPos.set(entry.id, {
          ...entry.rect,
          x: entry.x + clusterShift,
          y: rowY,
        })
        placedPolicies.add(entry.id)
      })
    })
  })
}

function positionPublicInternetNodes(nodes: DiagramNode[], absPos: Map<string, Rect>) {
  const internetEntries = sortIdsByLayout(
    nodes
      .filter(node => (node.data as NodeData).type === NetworkComponentType.INTERNET)
      .map(node => node.id),
    absPos
  )
    .map(id => ({ id, rect: absPos.get(id) }))
    .filter((entry): entry is { id: string; rect: Rect } => isValidRect(entry.rect))

  if (internetEntries.length === 0) return

  const otherRects = nodes
    .filter(node => (node.data as NodeData).type !== NetworkComponentType.INTERNET)
    .map(node => absPos.get(node.id))
    .filter(isValidRect)

  if (otherRects.length === 0) return

  const minX = otherRects.reduce((min, rect) => Math.min(min, rect.x), Number.POSITIVE_INFINITY)
  const maxX = otherRects.reduce((max, rect) => Math.max(max, rect.x + rect.w), Number.NEGATIVE_INFINITY)
  const minY = otherRects.reduce((min, rect) => Math.min(min, rect.y), Number.POSITIVE_INFINITY)
  const totalWidth = internetEntries.reduce(
    (sum, entry, index) => sum + entry.rect.w + (index > 0 ? OUTSIDE_POLICY_GAP_X : 0),
    0
  )
  const rowHeight = internetEntries.reduce((max, entry) => Math.max(max, entry.rect.h), INTERNET_NODE_HEIGHT)
  const availableWidth = Math.max(0, maxX - minX)
  let cursorX = minX + Math.max(0, (availableWidth - totalWidth) / 2)
  const rowY = minY - rowHeight - OUTSIDE_POLICY_GAP_Y - 16

  internetEntries.forEach(entry => {
    absPos.set(entry.id, {
      ...entry.rect,
      x: cursorX,
      y: rowY,
    })
    cursorX += entry.rect.w + OUTSIDE_POLICY_GAP_X
  })
}

function normalizeAbsolutePositions(absPos: Map<string, Rect>) {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY

  absPos.forEach(rect => {
    minX = Math.min(minX, rect.x)
    minY = Math.min(minY, rect.y)
  })

  const shiftX = minX < ROOT_MARGIN ? ROOT_MARGIN - minX : 0
  const shiftY = minY < ROOT_MARGIN ? ROOT_MARGIN - minY : 0
  if (shiftX === 0 && shiftY === 0) return

  absPos.forEach((rect, id) => {
    absPos.set(id, {
      ...rect,
      x: rect.x + shiftX,
      y: rect.y + shiftY,
    })
  })
}

function resolveAttachmentAnchorX(
  nodeId: string,
  nodeById: Map<string, DiagramNode>,
  subnetCenters: Map<string, number>,
  nicToSubnet: Map<string, string>
) {
  const data = nodeById.get(nodeId)?.data as NodeData | undefined
  if (!data) return undefined

  const subnetIds = collectAttachedSubnetIds(data, nicToSubnet)
  const anchors = subnetIds
    .map(subnetId => subnetCenters.get(subnetId))
    .filter((value): value is number => typeof value === 'number')

  if (anchors.length === 0) return undefined
  return anchors.reduce((sum, value) => sum + value, 0) / anchors.length
}

function topoSort(nodes: DiagramNode[], g: dagre.graphlib.Graph): DiagramNode[] {
  const result: DiagramNode[] = []
  const visited = new Set<string>()

  function visit(id: string) {
    if (visited.has(id)) return
    const parentId = g.parent(id) as string | undefined
    if (parentId && !visited.has(parentId)) visit(parentId)
    visited.add(id)
    const node = nodes.find(n => n.id === id)
    if (node) result.push(node)
  }

  nodes.forEach(node => visit(node.id))
  return result
}
