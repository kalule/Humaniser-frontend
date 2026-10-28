import client from './client'

// The shared client already unwraps the server's ApiResponse envelope.
const data = <T>(response: { data: T }) => response.data
const base = '/api/v1/research/deep-research'

export type DeepResearchMode =
  | 'EvidenceForClaim' | 'TopicExploration' | 'RelationshipInvestigation' | 'ResearchGapInvestigation'
  | 'MethodologyEvidence' | 'TheoreticalFramework' | 'MeasurementInstrument' | 'ContradictoryEvidence'

export type DeepResearchStatus = 'Queued' | 'Running' | 'Completed' | 'Stopped' | 'Cancelled' | 'Failed'

export interface StartDeepResearchPayload {
  projectId: string
  researchQuestion: string
  mode: DeepResearchMode
  population?: string
  geography?: string
  academicField?: string
  minimumPublicationYear?: number
  maximumPublicationYear?: number
  requirePeerReviewed?: boolean
}

export interface DeepResearchProgress {
  phase: string
  message: string
  evidenceQuestions: number
  questionsAnswered: number
  sourcesDiscovered: number
  sourcesRelevant: number
  sourcesVerified: number
  searchesRun: number
}

export interface EvidenceQuestion { id: string; type: string; question: string; status: string; sufficiency: string; reasons: string[] }
export interface KeyFinding {
  statement: string
  evidenceQuestionId: string
  supportingSourceIds: string[]
  contradictingSourceIds: string[]
  strength: string
  scope: string
  caveats: string[]
}
export interface EvidenceGap { questionId: string; question: string; sufficiency: string; reasons: string[] }
export interface GapCandidate { questionId: string; status: string; type: string | null; confidence: string | null; reasons: string[] }
export interface ProviderCoverage { provider: string; searches: number; withResults: number; empty: number; unavailable: number; rateLimited: number; unconfirmed: number }

export interface VerifiedEvidencePackage {
  schemaVersion: string
  sessionId: string
  projectId: string
  contentHash: string
  researchQuestion: string
  scope: { topic: string; relationship: string | null; concepts: string[]; population: string[]; geography: string[]; timePeriod: string | null; academicField: string | null; minYear: number | null; maxYear: number | null } | null
  evidenceQuestions: EvidenceQuestion[]
  keyFindings: KeyFinding[]
  acceptedEvidence: EvidenceSource[]
  potentialResearchGaps: GapCandidate[]
  insufficientEvidence: EvidenceGap[]
  contradictions: EvidenceSource[]
  limitations: string[]
  searchCoverage: { questionId: string; query: string; intent: string; contradictionSearch: boolean; newCandidates: number; duplicates: number; providers: { provider: string; outcome: string; results: number; detail: string | null }[] }[]
  providerCoverage: ProviderCoverage[]
  completionReason: string
  usage: { searches: number; providerCalls: number; llmCalls: number; inputTokens: number; outputTokens: number; estimatedLlmCostUsd: number; elapsedSeconds: number }
  evidenceSufficient: boolean
}

export interface DeepResearchResult {
  evidenceStrength: string
  keyFindings: KeyFinding[]
  questions: EvidenceQuestion[]
  evidenceGaps: EvidenceGap[]
  gapCandidates: GapCandidate[]
  limitations: string[]
  providerCoverage: ProviderCoverage[]
  acceptedSources: number
  contradictorySources: number
}

export interface DeepResearchSession {
  id: string
  projectId: string
  researchQuestion: string
  mode: string
  status: DeepResearchStatus
  isFinished: boolean
  progress: DeepResearchProgress
  completionNote: string | null
  createdAt: string
  updatedAt: string
  result: DeepResearchResult | null
}

export type SourceDecision = 'Accepted' | 'Rejected' | 'Pending'

export interface EvidenceSource {
  id: string
  questionId: string
  title: string
  authors: string[]
  year: number | null
  journal: string | null
  doi: string | null
  polarity: string
  strength: string
  geography: string
  decision: SourceDecision
  decidedBy: 'Humaniser' | 'You'
  exclusionReason: string | null
  quote: string | null
  verification: string
  foundVia: string[]
  /** What the agent read to judge this source. Older sessions have no value and were abstract-level. */
  coverage?: 'Abstract' | 'FullText'
  studyDesign?: string | null
}

export interface DeepResearchSessionSummary {
  id: string
  projectId: string
  researchQuestion: string
  mode: string
  status: DeepResearchStatus
  isFinished: boolean
  canResume: boolean
  message: string
  acceptedSources: number
  createdAt: string
  updatedAt: string
}

export interface EvidencePackageReuse {
  id: string; sessionId: string; specificationId: string; packageHash: string; isCurrent: boolean; createdAt: string
  package: VerifiedEvidencePackage; sources: { sourceId: string; literatureId: string }[]; limitations: string[]
}
export interface AddToProjectResult { literatureId: string; alreadyInProject: boolean; title: string }

export interface BindingSuggestion {
  canBind: boolean
  reason: string | null
  literatureId: string | null
  coverage: string | null
  start: number
  length: number
  quote: string | null
  purpose: 'Support' | 'CounterEvidence' | null
  suggestedClaim: string | null
}

export const deepResearchApi = {
  start: async (payload: StartDeepResearchPayload): Promise<DeepResearchSession> => data(await client.post(base, payload)),
  list: async (projectId?: string, take = 15): Promise<DeepResearchSessionSummary[]> =>
    data(await client.get(base, { params: { projectId, take } })),
  get: async (id: string): Promise<DeepResearchSession> => data(await client.get(`${base}/${id}`)),
  evidencePackage: async (id: string): Promise<VerifiedEvidencePackage> => data(await client.get(`${base}/${id}/evidence-package`)),
  projectPackages: async (projectId: string): Promise<EvidencePackageReuse[]> => data(await client.get(`${base}/projects/${projectId}/packages`)),
  detachPackage: async (id: string): Promise<void> => { await client.delete(`${base}/${id}/reuse`) },
  projectReviewFeedback: async (projectId: string): Promise<{ isCurrent: boolean; review: { Id: string; Verdict: string; Findings: { Text: string; Suggestion: string }[] } } | null> => data(await client.get(`${base}/projects/${projectId}/review-feedback`)),
  reusePackage: async (id: string, payload: { expectedSpecificationId: string; expectedPackageHash: string; sourceIds: string[]; acknowledgePartialEvidence: boolean }): Promise<EvidencePackageReuse> => data(await client.post(`${base}/${id}/reuse`, payload)),
  evidence: async (id: string, include: 'relevant' | 'all' | 'rejected' = 'relevant'): Promise<EvidenceSource[]> =>
    data(await client.get(`${base}/${id}/evidence`, { params: { include } })),
  cancel: async (id: string): Promise<DeepResearchSession> => data(await client.post(`${base}/${id}/cancel`)),
  resume: async (id: string): Promise<DeepResearchSession> => data(await client.post(`${base}/${id}/continue`)),
  addToProject: async (id: string, sourceId: string): Promise<AddToProjectResult> =>
    data(await client.post(`${base}/${id}/sources/${sourceId}/add-to-project`)),
  bindingSuggestion: async (id: string, sourceId: string): Promise<BindingSuggestion> =>
    data(await client.get(`${base}/${id}/sources/${sourceId}/binding-suggestion`)),
  decide: async (id: string, sourceId: string, decision: 'accept' | 'reject' | 'clear'): Promise<EvidenceSource> =>
    data(await client.post(`${base}/${id}/sources/${sourceId}/decision`, { decision })),
}
