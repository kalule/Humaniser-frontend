import type { ResearchDocument } from '../types/webLibrary'
import type { EditorSource } from './editorCitations'
import { referenceAuthorNames } from './citationFormat'

/** Saved Sources marks a trashed paper by folder, not by deletion. */
export const TRASH_FOLDER = '__trash__'

/** How many saved sources one writing request may carry (the server enforces the same limit). */
export const MAX_SAVED_SOURCES_PER_REQUEST = 40

/**
 * What we actually hold for a saved paper. Only the abstract counts as the paper's own text: the
 * "Full text" flag on a record is set by the browser at upload and no file reaches the server.
 */
export type SavedSourceText = 'abstract' | 'metadata'

export const savedSourceText = (doc: Pick<ResearchDocument, 'abstract'>): SavedSourceText =>
  doc.abstract?.trim() ? 'abstract' : 'metadata'

export interface SavedSourceFilter {
  query?: string
  /** 'all', a folder id, or `collection:<id>` (membership supplied through `collectionMemberIds`). */
  location?: string
  collectionMemberIds?: ReadonlySet<string> | null
  withAbstractOnly?: boolean
  withDoiOnly?: boolean
  yearFrom?: number | null
  yearTo?: number | null
  docType?: string | null
}

const normalise = (value: string) => value.toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, '').trim()

/** Every term must appear somewhere in the title, authors, journal, year, DOI or tags. */
export function matchesSavedSourceQuery(doc: ResearchDocument, query: string): boolean {
  const terms = normalise(query).split(/\s+/).filter(Boolean)
  if (!terms.length) return true
  const haystack = [doc.title, doc.authors.join(' '), doc.journal ?? '', String(doc.year ?? ''), doc.doi ?? '', doc.tags.join(' ')]
    .join(' ').toLowerCase()
  return terms.every(term => haystack.includes(term))
}

/** The per-paper part of a filter (query, abstract, DOI, years, type) — no location or trash rule. */
export function matchesSavedSourceFilter(doc: ResearchDocument, filter: SavedSourceFilter): boolean {
  if (filter.withAbstractOnly && savedSourceText(doc) !== 'abstract') return false
  if (filter.withDoiOnly && !doc.doi?.trim()) return false
  if (filter.yearFrom != null && (doc.year == null || doc.year < filter.yearFrom)) return false
  if (filter.yearTo != null && (doc.year == null || doc.year > filter.yearTo)) return false
  if (filter.docType && doc.docType !== filter.docType) return false
  return matchesSavedSourceQuery(doc, filter.query ?? '')
}

/** Trashed papers are never offered. Order is kept as given (the store lists newest first). */
export function filterSavedSources(documents: ResearchDocument[], filter: SavedSourceFilter = {}): ResearchDocument[] {
  const location = filter.location ?? 'all'
  return documents.filter(doc => {
    if (doc.folderId === TRASH_FOLDER) return false
    if (location.startsWith('collection:')) {
      if (!filter.collectionMemberIds?.has(doc.id)) return false
    } else if (location !== 'all' && doc.folderId !== location) return false
    return matchesSavedSourceFilter(doc, filter)
  })
}

/** Where a saved paper came from. The provider database isn't stored on saved papers, only whether
 *  it came through Find Papers (it has a canonical work id) or was imported/uploaded. */
export const savedSourceOrigin = (doc: Pick<ResearchDocument, 'canonicalWorkId'>): 'search' | 'imported' =>
  doc.canonicalWorkId ? 'search' : 'imported'

/** Index of the paper after/before `currentId` for arrow-key navigation; stays put at either end. */
export function stepPaper(ids: string[], currentId: string | null, delta: 1 | -1): string | null {
  if (ids.length === 0) return null
  const at = currentId ? ids.indexOf(currentId) : -1
  if (at === -1) return ids[delta === 1 ? 0 : ids.length - 1]
  return ids[Math.min(ids.length - 1, Math.max(0, at + delta))]
}

export const savedSourceCitationId = (documentId: string) => `saved:${documentId}`

/**
 * A saved paper as a citation source for the editor. The metadata is a snapshot taken at insert
 * time; `documentId` and `canonicalId` keep the link back to the saved record.
 */
export function editorSourceFromSaved(doc: ResearchDocument): EditorSource {
  const doi = doc.doi?.trim() || undefined
  const authors = doc.authors.length ? doc.authors.join('; ') : null
  // Saved Sources keeps display names only. They are split into family and given names once, here, with the
  // parser the citation renderer uses, because the reference list reads structured names before the string.
  const authorDetails = authors
    ? referenceAuthorNames({ title: doc.title, authors }).map(n => 'literal' in n ? { name: n.literal } : { family: n.family, given: n.given })
    : undefined
  return {
    id: savedSourceCitationId(doc.id),
    title: doc.title,
    authors,
    authorDetails,
    year: doc.year ?? null,
    venue: doc.journal ?? null,
    doi: doi ?? null,
    url: doi ? `https://doi.org/${doi}` : null,
    documentId: doc.id,
    canonicalId: doc.canonicalWorkId,
    openAlexWorkId: doc.openAlexWorkId,
    abstract: doc.abstract?.trim() || undefined,
    citationCount: doc.citationCount,
  }
}

export function savedSourceByline(doc: ResearchDocument): string {
  const first = doc.authors[0]
  const authors = !first ? 'No author recorded' : doc.authors.length > 1 ? `${first} et al.` : first
  return `${authors} · ${doc.year ?? 'n.d.'}`
}
