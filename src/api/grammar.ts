import client from './client'
import type { GrammarCheckRequest, GrammarCheckResponse, GrammarPreviewRequest } from '../types/grammar'

export const grammarApi = {
  check: async (data: GrammarCheckRequest): Promise<GrammarCheckResponse> => {
    const res = await client.post<{ success: boolean; data: GrammarCheckResponse }>('/api/v1/grammar/check', data)
    return res.data.data ?? (res.data as unknown as GrammarCheckResponse)
  },

  preview: async (data: GrammarPreviewRequest): Promise<GrammarCheckResponse> => {
    const res = await client.post<{ success: boolean; data: GrammarCheckResponse }>('/api/v1/grammar/preview', data)
    return res.data.data ?? (res.data as unknown as GrammarCheckResponse)
  },
}
