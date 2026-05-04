import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import type { DiagramEdge, DiagramNode, DiagramState } from '~/types/diagram'
import { NetworkComponentType, getComponentColor, getComponentLabel } from '~/types/network'
import { getNodeTypeForComponent } from '~/lib/export/nodeTypeMap'
import { VNET_HEADER_HEIGHT, SUBNET_HEADER_HEIGHT } from '~/lib/layout'

// ─── Theme colour palettes ────────────────────────────────────────────────────

interface ThemePalette {
  canvasBg: string        // diagram page background
  cardBg: string          // leaf-node card fill
  cardBgOpacity: number   // 0-100, card fill opacity
  containerBodyBg: string // swimlane body fill (below header band)
  textPrimary: string     // node name text
  textType: string        // type-label / dimmed text
  textDetail: string      // detail sub-line text
  textHeader: string      // swimlane header label
  containerOverlineText: string // VNet/Subnet top small label
  containerTitleText: string    // VNet/Subnet primary name
  containerDetailText: string   // VNet/Subnet detail lines
  edgeStroke: string      // attachment edge stroke
}

const DARK_PALETTE: ThemePalette = {
  canvasBg: '#252423',
  cardBg: '#1b1a19',
  cardBgOpacity: 88,
  containerBodyBg: '#2a344026',
  textPrimary: '#f3f2f1',
  textType: '#a19f9d',
  textDetail: '#a19f9d',
  textHeader: '#05314a',
  containerOverlineText: '#f3fbff',
  containerTitleText: '#05314a',
  containerDetailText: '#f3fbff',
  edgeStroke: '#f3f2f1',
}

const LIGHT_PALETTE: ThemePalette = {
  canvasBg: '#f3f2f1',
  cardBg: '#ffffff',
  cardBgOpacity: 88,
  containerBodyBg: '#0078d414',
  textPrimary: '#323130',
  textType: '#605e5c',
  textDetail: '#605e5c',
  textHeader: '#ffffff',
  containerOverlineText: '#323130',
  containerTitleText: '#ffffff',
  containerDetailText: '#ffffff',
  edgeStroke: '#121212',
}

// ─── Azure shape mapping ──────────────────────────────────────────────────────

/** Map each component type to a verified draw.io built-in mxgraph.azure shape. */
function getAzureShapeName(type: NetworkComponentType): string {
  const shapes: Record<NetworkComponentType, string> = {
    [NetworkComponentType.VNET]: 'mxgraph.azure.virtual_network',
    [NetworkComponentType.SUBNET]: 'mxgraph.azure.virtual_network',
    [NetworkComponentType.NETWORK_IC]: 'mxgraph.azure.virtual_machine',
    [NetworkComponentType.NSG]: 'mxgraph.azure.access_control',
    [NetworkComponentType.ASG]: 'mxgraph.azure.access_control',
    [NetworkComponentType.IP_ADDRESS]: 'mxgraph.azure.traffic_manager',
    [NetworkComponentType.DNS_ZONE]: 'mxgraph.azure.traffic_manager',
    [NetworkComponentType.VNET_PEERING]: 'mxgraph.azure.express_route',
    [NetworkComponentType.UDR]: 'mxgraph.azure.service_endpoint',
    [NetworkComponentType.VPN_GATEWAY]: 'mxgraph.azure.virtual_network',
    [NetworkComponentType.APP_GATEWAY]: 'mxgraph.azure.azure_website',
    [NetworkComponentType.NVA]: 'mxgraph.azure.server',
    [NetworkComponentType.LOAD_BALANCER]: 'mxgraph.azure.azure_load_balancer',
    [NetworkComponentType.VM]: 'mxgraph.azure.virtual_machine',
    [NetworkComponentType.VMSS]: 'mxgraph.azure.server_rack',
    [NetworkComponentType.AKS]: 'mxgraph.azure.server_rack',
    [NetworkComponentType.APP_SERVICE]: 'mxgraph.azure.azure_website',
    [NetworkComponentType.FUNCTIONS]: 'mxgraph.azure.azure_website',
    [NetworkComponentType.STORAGE_ACCOUNT]: 'mxgraph.azure.storage',
    [NetworkComponentType.BLOB_STORAGE]: 'mxgraph.azure.storage_blob',
    [NetworkComponentType.MANAGED_DISK]: 'mxgraph.azure.vhd_data_disk',
    [NetworkComponentType.KEY_VAULT]: 'mxgraph.azure.certificate',
    [NetworkComponentType.MANAGED_IDENTITY]: 'mxgraph.azure.azure_active_directory',
    [NetworkComponentType.SERVICE_ENDPOINT]: 'mxgraph.azure.service_endpoint',
    [NetworkComponentType.PRIVATE_ENDPOINT]: 'mxgraph.azure.service_endpoint',
    [NetworkComponentType.FIREWALL]: 'mxgraph.azure.access_control',
    [NetworkComponentType.BASTION]: 'mxgraph.azure.computer',
    // Built-in internet representation from Azure library
    [NetworkComponentType.INTERNET]: 'mxgraph.azure.cloud',
  }
  return shapes[type] ?? 'mxgraph.azure.virtual_machine'
}

// ─── Main serialiser ──────────────────────────────────────────────────────────

export function serializeDiagramToDrawio(state: DiagramState, isDark = true): string {
  const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE
  const doc = new DOMParser().parseFromString('<mxGraphModel/>', 'text/xml')

  doc.documentElement.setAttribute('background', palette.canvasBg)
  doc.documentElement.setAttribute('grid', '0')
  doc.documentElement.setAttribute('page', '0')
  doc.documentElement.setAttribute('math', '0')
  doc.documentElement.setAttribute('shadow', '0')

  const root = doc.createElement('root')
  doc.documentElement.appendChild(root)

  const cell0 = doc.createElement('mxCell')
  cell0.setAttribute('id', '0')
  root.appendChild(cell0)

  const cell1 = doc.createElement('mxCell')
  cell1.setAttribute('id', '1')
  cell1.setAttribute('parent', '0')
  root.appendChild(cell1)

  // Sort nodes so parents appear before children — draw.io requires parent cells
  // to be defined before any child references them.
  const sortedNodes = topologicallySortNodes(state.nodes)

  // Keep edges below nodes in draw.io's render stack by adding edge cells first.
  for (const edge of state.edges) {
    const cell = doc.createElement('mxCell')
    cell.setAttribute('id', edge.id)
    cell.setAttribute('value', edge.label?.toString() || '')
    cell.setAttribute('edge', '1')
    cell.setAttribute('source', edge.source)
    cell.setAttribute('target', edge.target)
    cell.setAttribute('parent', '1')
    cell.setAttribute(
      'style',
      `edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;` +
      `strokeColor=${palette.edgeStroke};strokeWidth=1.5;` +
      `labelBackgroundColor=none;` +
      ``,
    )

    const geometry = doc.createElement('mxGeometry')
    geometry.setAttribute('relative', '1')
    geometry.setAttribute('as', 'geometry')
    cell.appendChild(geometry)
    root.appendChild(cell)
  }

  for (const node of sortedNodes) {
    const type = node.data.type as NetworkComponentType
    const isContainer = type === NetworkComponentType.VNET || type === NetworkComponentType.SUBNET
    const isInternet = type === NetworkComponentType.INTERNET
    const parentCellId = (node as any).parentNode || '1'

    const cell = doc.createElement('mxCell')
    cell.setAttribute('id', node.id)
    cell.setAttribute('value', getDrawioLabel(node, palette))
    cell.setAttribute('vertex', '1')
    cell.setAttribute('parent', parentCellId)
    cell.setAttribute('style', getDrawioStyle(node, palette))
    cell.setAttribute('tooltip', JSON.stringify(node.data))

    const geometry = doc.createElement('mxGeometry')
    geometry.setAttribute('x', String(node.position.x))
    geometry.setAttribute('y', String(node.position.y))
    geometry.setAttribute('width', String(node.width || 180))
    geometry.setAttribute('height', String(node.height || 80))
    geometry.setAttribute('as', 'geometry')
    cell.appendChild(geometry)
    root.appendChild(cell)

    // Non-container nodes get a built-in Azure icon child cell rendered left of the label.
    // Internet node gets a centered, taller icon.
    if (!isContainer) {
      const nodeW = node.width || 180
      const nodeH = node.height || 80
      const accentColor = getComponentColor(type)
      // Icons in the live canvas always use the component accent colour.
      const iconFillColor = accentColor

      let iconSize: number
      let iconX: number
      let iconY: number

      if (isInternet) {
        // Internet: large centered icon occupying most of the node height
        iconSize = Math.min(nodeH - 24, 56)
        iconX = Math.round((nodeW - iconSize) / 2)
        iconY = 8
      } else {
        iconSize = 32
        iconX = 8
        iconY = Math.max(4, Math.round((nodeH - iconSize) / 2))
      }

      const iconCell = doc.createElement('mxCell')
      iconCell.setAttribute('id', `${node.id}_icon`)
      iconCell.setAttribute('value', '')
      iconCell.setAttribute('vertex', '1')
      iconCell.setAttribute('connectable', '0')
      iconCell.setAttribute('parent', node.id)
      iconCell.setAttribute(
        'style',
        `shape=${getAzureShapeName(type)};sketch=0;html=1;pointerEvents=0;` +
        `strokeColor=${iconFillColor};fillColor=${iconFillColor};fontColor=${iconFillColor};` +
        `gradientColor=none;aspect=fixed;`,
      )

      const iconGeom = doc.createElement('mxGeometry')
      iconGeom.setAttribute('x', String(iconX))
      iconGeom.setAttribute('y', String(iconY))
      iconGeom.setAttribute('width', String(iconSize))
      iconGeom.setAttribute('height', String(iconSize))
      iconGeom.setAttribute('as', 'geometry')
      iconCell.appendChild(iconGeom)
      root.appendChild(iconCell)
    }
  }

  return new XMLSerializer().serializeToString(doc)
}

// ─── Label builder ────────────────────────────────────────────────────────────

function getDrawioLabel(node: DiagramNode, palette: ThemePalette): string {
  const type = node.data.type as NetworkComponentType
  const name = escapeHtml(node.data.name)
  const typeLabel = escapeHtml(getComponentLabel(type))

  if (type === NetworkComponentType.VNET) {
    const d = node.data as any
    const region = d.region ? escapeHtml(d.region) : ''
    const addrSpace = d.addressSpace?.length ? escapeHtml(d.addressSpace.join(', ')) : ''
    let html = `<span style="font-family:Segoe UI, sans-serif;font-size:10px;font-weight:600;letter-spacing:0.4px;color:${palette.containerOverlineText};opacity:0.9;">VIRTUAL NETWORK</span><br/>`
    html += `<span style="font-family:Segoe UI, sans-serif;font-size:13px;font-weight:600;color:${palette.containerTitleText};">${name}</span>`
    if (region) html += `<br/><span style="font-family:Segoe UI, sans-serif;font-size:10px;font-weight:700;color:${palette.containerDetailText};">${region}</span>`
    if (addrSpace) html += `<br/><span style="font-family:Segoe UI, sans-serif;font-size:10px;font-weight:500;color:${palette.containerDetailText};">Address Space: ${addrSpace}</span>`
    return html
  }

  if (type === NetworkComponentType.SUBNET) {
    const d = node.data as any
    const cidr = d.addressPrefix ? escapeHtml(d.addressPrefix) : ''
    const nsg = d.nsgId ? 'NSG: Protected' : ''
    let html = `<span style="font-family:Segoe UI, sans-serif;font-size:10px;font-weight:600;letter-spacing:0.4px;color:${palette.containerOverlineText};opacity:0.9;">SUBNET</span><br/>`
    html += `<span style="font-family:Segoe UI, sans-serif;font-size:12px;font-weight:700;color:${palette.containerTitleText};">${name}</span>`
    if (cidr) html += `<br/><span style="font-family:Segoe UI, sans-serif;font-size:10px;font-weight:500;color:${palette.containerDetailText};">CIDR: ${cidr}</span>`
    if (nsg) html += `<br/><span style="font-family:Segoe UI, sans-serif;font-size:10px;font-weight:500;color:${palette.containerDetailText};">${nsg}</span>`
    return html
  }

  if (type === NetworkComponentType.INTERNET) {
    // Label sits below the large centered icon; vertical padding handled by spacingTop
    return `<b style="font-size:12px;" color="${palette.textPrimary}">Public Internet</b>`
  }

  // Regular card node: type label (dimmed) + bold name + optional detail line.
  const detail = escapeHtml(getNodeDetail(node))
  let html = `<font style="font-size:8px;" color="${palette.textType}">${typeLabel}</font>`
  html += `<br/><b style="font-size:11px;" color="${palette.textPrimary}">${name}</b>`
  if (detail) html += `<br/><font style="font-size:9px;" color="${palette.textDetail}">${detail}</font>`
  return html
}

// ─── Style builder ────────────────────────────────────────────────────────────

function getDrawioStyle(node: DiagramNode, palette: ThemePalette): string {
  const type = node.data.type as NetworkComponentType
  const color = getComponentColor(type)

  if (type === NetworkComponentType.VNET) {
    return (
      `swimlane;startSize=${VNET_HEADER_HEIGHT};startFill=1;` +
      `fillColor=${isDarkPalette(palette) ? '#60cdff' : color};swimlaneFillColor=${palette.containerBodyBg};` +
      `strokeColor=${color};strokeWidth=2;` +
      `fontColor=${palette.textHeader};fontStyle=1;fontSize=11;align=left;spacingLeft=14;` +
      `swimlaneLine=1;html=1;rounded=1;arcSize=1;` +
      `fillOpacity=72;`
    )
  }

  if (type === NetworkComponentType.SUBNET) {
    return (
      `swimlane;startSize=${SUBNET_HEADER_HEIGHT};startFill=1;` +
      `fillColor=${isDarkPalette(palette) ? '#60cdff' : color};swimlaneFillColor=${palette.containerBodyBg};` +
      `strokeColor=${color};strokeWidth=2;` +
      `fontColor=${palette.textHeader};fontStyle=1;fontSize=11;align=left;spacingLeft=14;` +
      `dashed=1;dashPattern=8 4;swimlaneLine=1;html=1;rounded=1;arcSize=1;` +
      `fillOpacity=72;`
    )
  }

  if (type === NetworkComponentType.INTERNET) {
    // Public Internet stays a light pill in both themes, matching the live UI.
    return (
      `rounded=1;arcSize=16;html=1;fillColor=#f8fbff;strokeColor=${color};strokeWidth=2;` +
      `fillOpacity=99;fontColor=#0b2239;align=center;verticalAlign=bottom;spacingBottom=10;`
    )
  }

  // Regular card: solid fill, colored border, label starts right of the 48 px icon column.
  return (
    `rounded=1;html=1;fillColor=${palette.cardBg};strokeColor=${color};strokeWidth=2;` +
    `fillOpacity=${palette.cardBgOpacity};` +
    `fontColor=${palette.textPrimary};align=left;verticalAlign=top;` +
    `spacingLeft=48;spacingTop=8;spacingRight=8;spacingBottom=8;`
  )
}

// ─── Detail text ──────────────────────────────────────────────────────────────

function getNodeDetail(node: DiagramNode): string {
  const d = node.data as any
  const type = d.type as NetworkComponentType

  switch (type) {
    case NetworkComponentType.VM:
      return [d.os, d.size].filter(Boolean).join(' - ')
    case NetworkComponentType.VMSS:
      return d.capacity ? `${d.capacity} instances` : (d.sku || '')
    case NetworkComponentType.AKS:
      return [d.nodeCount ? `${d.nodeCount} nodes` : '', d.kubernetesVersion || ''].filter(Boolean).join(' - ')
    case NetworkComponentType.APP_SERVICE:
      return d.tier || d.sku || ''
    case NetworkComponentType.FUNCTIONS:
      return d.runtimeStack || d.tier || ''
    case NetworkComponentType.LOAD_BALANCER:
      return [d.sku, d.loadBalancerType].filter(Boolean).join(' - ')
    case NetworkComponentType.APP_GATEWAY:
      return [d.sku, d.frontendType ? `${d.frontendType} | Cap: ${d.capacity || 1}` : ''].filter(Boolean).join(' ')
    case NetworkComponentType.DNS_ZONE:
      return d.zoneType || ''
    case NetworkComponentType.VPN_GATEWAY:
      return [d.sku, d.vpnType].filter(Boolean).join(' - ')
    case NetworkComponentType.NETWORK_IC:
      return d.privateIpAddress || ''
    case NetworkComponentType.IP_ADDRESS:
      return d.ipAddress || d.allocationMethod || ''
    case NetworkComponentType.NSG:
      return d.rules?.length ? `${d.rules.length} rules` : ''
    case NetworkComponentType.ASG:
      return d.description || ''
    case NetworkComponentType.UDR:
      return d.routes?.length ? `${d.routes.length} routes` : ''
    case NetworkComponentType.NVA:
      return d.imagePublisher || d.size || ''
    case NetworkComponentType.STORAGE_ACCOUNT:
      return [d.accountTier, d.replicationType].filter(Boolean).join(' - ')
    case NetworkComponentType.BLOB_STORAGE:
      return d.accessTier || ''
    case NetworkComponentType.MANAGED_DISK:
      return [d.diskSizeGB ? `${d.diskSizeGB} GB` : '', d.sku || d.storageType || ''].filter(Boolean).join(' - ')
    case NetworkComponentType.KEY_VAULT:
      return d.sku || d.tier || ''
    case NetworkComponentType.MANAGED_IDENTITY:
      return d.identityType || ''
    case NetworkComponentType.PRIVATE_ENDPOINT:
      return d.targetServiceName || d.targetSubresource || ''
    case NetworkComponentType.SERVICE_ENDPOINT:
      return d.service || ''
    case NetworkComponentType.FIREWALL:
      return [d.sku, d.tier].filter(Boolean).join(' - ')
    case NetworkComponentType.BASTION:
      return d.sku || ''
    case NetworkComponentType.VNET_PEERING:
      return d.remoteVnetName || ''
    default:
      return ''
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Topologically sort nodes so each parent node appears before its children.
 * Required by draw.io — referencing an unknown parent cell is invalid.
 */
function topologicallySortNodes(nodes: DiagramNode[]): DiagramNode[] {
  const nodeIds = new Set(nodes.map(n => n.id))
  const sorted: DiagramNode[] = []
  const visited = new Set<string>()

  function visit(node: DiagramNode) {
    if (visited.has(node.id)) return
    const parentId = (node as any).parentNode as string | undefined
    if (parentId && nodeIds.has(parentId) && !visited.has(parentId)) {
      const parent = nodes.find(n => n.id === parentId)
      if (parent) visit(parent)
    }
    visited.add(node.id)
    sorted.push(node)
  }

  for (const node of nodes) visit(node)
  return sorted
}

function escapeHtml(s: string): string {
  if (!s) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function isDarkPalette(palette: ThemePalette): boolean {
  return palette.canvasBg === DARK_PALETTE.canvasBg
}

// ─── Import ───────────────────────────────────────────────────────────────────

export function importFromDrawio(xml: string): DiagramState {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const cells = doc.getElementsByTagName('mxCell')
  const nodes: DiagramNode[] = []
  const edges: DiagramEdge[] = []
  const realNodeIds = new Set<string>()

  for (let i = 0; i < cells.length; i += 1) {
    const cell = cells[i]
    const id = cell.getAttribute('id')
    if (!id || id === '0' || id === '1') continue
    const isVertex = cell.getAttribute('vertex') === '1'
    const tooltip = cell.getAttribute('tooltip')
    if (isVertex && tooltip) {
      realNodeIds.add(id)
    }
  }

  for (let i = 0; i < cells.length; i += 1) {
    const cell = cells[i]
    const id = cell.getAttribute('id')
    if (!id || id === '0' || id === '1') continue

    const isEdge = cell.getAttribute('edge') === '1'
    const isVertex = cell.getAttribute('vertex') === '1'

    if (isEdge) {
      const source = cell.getAttribute('source')
      const target = cell.getAttribute('target')
      if (source && target && realNodeIds.has(source) && realNodeIds.has(target)) {
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
      if (!tooltip) continue

      let data: any = {}
      try {
        data = JSON.parse(tooltip)
      } catch {
        data = {}
      }

      const parentId = cell.getAttribute('parent')
      const resolvedParentId = parentId && realNodeIds.has(parentId) ? parentId : undefined

      const componentType = resolveComponentType(data?.type)
      const name = data?.name || cell.getAttribute('value') || 'Unknown'
      const normalizedData = {
        ...data,
        id: data?.id || id,
        name,
        type: componentType,
        createdAt: data?.createdAt || new Date().toISOString(),
      }

      nodes.push({
        id,
        type: getNodeTypeForComponent(componentType),
        position: {
          x: parseFloat(geometry?.getAttribute('x') || '0'),
          y: parseFloat(geometry?.getAttribute('y') || '0'),
        },
        data: normalizedData,
        width: parseFloat(geometry?.getAttribute('width') || '180'),
        height: parseFloat(geometry?.getAttribute('height') || '80'),
        parentNode: resolvedParentId,
      })
    }
  }

  return {
    nodes,
    edges,
    viewport: { x: 0, y: 0, zoom: 1 },
  }
}

function resolveComponentType(rawType: unknown): NetworkComponentType {
  if (typeof rawType === 'string' && Object.values(NetworkComponentType).includes(rawType as NetworkComponentType)) {
    return rawType as NetworkComponentType
  }
  return NetworkComponentType.VM
}

