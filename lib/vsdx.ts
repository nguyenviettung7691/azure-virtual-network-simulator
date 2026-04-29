import JSZip from 'jszip'
import type { DiagramState } from '~/types/diagram'
import { NetworkComponentType, getComponentColor } from '~/types/network'

export async function exportToVsdx(state: DiagramState): Promise<Blob> {
  const zip = new JSZip()

  zip.file('[Content_Types].xml', generateContentTypes())
  zip.file('_rels/.rels', generateRels())
  zip.file('visio/document.xml', generateDocument())
  zip.file('visio/_rels/document.xml.rels', generateDocumentRels())
  zip.file('visio/pages/page1.xml', generatePage(state))
  zip.file('visio/pages/_rels/page1.xml.rels', generatePageRels())

  return zip.generateAsync({ type: 'blob' })
}

function generateContentTypes(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/visio/document.xml" ContentType="application/vnd.ms-visio.drawing.main+xml"/>
  <Override PartName="/visio/pages/page1.xml" ContentType="application/vnd.ms-visio.page+xml"/>
</Types>`
}

function generateRels(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/document" Target="visio/document.xml"/>
</Relationships>`
}

function generateDocument(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<VisioDocument xmlns="http://schemas.microsoft.com/office/visio/2012/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <DocumentProperties>
    <Creator>Azure Virtual Network Simulator</Creator>
    <Title>Azure VNet Diagram</Title>
  </DocumentProperties>
  <Pages r:id="rId1"/>
</VisioDocument>`
}

function generateDocumentRels(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/page" Target="pages/page1.xml"/>
</Relationships>`
}

function generatePage(state: DiagramState): string {
  const shapes = state.nodes
    .map((node, idx) => {
      const color = getComponentColor(node.data.type)
      const x = (node.position.x / 72).toFixed(4)
      const y = (node.position.y / 72).toFixed(4)
      const w = ((node.width || 180) / 72).toFixed(4)
      const h = ((node.height || 80) / 72).toFixed(4)

      return `<Shape ID="${idx + 1}" Type="Shape" LineStyle="0" FillStyle="0" TextStyle="0">
      <Cell N="PinX" V="${x}"/>
      <Cell N="PinY" V="${y}"/>
      <Cell N="Width" V="${w}"/>
      <Cell N="Height" V="${h}"/>
      <Cell N="FillForegnd" V="${color}"/>
      <Cell N="LineColor" V="${color}"/>
      <Text>${escapeXml(node.data.name)}</Text>
    </Shape>`
    })
    .join('\n')

  const connects = state.edges
    .map((edge, idx) => {
      const sourceIdx = state.nodes.findIndex(n => n.id === edge.source) + 1
      const targetIdx = state.nodes.findIndex(n => n.id === edge.target) + 1
      if (sourceIdx <= 0 || targetIdx <= 0) return ''
      return `<Connect FromSheet="${state.nodes.length + idx + 1}" FromCell="BeginX" ToSheet="${sourceIdx}" ToCell="PinX"/>
    <Connect FromSheet="${state.nodes.length + idx + 1}" FromCell="EndX" ToSheet="${targetIdx}" ToCell="PinX"/>`
    })
    .filter(Boolean)
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<PageContents xmlns="http://schemas.microsoft.com/office/visio/2012/main">
  <Shapes>
    ${shapes}
  </Shapes>
  <Connects>
    ${connects}
  </Connects>
</PageContents>`
}

function generatePageRels(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function importFromVsdx(file: File): Promise<DiagramState> {
  const zip = await JSZip.loadAsync(file)
  const pageFile = zip.file('visio/pages/page1.xml')
  if (!pageFile) {
    throw new Error('Invalid .vsdx file: missing page1.xml')
  }

  const pageXml = await pageFile.async('text')
  const shapeRegex =
    /<Shape ID="(\d+)"[^>]*>[\s\S]*?<Cell N="PinX" V="([^"]*)"[\s\S]*?<Cell N="PinY" V="([^"]*)"[\s\S]*?<Cell N="Width" V="([^"]*)"[\s\S]*?<Cell N="Height" V="([^"]*)"[\s\S]*?<Text>(.*?)<\/Text>[\s\S]*?<\/Shape>/g

  const nodes: any[] = []
  let match
  while ((match = shapeRegex.exec(pageXml)) !== null) {
    const [, id, pinX, pinY, width, height, text] = match
    nodes.push({
      id: `shape-${id}`,
      type: 'vm-node',
      position: {
        x: parseFloat(pinX) * 72,
        y: parseFloat(pinY) * 72,
      },
      data: {
        id: `shape-${id}`,
        name: text || `Shape ${id}`,
        type: NetworkComponentType.VM,
        createdAt: new Date().toISOString(),
      },
      width: parseFloat(width) * 72,
      height: parseFloat(height) * 72,
    })
  }

  return {
    nodes,
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  }
}
