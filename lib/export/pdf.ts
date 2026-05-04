import { PDFDocument } from 'pdf-lib'

export async function buildPdfFromPngBytes(pngBytes: Uint8Array): Promise<Uint8Array> {
  const pdfDocument = await PDFDocument.create()
  const pngImage = await pdfDocument.embedPng(pngBytes)
  const page = pdfDocument.addPage([pngImage.width, pngImage.height])
  page.drawImage(pngImage, {
    x: 0,
    y: 0,
    width: pngImage.width,
    height: pngImage.height,
  })
  return pdfDocument.save()
}