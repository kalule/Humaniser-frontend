import client from './client'
import type {
  ApproveResult, BulkResult, BulkUndoResult, Coverage, Exclusion, Extraction, Gap, ImportResult, IssueList, Issue, Outline, OutlineSection, PoolSource,
  Landmark, Reason, Review, ReviewOptions, ReviewRun, ReviewSummary, ScopeAdvice, ScreeningItem, ScreeningList, Section, SourceCheck, Theme,
} from '../lib/literatureReview'
import type { ScreeningQuery } from '../lib/literatureReviewScreening'

// Literature Review Studio. The shared client already unwraps the server's { success, data } envelope.
const data = <T>(response: { data: T }) => response.data
const base = '/api/v1/literature-reviews'

export interface ScopeInput {
  question?: string; title?: string; academicLevel?: string; discipline?: string; reviewType?: string; citationStyle?: string
  targetWords?: number; yearFrom?: number | null; yearTo?: number | null; clearYearFrom?: boolean; clearYearTo?: boolean
  criteria?: { include: string[]; exclude: string[] }; currentStep?: number; revision?: number
}

export const literatureReviewApi = {
  /** Never 404: whether the studio is switched on for the signed-in user. */
  availability: () => client.get<{ enabled: boolean }>(`${base}/availability`).then(data),
  options: () => client.get<ReviewOptions>(`${base}/options`).then(data),
  list: () => client.get<ReviewSummary[]>(base).then(data),
  create: (input: ScopeInput) => client.post<Review>(base, input).then(data),
  get: (id: string) => client.get<Review>(`${base}/${id}`).then(data),
  update: (id: string, input: ScopeInput) => client.patch<Review>(`${base}/${id}`, input).then(data),
  remove: (id: string) => client.delete(`${base}/${id}`).then(() => undefined),
  suggestScope: (id: string) => client.post<ScopeAdvice>(`${base}/${id}/scope/suggest`).then(data),

  // Sources
  sources: (id: string) => client.get<PoolSource[]>(`${base}/${id}/sources`).then(data),
  addSaved: (id: string, documentIds: string[]) => client.post<ImportResult>(`${base}/${id}/sources/saved`, { documentIds }).then(data),
  addMatrix: (id: string, matrixId: string) => client.post<ImportResult>(`${base}/${id}/sources/matrix/${matrixId}`).then(data),
  removeSource: (id: string, literatureId: string, reason?: string) =>
    client.delete(`${base}/${id}/sources/${literatureId}`, { params: reason ? { reason } : undefined }).then(() => undefined),

  // Screening
  reasons: () => client.get<Reason[]>(`${base}/screening-reasons`).then(data),
  screening: (id: string, params: ScreeningQuery, signal?: AbortSignal) =>
    client.get<ScreeningList>(`${base}/${id}/screening`, { params, signal }).then(data),
  decide: (id: string, candidateId: string, body: { decision: 'include' | 'exclude' | 'undo'; reasonCode?: string; note?: string }) =>
    client.patch<ScreeningItem>(`${base}/${id}/screening/${candidateId}`, body).then(data),
  /** One decision on many papers, in one transaction. 404 unless bulk screening is switched on. */
  bulkDecide: (id: string, body: { candidateIds: string[]; decision: 'include' | 'exclude'; reasonCode?: string; note?: string }) =>
    client.post<BulkResult>(`${base}/${id}/screening/bulk`, body).then(data),
  undoBulk: (id: string, batchId: string) => client.post<BulkUndoResult>(`${base}/${id}/screening/bulk/${batchId}/undo`).then(data),
  exclusions: (id: string) => client.get<Exclusion[]>(`${base}/${id}/screening/exclusions`).then(data),
  /**
   * With the backend's evidence rules on, approval is refused (serverCode UNRESOLVED_RECORDS) while screening left records undecided;
   * excludeUnresolved excludes them first as "not enough information to judge".
   */
  approve: (id: string, acknowledgeLimitedCoverage: boolean, excludeUnresolved = false) =>
    client.post<ApproveResult>(`${base}/${id}/screening/approve`, { acknowledgeLimitedCoverage, excludeUnresolved }).then(data),
  coverage: (id: string) => client.get<Coverage>(`${base}/${id}/coverage`).then(data),

  // Extraction (cells and passages use the Literature Matrix routes on extraction.matrixId)
  extraction: (id: string) => client.get<Extraction>(`${base}/${id}/extraction`).then(data),
  syncMatrix: (id: string) => client.post<Extraction>(`${base}/${id}/extraction/sync`).then(data),
  startExtraction: (id: string, consentAccepted: boolean, force = false) =>
    client.post<Extraction>(`${base}/${id}/extraction`, { consentAccepted, force }).then(data),

  // Runs, themes, gaps
  latestRun: (id: string, kind: 'Themes' | 'Draft' | 'Verify') => client.get<ReviewRun | null>(`${base}/${id}/runs/latest`, { params: { kind } }).then(data),
  synthesise: (id: string) => client.post<ReviewRun>(`${base}/${id}/themes/synthesise`).then(data),
  themes: (id: string) => client.get<Theme[]>(`${base}/${id}/themes`).then(data),
  createTheme: (id: string, body: { title: string; summary?: string; sources?: { literatureId: string; stance?: string }[] }) =>
    client.post<Theme>(`${base}/${id}/themes`, body).then(data),
  updateTheme: (id: string, themeId: string, body: { title?: string; summary?: string }) => client.patch<Theme>(`${base}/${id}/themes/${themeId}`, body).then(data),
  deleteTheme: (id: string, themeId: string) => client.delete(`${base}/${id}/themes/${themeId}`).then(() => undefined),
  mergeThemes: (id: string, themeIds: string[], title?: string) => client.post<Theme>(`${base}/${id}/themes/merge`, { themeIds, title }).then(data),
  splitTheme: (id: string, themeId: string, literatureIds: string[], title?: string) =>
    client.post<Theme[]>(`${base}/${id}/themes/${themeId}/split`, { literatureIds, title }).then(data),
  reorderThemes: (id: string, themeIds: string[]) => client.put<Theme[]>(`${base}/${id}/themes/order`, { themeIds }).then(data),
  setThemeSources: (id: string, themeId: string, sources: { literatureId: string; stance: string }[]) =>
    client.put<Theme>(`${base}/${id}/themes/${themeId}/sources`, { sources }).then(data),
  gaps: (id: string) => client.get<Gap[]>(`${base}/${id}/gaps`).then(data),
  updateGap: (id: string, gapId: string, status: 'accept' | 'dismiss' | 'undo') => client.patch<Gap>(`${base}/${id}/gaps/${gapId}`, { status }).then(data),

  // Outline and drafting
  outline: (id: string) => client.get<Outline | null>(`${base}/${id}/outline`).then(data),
  buildOutline: (id: string) => client.post<Outline>(`${base}/${id}/outline`).then(data),
  saveOutline: (id: string, sections: OutlineSection[]) => client.put<Outline>(`${base}/${id}/outline`, { sections }).then(data),
  draftAll: (id: string) => client.post<ReviewRun>(`${base}/${id}/draft`, {}).then(data),
  draftSection: (id: string, code: string) => client.post<ReviewRun>(`${base}/${id}/sections/${encodeURIComponent(code)}/draft`).then(data),
  sections: (id: string) => client.get<Section[]>(`${base}/${id}/sections`).then(data),
  editSection: (id: string, code: string, text: string) => client.put<Section>(`${base}/${id}/sections/${encodeURIComponent(code)}`, { text }).then(data),

  // Review and export
  verify: (id: string) => client.post<ReviewRun>(`${base}/${id}/verify`).then(data),
  issues: (id: string) => client.get<IssueList>(`${base}/${id}/issues`).then(data),
  repair: (id: string, issueId: string) => client.post<ReviewRun>(`${base}/${id}/issues/${issueId}/repair`).then(data),
  dismiss: (id: string, issueId: string, reason: string) => client.post<Issue>(`${base}/${id}/issues/${issueId}/dismiss`, { reason }).then(data),
  /** The server refuses (409) while anything blocking is open; the client turns that blob body back into a message. */
  exportFile: async (id: string, format: 'docx' | 'pdf'): Promise<Blob> =>
    (await client.get<Blob>(`${base}/${id}/export`, { params: { format }, responseType: 'blob' })).data,
  handOff: (id: string) => client.post<unknown>(`${base}/${id}/handoff/editor`).then(data),

  // Source gate: counts against the minimum, thin themes, source kinds, landmarks; continue-anyway is recorded on the server.
  sourceCheck: (id: string) => client.get<SourceCheck>(`${base}/${id}/source-check`).then(data),
  overrideSourceGate: (id: string, kind: 'SourceMinimum' | 'ThinTheme', themeId?: string) =>
    client.post<SourceCheck>(`${base}/${id}/source-check/override`, { kind, themeId }).then(data),
  landmarks: (id: string) => client.get<Landmark[]>(`${base}/${id}/landmarks`).then(data),
  searchTheme: (id: string, themeId: string, query: string) => client.post<{ started: boolean }>(`${base}/${id}/themes/${themeId}/search`, { query }).then(data),
}
