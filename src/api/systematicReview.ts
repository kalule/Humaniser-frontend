import client from './client'
import type {
  CriterionType,
  EligibilityCriterion,
  ProtocolAmendment,
  ReviewCreationPath,
  ReviewProtocol,
  SearchStringItem,
  SearchStringUse,
  SuggestedCriterion,
  SystematicReview,
  SystematicReviewDetail,
} from '../types/systematicReview'

type Wrap<T> = { success: boolean; data: T }
const unwrap = <T>(res: { data: Wrap<T> }): T => res.data.data ?? (res.data as unknown as T)

export interface CreateSystematicReviewPayload {
  researchQuestion?: string | null
  creationPath:      ReviewCreationPath
}

export interface CriterionPayload {
  type:            CriterionType
  name:            string
  description:     string
  searchStringUse: SearchStringUse
  include?:        string | null
  exclude?:        string | null
}

export const systematicReviewApi = {
  list: async (search?: string): Promise<SystematicReview[]> =>
    unwrap(await client.get<Wrap<SystematicReview[]>>('/api/v1/systematicreview', {
      params: search ? { search } : undefined,
    })),

  create: async (payload: CreateSystematicReviewPayload): Promise<SystematicReview> =>
    unwrap(await client.post<Wrap<SystematicReview>>('/api/v1/systematicreview', payload)),

  delete: async (id: string): Promise<void> => {
    await client.delete(`/api/v1/systematicreview/${id}`)
  },

  // ── Eligibility Criteria step ────────────────────────────────────────────

  getDetail: async (id: string): Promise<SystematicReviewDetail> =>
    unwrap(await client.get<Wrap<SystematicReviewDetail>>(`/api/v1/systematicreview/${id}`)),

  addCriterion: async (id: string, payload: CriterionPayload): Promise<EligibilityCriterion> =>
    unwrap(await client.post<Wrap<EligibilityCriterion>>(`/api/v1/systematicreview/${id}/criteria`, payload)),

  updateCriterion: async (id: string, criterionId: string, payload: Omit<CriterionPayload, 'type'>): Promise<EligibilityCriterion> =>
    unwrap(await client.put<Wrap<EligibilityCriterion>>(`/api/v1/systematicreview/${id}/criteria/${criterionId}`, payload)),

  deleteCriterion: async (id: string, criterionId: string): Promise<void> => {
    await client.delete(`/api/v1/systematicreview/${id}/criteria/${criterionId}`)
  },

  updateProtocol: async (id: string, payload: ReviewProtocol): Promise<ReviewProtocol> =>
    unwrap(await client.put<Wrap<ReviewProtocol>>(`/api/v1/systematicreview/${id}/protocol`, payload)),

  suggestCriteria: async (id: string, description: string): Promise<SuggestedCriterion[]> => {
    const res = unwrap(await client.post<Wrap<{ suggestions: SuggestedCriterion[] }>>(
      `/api/v1/systematicreview/${id}/suggest-criteria`, { description },
    ))
    return res.suggestions
  },

  getProtocolAmendments: async (id: string): Promise<ProtocolAmendment[]> =>
    unwrap(await client.get<Wrap<ProtocolAmendment[]>>(`/api/v1/systematicreview/${id}/protocol/amendments`)),

  // ── Form Search Strings step ─────────────────────────────────────────────
  // Search strings are independent, user-manageable query blocks — not bound to a source.

  listSearchStrings: async (id: string): Promise<SearchStringItem[]> =>
    unwrap(await client.get<Wrap<SearchStringItem[]>>(`/api/v1/systematicreview/${id}/search-strings`)),

  /** AI-generates a fresh set of search strings from criteria, replacing all existing ones. */
  generateSearchStrings: async (id: string): Promise<SearchStringItem[]> =>
    unwrap(await client.post<Wrap<SearchStringItem[]>>(`/api/v1/systematicreview/${id}/search-strings/generate`)),

  createSearchString: async (id: string): Promise<SearchStringItem> =>
    unwrap(await client.post<Wrap<SearchStringItem>>(`/api/v1/systematicreview/${id}/search-strings`)),

  deleteSearchString: async (id: string, stringId: string): Promise<void> => {
    await client.delete(`/api/v1/systematicreview/${id}/search-strings/${stringId}`)
  },

  updateSearchString: async (id: string, stringId: string, queryText: string): Promise<SearchStringItem> =>
    unwrap(await client.put<Wrap<SearchStringItem>>(`/api/v1/systematicreview/${id}/search-strings/${stringId}`, { queryText })),

  addSearchTerm: async (id: string, stringId: string, term: string): Promise<SearchStringItem> =>
    unwrap(await client.post<Wrap<SearchStringItem>>(`/api/v1/systematicreview/${id}/search-strings/${stringId}/terms`, { term })),

  removeSearchTerm: async (id: string, stringId: string, termIndex: number): Promise<SearchStringItem> =>
    unwrap(await client.delete<Wrap<SearchStringItem>>(`/api/v1/systematicreview/${id}/search-strings/${stringId}/terms/${termIndex}`)),

  clearSearchString: async (id: string, stringId: string): Promise<SearchStringItem> =>
    unwrap(await client.post<Wrap<SearchStringItem>>(`/api/v1/systematicreview/${id}/search-strings/${stringId}/clear`)),

  validateSearchString: async (id: string, stringId: string, queryText: string): Promise<{ isValid: boolean; errors: string[] }> =>
    unwrap(await client.post<Wrap<{ isValid: boolean; errors: string[] }>>(
      `/api/v1/systematicreview/${id}/search-strings/${stringId}/validate`, { queryText },
    )),

  getSearchStringHistory: async (id: string): Promise<import('../types/systematicReview').SearchStringHistoryItem[]> =>
    unwrap(await client.get<Wrap<import('../types/systematicReview').SearchStringHistoryItem[]>>(
      `/api/v1/systematicreview/${id}/search-strings/history`,
    )),

  markCheckpointReviewed: async (id: string, stepId: string): Promise<Record<string, string>> =>
    unwrap(await client.post<Wrap<Record<string, string>>>(`/api/v1/systematicreview/${id}/checkpoints/${stepId}`)),

  // ── Fetch Papers step ────────────────────────────────────────────────────
  
  fetchPapers: async (id: string): Promise<{ jobId: string }> =>
    unwrap(await client.post<Wrap<{ jobId: string }>>(`/api/v1/systematicreview/${id}/fetch-papers`)),

  getFetchStatus: async (id: string): Promise<import('../types/systematicReview').FetchStatus> =>
    unwrap(await client.get<Wrap<import('../types/systematicReview').FetchStatus>>(`/api/v1/systematicreview/${id}/fetch-status`)),

  getPapers: async (
    id: string,
    params?: { queryId?: string; search?: string; filter?: 'all' | 'web' | 'library'; source?: string; page?: number; pageSize?: number }
  ): Promise<import('../types/systematicReview').PaginatedPapers> =>
    unwrap(await client.get<Wrap<import('../types/systematicReview').PaginatedPapers>>(`/api/v1/systematicreview/${id}/papers`, { params })),

  // ── Deduplication & mechanical filters step ──────────────────────────────
  // Filter fields are edited via updateProtocol above (shared with Eligibility Criteria) —
  // these two calls only run and read back the dedup/exclusion computation.

  runDedupeAndFilter: async (id: string): Promise<import('../types/systematicReview').DedupeRun> =>
    unwrap(await client.post<Wrap<import('../types/systematicReview').DedupeRun>>(`/api/v1/systematicreview/${id}/dedupe-and-filter`)),

  getLatestDedupeRun: async (id: string): Promise<import('../types/systematicReview').DedupeRun | null> =>
    unwrap(await client.get<Wrap<import('../types/systematicReview').DedupeRun | null>>(`/api/v1/systematicreview/${id}/dedupe-and-filter/latest`)),

  // ── Title & abstract screening step ───────────────────────────────────────

  getScreeningRecords: async (
    id: string,
    params?: { search?: string; source?: string; status?: string; page?: number; pageSize?: number }
  ): Promise<import('../types/systematicReview').PaginatedScreening> =>
    unwrap(await client.get<Wrap<import('../types/systematicReview').PaginatedScreening>>(
      `/api/v1/systematicreview/${id}/screening/title-abstract`, { params },
    )),

  runAiScreening: async (id: string): Promise<{ jobId: string }> =>
    unwrap(await client.post<Wrap<{ jobId: string }>>(`/api/v1/systematicreview/${id}/screening/title-abstract/run-ai`)),

  getScreeningRunStatus: async (id: string): Promise<import('../types/systematicReview').ScreeningRunStatus> =>
    unwrap(await client.get<Wrap<import('../types/systematicReview').ScreeningRunStatus>>(
      `/api/v1/systematicreview/${id}/screening/title-abstract/run-status`,
    )),

  updateScreeningDecision: async (
    id: string, decisionId: string, verdict: import('../types/systematicReview').ScreeningVerdict
  ): Promise<import('../types/systematicReview').ScreeningDecision> =>
    unwrap(await client.put<Wrap<import('../types/systematicReview').ScreeningDecision>>(
      `/api/v1/systematicreview/${id}/screening/decisions/${decisionId}`, { verdict },
    )),

  // ── Screening agreement check (dual-reviewer QA overlay) ─────────────────

  runScreeningAgreementCheck: async (id: string): Promise<{ jobId: string }> =>
    unwrap(await client.post<Wrap<{ jobId: string }>>(`/api/v1/systematicreview/${id}/screening/title-abstract/agreement-check/run`)),

  getScreeningAgreementRunStatus: async (id: string): Promise<import('../types/systematicReview').ScreeningAgreementRunStatus> =>
    unwrap(await client.get<Wrap<import('../types/systematicReview').ScreeningAgreementRunStatus>>(
      `/api/v1/systematicreview/${id}/screening/title-abstract/agreement-check/run-status`,
    )),

  getScreeningAgreementSummary: async (id: string): Promise<import('../types/systematicReview').ScreeningAgreementSummary> =>
    unwrap(await client.get<Wrap<import('../types/systematicReview').ScreeningAgreementSummary>>(
      `/api/v1/systematicreview/${id}/screening/title-abstract/agreement-check/summary`,
    )),

  // ── Full text screening step ──────────────────────────────────────────────

  getFullTextScreeningRecords: async (
    id: string,
    params?: { search?: string; source?: string; filter?: import('../types/systematicReview').FullTextScreeningFilter; page?: number; pageSize?: number }
  ): Promise<import('../types/systematicReview').PaginatedFullTextScreening> =>
    unwrap(await client.get<Wrap<import('../types/systematicReview').PaginatedFullTextScreening>>(
      `/api/v1/systematicreview/${id}/screening/full-text`, { params },
    )),

  uploadPdf: async (
    id: string, paperId: string, file: File
  ): Promise<import('../types/systematicReview').FullTextScreeningRecord> => {
    const form = new FormData()
    form.append('file', file)
    return unwrap(await client.post<Wrap<import('../types/systematicReview').FullTextScreeningRecord>>(
      `/api/v1/systematicreview/${id}/papers/${paperId}/pdf`, form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    ))
  },

  useAbstractFallback: async (
    id: string, paperId: string
  ): Promise<import('../types/systematicReview').FullTextScreeningRecord> =>
    unwrap(await client.post<Wrap<import('../types/systematicReview').FullTextScreeningRecord>>(
      `/api/v1/systematicreview/${id}/papers/${paperId}/use-abstract-fallback`,
    )),

  useAbstractFallbackForAll: async (id: string): Promise<{ affectedCount: number }> =>
    unwrap(await client.post<Wrap<{ affectedCount: number }>>(
      `/api/v1/systematicreview/${id}/screening/full-text/use-abstract-for-all`,
    )),

  runFullTextScreening: async (id: string): Promise<{ jobId: string }> =>
    unwrap(await client.post<Wrap<{ jobId: string }>>(`/api/v1/systematicreview/${id}/screening/full-text/run`)),

  getFullTextScreeningRunStatus: async (id: string): Promise<import('../types/systematicReview').FullTextScreeningRunStatus> =>
    unwrap(await client.get<Wrap<import('../types/systematicReview').FullTextScreeningRunStatus>>(
      `/api/v1/systematicreview/${id}/screening/full-text/run-status`,
    )),

  /** Lazily fetched only when a reviewer toggles a row to "Full text" — not part of the paginated list response. */
  getPaperFullText: async (id: string, paperId: string): Promise<{ fullTextContent: string | null }> =>
    unwrap(await client.get<Wrap<{ fullTextContent: string | null }>>(
      `/api/v1/systematicreview/${id}/papers/${paperId}/full-text`,
    )),

  // ── Shared review-wide summary bar ────────────────────────────────────────

  getReviewSummary: async (id: string): Promise<import('../types/systematicReview').ReviewSummary> =>
    unwrap(await client.get<Wrap<import('../types/systematicReview').ReviewSummary>>(`/api/v1/systematicreview/${id}/summary`)),

  // ── Data Extraction step ──────────────────────────────────────────────────

  listExtractionVariables: async (id: string): Promise<import('../types/systematicReview').ExtractionVariable[]> =>
    unwrap(await client.get<Wrap<import('../types/systematicReview').ExtractionVariable[]>>(`/api/v1/systematicreview/${id}/extraction-variables`)),

  addExtractionVariable: async (
    id: string, name: string, isAiSuggested = false
  ): Promise<import('../types/systematicReview').ExtractionVariable> =>
    unwrap(await client.post<Wrap<import('../types/systematicReview').ExtractionVariable>>(
      `/api/v1/systematicreview/${id}/extraction-variables`, { name, isAiSuggested },
    )),

  suggestExtractionVariables: async (id: string): Promise<string[]> => {
    const res = unwrap(await client.post<Wrap<{ suggestions: string[] }>>(
      `/api/v1/systematicreview/${id}/extraction-variables/suggest`,
    ))
    return res.suggestions
  },

  deleteExtractionVariable: async (id: string, variableId: string): Promise<void> => {
    await client.delete(`/api/v1/systematicreview/${id}/extraction-variables/${variableId}`)
  },

  setExtractionVariableOutcome: async (
    id: string, variableId: string, isOutcome: boolean
  ): Promise<import('../types/systematicReview').ExtractionVariable> =>
    unwrap(await client.put<Wrap<import('../types/systematicReview').ExtractionVariable>>(
      `/api/v1/systematicreview/${id}/extraction-variables/${variableId}/outcome`, { isOutcome },
    )),

  clearExtractionVariables: async (id: string): Promise<{ removedVariableCount: number; removedValueCount: number }> =>
    unwrap(await client.post<Wrap<{ removedVariableCount: number; removedValueCount: number }>>(
      `/api/v1/systematicreview/${id}/extraction-variables/clear`,
    )),

  getExtractionRecords: async (
    id: string,
    params?: { search?: string; source?: string; filter?: import('../types/systematicReview').ExtractionFilter; page?: number; pageSize?: number }
  ): Promise<import('../types/systematicReview').PaginatedExtraction> =>
    unwrap(await client.get<Wrap<import('../types/systematicReview').PaginatedExtraction>>(
      `/api/v1/systematicreview/${id}/extraction`, { params },
    )),

  runExtraction: async (id: string): Promise<{ jobId: string }> =>
    unwrap(await client.post<Wrap<{ jobId: string }>>(`/api/v1/systematicreview/${id}/extraction/run`)),

  getExtractionRunStatus: async (id: string): Promise<import('../types/systematicReview').ExtractionRunStatus> =>
    unwrap(await client.get<Wrap<import('../types/systematicReview').ExtractionRunStatus>>(
      `/api/v1/systematicreview/${id}/extraction/run-status`,
    )),

  rerunExtractionForPaper: async (id: string, paperId: string): Promise<import('../types/systematicReview').ExtractionRecord> =>
    unwrap(await client.post<Wrap<import('../types/systematicReview').ExtractionRecord>>(
      `/api/v1/systematicreview/${id}/papers/${paperId}/extraction/rerun`,
    )),

  updateExtractedValue: async (
    id: string, valueId: string, value: string | null
  ): Promise<import('../types/systematicReview').ExtractedValueItem> =>
    unwrap(await client.put<Wrap<import('../types/systematicReview').ExtractedValueItem>>(
      `/api/v1/systematicreview/${id}/extraction/values/${valueId}`, { value },
    )),

  skipExtraction: async (id: string): Promise<void> => {
    await client.post(`/api/v1/systematicreview/${id}/extraction/skip`)
  },

  // ── Risk of Bias Assessment step ─────────────────────────────────────────────

  getRiskOfBiasRecords: async (
    id: string,
    params?: { search?: string; source?: string; filter?: import('../types/systematicReview').RiskOfBiasFilter; page?: number; pageSize?: number }
  ): Promise<import('../types/systematicReview').PaginatedRiskOfBias> =>
    unwrap(await client.get<Wrap<import('../types/systematicReview').PaginatedRiskOfBias>>(
      `/api/v1/systematicreview/${id}/risk-of-bias`, { params },
    )),

  runRiskOfBiasAssessment: async (id: string): Promise<{ jobId: string }> =>
    unwrap(await client.post<Wrap<{ jobId: string }>>(`/api/v1/systematicreview/${id}/risk-of-bias/run`)),

  getRiskOfBiasRunStatus: async (id: string): Promise<import('../types/systematicReview').RiskOfBiasRunStatus> =>
    unwrap(await client.get<Wrap<import('../types/systematicReview').RiskOfBiasRunStatus>>(
      `/api/v1/systematicreview/${id}/risk-of-bias/run-status`,
    )),

  rerunRiskOfBiasForPaper: async (id: string, paperId: string): Promise<import('../types/systematicReview').RiskOfBiasRecord> =>
    unwrap(await client.post<Wrap<import('../types/systematicReview').RiskOfBiasRecord>>(
      `/api/v1/systematicreview/${id}/papers/${paperId}/risk-of-bias/rerun`,
    )),

  updateRiskOfBiasRating: async (
    id: string, ratingId: string, rating: import('../types/systematicReview').RiskOfBiasRating
  ): Promise<import('../types/systematicReview').RiskOfBiasDomainRating> =>
    unwrap(await client.put<Wrap<import('../types/systematicReview').RiskOfBiasDomainRating>>(
      `/api/v1/systematicreview/${id}/risk-of-bias/ratings/${ratingId}`, { rating },
    )),

  skipRiskOfBias: async (id: string): Promise<void> => {
    await client.post(`/api/v1/systematicreview/${id}/risk-of-bias/skip`)
  },

  setRiskOfBiasTool: async (id: string, tool: import('../types/systematicReview').RiskOfBiasTool): Promise<import('../types/systematicReview').RiskOfBiasTool> =>
    unwrap(await client.put<Wrap<import('../types/systematicReview').RiskOfBiasTool>>(
      `/api/v1/systematicreview/${id}/risk-of-bias-tool`, { tool },
    )),

  // ── ROBINS-I (Risk of Bias Assessment step, alternative tool) ────────────────

  getRobinsIRecords: async (
    id: string,
    params?: { search?: string; source?: string; filter?: import('../types/systematicReview').RiskOfBiasFilter; page?: number; pageSize?: number }
  ): Promise<import('../types/systematicReview').PaginatedRobinsI> =>
    unwrap(await client.get<Wrap<import('../types/systematicReview').PaginatedRobinsI>>(
      `/api/v1/systematicreview/${id}/robins-i`, { params },
    )),

  runRobinsIAssessment: async (id: string): Promise<{ jobId: string }> =>
    unwrap(await client.post<Wrap<{ jobId: string }>>(`/api/v1/systematicreview/${id}/robins-i/run`)),

  getRobinsIRunStatus: async (id: string): Promise<import('../types/systematicReview').RobinsIRunStatus> =>
    unwrap(await client.get<Wrap<import('../types/systematicReview').RobinsIRunStatus>>(
      `/api/v1/systematicreview/${id}/robins-i/run-status`,
    )),

  rerunRobinsIForPaper: async (id: string, paperId: string): Promise<import('../types/systematicReview').RobinsIRecord> =>
    unwrap(await client.post<Wrap<import('../types/systematicReview').RobinsIRecord>>(
      `/api/v1/systematicreview/${id}/papers/${paperId}/robins-i/rerun`,
    )),

  updateRobinsIRating: async (
    id: string, ratingId: string, rating: import('../types/systematicReview').RobinsIRatingValue
  ): Promise<import('../types/systematicReview').RobinsIDomainRating> =>
    unwrap(await client.put<Wrap<import('../types/systematicReview').RobinsIDomainRating>>(
      `/api/v1/systematicreview/${id}/robins-i/ratings/${ratingId}`, { rating },
    )),

  // ── Evidence Grading step ────────────────────────────────────────────────────

  getEvidenceGradingRecords: async (id: string): Promise<import('../types/systematicReview').EvidenceGradingRecordsResponse> =>
    unwrap(await client.get<Wrap<import('../types/systematicReview').EvidenceGradingRecordsResponse>>(
      `/api/v1/systematicreview/${id}/evidence-grading`,
    )),

  runEvidenceGrading: async (id: string): Promise<{ jobId: string }> =>
    unwrap(await client.post<Wrap<{ jobId: string }>>(`/api/v1/systematicreview/${id}/evidence-grading/run`)),

  getEvidenceGradingRunStatus: async (id: string): Promise<import('../types/systematicReview').EvidenceGradingRunStatus> =>
    unwrap(await client.get<Wrap<import('../types/systematicReview').EvidenceGradingRunStatus>>(
      `/api/v1/systematicreview/${id}/evidence-grading/run-status`,
    )),

  updateGradeRating: async (
    id: string, ratingId: string, rating: import('../types/systematicReview').GradeRating
  ): Promise<import('../types/systematicReview').GradeDomainRating> =>
    unwrap(await client.put<Wrap<import('../types/systematicReview').GradeDomainRating>>(
      `/api/v1/systematicreview/${id}/evidence-grading/ratings/${ratingId}`, { rating },
    )),

  updateGradeUpgradeRating: async (
    id: string, ratingId: string, rating: import('../types/systematicReview').GradeUpgradeRating
  ): Promise<import('../types/systematicReview').GradeUpgradeRatingRecord> =>
    unwrap(await client.put<Wrap<import('../types/systematicReview').GradeUpgradeRatingRecord>>(
      `/api/v1/systematicreview/${id}/evidence-grading/upgrade-ratings/${ratingId}`, { rating },
    )),

  skipEvidenceGrading: async (id: string): Promise<void> => {
    await client.post(`/api/v1/systematicreview/${id}/evidence-grading/skip`)
  },

  // ── Write SLR step ────────────────────────────────────────────────────────

  getManuscript: async (id: string): Promise<import('../types/systematicReview').Manuscript | null> =>
    unwrap(await client.get<Wrap<import('../types/systematicReview').Manuscript | null>>(`/api/v1/systematicreview/${id}/write-slr`)),

  /** Generates every section from scratch and fixes a fresh citation numbering snapshot — can take a while (one Claude call per section). */
  generateManuscript: async (id: string): Promise<import('../types/systematicReview').Manuscript> =>
    unwrap(await client.post<Wrap<import('../types/systematicReview').Manuscript>>(
      `/api/v1/systematicreview/${id}/write-slr/generate`, null, { timeout: 240_000 },
    )),

  regenerateManuscriptSection: async (
    id: string, sectionKey: import('../types/systematicReview').ManuscriptSectionKey
  ): Promise<import('../types/systematicReview').ManuscriptSection> =>
    unwrap(await client.post<Wrap<import('../types/systematicReview').ManuscriptSection>>(
      `/api/v1/systematicreview/${id}/write-slr/sections/${sectionKey}/regenerate`, null, { timeout: 120_000 },
    )),

  updateManuscriptSection: async (
    id: string, sectionKey: import('../types/systematicReview').ManuscriptSectionKey, content: string
  ): Promise<import('../types/systematicReview').ManuscriptSection> =>
    unwrap(await client.put<Wrap<import('../types/systematicReview').ManuscriptSection>>(
      `/api/v1/systematicreview/${id}/write-slr/sections/${sectionKey}`, { content },
    )),

  exportManuscript: async (id: string): Promise<Blob> =>
    (await client.get<Blob>(`/api/v1/systematicreview/${id}/write-slr/export`, { responseType: 'blob' })).data,

  // ── Export step ───────────────────────────────────────────────────────────

  exportPapersCsv: async (id: string): Promise<Blob> =>
    (await client.get<Blob>(`/api/v1/systematicreview/${id}/export/papers`, { responseType: 'blob' })).data,

  exportPapersRis: async (id: string): Promise<Blob> =>
    (await client.get<Blob>(`/api/v1/systematicreview/${id}/export/papers-ris`, { responseType: 'blob' })).data,

  exportScreeningCsv: async (id: string): Promise<Blob> =>
    (await client.get<Blob>(`/api/v1/systematicreview/${id}/export/screening`, { responseType: 'blob' })).data,

  exportExtractionCsv: async (id: string): Promise<Blob> =>
    (await client.get<Blob>(`/api/v1/systematicreview/${id}/export/extraction`, { responseType: 'blob' })).data,

  exportRiskOfBiasCsv: async (id: string): Promise<Blob> =>
    (await client.get<Blob>(`/api/v1/systematicreview/${id}/export/risk-of-bias`, { responseType: 'blob' })).data,

  exportEvidenceGradingCsv: async (id: string): Promise<Blob> =>
    (await client.get<Blob>(`/api/v1/systematicreview/${id}/export/evidence-grading`, { responseType: 'blob' })).data,

  exportExcludedStudiesCsv: async (id: string): Promise<Blob> =>
    (await client.get<Blob>(`/api/v1/systematicreview/${id}/export/excluded-studies`, { responseType: 'blob' })).data,

  getPrismaFlow: async (id: string): Promise<import('../types/systematicReview').PrismaFlow> =>
    unwrap(await client.get<Wrap<import('../types/systematicReview').PrismaFlow>>(`/api/v1/systematicreview/${id}/export/prisma`)),

  // ── Citation Chaining (Snowballing) step ─────────────────────────────────────
  // Synchronous — bounded server-side to a fixed number of source papers, but backward +
  // forward OpenAlex lookups across dozens of papers can still take a while.
  runSnowballSearch: async (id: string): Promise<import('../types/systematicReview').SnowballResult> =>
    unwrap(await client.post<Wrap<import('../types/systematicReview').SnowballResult>>(
      `/api/v1/systematicreview/${id}/snowball/run`, null, { timeout: 120_000 },
    )),
}
