import type { DiagramState } from '~/types/diagram'

export type WorkerExportFormat = 'drawio' | 'png' | 'svg' | 'pdf'

export type WorkerExportStage =
  | 'queued'
  | 'preparing'
  | 'serializing'
  | 'rendering-svg'
  | 'rasterizing'
  | 'encoding'
  | 'finalizing'
  | 'done'

export interface WorkerExportPayload {
  requestId: string
  format: WorkerExportFormat
  filename: string
  diagramState?: DiagramState
  backgroundColor?: string
  svgMarkup?: string
  width?: number
  height?: number
  scale?: number
  isDark?: boolean
}

export interface WorkerExportProgressMessage {
  type: 'progress'
  requestId: string
  stage: WorkerExportStage
  percent: number
}

export interface WorkerExportSuccessMessage {
  type: 'success'
  requestId: string
  format: WorkerExportFormat
  mimeType: string
  buffer: ArrayBuffer
}

export interface WorkerExportErrorMessage {
  type: 'error'
  requestId: string
  message: string
}

export type WorkerExportResponseMessage =
  | WorkerExportProgressMessage
  | WorkerExportSuccessMessage
  | WorkerExportErrorMessage
