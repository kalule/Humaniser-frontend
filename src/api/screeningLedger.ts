import client from './client'
import type {
  LedgerExportFormat, QueueView, RankingStatus, RecordDecisionPayload, ReviewMemberRole, ScreeningLabel, ScreeningMode,
  ScreeningProgress, ScreeningQueue, ScreeningSettings, ScreeningStage, ScreeningStop, SharedReview, StopScreeningPayload,
  EvidenceRole,
} from '../types/screeningLedger'

type Wrap<T> = { success: boolean; data: T }
const unwrap = <T>(res: { data: Wrap<T> }): T => res.data.data ?? (res.data as unknown as T)
const base = (id: string) => `/api/v1/systematicreviewscreening/${id}`

/** Reviewer screening ledger. Saving a decision never waits for the ranking model. */
export const screeningLedgerApi = {
  getQueue: async (id: string, stage: ScreeningStage, view: QueueView = 'next', take = 10): Promise<ScreeningQueue> =>
    unwrap(await client.get<Wrap<ScreeningQueue>>(`${base(id)}/queue`, { params: { stage, view, take } })),

  getProgress: async (id: string, stage: ScreeningStage): Promise<ScreeningProgress> =>
    unwrap(await client.get<Wrap<ScreeningProgress>>(`${base(id)}/progress`, { params: { stage } })),

  recordDecision: async (id: string, paperId: string, payload: RecordDecisionPayload): Promise<ScreeningLabel> =>
    unwrap(await client.put<Wrap<ScreeningLabel>>(`${base(id)}/records/${paperId}/decision`, payload)),

  undo: async (id: string, paperId: string, stage: ScreeningStage, adjudication = false): Promise<ScreeningLabel> =>
    unwrap(await client.delete<Wrap<ScreeningLabel>>(`${base(id)}/records/${paperId}/decision`, { params: { stage, adjudication } })),

  getHistory: async (id: string, paperId: string): Promise<ScreeningLabel[]> =>
    unwrap(await client.get<Wrap<ScreeningLabel[]>>(`${base(id)}/records/${paperId}/history`)),

  refreshRanking: async (id: string, stage: ScreeningStage): Promise<RankingStatus> =>
    unwrap(await client.post<Wrap<RankingStatus>>(`${base(id)}/ranking/refresh`, null, { params: { stage } })),

  getRankingStatus: async (id: string, stage: ScreeningStage): Promise<RankingStatus> =>
    unwrap(await client.get<Wrap<RankingStatus>>(`${base(id)}/ranking/status`, { params: { stage } })),

  cancelRanking: async (id: string, stage: ScreeningStage): Promise<RankingStatus> =>
    unwrap(await client.post<Wrap<RankingStatus>>(`${base(id)}/ranking/cancel`, null, { params: { stage } })),

  stop: async (id: string, payload: StopScreeningPayload): Promise<ScreeningStop> =>
    unwrap(await client.post<Wrap<ScreeningStop>>(`${base(id)}/stop`, payload)),

  getStops: async (id: string): Promise<ScreeningStop[]> =>
    unwrap(await client.get<Wrap<ScreeningStop[]>>(`${base(id)}/stop`)),

  linkReports: async (id: string, paperIds: string[]): Promise<{ studyGroupId: string; reportCount: number }> =>
    unwrap(await client.post<Wrap<{ studyGroupId: string; reportCount: number }>>(`${base(id)}/reports/link`, { paperIds })),

  unlinkReport: async (id: string, paperId: string): Promise<void> => {
    await client.delete(`${base(id)}/records/${paperId}/study-group`)
  },

  setEvidenceRole: async (id: string, paperId: string, role: EvidenceRole): Promise<void> => {
    await client.put(`${base(id)}/records/${paperId}/evidence-role`, { role })
  },

  getSettings: async (id: string): Promise<ScreeningSettings> =>
    unwrap(await client.get<Wrap<ScreeningSettings>>(`${base(id)}/settings`)),

  updateSettings: async (id: string, payload: { mode?: ScreeningMode; requiredReviewers?: number }): Promise<ScreeningSettings> =>
    unwrap(await client.put<Wrap<ScreeningSettings>>(`${base(id)}/settings`, payload)),

  addMember: async (id: string, email: string, role: ReviewMemberRole): Promise<ScreeningSettings> =>
    unwrap(await client.post<Wrap<ScreeningSettings>>(`${base(id)}/members`, { email, role })),

  removeMember: async (id: string, userId: string): Promise<ScreeningSettings> =>
    unwrap(await client.delete<Wrap<ScreeningSettings>>(`${base(id)}/members/${userId}`)),

  listShared: async (): Promise<SharedReview[]> =>
    unwrap(await client.get<Wrap<SharedReview[]>>('/api/v1/systematicreviewscreening/shared')),

  getMethodsText: async (id: string): Promise<string> =>
    unwrap(await client.get<Wrap<{ text: string }>>(`${base(id)}/ledger/methods-text`)).text,

  exportCsv: async (id: string, format: LedgerExportFormat): Promise<Blob> =>
    (await client.get<Blob>(`${base(id)}/ledger/export`, { params: { format }, responseType: 'blob' })).data,
}

/** The API's error message, for showing to the reviewer. */
export function ledgerErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
  return data?.error?.message ?? fallback
}
