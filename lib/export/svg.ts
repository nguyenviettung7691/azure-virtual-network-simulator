export function finalizeSvgMarkup(svgMarkup: string, width?: number, height?: number): string {
  let finalized = svgMarkup.trim()
  if (!finalized.startsWith('<?xml')) {
    finalized = `<?xml version="1.0" encoding="UTF-8"?>\n${finalized}`
  }

  if (!/<svg\b[^>]*xmlns=/.test(finalized)) {
    finalized = finalized.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"')
  }

  if (typeof width === 'number' && width > 0 && !/<svg\b[^>]*width=/.test(finalized)) {
    finalized = finalized.replace('<svg', `<svg width="${width}"`)
  }

  if (typeof height === 'number' && height > 0 && !/<svg\b[^>]*height=/.test(finalized)) {
    finalized = finalized.replace('<svg', `<svg height="${height}"`)
  }

  if (typeof width === 'number' && width > 0 && typeof height === 'number' && height > 0 && !/<svg\b[^>]*viewBox=/.test(finalized)) {
    finalized = finalized.replace('<svg', `<svg viewBox="0 0 ${width} ${height}"`)
  }

  return finalized
}