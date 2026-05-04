import type { WorkerExportPayload } from '~/lib/export/types'
import { buildPdfFromPngBytes } from '~/lib/export/pdf'
import { rasterizeSvgToPngBlob, readImageDimensions } from '~/lib/export/worker/raster'
import { renderDiagramToPngBlobInWorker } from '~/lib/export/diagramRaster'

export async function exportPdfBuffer(payload: WorkerExportPayload): Promise<{ mimeType: string; buffer: ArrayBuffer }> {
  let pngBlob: Blob

  if (payload.diagramState) {
    pngBlob = await renderDiagramToPngBlobInWorker(payload.diagramState, {
      scale: payload.scale,
      backgroundColor: payload.backgroundColor,
    })
  } else if (payload.svgMarkup) {
    pngBlob = await rasterizeSvgToPngBlob(payload.svgMarkup, payload.width, payload.height, payload.scale)
  } else {
    throw new Error('Missing diagram state for PDF export')
  }

  await readImageDimensions(pngBlob)
  const pngBytes = new Uint8Array(await pngBlob.arrayBuffer())
  const pdfBytes = await buildPdfFromPngBytes(pngBytes)
  return {
    mimeType: 'application/pdf',
    buffer: pdfBytes.buffer,
  }
}
