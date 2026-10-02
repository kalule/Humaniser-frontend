export interface CitationAuthor {
  firstName: string
  middleInitial: string
  lastName: string
}

export interface ResolvedCitation {
  itemType: string
  authors: CitationAuthor[]
  title: string
  publicationYear: number | null
  journalName: string | null
  volume: string | null
  issue: string | null
  pages: string | null
  doi: string | null
  url: string | null
  publisher: string | null
  apa7: string
  harvard: string
  ieee: string
  mla: string
  chicago: string
  vancouver: string
}

export interface CitationDto {
  id: string
  itemType: string
  authors: CitationAuthor[]
  title: string
  publicationYear: number | null
  journalName: string | null
  volume: string | null
  issue: string | null
  pages: string | null
  doi: string | null
  url: string | null
  publisher: string | null
  cachedApa7: string | null
  cachedHarvard: string | null
  cachedIeee: string | null
  cachedMla: string | null
  cachedChicago: string | null
  cachedVancouver: string | null
  createdAt: string
}

export type InputType = 'doi' | 'url' | 'text'
export type FormatStyle = 'apa7' | 'harvard' | 'ieee' | 'mla' | 'chicago' | 'vancouver'

// Single source of truth for display labels — was duplicated identically in CitationPage.tsx and
// DocumentEditorPage.tsx; also used by the new-document creation card (prompt #3).
export const FORMAT_LABELS: Record<FormatStyle, string> = {
  apa7:      'APA 7',
  harvard:   'Harvard',
  ieee:      'IEEE',
  mla:       'MLA 9',
  chicago:   'Chicago',
  vancouver: 'Vancouver',
}
export const FORMAT_STYLES = Object.keys(FORMAT_LABELS) as FormatStyle[]

export interface SaveCitationRequest {
  itemType: string
  authors: CitationAuthor[]
  title: string
  publicationYear: number | null
  journalName: string | null
  volume: string | null
  issue: string | null
  pages: string | null
  doi: string | null
  url: string | null
  publisher: string | null
  cachedApa7: string | null
  cachedHarvard: string | null
  cachedIeee: string | null
  cachedMla: string | null
  cachedChicago: string | null
  cachedVancouver: string | null
}
