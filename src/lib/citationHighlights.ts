import type { CitationCard } from '../types/citationCheck'
import { needsAttention } from './citationCheckView'

// Where each citation sits in the document, built once from the draft text and the cards. Card offsets index the draft exactly as the
// server holds it (LF line endings), so the text shown must be that same string: nothing is re-flowed or trimmed before indexing.

export interface DocParagraph {
  index: number
  /** Offset of the first character of this line in the draft. */
  start: number
  end: number
  /** What is shown: the line without a Markdown heading prefix. */
  text: string
  /** Characters removed from the front of the line for display ("## "), so mark offsets can be shifted to match. */
  prefixLength: number
  /** 0 for body text, 1-6 for a Markdown heading line. */
  heading: number
}

const HEADING = /^(#{1,6})[ \t]+/

export function splitParagraphs(text: string): DocParagraph[] {
  const paragraphs: DocParagraph[] = []
  let start = 0
  for (let i = 0; i <= text.length; i++) {
    if (i === text.length || text[i] === '\n') {
      const line = text.slice(start, i)
      const m = HEADING.exec(line)
      paragraphs.push({
        index: paragraphs.length, start, end: i, text: m ? line.slice(m[0].length) : line,
        prefixLength: m ? m[0].length : 0, heading: m ? m[1].length : 0,
      })
      start = i + 1
    }
  }
  return paragraphs
}

/** How a citation shows in the text. Colour is never the only signal: each tone also has its own underline style and icon (see index.css). */
export type MarkTone = 'attention' | 'unverified' | 'pending' | 'locked' | 'ok'

const SEVERITY: Record<MarkTone, number> = { attention: 4, unverified: 3, pending: 2, locked: 1, ok: 0 }

export function markTone(card: CitationCard): MarkTone {
  if (card.locked) return 'locked'
  if (needsAttention(card)) return 'attention'
  const verdict = card.verdict?.verdict
  if (!verdict) return 'pending'
  return verdict === 'Supported' ? 'ok' : 'unverified'
}

export const TONE_LABEL: Record<MarkTone, string> = {
  attention: 'needs attention', unverified: 'could not verify', pending: 'still being checked', locked: 'not checked on your plan', ok: 'supported',
}

export interface MarkSegment {
  /** Relative to the paragraph's displayed text. */
  start: number
  end: number
  /** More than one when a single marker cites several works ("(Smith, 2020; Lee, 2019)"). */
  cardIds: string[]
  tone: MarkTone
}

export interface HighlightIndex {
  byParagraph: Map<number, MarkSegment[]>
  cardToParagraph: Map<string, number>
  /** Cards whose marker could not be found at its offset (the text changed, or an extraction quirk): they stay in the results, just unlinked. */
  unplaced: string[]
}

function paragraphAt(paragraphs: DocParagraph[], offset: number): DocParagraph | null {
  let lo = 0, hi = paragraphs.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const p = paragraphs[mid]
    if (offset < p.start) hi = mid - 1
    else if (offset > p.end) lo = mid + 1
    else return p
  }
  return null
}

export function buildHighlightIndex(text: string, paragraphs: DocParagraph[], cards: CitationCard[]): HighlightIndex {
  const byOffset = new Map<number, { length: number; cards: CitationCard[] }>()
  const unplaced: string[] = []

  for (const card of cards) {
    // A marker is only trusted where the text at its offset really is that marker.
    const length = card.markerLength > 0 ? card.markerLength : card.markerText.length
    if (card.markerOffset < 0 || text.slice(card.markerOffset, card.markerOffset + length) !== card.markerText.slice(0, length)) {
      unplaced.push(card.id)
      continue
    }
    const entry = byOffset.get(card.markerOffset)
    if (entry) entry.cards.push(card)
    else byOffset.set(card.markerOffset, { length, cards: [card] })
  }

  const byParagraph = new Map<number, MarkSegment[]>()
  const cardToParagraph = new Map<string, number>()
  for (const [offset, { length, cards: group }] of [...byOffset.entries()].sort((a, b) => a[0] - b[0])) {
    const p = paragraphAt(paragraphs, offset)
    if (!p) { unplaced.push(...group.map(c => c.id)); continue }
    const start = offset - p.start - p.prefixLength
    const end = Math.min(start + length, p.text.length)
    if (start < 0 || end <= start) { unplaced.push(...group.map(c => c.id)); continue }

    const segments = byParagraph.get(p.index) ?? []
    if (segments.length > 0 && start < segments[segments.length - 1].end) { unplaced.push(...group.map(c => c.id)); continue }   // overlapping markers
    const tone = group.map(markTone).reduce((worst, t) => (SEVERITY[t] > SEVERITY[worst] ? t : worst), 'ok' as MarkTone)
    segments.push({ start, end, cardIds: group.map(c => c.id), tone })
    byParagraph.set(p.index, segments)
    for (const c of group) cardToParagraph.set(c.id, p.index)
  }
  return { byParagraph, cardToParagraph, unplaced }
}

/** The nearest heading above an offset, or null before the first one. Used to group results by section. */
export function headingForOffset(paragraphs: DocParagraph[], offset: number): string | null {
  let heading: string | null = null
  for (const p of paragraphs) {
    if (p.start > offset) break
    if (p.heading > 0 && p.text.trim()) heading = p.text.trim()
  }
  return heading
}

export const wordCountOf = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length
