export type AcademicLevel  = 'UNDERGRADUATE' | 'MASTERS' | 'PHD'
export type CitationStyle  = 'apa7' | 'harvard' | 'mla' | 'ieee'
export type DocumentMode   = 'PROPOSAL' | 'DISSERTATION'
export type GeneratorMode  = 'GENERATOR' | 'AGENT'
export type GatherMode     = 'documents' | 'web' | 'hybrid'

// ── Autonomous generation (AI Thesis) ────────────────────────────────────────
// Server-driven — persisted on the project row and polled, so progress survives
// a closed tab/refresh. Mirrors HumaniseAI.Application.DTOs.Research.GenerationStatusDto.

export type GenerationPhase = 'NotStarted' | 'Starting' | 'Generating' | 'Completed' | 'Cancelled' | 'Error'

export interface GenerationStatus {
  status:         GenerationPhase
  completedCount: number
  totalCount:     number
  currentSection: string | null
  wordsWritten:   number
  failedCount:    number
}

export interface ResearchTopic {
  id:          string
  title:       string
  description: string
  tags:        string[]
  gapSummary:  string
}

export interface GeneratedTitle {
  id:          string  // r1 | r2 | r3
  titleText:   string
  methodology: string  // Qualitative Study | Cross-Sectional Survey | Mixed-Methods Investigation
}

export interface ResearchProject {
  id:              string
  title:           string
  academicLevel:   AcademicLevel
  fieldInterest:   string
  selectedTopic:   ResearchTopic | null
  suggestedTopics: ResearchTopic[]
  generatedTitles: GeneratedTitle[]
  currentStep:     number       // index into STEPS array
  sectionContent:  Record<string, string>  // stepId → content
  documentMode:    DocumentMode
  generatorMode:   GeneratorMode
  citationStyle:   CitationStyle
  progressPct:     number
  createdAt:       string
  updatedAt:       string
  documentType?:   string   // Sprint 5: Proposal | Thesis | Dissertation
  methodologyType?:    string  // "Qualitative" | "Quantitative" | "Mixed Methods"
  methodologySubType?: string  // optional Tier 2 refinement, e.g. "Phenomenology"
  isExternallySourced?: boolean  // true when created via upload-external-proposal (Thesis Studio)
  institution?:    string
  supervisorName?: string
  notes?:          string
  studyLocation?:  string
  studyPopulation?: string
  gatherMode?:     GatherMode
  selectedLibraryDocumentIds?: string[]
}

// ── Literature Discovery (Gather step's second tab) ──────────────────────────

export interface LiteratureDimension {
  id:       string
  name:     string
  keywords: string
  enabled:  boolean
}

export interface DiscoveryDatabase {
  id:          string
  name:        string
  recommended: boolean
  enabled:     boolean
  available:   boolean
  description: string
}

export interface LiteratureSearchQuery {
  id:          string
  title:       string
  queryText:   string
  description: string
  targets:     string[]
  enabled:     boolean
  sortOrder:   number
  createdAt:   string
  updatedAt:   string
}

export interface DiscoveryConfig {
  strategy:     string
  candidateCap: number
  databases:    DiscoveryDatabase[]
  dimensions:   LiteratureDimension[]
  queries:      LiteratureSearchQuery[]
}

export type DiscoveryStatusPhase = 'NotStarted' | 'Running' | 'Completed' | 'Error'

export interface FailedDiscoverySource {
  source:      string
  displayName: string
  message:     string
}

export interface DiscoveryStatus {
  status:              DiscoveryStatusPhase
  stageIndex:           number // 1-5, matches the UI stepper
  statusMessage:        string
  liveActivityMessage:  string
  progressPct:          number
  resultCount:          number
  duplicateCount:       number
  uniqueCount:          number
  likelyRelevantCount:  number
  coveragePct:          number // likelyRelevantCount / uniqueCount, 0 when uniqueCount is 0
  sourceCounts:         Record<string, number>
  stopReason:           string | null // "Stopped by user" | "Candidate cap reached" | "Completed all queries and databases"
  failedSources:        FailedDiscoverySource[]
  completedAt:          string | null
}

export interface ImportManualPaperPayload {
  title:    string
  doi?:     string
  authors?: string
  journal?: string
  url?:     string
}

// ── Evidence Screening (Gather step's "Screen" step) ──────────────────────────

export type ScreeningStatusPhase = 'NotStarted' | 'Running' | 'Completed' | 'Error'

export interface ScreeningStatus {
  status:             ScreeningStatusPhase
  progressPct:        number
  statusMessage:      string
  discoveredCount:    number
  uniqueCount:        number
  relevantCount:      number
  evidenceReadyCount: number
  approvedCount:      number
  screenedCount:      number
  manualReviewCount:  number
  excludedCount:      number
  abstractOnlyCount:  number
  completedAt:        string | null
  coverageStatus:     'Low' | 'Moderate' | 'High'
  isCorpusApproved:   boolean
  currentStep:        number
}

export interface ApproveCorpusPayload {
  acknowledgeLimitedCoverage?: boolean
  transitionToNextStep?:       boolean
}

export interface DimensionCoverage {
  name:          string
  fullTextCount: number
  paperCount:    number
  status:        'Missing' | 'Moderate' | 'Supported'
}

export interface DimensionCoverageSummary {
  dimensions:              DimensionCoverage[]
  pctDimensionsWithCoverage: number
  libraryCount:            number
  webCount:                number
  databaseCount:           number
  venueCount:              number
  authorGroupCount:        number
  estimatedCitationsLow:   number
  estimatedCitationsHigh:  number
}

export type ManualDecision = 'Automatic' | 'Include' | 'Exclude'
export type FinalDecision  = 'Pending' | 'Included' | 'Excluded' | 'ManualReview'
export type SourceType     = 'MetadataOnly' | 'AbstractOnly' | 'FullText'

export interface ScreeningCandidate {
  id:                      string
  title:                   string
  authors:                 string
  publicationYear:         string
  journal:                 string
  doi:                     string
  abstract:                string
  source:                  string
  foundViaSources:         string[]
  duplicatesCollapsedCount: number
  dimensions:              string[]
  screeningVerdict:        'Pending' | 'Relevant' | 'Uncertain' | 'Excluded'
  screeningRelevanceScore: number
  screeningRationale:      string
  sourceType:              SourceType
  evidencePct:             number
  manualDecision:          ManualDecision
  finalDecision:           FinalDecision
  hasFullText:             boolean
}

export interface ScreeningCandidateList {
  items:      ScreeningCandidate[]
  totalCount: number
  page:       number
  pageSize:   number
}

export interface ScreeningCandidateFilters {
  search?:        string
  decision?:      FinalDecision
  relevanceBand?: 'Strong' | 'Moderate' | 'Weak'
  sourceKind?:    'Library' | 'Web'
  database?:      string
  textState?:     SourceType
  page?:          number
  pageSize?:      number
}

// ── Sprint 2: Chapter Writer ──────────────────────────────────────────────────

export type SectionStatus = 'NotStarted' | 'Generating' | 'Draft' | 'Edited' | 'Approved'

export interface ProjectSection {
  code:         string        // "1.0", "2.0", etc.
  title:        string
  order:        number
  content:      string
  status:       SectionStatus
  wordCount:    number
  generatedAt:  string | null
  lastEditedAt: string | null
  // True while this section's claim-support citation check (OpenAlex + Claude comparison) hasn't
  // finished yet for the current content — the deterministic checks (unresolved citations,
  // bibliographic detail corrections) have already run and are reflected in `content`/citation
  // flags by the time this is ever returned; claim/journal/author mismatches may still land a
  // few seconds later. Bounded server-side to a ~15min window past generation, so this never gets
  // stuck showing "pending" forever.
  citationsPendingVerification: boolean
  // Set when a background generation run fails after this section already flipped to
  // Generating — generate/regenerate now return as soon as the run is enqueued, long before a
  // failure could happen, so this (surfaced via the sections poll) is the only way the student
  // learns why it reverted to NotStarted. Null otherwise.
  generationError: string | null
}

// Only 'LlmJudged' issues (the validators' own coherence/quality criteria) are eligible for
// "Apply fix" — the other sources are folded into the same list but already have their own
// dedicated remediation path (FactConflictsPanel, inline citation caution indicators, the
// Literature panel) that a blind section rewrite would bypass or duplicate.
export type IssueSource = 'LlmJudged' | 'FactConflict' | 'CitationMismatch' | 'OrphanedCitation' | 'UnderReferencing'

export interface AlignmentIssue {
  sectionCode:         string
  issue:               string
  suggestion:          string
  source:              IssueSource
  // Other real sections this issue also concerns — context only, never its own "Apply fix"
  // target. Absent/undefined for a single-section issue.
  relatedSectionCodes?: string[]
}

export interface AlignmentValidationResult {
  isValid:             boolean
  message:             string
  issues:              AlignmentIssue[]
  traceabilityMatrix?: TraceabilityEntry[]
}

// "Apply fix" preview — the corrected section content proposed for a group of a section's own
// LlmJudged issues, not yet saved. See api/research.ts applySectionFix/confirmSectionFix.
export interface SectionFixPreview {
  sectionCode:     string
  originalContent: string
  proposedContent: string
}

// ── Sprint 3: Hypotheses & Analysis Plan ─────────────────────────────────────

export type HypothesisOutcome = 'Pending' | 'Supported' | 'Refuted' | 'Inconclusive'

export interface ProjectHypothesis {
  id:                    string
  number:                number
  nullHypothesis:        string
  alternativeHypothesis: string
  dependentVariable:     string
  independentVariable:   string
  plannedStatisticalTest: string
  significanceLevel:     string
  outcome:               HypothesisOutcome
  linkedRqNumber:        number | null
  linkedObjectiveNumber: number | null
  outcomeStatistic?:     string | null   // Sprint 5: e.g. "t(198) = 3.42, p = 0.001"
  outcomeNarrative?:     string | null   // Sprint 5: plain-language result summary
}

export interface ProjectAnalysisPlan {
  id:                   string
  displayOrder:         number
  objectiveText:        string
  descriptiveApproach:  string
  inferentialTest:      string
  variablesInvolved:    string
  softwarePackage:      string
  prebuiltAnalystQuery: string
  sentToAnalyst:        boolean
}

export interface TraceabilityEntry {
  rqNumber:         number
  objectiveNumber:  number
  hypothesisNumber: number | null
  isAligned:        boolean
  issue:            string | null
}

export interface UpdateHypothesisPayload {
  nullHypothesis?:        string
  alternativeHypothesis?: string
  dependentVariable?:     string
  independentVariable?:   string
  plannedStatisticalTest?: string
  significanceLevel?:     string
  linkedRqNumber?:        number
  linkedObjectiveNumber?: number
  outcomeStatistic?:      string   // Sprint 5
  outcomeNarrative?:      string   // Sprint 5
  outcome?:               string   // Sprint 5: "Supported" | "Refuted" | "Inconclusive"
}

// ── Literature ────────────────────────────────────────────────────────────────

export interface FetchedLiterature {
  title:             string
  authors:           string
  year:              number
  doi?:              string
  abstract?:         string
  url?:              string
  harvardCitation:   string
  apaCitation:       string
  source:            string
  includedByStudent: boolean
}

// ── Citation integrity verification ───────────────────────────────────────────

export type CitationMismatchType =
  | 'ClaimContentMismatch' | 'JournalMismatch' | 'AuthorMismatch'
  | 'VenueMismatch' | 'UnresolvedCitation' | 'MissingSourceData'
  | 'OverusedInSection' | 'ClaimPartialMatch'

export type CitationFlagStatus = 'Open' | 'AutoCorrected' | 'Dismissed' | 'Removed'

export interface CitationFlag {
  id:                    string
  sectionCode:           string
  doi:                   string
  citationRawText:       string
  claimSentence:         string
  mismatchTypes:         CitationMismatchType[]
  confidence:            number
  actualJournal?:        string
  actualAuthors?:        string
  actualAbstractExcerpt?: string
  storedJournal?:        string
  llmReasoning?:         string
  status:                CitationFlagStatus
  createdAt:             string
}

// ── Facts registry / cross-section consistency ────────────────────────────────

export type FactConflictStatus = 'Open' | 'ResolvedAcceptedNew' | 'Dismissed'

export interface FactConflict {
  id:                         string
  factKey:                    string
  conflictingSectionCode:     string
  conflictingValue:           string
  conflictingExcerpt:         string
  canonicalValue:             string
  canonicalSourceSectionCode: string
  status:                     FactConflictStatus
  createdAt:                  string
}

// ── Thesis Studio: external-upload fact review ─────────────────────────────────

export interface ExternalFact {
  factKey: string
  value:   string
  excerpt: string
  locked:  boolean
}

// ── Sprint 5: Thesis chapters, defence preparation ────────────────────────────

export interface ExaminerQuestion {
  category:          string   // Methodology | Results | Discussion | Literature | Theory | General
  difficulty:        'basic' | 'moderate' | 'challenging'
  question:          string
  whyAsked:          string
  suggestedResponse: string
}

export interface ChecklistItem {
  category: string   // Preparation | Knowledge | Logistics | Documents
  item:     string
  detail:   string
  checked?: boolean
}

export interface DefencePreparation {
  projectId:            string
  examinerQuestions:    ExaminerQuestion[]
  vivaOpeningStatement: string
  checklist:            ChecklistItem[]
  generatedAt:          string
}

// ── Thesis Studio: audit-gated transition to thesis ───────────────────────────

export type RubricScoreLevel = 'weak' | 'developing' | 'strong'

export interface RubricScore {
  score:    RubricScoreLevel
  evidence: string
}

export interface RubricScores {
  scope:                    RubricScore
  methodologicalAlignment:  RubricScore
  writingClarity:           RubricScore
  citationRigor:             RubricScore
  limitationsMaturity:       RubricScore
}

export interface RoadmapPhase {
  label: string
  steps: string[]
}

export interface ThesisRoadmap {
  phase1: RoadmapPhase
  phase2: RoadmapPhase
  phase3: RoadmapPhase
}

export interface UnlockCondition {
  blockingQuestions: string[]
  unlocksStep:       string
}

export interface ThesisAuditResult {
  narrative:       string
  rubricScores:    RubricScores
  unresolvedFlags: string[]
  roadmap:         ThesisRoadmap
  unlockCondition: UnlockCondition
}

export interface UploadExternalProposalResult {
  project:           ResearchProject
  extractedFactKeys: string[]
}

export interface ExternalProposalJobResult {
  jobId:   string
  status:  'pending' | 'running' | 'complete' | 'error'
  error?:  string
  result?: UploadExternalProposalResult
}

export interface LiteratureCsvImportResult {
  imported:  number
  skipped:   number
  totalRows: number
}

// ── Research Roadmap ───────────────────────────────────────────────────────────

export type MilestoneStatus = 'NotStarted' | 'InProgress' | 'Complete' | 'Skipped'

export interface ResearchMilestone {
  key:           string
  label:         string
  displayOrder:  number
  isRequired:    boolean
  isAutoTracked: boolean
  status:        MilestoneStatus
  completedAt:   string | null
  notes:         string | null
}

export interface ResearchRoadmap {
  milestones:      ResearchMilestone[]
  progressPercent: number
  completedCount:  number
  requiredCount:   number
}

// ── Readiness Engine ───────────────────────────────────────────────────────────

export type CheckStatus = 'Pass' | 'Warning' | 'Fail' | 'NotApplicable'

export interface ReadinessCriterionResult {
  key:              string
  label:            string
  checkType:        'Structural' | 'Qualitative'
  status:           CheckStatus
  message:          string | null
  weight:           number
  contributedScore: number
}

export interface ReadinessEvaluation {
  targetType:  string
  targetId:    string
  score:       number
  isReady:     boolean
  criteria:    ReadinessCriterionResult[]
  evaluatedAt: string
}

// ── Knowledge Graph ────────────────────────────────────────────────────────────

export interface GraphNode {
  id:            string
  nodeType:      string
  entityType:    string
  entityId:      string
  labelSnapshot: string
}

export interface GraphGap {
  node: GraphNode
}

// ── Validation Engine ──────────────────────────────────────────────────────────

export interface ValidationResult {
  checkKey:        string
  checkType:       'Structural' | 'Relational'
  subjectType:     string
  subjectId:       string
  subjectOrdinal:  number | null
  relatedType:     string | null
  relatedId:       string | null
  status:          CheckStatus
  message:         string
  recommendation:  string | null
  evaluatedAt:     string
}

export interface ValidationSummary {
  fails:    ValidationResult[]
  warnings: ValidationResult[]
  passes:   ValidationResult[]
}

// ── Methodology-anchor citations ────────────────────────────────────────────────
// Ambiguous foundational-literature matches flagged for manual student review — see
// MethodologyAnchorResolver / MethodologyAnchorFetchJob on the backend.

export interface MethodologyAnchorCandidate {
  id:           string
  sectionCode:  string
  query:        string
  title:        string
  authors:      string
  year:         number
  journal:      string | null
  doi:          string | null
  abstract:     string
  confidence:   number
  llmReasoning: string
  status:       'Pending' | 'Accepted' | 'Rejected'
}
