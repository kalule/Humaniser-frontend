import { renderCslDocument } from './csl/render'
import type { FormatStyle } from '../types/citation'
import type { Collection, ResearchDocument } from '../types/webLibrary'

export type SortDir = 'asc' | 'desc'
export type CollectionSortKey = 'updated' | 'name' | 'count'

export const COLLECTION_SORT_OPTIONS: { value: CollectionSortKey; label: string; defaultDir: SortDir }[] = [
  { value: 'updated', label: 'Last updated', defaultDir: 'desc' },
  { value: 'name',    label: 'Name',         defaultDir: 'asc' },
  { value: 'count',   label: 'Paper count',  defaultDir: 'desc' },
]

export function yearRangeLabel(from?: number | null, to?: number | null): string | null {
  if (from == null || to == null) return null
  return from === to ? String(from) : `${from}–${to}`
}

export function sortCollections(list: Collection[], key: CollectionSortKey, dir: SortDir): Collection[] {
  const sign = dir === 'asc' ? 1 : -1
  return [...list].sort((a, b) => {
    const primary = key === 'name' ? a.name.localeCompare(b.name)
      : key === 'count' ? a.paperCount - b.paperCount
      : a.updatedAt.localeCompare(b.updatedAt)
    // Ties fall back to name, always A–Z, so the order is stable whichever way you sort.
    return primary * sign || a.name.localeCompare(b.name)
  })
}

/**
 * A formatted reference list for every paper in a collection, from the saved metadata only — the
 * same renderer the editor uses, nothing reconstructed by a model. Papers the renderer rejects
 * (e.g. no title) are counted, not silently dropped.
 */
export function referenceList(papers: ResearchDocument[], style: FormatStyle): { entries: string[]; skipped: number } {
  const usable = papers.filter(p => p.title?.trim())
  const skipped = papers.length - usable.length
  if (usable.length === 0) return { entries: [], skipped }
  const sources = usable.map(p => ({
    id: p.id, title: p.title, authors: p.authors.join('; '), year: p.year, venue: p.journal, doi: p.doi,
  }))
  try {
    const rendered = renderCslDocument(sources, [], style, usable.map(p => p.id))
    return { entries: rendered.bibliography.map(e => e.text), skipped }
  } catch {
    return { entries: [], skipped: papers.length }
  }
}
