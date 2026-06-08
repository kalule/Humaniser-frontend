export interface PlagiarismRequest {
  text: string
}

export interface MatchedSegment {
  suspectSnippet: string
  sourceSnippet: string
  /** 'exact' | 'paraphrased' | 'structural' */
  matchType: string
}

export interface SourceMatch {
  url: string
  title: string
  domain: string
  snippet: string
  similarityPercent: number
  segments: MatchedSegment[]
}

export interface PlagiarismResponse {
  originalityScore: number   // 0-100; higher = more original
  similarityScore: number    // 0-100; higher = more plagiarised
  verdict: string
  verdictColor: string
  analysis: string
  sourceMatches: SourceMatch[]
  wordCount: number
  sourcesSearched: number
  processingTimeMs: number
  isLowConfidence: boolean
  /** True when no web sources were found — result is inconclusive, NOT a confirmed clean pass. */
  isNoSourcesFound: boolean
  wordsUsed: number
  wordsLimit: number
  wordsRemaining: number
}
