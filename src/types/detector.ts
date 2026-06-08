export interface DetectRequest {
  text: string
  fastMode?: boolean
}

export interface SentenceScore {
  sentence: string
  aiProbability: number
  classification: 'human' | 'mixed' | 'ai'
  reason: string
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
