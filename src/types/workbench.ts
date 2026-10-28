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
export type WriteWithAiDocumentType = 'General' | 'Essay' | 'CaseStudy' | 'ResearchPaper' | 'LiteratureReview' | 'ThesisChapter'
export type ThesisChapterKind = 'Introduction' | 'LiteratureReview' | 'Methodology' | 'Results' | 'Discussion' | 'Conclusion'
export type LiteratureReviewArchetype = 'Thematic' | 'Chronological' | 'Methodological' | 'Theoretical'
export type ResearchPaperDisciplineProfile = 'GeneralImrad' | 'Stem' | 'SocialScience' | 'HumanitiesEmpirical'
export type ResearchState = 'Proposal' | 'StudyDesigned' | 'DataCollection' | 'DataAvailable' | 'AnalysisCompleted' | 'CompletedResearch' | 'LiteratureOnly'
export type ResearchSectionStatus = 'Generated' | 'EvidenceRequired' | 'NotApplicable'
export type ResearchClaimProvenance = 'LiteratureEvidence' | 'UserProvided' | 'UploadedDocument' | 'DatasetEvidence' | 'AnalysisEvidence' | 'ModelInference'
export type EssaySubType = 'Argumentative' | 'Expository' | 'CompareAndContrast' | 'CriticalEvaluation' | 'Discussion' | 'Reflective' | 'LiteratureBased'
export type EssayAcademicLevel = 'Undergraduate' | 'Honours' | 'Masters' | 'Doctoral'
export type EssayDiscipline = 'General' | 'Engineering' | 'ComputerScience' | 'Law' | 'Business' | 'Medicine' | 'Nursing' | 'Education' | 'Economics' | 'PoliticalScience' | 'Psychology' | 'SocialSciences' | 'Cybersecurity' | 'History'
export type EssayCitationStyle = 'Harvard' | 'Apa7' | 'Ieee' | 'Chicago' | 'Vancouver'
export interface EssayAssignmentAnalysis { commandVerb: string; assignmentType: string; expectedArgumentStyle: string; expectedEvidence: string }
export interface EssayWordAllocation { introductionWords: number; bodyWords: number; conclusionWords: number }
export interface EssayPlanPoint { claim: string; connectionToThesis: string; evidenceNeeds: string[]; role: string; whatItDoesNotEstablish?: string }
export interface ReflectivePlanStage { stage: string; purpose: string; evidenceNeeds: string[] }
export interface EssayPlan { subType: EssaySubType; academicLevel: EssayAcademicLevel; discipline: EssayDiscipline; citationStyle: EssayCitationStyle; assignmentAnalysis: EssayAssignmentAnalysis; academicTitle: string; interpretedQuestion: string; thesis: string; introductionPlan: string; counterargumentStrategy: string; exactScope?: string; strongestObjection?: string; planRisks?: string; subClaims: EssayPlanPoint[]; reflectiveStages: ReflectivePlanStage[]; conclusionPurpose: string; wordAllocation: EssayWordAllocation; requiredAcademicVoice: string; requiredCriticalDepth: string }
export interface PlanEssayRequest { topic: string; targetWordCount: number; subType: EssaySubType; academicLevel: EssayAcademicLevel; discipline: EssayDiscipline; citationStyle: EssayCitationStyle }

export interface WriteWithAiLibraryDocument {
  documentId: string
  title:   string
  content: string
}

export interface WriteWithAiRequest {
  allowAdditionalEvidenceRetrieval?: boolean
  /** Research and plan the essay, then return a section list to write one section at a time instead of drafting it. */
  coWrite?: boolean
  topic:             string
  targetWordCount?:  number
  sourceMode:        WriteWithAiSourceMode
  documentType?:     WriteWithAiDocumentType
  essaySubType?:     EssaySubType
  academicLevel?:    EssayAcademicLevel
  discipline?:       EssayDiscipline
  citationStyle?:    EssayCitationStyle
  approvedPlan?:     EssayPlan
  approvedCasePlan?: CaseStudyPlan
  researchPaperProfile?: ResearchPaperDisciplineProfile
  includeSeparateLiteratureReview?: boolean
  // Set only when documentType === 'ThesisChapter'; selects the chapter written.
  thesisChapter?: ThesisChapterKind
  targetJournal?: string
  researchState?: ResearchState
  researchEvidence?: ResearchEvidenceContext
  libraryDocuments?: WriteWithAiLibraryDocument[]
  // Set only when documentType === 'LiteratureReview'; ignored otherwise. Selects which of the
  // four seeded templates the backend's grounded literature-review pipeline instantiates.
  literatureReviewArchetype?: LiteratureReviewArchetype
}

export interface WriteWithAiReference {
  authorDetails?: { family?: string | null; given?: string | null; name?: string | null }[]
  sourceId: string
  canonicalId?: string | null
  openAlexWorkId?: string | null
  pmid?: string | null
  provider?: string | null
  providerRecordId?: string | null
  title:  string
  url:    string | null
  source: 'web' | 'my_files'
  documentId?: string | null
  passageStart?: number | null
  passageEnd?: number | null
  doi?: string | null
  authors?: string | null
  year?: number | null
  venue?: string | null
  volume?: string | null
  issue?: string | null
  pages?: string | null
  publisher?: string | null
}

export interface EssaySections {
  introduction: string
  mainBody:     string
  conclusion:   string
}

export interface WriteWithAiLiteratureReviewSection {
  sectionCode: string
  heading:     string
  content:     string
}

export interface CoWriteSection {
  id: string
  kind: 'intro' | 'body' | 'conclusion'
  heading: string
  claim: string
  reasoning: string
  qualification: string
  evidenceIds: string[]
  words: number
  status: 'ready' | 'limited' | 'no_evidence'
}
export interface CoWritePassage { id: string; sourceId: string; text: string; claim: string; role: string }
export interface CoWriteSession {
  sessionId: string
  title: string
  question: string
  thesis: string
  citationStyle: EssayCitationStyle
  sections: CoWriteSection[]
  passages: CoWritePassage[]
  references: WriteWithAiReference[]
}
export interface CoWriteSectionRequest {
  sessionId: string
  sectionId: string
  excludeSourceIds?: string[]
  instruction?: string
  acceptedText?: string
}
export interface CoWriteSectionResponse {
  sectionId: string
  text: string
  sourceIds: string[]
  evidenceIds: string[]
  warnings: string[]
  wordCount: number
  /** The text passed the citation checks but not the academic review (or the review could not run): the student should read it before relying on it. */
  needsReview?: boolean
}

export interface WriteWithAiResponse {
  completionStatus?: 'Complete' | 'Incomplete' | 'CoWriteReady'
  coWrite?: CoWriteSession | null
  completionReason?: string | null
  questionCoverage?: {
    version: string
    gapReport?: { componentId: string; subQuestion: string; period: string; directSourceCount: number; sourceIds: string[]; sourcePeriods: string[]; status: string }[]
    plan: { components: { id: string; issue: string; essential: boolean; evidenceNeed: string; searchIntents: string[]; argumentRole: string; period?: string; startYear?: number | null; endYear?: number | null; backgroundSearchIntents?: string[] }[] }
    assessment: {
      passages: { id: string; sourceId: string; text: string; claim: string; role: string; componentIds: string[]; justification: string; limitations: string[]; access: string; locator: string }[]
      coverage: { componentId: string; state: 'supported' | 'partial' | 'unsupported' | 'conflicting'; reason: string; evidenceIds: string[]; followUpQuery: string }[]
    }
    outline: { arguments: { componentId: string; claim: string; reasoning: string; qualification: string; evidenceIds: string[]; words: number }[] }
    stopReason: string
    diagnostics: string[]
  } | null
  evidencePlan?: {
    version: string
    available: boolean
    scope: { question: string; articleType: string; academicLevel: string; wordBudget: number; populationOrContext?: string | null; phenomenon?: string | null; outcomesOrConstructs?: string | null; requiredPerspective?: string | null; explicitRequirements: string[]; proposedFraming: string[] }
    sources: { sourceId: string; canonicalId: string; access: string; population?: string | null; setting?: string | null; design?: string | null; conditions?: string | null; constructs?: string | null; tasks?: string | null; outcomes?: string | null; findings: string[]; limitations: string[]; supportingExcerpt?: string | null; locator?: string | null }[]
    claims: { text: string; sourceIds: string[]; supportStatus: 'direct' | 'indirect' | 'conflicting' | 'insufficient' | 'unsupported'; limitations: string[]; action: string; wording: string }[]
    boundedThesis: string
    gaps: string[]
    latencyMs: number
    sourceCacheHits: number
    failureReason?: string | null
  } | null
  evidenceIssues?: { passageId: string; claim: string; sourceIds: string[]; category: string; severity: string; explanation: string; correctiveAction: string }[]
  isEssay:    boolean
  title:      string
  content:    string
  sections?:  EssaySections
  references: WriteWithAiReference[]
  wordCount:  number
  claimAudit?: EssayClaimAuditSummary
  // Case Study Phase 1
  isCaseStudy?:   boolean
  caseType?:      CaseStudyType
  caseSections?:  CaseStudySections
  caseFactAudit?: CaseFactAuditSummary
  // PR19 — Case Study had no per-flag list before this; shares WorkbenchReviewFlag with
  // researchPaperFlags below rather than a separate type.
  caseStudyFlags?: WorkbenchReviewFlag[]
  isResearchPaper?: boolean
  researchPaperSections?: ResearchPaperSections
  researchPaperFlags?: WorkbenchReviewFlag[]
  researchPaperSectionResults?: ResearchPaperSectionResult[]
  // Populated only when the essay claim-support gate runs in 'flag' mode; in the default 'block'
  // mode the generation throws and surfaces through the modal's catch instead. Shares
  // WorkbenchReviewFlag with the two flag lists above.
  essayFlags?: WorkbenchReviewFlag[]
  // OPEN_ITEMS.md #100 — argumentative-structure findings, kept as their OWN field rather than
  // folded into essayFlags above. They are a different category of problem with a different fix:
  // essayFlags/claimAudit/citationVerification say a claim doesn't hold against its source
  // (remediation: re-source), these say the document doesn't argue anything (remediation: rewrite).
  // undefined means the checks didn't apply to this document type; a report with available=false
  // means they applied and couldn't run. Neither means "checked and clean".
  argumentativeQuality?: ArgumentativeQualityReport
  // Grounded literature-review pipeline — a List rather than a fixed-shape sections object
  // (unlike `sections` above) because a template's repeatable sections (Thematic Matrix, Period
  // Synthesis, etc.) produce a variable number of instances.
  isLiteratureReview?: boolean
  literatureReviewSections?: WriteWithAiLiteratureReviewSection[]
  // What the review could not resolve (unsupported evidence needs, unscoped claims about the literature, failed searches).
  // Empty does not mean verified.
  literatureReviewFlags?: WorkbenchReviewFlag[]
  // PR19 — correlation ID into the WorkbenchGenerationAudit table/log line, when a generation
  // audit record was created (requires an authenticated user). Not currently surfaced in the UI;
  // kept on the response so a future support/debug view can look up "what happened when this
  // document was generated" without re-deriving it.
  generationAuditId?: string
}

export interface ResearchEvidenceContext {
  hasDataset: boolean
  hasParticipantData: boolean
  hasCompletedDataCollection: boolean
  hasVerifiedSampleSize: boolean
  analystJobId?: string
  methodologyEvidence?: string
  verifiedAnalysisResults?: string
  ethicsApprovalEvidence?: string
  completedActivitiesEvidence?: string
}

export interface ResearchPaperSectionResult {
  sectionKey: string
  heading: string
  status: ResearchSectionStatus
  content?: string | null
  reason?: string | null
  requiredAction?: string | null
  permittedProvenance: ResearchClaimProvenance[]
}

export interface ResearchPaperSections {
  abstract: string
  introduction: string
  literatureReview?: string | null
  methods: string
  results: string
  discussion: string
  conclusion: string
}

// ── Argumentative quality (OPEN_ITEMS.md #100) ────────────────────────────────

// Severity is reported per finding rather than assumed per code, because the family's policy is
// that everything warns EXCEPT the hedge-list thesis pattern — and that one never reaches the
// frontend as a finding in the default enforcement mode, since it throws and surfaces through the
// modal's catch like every other blocking check.
export type ArgumentativeQualitySeverity = 'Informational' | 'Warning' | 'Blocking'

export interface ArgumentativeQualityFinding {
  code: 'ConclusionRestatesThemesWithoutSynthesis' | 'GenericHedgeListThesis' | string
  section: string
  message: string
  severity: ArgumentativeQualitySeverity
  // The rule's own underlying measurement (e.g. a cosine similarity) when it has one. Carried so a
  // reviewer can see how close to the line a warning sat — several of these thresholds are
  // explicitly provisional and this is what makes them re-tunable from real traffic.
  score?: number | null
}

export interface ArgumentativeQualityReport {
  available: boolean
  warning?: string | null
  findings: ArgumentativeQualityFinding[]
}

export interface WorkbenchReviewFlag {
  code: 'CitationInResultsSection' | 'ClaimSourceVerificationRequired' | 'UnderReferenced' | string
  section: string
  message: string
  citationSourceIds: string[]
}

// ── Case Study (Phase 1) ──────────────────────────────────────────────────────

export type CaseStudyType = 'Analytical' | 'Decision' | 'Evaluative' | 'Explanatory' | 'Comparative' | 'ResearchBased'
export type CaseFactSourceType = 'AssignmentPrompt' | 'UploadedDocument'

export interface CaseStudyAssignmentAnalysis {
  caseSubject: string
  organisationOrEntity: string
  problemOrDecision: string
  requiredFrameworks: string[]
  requiredSources: string[]
  expectsRecommendation: boolean
  requiresComparison: boolean
  requiresQuantitativeAnalysis: boolean
}

export interface CaseStudySectionPlan {
  sectionKey: string
  heading:    string
  required:   boolean
}

export interface CaseStudyPlan {
  caseType:           CaseStudyType
  assignmentAnalysis: CaseStudyAssignmentAnalysis
  assignmentText:     string
  academicTitle:      string
  centralProblem:     string
  analysisSubClaims:  EssayPlanPoint[]
  suggestedFramework?: string | null
  structure:          CaseStudySectionPlan[]
  academicLevel:      EssayAcademicLevel
  discipline:         EssayDiscipline
  citationStyle:      EssayCitationStyle
}

export interface PlanCaseStudyRequest {
  assignmentText:    string
  targetWordCount?:  number
  academicLevel?:    EssayAcademicLevel
  discipline?:       EssayDiscipline
  citationStyle?:    EssayCitationStyle
  libraryDocuments?: WriteWithAiLibraryDocument[]
}

export interface CaseStudySections {
  introduction:                 string
  caseBackground:               string
  problemIdentification:        string
  analysis:                     string
  alternatives?:                string | null
  recommendations?:             string | null
  conclusion:                   string
  executiveSummary?:            string | null
  implementationConsiderations?: string | null
  appendices?:                  string | null
}

export interface CaseFactAuditSummary {
  totalCaseFacts: number
  claimsRequiringCaseEvidence: number
  groundedCaseClaims: number
  ungroundedCaseClaims: number
  quantitativeAnalysisFlagged: boolean
  quantitativeAnalysisNote?: string | null
}

export interface EssayClaimAuditSummary {
  auditAvailable: boolean
  auditWarning?: string | null
  claims: EssayClaimAuditItem[]
  atomicClaims: number
  evidenceRequiring: number
  nonEvidenceClaims: number
  cited: number
  uncited: number
  supported: number
  supportedCanonical: number
  supportedTrustedEvidence: number
  unsupported: number
  unverifiable: number
  misaligned: number
  rewritten: number
  removed: number
  coveragePercent: number
  verifiedCoveragePercent: number
  verifiedCoverageCanonical: number
  verifiedCoverageAnyTrusted: number
  coverageBeforeRepair: number
  uniqueSourcesBeforeRepair: number
  uniqueSourcesAfterRepair: number
  existingCorpusRepairs: number
  externalGapQueries: number
  newSourcesAdded: number
  auditLatencyMs: number
  verificationLatencyMs: number
  repairLatencyMs: number
}

export interface EssayClaimAuditItem {
  id: string
  text: string
  claimType: string
  requiresEvidence: boolean
  citationSourceIds: string[]
  verificationStatus: string
  supportConfidence?: number | null
  repairStatus: string
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
