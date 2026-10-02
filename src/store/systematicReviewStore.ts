import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import { systematicReviewApi, type CreateSystematicReviewPayload, type CriterionPayload } from '../api/systematicReview'
import type { EligibilityCriterion, ReviewProtocol, SuggestedCriterion, SystematicReview, SystematicReviewDetail } from '../types/systematicReview'

const updateSearchStringIn = (
  details: Record<string, SystematicReviewDetail>,
  id: string,
  updater: (strings: SystematicReviewDetail['searchStrings']) => SystematicReviewDetail['searchStrings'],
): Record<string, SystematicReviewDetail> => {
  const detail = details[id]
  if (!detail) return details
  return { ...details, [id]: { ...detail, searchStrings: updater(detail.searchStrings) } }
}

interface SystematicReviewStore {
  reviews: SystematicReview[]
  // Full workspace detail (protocol + criteria) keyed by review id — not
  // persisted, re-fetched on mount like researchStore's `sections`.
  details: Record<string, SystematicReviewDetail>

  loadReviews:  (search?: string) => Promise<void>
  createReview: (payload: CreateSystematicReviewPayload) => Promise<SystematicReview>
  deleteReview: (id: string) => Promise<void>

  // ── Eligibility Criteria step ────────────────────────────────────────────

  loadDetail:      (id: string) => Promise<void>
  addCriterion:    (id: string, payload: CriterionPayload) => Promise<EligibilityCriterion>
  updateCriterion: (id: string, criterionId: string, payload: Omit<CriterionPayload, 'type'>) => Promise<void>
  deleteCriterion: (id: string, criterionId: string) => Promise<void>
  updateProtocol:  (id: string, payload: ReviewProtocol) => Promise<void>
  suggestCriteria: (id: string, description: string) => Promise<SuggestedCriterion[]>
  getProtocolAmendments: (id: string) => Promise<import('../types/systematicReview').ProtocolAmendment[]>
  markCheckpointReviewed: (id: string, stepId: string) => Promise<void>

  // ── Form Search Strings step ─────────────────────────────────────────────

  generateSearchStrings: (id: string) => Promise<void>
  createSearchString:    (id: string) => Promise<void>
  deleteSearchString:    (id: string, stringId: string) => Promise<void>
  updateSearchString:    (id: string, stringId: string, queryText: string) => Promise<void>
  addSearchTerm:         (id: string, stringId: string, term: string) => Promise<void>
  removeSearchTerm:      (id: string, stringId: string, termIndex: number) => Promise<void>
  clearSearchString:     (id: string, stringId: string) => Promise<void>
  validateSearchString:  (id: string, stringId: string, queryText: string) => Promise<{ isValid: boolean; errors: string[] }>
  getSearchStringHistory: (id: string) => Promise<import('../types/systematicReview').SearchStringHistoryItem[]>

  // ── Fetch Papers step ────────────────────────────────────────────────────
  fetchPapers:           (id: string) => Promise<{ jobId: string }>
  getFetchStatus:        (id: string) => Promise<import('../types/systematicReview').FetchStatus>
  getPapers:             (id: string, params?: { queryId?: string; search?: string; filter?: 'all' | 'web' | 'library'; source?: string; page?: number; pageSize?: number }) => Promise<import('../types/systematicReview').PaginatedPapers>
  updatePaperCount:      (id: string, count: number) => void

  // ── Deduplication & mechanical filters step ──────────────────────────────
  runDedupeAndFilter:    (id: string) => Promise<void>
  loadLatestDedupeRun:   (id: string) => Promise<void>

  // ── Title & abstract screening step ──────────────────────────────────────
  getScreeningRecords:     (id: string, params?: { search?: string; source?: string; status?: string; page?: number; pageSize?: number }) => Promise<import('../types/systematicReview').PaginatedScreening>
  runAiScreening:          (id: string) => Promise<{ jobId: string }>
  getScreeningRunStatus:   (id: string) => Promise<import('../types/systematicReview').ScreeningRunStatus>
  updateScreeningDecision: (id: string, decisionId: string, verdict: import('../types/systematicReview').ScreeningVerdict) => Promise<import('../types/systematicReview').ScreeningDecision>

  // ── Screening agreement check (dual-reviewer QA overlay) ──────────────────
  runScreeningAgreementCheck:     (id: string) => Promise<{ jobId: string }>
  getScreeningAgreementRunStatus: (id: string) => Promise<import('../types/systematicReview').ScreeningAgreementRunStatus>
  getScreeningAgreementSummary:   (id: string) => Promise<import('../types/systematicReview').ScreeningAgreementSummary>

  // ── Full text screening step ──────────────────────────────────────────────
  getFullTextScreeningRecords:   (id: string, params?: { search?: string; source?: string; filter?: import('../types/systematicReview').FullTextScreeningFilter; page?: number; pageSize?: number }) => Promise<import('../types/systematicReview').PaginatedFullTextScreening>
  uploadPdf:                     (id: string, paperId: string, file: File) => Promise<import('../types/systematicReview').FullTextScreeningRecord>
  useAbstractFallback:           (id: string, paperId: string) => Promise<import('../types/systematicReview').FullTextScreeningRecord>
  useAbstractFallbackForAll:     (id: string) => Promise<{ affectedCount: number }>
  recoverAbstracts:              (id: string) => Promise<import('../types/systematicReview').RecoverAbstractsResult>
  runFullTextScreening:          (id: string) => Promise<{ jobId: string }>
  getFullTextScreeningRunStatus: (id: string) => Promise<import('../types/systematicReview').FullTextScreeningRunStatus>
  getPaperFullText:              (id: string, paperId: string) => Promise<{ fullTextContent: string | null }>

  // ── Shared review-wide summary bar ────────────────────────────────────────
  getReviewSummary: (id: string) => Promise<import('../types/systematicReview').ReviewSummary>

  // ── Data Extraction step ──────────────────────────────────────────────────
  addExtractionVariable:       (id: string, name: string, isAiSuggested?: boolean, isOutcome?: boolean) => Promise<import('../types/systematicReview').ExtractionVariable>
  suggestExtractionVariables:  (id: string) => Promise<import('../types/systematicReview').SuggestedExtractionVariable[]>
  suggestOutcomeFlags:         (id: string) => Promise<number>
  deleteExtractionVariable:    (id: string, variableId: string) => Promise<void>
  clearExtractionVariables:    (id: string) => Promise<{ removedVariableCount: number; removedValueCount: number }>
  getExtractionRecords:        (id: string, params?: { search?: string; source?: string; filter?: import('../types/systematicReview').ExtractionFilter; page?: number; pageSize?: number }) => Promise<import('../types/systematicReview').PaginatedExtraction>
  runExtraction:               (id: string) => Promise<{ jobId: string }>
  getExtractionRunStatus:      (id: string) => Promise<import('../types/systematicReview').ExtractionRunStatus>
  rerunExtractionForPaper:     (id: string, paperId: string) => Promise<import('../types/systematicReview').ExtractionRecord>
  updateExtractedValue:        (id: string, valueId: string, value: string | null) => Promise<import('../types/systematicReview').ExtractedValueItem>
  skipExtraction:              (id: string) => Promise<void>
  setExtractionVariableOutcome: (id: string, variableId: string, isOutcome: boolean) => Promise<import('../types/systematicReview').ExtractionVariable>

  // ── Risk of Bias Assessment step ──────────────────────────────────────────
  getRiskOfBiasRecords:        (id: string, params?: { search?: string; source?: string; filter?: import('../types/systematicReview').RiskOfBiasFilter; page?: number; pageSize?: number }) => Promise<import('../types/systematicReview').PaginatedRiskOfBias>
  runRiskOfBiasAssessment:     (id: string) => Promise<{ jobId: string }>
  getRiskOfBiasRunStatus:      (id: string) => Promise<import('../types/systematicReview').RiskOfBiasRunStatus>
  rerunRiskOfBiasForPaper:     (id: string, paperId: string) => Promise<import('../types/systematicReview').RiskOfBiasRecord>
  updateRiskOfBiasRating:      (id: string, ratingId: string, rating: import('../types/systematicReview').RiskOfBiasRating) => Promise<import('../types/systematicReview').RiskOfBiasDomainRating>
  skipRiskOfBias:              (id: string) => Promise<void>
  setRiskOfBiasTool:           (id: string, tool: import('../types/systematicReview').RiskOfBiasTool) => Promise<void>
  getRobinsIRecords:           (id: string, params?: { search?: string; source?: string; filter?: import('../types/systematicReview').RiskOfBiasFilter; page?: number; pageSize?: number }) => Promise<import('../types/systematicReview').PaginatedRobinsI>
  runRobinsIAssessment:        (id: string) => Promise<{ jobId: string }>
  getRobinsIRunStatus:         (id: string) => Promise<import('../types/systematicReview').RobinsIRunStatus>
  rerunRobinsIForPaper:        (id: string, paperId: string) => Promise<import('../types/systematicReview').RobinsIRecord>
  updateRobinsIRating:         (id: string, ratingId: string, rating: import('../types/systematicReview').RobinsIRatingValue) => Promise<import('../types/systematicReview').RobinsIDomainRating>

  // ── Evidence Grading step ──────────────────────────────────────────────────
  getEvidenceGradingRecords:   (id: string) => Promise<import('../types/systematicReview').EvidenceGradingRecordsResponse>
  runEvidenceGrading:          (id: string) => Promise<{ jobId: string }>
  getEvidenceGradingRunStatus: (id: string) => Promise<import('../types/systematicReview').EvidenceGradingRunStatus>
  updateGradeRating:           (id: string, ratingId: string, rating: import('../types/systematicReview').GradeRating) => Promise<import('../types/systematicReview').GradeDomainRating>
  updateGradeUpgradeRating:    (id: string, ratingId: string, rating: import('../types/systematicReview').GradeUpgradeRating) => Promise<import('../types/systematicReview').GradeUpgradeRatingRecord>
  skipEvidenceGrading:         (id: string) => Promise<void>

  // ── Write SLR step ──────────────────────────────────────────────────────────
  getManuscript:                (id: string) => Promise<import('../types/systematicReview').Manuscript | null>
  /** Rejects with a MANUSCRIPT_NOT_READY ApiError when screening is unfinished, unless acknowledged. */
  generateManuscript:           (id: string, acknowledgeIncomplete?: boolean) => Promise<void>
  regenerateManuscriptSection:  (id: string, sectionKey: import('../types/systematicReview').ManuscriptSectionKey) => Promise<import('../types/systematicReview').ManuscriptSection>
  updateManuscriptSection:      (id: string, sectionKey: import('../types/systematicReview').ManuscriptSectionKey, content: string) => Promise<import('../types/systematicReview').ManuscriptSection>
  exportManuscript:             (id: string, acknowledgeConflicts?: boolean) => Promise<Blob>

  // ── Export step ──────────────────────────────────────────────────────────
  exportPapersCsv:          (id: string) => Promise<Blob>
  exportPapersRis:          (id: string) => Promise<Blob>
  exportScreeningCsv:       (id: string) => Promise<Blob>
  exportExtractionCsv:      (id: string) => Promise<Blob>
  exportRiskOfBiasCsv:      (id: string) => Promise<Blob>
  exportEvidenceGradingCsv: (id: string) => Promise<Blob>
  exportExcludedStudiesCsv: (id: string) => Promise<Blob>
  getPrismaFlow:            (id: string) => Promise<import('../types/systematicReview').PrismaFlow>

  // ── Citation Chaining (Snowballing) step ──────────────────────────────────
  runSnowballSearch: (id: string) => Promise<import('../types/systematicReview').SnowballStatus>
  getSnowballStatus: (id: string) => Promise<import('../types/systematicReview').SnowballStatus>
}

const safeLocalStorage: StateStorage = {
  getItem: (name) => localStorage.getItem(name),
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value)
    } catch (err) {
      console.warn(`[systematicReviewStore] Failed to persist "${name}" — continuing without persisting this change.`, err)
    }
  },
  removeItem: (name) => localStorage.removeItem(name),
}

export const useSystematicReviewStore = create<SystematicReviewStore>()(
  persist(
    (set) => ({
      reviews: [],
      details: {},

      loadReviews: async (search) => {
        const list = await systematicReviewApi.list(search)
        set({ reviews: list })
      },

      createReview: async (payload) => {
        const review = await systematicReviewApi.create(payload)
        set(s => ({ reviews: [review, ...s.reviews] }))
        return review
      },

      deleteReview: async (id) => {
        await systematicReviewApi.delete(id)
        set(s => ({ reviews: s.reviews.filter(r => r.id !== id) }))
      },

      // ── Eligibility Criteria step ──────────────────────────────────────

      loadDetail: async (id) => {
        const detail = await systematicReviewApi.getDetail(id)
        set(s => ({ details: { ...s.details, [id]: detail } }))
      },

      addCriterion: async (id, payload) => {
        const criterion = await systematicReviewApi.addCriterion(id, payload)
        set(s => {
          const detail = s.details[id]
          if (!detail) return {}
          return { details: { ...s.details, [id]: { ...detail, criteria: [...detail.criteria, criterion] } } }
        })
        return criterion
      },

      updateCriterion: async (id, criterionId, payload) => {
        const updated = await systematicReviewApi.updateCriterion(id, criterionId, payload)
        set(s => {
          const detail = s.details[id]
          if (!detail) return {}
          return {
            details: {
              ...s.details,
              [id]: { ...detail, criteria: detail.criteria.map(c => (c.id === criterionId ? updated : c)) },
            },
          }
        })
      },

      deleteCriterion: async (id, criterionId) => {
        await systematicReviewApi.deleteCriterion(id, criterionId)
        set(s => {
          const detail = s.details[id]
          if (!detail) return {}
          return { details: { ...s.details, [id]: { ...detail, criteria: detail.criteria.filter(c => c.id !== criterionId) } } }
        })
      },

      updateProtocol: async (id, payload) => {
        const protocol = await systematicReviewApi.updateProtocol(id, payload)
        set(s => {
          const detail = s.details[id]
          if (!detail) return {}
          return { details: { ...s.details, [id]: { ...detail, protocol } } }
        })
      },

      suggestCriteria: async (id, description) => systematicReviewApi.suggestCriteria(id, description),
      getProtocolAmendments: async (id) => systematicReviewApi.getProtocolAmendments(id),

      markCheckpointReviewed: async (id, stepId) => {
        const checkpoints = await systematicReviewApi.markCheckpointReviewed(id, stepId)
        set(s => {
          const detail = s.details[id]
          if (!detail) return {}
          return { details: { ...s.details, [id]: { ...detail, checkpoints } } }
        })
      },

      // ── Form Search Strings step ───────────────────────────────────────

      generateSearchStrings: async (id) => {
        const strings = await systematicReviewApi.generateSearchStrings(id)
        set(s => ({ details: updateSearchStringIn(s.details, id, () => strings) }))
      },

      createSearchString: async (id) => {
        const created = await systematicReviewApi.createSearchString(id)
        set(s => ({ details: updateSearchStringIn(s.details, id, list => [...list, created]) }))
      },

      deleteSearchString: async (id, stringId) => {
        await systematicReviewApi.deleteSearchString(id, stringId)
        set(s => ({ details: updateSearchStringIn(s.details, id, list => list.filter(x => x.id !== stringId)) }))
      },

      updateSearchString: async (id, stringId, queryText) => {
        const updated = await systematicReviewApi.updateSearchString(id, stringId, queryText)
        set(s => ({ details: updateSearchStringIn(s.details, id, list => list.map(x => (x.id === stringId ? updated : x))) }))
      },

      addSearchTerm: async (id, stringId, term) => {
        const updated = await systematicReviewApi.addSearchTerm(id, stringId, term)
        set(s => ({ details: updateSearchStringIn(s.details, id, list => list.map(x => (x.id === stringId ? updated : x))) }))
      },

      removeSearchTerm: async (id, stringId, termIndex) => {
        const updated = await systematicReviewApi.removeSearchTerm(id, stringId, termIndex)
        set(s => ({ details: updateSearchStringIn(s.details, id, list => list.map(x => (x.id === stringId ? updated : x))) }))
      },

      clearSearchString: async (id, stringId) => {
        const updated = await systematicReviewApi.clearSearchString(id, stringId)
        set(s => ({ details: updateSearchStringIn(s.details, id, list => list.map(x => (x.id === stringId ? updated : x))) }))
      },

      validateSearchString: async (id, stringId, queryText) => systematicReviewApi.validateSearchString(id, stringId, queryText),
      getSearchStringHistory: async (id) => systematicReviewApi.getSearchStringHistory(id),

      // ── Fetch Papers step ────────────────────────────────────────────

      fetchPapers: async (id) => systematicReviewApi.fetchPapers(id),
      getFetchStatus: async (id) => systematicReviewApi.getFetchStatus(id),
      getPapers: async (id, params) => systematicReviewApi.getPapers(id, params),
      updatePaperCount: (id, count) => set(s => {
        const newReviews = s.reviews.map(r => r.id === id ? { ...r, paperCount: count } : r)
        const detail = s.details[id]
        if (!detail) return { reviews: newReviews }
        return {
          reviews: newReviews,
          details: { ...s.details, [id]: { ...detail, paperCount: count } }
        }
      }),

      // ── Deduplication & mechanical filters step ──────────────────────

      runDedupeAndFilter: async (id) => {
        const run = await systematicReviewApi.runDedupeAndFilter(id)
        set(s => {
          const detail = s.details[id]
          if (!detail) return {}
          return { details: { ...s.details, [id]: { ...detail, latestDedupeRun: run } } }
        })
      },

      loadLatestDedupeRun: async (id) => {
        const run = await systematicReviewApi.getLatestDedupeRun(id)
        set(s => {
          const detail = s.details[id]
          if (!detail) return {}
          return { details: { ...s.details, [id]: { ...detail, latestDedupeRun: run } } }
        })
      },

      // ── Title & abstract screening step ───────────────────────────────
      getScreeningRecords: async (id, params) => systematicReviewApi.getScreeningRecords(id, params),
      runAiScreening: async (id) => systematicReviewApi.runAiScreening(id),
      getScreeningRunStatus: async (id) => systematicReviewApi.getScreeningRunStatus(id),
      updateScreeningDecision: async (id, decisionId, verdict) => systematicReviewApi.updateScreeningDecision(id, decisionId, verdict),

      // ── Screening agreement check (dual-reviewer QA overlay) ───────────
      runScreeningAgreementCheck: async (id) => systematicReviewApi.runScreeningAgreementCheck(id),
      getScreeningAgreementRunStatus: async (id) => systematicReviewApi.getScreeningAgreementRunStatus(id),
      getScreeningAgreementSummary: async (id) => systematicReviewApi.getScreeningAgreementSummary(id),

      // ── Full text screening step ──────────────────────────────────────
      getFullTextScreeningRecords: async (id, params) => systematicReviewApi.getFullTextScreeningRecords(id, params),
      uploadPdf: async (id, paperId, file) => systematicReviewApi.uploadPdf(id, paperId, file),
      useAbstractFallback: async (id, paperId) => systematicReviewApi.useAbstractFallback(id, paperId),
      useAbstractFallbackForAll: async (id) => systematicReviewApi.useAbstractFallbackForAll(id),
      recoverAbstracts: async (id) => systematicReviewApi.recoverAbstracts(id),
      runFullTextScreening: async (id) => systematicReviewApi.runFullTextScreening(id),
      getFullTextScreeningRunStatus: async (id) => systematicReviewApi.getFullTextScreeningRunStatus(id),
      getPaperFullText: async (id, paperId) => systematicReviewApi.getPaperFullText(id, paperId),

      // ── Shared review-wide summary bar ─────────────────────────────────
      getReviewSummary: async (id) => systematicReviewApi.getReviewSummary(id),

      // ── Data Extraction step ────────────────────────────────────────────
      addExtractionVariable: async (id, name, isAiSuggested, isOutcome) => {
        const variable = await systematicReviewApi.addExtractionVariable(id, name, isAiSuggested, isOutcome)
        set(s => {
          const detail = s.details[id]
          if (!detail) return {}
          return { details: { ...s.details, [id]: { ...detail, extractionVariables: [...detail.extractionVariables, variable] } } }
        })
        return variable
      },

      suggestExtractionVariables: async (id) => systematicReviewApi.suggestExtractionVariables(id),

      suggestOutcomeFlags: async (id) => systematicReviewApi.suggestOutcomeFlags(id),

      deleteExtractionVariable: async (id, variableId) => {
        await systematicReviewApi.deleteExtractionVariable(id, variableId)
        set(s => {
          const detail = s.details[id]
          if (!detail) return {}
          return { details: { ...s.details, [id]: { ...detail, extractionVariables: detail.extractionVariables.filter(v => v.id !== variableId) } } }
        })
      },

      clearExtractionVariables: async (id) => {
        const result = await systematicReviewApi.clearExtractionVariables(id)
        set(s => {
          const detail = s.details[id]
          if (!detail) return {}
          return { details: { ...s.details, [id]: { ...detail, extractionVariables: [] } } }
        })
        return result
      },

      getExtractionRecords: async (id, params) => systematicReviewApi.getExtractionRecords(id, params),
      runExtraction: async (id) => systematicReviewApi.runExtraction(id),
      getExtractionRunStatus: async (id) => systematicReviewApi.getExtractionRunStatus(id),
      rerunExtractionForPaper: async (id, paperId) => systematicReviewApi.rerunExtractionForPaper(id, paperId),
      updateExtractedValue: async (id, valueId, value) => systematicReviewApi.updateExtractedValue(id, valueId, value),

      skipExtraction: async (id) => {
        await systematicReviewApi.skipExtraction(id)
        set(s => {
          const detail = s.details[id]
          if (!detail) return {}
          return { details: { ...s.details, [id]: { ...detail, extractionSkipped: true } } }
        })
      },

      setExtractionVariableOutcome: async (id, variableId, isOutcome) => {
        const updated = await systematicReviewApi.setExtractionVariableOutcome(id, variableId, isOutcome)
        set(s => {
          const detail = s.details[id]
          if (!detail) return {}
          return {
            details: {
              ...s.details,
              [id]: { ...detail, extractionVariables: detail.extractionVariables.map(v => (v.id === variableId ? updated : v)) },
            },
          }
        })
        return updated
      },

      // ── Risk of Bias Assessment step ────────────────────────────────────
      getRiskOfBiasRecords: async (id, params) => systematicReviewApi.getRiskOfBiasRecords(id, params),
      runRiskOfBiasAssessment: async (id) => systematicReviewApi.runRiskOfBiasAssessment(id),
      getRiskOfBiasRunStatus: async (id) => systematicReviewApi.getRiskOfBiasRunStatus(id),
      rerunRiskOfBiasForPaper: async (id, paperId) => systematicReviewApi.rerunRiskOfBiasForPaper(id, paperId),
      updateRiskOfBiasRating: async (id, ratingId, rating) => systematicReviewApi.updateRiskOfBiasRating(id, ratingId, rating),

      skipRiskOfBias: async (id) => {
        await systematicReviewApi.skipRiskOfBias(id)
        set(s => {
          const detail = s.details[id]
          if (!detail) return {}
          return { details: { ...s.details, [id]: { ...detail, riskOfBiasSkipped: true } } }
        })
      },

      setRiskOfBiasTool: async (id, tool) => {
        const riskOfBiasTool = await systematicReviewApi.setRiskOfBiasTool(id, tool)
        set(s => {
          const detail = s.details[id]
          if (!detail) return {}
          return { details: { ...s.details, [id]: { ...detail, riskOfBiasTool } } }
        })
      },

      getRobinsIRecords: async (id, params) => systematicReviewApi.getRobinsIRecords(id, params),
      runRobinsIAssessment: async (id) => systematicReviewApi.runRobinsIAssessment(id),
      getRobinsIRunStatus: async (id) => systematicReviewApi.getRobinsIRunStatus(id),
      rerunRobinsIForPaper: async (id, paperId) => systematicReviewApi.rerunRobinsIForPaper(id, paperId),
      updateRobinsIRating: async (id, ratingId, rating) => systematicReviewApi.updateRobinsIRating(id, ratingId, rating),

      // ── Evidence Grading step ───────────────────────────────────────────
      getEvidenceGradingRecords: async (id) => systematicReviewApi.getEvidenceGradingRecords(id),
      runEvidenceGrading: async (id) => systematicReviewApi.runEvidenceGrading(id),
      getEvidenceGradingRunStatus: async (id) => systematicReviewApi.getEvidenceGradingRunStatus(id),
      updateGradeRating: async (id, ratingId, rating) => systematicReviewApi.updateGradeRating(id, ratingId, rating),
      updateGradeUpgradeRating: async (id, ratingId, rating) => systematicReviewApi.updateGradeUpgradeRating(id, ratingId, rating),

      skipEvidenceGrading: async (id) => {
        await systematicReviewApi.skipEvidenceGrading(id)
        set(s => {
          const detail = s.details[id]
          if (!detail) return {}
          return { details: { ...s.details, [id]: { ...detail, evidenceGradingSkipped: true } } }
        })
      },

      // ── Write SLR step ───────────────────────────────────────────────
      getManuscript: async (id) => systematicReviewApi.getManuscript(id),

      generateManuscript: async (id, acknowledgeIncomplete = false) => {
        const manuscript = await systematicReviewApi.generateManuscript(id, acknowledgeIncomplete)
        set(s => {
          const detail = s.details[id]
          if (!detail) return {}
          return { details: { ...s.details, [id]: { ...detail, manuscript } } }
        })
      },

      regenerateManuscriptSection: async (id, sectionKey) => {
        const section = await systematicReviewApi.regenerateManuscriptSection(id, sectionKey)
        set(s => {
          const detail = s.details[id]
          if (!detail?.manuscript) return {}
          return {
            details: {
              ...s.details,
              [id]: {
                ...detail,
                manuscript: { ...detail.manuscript, sections: detail.manuscript.sections.map(sec => (sec.key === sectionKey ? section : sec)) },
              },
            },
          }
        })
        return section
      },

      updateManuscriptSection: async (id, sectionKey, content) => {
        const section = await systematicReviewApi.updateManuscriptSection(id, sectionKey, content)
        set(s => {
          const detail = s.details[id]
          if (!detail?.manuscript) return {}
          return {
            details: {
              ...s.details,
              [id]: {
                ...detail,
                manuscript: { ...detail.manuscript, sections: detail.manuscript.sections.map(sec => (sec.key === sectionKey ? section : sec)) },
              },
            },
          }
        })
        return section
      },

      exportManuscript: async (id, acknowledgeConflicts) => systematicReviewApi.exportManuscript(id, acknowledgeConflicts),

      // ── Export step ────────────────────────────────────────────────
      exportPapersCsv: async (id) => systematicReviewApi.exportPapersCsv(id),
      exportPapersRis: async (id) => systematicReviewApi.exportPapersRis(id),
      exportScreeningCsv: async (id) => systematicReviewApi.exportScreeningCsv(id),
      exportExtractionCsv: async (id) => systematicReviewApi.exportExtractionCsv(id),
      exportRiskOfBiasCsv: async (id) => systematicReviewApi.exportRiskOfBiasCsv(id),
      exportEvidenceGradingCsv: async (id) => systematicReviewApi.exportEvidenceGradingCsv(id),
      exportExcludedStudiesCsv: async (id) => systematicReviewApi.exportExcludedStudiesCsv(id),
      getPrismaFlow: async (id) => systematicReviewApi.getPrismaFlow(id),

      // ── Citation Chaining (Snowballing) step ───────────────────────────
      runSnowballSearch: async (id) => systematicReviewApi.runSnowballSearch(id),

      // No optimistic paperCount update here, unlike the old synchronous version. That call fired
      // exactly once, so adding newPapersAdded to the cached count was safe; a polled status can be
      // read any number of times — including after a remount — and would add the same papers again
      // each time. The step reloads the review when the run finishes, which is the accurate count.
      getSnowballStatus: async (id) => systematicReviewApi.getSnowballStatus(id),
    }),
    {
      name: 'humanise-systematic-review',
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (state) => ({ reviews: state.reviews }),
    },
  ),
)
