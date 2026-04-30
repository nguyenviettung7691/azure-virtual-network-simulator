import dagre from 'dagre'
import type { DiagramNode, DiagramEdge } from '~/types/diagram'
import { NetworkComponentType } from '~/types/network'

const NODE_WIDTH = 180
const NODE_HEIGHT = 80
const VNET_MIN_WIDTH = 520
const SUBNET_MIN_WIDTH = 360
// Header height = icon+title row + property rows + padding for each container type.
// VNet header (~45px) + body padding (~10px) + 2 prop rows (~40px) = 95px
const VNET_HEADER_H = 95
// Subnet header (~38px) + body padding (~8px) + 2 prop rows (~36px) = 82px
const SUBNET_HEADER_H = 82
// Inner padding around children inside a container node
const CHILD_PADDING_X = 24
const CHILD_PADDING_Y = 20
// Gap between sibling children inside the same container
const CHILD_GAP = 20

export function applyDagreLayout(nodes: DiagramNode[], edges: DiagramEdge[]): DiagramNode[] {
  if (nodes.length === 0) return nodes

  // ── Build reverse-lookup maps for parent resolution ──────────────────────
  // subnetToVnet: subnetId → vnetId
  const subnetToVnet = new Map<string, string>()
  // nicToSubnet: nicId → subnetId
  const nicToSubnet = new Map<string, string>()

  nodes.forEach(node => {
    const d = node.data as any
    if (d.type === NetworkComponentType.SUBNET && d.vnetId) {
      subnetToVnet.set(node.id, d.vnetId)
    }
    if (d.type === NetworkComponentType.NETWORK_IC && d.subnetId) {
      nicToSubnet.set(node.id, d.subnetId)
    }
  })

  // ── Set up dagre compound graph ───────────────────────────────────────────
  const g = new dagre.graphlib.Graph({ compound: true })
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: 'LR',
    ranksep: CHILD_GAP,
    nodesep: CHILD_GAP,
    marginx: CHILD_PADDING_X,
    marginy: CHILD_PADDING_Y,
  })

  // Register all nodes with working dimensions (containers use min sizes; dagre expands them)
  nodes.forEach(node => {
    const d = node.data as any
    let w = NODE_WIDTH
    let h = NODE_HEIGHT
    if (d.type === NetworkComponentType.VNET) { w = VNET_MIN_WIDTH; h = 200 }
    else if (d.type === NetworkComponentType.SUBNET) { w = SUBNET_MIN_WIDTH; h = 160 }
    g.setNode(node.id, { width: w, height: h, label: node.id })
  })

  // ── Assign parent-child relationships ────────────────────────────────────
  // Priority order (first matching rule wins):
  //   1. SUBNET → VNet (via SubnetComponent.vnetId)
  //   2. VM / VMSS / AKS / APP_SERVICE / FUNCTIONS / NVA → Subnet (via d.subnetId)
  //   3. NETWORK_IC (NIC) → Subnet (via NetworkICComponent.subnetId)
  //   4. NSG → VNet (resolved through the subnets/NICs it's attached to)
  //   5. VPN_GATEWAY / APP_GATEWAY / BASTION / UDR → Subnet (via d.subnetId)
  //   6. Generic parentId fallback
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

  nodes.forEach(node => {
    const d = node.data as any

    if (d.type === NetworkComponentType.SUBNET) {
      if (d.vnetId && g.hasNode(d.vnetId)) {
        g.setParent(node.id, d.vnetId)
      }
    } else if (d.type === NetworkComponentType.NETWORK_IC) {
      if (d.subnetId && g.hasNode(d.subnetId)) {
        g.setParent(node.id, d.subnetId)
      }
    } else if (d.type === NetworkComponentType.NSG) {
      // Resolve VNet via the first attached subnet, then via the first attached NIC's subnet
      let vnetId: string | undefined
      if (d.subnetIds?.length) {
        vnetId = subnetToVnet.get(d.subnetIds[0])
      }
      if (!vnetId && d.nicIds?.length) {
        const nicSubnet = nicToSubnet.get(d.nicIds[0])
        if (nicSubnet) vnetId = subnetToVnet.get(nicSubnet)
      }
      if (vnetId && g.hasNode(vnetId)) {
        g.setParent(node.id, vnetId)
      }
    } else if (SUBNET_HOSTED.has(d.type)) {
      if (d.subnetId && g.hasNode(d.subnetId)) {
        g.setParent(node.id, d.subnetId)
      }
    } else if (d.parentId && g.hasNode(d.parentId)) {
      g.setParent(node.id, d.parentId)
    }
  })

  // ── Add edges (skip containment + cross-cluster edges) ───────────────────
  // Dagre's compound-graph ranker cannot traverse cluster boundaries and throws
  // "Cannot set properties of undefined (setting 'rank')" on cross-cluster edges.
  edges.forEach(edge => {
    if (!g.hasNode(edge.source) || !g.hasNode(edge.target)) return
    const sp = g.parent(edge.source) as string | undefined
    const tp = g.parent(edge.target) as string | undefined
    // Skip direct parent→child containment edges
    if (edge.target === sp || edge.source === tp) return
    // Skip cross-cluster edges
    if (sp !== tp) return
    g.setEdge(edge.source, edge.target)
  })

  dagre.layout(g)

  // ── Collect absolute top-left positions from dagre output ────────────────
  const absPos = new Map<string, { x: number; y: number; w: number; h: number }>()
  nodes.forEach(node => {
    const n = g.node(node.id)
    if (n) {
      absPos.set(node.id, {
        x: n.x - n.width / 2,
        y: n.y - n.height / 2,
        w: n.width,
        h: n.height,
      })
    }
  })

  // ── Topo sort: parents must precede children (Vue Flow requirement) ───────
  const sorted = topoSort(nodes, g)

  // ── Bottom-up container size correction ──────────────────────────────────
  // After dagre assigns positions, the container absPos.h/w may be too small
  // because dagre used the initial min sizes. We walk in reverse topo order
  // (children first) so Subnet sizes are correct before VNet reads them.
  for (let i = sorted.length - 1; i >= 0; i--) {
    const node = sorted[i]
    const d = node.data as any
    const isVNet = d.type === NetworkComponentType.VNET
    const isSubnet = d.type === NetworkComponentType.SUBNET
    if (!isVNet && !isSubnet) continue

    const pAbs = absPos.get(node.id)
    if (!pAbs) continue
    const headerH = isVNet ? VNET_HEADER_H : SUBNET_HEADER_H
    const children = g.children(node.id) as string[] | undefined
    if (!children || children.length === 0) continue

    let maxRight = VNET_MIN_WIDTH
    let maxBottom = headerH + CHILD_PADDING_Y * 2

    for (const childId of children) {
      const cAbs = absPos.get(childId)
      if (!cAbs) continue
      const rawRelY = cAbs.y - pAbs.y
      const relY = Math.max(headerH + CHILD_PADDING_Y, rawRelY + headerH)
      const relX = Math.max(CHILD_PADDING_X, cAbs.x - pAbs.x)
      maxRight = Math.max(maxRight, relX + cAbs.w + CHILD_PADDING_X)
      maxBottom = Math.max(maxBottom, relY + cAbs.h + CHILD_PADDING_Y)
    }

    pAbs.w = Math.max(pAbs.w, isVNet ? VNET_MIN_WIDTH : SUBNET_MIN_WIDTH, maxRight)
    pAbs.h = Math.max(pAbs.h, maxBottom)
  }

  // ── Map dagre positions to Vue Flow node objects ──────────────────────────
  return sorted.map(node => {
    const abs = absPos.get(node.id)
    if (!abs) return node

    const parentId = g.parent(node.id) as string | undefined
    const d = node.data as any
    const isContainer = d.type === NetworkComponentType.VNET || d.type === NetworkComponentType.SUBNET

    if (parentId && absPos.has(parentId)) {
      const pAbs = absPos.get(parentId)!

      // Determine header height of parent container
      const parentNode = nodes.find(n => n.id === parentId)
      const parentType = parentNode ? (parentNode.data as any).type : null
      const headerH = parentType === NetworkComponentType.VNET ? VNET_HEADER_H : SUBNET_HEADER_H

      const relX = Math.max(CHILD_PADDING_X, abs.x - pAbs.x)
      const rawRelY = abs.y - pAbs.y
      const relY = Math.max(headerH + CHILD_PADDING_Y, rawRelY + headerH)

      return {
        ...node,
        parentNode: parentId,
        position: { x: relX, y: relY },
        width: abs.w,
        height: abs.h,
        extent: undefined,
      } as any
    }

    // Root node
    return {
      ...node,
      parentNode: undefined,
      position: { x: abs.x, y: abs.y },
      width: Math.max(abs.w, isContainer ? (d.type === NetworkComponentType.VNET ? VNET_MIN_WIDTH : SUBNET_MIN_WIDTH) : NODE_WIDTH),
      height: abs.h,
      extent: undefined,
    } as any
  })
}

/** Topologically sort nodes so every parent appears before its children. */
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

  nodes.forEach(n => visit(n.id))
  return result
}
