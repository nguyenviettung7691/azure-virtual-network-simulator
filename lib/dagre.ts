import dagre from 'dagre'
import type { DiagramNode, DiagramEdge } from '~/types/diagram'
import { NetworkComponentType } from '~/types/network'

const NODE_WIDTH = 180
const NODE_HEIGHT = 80

export function applyDagreLayout(nodes: DiagramNode[], edges: DiagramEdge[]): DiagramNode[] {
  if (nodes.length === 0) return nodes

  const g = new dagre.graphlib.Graph({ compound: true })
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', ranksep: 80, nodesep: 60, marginx: 40, marginy: 40 })

  const subnets = nodes.filter(n => n.data.type === NetworkComponentType.SUBNET)
  const others = nodes.filter(
    n => n.data.type !== NetworkComponentType.VNET && n.data.type !== NetworkComponentType.SUBNET,
  )

  // Add all nodes to the graph
  nodes.forEach(node => {
    let width = NODE_WIDTH
    let height = NODE_HEIGHT
    if (node.data.type === NetworkComponentType.VNET) {
      width = 400
      height = 300
    } else if (node.data.type === NetworkComponentType.SUBNET) {
      width = 320
      height = 200
    }
    g.setNode(node.id, { width, height, label: node.id })
  })

  // Set parent relationships: subnets → their VNet
  subnets.forEach(subnet => {
    const vnetId = (subnet.data as any).vnetId
    if (vnetId && g.hasNode(vnetId)) {
      g.setParent(subnet.id, vnetId)
    }
  })

  // Set parent relationships: other components → their parent (subnet or vnet)
  others.forEach(node => {
    const parentId = node.data.parentId
    if (parentId && g.hasNode(parentId)) {
      g.setParent(node.id, parentId)
    }
  })

  // Add edges
  edges.forEach(edge => {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target)
    }
  })

  dagre.layout(g)

  return nodes.map(node => {
    const nodeWithPosition = g.node(node.id)
    if (!nodeWithPosition) return node
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWithPosition.width / 2,
        y: nodeWithPosition.y - nodeWithPosition.height / 2,
      },
    }
  })
}
