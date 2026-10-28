export type AcademicLevel  = 'UNDERGRADUATE' | 'MASTERS' | 'PHD'
export type CitationStyle  = 'apa7' | 'harvard' | 'mla' | 'ieee'
export type DocumentMode   = 'PROPOSAL' | 'DISSERTATION'
export type GeneratorMode  = 'GENERATOR' | 'AGENT'
export type GatherMode     = 'documents' | 'web' | 'hybrid'

// ── Autonomous generation (AI Thesis) ────────────────────────────────────────
// Server-driven — persisted on the project row and polled, so progress survives
// a closed tab/refresh. Mirrors HumaniseAI.Application.DTOs.Research.GenerationStatusDto.

export type GenerationPhase = 'NotStarted' | 'Starting' | 'Generating' | 'Completed' | 'Cancelled' | 'Error' | 'NeedsReview'

export interface GenerationStatus {
  runStartedAt?: string | null
  phaseStartedAt?: string | null
  runPhase?: string | null
  lastActivity?: string | null
  heartbeatAt?: string | null
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
  generation?:    GenerationStatus
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
  researchState?:  string  // Thesis Foundation (Phase 1) — see ResearchState in this file
  universityTemplateId?: string | null
  // docs/OPEN_ITEMS.md #81 — null means methodologyType/methodologySubType above are still just
  // free-editing scratch values (Setup autosave, AI recommendation pre-fill, external-upload
  // extraction pre-fill) that have never been explicitly confirmed. Only present when the caller
  // (get/list) included it — never infer "confirmed" from methodologyType being non-empty.
  confirmedMethodology?: MethodologyProfile | null
}

// docs/OPEN_ITEMS.md #81 — the canonical, versioned methodology record. See
// ResearchService.ConfirmMethodologyAsync / MethodologyProfileDto.
export interface MethodologyProfile {
  methodologyType:        string
  methodologySubType:     string
  researchDesign:         string
  timeHorizon:             string
  dataCollectionApproach: string
  dataAnalysisApproach:   string
  version:                number
  confirmedAtUtc:         string
}

export interface ConfirmMethodologyPayload {
  methodologyType:         string
  methodologySubType?:     string
  researchDesign?:         string
  timeHorizon?:            string
  dataCollectionApproach?: string
  dataAnalysisApproach?:   string
}

export interface MethodologyChangeImpact {
  isGenuineChange:              boolean
  affectedApprovedSectionCodes: string[]
  affectedDraftSectionCodes:    string[]
}

// Mirrors MethodologyViolationDto — a single flagged passage from the deterministic or
// AI-semantic methodology consistency check, returned in the METHODOLOGY_VIOLATION error's
// `details.violations`.
export interface MethodologyViolation {
  sectionCode:          string
  quote:                string
  expectedMethodology:  string
  ruleCode:             string
  severity:             'Blocking' | 'Advisory'
  explanation:          string
  suggestedCorrection:  string
}

// ── Literature Discovery (Gather step's second tab) ──────────────────────────

export interface LiteratureDimension {
  id:       string
  name:     string
  keywords: string
  enabled:  boolean
}

// Structured topic decomposition — feeds ranking (LiteratureTopicMatcher on the backend) and
// geography-aware query wording. Geography/population/methodology default to empty when not
// applicable to the topic (e.g. a purely theoretical topic has no geography) — this is a signal
// being excluded, not a miss to display as an empty/incomplete state.
export interface TopicScope {
  primaryConcepts: string[]
  relationship:    string
  population:      string[]
  setting:         string[]
  geography:       string[]
  studyType:       string
  methodology:     string
  synonyms:        Record<string, string[]>
  // Named official survey/dataset (e.g. "SADHS", "DHS", "NHANES") detected in the topic — see
  // TopicScopeDto.DatasetTerms on the backend. Empty when the topic doesn't name a recognized survey.
  datasetTerms:    string[]
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
  topicScope:   TopicScope
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
  // Deterministic weighted-signal score (0-100), available immediately after Discovery, before
  // Screening's own Claude judgement (screeningRelevanceScore) exists — see LiteratureTopicMatcher.
  topicMatchScore:         number
  matchedConcepts:         string[]
  matchedPopulation:       string[]
  matchedGeography:        string[]
}

export interface ScreeningCandidateList {
  items:      ScreeningCandidate[]
  totalCount: number
  page:       number
  pageSize:   number
}

// ── Diversified "best matches" shortlist ────────────────────────────────────────

export interface ShortlistBucket {
  label:   string
  reason:  string
  items:   ScreeningCandidate[]
}

export interface DiversifiedShortlist {
  buckets: ShortlistBucket[]
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
  code:         string        // "1.0", "2.0", etc. — real identifier, always use for API calls
  // Reader-facing chapter label — usually equal to `code`, but diverges for proposal-stage
  // administrative sections (Timeline/Budget/Dissemination) relocated to an appendix once the
  // project transitions to Thesis/Dissertation, so they no longer collide with the real thesis
  // chapter numbering (e.g. "6.0 Results"). Always render this, never `code`, for the visible
  // chapter number/heading. See OPEN_ITEMS.md #20.
  displayCode:  string
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
  hasUnusedMethodologyAnchor: boolean
  isUnderReferenced: boolean
  citationTarget: number
  resolvedCitationCount: number
  citationShortfallRetryAttempted: boolean
  citationTargetResolution: 'exempt' | 'met' | 'flagged' | 'blocked'
  // docs/OPEN_ITEMS.md #42 piece (b) — non-null only for a hardcoded, temporary set of known
  // (project, section) pairs confirmed to carry a fabricated mixed-methods design description
  // from before the sub-type-aware prompt fix shipped. Null for every other section/project.
  methodologyReviewAdvisory: string | null
  // docs/OPEN_ITEMS.md #48 Part C — true when this "6.0"/"7.0" section was Approved under
  // AnalysisCompleted/CompletedResearch and the project's Research State has since moved back
  // below that tier. Approval status itself is untouched; only a re-review nudge.
  requiresReReview: boolean
  reReviewReason: string | null
  // docs/OPEN_ITEMS.md #81 — false only when the confirmed methodology structurally excludes this
  // section (e.g. "4.4" Hypotheses for a Qualitative study). True (including when no methodology
  // is confirmed yet) means applicable — this is a hide/explain signal only, not a substitute for
  // the METHODOLOGY_NOT_CONFIRMED generation/approval gate.
  isApplicableForMethodology: boolean
  notApplicableReason: string | null
  // True when this section's approved/drafted content was generated against a methodology version
  // the project has since moved past (a genuine Confirm-Methodology change) and needs re-review.
  isMethodologyStale: boolean
  methodologyStaleReason: string | null
}

// 'LlmJudged' issues (the validators' own coherence/quality criteria) and 'ReviewerFinding'
// issues (a Document Reviewer finding routed here via ReviewFindingSectionLocator — see
// api/reviewer.ts) are eligible for "Apply fix" — the other sources are folded into the same
// list but already have their own dedicated remediation path (FactConflictsPanel, inline
// citation caution indicators, the Literature panel) that a blind section rewrite would bypass
// or duplicate.
export type IssueSource =
  | 'LlmJudged' | 'FactConflict' | 'CitationMismatch' | 'OrphanedCitation' | 'UnderReferencing'
  | 'ReviewerFinding'

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
  assessmentStatus?: 'Completed' | 'Unknown'
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
  id:                string
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
  citationCount:     number
  citedInSections:   string[]
}

export interface UnresolvedCitation {
  rawText:         string
  occurrenceCount: number
  sections:        string[]
}

export interface LiteratureCitationSummary {
  resolvedOccurrenceCount:   number
  resolvedDistinctSourceCount: number
  unresolvedOccurrenceCount: number
  unresolvedCitations:       UnresolvedCitation[]
}

export type DashboardLiteratureFilter = 'all' | 'cited' | 'unresolved' | 'prioritised' | 'available' | 'excluded'

export interface DashboardLiteratureCard {
  id: string
  title: string
  authors: string
  year: number
  doi?: string
  source: string
  includedByStudent: boolean
  citationCount: number
  citedInSections: string[]
}

export interface DashboardLiteratureCounts {
  all: number
  cited: number
  unresolved: number
  prioritised: number
  available: number
  excluded: number
}

export interface DashboardLiteraturePage {
  items: DashboardLiteratureCard[]
  page: number
  pageSize: number
  totalCount: number
  matchingCount: number
  counts: DashboardLiteratureCounts
  citationIndexStatus: 'Ready' | 'Pending' | 'Stale'
  citationIndexMessage?: string
  unresolvedCitations: UnresolvedCitation[]
}

// ── Citation integrity verification ───────────────────────────────────────────

export type CitationMismatchType =
  | 'ClaimContentMismatch' | 'JournalMismatch' | 'AuthorMismatch'
  | 'VenueMismatch' | 'UnresolvedCitation' | 'MissingSourceData'
  | 'OverusedInSection' | 'ClaimPartialMatch' | 'ImplausibleYear'
  | 'UnresolvedGapMarker' | 'OrphanedReference'
  | 'BibliographicDetailMismatch' | 'TemporallyImpossibleSource'
  | 'GeographicMismatch' | 'GeneralizationBeyondSample' | 'PopulationScopeViolation'
  // A parenthetical shaped like a Harvard reference-LIST line ("Author (Year) 'Title'...") that
  // leaked into prose text with no author before the paren — not an unresolved in-text citation,
  // but a reference-list line with no prose around it (see ResearchService.ExtractAndResolveCitations'
  // harvard/apa7 branch; 2026-08 remediation of the "3.1 Problem Statement" defect).
  | 'MalformedCitationShape'
  // Several project papers share this citation's first author and year and the section's reference list
  // did not name one by DOI, so list order chose. Advisory only; answered with chooseCitationSource.
  | 'AmbiguousCitation'

export type CitationFlagStatus = 'Open' | 'AutoCorrected' | 'Dismissed' | 'Removed' | 'Superseded'
export type CitationFixAction = 'RewriteClaim' | 'ReplaceCitation' | 'MarkResearcherProposed'

// Null/undefined for flag types with no abstract-vs-full-text judgement at all (e.g.
// UnresolvedCitation) — Dismiss stays available for those. Otherwise Dismiss requires
// 'RelevantFullText'; 'MetadataOnly'/'Abstract' means the verdict was only checked against the
// abstract, which the backend also enforces (DismissCitationFlagAsync rejects it either way).
export type EvidenceCoverage = 'MetadataOnly' | 'Abstract' | 'RelevantFullText'

/**
 * An advisory review note raised by a section-quality check. It never blocks approval or export and
 * never changes the text; `message` already names the passage it is about.
 */
export interface QualityFlag {
  id:          string
  sectionCode: string
  code:        string
  severity:    'warning'
  message:     string
  dismissed:   boolean
  createdAt:   string
}

export interface CitationFlag {
  id:                    string
  sectionCode:           string
  literatureId?:         string
  doi:                   string
  sourceTitle?:           string
  sourceAuthors?:         string
  sourceYear?:            number
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
  dismissedReason?:      string
  coverage?:             EvidenceCoverage
  // Which repair actions can actually resolve THIS flag. Optional so a cached/older response still
  // renders — treat a missing list as "all available", which is the pre-2026-09-04 behaviour.
  fixActions?:           CitationFixOption[]
}

// `reason` is null exactly when `available` — it explains why the action cannot resolve this flag,
// and is surfaced as the disabled control's tooltip. Same posture as the `coverage` Dismiss gate:
// an affordance, not the guard. The backend rejects every unavailable combination independently.
export interface CitationFixOption {
  action:    CitationFixAction
  available: boolean
  reason?:   string
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
  // Thesis Foundation (Phase 1)
  currentResearchState:   string
  misalignedRequirements: string[]
  // Business-rules audit Phase 2 (2026-08-28) — a hypothesis whose recorded outcome implies real
  // analysis ran, but whose planned test family never appears in the project's real analysis
  // results. Same flag-only posture as misalignedRequirements; not yet surfaced in any UI.
  testTypeMismatches: string[]
}

// ── Thesis Foundation (Phase 1) ──────────────────────────────────────────────

// Mirrors HumaniseAI.Domain.Entities.ResearchState — most values are a free self-declaration;
// AnalysisCompleted is server-verified against a linked, actually-completed Data Analyst session.
export type ResearchState =
  | 'Proposal' | 'StudyDesigned' | 'DataCollection' | 'DataAvailable'
  | 'AnalysisCompleted' | 'CompletedResearch' | 'LiteratureOnly'

export const RESEARCH_STATE_OPTIONS: { value: ResearchState; label: string; description: string }[] = [
  { value: 'Proposal',          label: 'Proposal',              description: 'Still planning the study — no data collection has started.' },
  { value: 'StudyDesigned',     label: 'Study Designed',         description: 'Methodology and instruments are finalised; data collection has not started.' },
  { value: 'DataCollection',    label: 'Data Collection',        description: 'Actively collecting data.' },
  { value: 'DataAvailable',     label: 'Data Available',         description: 'Data collection is complete; analysis has not started or is in progress.' },
  { value: 'AnalysisCompleted', label: 'Analysis Completed',     description: 'Analysis is verified complete — requires a linked, completed Data Analyst session.' },
  { value: 'CompletedResearch', label: 'Completed Research',     description: 'The full study, including analysis, is complete.' },
  { value: 'LiteratureOnly',    label: 'Literature-Only Thesis', description: 'A theoretical/literature-based thesis with no empirical data collection.' },
]

export interface ProjectDataset {
  datasetId:      string
  fileName:       string
  rowCount:       number
  columnCount:    number
  fileSizeBytes:  number
  uploadedAt:     string
  isLinked:       boolean
  analysisStatus: 'not-started' | 'in-progress' | 'complete'
  completedSessionId?: string | null
}

export interface ResearchQuestionSnapshot {
  number:                 number
  questionText:           string
  linkedObjectiveNumber:  number | null
}

export interface ObjectiveSnapshot {
  number:         number
  objectiveType:  string
  objectiveText:  string
  linkedRqNumber: number | null
}

export interface CanonicalResearchPlan {
  id:                       string
  version:                  number
  titleSnapshot:            string
  researchQuestions:        ResearchQuestionSnapshot[]
  objectives:               ObjectiveSnapshot[]
  studyDesignSnapshot:      string
  samplingStrategySnapshot: string
  methodologyType:          string
  methodologySubType:       string
  createdReason:            string
  createdAt:                string
}

export interface ThesisChapterPlanEntry {
  sectionCode:      string
  title:            string
  displayOrder:     number
  status:           ProjectSection['status']
  currentWordCount: number
  targetWordCount:  number | null
  locked:           boolean
  lockedReason:     string | null
}

export interface ThesisChapterPlan {
  researchState: string
  chapters:      ThesisChapterPlanEntry[]
}

export interface UniversityTemplateSummary {
  id:             string
  name:           string
  isIllustrative: boolean
  citationStyle:  string
  sectionCount:   number
}

export interface UniversityTemplateSectionEntry {
  sectionCode:     string
  title:           string
  displayOrder:    number
  targetWordCount: number
  isRequired:      boolean
  category:        'Core' | 'WizardOnly' | 'Thesis'
}

// Thesis Foundation (Phase 2) — section content version history.
export interface ProjectSectionVersion {
  id:            string
  versionNumber: number
  content:       string
  changeOrigin:  string  // Generated | Regenerated | StudentEdited | Restored | ImportedFromProposal
  wordCount:     number
  createdAt:     string
}

// Thesis Foundation (Phase 2), Step 2 — proposal-to-thesis content mapping.
export interface ProposalThesisSectionMapping {
  sectionCode:        string
  chapterLabel:        string
  title:               string
  classification:      string  // ReusableUnchanged | ReusableWithExpansion | RequiresUpdating | Contradictory | Obsolete | Missing
  reason:              string
  requiredUpdates:     string[]
  detectedConflicts:   string[]
}

export interface ProposalThesisMappingResult {
  sections: ProposalThesisSectionMapping[]
}

// Thesis Foundation (Phase 2), Step 4 — post-generation, advisory evidence-coverage audit.
export interface EvidenceClaimCoverage {
  claim:                   string
  recommendedSourceCount:  number
  isShortfall:             boolean
}

export interface OffPlanCitation {
  citationText:    string
  literatureTitle: string
  literatureId:    string
}

export interface SectionEvidenceCoverageAudit {
  sectionCode:         string
  claimCoverage:       EvidenceClaimCoverage[]
  offPlanCitations:    OffPlanCitation[]
  hasShortfalls:       boolean
  hasOffPlanCitations: boolean
}

export interface UniversityTemplateDetail {
  id:                     string
  name:                   string
  isIllustrative:         boolean
  citationStyle:          string
  ethicsApprovalBody:     string | null
  ethicsGuidanceOverride: string | null
  notes:                  string | null
  sections:               UniversityTemplateSectionEntry[]
  createdAt:              string
  updatedAt:              string
}

export interface UploadExternalProposalResult {
  project:           ResearchProject
  extractedFactKeys: string[]
  advisoryMessages:  string[]
  review?: {
    format: 'pdf' | 'docx'
    hasTrackedChanges: boolean
    hasComments: boolean
    matchedSectionCodes: string[]
    unverifiedHeadings: Array<{ text: string; level: number; confidence: number; needsConfirmation: boolean }>
    citationsPendingVerification: string[]
  }
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

// ── Instrument Designer ────────────────────────────────────────────────────────

export type InstrumentType = 'InterviewGuide' | 'Questionnaire' | 'ObservationChecklist' | 'FocusGroupGuide'
export type InstrumentStatus = 'Draft' | 'Approved'
export type InstrumentSource = 'AiGenerated' | 'Imported' | 'ManuallyEntered'

export interface InstrumentSummary {
  id:             string
  instrumentType: InstrumentType
  title:          string
  status:         InstrumentStatus
  source:         InstrumentSource
  itemCount:      number
  createdAt:      string
  approvedAt:     string | null
  hasStoredFile:  boolean
}

export interface InstrumentItemDetail {
  id:             string
  orderIndex:     number
  text:           string
  responseFormat: string
}

export interface ResearchQuestionGroup {
  number:       number
  questionText: string
  items:        InstrumentItemDetail[]
}

export interface InstrumentDetail {
  id:              string
  instrumentType:  InstrumentType
  title:           string
  status:          InstrumentStatus
  source:          InstrumentSource
  content:         string | null
  fileName:        string | null
  researchQuestions: ResearchQuestionGroup[]
  createdAt:       string
  approvedAt:      string | null
  hasStoredFile:   boolean
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
  // The chapter SectionCode this result actually concerns, resolved server-side from relatedId
  // (falling back to subjectId) — see ValidationService.ToDto. Null for project-level checks not
  // tied to one specific section (e.g. sample_size_adequate).
  sectionCode:     string | null
}

export interface ValidationSummary {
  fails:    ValidationResult[]
  warnings: ValidationResult[]
  passes:   ValidationResult[]
  lastValidatedAt?: string
  freshness: 'NotValidated' | 'OutOfDate' | 'Current'
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

export type EthicsDataCollectionMethod =
  | 'Interview' | 'Survey' | 'FocusGroup' | 'Experiment'
  | 'Observation' | 'SecondaryData' | 'Other'

export type EthicsDocumentStatus =
  | 'NotApplicable' | 'Required' | 'Drafted' | 'UnderReview' | 'Approved'

export interface MethodologyClassification {
  dataCollectionMethods: EthicsDataCollectionMethod[]
  involvesVulnerablePopulation: boolean
  participantsIdentifiable: boolean
  involvesSensitiveTopics: boolean
  isConfirmedByStudent: boolean
  isStale: boolean
  classifiedAt: string
}

export interface EthicsDocument {
  documentType: string
  status: EthicsDocumentStatus
  content: string | null
  isStale: boolean
  draftedAt: string | null
}

export interface EthicsChecklist {
  classification: MethodologyClassification | null
  documents: EthicsDocument[]
}

export interface ConfirmMethodologyClassificationPayload {
  dataCollectionMethods: EthicsDataCollectionMethod[]
  involvesVulnerablePopulation: boolean
  participantsIdentifiable: boolean
  involvesSensitiveTopics: boolean
}

// ── Fix issues and download (pre-export repair) ───────────────────────────────

export type ProposalIssueSeverity = 'Blocking' | 'Warning'
export type ProposalRepairKind = 'Deterministic' | 'ConstrainedLlm' | 'HumanRequired'

export interface ProposalIssue {
  type: string
  severity: ProposalIssueSeverity
  sectionKey: string
  evidence: string
  repairKind: ProposalRepairKind
  message: string
  start?: number | null
  length?: number | null
  /** Set when the issue is about one specific project source (a citation that matches a source stored without a year). */
  literatureId?: string | null
}

export interface ProposalIssues {
  issues: ProposalIssue[]
  blockingCount: number
  repairsAvailable: boolean
  repairsUnavailableReason: string | null
}

export interface RepairedItem {
  repairId: string
  issueType: string
  sectionKey: string
  description: string
  before: string
  after: string
  undone: boolean
}

export interface RepairReport {
  runId: string
  createdAt: string
  fixed: RepairedItem[]
  needsUser: Array<{ issue: ProposalIssue; reason: string }>
  unchangedSections: string[]
  passes: number
  blockingRemaining: number
  skipped: boolean
  skippedReason: string | null
}

// ── Structured bibliography (GET /research/projects/{id}/bibliography) ─────────
// Numbering is presentation, not contract: entries carry the source they came from and the
// formatted text, and the client never infers anything from a "1." prefix.
export type BibliographyStatus = 'no_sections' | 'no_citations' | 'needs_review' | 'ready'

export interface BibliographyEntry {
  sourceId:      string
  formattedText: string
}

export interface BibliographyUnresolvedCitation {
  sectionCode:  string
  citationText: string
  reason:       'no_match' | 'ambiguous' | 'malformed'
}

export interface BibliographyDiagnostics {
  draftedSections:     number
  eligibleSources:     number
  citationOccurrences: number
  resolvedOccurrences: number
  distinctEntries:     number
}

export interface BibliographyResult {
  status:              BibliographyStatus
  entries:             BibliographyEntry[]
  unresolvedCitations: BibliographyUnresolvedCitation[]
  diagnostics:         BibliographyDiagnostics
  revision:            string
}
