import type { SavedSourceFilter } from './savedSources'
import type { SortDir } from './collectionsView'
import type { ResearchDocument } from '../types/webLibrary'

export type SavedSortKey = 'date-added' | 'title' | 'year'

export const SAVED_SORT_OPTIONS: { value: SavedSortKey; label: string; defaultDir: SortDir }[] = [
  { value: 'date-added', label: 'Date added', defaultDir: 'desc' },
  { value: 'title',      label: 'Title',      defaultDir: 'asc' },
  { value: 'year',       label: 'Year',       defaultDir: 'desc' },
]

/** Papers with no year sort after those with one, whichever the direction. */
export function sortSavedPapers(docs: ResearchDocument[], key: SavedSortKey, dir: SortDir): ResearchDocument[] {
  const sign = dir === 'asc' ? 1 : -1
  return [...docs].sort((a, b) => {
    if (key === 'title') return sign * a.title.localeCompare(b.title)
    if (key === 'year') {
      if (a.year == null || b.year == null) return a.year == null ? (b.year == null ? 0 : 1) : -1
      return sign * (a.year - b.year)
    }
    return sign * a.createdAt.localeCompare(b.createdAt)
  })
}

export type SavedPaperFilters = Pick<SavedSourceFilter, 'withAbstractOnly' | 'withDoiOnly' | 'yearFrom' | 'yearTo' | 'docType'>

export function activeSavedFilterCount(f: SavedPaperFilters): number {
  return [f.withAbstractOnly, f.withDoiOnly, f.yearFrom != null || f.yearTo != null, !!f.docType].filter(Boolean).length
}
