import { createContext } from 'react'
import type { CitationFlag, CitationStyle, FetchedLiterature } from '../../../types/research'
import type { ParsedReference } from '../../../lib/citationFormat'
import type { SectionCheckVerdict } from '../../../lib/citationCard'

/** Project-wide citation data the Document view loads once and every section editor reads. */
export interface CitationData {
  style:        CitationStyle
  literature:   FetchedLiterature[]
  bibliography: ParsedReference[]
  flags:        CitationFlag[]
  /** Section code -> results of its in-place "Check citations" run (this session only). */
  checks?:      Record<string, SectionCheckVerdict[]>
}

export const CitationDataContext = createContext<CitationData | null>(null)
