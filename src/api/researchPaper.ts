import client from './client'
import type {
  CandidateList, Claim, Criteria, DecisionEvent, EvidenceStatus, Flow, Integrity, Outline, OutlineSection, Paper, PaperIssue, PaperOptions,
  PaperRun, PaperRunKind, PaperSource, PaperSummary, Reason, ResultsInput, ScreeningList, SearchLog, Section, SectionVersion, SynthesisTable, TopicSuggestion,
} from '../lib/researchPaper'

// Research Paper Studio. The shared client already unwraps the server's { success, data } envelope.
const data = <T>(response: { data: T }) => response.data
/** Paper runs carry no credit count; the shared run banner expects one. */
const run = (r: PaperRun | null) => (r ? { ...r, creditsCharged: r.creditsCharged ?? 0 } : r)
const base = '/api/v1/research-papers'

export interface PaperInput {
  topic?: string; title?: string; paperType?: string; academicLevel?: string; discipline?: string; citationStyle?: string; targetWords?: number
  minSourceTarget?: number; studentMode?: boolean; problemStatement?: string; researchQuestions?: string[]; objectives?: string[]; scope?: string
  recommendedApproach?: string; revision?: number
}

export const researchPaperApi = {
  /** Never 404: whether the studio is switched on for the signed-in user. */
  availability: () => client.get<{ enabled: boolean }>(`${base}/availability`).then(data),
  options: () => client.get<PaperOptions>(`${base}/options`).then(data),
  list: () => client.get<PaperSummary[]>(base).then(data),
  create: (input: PaperInput) => client.post<Paper>(base, input).then(data),
  get: (id: string) => client.get<Paper>(`${base}/${id}`).then(data),
  update: (id: string, input: PaperInput) => client.patch<Paper>(`${base}/${id}`, input).then(data),
  remove: (id: string) => client.delete(`${base}/${id}`).then(() => undefined),

  // Question
  suggestTopic: (id: string) => client.post<TopicSuggestion>(`${base}/${id}/topic/suggest`).then(data),
  approveQuestion: (id: string, revision?: number) => client.post<Paper>(`${base}/${id}/question/approve`, { revision }).then(data),

  // Sources
  search: (id: string) => client.post<EvidenceStatus>(`${base}/${id}/search`).then(data),
  searchLog: (id: string) => client.get<SearchLog>(`${base}/${id}/search-log`).then(data),
  evidenceStatus: (id: string) => client.get<EvidenceStatus>(`${base}/${id}/evidence-status`).then(data),
  candidates: (id: string, page = 1, pageSize = 50) => client.get<CandidateList>(`${base}/${id}/candidates`, { params: { page, pageSize } }).then(data),
  rank: (id: string) => client.post<PaperRun>(`${base}/${id}/candidates/rank`).then(data).then(r => run(r)!),
  sources: (id: string) => client.get<PaperSource[]>(`${base}/${id}/sources`).then(data),
  verifySources: (id: string) => client.post<PaperRun>(`${base}/${id}/sources/verify`).then(data).then(r => run(r)!),
  startExtraction: (id: string, consentAccepted: boolean) => client.post<unknown>(`${base}/${id}/extraction`, { consentAccepted, force: false }).then(data),

  // Screening
  reasons: () => client.get<Reason[]>('/api/v1/literature-reviews/screening-reasons').then(data),
  criteria: (id: string) => client.get<Criteria>(`${base}/${id}/criteria`).then(data),
  updateCriteria: (id: string, body: Partial<Pick<Criteria, 'include' | 'exclude' | 'yearFrom' | 'yearTo'>> & { clearYearFrom?: boolean; clearYearTo?: boolean }) =>
    client.put<Criteria>(`${base}/${id}/criteria`, body).then(data),
  startScreening: (id: string) => client.post<ScreeningList>(`${base}/${id}/screening/start`).then(data),
  stopScreening: (id: string) => client.post<ScreeningList>(`${base}/${id}/screening/stop`).then(data),
  screening: (id: string, params: { state?: string; page?: number; pageSize?: number }) => client.get<ScreeningList>(`${base}/${id}/screening`, { params }).then(data),
  decide: (id: string, candidateId: string, body: { decision: 'include' | 'exclude' | 'undo'; reasonCode?: string; note?: string }) =>
    client.patch(`${base}/${id}/screening/${candidateId}`, body).then(() => undefined),
  bulkDecide: (id: string, body: { candidateIds: string[]; decision: 'include' | 'exclude' | 'undo'; reasonCode?: string }) =>
    client.post<{ updated: number; failed: { candidateId: string; error: string }[] }>(`${base}/${id}/screening/bulk`, body).then(data),
  prioritise: (id: string) => client.post<PaperRun>(`${base}/${id}/screening/prioritise`).then(data).then(r => run(r)!),
  audit: (id: string, page = 1) => client.get<{ items: DecisionEvent[]; totalCount: number }>(`${base}/${id}/screening/audit`, { params: { page, pageSize: 50 } }).then(data),
  flow: (id: string) => client.get<Flow>(`${base}/${id}/screening/flow`).then(data),
  /** keepMostRelevant: when more sources are included than the synthesis compares, keep the most relevant (the rest are taken out with a reason). */
  approveScreening: (id: string, acknowledgeLimitedCoverage: boolean, keepMostRelevant = false) =>
    client.post<{ paper: Paper; addedToPool: number; excludedForDateRange: number; poolSize: number; removedForSynthesisLimit: number }>(
      `${base}/${id}/screening/approve`, { acknowledgeLimitedCoverage, keepMostRelevant }).then(data),

  // Synthesis
  synthesise: (id: string) => client.post<PaperRun>(`${base}/${id}/synthesis`).then(data).then(r => run(r)!),
  synthesisRun: (id: string) => client.get<PaperRun | null>(`${base}/${id}/synthesis/run`).then(data).then(run),
  synthesisTable: (id: string) => client.get<SynthesisTable>(`${base}/${id}/synthesis/table`).then(data),
  updateGap: (id: string, gapId: string, status: 'Accepted' | 'Dismissed' | 'Proposed') => client.patch(`${base}/${id}/gaps/${gapId}`, { status }).then(() => undefined),

  // Writing
  buildOutline: (id: string) => client.post<Outline>(`${base}/${id}/outline`).then(data),
  outline: (id: string) => client.get<Outline>(`${base}/${id}/outline`).then(data),
  updateOutline: (id: string, sections: Pick<OutlineSection, 'code' | 'title' | 'purpose' | 'targetWords'>[]) =>
    client.put<Outline>(`${base}/${id}/outline`, { sections }).then(data),
  approveOutline: (id: string) => client.post<Outline>(`${base}/${id}/outline/approve`).then(data),
  resultsInput: (id: string) => client.get<ResultsInput>(`${base}/${id}/results-input`).then(data),
  updateResultsInput: (id: string, body: { methodsDescription?: string; resultsText?: string; tablesText?: string; attest: boolean }) =>
    client.put<ResultsInput>(`${base}/${id}/results-input`, body).then(data),
  sections: (id: string) => client.get<Section[]>(`${base}/${id}/sections`).then(data),
  draftAll: (id: string) => client.post<PaperRun>(`${base}/${id}/draft`).then(data).then(r => run(r)!),
  revise: (id: string, code: string, body: { action: string; tone?: string; notes?: string }) => client.post<PaperRun>(`${base}/${id}/sections/${code}/revise`, body).then(data).then(r => run(r)!),
  editSection: (id: string, code: string, text: string) => client.put<Section>(`${base}/${id}/sections/${code}`, { text }).then(data),
  versions: (id: string, code: string) => client.get<SectionVersion[]>(`${base}/${id}/sections/${code}/versions`).then(data),
  restore: (id: string, code: string, versionNo: number) => client.post<Section>(`${base}/${id}/sections/${code}/versions/${versionNo}/restore`).then(data),
  claims: (id: string, code: string) => client.get<Claim[]>(`${base}/${id}/sections/${code}/claims`).then(data),

  // Integrity
  verify: (id: string) => client.post<PaperRun>(`${base}/${id}/verify`).then(data).then(r => run(r)!),
  integrity: (id: string) => client.get<Integrity>(`${base}/${id}/integrity`).then(data),
  fix: (id: string, issueId: string) => client.post<{ action: string; run: PaperRun | null; section: Section | null }>(`${base}/${id}/issues/${issueId}/fix`).then(data),
  /** Approves the paper for final export; refused (and recorded) unless the check is complete with nothing critical. */
  approveFinal: (id: string, confirm: boolean) => client.post<Integrity>(`${base}/${id}/approve-final`, { confirm }).then(data),
  /** Rewrites each sentence with an open critical finding from its cited passages and checks it (all, or the findings given). */
  repair: (id: string, issueIds?: string[]) => client.post<PaperRun>(`${base}/${id}/repair`, { issueIds: issueIds ?? [] }).then(data).then(r => run(r)!),
  bulkFix: (id: string, issueIds: string[], action: 'Apply' | 'RemoveSentences') =>
    client.post<{ applied: number; skipped: { candidateId: string; error: string }[]; sectionsChanged: string[] }>(`${base}/${id}/issues/fix-bulk`, { issueIds, action }).then(data),
  dismiss: (id: string, issueId: string, reason: string) => client.post<PaperIssue>(`${base}/${id}/issues/${issueId}/dismiss`, { reason }).then(data),

  // Runs and export
  latestRun: (id: string, kind: PaperRunKind) => client.get<PaperRun | null>(`${base}/${id}/runs/latest`, { params: { kind } }).then(data).then(run),
  cancelRun: (id: string, runId: string) => client.post<PaperRun>(`${base}/${id}/runs/${runId}/cancel`).then(data).then(r => run(r)!),
  exportFile: async (id: string, params: { format: 'docx' | 'pdf' | 'ris' | 'bibtex'; draft?: boolean; searchLog?: boolean; synthesis?: boolean; aiStatement?: boolean }): Promise<Blob> =>
    (await client.get<Blob>(`${base}/${id}/export`, { params, responseType: 'blob' })).data,
}
