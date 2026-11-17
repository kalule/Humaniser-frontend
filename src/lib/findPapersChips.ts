import type { PaperSearchFilters } from '../types/webLibrary'

/** Starting-point searches for a first visit. Illustrative, not tuned to usage data. */
export const EXAMPLE_SEARCHES = [
  'AI in healthcare',
  'Climate change adaptation',
  'Machine learning bias',
  'Mental health interventions',
]

/**
 * Which chip lists the empty state shows. Examples are only for someone with no history: once there
 * are recent searches they replace the examples, and a term never appears in both lists.
 */
export function emptyStateChips(recent: string[], examples: string[] = EXAMPLE_SEARCHES, max = 5): { examples: string[]; recent: string[] } {
  const seen = new Set<string>()
  const uniqueRecent = recent
    .map(q => q.trim())
    .filter(q => q && !seen.has(q.toLowerCase()) && seen.add(q.toLowerCase()))
    .slice(0, max)
  if (uniqueRecent.length > 0) return { examples: [], recent: uniqueRecent }
  return { examples: examples.slice(0, max), recent: [] }
}

export const TYPE_FILTER_LABELS: Record<NonNullable<PaperSearchFilters['type']>, string> = {
  article: 'Journal article',
  review: 'Review article',
  book: 'Book or chapter',
  conference: 'Conference paper',
  preprint: 'Preprint',
  thesis: 'Thesis',
}

/** One short label per active filter, in a fixed order, for the removable chips under the search bar. */
export function activeFilterLabels(f: PaperSearchFilters): { key: keyof PaperSearchFilters | 'years'; label: string }[] {
  const out: { key: keyof PaperSearchFilters | 'years'; label: string }[] = []
  if (f.yearFrom != null || f.yearTo != null) {
    out.push({ key: 'years', label: f.yearFrom != null && f.yearTo != null ? `${f.yearFrom}–${f.yearTo}` : f.yearFrom != null ? `From ${f.yearFrom}` : `Up to ${f.yearTo}` })
  }
  if (f.type) out.push({ key: 'type', label: TYPE_FILTER_LABELS[f.type] })
  if (f.openAccess) out.push({ key: 'openAccess', label: 'Open access' })
  if (f.minCitations != null && f.minCitations > 0) out.push({ key: 'minCitations', label: `${f.minCitations}+ citations` })
  if (f.field?.trim()) out.push({ key: 'field', label: `Subject: ${f.field.trim()}` })
  return out
}

/** The filters with one chip's worth removed. */
export function withoutFilter(f: PaperSearchFilters, key: keyof PaperSearchFilters | 'years'): PaperSearchFilters {
  const next = { ...f }
  if (key === 'years') { delete next.yearFrom; delete next.yearTo } else delete next[key]
  return next
}
