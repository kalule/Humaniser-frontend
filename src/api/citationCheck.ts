import client from './client'
import type { CitationCheckEstimate, CitationCheckReport, CitationCheckStarted, CitationDraft } from '../types/citationCheck'

const BASE = '/api/v1/citation-check'

type Wrap<T> = { success: boolean; data: T }
// The shared client already unwraps `{ success, data }`; this also accepts the unwrapped shape so a change there cannot break us.
const unwrap = <T>(res: { data: Wrap<T> | T }): T => ((res.data as Wrap<T>)?.data ?? res.data) as T

export const citationCheckApi = {
  /** Start a check on pasted text. Resolves to the run id to poll. Rejects with an ApiError whose message is safe to show. */
  start: async (text: string): Promise<string> =>
    unwrap(await client.post<Wrap<{ runId: string }>>(BASE, { text })).runId,

  /** Start a check on a Word (.docx) or text-based PDF file. The server reads the file itself (type and size are enforced there). */
  uploadFile: async (file: File): Promise<CitationCheckStarted> => {
    const form = new FormData()
    form.append('file', file)
    const data = unwrap(
      await client.post<Wrap<{ runId: string; warnings?: string[] | null }>>(`${BASE}/upload`, form, { headers: { 'Content-Type': 'multipart/form-data' } }),
    )
    return { runId: data.runId, warnings: data.warnings ?? [] }
  },

  /** As uploadFile, for callers that only need the run id. */
  upload: async (file: File): Promise<string> => (await citationCheckApi.uploadFile(file)).runId,

  /** The text this run was started from; null when it is gone (deleted, expired) or not this user's. */
  getDraft: async (runId: string): Promise<CitationDraft | null> => {
    const res = await client.get<Wrap<CitationDraft>>(`${BASE}/${runId}/draft`, {
      validateStatus: (status) => (status >= 200 && status < 300) || status === 404,
    })
    return res.status === 404 ? null : unwrap(res)
  },

  /**
   * The run's status and the results so far. Null when the run does not exist for this user: deleted, expired, or never theirs.
   * The shared client turns every error into an ApiError without its HTTP status, so a 404 has to be recognised here, before that.
   */
  get: async (runId: string): Promise<CitationCheckReport | null> => {
    const res = await client.get<Wrap<CitationCheckReport>>(`${BASE}/${runId}`, {
      validateStatus: (status) => (status >= 200 && status < 300) || status === 404,
    })
    return res.status === 404 ? null : unwrap(res)
  },

  /** What a check would involve (citations found, how many this plan checks, a rough time), before anything is stored. */
  estimateText: async (text: string): Promise<CitationCheckEstimate> =>
    unwrap(await client.post<Wrap<CitationCheckEstimate>>(`${BASE}/estimate`, { text })),

  estimateFile: async (file: File): Promise<CitationCheckEstimate> => {
    const form = new FormData()
    form.append('file', file)
    return unwrap(await client.post<Wrap<CitationCheckEstimate>>(`${BASE}/estimate/upload`, form, { headers: { 'Content-Type': 'multipart/form-data' } }))
  },

  /** Run again only what failed (optionally just these cards). Resolves to how many were queued. */
  retryFailed: async (runId: string, citationIds?: string[]): Promise<number> =>
    unwrap(await client.post<Wrap<{ retried: number }>>(`${BASE}/${runId}/retry`, { citationIds: citationIds ?? null })).retried,

  /** The report as a Word or PDF file. */
  downloadReport: async (runId: string, format: 'docx' | 'pdf', name?: string): Promise<Blob> =>
    (await client.get<Blob>(`${BASE}/${runId}/report`, { params: { format, name }, responseType: 'blob' })).data,

  /** Delete the draft and every result now. Resolves whether or not the run still existed. */
  remove: async (runId: string): Promise<void> => {
    await client.delete(`${BASE}/${runId}`, { validateStatus: (status) => (status >= 200 && status < 300) || status === 404 })
  },
}
