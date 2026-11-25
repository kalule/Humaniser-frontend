export type ResearchDocType =
  | 'Journal Article'
  | 'Book'
  | 'Book Chapter'
  | 'Conference Paper'
  | 'Preprint'
  | 'Report'
  | 'Thesis'

export type ColumnKey =
  | 'tldr'
  | 'conclusions'
  | 'abstract'
  | 'results'
  | 'intro'
  | 'methodology'
  | 'limitations'
  | 'literature'

export const COLUMN_META: Record<ColumnKey, { label: string; dbField: string }> = {
  tldr:         { label: 'TL;DR',                    dbField: 'tldr' },
  conclusions:  { label: 'Conclusions',              dbField: 'conclusions' },
  abstract:     { label: 'Summarized Abstract',      dbField: 'abstract' },
  results:      { label: 'Results',                  dbField: 'results' },
  intro:        { label: 'Summarized Introduction',  dbField: 'intro' },
  methodology:  { label: 'Methods Used',             dbField: 'methodology' },
  limitations:  { label: 'Limitations',              dbField: 'limitations' },
  literature:   { label: 'Literature Survey',        dbField: 'literature' },
}

export const ORDERED_COLUMNS: ColumnKey[] = [
  'tldr', 'conclusions', 'abstract', 'results', 'intro', 'methodology', 'limitations', 'literature',
]

export interface ResearchDocument {
  id:            string
  title:         string
  authors:       string[]
  docType:       ResearchDocType
  year?:         number
  journal?:      string
  filePath?:     string
  isFullText?:   boolean
  tldr?:         string
  conclusions?:  string
  abstract?:     string
  results?:      string
  intro?:        string
  methodology?:  string
  limitations?:  string
  literature?:   string
  tags:          string[]
  folderId?:     string | null
  /** Set only for documents saved from Find Papers — links back to the shared canonical-identity
   *  pipeline so the same scholarly work is never saved twice. Undefined for manually uploaded docs. */
  canonicalWorkId?: string
  openAlexWorkId?:  string
  doi?:             string
  citationCount?:   number
  createdAt:     string
  updatedAt:     string
}

export interface LibraryFolder {
  id:        string
  name:      string
  createdAt: string
}

export type ActiveLocation = 'all' | 'publications' | 'trash' | string // string = folderId

// ── Find Papers (OpenAlex-backed search) ────────────────────────────────────

export interface PaperSearchResult {
  canonicalId:     string
  openAlexWorkId?: string
  doi?:            string
  title:           string
  authors:         string[]
  year?:           number
  journal?:        string
  abstract?:       string
  citationCount?:  number
  url?:            string
  isRetracted:     boolean
  isSaved:         boolean
  savedDocumentId?: string
  collectionIds:   string[]
  /** Provider work type as given, e.g. "article", "book-chapter". */
  workType?:       string
  /** Provider the record came from (OpenAlex, Semantic Scholar, CORE, PubMed, ...). */
  sourceEngine?:   string
  /** What the record carries. "pdf" is a provider PDF link nobody has checked, not verified full text. */
  contentLevel?:   'pdf' | 'abstract' | 'metadata'
  /** Set when the record is probably not the work its title suggests. */
  caution?:        'book-review' | 'erratum' | 'paratext'
}

export type PaperTypeFilter = 'article' | 'review' | 'book' | 'conference' | 'preprint' | 'thesis'

/** Find Papers filters. They narrow the server's fetched pool (the ~100 most relevant matches). */
/** What the query is matched against. A pasted DOI is always looked up exactly, whichever mode is chosen. */
export type PaperSearchMode = 'topic' | 'title' | 'author'
export type PaperSearchSort = 'relevance' | 'cited' | 'newest' | 'oldest'

export interface PaperSearchFilters {
  yearFrom?:     number
  yearTo?:       number
  openAccess?:   boolean
  type?:         PaperTypeFilter
  minCitations?: number
  /** Subject text matched against provider concept tags (OpenAlex records only). */
  field?:        string
}

// ── Research Collections ─────────────────────────────────────────────────────

export interface Collection {
  id:          string
  name:        string
  description?: string
  paperCount:  number
  createdAt:   string
  updatedAt:   string
  /** Up to three titles, most recently added first (trashed papers left out). */
  previewTitles?: string[]
  /** Publication-year range of papers that have a year. */
  yearFrom?:   number | null
  yearTo?:     number | null
}

export interface CollectionDetail {
  id:          string
  name:        string
  description?: string
  createdAt:   string
  updatedAt:   string
  papers:      ResearchDocument[]
}
