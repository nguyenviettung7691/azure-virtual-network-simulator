/// <reference lib="webworker" />

import type {
  WorkerExportFormat,
  WorkerExportPayload,
  WorkerExportStage,
  WorkerExportResponseMessage,
} from '~/lib/export/types'

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope

ctx.onmessage = async (event: MessageEvent<WorkerExportPayload>) => {
  const payload = event.data
  const { requestId, format } = payload

  try {
    postProgress(requestId, 'preparing', 8)

    if (format === 'drawio') {
      postProgress(requestId, 'serializing', 45)
      const { exportDrawioBuffer } = await import('./worker/exportDrawio')
      const { mimeType, buffer } = exportDrawioBuffer(payload)
      postProgress(requestId, 'encoding', 90)
      postSuccess(requestId, format, mimeType, buffer)
      postProgress(requestId, 'done', 100)
      return
    }

    if (format === 'svg') {
      const { exportSvgBuffer } = await import('./worker/exportSvg')
      postProgress(requestId, 'encoding', 90)
      const { mimeType, buffer } = exportSvgBuffer(payload)
      postSuccess(requestId, format, mimeType, buffer)
      postProgress(requestId, 'done', 100)
      return
    }

    postProgress(requestId, 'rasterizing', 45)
    if (format === 'png') {
      const { exportPngBuffer } = await import('./worker/exportPng')
      postProgress(requestId, 'encoding', 92)
      const { mimeType, buffer } = await exportPngBuffer(payload)
      postSuccess(requestId, format, mimeType, buffer)
      postProgress(requestId, 'done', 100)
      return
    }

    postProgress(requestId, 'finalizing', 85)
    const { exportPdfBuffer } = await import('./worker/exportPdf')
    const { mimeType, buffer } = await exportPdfBuffer(payload)
    postSuccess(requestId, format, mimeType, buffer)
    postProgress(requestId, 'done', 100)
  } catch (error: any) {
    const message = error?.message || 'Worker image export failed'
    postMessage({
      type: 'error',
      requestId,
      message,
    } satisfies WorkerExportResponseMessage)
  }
}

function postProgress(
  requestId: string,
  stage: WorkerExportStage,
  percent: number,
) {
  postMessage({
    type: 'progress',
    requestId,
    stage,
    percent,
  } satisfies WorkerExportResponseMessage)
}

function postSuccess(
  requestId: string,
  format: WorkerExportFormat,
  mimeType: string,
  buffer: ArrayBuffer,
) {
  postMessage(
    {
      type: 'success',
      requestId,
      format,
      mimeType,
      buffer,
    } satisfies WorkerExportResponseMessage,
    [buffer],
  )
}

function postMessage(message: WorkerExportResponseMessage, transfer?: Transferable[]) {
  if (transfer && transfer.length > 0) {
    ctx.postMessage(message, transfer)
    return
  }
  ctx.postMessage(message)
}
