import { finalizeSvgMarkup } from '~/lib/export/svg'
import type { WorkerExportPayload } from '~/lib/export/types'

export function exportSvgBuffer(payload: WorkerExportPayload): { mimeType: string; buffer: ArrayBuffer } {
  if (!payload.svgMarkup) {
    throw new Error('Missing SVG markup for SVG export')
  }

  const svgBuffer = new TextEncoder().encode(finalizeSvgMarkup(payload.svgMarkup, payload.width, payload.height)).buffer
  return {
    mimeType: 'image/svg+xml;charset=utf-8',
    buffer: svgBuffer,
  }
}