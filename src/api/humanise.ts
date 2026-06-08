import client from './client'
import type { HumaniseRequest, HumaniseResponse, HistoryItem, PagedResult, Tone } from '../types'

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
}
