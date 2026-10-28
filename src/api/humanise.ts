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

export const humaniseApi = {
  humanise: (dto: HumaniseRequest) =>
    client.post<HumaniseResponse>('/api/v1/humanise', dto).then(response => {
      const job = response.data.job
      if (job && !['changed', 'unchanged'].includes(job.outcome)) {
        sessionStorage.setItem('humanise-review-job', job.jobId)
        throw new Error(job.outcome === 'partially_changed'
          ? 'Some regions could not be rewritten safely. Open Humaniser to review the accepted suggestions.'
          : 'No changes were applied. Open Humaniser to review the result.')
      }
      return response
    }),

  getHistory: (params: GetHistoryParams = {}) =>
    client.get<PagedResult<HistoryItem>>('/api/v1/humanise/history', { params }),

  deleteHistory: (id: string) =>
    client.delete<void>(`/api/v1/humanise/history/${id}`),

  bulkHumaniseSentences: async (dto: BulkHumaniseSentencesRequest): Promise<BulkHumaniseSentencesResponse> => {
    const res = await client.post<{ success: boolean; data: BulkHumaniseSentencesResponse }>(
      '/api/v1/humanise/bulk-sentences', dto)
    return res.data.data ?? (res.data as unknown as BulkHumaniseSentencesResponse)
  },
}
