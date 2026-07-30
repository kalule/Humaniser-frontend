export type SystematicReviewStatus = 'Draft' | 'InProgress' | 'Completed'
export type ReviewCreationPath = 'PrismaFirst' | 'DatabaseSearch' | 'UploadOwn'

export interface SystematicReview {
  id:               string
  researchQuestion: string | null
  status:           SystematicReviewStatus
  creationPath:     ReviewCreationPath
  paperCount:       number
  createdAt:        string
  updatedAt:        string
}

// ── Eligibility Criteria step ────────────────────────────────────────────────

export type CriterionType   = 'Population' | 'Intervention' | 'Comparator' | 'Outcome' | 'StudyDesign' | 'Custom'
export type SearchStringUse = 'ScreeningOnly' | 'DatabaseFilter'

export interface EligibilityCriterion {
  id:              string
  type:            CriterionType
  name:            string
  description:     string
  include:         string | null
  exclude:         string | null
  searchStringUse: SearchStringUse
  sortOrder:       number
  createdAt:       string
}

export interface ReviewProtocol {
  databasesSearched: string[]
  dateRangeStart:    string | null
  dateRangeEnd:      string | null
  minCitations:      number
  abstractRequired:  boolean
}

export interface SystematicReviewDetail extends SystematicReview {
  protocol:                 ReviewProtocol
  criteria:                 EligibilityCriterion[]
  searchStrings:            SearchStringItem[]
  latestDedupeRun:          DedupeRun | null
  screeningSummary:         ScreeningSummary | null
  fullTextScreeningSummary: ScreeningSummary | null
  extractionVariables:      ExtractionVariable[]
  extractionSummary:        ExtractionSummary | null
  extractionSkipped:        boolean
  riskOfBiasSummary:        RiskOfBiasSummary | null
  riskOfBiasSkipped:        boolean
  evidenceGradingSummary:   EvidenceGradingSummary | null
  evidenceGradingSkipped:   boolean
  manuscript:               Manuscript | null
  // stepId -> ISO timestamp a reviewer last confirmed that step — informational, never gates "Next".
  checkpoints:              Record<string, string>
  riskOfBiasTool:           RiskOfBiasTool
}

export interface SuggestedCriterion {
  type:        CriterionType
  name:        string
  description: string
  include:     string | null
  exclude:     string | null
}

// Recorded only once a search has already been executed — PROSPERO-style amendment log.
// Never blocks an edit; purely observational (see SystematicReviewService.RecordAmendmentAsync).
export interface ProtocolAmendment {
  id:        string
  field:     string
  oldValue:  string | null
  newValue:  string | null
  changedAt: string
}

// ── Form Search Strings step ─────────────────────────────────────────────────
// Search strings are independent, user-manageable query blocks belonging to the
// review — not bound to a specific source. Source execution happens later, in
// the Fetch Papers step.

export interface SearchStringItem {
  id:           string
  terms:        string[]
  queryText:    string
  isUserEdited: boolean
  isValid:      boolean
  sortOrder:    number
  createdAt:    string
}

// Archived by "Regenerate with AI" just before it replaces the live SearchString rows — preserves
// the literal query and fetch count for PRISMA search-strategy reproducibility.
export interface SearchStringHistoryItem {
  id:                string
  queryText:         string
  terms:             string[]
  fetchedPaperCount: number
  archivedAt:        string
}

// ── Fetch Papers step ────────────────────────────────────────────────────────

export interface FetchedPaper {
  id: string
  title: string
  authors: string
  publicationDate: string
  journal: string
  doi: string
  source: string
  typeBadge: string
  citations: number
  abstract: string
  searchStringId: string
  isLibrary: boolean
}

export interface FetchStatus {
  isFetching: boolean
  fetchedQueries: string[] // IDs of search strings that have been fetched
  sourceCounts: Record<string, number>
  totalFetched: number
  truncatedSources: string[] // sources that hit the per-query result cap — recall may be incomplete
}

export interface PaginatedPapers {
  items: FetchedPaper[]
  total: number
  page: number
  pageSize: number
}

// ── Deduplication & mechanical filters step ──────────────────────────────────
// Filter fields themselves (min citations, abstract required, date range) are NOT
// duplicated here — they live on ReviewProtocol, edited via updateProtocol from both this
// step and the Eligibility Criteria step's Selection Filters panel. DedupeRun does carry a
// read-only *snapshot* of the filter values that produced it (filter*), so the UI can detect
// "filters changed since this run" even after a page reload, without trusting client memory.

export interface DedupeRun {
  id:                          string
  fetchedRecordCount:          number
  duplicatesRemovedByDoi:      number
  duplicatesRemovedByTitle:    number
  excludedWithoutAbstract:     number
  excludedByPublicationDate:   number
  excludedByCitationThreshold: number
  readyForScreeningCount:      number
  filterDateRangeStart:        string | null
  filterDateRangeEnd:          string | null
  filterMinCitations:          number
  filterAbstractRequired:      boolean
  runAt:                       string
}

// ── Title & abstract screening step ──────────────────────────────────────────
// A paper's overall decision is derived from its per-criterion verdicts on the
// backend, never set directly — see SystematicReviewService.ComputeOverall.

export type ScreeningVerdict = 'Pending' | 'Match' | 'NoMatch' | 'Uncertain'
export type OverallScreeningDecision = 'Pending' | 'Included' | 'Excluded' | 'NeedsManualReview'

export interface EvidenceSpan {
  id:       string
  quote:    string
  location: string | null
}

export interface ScreeningDecision {
  id:               string
  criterionId:      string
  criterionName:    string
  verdict:          ScreeningVerdict
  aiRationale:      string | null
  isManualOverride: boolean
  evidenceSpans:    EvidenceSpan[]
  aiModel?:         string | null
  promptVersion?:   string | null
}

export interface ScreeningRecord {
  paperId:         string
  title:           string
  authors:         string
  publicationDate: string
  journal:         string
  doi:             string
  source:          string
  typeBadge:       string
  citations:       number
  abstract:        string
  overall:         OverallScreeningDecision
  decisions:       ScreeningDecision[]
}

export interface ScreeningSummary {
  total:             number
  pending:           number
  included:          number
  excluded:          number
  needsManualReview: number
  manual:            number
}

export interface PaginatedScreening {
  items:    ScreeningRecord[]
  total:    number
  page:     number
  pageSize: number
  summary:  ScreeningSummary
}

export interface ScreeningRunStatus {
  isRunning: boolean
  done:      number
  total:     number
}

// ── Screening agreement check (dual-reviewer QA overlay) ────────────────────
// An independent second AI pass over already-screened Title & Abstract decisions, run on
// demand purely to measure inter-rater agreement (Cohen's kappa) — it never changes a
// decision's actual verdict. Disagreements surface here for manual reconciliation via the
// existing per-cell override already used elsewhere on this step.

export interface ScreeningAgreementRunStatus {
  isRunning: boolean
  done:      number
  total:     number
}

export interface ScreeningAgreementDisagreement {
  decisionId:          string
  paperId:             string
  paperTitle:          string
  criterionName:       string
  firstPassVerdict:    ScreeningVerdict
  secondPassVerdict:   ScreeningVerdict
  firstPassRationale:  string | null
  secondPassRationale: string | null
}

export interface ScreeningAgreementSummary {
  compared:         number
  agreements:       number
  disagreements:    number
  percentAgreement: number
  cohensKappa:      number | null
  disagreementList: ScreeningAgreementDisagreement[]
}

// ── Full text screening step ─────────────────────────────────────────────────
// Reuses ScreeningDecision/ScreeningVerdict from the title/abstract stage above — only the
// per-paper PDF-availability state and query/summary shapes are stage-specific.

export type FullTextStatus = 'PdfUnavailable' | 'PdfUploaded'
export type FullTextScreeningFilter = 'all' | 'needsPdf' | 'abstractOnly' | 'included' | 'excluded'

export interface FullTextScreeningRecord {
  paperId:             string
  title:               string
  authors:             string
  publicationDate:     string
  journal:             string
  doi:                 string
  source:              string
  typeBadge:           string
  citations:           number
  abstract:            string
  fullTextStatus:      FullTextStatus
  useAbstractFallback: boolean
  overall:             OverallScreeningDecision
  decisions:           ScreeningDecision[]
}

export interface FullTextScreeningSummary extends ScreeningSummary {
  needsPdf:     number
  abstractOnly: number
}

export interface PaginatedFullTextScreening {
  items:    FullTextScreeningRecord[]
  total:    number
  page:     number
  pageSize: number
  summary:  FullTextScreeningSummary
}

export interface FullTextScreeningRunStatus {
  isRunning: boolean
  done:      number
  total:     number
  skipped:   number
}

// ── Shared review-wide summary bar ───────────────────────────────────────────
// Meant to persist visually from this step through Data Extraction, Risk of Bias, Evidence
// Grading, and Write SLR — Extracted/Outcomes read 0 until those steps exist.

export interface ReviewSummary {
  retrieved: number
  ready:     number
  included:  number
  extracted: number
  outcomes:  number
}

// ── Data Extraction step ─────────────────────────────────────────────────────
// Operates over the same candidate paper set as Full Text Screening (Title/Abstract-Included,
// with usable text via an uploaded PDF or abstract fallback). ExtractionVariable is a
// user/AI-defined column; ExtractedValueItem is one (paper × variable) cell.

export interface ExtractionVariable {
  id:           string
  name:         string
  isAiSuggested: boolean
  isOutcome:    boolean
  sortOrder:    number
  createdAt:    string
}

export type ExtractionSourceType = 'Abstract' | 'FullText'

export interface ExtractedValueItem {
  id:               string
  variableId:       string
  value:            string | null
  sourceExcerpt:    string | null
  sourceType:       ExtractionSourceType
  isManualOverride: boolean
  attempted:        boolean
  aiModel?:         string | null
  promptVersion?:   string | null
}

export interface ExtractionRecord {
  paperId:             string
  title:               string
  authors:             string
  publicationDate:     string
  journal:             string
  doi:                 string
  source:              string
  typeBadge:           string
  citations:           number
  abstract:            string
  fullTextStatus:      FullTextStatus
  useAbstractFallback: boolean
  values:              ExtractedValueItem[]
}

export interface ExtractionSummary {
  total:        number
  extracted:    number
  needsPdf:     number
  abstractOnly: number
}

export type ExtractionFilter = 'all' | 'needsPdf' | 'abstractOnly'

export interface PaginatedExtraction {
  items:    ExtractionRecord[]
  total:    number
  page:     number
  pageSize: number
  summary:  ExtractionSummary
}

export interface ExtractionRunStatus {
  isRunning: boolean
  done:      number
  total:     number
  skipped:   number
}

// ── Risk of Bias Assessment step ─────────────────────────────────────────────
// One rating per (ImportedPaper × fixed RoB 2 domain) — mirrors ScreeningDecision/verdict shape,
// but Domain is a fixed enum rather than a user-defined criterion, since every review assesses
// the same five domains. Operates over the same candidate paper set as Data Extraction.

export type RiskOfBiasDomain =
  | 'RandomizationProcess' | 'DeviationsFromIntendedInterventions' | 'MissingOutcomeData'
  | 'MeasurementOfTheOutcome' | 'SelectionOfReportedResult'

export type RiskOfBiasRating = 'Pending' | 'Low' | 'SomeConcerns' | 'High'

export interface RiskOfBiasDomainRating {
  id:               string
  domain:           RiskOfBiasDomain
  rating:           RiskOfBiasRating
  aiRationale:      string | null
  isManualOverride: boolean
  aiModel?:         string | null
  promptVersion?:   string | null
}

export interface RiskOfBiasRecord {
  paperId:             string
  title:               string
  authors:             string
  publicationDate:     string
  journal:             string
  doi:                 string
  source:              string
  typeBadge:           string
  citations:           number
  abstract:            string
  fullTextStatus:      FullTextStatus
  useAbstractFallback: boolean
  overall:             RiskOfBiasRating
  ratings:             RiskOfBiasDomainRating[]
}

export interface RiskOfBiasSummary {
  total:        number
  pending:      number
  low:          number
  someConcerns: number
  high:         number
  needsPdf:     number
  abstractOnly: number
}

export type RiskOfBiasFilter = 'all' | 'needsPdf' | 'abstractOnly'

export interface PaginatedRiskOfBias {
  items:    RiskOfBiasRecord[]
  total:    number
  page:     number
  pageSize: number
  summary:  RiskOfBiasSummary
}

export interface RiskOfBiasRunStatus {
  isRunning: boolean
  done:      number
  total:     number
  skipped:   number
}

export type RiskOfBiasTool = 'RobTwo' | 'RobinsI'

// ── ROBINS-I (Risk of Bias Assessment step, alternative tool) ────────────────
// Opt-in alternative to the RoB 2 set above, for reviews of non-randomized/observational studies
// — selected via SystematicReviewDetail.riskOfBiasTool. Mirrors the RoB 2 shapes 1:1 over
// ROBINS-I's own 7-domain / 5-level-rating vocabulary (kept separate rather than reusing RoB 2's
// types, since the two tools' domains and rating scales are methodologically distinct).

export type RiskOfBiasDomainRobinsI =
  | 'ConfoundingBias' | 'SelectionOfParticipants' | 'ClassificationOfInterventions'
  | 'DeviationsFromIntendedInterventions' | 'MissingData' | 'MeasurementOfOutcomes'
  | 'SelectionOfReportedResult'

export type RobinsIRatingValue = 'Pending' | 'Low' | 'Moderate' | 'Serious' | 'Critical' | 'NoInformation'

export interface RobinsIDomainRating {
  id:               string
  domain:           RiskOfBiasDomainRobinsI
  rating:           RobinsIRatingValue
  aiRationale:      string | null
  isManualOverride: boolean
  aiModel?:         string | null
  promptVersion?:   string | null
}

export interface RobinsIRecord {
  paperId:             string
  title:               string
  authors:             string
  publicationDate:     string
  journal:             string
  doi:                 string
  source:              string
  typeBadge:           string
  citations:           number
  abstract:            string
  fullTextStatus:      FullTextStatus
  useAbstractFallback: boolean
  overall:             RobinsIRatingValue
  ratings:             RobinsIDomainRating[]
}

export interface RobinsISummary {
  total:         number
  pending:       number
  low:           number
  moderate:      number
  serious:       number
  critical:      number
  noInformation: number
  needsPdf:      number
  abstractOnly:  number
}

export interface PaginatedRobinsI {
  items:    RobinsIRecord[]
  total:    number
  page:     number
  pageSize: number
  summary:  RobinsISummary
}

export interface RobinsIRunStatus {
  isRunning: boolean
  done:      number
  total:     number
  skipped:   number
}

// ── Evidence Grading step ────────────────────────────────────────────────────
// One rating per (outcome ExtractionVariable × fixed GRADE domain). Outcomes are whichever
// ExtractionVariables have isOutcome set (see ExtractionVariable above) — there's no separate
// outcome-management surface. Rated once per outcome across every contributing paper, not per
// paper, so unlike every other step this one is a flat list, not paginated.

export type GradeDomain = 'RiskOfBias' | 'Inconsistency' | 'Indirectness' | 'Imprecision' | 'PublicationBias'
export type GradeRating = 'Pending' | 'NotSerious' | 'Serious' | 'VerySerious' | 'Unclear'
export type GradeCertainty = 'Pending' | 'VeryLow' | 'Low' | 'Moderate' | 'High'

export interface GradeDomainRating {
  id:               string
  domain:           GradeDomain
  rating:           GradeRating
  aiRationale:      string | null
  isManualOverride: boolean
  aiModel?:         string | null
  promptVersion?:   string | null
}

// GRADE's upgrading factors — only ever populated for reviews using ROBINS-I (non-randomized
// studies), since RCT evidence starts at High certainty and has nothing to upgrade from. Always
// an empty array on EvidenceGradeRecord.upgradeRatings for RoB 2 reviews.
export type GradeUpgradeFactor = 'LargeEffect' | 'DoseResponseGradient' | 'OpposingPlausibleConfounding'
export type GradeUpgradeRating = 'Pending' | 'Present' | 'Absent'

export interface GradeUpgradeRatingRecord {
  id:               string
  factor:           GradeUpgradeFactor
  rating:           GradeUpgradeRating
  aiRationale:      string | null
  isManualOverride: boolean
  aiModel?:         string | null
  promptVersion?:   string | null
}

export interface EvidenceGradeRecord {
  outcomeVariableId: string
  outcomeName:       string
  studyCount:        number
  overall:           GradeCertainty
  ratings:           GradeDomainRating[]
  upgradeRatings:    GradeUpgradeRatingRecord[]
}

export interface EvidenceGradingSummary {
  totalOutcomes: number
  pending:       number
  veryLow:       number
  low:           number
  moderate:      number
  high:          number
}

export interface EvidenceGradingRecordsResponse {
  items:   EvidenceGradeRecord[]
  summary: EvidenceGradingSummary
}

export interface EvidenceGradingRunStatus {
  isRunning: boolean
  done:      number
  total:     number
}

// ── Write SLR step ────────────────────────────────────────────────────────────
// The terminal step — a fixed set of prose sections generated from every prior step's
// accumulated data. Citation numbering ([1], [2], ...) is fixed the moment a manuscript is
// (re)generated, so regenerating a single section never renumbers citations already baked into
// another section's prose. Citations are never AI-invented — always built from the review's own
// retrieved paper metadata.

export type ManuscriptSectionKey =
  | 'Abstract' | 'Introduction' | 'Methods' | 'Results' | 'Discussion' | 'Limitations' | 'Conclusion'

export interface ManuscriptSection {
  key:         ManuscriptSectionKey
  title:       string
  content:     string
  wordCount:   number
  sortOrder:   number
  generatedAt: string | null
  updatedAt:   string
}

export interface ManuscriptCitation {
  paperId:         string
  index:           number
  title:           string
  authors:         string
  journal:         string
  publicationDate: string
  doi:             string
  citationText:    string
}

export interface Manuscript {
  sections:    ManuscriptSection[]
  citations:   ManuscriptCitation[]
  generatedAt: string | null
  wordCount:   number
}

// ── Export step ──────────────────────────────────────────────────────────────
// Raw-data exports (Papers/Screening/Extraction/RiskOfBias/EvidenceGrading) are downloaded
// directly as CSV blobs — only PRISMA is structured JSON, since reviewers use it to drive their
// own flow-diagram tooling rather than reading it as a table.

export interface PrismaFlow {
  retrieved:                      number
  retrievedBySource:              Record<string, number>
  duplicatesRemovedByDoi:         number
  duplicatesRemovedByTitle:       number
  excludedWithoutAbstract:        number
  excludedByPublicationDate:      number
  excludedByCitationThreshold:    number
  readyForScreening:              number
  titleAbstractScreened:          number
  titleAbstractIncluded:          number
  titleAbstractExcluded:          number
  titleAbstractNeedsManualReview: number
  fullTextAssessed:               number
  fullTextIncluded:               number
  fullTextExcluded:               number
  fullTextNeedsPdf:               number
}

// ── Citation Chaining (Snowballing) step ────────────────────────────────────────
// Backward (reference list) and forward (citing works) search over OpenAlex, seeded from every
// Full-Text-Included paper with a DOI. Runs synchronously — bounded to a fixed number of source
// papers per call — rather than as a polled background job, since it's a handful of fast HTTP
// lookups rather than per-paper LLM calls. New candidates land as ImportedPaper rows with
// source "Snowball"; re-run Deduplication & filters afterward to pull them into screening.

export interface SnowballResult {
  sourcePapersProcessed:   number
  sourcePapersSkippedNoDoi: number
  backwardReferencesFound: number
  forwardCitationsFound:   number
  newPapersAdded:          number
}
