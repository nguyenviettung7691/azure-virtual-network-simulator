import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import type { DiagramState, DiagramNode, DiagramEdge } from '~/types/diagram'
import { NetworkComponentType, getComponentColor } from '~/types/network'

export function exportToDrawio(state: DiagramState): string {
  const doc = new DOMParser().parseFromString('<mxGraphModel/>', 'text/xml')
  const root = doc.createElement('root')
  doc.documentElement.appendChild(root)

  const cell0 = doc.createElement('mxCell')
  cell0.setAttribute('id', '0')
  root.appendChild(cell0)

  const cell1 = doc.createElement('mxCell')
  cell1.setAttribute('id', '1')
  cell1.setAttribute('parent', '0')
  root.appendChild(cell1)

  state.nodes.forEach(node => {
    const cell = doc.createElement('mxCell')
    cell.setAttribute('id', node.id)
    cell.setAttribute('value', node.data.name)
    cell.setAttribute('vertex', '1')
    cell.setAttribute('parent', node.data.parentId || '1')
    cell.setAttribute('style', getDrawioStyle(node.data.type))
    // Store full component data as tooltip for round-trip fidelity
    cell.setAttribute('tooltip', JSON.stringify(node.data))

    const geometry = doc.createElement('mxGeometry')
    geometry.setAttribute('x', String(node.position.x))
    geometry.setAttribute('y', String(node.position.y))
    geometry.setAttribute('width', String(node.width || 180))
    geometry.setAttribute('height', String(node.height || 80))
    geometry.setAttribute('as', 'geometry')
    cell.appendChild(geometry)
    root.appendChild(cell)
  })

  state.edges.forEach(edge => {
    const cell = doc.createElement('mxCell')
    cell.setAttribute('id', edge.id)
    cell.setAttribute('value', edge.label?.toString() || '')
    cell.setAttribute('edge', '1')
    cell.setAttribute('source', edge.source)
    cell.setAttribute('target', edge.target)
    cell.setAttribute('parent', '1')
    cell.setAttribute(
      'style',
      'edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;exitX=0.5;exitY=1;exitDx=0;exitDy=0;entryX=0.5;entryY=0;entryDx=0;entryDy=0;',
    )

    const geometry = doc.createElement('mxGeometry')
    geometry.setAttribute('relative', '1')
    geometry.setAttribute('as', 'geometry')
    cell.appendChild(geometry)
    root.appendChild(cell)
  })

  return new XMLSerializer().serializeToString(doc)
}

function getDrawioStyle(type: NetworkComponentType): string {
  const color = getComponentColor(type)
  return `rounded=1;whiteSpace=wrap;html=1;fillColor=${color}20;strokeColor=${color};fontColor=#000000;`
}

export function importFromDrawio(xml: string): DiagramState {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const cells = doc.getElementsByTagName('mxCell')
  const nodes: DiagramNode[] = []
  const edges: DiagramEdge[] = []

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]
    const id = cell.getAttribute('id')
    if (!id || id === '0' || id === '1') continue

    const isEdge = cell.getAttribute('edge') === '1'
    const isVertex = cell.getAttribute('vertex') === '1'

    if (isEdge) {
      const source = cell.getAttribute('source')
      const target = cell.getAttribute('target')
      if (source && target) {
        edges.push({
          id,
          source,
          target,
          label: cell.getAttribute('value') || '',
          type: 'network-edge',
        })
      }
    } else if (isVertex) {
      const geometry = cell.getElementsByTagName('mxGeometry')[0]
      const tooltip = cell.getAttribute('tooltip')
      let data: any = {}
      try {
        if (tooltip) data = JSON.parse(tooltip)
      } catch {
        data = {
          id,
          name: cell.getAttribute('value') || 'Unknown',
          type: NetworkComponentType.VM,
          createdAt: new Date().toISOString(),
        }
      }

      nodes.push({
        id,
        type: `${(data.type as string)?.toLowerCase() || 'vm'}-node`,
        position: {
          x: parseFloat(geometry?.getAttribute('x') || '0'),
          y: parseFloat(geometry?.getAttribute('y') || '0'),
        },
        data,
        width: parseFloat(geometry?.getAttribute('width') || '180'),
        height: parseFloat(geometry?.getAttribute('height') || '80'),
      })
    }
  }

  return {
    nodes,
    edges,
    viewport: { x: 0, y: 0, zoom: 1 },
  }
}
