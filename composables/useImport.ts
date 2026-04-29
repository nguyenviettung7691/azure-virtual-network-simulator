import { importFromDrawio } from '~/lib/drawio'
import { importFromVsdx } from '~/lib/vsdx'

export const useImport = () => {
  const diagramStore = useDiagramStore()

  async function importFromFile(file: File): Promise<boolean> {
    try {
      if (file.name.endsWith('.drawio') || file.name.endsWith('.xml')) {
        const text = await file.text()
        const state = importFromDrawio(text)
        diagramStore.loadDiagram(state)
        return true
      } else if (file.name.endsWith('.vsdx')) {
        const state = await importFromVsdx(file)
        diagramStore.loadDiagram(state)
        return true
      } else {
        console.error('Unsupported file format:', file.name)
        return false
      }
    } catch (err) {
      console.error('Import failed:', err)
      return false
    }
  }

  function triggerFileUpload(): Promise<File | null> {
    return new Promise(resolve => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.drawio,.xml,.vsdx'
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0] || null
        resolve(file)
      }
      input.oncancel = () => resolve(null)
      input.click()
    })
  }

  async function importFromFileDialog(): Promise<boolean> {
    const file = await triggerFileUpload()
    if (!file) return false
    return importFromFile(file)
  }

  return {
    importFromFile,
    importFromFileDialog,
  }
}
