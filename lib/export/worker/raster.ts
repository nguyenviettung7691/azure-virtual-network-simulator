import { finalizeSvgMarkup } from '~/lib/export/svg'

export async function rasterizeSvgToPngBlob(
  svgMarkup: string,
  width?: number,
  height?: number,
  scale = 1,
): Promise<Blob> {
  if (typeof OffscreenCanvas === 'undefined') {
    throw new Error('OffscreenCanvas is unavailable for worker raster export')
  }

  const safeWidth = Math.max(1, Math.ceil(width || 1))
  const safeHeight = Math.max(1, Math.ceil(height || 1))
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1
  const svgBlob = new Blob([finalizeSvgMarkup(svgMarkup, safeWidth, safeHeight)], { type: 'image/svg+xml;charset=utf-8' })
  const bitmap = await createImageBitmap(svgBlob)

  try {
    const canvas = new OffscreenCanvas(
      Math.max(1, Math.ceil(safeWidth * safeScale)),
      Math.max(1, Math.ceil(safeHeight * safeScale)),
    )
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Unable to acquire 2D context for worker raster export')
    }

    context.scale(safeScale, safeScale)
    context.drawImage(bitmap, 0, 0, safeWidth, safeHeight)
    return canvas.convertToBlob({ type: 'image/png' })
  } finally {
    bitmap.close()
  }
}

export async function readImageDimensions(imageBlob: Blob): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(imageBlob)
  const dimensions = {
    width: Math.max(1, bitmap.width),
    height: Math.max(1, bitmap.height),
  }
  bitmap.close()
  return dimensions
}