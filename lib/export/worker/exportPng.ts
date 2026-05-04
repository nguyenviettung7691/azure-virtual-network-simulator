import type { WorkerExportPayload } from '~/lib/export/types'
import { rasterizeSvgToPngBlob } from '~/lib/export/worker/raster'
import { renderDiagramToPngBlobInWorker } from '~/lib/export/diagramRaster'

export async function exportPngBuffer(payload: WorkerExportPayload): Promise<{ mimeType: string; buffer: ArrayBuffer }> {
  let pngBlob: Blob

  if (payload.diagramState) {
    pngBlob = await renderDiagramToPngBlobInWorker(payload.diagramState, {
      scale: payload.scale,
      backgroundColor: payload.backgroundColor,
    })
  } else if (payload.svgMarkup) {
    pngBlob = await rasterizeSvgToPngBlob(payload.svgMarkup, payload.width, payload.height, payload.scale)
  } else {
    throw new Error('Missing diagram state for PNG export')
  }

  return {
    mimeType: 'image/png',
    buffer: await pngBlob.arrayBuffer(),
  }
}