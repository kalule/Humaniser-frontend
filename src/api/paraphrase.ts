import client from './client'
import type { ParaphraseRequest, ParaphrasePreviewRequest, ParaphraseResponse } from '../types/paraphrase'

export const paraphraseApi = {
  paraphrase: async (data: ParaphraseRequest): Promise<ParaphraseResponse> => {
    const res = await client.post<{ success: boolean; data: ParaphraseResponse }>('/api/v1/paraphrase', data)
    return res.data.data ?? (res.data as unknown as ParaphraseResponse)
  },

  preview: async (data: ParaphrasePreviewRequest): Promise<string> => {
    const res = await client.post<{ success: boolean; data: { output: string } }>('/api/v1/paraphrase/preview', data)
    return res.data.data?.output ?? ''
  },
}
