// ── Academic data dictionary ──────────────────────────────────────────────────

export interface DataDictionaryEntry {
  columnKey:           string
  humanReadableLabel:  string
  dataType:            'numeric' | 'categorical' | 'datetime' | 'string'
  valueMappings?:      Record<string, string> | null
}

// ── Column / Schema ───────────────────────────────────────────────────────────

export interface ColumnSchema {
  name: string
  dtype: 'int64' | 'float64' | 'object' | 'datetime64' | 'bool' | string
  nullable: boolean
  nullPercent?: number    // 0-100 — populated by backend metadata profiler
  nullCount?: number
  sampleValues: string[]
  uniqueCount?: number
}

export interface DatasetSchema {
  datasetId: string
  fileName: string
  rowCount: number
  columnCount: number
  columns: ColumnSchema[]
  fileSizeBytes: number
  uploadedAt: string
  dataDictionary?: DataDictionaryEntry[] | null
}

// ── Results ───────────────────────────────────────────────────────────────────

export interface ChartResult {
  type: 'chart'
  base64Png: string
  caption?: string
}

export interface TableResult {
  type: 'table'
  headers: string[]
  rows: (string | number | null)[][]
  caption?: string
}

export interface TextResult {
  type: 'text'
  content: string
}

export type AnalystResult = ChartResult | TableResult | TextResult

// ── Messages ──────────────────────────────────────────────────────────────────

export type MessageRole   = 'user' | 'assistant'
export type JobStatus     = 'pending' | 'running' | 'complete' | 'error'
export type WorkbenchMode = 'student' | 'developer'

export interface AnalystMessage {
  id: string
  role: MessageRole
  content: string
  results?: AnalystResult[]
  jobId?: string
  status?: JobStatus
  createdAt: string
  error?: string
  errorKind?: import('../lib/classifyApiError').ApiErrorKind
  // Socratic Code Toggle fields
  pythonCode?: string        // Generated Python script (Developer mode)
  conceptualGuide?: string[] // Step-by-step explanations (Student mode)
  logStream?: string[]       // Live stdout lines from E2B sandbox
  retryCount?: number        // Self-healing retry counter from backend
  // Literature cross-check
  literature?: LiteratureCitation[]
  isFindingLiterature?: boolean
  // Academic write-up
  writeUpDraft?: string
  writeUpCitations?: FormattedCitations
  isGeneratingWriteUp?: boolean
  // Methodology appendix
  methodologyAppendix?: MethodologyAppendixResponse
  isGeneratingMethodology?: boolean
  // Academic synthesis (Phase 13)
  academicSynthesis?: AcademicSynthesis
  isGeneratingSynthesis?: boolean
  // Outlier simulation
  outlierScan?: import('./workbench').OutlierScanResult | null
  outlierSimResult?: import('./workbench').OutlierScanResult | null
  isRunningOutlierScan?: boolean
}

// ── Contradiction Engine ──────────────────────────────────────────────────────

export type LiteratureAlignment = 'Supporting' | 'Contradictory' | 'Nuanced'

// Citation shape returned by the Contradiction Engine — extends the base Semantic Scholar
// fields with alignment classification and synthesis prompts.
export interface LiteratureCitation {
  paperId: string
  title: string
  authors: string[]
  year: number | null
  abstract: string | null
  url: string | null
  doi: string | null
  citationCount: number | null
  sourceEngine?: string
  alignment?: LiteratureAlignment
  alignmentNarrative?: string
  criticalAnalysisPrompt?: string
}

// ── Write-up ──────────────────────────────────────────────────────────────────

export type AcademicStyleGuide = 'APA7' | 'Harvard' | 'IEEE'

export interface RegressionTelemetry {
  coefficient: number
  tStatistic: number
  pValue: number
  r2Score: number
  fStatistic: number
  degreesOfFreedomModel: number
  degreesOfFreedomResidual: number
}

export interface WriteUpRequest {
  independentVariable: string
  dependentVariable: string
  styleGuide: AcademicStyleGuide
  telemetry: RegressionTelemetry
}

export interface FormattedCitations {
  apa7: string
  harvard: string
}

export interface WriteUpResponse {
  draft: string
  citations: FormattedCitations
}

// ── Methodology Appendix ──────────────────────────────────────────────────────

export interface MethodologyEvent {
  category:         string           // "MissingValues" | "Outliers" | "Transformation" | "Subsetting"
  action:           string
  column?:          string
  columns?:         string
  beforeRows?:      number
  afterRows?:       number
  removedCount?:    number
  percentRemoved?:  number
  method?:          string
  threshold?:       string
  outliersDetected?: number
  indicesExcluded?: number[]
  reason?:          string
  logBase?:         number
}

export interface MethodologyAppendixResponse {
  narrative:    string
  events:       MethodologyEvent[]
  hasEvents:    boolean
  datasetName:  string
  generatedAt:  string
}

// ── Data Health Report ────────────────────────────────────────────────────────

export type AnomalyIssueType = 'missing_values' | 'type_mismatch' | 'high_outliers' | 'invariant_value' | 'duplicate_rows'
export type AnomalySeverity  = 'critical' | 'warning'
export type FixAction        = 'drop_rows' | 'impute_median' | 'strip_symbols' | 'drop_column'

export interface DiagnosticSampleRow {
  row_index: number
  country?:  string
  year?:     number
  value:     string | number | null
}

export interface DataAnomaly {
  columnName:           string
  issueType:            AnomalyIssueType
  severity:             AnomalySeverity
  description:          string
  recommendedFixAction: FixAction
  totalAffectedRows?:   number
  nullPercent?:         number
  diagnosticSample?:    DiagnosticSampleRow[]
}

export interface DataHealthReport {
  totalRows:          number
  totalColumns:       number
  duplicateRowsCount: number
  anomalies:          DataAnomaly[]
}

// ── Academic Synthesis ────────────────────────────────────────────────────────

export interface SynthesisLiteratureItem {
  author:   string
  year:     number | null
  title:    string
  journal?: string | null
}

export interface AcademicSynthesisRequest {
  literature: SynthesisLiteratureItem[]
  resultJson?: string
}

export interface AcademicSynthesis {
  text:               string
  harvardReferences:  string[]
}

// ── Data Cleaning ─────────────────────────────────────────────────────────────

export interface MissingValueStrategy {
  columnName:      string
  action:          'drop' | 'fill_mean' | 'fill_median' | 'fill_custom' | 'drop_column'
  customFillValue?: string | number | null
}

export interface TypeConversionConfig {
  columnName:      string
  targetType:      'int' | 'float' | 'datetime' | 'string'
  stripCharacters?: string[]
}

export interface CleanDatasetConfig {
  datasetId:               string
  dropDuplicates:          boolean
  stripWhitespace:         boolean
  missingValueStrategies?: MissingValueStrategy[]
  typeConversions?:        TypeConversionConfig[]
}

export interface CleanDatasetResponse {
  datasetId:         string
  schema:            DatasetSchema
  rowsRemoved:       number
  duplicatesRemoved: number
}

// ── Guided Preprocessing Wizard ───────────────────────────────────────────────

export type AnalyticalMethod = 'descriptive' | 'regression' | 'hypothesis_testing' | 'custom'

export interface PreparationBlueprintRequest {
  analyticalMethod: AnalyticalMethod
  customIntent?: string
  targetVariable?: string
  predictorVariables?: string[]
  groupingVariable?: string
}

export interface TransformationStep {
  action: string
  rationale: string
  impact: string
}

export interface PreparationBlueprint {
  explanation: string
  steps: TransformationStep[]
  protectedColumns: string[]
  config: CleanDatasetConfig
}

// ── Academic level ────────────────────────────────────────────────────────────

export type AcademicLevel = 'undergraduate' | 'masters' | 'doctoral'

export const ACADEMIC_LEVEL_MAP: Record<AcademicLevel, number> = {
  undergraduate: 0,
  masters:       1,
  doctoral:      2,
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export interface SessionSummary {
  sessionId:        string
  title:            string
  academicLevel:    number   // 0=Undergraduate, 1=Masters, 2=Doctoral
  stepCount:        number
  datasetFileName:  string
  createdAt:        string
  updatedAt:        string
}

export interface SessionStep {
  stepNumber:        number
  query:             string
  interpretedResult: string
  results?:          AnalystResult[]
  timestamp:         string
}

export interface SessionDetail {
  sessionId:        string
  title:            string
  academicLevel:    number
  stepCount:        number
  datasetFileName:  string
  datasetId:        string
  steps:            SessionStep[]
  createdAt:        string
  updatedAt:        string
}

// ── API contracts ─────────────────────────────────────────────────────────────

export interface UploadDatasetResponse {
  datasetId: string
  schema: DatasetSchema
}

export interface AnalystQueryRequest {
  datasetId:     string
  query:         string
  mode?:         WorkbenchMode
  sessionId?:    string | null        // null = create new session
  academicLevel: number               // 0=Undergraduate, 1=Masters, 2=Doctoral
}

export interface AnalystJobResponse {
  jobId:            string
  status:           JobStatus
  interpretation?:  string
  conceptualGuide?: string[]
  pythonCode?:      string
  results?:         AnalystResult[]
  logStream?:       string[]
  retryCount?:      number
  error?:           string
  sessionId?:       string | null     // echoed back after job accepted
  sessionStepCount?: number
}
