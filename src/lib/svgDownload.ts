import { downloadBlob } from './utils'

// Download helpers for the in-browser SVG figures (PRISMA flow diagram, risk-of-bias plots).
// Everything is generated client-side from the rendered <svg>: no server round trip and no
// third-party library.

/**
 * Serialises an on-screen <svg> to a standalone SVG document. The clone gets explicit
 * width/height from its viewBox (an inline figure is usually sized by CSS, which a standalone file
 * does not have) and the SVG namespace declarations a file needs.
 */
export function serializeSvg(svg: SVGSVGElement): { markup: string; width: number; height: number } {
  const clone = svg.cloneNode(true) as SVGSVGElement
  const vb = svg.viewBox?.baseVal
  const width = vb && vb.width ? vb.width : svg.getBoundingClientRect().width || 800
  const height = vb && vb.height ? vb.height : svg.getBoundingClientRect().height || 600
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))
  clone.removeAttribute('class')
  clone.removeAttribute('style')
  const markup = `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`
  return { markup, width, height }
}

export function downloadSvg(svg: SVGSVGElement, filename: string): void {
  const { markup } = serializeSvg(svg)
  downloadBlob(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }), filename)
}

/**
 * Rasterises the SVG onto a canvas at `scale`x its viewBox size (2x by default, so the PNG stays
 * sharp in a manuscript) over a solid background, then downloads it as PNG. A data: URL is used
 * rather than a blob: URL so the canvas is never tainted.
 */
export async function downloadSvgAsPng(
  svg: SVGSVGElement,
  filename: string,
  scale = 2,
  background = '#ffffff',
): Promise<void> {
  const { markup, width, height } = serializeSvg(svg)
  const img = new Image()
  img.decoding = 'async'
  const loaded = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Could not render the figure as an image.'))
  })
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
  await loaded

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available in this browser.')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Could not encode the figure as PNG.')
  downloadBlob(blob, filename)
}
