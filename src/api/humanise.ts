import client from './client'
import type { HumaniseRequest, HumaniseResponse, HistoryItem, PagedResult, Tone } from '../types'
import type { BulkHumaniseSentencesRequest, BulkHumaniseSentencesResponse } from '../types/detector'

export interface GetHistoryParams {
  page?: number
  pageSize?: number
  tone?: Tone
  from?: string
  to?: string
}

export interface SentenceAlternativesRequest {
  /** The sentence as it reads now (it may already be a rewrite). */
  sentence: string
  /** The paragraph it sits in, so alternatives fit the surrounding text. */
  surroundingContext: string
  tone: Tone | 'auto'
  /** The author's own sentence, when `sentence` is a rewrite of it. Alternatives are checked against this. */
  originalSentence?: string
  englishVariant?: string
}

export const humaniseApi = {
  humanise: (dto: HumaniseRequest) =>
    client.post<HumaniseResponse>('/api/v1/humanise', dto).then(response => {
      const job = response.data.job
      if (job && !['changed', 'unchanged'].includes(job.outcome)) {
        sessionStorage.setItem('humanise-review-job', job.jobId)
        throw new Error(job.outcome === 'partially_changed'
          ? 'Some regions could not be rewritten safely. Open Humanise to review the accepted suggestions.'
          : 'No changes were applied. Open Humanise to review the result.')
      }
      return response
    }),

  getHistory: (params: GetHistoryParams = {}) =>
    client.get<PagedResult<HistoryItem>>('/api/v1/humanise/history', { params }),

  deleteHistory: (id: string) =>
    client.delete<void>(`/api/v1/humanise/history/${id}`),

  /**
   * Up to three alternatives for one sentence, read in the context of its paragraph. The server checks every alternative
   * against the author's own sentence and drops any that would change a number, citation, quotation, hedge or negation,
   * so the list can be shorter than three, or empty.
   */
  sentenceAlternatives: async (dto: SentenceAlternativesRequest, signal?: AbortSignal): Promise<string[]> => {
    const res = await client.post<{ data?: { alternatives?: string[] }; alternatives?: string[] }>(
      '/api/v1/humanise/sentence', dto, { signal })
    const list = res.data.data?.alternatives ?? res.data.alternatives ?? []
    return list.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
  },

  bulkHumaniseSentences: async (dto: BulkHumaniseSentencesRequest): Promise<BulkHumaniseSentencesResponse> => {
    const res = await client.post<{ success: boolean; data: BulkHumaniseSentencesResponse }>(
      '/api/v1/humanise/bulk-sentences', dto)
    return res.data.data ?? (res.data as unknown as BulkHumaniseSentencesResponse)
  },
}
