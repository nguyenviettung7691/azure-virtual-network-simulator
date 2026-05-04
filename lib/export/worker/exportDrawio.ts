import type { WorkerExportPayload } from '~/lib/export/types'
import { serializeDiagramToDrawio } from '~/lib/export/formats/drawio'

export function exportDrawioBuffer(payload: WorkerExportPayload): { mimeType: string; buffer: ArrayBuffer } {
  if (!payload.diagramState) {
    throw new Error('Missing diagram state for draw.io export')
  }

  const xml = serializeDiagramToDrawio(payload.diagramState, payload.isDark ?? true)
  return {
    mimeType: 'application/xml;charset=utf-8',
    buffer: new TextEncoder().encode(xml).buffer,
  }
}