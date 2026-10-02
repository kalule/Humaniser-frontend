export type FullTextStatus =
  | 'uploaded'
  | 'open_access_pdf'
  | 'repository_pdf'
  | 'publisher_pdf'
  | 'landing_page_only'
  | 'unavailable'

export interface FullTextAvailability {
  status: FullTextStatus
  canOpenInViewer: boolean
  pdfEndpoint?: string
  landingPageUrl?: string
  provider?: string
  hostType?: 'publisher' | 'repository' | 'user_upload' | 'unknown'
  licence?: string
  isOpenAccess: boolean
  fileName?: string
}

export interface PaperAuthor {
  name: string
  orcid?: string
  affiliations: string[]
}

export interface PaperDetails {
  id: string
  openAlexId?: string
  doi?: string
  title: string
  subtitle?: string
  type?: string
  authors: PaperAuthor[]
  publicationDate?: string
  publicationYear?: number
  source?: {
    name?: string
    publisher?: string
    volume?: string
    issue?: string
    pages?: string
    articleNumber?: string
    issn: string[]
  }
  abstract?: string
  citationCount?: number
  topics: string[]
  keywords: string[]
  language?: string
  openAccess?: { isOpenAccess: boolean; status?: string; licence?: string }
  identifiers: { doi?: string; doiUrl?: string; openAlexUrl?: string; pmid?: string }
  fullText: FullTextAvailability
  library: {
    isSaved: boolean
    documentId?: string
    dateAdded?: string
    lastAccessed?: string
    collections: Array<{ id: string; name: string }>
  }
  provenance: Array<{ field: string; provider: string }>
}
