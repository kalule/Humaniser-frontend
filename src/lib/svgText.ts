// Text fitting for hand-built SVG figures (PRISMA flow, risk-of-bias plots).
//
// SVG <text> does not wrap, and the figures must also serialise to standalone SVG/PNG files, so the
// layout cannot depend on measuring rendered DOM text (jsdom has none, and a font that differs at
// export time would move every line). Instead we estimate width from a deliberately generous
// average glyph width: a slight over-estimate only costs a little white space, while an
// under-estimate lets text run outside its box.

/** Font stack written into every exported SVG so the file renders the same outside the app. */
export const SVG_FONT_FAMILY = 'Arial, Helvetica, sans-serif'

/** The smallest font size any figure may use, in SVG user units. */
export const MIN_SVG_FONT_SIZE = 10

// Average advance width as a fraction of the font size. Arial lowercase averages ~0.5em; digits and
// capitals are wider, so 0.56 / 0.6 (bold) keeps mixed text inside its estimate.
const AVG_GLYPH = 0.56
const AVG_GLYPH_BOLD = 0.6

export function estimateTextWidth(text: string, fontSize: number, bold = false): number {
  return text.length * fontSize * (bold ? AVG_GLYPH_BOLD : AVG_GLYPH)
}

function maxChars(maxWidth: number, fontSize: number, bold: boolean): number {
  return Math.max(1, Math.floor(maxWidth / (fontSize * (bold ? AVG_GLYPH_BOLD : AVG_GLYPH))))
}

/**
 * Greedy word wrap into lines that each fit `maxWidth`. A single word longer than a line is hard
 * broken rather than allowed to overflow.
 */
export function wrapText(text: string, maxWidth: number, fontSize: number, bold = false): string[] {
  const limit = maxChars(maxWidth, fontSize, bold)
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']

  const lines: string[] = []
  let current = ''
  for (let word of words) {
    while (word.length > limit) {
      if (current) { lines.push(current); current = '' }
      lines.push(word.slice(0, limit))
      word = word.slice(limit)
    }
    if (!word) continue
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= limit) {
      current = candidate
    } else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

/** Shortens `text` with an ellipsis so it fits `maxWidth`; returns it unchanged when it already fits. */
export function truncateText(text: string, maxWidth: number, fontSize: number, bold = false): string {
  const clean = text.trim().replace(/\s+/g, ' ')
  const limit = maxChars(maxWidth, fontSize, bold)
  if (clean.length <= limit) return clean
  if (limit <= 1) return '…'
  return `${clean.slice(0, limit - 1).trimEnd()}…`
}
