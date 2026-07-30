// ── Pinned chart assets ────────────────────────────────────────────────────────

export interface PinnedChart {
  id: string
  base64Png: string
  caption?: string
  sourcePrompt: string
  pinnedAt: string
}

// ── Prose optimisation ─────────────────────────────────────────────────────────

export type ProseMode = 'academic' | 'humanised' | 'concise'

// ── Compliance shield ──────────────────────────────────────────────────────────

export interface FlaggedBlock {
  patternName: string
  matchedText: string
  startIndex: number
  endIndex: number
  weight: number
}

export interface CitationAsset {
  paperId: string
  title: string
  authors: string[]
  year: number | null
  abstract: string | null
  url: string | null
  doi: string | null
  citationCount: number | null
}

// ── Statistical assumption checker ────────────────────────────────────────────

export interface AssumptionCheckRequest {
  datasetId: string
  independentVars: string[]
  dependentVar: string
}

export interface VifItem {
  variable: string
  vif: number
  flagged: boolean
}

export interface MulticollinearityReport {
  passed: boolean
  vifItems: VifItem[]
  maxVif: number
  threshold: number
}

export interface StatisticalTestDetails {
  passed: boolean
  testName: string
  statistic: number
  pValue: number
  threshold: number
  note?: string | null
}

export interface AssumptionReport {
  variables: { independent: string[]; dependent: string }
  sampleSize: number
  multicollinearity: MulticollinearityReport | null
  homoscedasticity: StatisticalTestDetails | null
  normality: StatisticalTestDetails | null
  error?: string | null
}

// ── Outlier simulation (Cook's Distance) ──────────────────────────────────────

export interface OutlierSimulationRequest {
  datasetId: string
  independentVariable: string
  dependentVariable: string
  indicesToExclude?: number[]
}

export interface OutlierPoint {
  rowIndex: number
  value: number
  cooksDistance: number
}

export interface RegressionMetrics {
  r2Score: number
  slope: number
  intercept: number
  chartBase64: string
}

export interface OutlierScanResult {
  outliersDetected: boolean
  outliers: OutlierPoint[]
  sampleSize: number
  baselineMetrics: RegressionMetrics
  cleanedMetrics: RegressionMetrics | null
  error?: string | null
}

// ── API contracts ──────────────────────────────────────────────────────────────

export interface GenerateAbstractRequest {
  datasetId: string
  conversationHistory: { role: string; content: string }[]
}

export interface GenerateAbstractResponse {
  abstract: string
}

export interface OptimizeProseRequest {
  text: string
  mode: ProseMode
}

export interface OptimizeProseResponse {
  optimizedText: string
}

export interface ScanShieldRequest {
  text: string
}

export interface ScanShieldResponse {
  aiPatternScore: number
  riskLevel: string
  flaggedBlocks: FlaggedBlock[]
  totalFlags: number
}

export interface ValidateLiteratureRequest {
  query: string
}

export interface ValidateLiteratureResponse {
  citations: CitationAsset[]
}

// ── Write with AI ────────────────────────────────────────────────────────────

export type WriteWithAiSourceMode = 'Web' | 'MyFiles' | 'Hybrid'

export interface WriteWithAiLibraryDocument {
  title:   string
  content: string
}

export interface WriteWithAiRequest {
  topic:             string
  targetWordCount?:  number
  sourceMode:        WriteWithAiSourceMode
  libraryDocuments?: WriteWithAiLibraryDocument[]
}

export interface WriteWithAiReference {
  title:  string
  url:    string | null
  source: 'web' | 'my_files'
}

export interface WriteWithAiResponse {
  title:      string
  content:    string
  references: WriteWithAiReference[]
  wordCount:  number
}

// ── Write On (continue writing) ──────────────────────────────────────────────

export interface ContinueWritingRequest {
  existingContent:  string
  topic?:           string
  targetWordCount?: number
}

export interface ContinueWritingResponse {
  content:    string
  references: WriteWithAiReference[]
  wordCount:  number
}

// ── Review On (AI document review) ───────────────────────────────────────────

export interface ReviewDocumentRequest {
  content: string
}

export interface ReviewDocumentResponse {
  overallAssessment: string
  strengths:         string[]
  suggestions:       string[]
}
