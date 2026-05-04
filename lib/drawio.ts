import type { DiagramState } from '~/types/diagram'

export async function exportToDrawio(state: DiagramState): Promise<string> {
  const { serializeDiagramToDrawio } = await import('~/lib/export/formats/drawio')
  return serializeDiagramToDrawio(state)
}

export async function importFromDrawio(xml: string): Promise<DiagramState> {
  const { importFromDrawio: importNativeDrawio } = await import('~/lib/export/formats/drawio')
  return importNativeDrawio(xml)
}
