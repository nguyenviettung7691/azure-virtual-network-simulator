import { serializeDomElementToSvg } from '~/lib/export/domSnapshot'
import { buildPdfFromPngBytes } from '~/lib/export/pdf'
import { renderDiagramToPngDataUrlInMainThread } from '~/lib/export/diagramRaster'
import { finalizeSvgMarkup } from '~/lib/export/svg'
import type { SvgSnapshot } from '~/lib/export/domSnapshot'
import type {
  WorkerExportFormat,
  WorkerExportPayload,
  WorkerExportResponseMessage,
  WorkerExportStage,
} from '~/lib/export/types'
import type { DiagramState } from '~/types/diagram'

export const useExport = () => {
  const diagramStore = useDiagramStore()
  const settingsStore = useSettingsStore()

  type ImageExportProgressCallback = (stage: WorkerExportStage, percent: number) => void
  function isTransparentColor(color: string): boolean {
    const normalized = color.trim().toLowerCase()
    return normalized === ''
      || normalized === 'transparent'
      || normalized === 'rgba(0, 0, 0, 0)'
      || normalized === 'rgba(0,0,0,0)'
  }

  function getThemeSurfaceColor(): string {
    if (typeof document === 'undefined') return '#ffffff'

    const rootStyles = window.getComputedStyle(document.documentElement)
    const ground = rootStyles.getPropertyValue('--surface-ground').trim()
    if (ground) return ground

    const surface = rootStyles.getPropertyValue('--surface').trim()
    if (surface) return surface

    return document.documentElement.classList.contains('dark-mode') ? '#1b1a19' : '#ffffff'
  }

  function getCanvasBackgroundColor(): string {
    if (typeof document === 'undefined') return '#ffffff'

    const selectors = ['.diagram-area', '.diagram-canvas-wrapper', '.vnet-flow', '.vue-flow__pane']
    for (const selector of selectors) {
      const element = document.querySelector(selector) as HTMLElement | null
      if (!element) continue
      const backgroundColor = window.getComputedStyle(element).backgroundColor
      if (!isTransparentColor(backgroundColor)) return backgroundColor
    }

    return getThemeSurfaceColor()
  }

  async function yieldToUi(): Promise<void> {
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    await new Promise<void>(resolve => setTimeout(resolve, 0))
  }

  async function getCanvasElement(): Promise<HTMLElement | null> {
    if (typeof document === 'undefined') return null
    return document.querySelector('.vue-flow__viewport') as HTMLElement
  }

  function detectIsDark(): boolean {
    if (typeof document === 'undefined') return true

    const root = document.documentElement
    const body = document.body
    if (root.classList.contains('dark-mode') || body?.classList.contains('dark-mode') || root.getAttribute('data-theme') === 'dark') {
      return true
    }

    // Some theme presets are visually dark even if darkMode is not explicitly
    // set to "dark". Treat known dark presets as dark exports.
    if (root.classList.contains('theme-azure-dark')) {
      return true
    }

    const canvasColor = getCanvasBackgroundColor()
    const canvasLuminance = getColorLuminance(canvasColor)
    if (canvasLuminance !== null) return canvasLuminance < 0.5

    // Fall back to user preference when visual heuristics are unavailable.
    if (settingsStore?.darkMode === 'dark') return true
    if (settingsStore?.darkMode === 'light') return false
    if (typeof settingsStore?.isDarkMode === 'boolean') return settingsStore.isDarkMode

    return false
  }

  function getColorLuminance(color: string): number | null {
    const normalized = color.trim().toLowerCase()
    const hexMatch = normalized.match(/^#([0-9a-f]{6})$/i)
    if (hexMatch) {
      const hex = hexMatch[1]
      const red = Number.parseInt(hex.slice(0, 2), 16)
      const green = Number.parseInt(hex.slice(2, 4), 16)
      const blue = Number.parseInt(hex.slice(4, 6), 16)
      return ((0.2126 * red) + (0.7152 * green) + (0.0722 * blue)) / 255
    }

    const rgbMatch = normalized.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/)
    if (!rgbMatch) return null

    const red = Number.parseInt(rgbMatch[1], 10)
    const green = Number.parseInt(rgbMatch[2], 10)
    const blue = Number.parseInt(rgbMatch[3], 10)
    return ((0.2126 * red) + (0.7152 * green) + (0.0722 * blue)) / 255
  }

  async function rasterizeSnapshotToPngBlob(snapshot: SvgSnapshot, scale = 1): Promise<Blob> {
    const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1
    const svgMarkup = finalizeSvgMarkup(snapshot.svgMarkup, snapshot.width, snapshot.height)

    // Chrome taints the canvas when an SVG with <foreignObject> is loaded from a
    // blob URL (which has an opaque/null origin in canvas security checks).
    // Using a base64 data URI treats the SVG as same-origin and avoids the taint.
    const base64 = btoa(unescape(encodeURIComponent(svgMarkup)))
    const dataUri = `data:image/svg+xml;base64,${base64}`

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('Failed to load SVG snapshot as image'))
      image.src = dataUri
    })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(snapshot.width * safeScale)
    canvas.height = Math.ceil(snapshot.height * safeScale)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Unable to acquire 2D context for PNG rasterization')
    context.scale(safeScale, safeScale)
    context.drawImage(img, 0, 0, snapshot.width, snapshot.height)
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Failed to encode PNG'))), 'image/png')
    })
  }

  function canUseExportWorker(): boolean {
    return typeof Worker !== 'undefined'
  }

  function createImageExportWorker(): Worker {
    return new Worker(new URL('../lib/export/diagramExport.worker.ts', import.meta.url), { type: 'module' })
  }

  function createRequestId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }

  async function captureExactSvgSnapshot(): Promise<SvgSnapshot | null> {
    const el = await getCanvasElement()
    if (!el) return null

    await yieldToUi()
    return serializeDomElementToSvg(el, {
      backgroundColor: getCanvasBackgroundColor(),
    })
  }

  function cloneDiagramState(state: DiagramState): DiagramState {
    if (typeof structuredClone === 'function') {
      try {
        return structuredClone(state)
      } catch {
        // Fallback below for environments where structuredClone cannot clone proxied data.
      }
    }
    return JSON.parse(JSON.stringify(state)) as DiagramState
  }

  function getExtensionForFormat(format: WorkerExportFormat): string {
    if (format === 'drawio') return 'drawio'
    return format
  }

  async function runWorkerImageExport(
    payload: WorkerExportPayload,
    filename: string,
    onProgress?: ImageExportProgressCallback,
  ): Promise<boolean> {
    if (!canUseExportWorker()) return false

    const worker = createImageExportWorker()
    const timeoutMs = 120000

    try {
      onProgress?.('queued', 1)
      const result = await new Promise<Blob>((resolve, reject) => {
        const timeout = setTimeout(() => {
          cleanup()
          reject(new Error('Image export worker timed out'))
        }, timeoutMs)

        const cleanup = () => {
          clearTimeout(timeout)
          worker.onmessage = null
          worker.onerror = null
          worker.terminate()
        }

        worker.onmessage = (event: MessageEvent<WorkerExportResponseMessage>) => {
          const message = event.data
          if (message.requestId !== payload.requestId) return

          if (message.type === 'progress') {
            onProgress?.(message.stage, message.percent)
            return
          }

          if (message.type === 'error') {
            cleanup()
            reject(new Error(message.message || 'Image export worker failed'))
            return
          }

          cleanup()
          resolve(new Blob([message.buffer], { type: message.mimeType }))
        }

        worker.onerror = (event) => {
          cleanup()
          reject(new Error(event.message || 'Image export worker crashed'))
        }

        worker.postMessage(payload)
      })

      const extension = getExtensionForFormat(payload.format)
      triggerBlobDownload(result, `${filename}.${extension}`)
      return true
    } catch (error) {
      console.warn(`Worker export failed for ${payload.format}; using fallback`, error)
      return false
    }
  }

  function triggerBlobDownload(blob: Blob, downloadName: string) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.download = downloadName
    link.href = url
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1500)
  }

  function triggerDataUrlDownload(dataUrl: string, downloadName: string) {
    const link = document.createElement('a')
    link.download = downloadName
    link.href = dataUrl
    link.click()
  }

  async function exportViaWorker(
    format: WorkerExportFormat,
    filename: string,
    onProgress?: ImageExportProgressCallback,
  ): Promise<boolean> {
    if (!canUseExportWorker()) return false

    const payload: WorkerExportPayload = {
      requestId: createRequestId(),
      format,
      filename,
    }

    if (format === 'drawio') {
      payload.diagramState = cloneDiagramState(diagramStore.diagramState)
      if (format === 'drawio') payload.isDark = detectIsDark()
      return runWorkerImageExport(payload, filename, onProgress)
    }

    if (format === 'svg') {
      const snapshot = await captureExactSvgSnapshot()
      if (!snapshot) return false
      payload.svgMarkup = snapshot.svgMarkup
      payload.width = snapshot.width
      payload.height = snapshot.height
      return runWorkerImageExport(payload, filename, onProgress)
    }

    return false
  }

  async function exportToPng(filename = 'azure-vnet-diagram', onProgress?: ImageExportProgressCallback): Promise<boolean> {
    try {
      onProgress?.('preparing', 5)
      const snapshot = await captureExactSvgSnapshot()
      if (!snapshot) return false
      onProgress?.('rasterizing', 50)
      const pngBlob = await rasterizeSnapshotToPngBlob(snapshot, 2)
      triggerBlobDownload(pngBlob, `${filename}.png`)
      onProgress?.('done', 100)
      return true
    } catch (err) {
      console.error('PNG export failed:', err)
      return false
    }
  }

  async function exportToSvgFile(filename = 'azure-vnet-diagram', onProgress?: ImageExportProgressCallback): Promise<boolean> {
    try {
      onProgress?.('preparing', 5)
      const workerSucceeded = await exportViaWorker('svg', filename, onProgress)
      if (workerSucceeded) {
        return true
      }

      const snapshot = await captureExactSvgSnapshot()
      if (!snapshot) return false
      const blob = new Blob([snapshot.svgMarkup], { type: 'image/svg+xml;charset=utf-8' })
      triggerBlobDownload(blob, `${filename}.svg`)
      onProgress?.('done', 100)
      return true
    } catch (err) {
      console.error('SVG export failed:', err)
      return false
    }
  }

  async function exportToPdf(filename = 'azure-vnet-diagram', onProgress?: ImageExportProgressCallback): Promise<boolean> {
    try {
      onProgress?.('preparing', 5)
      const snapshot = await captureExactSvgSnapshot()
      if (!snapshot) return false
      onProgress?.('rasterizing', 40)
      const pngBlob = await rasterizeSnapshotToPngBlob(snapshot, 2)
      onProgress?.('finalizing', 80)
      const pngBytes = new Uint8Array(await pngBlob.arrayBuffer())
      const pdfBytes = await buildPdfFromPngBytes(pngBytes)
      const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' })
      triggerBlobDownload(pdfBlob, `${filename}.pdf`)
      onProgress?.('done', 100)
      return true
    } catch (err) {
      console.error('PDF export failed:', err)
      return false
    }
  }

  async function exportToDrawioFile(filename = 'azure-vnet-diagram'): Promise<boolean> {
    const workerSucceeded = await exportViaWorker('drawio', filename)
    if (workerSucceeded) return true

    if (canUseExportWorker()) return false

    const { serializeDiagramToDrawio } = await import('~/lib/export/formats/drawio')
    const xml = serializeDiagramToDrawio(diagramStore.diagramState, detectIsDark())
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' })
    triggerBlobDownload(blob, `${filename}.drawio`)
    return true
  }

  async function captureThumbnail(): Promise<string | null> {
    try {
      return await renderDiagramToPngDataUrlInMainThread(diagramStore.diagramState, {
        targetWidth: 320,
        targetHeight: 200,
        backgroundColor: getCanvasBackgroundColor(),
      })
    } catch {
      return null
    }
  }

  return {
    exportToPng,
    exportToSvgFile,
    exportToPdf,
    exportToDrawioFile,
    captureThumbnail,
  }
}
