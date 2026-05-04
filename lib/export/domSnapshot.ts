import { finalizeSvgMarkup } from '~/lib/export/svg'

export interface SvgSnapshot {
  svgMarkup: string
  width: number
  height: number
}

export async function serializeDomElementToSvg(
  element: HTMLElement,
  options?: {
    backgroundColor?: string
  },
): Promise<SvgSnapshot> {
  const rect = element.getBoundingClientRect()
  const width = Math.max(1, Math.ceil(rect.width))
  const height = Math.max(1, Math.ceil(rect.height))
  const nativeEdgeOverlayMarkup = extractNativeEdgeOverlayMarkup(element)

  const clonedElement = element.cloneNode(true) as HTMLElement

  inlineComputedStyles(element, clonedElement)
  removeForeignObjectEdgeLayers(clonedElement)

  const wrapper = document.createElement('div')
  wrapper.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml')
  wrapper.style.width = `${width}px`
  wrapper.style.height = `${height}px`
  wrapper.style.boxSizing = 'border-box'
  wrapper.appendChild(clonedElement)

  const background = escapeXmlAttribute(options?.backgroundColor || 'transparent')
  const svgMarkup = finalizeSvgMarkup(
    [
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
      `<rect width="${width}" height="${height}" fill="${background}" />`,
      nativeEdgeOverlayMarkup,
      `<foreignObject x="0" y="0" width="${width}" height="${height}">`,
      wrapper.outerHTML,
      '</foreignObject>',
      '</svg>',
    ].join(''),
    width,
    height,
  )

  return {
    svgMarkup,
    width,
    height,
  }
}

function inlineComputedStyles(sourceRoot: HTMLElement, targetRoot: HTMLElement) {
  const sourceElements = [sourceRoot, ...Array.from(sourceRoot.querySelectorAll('*'))]
  const targetElements = [targetRoot, ...Array.from(targetRoot.querySelectorAll('*'))]
  const maxLength = Math.min(sourceElements.length, targetElements.length)

  for (let index = 0; index < maxLength; index += 1) {
    const sourceElement = sourceElements[index] as HTMLElement | SVGElement
    const targetElement = targetElements[index] as HTMLElement | SVGElement
    const computedStyle = window.getComputedStyle(sourceElement)
    applySnapshotStyle(sourceElement, targetElement, computedStyle)
    copyFormState(sourceElement, targetElement)
    copyMediaState(sourceElement, targetElement)

    if (sourceElement instanceof SVGElement && targetElement instanceof SVGElement) {
      copySvgAttributes(sourceElement, targetElement)
    }
  }
}

function inlineComputedStylesForSubtree(sourceRoot: Element, targetRoot: Element) {
  const sourceElements = [sourceRoot, ...Array.from(sourceRoot.querySelectorAll('*'))]
  const targetElements = [targetRoot, ...Array.from(targetRoot.querySelectorAll('*'))]
  const maxLength = Math.min(sourceElements.length, targetElements.length)

  for (let index = 0; index < maxLength; index += 1) {
    const sourceElement = sourceElements[index] as HTMLElement | SVGElement
    const targetElement = targetElements[index] as HTMLElement | SVGElement
    const computedStyle = window.getComputedStyle(sourceElement)
    applySnapshotStyle(sourceElement, targetElement, computedStyle)

    if (sourceElement instanceof SVGElement && targetElement instanceof SVGElement) {
      copySvgAttributes(sourceElement, targetElement)
    }
  }
}

function copyMediaState(sourceElement: Element, targetElement: Element) {
  if (sourceElement instanceof HTMLImageElement && targetElement instanceof HTMLImageElement) {
    const resolvedSource = sourceElement.currentSrc || sourceElement.src
    if (resolvedSource && isAllowedSnapshotUrl(resolvedSource)) {
      targetElement.src = resolvedSource
      targetElement.setAttribute('src', resolvedSource)
    } else {
      targetElement.removeAttribute('src')
    }
  }
}

function applySnapshotStyle(
  source: HTMLElement | SVGElement,
  target: HTMLElement | SVGElement,
  style: CSSStyleDeclaration,
) {
  const fallbackSvgStyle = target instanceof SVGElement
    ? {
      stroke: target.style.stroke || target.getAttribute('stroke') || '',
      fill: target.style.fill || target.getAttribute('fill') || '',
      strokeWidth: target.style.strokeWidth || target.getAttribute('stroke-width') || '',
      strokeDasharray: target.style.strokeDasharray || target.getAttribute('stroke-dasharray') || '',
      strokeLinecap: target.style.strokeLinecap || target.getAttribute('stroke-linecap') || '',
      strokeLinejoin: target.style.strokeLinejoin || target.getAttribute('stroke-linejoin') || '',
      opacity: target.style.opacity || target.getAttribute('opacity') || '',
    }
    : null

  target.removeAttribute('style')
  for (const property of SNAPSHOT_STYLE_PROPERTIES) {
    const value = style.getPropertyValue(property)
    if (!value) continue
    const normalized = sanitizeStyleValue(property, value.trim())
    if (!normalized) continue
    const priority = style.getPropertyPriority(property)
    target.style.setProperty(property, normalized, priority)
  }

  if (fallbackSvgStyle && target instanceof SVGElement) {
    const resolvedStroke = resolveConcreteSvgPaintValue(source, 'stroke')
    const resolvedFill = resolveConcreteSvgPaintValue(source, 'fill')

    if (resolvedStroke && (!target.style.stroke || target.style.stroke.includes('var('))) {
      target.style.setProperty('stroke', resolvedStroke)
    }
    if (resolvedFill && (!target.style.fill || target.style.fill.includes('var('))) {
      target.style.setProperty('fill', resolvedFill)
    }

    if (!target.style.stroke && fallbackSvgStyle.stroke) {
      target.style.setProperty('stroke', resolveCssVariables(fallbackSvgStyle.stroke, source))
    }
    if (!target.style.fill && fallbackSvgStyle.fill) {
      target.style.setProperty('fill', resolveCssVariables(fallbackSvgStyle.fill, source))
    }
    if (!target.style.strokeWidth && fallbackSvgStyle.strokeWidth) {
      target.style.setProperty('stroke-width', fallbackSvgStyle.strokeWidth)
    }
    if (!target.style.strokeDasharray && fallbackSvgStyle.strokeDasharray) {
      target.style.setProperty('stroke-dasharray', fallbackSvgStyle.strokeDasharray)
    }
    if (!target.style.strokeLinecap && fallbackSvgStyle.strokeLinecap) {
      target.style.setProperty('stroke-linecap', fallbackSvgStyle.strokeLinecap)
    }
    if (!target.style.strokeLinejoin && fallbackSvgStyle.strokeLinejoin) {
      target.style.setProperty('stroke-linejoin', fallbackSvgStyle.strokeLinejoin)
    }
    if (!target.style.opacity && fallbackSvgStyle.opacity) {
      target.style.setProperty('opacity', fallbackSvgStyle.opacity)
    }
  }
}

function resolveConcreteSvgPaintValue(source: HTMLElement | SVGElement, property: 'stroke' | 'fill'): string {
  const computed = window.getComputedStyle(source)
  const computedValue = resolveCssVariables(computed.getPropertyValue(property), source)
  if (computedValue && computedValue !== 'none') {
    return computedValue
  }

  const inlineValue = source.style.getPropertyValue(property)
  const resolvedInline = resolveCssVariables(inlineValue, source)
  if (resolvedInline && resolvedInline !== 'none') {
    return resolvedInline
  }

  if (source instanceof SVGElement) {
    const attributeValue = source.getAttribute(property)
    const resolvedAttribute = resolveCssVariables(attributeValue || '', source)
    if (resolvedAttribute && resolvedAttribute !== 'none') {
      return resolvedAttribute
    }
  }

  // Keep SVG strokes visible in exported files even when computed CSS variables
  // cannot be resolved by downstream viewers.
  if (property === 'stroke') {
    return '#323130'
  }

  return ''
}

function resolveCssVariables(value: string, source: HTMLElement | SVGElement): string {
  let resolved = value.trim()
  if (!resolved || !resolved.includes('var(')) return resolved

  for (let index = 0; index < 8 && resolved.includes('var('); index += 1) {
    const next = replaceFirstCssVar(resolved, source)
    if (next === resolved) break
    resolved = next.trim()
  }

  return resolved
}

function replaceFirstCssVar(value: string, source: HTMLElement | SVGElement): string {
  const start = value.indexOf('var(')
  if (start === -1) return value

  const open = start + 3
  let depth = 0
  let end = -1

  for (let index = open; index < value.length; index += 1) {
    const char = value[index]
    if (char === '(') depth += 1
    if (char === ')') {
      depth -= 1
      if (depth === 0) {
        end = index
        break
      }
    }
  }

  if (end === -1) return value

  const args = value.slice(open + 1, end)
  const [variableName, fallback] = splitCssVarArgs(args)
  if (!variableName) return value

  const computed = window.getComputedStyle(source)
  const rootComputed = window.getComputedStyle(document.documentElement)
  const fromSource = computed.getPropertyValue(variableName).trim()
  const fromRoot = rootComputed.getPropertyValue(variableName).trim()
  const replacement = fromSource || fromRoot || (fallback ? fallback.trim() : '')

  return `${value.slice(0, start)}${replacement}${value.slice(end + 1)}`
}

function splitCssVarArgs(args: string): [string, string] {
  let depth = 0
  for (let index = 0; index < args.length; index += 1) {
    const char = args[index]
    if (char === '(') depth += 1
    if (char === ')') depth -= 1
    if (char === ',' && depth === 0) {
      const variableName = args.slice(0, index).trim()
      const fallback = args.slice(index + 1).trim()
      return [variableName, fallback]
    }
  }

  return [args.trim(), '']
}

function sanitizeStyleValue(property: string, value: string): string {
  if (!value) return ''

  if (property === 'background-image' || property === 'background') {
    const urls = extractCssUrls(value)
    for (const url of urls) {
      if (!isAllowedSnapshotUrl(url)) {
        return ''
      }
    }
  }

  return value
}

function extractCssUrls(value: string): string[] {
  const urls: string[] = []
  const pattern = /url\(([^)]+)\)/gi
  let match = pattern.exec(value)

  while (match) {
    const raw = match[1].trim().replace(/^['"]|['"]$/g, '')
    if (raw) {
      urls.push(raw)
    }
    match = pattern.exec(value)
  }

  return urls
}

function isAllowedSnapshotUrl(value: string): boolean {
  if (!value) return false
  if (value.startsWith('data:') || value.startsWith('blob:')) return true

  try {
    const parsed = new URL(value, window.location.href)
    return parsed.origin === window.location.origin
  } catch {
    return false
  }
}

const SNAPSHOT_STYLE_PROPERTIES = [
  'display',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'z-index',
  'box-sizing',
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'border',
  'border-top',
  'border-right',
  'border-bottom',
  'border-left',
  'border-radius',
  'background',
  'background-color',
  'background-image',
  'background-size',
  'background-position',
  'background-repeat',
  'opacity',
  'visibility',
  'overflow',
  'overflow-x',
  'overflow-y',
  'color',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'line-height',
  'letter-spacing',
  'text-align',
  'text-transform',
  'text-decoration',
  'white-space',
  'word-break',
  'word-wrap',
  'align-items',
  'justify-content',
  'align-self',
  'flex',
  'flex-direction',
  'flex-grow',
  'flex-shrink',
  'flex-basis',
  'gap',
  'grid-template-columns',
  'grid-template-rows',
  'grid-column',
  'grid-row',
  'transform',
  'transform-origin',
  'filter',
  'backdrop-filter',
  'object-fit',
  'pointer-events',
  'fill',
  'stroke',
  'stroke-width',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-linecap',
  'stroke-linejoin',
  'vector-effect',
]

function copyFormState(sourceElement: Element, targetElement: Element) {
  if (sourceElement instanceof HTMLInputElement && targetElement instanceof HTMLInputElement) {
    targetElement.setAttribute('value', sourceElement.value)
    targetElement.checked = sourceElement.checked
    if (sourceElement.checked) {
      targetElement.setAttribute('checked', 'checked')
    } else {
      targetElement.removeAttribute('checked')
    }
    return
  }

  if (sourceElement instanceof HTMLTextAreaElement && targetElement instanceof HTMLTextAreaElement) {
    targetElement.textContent = sourceElement.value
    return
  }

  if (sourceElement instanceof HTMLSelectElement && targetElement instanceof HTMLSelectElement) {
    targetElement.value = sourceElement.value
    const sourceOptions = Array.from(sourceElement.options)
    const targetOptions = Array.from(targetElement.options)
    for (let index = 0; index < Math.min(sourceOptions.length, targetOptions.length); index += 1) {
      targetOptions[index].selected = sourceOptions[index].selected
    }
  }
}

function copySvgAttributes(sourceElement: SVGElement, targetElement: SVGElement) {
  const requiredAttributes = [
    'viewBox',
    'xmlns',
    'xmlns:xlink',
    'preserveAspectRatio',
    'marker-start',
    'marker-mid',
    'marker-end',
    'href',
    'xlink:href',
    'clip-path',
    'mask',
    'filter',
  ]
  for (const attributeName of requiredAttributes) {
    const value = sourceElement.getAttribute(attributeName)
    if (value) {
      targetElement.setAttribute(attributeName, value)
    }
  }
}

function extractNativeEdgeOverlayMarkup(viewportElement: HTMLElement): string {
  const transformPane = viewportElement.querySelector('.vue-flow__transformationpane') as HTMLElement | null
  if (!transformPane) return ''

  const edgeGroups = Array.from(transformPane.querySelectorAll('g.vue-flow__edge')) as SVGGElement[]
  if (!edgeGroups.length) return ''

  const edgeMarkup = edgeGroups
    .map((sourceEdgeGroup) => {
      const clonedEdgeGroup = sourceEdgeGroup.cloneNode(true) as SVGGElement
      inlineComputedStylesForSubtree(sourceEdgeGroup, clonedEdgeGroup)
      return clonedEdgeGroup.outerHTML
    })
    .join('')

  const normalizedTransform = normalizeSvgTransform(window.getComputedStyle(transformPane).transform)
  const transformAttr = normalizedTransform ? ` transform="${escapeXmlAttribute(normalizedTransform)}"` : ''

  return `<g class="export-native-edge-overlay"${transformAttr}>${edgeMarkup}</g>`
}

function removeForeignObjectEdgeLayers(viewportClone: HTMLElement) {
  const selectors = ['.vue-flow__edges', '.vue-flow__connectionline', '.vue-flow__connection']
  for (const selector of selectors) {
    for (const element of Array.from(viewportClone.querySelectorAll(selector))) {
      element.remove()
    }
  }
}

function normalizeSvgTransform(value: string): string {
  const transform = value.trim()
  if (!transform || transform === 'none') return ''

  try {
    const matrix = new DOMMatrixReadOnly(transform)
    return `matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})`
  } catch {
    // Fallback: strip CSS units from translate() so the transform remains parseable in SVG.
    return transform.replace(/(-?\d*\.?\d+)px/g, '$1')
  }
}


function escapeXmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
