import type { DiagramNode, DiagramState } from '~/types/diagram'

type Canvas2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

interface RasterNode {
  id: string
  x: number
  y: number
  width: number
  height: number
  label: string
  subtitle: string
  accent: string
}

interface RasterEdge {
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
}

interface RasterScene {
  nodes: RasterNode[]
  edges: RasterEdge[]
  minX: number
  minY: number
  width: number
  height: number
}

export interface DiagramRasterOptions {
  scale?: number
  padding?: number
  targetWidth?: number
  targetHeight?: number
  backgroundColor?: string
}

const DEFAULT_NODE_WIDTH = 220
const DEFAULT_NODE_HEIGHT = 110

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return null

  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

function readDimension(raw: unknown, fallback: number): number {
  const value = asNumber(raw)
  if (value === null || value <= 0) return fallback
  return value
}

function getNodeDimensions(node: DiagramNode): { width: number; height: number } {
  const anyNode = node as any
  const measured = anyNode.measured || anyNode.dimensions || {}
  const style = anyNode.style || {}

  const width = readDimension(anyNode.width, readDimension(measured.width, readDimension(style.width, DEFAULT_NODE_WIDTH)))
  const height = readDimension(anyNode.height, readDimension(measured.height, readDimension(style.height, DEFAULT_NODE_HEIGHT)))

  return {
    width,
    height,
  }
}

function normalizeType(type: string): string {
  return type.replaceAll('_', ' ').replace(/\s+/g, ' ').trim()
}

function getNodeAccent(type: string): string {
  if (type.includes('VNET') || type.includes('SUBNET')) return '#0f766e'
  if (type.includes('GATEWAY') || type.includes('LOAD_BALANCER')) return '#1d4ed8'
  if (type.includes('FIREWALL') || type.includes('NSG') || type.includes('UDR')) return '#b91c1c'
  if (type.includes('VM') || type.includes('AKS') || type.includes('APP_SERVICE') || type.includes('FUNCTIONS')) return '#7c3aed'
  if (type.includes('STORAGE') || type.includes('KEY_VAULT') || type.includes('IDENTITY')) return '#166534'
  if (type.includes('INTERNET')) return '#9333ea'
  return '#334155'
}

function getNodeTitle(node: DiagramNode): { label: string; subtitle: string; accent: string } {
  const data = (node.data || {}) as Record<string, unknown>
  const name = typeof data.name === 'string' && data.name.trim().length > 0 ? data.name.trim() : node.id
  const typeRaw = typeof data.type === 'string' && data.type.trim().length > 0 ? data.type.trim() : 'Component'
  const type = normalizeType(typeRaw)
  return {
    label: name,
    subtitle: type,
    accent: getNodeAccent(typeRaw),
  }
}

function buildAbsolutePositionResolver(nodes: DiagramNode[]) {
  const byId = new Map<string, DiagramNode>()
  for (const node of nodes) byId.set(node.id, node)

  const memo = new Map<string, { x: number; y: number }>()

  function resolve(node: DiagramNode, stack: Set<string>): { x: number; y: number } {
    const cached = memo.get(node.id)
    if (cached) return cached

    const localX = asNumber(node.position?.x) ?? 0
    const localY = asNumber(node.position?.y) ?? 0
    const parentId = (node as any).parentNode as string | undefined

    if (!parentId) {
      const abs = { x: localX, y: localY }
      memo.set(node.id, abs)
      return abs
    }

    if (stack.has(parentId)) {
      const abs = { x: localX, y: localY }
      memo.set(node.id, abs)
      return abs
    }

    const parent = byId.get(parentId)
    if (!parent) {
      const abs = { x: localX, y: localY }
      memo.set(node.id, abs)
      return abs
    }

    stack.add(node.id)
    const parentAbs = resolve(parent, stack)
    stack.delete(node.id)

    const abs = {
      x: parentAbs.x + localX,
      y: parentAbs.y + localY,
    }
    memo.set(node.id, abs)
    return abs
  }

  return (node: DiagramNode) => resolve(node, new Set<string>())
}

function buildScene(diagramState: DiagramState, padding: number): RasterScene {
  const nodes = diagramState.nodes || []
  const edges = diagramState.edges || []
  const resolvePosition = buildAbsolutePositionResolver(nodes)

  const rasterNodes: RasterNode[] = nodes.map((node) => {
    const absolute = resolvePosition(node)
    const dimensions = getNodeDimensions(node)
    const title = getNodeTitle(node)

    return {
      id: node.id,
      x: absolute.x,
      y: absolute.y,
      width: dimensions.width,
      height: dimensions.height,
      label: title.label,
      subtitle: title.subtitle,
      accent: title.accent,
    }
  })

  const nodeById = new Map(rasterNodes.map(node => [node.id, node]))
  const rasterEdges: RasterEdge[] = []

  for (const edge of edges) {
    const source = nodeById.get(edge.source)
    const target = nodeById.get(edge.target)
    if (!source || !target) continue

    rasterEdges.push({
      sourceX: source.x + source.width / 2,
      sourceY: source.y + source.height / 2,
      targetX: target.x + target.width / 2,
      targetY: target.y + target.height / 2,
    })
  }

  if (rasterNodes.length === 0) {
    return {
      nodes: [],
      edges: [],
      minX: 0,
      minY: 0,
      width: 640,
      height: 360,
    }
  }

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const node of rasterNodes) {
    minX = Math.min(minX, node.x)
    minY = Math.min(minY, node.y)
    maxX = Math.max(maxX, node.x + node.width)
    maxY = Math.max(maxY, node.y + node.height)
  }

  minX -= padding
  minY -= padding
  maxX += padding
  maxY += padding

  return {
    nodes: rasterNodes,
    edges: rasterEdges,
    minX,
    minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  }
}

function roundedRectPath(context: Canvas2D, x: number, y: number, width: number, height: number, radius: number) {
  const safeRadius = Math.min(radius, width / 2, height / 2)
  context.beginPath()
  context.moveTo(x + safeRadius, y)
  context.lineTo(x + width - safeRadius, y)
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius)
  context.lineTo(x + width, y + height - safeRadius)
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height)
  context.lineTo(x + safeRadius, y + height)
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius)
  context.lineTo(x, y + safeRadius)
  context.quadraticCurveTo(x, y, x + safeRadius, y)
  context.closePath()
}

function drawClampedText(
  context: Canvas2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
) {
  const trimmed = text.trim()
  if (!trimmed) return

  if (context.measureText(trimmed).width <= maxWidth) {
    context.fillText(trimmed, x, y)
    return
  }

  const ellipsis = '...'
  let output = trimmed
  while (output.length > 0 && context.measureText(`${output}${ellipsis}`).width > maxWidth) {
    output = output.slice(0, -1)
  }

  context.fillText(`${output}${ellipsis}`, x, y)
}

function drawScene(context: Canvas2D, scene: RasterScene, outputWidth: number, outputHeight: number, backgroundColor: string) {
  context.save()
  context.fillStyle = backgroundColor
  context.fillRect(0, 0, outputWidth, outputHeight)

  const sceneScale = Math.min(outputWidth / scene.width, outputHeight / scene.height)
  const offsetX = (outputWidth - scene.width * sceneScale) / 2
  const offsetY = (outputHeight - scene.height * sceneScale) / 2

  const mapX = (value: number) => offsetX + (value - scene.minX) * sceneScale
  const mapY = (value: number) => offsetY + (value - scene.minY) * sceneScale

  context.strokeStyle = '#64748b'
  context.globalAlpha = 0.85
  context.lineWidth = clamp(1.5 * sceneScale, 1, 2.5)
  for (const edge of scene.edges) {
    context.beginPath()
    context.moveTo(mapX(edge.sourceX), mapY(edge.sourceY))
    context.lineTo(mapX(edge.targetX), mapY(edge.targetY))
    context.stroke()
  }

  const nodes = [...scene.nodes].sort((a, b) => (b.width * b.height) - (a.width * a.height))
  context.globalAlpha = 1
  for (const node of nodes) {
    const x = mapX(node.x)
    const y = mapY(node.y)
    const width = Math.max(1, node.width * sceneScale)
    const height = Math.max(1, node.height * sceneScale)
    const radius = clamp(12 * sceneScale, 5, 18)

    roundedRectPath(context, x, y, width, height, radius)
    context.fillStyle = '#ffffff'
    context.fill()
    context.strokeStyle = node.accent
    context.lineWidth = clamp(2 * sceneScale, 1.25, 3)
    context.stroke()

    const titleSize = clamp(14 * sceneScale, 10, 18)
    const subtitleSize = clamp(11 * sceneScale, 8, 14)
    const pad = clamp(14 * sceneScale, 8, 22)
    const maxTextWidth = Math.max(16, width - pad * 2)

    context.fillStyle = '#0f172a'
    context.font = `600 ${titleSize}px Segoe UI, sans-serif`
    drawClampedText(context, node.label, x + pad, y + pad + titleSize, maxTextWidth)

    context.fillStyle = '#334155'
    context.font = `${subtitleSize}px Segoe UI, sans-serif`
    drawClampedText(context, node.subtitle, x + pad, y + pad + titleSize + subtitleSize + clamp(8 * sceneScale, 5, 12), maxTextWidth)
  }

  context.restore()
}

function getOutputSize(scene: RasterScene, options?: DiagramRasterOptions): { width: number; height: number } {
  const scale = Number.isFinite(options?.scale) && (options?.scale || 0) > 0 ? (options?.scale as number) : 1

  if ((options?.targetWidth || 0) > 0 && (options?.targetHeight || 0) > 0) {
    return {
      width: Math.max(1, Math.ceil(options!.targetWidth!)),
      height: Math.max(1, Math.ceil(options!.targetHeight!)),
    }
  }

  return {
    width: Math.max(1, Math.ceil(scene.width * scale)),
    height: Math.max(1, Math.ceil(scene.height * scale)),
  }
}

function renderWithContext(
  context: Canvas2D,
  diagramState: DiagramState,
  options?: DiagramRasterOptions,
  canvasWidth?: number,
  canvasHeight?: number,
) {
  const scene = buildScene(diagramState, Math.max(8, Math.floor(options?.padding ?? 48)))
  const output = getOutputSize(scene, options)
  drawScene(
    context,
    scene,
    canvasWidth ?? output.width,
    canvasHeight ?? output.height,
    options?.backgroundColor || '#ffffff',
  )
}

export async function renderDiagramToPngBlobInWorker(
  diagramState: DiagramState,
  options?: DiagramRasterOptions,
): Promise<Blob> {
  if (typeof OffscreenCanvas === 'undefined') {
    throw new Error('OffscreenCanvas is unavailable for worker diagram raster export')
  }

  const scene = buildScene(diagramState, Math.max(8, Math.floor(options?.padding ?? 48)))
  const output = getOutputSize(scene, options)
  const canvas = new OffscreenCanvas(output.width, output.height)
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Unable to acquire 2D context for worker diagram raster export')
  }

  drawScene(context, scene, output.width, output.height, options?.backgroundColor || '#ffffff')
  return canvas.convertToBlob({ type: 'image/png' })
}

export async function renderDiagramToPngBlobInMainThread(
  diagramState: DiagramState,
  options?: DiagramRasterOptions,
): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('Document is unavailable for main-thread diagram raster export')
  }

  const scene = buildScene(diagramState, Math.max(8, Math.floor(options?.padding ?? 48)))
  const output = getOutputSize(scene, options)
  const canvas = document.createElement('canvas')
  canvas.width = output.width
  canvas.height = output.height

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Unable to acquire 2D context for main-thread diagram raster export')
  }

  drawScene(context, scene, output.width, output.height, options?.backgroundColor || '#ffffff')

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((value) => resolve(value), 'image/png')
  })

  if (!blob) {
    throw new Error('Unable to encode rasterized diagram as PNG')
  }

  return blob
}

export async function renderDiagramToPngDataUrlInMainThread(
  diagramState: DiagramState,
  options?: DiagramRasterOptions,
): Promise<string> {
  if (typeof document === 'undefined') {
    throw new Error('Document is unavailable for main-thread diagram raster export')
  }

  const scene = buildScene(diagramState, Math.max(8, Math.floor(options?.padding ?? 48)))
  const output = getOutputSize(scene, options)
  const canvas = document.createElement('canvas')
  canvas.width = output.width
  canvas.height = output.height

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Unable to acquire 2D context for main-thread diagram raster export')
  }

  drawScene(context, scene, output.width, output.height, options?.backgroundColor || '#ffffff')
  return canvas.toDataURL('image/png', 0.92)
}