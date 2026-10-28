import client from './client'
import type {
  ProposalIssues,
  RepairReport,
  AcademicLevel,
  BibliographyResult,
  AlignmentIssue,
  AlignmentValidationResult,
  ApproveCorpusPayload,
  CanonicalResearchPlan,
  CitationFlag,
  QualityFlag,
  CitationFixAction,
  CitationStyle,
  DefencePreparation,
  DimensionCoverageSummary,
  DiscoveryConfig,
  DiscoveryStatus,
  DiversifiedShortlist,
  DocumentMode,
  ImportManualPaperPayload,
  ExternalProposalJobResult,
  FactConflict,
  ExternalFact,
  FetchedLiterature,
  DashboardLiteratureFilter,
  DashboardLiteraturePage,
  LiteratureCitationSummary,
  GatherMode,
  GeneratedTitle,
  GenerationStatus,
  GeneratorMode,
  GraphGap,
  InstrumentDetail,
  InstrumentSource,
  InstrumentStatus,
  InstrumentSummary,
  InstrumentType,
  LiteratureCsvImportResult,
  LiteratureDimension,
  LiteratureSearchQuery,
  MethodologyAnchorCandidate,
  ConfirmMethodologyPayload,
  MethodologyChangeImpact,
  MilestoneStatus,
  ProjectAnalysisPlan,
  ProjectDataset,
  ProjectHypothesis,
  ProjectSection,
  ProjectSectionVersion,
  ProposalThesisMappingResult,
  ReadinessEvaluation,
  ResearchProject,
  ResearchRoadmap,
  ResearchState,
  ResearchTopic,
  ScreeningCandidate,
  ScreeningCandidateFilters,
  ScreeningCandidateList,
  ScreeningStatus,
  SectionEvidenceCoverageAudit,
  SectionFixPreview,
  ThesisAuditResult,
  ThesisChapterPlan,
  TopicScope,
  UniversityTemplateDetail,
  UniversityTemplateSummary,
  UpdateHypothesisPayload,
  ValidationSummary,
  EthicsChecklist,
  EthicsDocument,
  EthicsDocumentStatus,
  MethodologyClassification,
  ConfirmMethodologyClassificationPayload,
} from '../types/research'

type Wrap<T> = { success: boolean; data: T }
const unwrap = <T>(res: { data: Wrap<T> }): T => res.data.data ?? (res.data as unknown as T)

// ── Payloads ──────────────────────────────────────────────────────────────────

// Backend response shape for POST .../methodology-recommendation — mirrors
// src/lib/methodologyRecommendation.ts's MethodologyRecommendation minus inputFingerprint/version,
// which the caller attaches locally (frontend-only bookkeeping, not something the backend needs
// to know about).
export interface BackendMethodologyRecommendation {
  approach: 'Qualitative' | 'Quantitative' | 'Mixed Methods' | 'Undetermined'
  design?: string | null
  dataCollection: string[]
  analysis: string[]
  timeFrame: 'Cross-sectional' | 'Longitudinal' | 'Unspecified'
  rationale: string
  signals: string[]
  assumptions: string[]
  missingInformation: string[]
  confidence: 'High' | 'Moderate' | 'Low'
  confidenceReason: string
  alternative?: string | null
  clarificationQuestion?: string | null
  clarificationOptions: string[]
}

export interface CreateProjectPayload {
  generatorMode: GeneratorMode
  documentMode:  DocumentMode
  designFirst?: boolean
  topic?: string
  academicLevel?: AcademicLevel
  citationStyle?: CitationStyle
  idempotencyKey?: string
}

// Full-state sync — always send the entire project so null means "clear", not "skip".
export interface SyncProjectPayload {
  title:           string
  academicLevel:   AcademicLevel
  fieldInterest:   string
  selectedTopic:   ResearchTopic | null
  suggestedTopics: ResearchTopic[]
  generatedTitles: GeneratedTitle[]
  currentStep:     number
  sectionContent:  Record<string, string>
  documentMode:    DocumentMode
  citationStyle:   CitationStyle
  progressPct:     number
  methodologyType?:    string
  methodologySubType?: string
  notes?:              string
  studyLocation?:      string
  studyPopulation?:    string
  gatherMode?:         GatherMode
  selectedLibraryDocumentIds?: string[]
}

// ── API calls ─────────────────────────────────────────────────────────────────

export const researchApi = {
  create: async (payload: CreateProjectPayload): Promise<ResearchProject> =>
    unwrap(await client.post<Wrap<ResearchProject>>('/api/v1/research/projects', payload)),

  list: async (): Promise<ResearchProject[]> =>
    unwrap(await client.get<Wrap<ResearchProject[]>>('/api/v1/research/projects')),

  get: async (id: string): Promise<ResearchProject> =>
    unwrap(await client.get<Wrap<ResearchProject>>(`/api/v1/research/projects/${id}`)),

  sync: async (id: string, payload: SyncProjectPayload): Promise<ResearchProject> =>
    unwrap(await client.patch<Wrap<ResearchProject>>(`/api/v1/research/projects/${id}`, payload)),

  generateTopics: async (
    projectId: string,
    fieldInterest: string,
    academicLevel: AcademicLevel,
  ): Promise<ResearchTopic[]> =>
    unwrap(await client.post<Wrap<ResearchTopic[]>>(
      `/api/v1/research/projects/${projectId}/generate-topics`,
      { fieldInterest, academicLevel },
    )),

  generateTitles: async (
    projectId: string,
    chosenTopic: string,
    academicLevel: AcademicLevel,
  ): Promise<GeneratedTitle[]> =>
    unwrap(await client.post<Wrap<GeneratedTitle[]>>(
      `/api/v1/research/projects/${projectId}/generate-titles`,
      { chosenTopic, academicLevel },
    )),

  // AI-driven methodology suggestion — reads the project's own current Title/topic/location/
  // population/level server-side (no body needed). Shape matches
  // src/lib/methodologyRecommendation.ts's MethodologyRecommendation minus inputFingerprint/
  // version, which the caller attaches locally since those are frontend-only bookkeeping.
  recommendMethodology: async (
    projectId: string,
    clarificationAnswer?: string,
  ): Promise<BackendMethodologyRecommendation> =>
    unwrap(await client.post<Wrap<BackendMethodologyRecommendation>>(
      `/api/v1/research/projects/${projectId}/methodology-recommendation`,
      clarificationAnswer ? { clarificationAnswer } : {},
    )),

  // docs/OPEN_ITEMS.md #81 — the explicit "Confirm Methodology" action. Distinct from `sync`
  // above (which still only writes the free-editing scratch methodologyType/methodologySubType
  // fields) — this is what unlocks generation/approval for methodology-sensitive sections.
  confirmMethodology: async (
    projectId: string,
    payload: ConfirmMethodologyPayload,
  ): Promise<ResearchProject> =>
    unwrap(await client.post<Wrap<ResearchProject>>(
      `/api/v1/research/projects/${projectId}/methodology/confirm`,
      payload,
    )),

  // "Impact warning before changing methodology" — read-only preview of what confirming
  // `candidateMethodologyType` would invalidate, before the student commits.
  previewMethodologyChangeImpact: async (
    projectId: string,
    candidateMethodologyType: string,
  ): Promise<MethodologyChangeImpact> =>
    unwrap(await client.get<Wrap<MethodologyChangeImpact>>(
      `/api/v1/research/projects/${projectId}/methodology/change-impact`,
      { params: { candidateMethodologyType } },
    )),

  delete: async (id: string): Promise<void> => {
    await client.delete(`/api/v1/research/projects/${id}`)
  },

  // ── Sprint 2: Chapter Writer ───────────────────────────────────────────────

  getSections: async (projectId: string): Promise<ProjectSection[]> =>
    unwrap(await client.get<Wrap<ProjectSection[]>>(
      `/api/v1/research/projects/${projectId}/sections`,
    )),

  initSections: async (projectId: string): Promise<ProjectSection[]> =>
    unwrap(await client.post<Wrap<ProjectSection[]>>(
      `/api/v1/research/projects/${projectId}/sections/init`,
    )),

  // This only enqueues the generation run server-side now (see ResearchService
  // .EnqueueSectionGenerationAsync) — the actual literature fetch + Claude draft can take several
  // minutes and no longer happens inline, so this call itself only does fast validation and
  // returns almost immediately. A short timeout is intentional; the sections poll (see
  // ResearchAgentPage's isGenerating effect) is what tracks the run to completion.
  generateSection: async (projectId: string, code: string, targetWordCount?: number): Promise<ProjectSection> =>
    unwrap(await client.post<Wrap<ProjectSection>>(
      `/api/v1/research/projects/${projectId}/sections/generate`,
      null,
      { params: { code, ...(targetWordCount ? { target_word_count: targetWordCount } : {}) }, timeout: 20_000 },
    )),

  saveSection: async (projectId: string, code: string, content: string): Promise<ProjectSection> =>
    unwrap(await client.patch<Wrap<ProjectSection>>(
      `/api/v1/research/projects/${projectId}/sections`,
      { content },
      { params: { code } },
    )),

  approveSection: async (projectId: string, code: string, acknowledgeConflicts = false): Promise<ProjectSection> =>
    unwrap(await client.post<Wrap<ProjectSection>>(
      `/api/v1/research/projects/${projectId}/sections/approve`,
      null,
      { params: { code, acknowledgeConflicts } },
    )),

  // Same enqueue-and-return contract as generateSection above — see its comment.
  regenerateSection: async (projectId: string, code: string): Promise<ProjectSection> =>
    unwrap(await client.post<Wrap<ProjectSection>>(
      `/api/v1/research/projects/${projectId}/sections/regenerate`,
      null,
      { params: { code }, timeout: 20_000 },
    )),

  // ── Autonomous generation (AI Thesis) — server-driven, survives tab close ───

  generateAutonomous: async (projectId: string, targetWordCount: number, autoRepairValidation = false): Promise<GenerationStatus> =>
    unwrap(await client.post<Wrap<GenerationStatus>>(
      `/api/v1/research/projects/${projectId}/generate-autonomous`,
      { targetWordCount, autoRepairValidation },
      { timeout: autoRepairValidation ? 45_000 : 20_000 },
    )),

  getGenerationStatus: async (projectId: string): Promise<GenerationStatus> =>
    unwrap(await client.get<Wrap<GenerationStatus>>(
      `/api/v1/research/projects/${projectId}/generation-status`,
    )),

  cancelGeneration: async (projectId: string): Promise<GenerationStatus> =>
    unwrap(await client.post<Wrap<GenerationStatus>>(
      `/api/v1/research/projects/${projectId}/generation/cancel`,
    )),

  // "Apply fix" preview — proposes a corrected version of one section addressing a group of its
  // own LlmJudged AlignmentIssues, without saving. Confirm/discard below decide what happens to
  // the credit reservation this call makes.
  applySectionFix: async (projectId: string, code: string, issues: AlignmentIssue[]): Promise<SectionFixPreview> =>
    unwrap(await client.post<Wrap<SectionFixPreview>>(
      `/api/v1/research/projects/${projectId}/sections/apply-fix`,
      { issues },
      { params: { code } },
    )),

  confirmSectionFix: async (projectId: string, code: string, proposedContent: string): Promise<ProjectSection> =>
    unwrap(await client.post<Wrap<ProjectSection>>(
      `/api/v1/research/projects/${projectId}/sections/apply-fix/confirm`,
      { proposedContent },
      { params: { code } },
    )),

  discardSectionFix: async (projectId: string): Promise<void> => {
    await client.post(`/api/v1/research/projects/${projectId}/sections/apply-fix/discard`)
  },

  validateAlignment: async (projectId: string): Promise<AlignmentValidationResult> =>
    unwrap(await client.get<Wrap<AlignmentValidationResult>>(
      `/api/v1/research/projects/${projectId}/validate-alignment`,
    )),

  validateQuality: async (projectId: string): Promise<AlignmentValidationResult> =>
    unwrap(await client.get<Wrap<AlignmentValidationResult>>(
      `/api/v1/research/projects/${projectId}/validate-quality`,
    )),

  getCitationFlags: async (projectId: string, sectionCode: string): Promise<CitationFlag[]> =>
    unwrap(await client.get<Wrap<CitationFlag[]>>(
      `/api/v1/research/projects/${projectId}/sections/${sectionCode}/citation-flags`,
    )),

  getQualityFlags: async (projectId: string, sectionCode: string): Promise<QualityFlag[]> =>
    unwrap(await client.get<Wrap<QualityFlag[]>>(
      `/api/v1/research/projects/${projectId}/sections/${encodeURIComponent(sectionCode)}/quality-flags`,
    )),

  setQualityFlagDismissed: async (projectId: string, sectionCode: string, flagId: string, dismissed: boolean): Promise<void> => {
    await client.post(
      `/api/v1/research/projects/${projectId}/sections/${encodeURIComponent(sectionCode)}/quality-flags/${flagId}/${dismissed ? 'dismiss' : 'restore'}`,
    )
  },

  dismissCitationFlag: async (projectId: string, flagId: string, reason?: string): Promise<void> => {
    await client.post(`/api/v1/research/projects/${projectId}/citation-flags/${flagId}/dismiss`, { reason })
  },

  previewCitationFix: async (
    projectId: string, flagId: string, action: CitationFixAction, replacementLiteratureId?: string,
  ): Promise<SectionFixPreview> =>
    unwrap(await client.post<Wrap<SectionFixPreview>>(
      `/api/v1/research/projects/${projectId}/citation-flags/${flagId}/fix`,
      { action, replacementLiteratureId },
    )),

  confirmCitationFix: async (
    projectId: string, flagId: string, action: CitationFixAction, proposedContent: string,
  ): Promise<ProjectSection> =>
    unwrap(await client.post<Wrap<ProjectSection>>(
      `/api/v1/research/projects/${projectId}/citation-flags/${flagId}/fix/confirm`,
      { action, proposedContent },
    )),

  removeCitationClaim: async (projectId: string, flagId: string): Promise<ProjectSection> =>
    unwrap(await client.post<Wrap<ProjectSection>>(
      `/api/v1/research/projects/${projectId}/citation-flags/${flagId}/remove-claim`,
    )),

  // Answers an AmbiguousCitation flag. Deterministic on the server: no Claude call and no credit.
  chooseCitationSource: async (projectId: string, flagId: string, literatureId: string): Promise<ProjectSection> =>
    unwrap(await client.post<Wrap<ProjectSection>>(
      `/api/v1/research/projects/${projectId}/citation-flags/${flagId}/choose-source`,
      { literatureId },
    )),

  getFactConflicts: async (projectId: string): Promise<FactConflict[]> =>
    unwrap(await client.get<Wrap<FactConflict[]>>(
      `/api/v1/research/projects/${projectId}/fact-conflicts`,
    )),

  dismissFactConflict: async (projectId: string, conflictId: string): Promise<void> => {
    await client.post(`/api/v1/research/projects/${projectId}/fact-conflicts/${conflictId}/dismiss`)
  },

  acceptNewFactValue: async (projectId: string, conflictId: string): Promise<void> => {
    await client.post(`/api/v1/research/projects/${projectId}/fact-conflicts/${conflictId}/accept-new`)
  },

  getExternalFacts: async (projectId: string): Promise<ExternalFact[]> =>
    unwrap(await client.get<Wrap<ExternalFact[]>>(
      `/api/v1/research/projects/${projectId}/external-facts`,
    )),

  confirmExternalFact: async (projectId: string, factKey: string): Promise<void> => {
    await client.post(`/api/v1/research/projects/${projectId}/external-facts/${encodeURIComponent(factKey)}/confirm`)
  },

  compileBibliography: async (projectId: string): Promise<string> => {
    const res = unwrap(await client.post<Wrap<{ bibliography: string }>>(
      `/api/v1/research/projects/${projectId}/compile-bibliography`,
      null,
      { timeout: 180_000 },
    ))
    return res.bibliography
  },

  // Structured, deterministic (no LLM) bibliography: resolved entries, unresolved citations and
  // stage counts. A server/network failure rejects here — it is never an empty "success".
  getBibliography: async (projectId: string): Promise<BibliographyResult> =>
    unwrap(await client.get<Wrap<BibliographyResult>>(
      `/api/v1/research/projects/${projectId}/bibliography`,
      { timeout: 60_000 },
    )),

  exportDocx: async (projectId: string, acknowledgeCitationIssues = false): Promise<Blob> => {
    const res = await client.get<Blob>(
      `/api/v1/research/projects/${projectId}/export-docx`,
      { responseType: 'blob', params: { acknowledgeCitationIssues } },
    )
    return res.data
  },

  // "Fix issues and download": one issue list for the Download step, a repair run, and undo of a single repair.
  getProposalIssues: async (projectId: string): Promise<ProposalIssues> =>
    unwrap(await client.get<Wrap<ProposalIssues>>(`/api/v1/research/projects/${projectId}/proposal-issues`)),

  runProposalRepair: async (projectId: string): Promise<RepairReport> =>
    unwrap(await client.post<Wrap<RepairReport>>(`/api/v1/research/projects/${projectId}/proposal-repair`, null, { timeout: 120_000 })),

  undoProposalRepair: async (projectId: string, runId: string, repairId: string): Promise<RepairReport> =>
    unwrap(await client.post<Wrap<RepairReport>>(
      `/api/v1/research/projects/${projectId}/proposal-repair/${runId}/undo/${repairId}`,
    )),

  // Student-supplied values: replace one bracketed placeholder with typed text; set the year of a source saved without one.
  fillProposalPlaceholder: async (projectId: string, sectionKey: string, placeholder: string, value: string): Promise<RepairReport> =>
    unwrap(await client.post<Wrap<RepairReport>>(
      `/api/v1/research/projects/${projectId}/proposal-issues/fill-placeholder`, { sectionKey, placeholder, value },
    )),

  setProposalSourceYear: async (projectId: string, literatureId: string, year: number): Promise<ProposalIssues> =>
    unwrap(await client.post<Wrap<ProposalIssues>>(
      `/api/v1/research/projects/${projectId}/proposal-issues/set-source-year`, { literatureId, year },
    )),

  getLiterature: async (projectId: string): Promise<FetchedLiterature[]> =>
    unwrap(await client.get<Wrap<FetchedLiterature[]>>(
      `/api/v1/research/projects/${projectId}/literature`,
    )),

  // Promote/demote one source in the project's approved corpus. Nothing else in the proposal flow
  // could set IncludedByStudent, which left every approved-corpus-gated feature dead — see the
  // backend's SetLiteratureInclusionAsync for the full account.
  setLiteratureInclusion: async (
    projectId: string, literatureId: string, included: boolean,
  ): Promise<FetchedLiterature> =>
    unwrap(await client.put<Wrap<FetchedLiterature>>(
      `/api/v1/research/projects/${projectId}/literature/${literatureId}/inclusion`,
      { included },
    )),

  getDashboardLiterature: async (
    projectId: string,
    params: { filter: DashboardLiteratureFilter; search?: string; page: number; pageSize?: number },
    signal?: AbortSignal,
  ): Promise<DashboardLiteraturePage> =>
    unwrap(await client.get<Wrap<DashboardLiteraturePage>>(
      `/api/v1/research/projects/${projectId}/dashboard-literature`,
      { params, signal },
    )),

  // ── Sprint 3: Hypotheses & Analysis Plan ──────────────────────────────────

  getHypotheses: async (projectId: string): Promise<ProjectHypothesis[]> =>
    unwrap(await client.get<Wrap<ProjectHypothesis[]>>(
      `/api/v1/research/projects/${projectId}/hypotheses`,
    )),

  generateHypotheses: async (projectId: string, force = false): Promise<ProjectHypothesis[]> =>
    unwrap(await client.post<Wrap<ProjectHypothesis[]>>(
      `/api/v1/research/projects/${projectId}/hypotheses/generate`,
      null,
      { params: { force } },
    )),

  updateHypothesis: async (hypothesisId: string, payload: UpdateHypothesisPayload): Promise<ProjectHypothesis> =>
    unwrap(await client.patch<Wrap<ProjectHypothesis>>(
      `/api/v1/research/hypotheses/${hypothesisId}`,
      payload,
    )),

  generateHypothesisProse: async (projectId: string): Promise<ProjectSection> =>
    unwrap(await client.post<Wrap<ProjectSection>>(
      `/api/v1/research/projects/${projectId}/sections/generate-hypothesis-prose`,
    )),

  getAnalysisPlan: async (projectId: string): Promise<ProjectAnalysisPlan[]> =>
    unwrap(await client.get<Wrap<ProjectAnalysisPlan[]>>(
      `/api/v1/research/projects/${projectId}/analysis-plan`,
    )),

  validateChapter4: async (projectId: string): Promise<AlignmentValidationResult> =>
    unwrap(await client.get<Wrap<AlignmentValidationResult>>(
      `/api/v1/research/projects/${projectId}/validate-chapter4`,
    )),

  // ── Wizard content generation ─────────────────────────────────────────────

  // Matches the backend's Research:WizardGenerationTimeoutSeconds (240s) plus a buffer — this
  // call runs literature fetch + Claude draft + full citation verification synchronously
  // in-request with no Hangfire job behind it, so unlike generateSection/regenerateSection
  // above it previously had no timeout at all and could hang indefinitely on a dead connection.
  generateWizardContent: async (projectId: string, stepId: string): Promise<string> => {
    const res = unwrap(await client.post<Wrap<{ content: string }>>(
      `/api/v1/research/projects/${projectId}/generate-wizard-content`,
      null,
      { params: { stepId }, timeout: 260_000 },
    ))
    return res.content
  },

  // ── Sprint 5: Thesis chapters, defence preparation, full export ────────────

  transitionToThesis: async (projectId: string): Promise<ResearchProject> =>
    unwrap(await client.post<Wrap<ResearchProject>>(
      `/api/v1/research/projects/${projectId}/transition-to-thesis`,
    )),

  linkSession: async (projectId: string, sessionId: string): Promise<ResearchProject> =>
    unwrap(await client.post<Wrap<ResearchProject>>(
      `/api/v1/research/projects/${projectId}/link-session`,
      { sessionId },
    )),

  getLiteratureCitationSummary: async (projectId: string): Promise<LiteratureCitationSummary> =>
    unwrap(await client.get<Wrap<LiteratureCitationSummary>>(
      `/api/v1/research/projects/${projectId}/literature/citation-summary`,
    )),

  getProjectDatasets: async (projectId: string): Promise<ProjectDataset[]> =>
    unwrap(await client.get<Wrap<ProjectDataset[]>>(
      `/api/v1/research/projects/${projectId}/datasets`,
    )),

  linkDataset: async (projectId: string, datasetId: string): Promise<ProjectDataset> =>
    unwrap(await client.post<Wrap<ProjectDataset>>(
      `/api/v1/research/projects/${projectId}/datasets/link`,
      { datasetId },
    )),

  generateDefence: async (projectId: string): Promise<DefencePreparation> =>
    unwrap(await client.post<Wrap<DefencePreparation>>(
      `/api/v1/research/projects/${projectId}/generate-defence`,
    )),

  getDefence: async (projectId: string): Promise<DefencePreparation | null> => {
    try {
      return unwrap(await client.get<Wrap<DefencePreparation>>(
        `/api/v1/research/projects/${projectId}/defence`,
      ))
    } catch {
      return null
    }
  },

  exportThesisDocx: async (projectId: string): Promise<Blob> => {
    const res = await client.get<Blob>(
      `/api/v1/research/projects/${projectId}/export-thesis-docx`,
      { responseType: 'blob' },
    )
    return res.data
  },

  // ── Thesis Studio: audit-gated transition to thesis ───────────────────────

  getThesisAudit: async (projectId: string): Promise<ThesisAuditResult> =>
    unwrap(await client.get<Wrap<ThesisAuditResult>>(
      `/api/v1/research/projects/${projectId}/thesis-audit`,
      { timeout: 120_000 },
    )),

  answerThesisAuditQuestion: async (
    projectId: string, questionKey: string, answer: string,
  ): Promise<ThesisAuditResult> =>
    unwrap(await client.post<Wrap<ThesisAuditResult>>(
      `/api/v1/research/projects/${projectId}/thesis-audit/answer`,
      { questionKey, answer },
      { timeout: 120_000 },
    )),

  // ── Thesis Foundation (Phase 1) ─────────────────────────────────────────────

  setResearchState: async (projectId: string, researchState: ResearchState): Promise<ResearchProject> =>
    unwrap(await client.patch<Wrap<ResearchProject>>(
      `/api/v1/research/projects/${projectId}/research-state`,
      { researchState },
    )),

  getCanonicalResearchPlans: async (projectId: string): Promise<CanonicalResearchPlan[]> =>
    unwrap(await client.get<Wrap<CanonicalResearchPlan[]>>(
      `/api/v1/research/projects/${projectId}/canonical-plan`,
    )),

  getThesisChapterPlan: async (projectId: string): Promise<ThesisChapterPlan> =>
    unwrap(await client.get<Wrap<ThesisChapterPlan>>(
      `/api/v1/research/projects/${projectId}/thesis-chapter-plan`,
    )),

  listUniversityTemplates: async (): Promise<UniversityTemplateSummary[]> =>
    unwrap(await client.get<Wrap<UniversityTemplateSummary[]>>('/api/v1/university-templates')),

  getUniversityTemplate: async (id: string): Promise<UniversityTemplateDetail> =>
    unwrap(await client.get<Wrap<UniversityTemplateDetail>>(`/api/v1/university-templates/${id}`)),

  setUniversityTemplate: async (projectId: string, universityTemplateId: string | null): Promise<ResearchProject> =>
    unwrap(await client.patch<Wrap<ResearchProject>>(
      `/api/v1/research/projects/${projectId}/university-template`,
      { universityTemplateId },
    )),

  // ── Thesis Foundation (Phase 2) ─────────────────────────────────────────────

  getSectionVersions: async (projectId: string, code: string): Promise<ProjectSectionVersion[]> =>
    unwrap(await client.get<Wrap<ProjectSectionVersion[]>>(
      `/api/v1/research/projects/${projectId}/sections/${code}/versions`,
    )),

  restoreSectionVersion: async (projectId: string, code: string, versionNumber: number): Promise<ProjectSection> =>
    unwrap(await client.post<Wrap<ProjectSection>>(
      `/api/v1/research/projects/${projectId}/sections/${code}/versions/${versionNumber}/restore`,
    )),

  previewContentMapping: async (projectId: string): Promise<ProposalThesisMappingResult> =>
    unwrap(await client.get<Wrap<ProposalThesisMappingResult>>(
      `/api/v1/research/projects/${projectId}/thesis/content-mapping/preview`,
    )),

  applyContentMapping: async (projectId: string): Promise<ProposalThesisMappingResult> =>
    unwrap(await client.post<Wrap<ProposalThesisMappingResult>>(
      `/api/v1/research/projects/${projectId}/thesis/content-mapping/apply`,
    )),

  getEvidenceCoverageAudit: async (projectId: string, code: string): Promise<SectionEvidenceCoverageAudit> =>
    unwrap(await client.get<Wrap<SectionEvidenceCoverageAudit>>(
      `/api/v1/research/projects/${projectId}/sections/${code}/evidence-coverage-audit`,
    )),

  uploadExternalProposal: async (file: File): Promise<{ jobId: string }> => {
    const form = new FormData()
    form.append('file', file)
    return unwrap(await client.post<Wrap<{ jobId: string }>>(
      '/api/v1/research/projects/upload-external-proposal',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60_000 },
    ))
  },

  pollProposalJob: async (jobId: string): Promise<ExternalProposalJobResult> =>
    unwrap(await client.get<Wrap<ExternalProposalJobResult>>(
      `/api/v1/research/projects/proposal-jobs/${jobId}`,
    )),

  importLiteratureCsv: async (projectId: string, csv: string): Promise<LiteratureCsvImportResult> =>
    unwrap(await client.post<Wrap<LiteratureCsvImportResult>>(
      `/api/v1/research/projects/${projectId}/literature/import-csv`,
      { csv },
    )),

  // ── Literature Discovery (Gather step's second tab) ────────────────────────

  getDiscoveryConfig: async (projectId: string): Promise<DiscoveryConfig> =>
    unwrap(await client.get<Wrap<DiscoveryConfig>>(
      `/api/v1/research/projects/${projectId}/literature-discovery/config`,
    )),

  updateDiscoveryConfig: async (
    projectId: string,
    payload: {
      strategy: string; candidateCap: number; selectedDatabases: string[]
      topicScope?: TopicScope; dimensions: LiteratureDimension[]
    },
  ): Promise<DiscoveryConfig> =>
    unwrap(await client.put<Wrap<DiscoveryConfig>>(
      `/api/v1/research/projects/${projectId}/literature-discovery/config`,
      payload,
    )),

  generateTopicScope: async (projectId: string): Promise<TopicScope> =>
    unwrap(await client.post<Wrap<TopicScope>>(
      `/api/v1/research/projects/${projectId}/literature-discovery/topic-scope/generate`,
    )),

  generateDiscoveryDimensions: async (projectId: string): Promise<LiteratureDimension[]> =>
    unwrap(await client.post<Wrap<LiteratureDimension[]>>(
      `/api/v1/research/projects/${projectId}/literature-discovery/dimensions/generate`,
    )),

  generateDiscoveryQueries: async (projectId: string): Promise<LiteratureSearchQuery[]> =>
    unwrap(await client.post<Wrap<LiteratureSearchQuery[]>>(
      `/api/v1/research/projects/${projectId}/literature-discovery/queries/generate`,
    )),

  listDiscoveryQueries: async (projectId: string): Promise<LiteratureSearchQuery[]> =>
    unwrap(await client.get<Wrap<LiteratureSearchQuery[]>>(
      `/api/v1/research/projects/${projectId}/literature-discovery/queries`,
    )),

  createDiscoveryQuery: async (projectId: string, title?: string): Promise<LiteratureSearchQuery> =>
    unwrap(await client.post<Wrap<LiteratureSearchQuery>>(
      `/api/v1/research/projects/${projectId}/literature-discovery/queries`,
      { title },
    )),

  updateDiscoveryQuery: async (
    projectId: string,
    queryId: string,
    payload: { title: string; queryText: string; description: string; enabled: boolean },
  ): Promise<LiteratureSearchQuery> =>
    unwrap(await client.put<Wrap<LiteratureSearchQuery>>(
      `/api/v1/research/projects/${projectId}/literature-discovery/queries/${queryId}`,
      payload,
    )),

  duplicateDiscoveryQuery: async (projectId: string, queryId: string): Promise<LiteratureSearchQuery> =>
    unwrap(await client.post<Wrap<LiteratureSearchQuery>>(
      `/api/v1/research/projects/${projectId}/literature-discovery/queries/${queryId}/duplicate`,
    )),

  deleteDiscoveryQuery: async (projectId: string, queryId: string): Promise<void> => {
    await client.delete(`/api/v1/research/projects/${projectId}/literature-discovery/queries/${queryId}`)
  },

  startDiscovery: async (projectId: string): Promise<void> => {
    await client.post(`/api/v1/research/projects/${projectId}/literature-discovery/start`)
  },

  stopDiscovery: async (projectId: string): Promise<void> => {
    await client.post(`/api/v1/research/projects/${projectId}/literature-discovery/stop`)
  },

  getDiscoveryStatus: async (projectId: string): Promise<DiscoveryStatus> =>
    unwrap(await client.get<Wrap<DiscoveryStatus>>(
      `/api/v1/research/projects/${projectId}/literature-discovery/status`,
    )),

  importManualPaper: async (projectId: string, payload: ImportManualPaperPayload): Promise<DiscoveryStatus> =>
    unwrap(await client.post<Wrap<DiscoveryStatus>>(
      `/api/v1/research/projects/${projectId}/literature-discovery/manual-import`,
      payload,
    )),

  retryFailedSources: async (projectId: string): Promise<void> => {
    await client.post(`/api/v1/research/projects/${projectId}/literature-discovery/retry-failed-sources`)
  },

  startTargetedDiscovery: async (projectId: string, dimensionName: string): Promise<void> => {
    await client.post(
      `/api/v1/research/projects/${projectId}/literature-discovery/dimensions/${encodeURIComponent(dimensionName)}/targeted-discovery`,
    )
  },

  // ── Evidence Screening (Gather step's "Screen" step) ────────────────────────

  startScreening: async (projectId: string): Promise<void> => {
    await client.post(`/api/v1/research/projects/${projectId}/screening/start`)
  },

  stopScreening: async (projectId: string): Promise<void> => {
    await client.post(`/api/v1/research/projects/${projectId}/screening/stop`)
  },

  getScreeningStatus: async (projectId: string): Promise<ScreeningStatus> =>
    unwrap(await client.get<Wrap<ScreeningStatus>>(
      `/api/v1/research/projects/${projectId}/screening/status`,
    )),

  approveCorpus: async (projectId: string, payload: ApproveCorpusPayload = {}): Promise<ScreeningStatus> =>
    unwrap(await client.post<Wrap<ScreeningStatus>>(
      `/api/v1/research/projects/${projectId}/screening/approve-corpus`,
      payload,
    )),

  getDimensionCoverage: async (projectId: string): Promise<DimensionCoverageSummary> =>
    unwrap(await client.get<Wrap<DimensionCoverageSummary>>(
      `/api/v1/research/projects/${projectId}/screening/dimension-coverage`,
    )),

  getDiversifiedShortlist: async (projectId: string): Promise<DiversifiedShortlist> =>
    unwrap(await client.get<Wrap<DiversifiedShortlist>>(
      `/api/v1/research/projects/${projectId}/screening/shortlist`,
    )),

  getScreeningCandidates: async (
    projectId: string, filters: ScreeningCandidateFilters,
  ): Promise<ScreeningCandidateList> =>
    unwrap(await client.get<Wrap<ScreeningCandidateList>>(
      `/api/v1/research/projects/${projectId}/screening/candidates`,
      { params: filters },
    )),

  updateManualDecision: async (
    projectId: string, candidateId: string, decision: 'Automatic' | 'Include' | 'Exclude',
  ): Promise<ScreeningCandidate> =>
    unwrap(await client.patch<Wrap<ScreeningCandidate>>(
      `/api/v1/research/projects/${projectId}/screening/candidates/${candidateId}/decision`,
      { decision },
    )),

  uploadCandidatePdf: async (projectId: string, candidateId: string, file: File): Promise<ScreeningCandidate> => {
    const formData = new FormData()
    formData.append('file', file)
    return unwrap(await client.post<Wrap<ScreeningCandidate>>(
      `/api/v1/research/projects/${projectId}/screening/candidates/${candidateId}/pdf`,
      formData,
    ))
  },

  // ── Research Roadmap ───────────────────────────────────────────────────────

  getRoadmap: async (projectId: string): Promise<ResearchRoadmap> =>
    unwrap(await client.get<Wrap<ResearchRoadmap>>(
      `/api/v1/research/projects/${projectId}/roadmap`,
    )),

  updateMilestone: async (
    projectId: string, milestoneKey: string, status: MilestoneStatus, notes?: string,
  ): Promise<ResearchRoadmap> =>
    unwrap(await client.patch<Wrap<ResearchRoadmap>>(
      `/api/v1/research/projects/${projectId}/roadmap/${milestoneKey}`,
      { status, notes },
    )),

  // ── Instrument Designer ──────────────────────────────────────────────────────

  getAvailableInstrumentTypes: async (projectId: string): Promise<InstrumentType[]> =>
    unwrap(await client.get<Wrap<InstrumentType[]>>(
      `/api/v1/instruments/projects/${projectId}/available-types`,
    )),

  getInstruments: async (projectId: string): Promise<InstrumentSummary[]> =>
    unwrap(await client.get<Wrap<InstrumentSummary[]>>(
      `/api/v1/instruments/projects/${projectId}`,
    )),

  createInstrument: async (
    projectId: string, instrumentType: InstrumentType, title: string,
  ): Promise<InstrumentSummary> =>
    unwrap(await client.post<Wrap<InstrumentSummary>>(
      `/api/v1/instruments/projects/${projectId}`,
      { instrumentType, title },
    )),

  importInstrument: async (
    projectId: string, instrumentType: InstrumentType, title: string,
    source: Exclude<InstrumentSource, 'AiGenerated'>, content: string, fileName?: string | null,
    file?: File | null,
  ): Promise<InstrumentDetail> => {
    const form = new FormData()
    form.append('instrumentType', instrumentType)
    form.append('title', title)
    form.append('source', source)
    form.append('content', content)
    if (fileName) form.append('fileName', fileName)
    if (file) form.append('file', file)
    return unwrap(await client.post<Wrap<InstrumentDetail>>(
      `/api/v1/instruments/projects/${projectId}/import`,
      form,
    ))
  },

  downloadInstrumentFile: async (instrumentId: string): Promise<Blob> => {
    const res = await client.get<Blob>(
      `/api/v1/instruments/${instrumentId}/file`,
      { responseType: 'blob' },
    )
    return res.data
  },

  generateInstrumentItems: async (
    instrumentId: string, researchQuestionNumbers?: number[],
  ): Promise<InstrumentDetail> =>
    unwrap(await client.post<Wrap<InstrumentDetail>>(
      `/api/v1/instruments/${instrumentId}/generate`,
      { researchQuestionNumbers: researchQuestionNumbers ?? null },
    )),

  getInstrument: async (instrumentId: string): Promise<InstrumentDetail> =>
    unwrap(await client.get<Wrap<InstrumentDetail>>(
      `/api/v1/instruments/${instrumentId}`,
    )),

  updateInstrumentStatus: async (
    instrumentId: string, status: InstrumentStatus,
  ): Promise<InstrumentDetail> =>
    unwrap(await client.patch<Wrap<InstrumentDetail>>(
      `/api/v1/instruments/${instrumentId}`,
      { status },
    )),

  // ── Readiness Engine ───────────────────────────────────────────────────────

  getReadiness: async (targetType: string, targetId: string): Promise<ReadinessEvaluation> =>
    unwrap(await client.get<Wrap<ReadinessEvaluation>>(
      `/api/v1/readiness/${targetType}/${targetId}`,
    )),

  refreshReadiness: async (targetType: string, targetId: string): Promise<ReadinessEvaluation> =>
    unwrap(await client.post<Wrap<ReadinessEvaluation>>(
      `/api/v1/readiness/${targetType}/${targetId}/refresh`,
    )),

  // ── Knowledge Graph ────────────────────────────────────────────────────────

  getGraphGaps: async (projectId: string, nodeType: string, relationType: string): Promise<GraphGap[]> =>
    unwrap(await client.get<Wrap<GraphGap[]>>(
      `/api/v1/graph/projects/${projectId}/gaps`,
      { params: { nodeType, relationType } },
    )),

  // ── Validation Engine ──────────────────────────────────────────────────────

  getValidationSummary: async (projectId: string): Promise<ValidationSummary> =>
    unwrap(await client.get<Wrap<ValidationSummary>>(
      `/api/v1/validation/projects/${projectId}`,
    )),

  revalidate: async (projectId: string): Promise<ValidationSummary> =>
    unwrap(await client.post<Wrap<ValidationSummary>>(
      `/api/v1/validation/projects/${projectId}/revalidate`,
    )),

  // ── Methodology-anchor citations (ambiguous match review) ───────────────────

  getMethodologyAnchorCandidates: async (projectId: string): Promise<MethodologyAnchorCandidate[]> =>
    unwrap(await client.get<Wrap<MethodologyAnchorCandidate[]>>(
      `/api/v1/research/projects/${projectId}/methodology-anchor-candidates`,
    )),

  resolveMethodologyAnchorCandidate: async (
    projectId: string, candidateId: string, accept: boolean,
  ): Promise<void> => {
    await client.post(
      `/api/v1/research/projects/${projectId}/methodology-anchor-candidates/${candidateId}/resolve`,
      { accept },
    )
  },

  getEthicsChecklist: async (projectId: string): Promise<EthicsChecklist> =>
    unwrap(await client.get<Wrap<EthicsChecklist>>(`/api/v1/ethics/projects/${projectId}/documents`)),

  proposeEthicsClassification: async (projectId: string): Promise<MethodologyClassification> =>
    unwrap(await client.post<Wrap<MethodologyClassification>>(`/api/v1/ethics/projects/${projectId}/classify`)),

  confirmEthicsClassification: async (
    projectId: string, payload: ConfirmMethodologyClassificationPayload,
  ): Promise<EthicsChecklist> =>
    unwrap(await client.post<Wrap<EthicsChecklist>>(`/api/v1/ethics/projects/${projectId}/classify/confirm`, payload)),

  draftEthicsDocument: async (projectId: string, documentType: string): Promise<EthicsDocument> =>
    unwrap(await client.post<Wrap<EthicsDocument>>(`/api/v1/ethics/projects/${projectId}/documents/${encodeURIComponent(documentType)}/draft`)),

  updateEthicsDocumentStatus: async (
    projectId: string, documentType: string, status: Exclude<EthicsDocumentStatus, 'Required' | 'NotApplicable'>,
  ): Promise<EthicsDocument> =>
    unwrap(await client.patch<Wrap<EthicsDocument>>(
      `/api/v1/ethics/projects/${projectId}/documents/${encodeURIComponent(documentType)}/status`, { status },
    )),
}
