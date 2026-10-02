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
    client.post<HumaniseResponse>('/api/v1/humanise', dto),

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
