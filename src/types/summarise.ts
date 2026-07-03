export type SummariseMode = 'KeyPoints' | 'ExecutiveSummary' | 'Abstract' | 'TlDr' | 'MeetingNotes'
export type SummariseLength = 'short' | 'medium' | 'detailed'

export interface SummariseRequest {
  text: string
  mode: number   // enum value: KeyPoints=0 … MeetingNotes=4
  length: SummariseLength
}

export interface SummarisePreviewRequest {
  text: string
  mode: number
}

export interface SummariseResponse {
  originalText: string
  summary: string
  originalWordCount: number
  summaryWordCount: number
  compressionPercent: number
  mode: string
  length: string
  processingTimeMs: number
  /** True when the document was too long for a single pass and was processed via Map-Reduce chunking. */
  isChunked: boolean
  /** Number of chunks processed in the map stage. 1 when not chunked, 0 when served from cache. */
  chunksProcessed: number
  wordsUsed: number
  wordsLimit: number
  wordsRemaining: number
}

export const SUMMARISE_MODE_INDEX: Record<SummariseMode, number> = {
  KeyPoints:        0,
  ExecutiveSummary: 1,
  Abstract:         2,
  TlDr:             3,
  MeetingNotes:     4,
}

export const SUMMARISE_MODE_LABELS: Record<SummariseMode, string> = {
  KeyPoints:        'Key Points',
  ExecutiveSummary: 'Executive Summary',
  Abstract:         'Abstract',
  TlDr:             'TL;DR',
  MeetingNotes:     'Meeting Notes',
}

export const SUMMARISE_MODE_DESCRIPTIONS: Record<SummariseMode, string> = {
  KeyPoints:        'Numbered list of the most important insights',
  ExecutiveSummary: 'Concise paragraph for senior stakeholders',
  Abstract:         'Formal academic-style single paragraph',
  TlDr:             '2-3 sentence ultra-brief version',
  MeetingNotes:     'Structured decisions, actions, and key points',
}
