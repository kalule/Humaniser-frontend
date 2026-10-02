export interface DetectRequest {
  text: string
  fastMode?: boolean
}

export interface SentenceScore {
  sentence: string
  aiProbability: number
  classification: 'human' | 'mixed' | 'ai'
  reason: string
  /** Character offsets into the original input text — sentence === inputText.slice(startOffset, startOffset + length). */
  startOffset: number
  length: number
}

export interface DetectionMetrics {
  perplexity: number
  burstiness: number
  vocabularyDiversity: number
  sentenceLengthVariance: number
  hedgingDensity: number
  transitionDensity: number
  aiBigramDensity: number
  passiveVoiceRatio: number
  perplexityLabel: string
  burstinessLabel: string
  hedgingLabel: string
}

export interface DetectionFlag {
  category: string
  signal: string
  weightPercent: number
}

export interface LayerScores {
  statistical: number
  stylometric: number
  /** -1 when FastMode skipped this layer */
  semantic: number
}

export interface DetectResponse {
  /** The persisted detection result's id — undefined for a preview (unauthenticated) analysis,
   * in which case "Humanise flagged sentences" has nothing to reference. */
  id?: string
  success: boolean
  humanScore: number
  aiScore: number
  verdict: string
  verdictColor: string
  detailedAnalysis: string
  isLowConfidence: boolean
  sentenceScores: SentenceScore[]
  metrics: DetectionMetrics
  flags: DetectionFlag[]
  layerScores: LayerScores
  aiIndicators: string[]
  humanIndicators: string[]
  /** Likely AI model(s). Empty when human or low confidence. */
  likelySources: string[]
  wordCount: number
  wordsUsed: number
  wordsLimit: number
  creditsUsed: number
  creditsLimit: number
  creditsRemaining: number
  /** Detector's own monthly cap, independent of the shared credit balance. */
  detectorChecksUsed: number
  detectorChecksLimit: number
}

export interface DetectionHistoryItem {
  id: string
  humanScore: number
  aiScore: number
  verdict: string
  verdictColor: string
  wordCount: number
  inputPreview: string
  createdAt: string
}

export interface DetectionHistoryResponse {
  items: DetectionHistoryItem[]
  totalCount: number
  page: number
  pageSize: number
}

export interface BulkHumaniseSentencesRequest {
  detectionResultId: string
  /** 0-100 override for the server's default humanise-flag threshold. Omit for the default. */
  threshold?: number
}

export interface BulkHumaniseSentencesResponse {
  /** Full document text with every flagged sentence rewritten in place; everything else —
   * including whitespace and paragraph structure — is reproduced exactly from the original. */
  text: string
  sentencesHumanised: number
  /** Flagged sentences whose rewrite failed and were left unchanged in `text`. Zero when every
   * flagged sentence was rewritten successfully. */
  sentencesFailed: number
  /** Fresh analysis of `text` — same shape as a normal detect response, so it can replace the
   * current result directly with no follow-up "analyse" call. */
  analysis: DetectResponse
}
