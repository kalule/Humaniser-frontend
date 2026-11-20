import type { CitationCard } from '../types/citationCheck'
import { needsAttention } from './citationCheckView'
import { cardTitle } from './citationCheckActions'
import { headingForOffset, markTone, type DocParagraph, type MarkTone } from './citationHighlights'

// How a long list of results is ordered, searched, grouped and walked through. Pure, so the rules are tested and a 300-citation
// report does not depend on any component's state.

export type SortMode = 'issues' | 'document'
export type GroupMode = 'none' | 'reference' | 'section'

const SEVERITY: Record<MarkTone, number> = { attention: 0, unverified: 1, pending: 2, locked: 3, ok: 4 }

/** Issues first (then could-not-verify, in-progress, locked, supported), each band in document order. "document" keeps document order. */
export function sortCards(cards: CitationCard[], mode: SortMode): CitationCard[] {
  if (mode === 'document') return [...cards].sort((a, b) => a.ordinal - b.ordinal)
  return [...cards].sort((a, b) => SEVERITY[markTone(a)] - SEVERITY[markTone(b)] || a.ordinal - b.ordinal)
}

/** Case-insensitive match on author, year, marker text or the claim: "lee 2019", "smith", "2020". Every word must match somewhere. */
export function searchCards(cards: CitationCard[], query: string): CitationCard[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return cards
  return cards.filter(c => {
    const haystack = [cardTitle(c), c.markerText, c.citedAuthors, c.citedYear, c.verdict?.claimText].filter(Boolean).join(' ').toLowerCase()
    return words.every(w => haystack.includes(w))
  })
}

/** A failure on our side or a lookup service that did not answer: the only citations "retry failed" will run again. */
/** A lookup or check that failed, or a claim check where the judge gave up (its note says so): all of them are worth running again. */
export const isRetryable = (c: Pick<CitationCard, 'flags' | 'locked'> & { verdict?: { note: string | null } | null }): boolean =>
  !c.locked && (c.flags.includes('LookupFailed') || c.flags.includes('CheckFailed') || /running the check again may help/i.test(c.verdict?.note ?? ''))

// ── Same reference, cited many times ─────────────────────────────────────────────────────────────

const normalise = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

/** Two citations of the same work share a key: the reference entry they matched, else the cited author and year. */
export function referenceKey(c: CitationCard): string {
  const entry = c.referenceEntry ? normalise(c.referenceEntry) : ''
  return entry || normalise(`${c.citedAuthors ?? ''} ${c.citedYear ?? ''}`) || normalise(c.markerText) || c.id
}

export interface CardGroup {
  key: string
  label: string
  cards: CitationCard[]
  /** Cards that need attention in this group. */
  issues: number
}

function toGroups(order: string[], byKey: Map<string, CitationCard[]>, label: (key: string, cards: CitationCard[]) => string): CardGroup[] {
  return order.map(key => {
    const cards = byKey.get(key)!
    return { key, label: label(key, cards), cards, issues: cards.filter(needsAttention).length }
  })
}

/** Groups keep the order their first card has in `cards`, so an issues-first sort puts the groups with problems first too. */
export function groupByReference(cards: CitationCard[]): CardGroup[] {
  const byKey = new Map<string, CitationCard[]>()
  const order: string[] = []
  for (const c of cards) {
    const k = referenceKey(c)
    if (!byKey.has(k)) { byKey.set(k, []); order.push(k) }
    byKey.get(k)!.push(c)
  }
  return toGroups(order, byKey, (_key, g) => cardTitle(g[0]))
}

export function groupBySection(cards: CitationCard[], paragraphs: DocParagraph[], text: string): CardGroup[] {
  const byKey = new Map<string, CitationCard[]>()
  const order: string[] = []
  for (const c of cards) {
    const heading = c.markerOffset >= 0 && c.markerOffset <= text.length ? headingForOffset(paragraphs, c.markerOffset) : null
    const k = heading ?? 'Before the first heading'
    if (!byKey.has(k)) { byKey.set(k, []); order.push(k) }
    byKey.get(k)!.push(c)
  }
  return toGroups(order, byKey, key => key)
}

/** True when the document has headings, so grouping by section means something. */
export const hasHeadings = (paragraphs: DocParagraph[]): boolean => paragraphs.some(p => p.heading > 0)

// ── Walking through the problems ─────────────────────────────────────────────────────────────────

/** The next (or previous) citation that needs attention after `currentId`, wrapping round; null when none do. */
export function stepIssue(cards: CitationCard[], currentId: string | null, direction: 1 | -1): CitationCard | null {
  const issues = cards.filter(needsAttention)
  if (issues.length === 0) return null
  const at = currentId ? issues.findIndex(c => c.id === currentId) : -1
  if (at === -1) return direction === 1 ? issues[0] : issues[issues.length - 1]
  return issues[(at + direction + issues.length) % issues.length]
}

// ── Corrected references ─────────────────────────────────────────────────────────────────────────

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * The reference entry with its differing year or authors replaced by the record's, for the writer to copy. Null when the change cannot
 * be applied safely (the draft's value is not in the entry, or a field we do not know how to correct). The uploaded file is never edited.
 */
export function correctedReference(c: Pick<CitationCard, 'referenceEntry' | 'metadataDiffs' | 'locked'>): string | null {
  const entry = c.referenceEntry?.trim()
  if (c.locked || !entry || c.metadataDiffs.length === 0) return null
  let result = entry
  for (const d of c.metadataDiffs) {
    const from = d.inDraft?.trim(), to = d.inRecord?.trim()
    if (!from || !to) return null
    // A year more than one apart is usually a later edition or repository version of the same work: say so, never rewrite it.
    if (d.field === 'year' && /^\d{4}$/.test(from) && /^\d{4}$/.test(to) && Math.abs(Number(from) - Number(to)) > 1) return null
    const before = result
    if (d.field === 'year' || d.field === 'doi') result = result.replace(new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegex(from)}(?![\\p{L}\\p{N}_])`, 'u'), to)
    else if (d.field.toLowerCase().startsWith('author')) result = result.replace(from, to)
    if (result === before) return null
  }
  return result === entry ? null : result
}

/** Every distinct corrected reference, once each, in document order: what "Copy all corrected references" puts on the clipboard. */
export function allCorrectedReferences(cards: CitationCard[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const c of [...cards].sort((a, b) => a.ordinal - b.ordinal)) {
    const fixed = correctedReference(c)
    if (fixed && !seen.has(fixed)) { seen.add(fixed); out.push(fixed) }
  }
  return out
}

/** A plain-words time for the pre-run estimate. */
export function formatEstimateTime(seconds: number): string {
  if (seconds < 60) return 'under a minute'
  const minutes = Math.round(seconds / 60)
  return minutes === 1 ? 'about a minute' : `about ${minutes} minutes`
}
