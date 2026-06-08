import client from './client'
import type { SummariseRequest, SummarisePreviewRequest, SummariseResponse } from '../types/summarise'

export const summariseApi = {
  summarise: async (data: SummariseRequest): Promise<SummariseResponse> => {
    const res = await client.post<{ success: boolean; data: SummariseResponse }>('/api/v1/summarise', data)
    return res.data.data ?? (res.data as unknown as SummariseResponse)
  },

  preview: async (data: SummarisePreviewRequest): Promise<string> => {
    const res = await client.post<{ success: boolean; data: { output: string } }>('/api/v1/summarise/preview', data)
    return res.data.data?.output ?? ''
  },
}
