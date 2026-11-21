import { createContext } from 'react'
import type { CitationFlag, CitationStyle, FetchedLiterature } from '../../../types/research'
import type { ParsedReference } from '../../../lib/citationFormat'

/** Project-wide citation data the Document view loads once and every section editor reads. */
export interface CitationData {
  style:        CitationStyle
  literature:   FetchedLiterature[]
  bibliography: ParsedReference[]
  flags:        CitationFlag[]
}

export const CitationDataContext = createContext<CitationData | null>(null)
