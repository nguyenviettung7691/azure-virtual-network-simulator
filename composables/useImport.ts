import { importFromDrawio } from '~/lib/drawio'

export type ImportResult =
  | { success: true; format: 'drawio' | 'xml' }
  | { success: false; reason: 'unsupported-format' | 'parse-failed' }

export const useImport = () => {
  const diagramStore = useDiagramStore()

  async function importFromFile(file: File): Promise<ImportResult> {
    try {
      if (file.name.endsWith('.drawio') || file.name.endsWith('.xml')) {
        const text = await file.text()
        const state = await importFromDrawio(text)
        diagramStore.loadDiagram(state)
        return {
          success: true,
          format: file.name.endsWith('.drawio') ? 'drawio' : 'xml',
        }
      } else {
        console.error('Unsupported file format:', file.name)
        return { success: false, reason: 'unsupported-format' }
      }
    } catch (err) {
      console.error('Import failed:', err)
      return { success: false, reason: 'parse-failed' }
    }
  }

  function triggerFileUpload(): Promise<File | null> {
    return new Promise(resolve => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.drawio'
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0] || null
        resolve(file)
      }
      input.oncancel = () => resolve(null)
      input.click()
    })
  }

  async function importFromFileDialog(): Promise<ImportResult> {
    const file = await triggerFileUpload()
    if (!file) return { success: false, reason: 'unsupported-format' }
    return importFromFile(file)
  }

  return {
    importFromFile,
    importFromFileDialog,
  }
}
