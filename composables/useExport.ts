import { toPng, toSvg } from 'html-to-image'
import { jsPDF } from 'jspdf'
import { exportToDrawio } from '~/lib/drawio'
import { exportToVsdx } from '~/lib/vsdx'

export const useExport = () => {
  const diagramStore = useDiagramStore()

  async function getCanvasElement(): Promise<HTMLElement | null> {
    if (typeof document === 'undefined') return null
    return document.querySelector('.vue-flow__viewport') as HTMLElement
  }

  async function exportToPng(filename = 'azure-vnet-diagram'): Promise<string | null> {
    const el = await getCanvasElement()
    if (!el) return null
    try {
      const dataUrl = await toPng(el, { backgroundColor: '#ffffff', quality: 1, pixelRatio: 2 })
      const link = document.createElement('a')
      link.download = `${filename}.png`
      link.href = dataUrl
      link.click()
      return dataUrl
    } catch (err) {
      console.error('PNG export failed:', err)
      return null
    }
  }

  async function exportToSvgFile(filename = 'azure-vnet-diagram'): Promise<void> {
    const el = await getCanvasElement()
    if (!el) return
    try {
      const dataUrl = await toSvg(el, { backgroundColor: '#ffffff' })
      const link = document.createElement('a')
      link.download = `${filename}.svg`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('SVG export failed:', err)
    }
  }

  async function exportToPdf(filename = 'azure-vnet-diagram'): Promise<void> {
    const el = await getCanvasElement()
    if (!el) return
    try {
      const dataUrl = await toPng(el, { backgroundColor: '#ffffff', quality: 1, pixelRatio: 2 })
      const img = new Image()
      img.src = dataUrl
      await new Promise<void>(resolve => { img.onload = () => resolve() })
      const pdf = new jsPDF({
        orientation: img.width > img.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [img.width, img.height],
      })
      pdf.addImage(dataUrl, 'PNG', 0, 0, img.width, img.height)
      pdf.save(`${filename}.pdf`)
    } catch (err) {
      console.error('PDF export failed:', err)
    }
  }

  async function exportToDrawioFile(filename = 'azure-vnet-diagram'): Promise<void> {
    const state = diagramStore.diagramState
    const xml = exportToDrawio(state)
    const blob = new Blob([xml], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.download = `${filename}.drawio`
    link.href = url
    link.click()
    URL.revokeObjectURL(url)
  }

  async function exportToVsdxFile(filename = 'azure-vnet-diagram'): Promise<void> {
    const state = diagramStore.diagramState
    const blob = await exportToVsdx(state)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.download = `${filename}.vsdx`
    link.href = url
    link.click()
    URL.revokeObjectURL(url)
  }

  async function captureThumbnail(): Promise<string | null> {
    const el = await getCanvasElement()
    if (!el) return null
    try {
      return await toPng(el, {
        backgroundColor: '#ffffff',
        quality: 0.8,
        pixelRatio: 0.5,
        width: 320,
        height: 200,
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
    exportToVsdxFile,
    captureThumbnail,
  }
}
