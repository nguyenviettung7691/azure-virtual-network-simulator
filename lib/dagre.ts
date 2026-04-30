import dagre from 'dagre'
import type { DiagramNode, DiagramEdge } from '~/types/diagram'
import { NetworkComponentType } from '~/types/network'

const NODE_WIDTH = 180
const NODE_HEIGHT = 80
const VNET_MIN_WIDTH = 560
const SUBNET_MIN_WIDTH = 440
const VNET_MIN_HEIGHT = 240
const SUBNET_MIN_HEIGHT = 190
const VNET_HEADER_H = 95
const SUBNET_HEADER_H = 82
const CHILD_PADDING_X = 24
const CHILD_PADDING_Y = 20
const CHILD_GAP = 24
const ATTACHMENT_GAP_X = 18
const ATTACHMENT_GAP_Y = 14
const MAX_SUBNET_COLUMNS = 3

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

const VNET_ATTACHED = new Set<NetworkComponentType>([
  NetworkComponentType.NSG,
  NetworkComponentType.ASG,
  NetworkComponentType.UDR,
  NetworkComponentType.FIREWALL,
])

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
    let w = NODE_WIDTH
    let h = NODE_HEIGHT
    if (d.type === NetworkComponentType.VNET) {
      w = VNET_MIN_WIDTH
      h = VNET_MIN_HEIGHT
    } else if (d.type === NetworkComponentType.SUBNET) {
      w = SUBNET_MIN_WIDTH
      h = SUBNET_MIN_HEIGHT
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
  reflowVnetContainers(sorted, absPos, g, nodeById, maps)

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
        isContainer ? (d.type === NetworkComponentType.VNET ? VNET_MIN_WIDTH : SUBNET_MIN_WIDTH) : NODE_WIDTH
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
  if (data.type === NetworkComponentType.FIREWALL) return data.vnetId
  if (VNET_ATTACHED.has(data.type)) return resolveAttachedVnetId(data, maps)
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

    const childIds = (g.children(node.id) as string[] | undefined) || []
    if (childIds.length === 0) {
      parentRect.w = Math.max(parentRect.w, SUBNET_MIN_WIDTH)
      parentRect.h = Math.max(parentRect.h, SUBNET_MIN_HEIGHT)
      return
    }

    const groups = buildSubnetGroups(childIds, nodeById)
    let cursorY = parentRect.y + SUBNET_HEADER_H + CHILD_PADDING_Y
    let maxRight = parentRect.x + SUBNET_MIN_WIDTH - CHILD_PADDING_X

    groups.forEach(group => {
      const { right, bottom } = placeSubnetGroup(group, parentRect.x + CHILD_PADDING_X, cursorY, absPos)
      maxRight = Math.max(maxRight, right)
      cursorY = bottom + CHILD_GAP
    })

    parentRect.w = Math.max(SUBNET_MIN_WIDTH, maxRight - parentRect.x + CHILD_PADDING_X)
    parentRect.h = Math.max(
      SUBNET_MIN_HEIGHT,
      (groups.length ? cursorY - CHILD_GAP : parentRect.y + SUBNET_HEADER_H + CHILD_PADDING_Y) - parentRect.y + CHILD_PADDING_Y
    )
  })
}

function buildSubnetGroups(childIds: string[], nodeById: Map<string, DiagramNode>) {
  const nicIds = childIds.filter(id => (nodeById.get(id)?.data as NodeData | undefined)?.type === NetworkComponentType.NETWORK_IC)
  const hostIds = childIds.filter(id => {
    const type = (nodeById.get(id)?.data as NodeData | undefined)?.type
    return type !== undefined && type !== NetworkComponentType.NETWORK_IC
  })
  const nicToHosts = new Map<string, string[]>()

  hostIds.forEach(hostId => {
    const data = nodeById.get(hostId)?.data as NodeData | undefined
    data?.nicIds?.forEach((nicId: string) => {
      const current = nicToHosts.get(nicId) || []
      current.push(hostId)
      nicToHosts.set(nicId, current)
    })
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
  const nicRect = group.nicId ? absPos.get(group.nicId) : undefined
  const memberRects = group.memberIds
    .map(id => ({ id, rect: absPos.get(id) }))
    .filter((entry): entry is { id: string; rect: Rect } => (
      !!entry.rect
      && Number.isFinite(entry.rect.x)
      && Number.isFinite(entry.rect.y)
      && Number.isFinite(entry.rect.w)
      && Number.isFinite(entry.rect.h)
    ))

  let memberY = startY
  let maxMemberWidth = 0

  memberRects.forEach(({ id, rect }) => {
    absPos.set(id, { ...rect, x: startX + (nicRect ? nicRect.w + ATTACHMENT_GAP_X : 0), y: memberY })
    memberY += rect.h + ATTACHMENT_GAP_Y
    maxMemberWidth = Math.max(maxMemberWidth, rect.w)
  })

  let nicBottom = startY
  let nicRight = startX

  if (nicRect) {
    // Keep the NIC vertically centered against its attached resources.
    const memberColumnHeight = memberRects.length
      ? memberY - startY - ATTACHMENT_GAP_Y
      : nicRect.h
    const nicY = startY + Math.max(0, (memberColumnHeight - nicRect.h) / 2)
    absPos.set(group.nicId!, { ...nicRect, x: startX, y: nicY })
    nicBottom = nicY + nicRect.h
    nicRight = startX + nicRect.w
  }

  const membersRight = memberRects.length
    ? startX + (nicRect ? nicRect.w + ATTACHMENT_GAP_X : 0) + maxMemberWidth
    : nicRight
  const membersBottom = memberRects.length ? memberY - ATTACHMENT_GAP_Y : nicBottom

  return {
    right: Math.max(nicRight, membersRight),
    bottom: Math.max(nicBottom, membersBottom),
  }
}

function reflowVnetContainers(
  nodes: DiagramNode[],
  absPos: Map<string, Rect>,
  g: dagre.graphlib.Graph,
  nodeById: Map<string, DiagramNode>,
  maps: Maps
) {
  nodes.forEach(node => {
    const data = node.data as NodeData
    if (data.type !== NetworkComponentType.VNET) return

    const parentRect = absPos.get(node.id)
    if (!parentRect) return

    const childIds = (g.children(node.id) as string[] | undefined) || []
    if (childIds.length === 0) {
      parentRect.w = Math.max(parentRect.w, VNET_MIN_WIDTH)
      parentRect.h = Math.max(parentRect.h, VNET_MIN_HEIGHT)
      return
    }

    const subnetIds = childIds.filter(id => (nodeById.get(id)?.data as NodeData | undefined)?.type === NetworkComponentType.SUBNET)
    const attachmentIds = childIds.filter(id => {
      const type = (nodeById.get(id)?.data as NodeData | undefined)?.type
      return type !== undefined && VNET_ATTACHED.has(type)
    })
    const otherIds = childIds.filter(id => !subnetIds.includes(id) && !attachmentIds.includes(id))

    const headerStartY = parentRect.y + VNET_HEADER_H + CHILD_PADDING_Y
    const attachmentRowHeight = attachmentIds.reduce((max, id) => Math.max(max, absPos.get(id)?.h || NODE_HEIGHT), 0)
    const subnetStartY = headerStartY + (attachmentIds.length ? attachmentRowHeight + CHILD_GAP : 0)

    const subnetColumns = subnetIds.length <= 1 ? 1 : Math.min(MAX_SUBNET_COLUMNS, subnetIds.length)
    let maxRight = parentRect.x + VNET_MIN_WIDTH - CHILD_PADDING_X
    let maxBottom = parentRect.y + VNET_MIN_HEIGHT - CHILD_PADDING_Y

    subnetIds.forEach((subnetId, index) => {
      const rect = absPos.get(subnetId)
      if (!rect) return
      const col = index % subnetColumns
      const row = Math.floor(index / subnetColumns)
      const x = parentRect.x + CHILD_PADDING_X + col * (rect.w + CHILD_GAP)
      const y = subnetStartY + row * (rect.h + CHILD_GAP)
      absPos.set(subnetId, { ...rect, x, y })
      maxRight = Math.max(maxRight, x + rect.w)
      maxBottom = Math.max(maxBottom, y + rect.h)
    })

    if (attachmentIds.length > 0) {
      const subnetCenters = new Map<string, number>()
      subnetIds.forEach(subnetId => {
        const rect = absPos.get(subnetId)
        if (rect) subnetCenters.set(subnetId, rect.x + rect.w / 2)
      })

      const orderedAttachments = attachmentIds
        .map(id => ({
          id,
          anchor: resolveAttachmentAnchorX(id, nodeById, subnetCenters, maps.nicToSubnet)
            ?? parentRect.x + CHILD_PADDING_X,
        }))
        .sort((a, b) => a.anchor - b.anchor)

      let nextX = parentRect.x + CHILD_PADDING_X
      orderedAttachments.forEach(({ id, anchor }) => {
        const rect = absPos.get(id)
        if (!rect) return
        const centeredX = anchor - rect.w / 2
        const x = Math.max(nextX, centeredX)
        const y = headerStartY
        absPos.set(id, { ...rect, x, y })
        nextX = x + rect.w + CHILD_GAP
        maxRight = Math.max(maxRight, x + rect.w)
        maxBottom = Math.max(maxBottom, y + rect.h)
      })
    }

    let otherCursorY = maxBottom + (otherIds.length ? CHILD_GAP : 0)
    otherIds.forEach(id => {
      const rect = absPos.get(id)
      if (!rect) return
      absPos.set(id, { ...rect, x: parentRect.x + CHILD_PADDING_X, y: otherCursorY })
      maxRight = Math.max(maxRight, parentRect.x + CHILD_PADDING_X + rect.w)
      otherCursorY += rect.h + CHILD_GAP
      maxBottom = Math.max(maxBottom, otherCursorY - CHILD_GAP)
    })

    parentRect.w = Math.max(VNET_MIN_WIDTH, maxRight - parentRect.x + CHILD_PADDING_X)
    parentRect.h = Math.max(VNET_MIN_HEIGHT, maxBottom - parentRect.y + CHILD_PADDING_Y)
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
