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
  createdAt: string
}

export type InputType = 'doi' | 'url' | 'text'
export type FormatStyle = 'apa7' | 'harvard' | 'ieee' | 'mla'

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
}
