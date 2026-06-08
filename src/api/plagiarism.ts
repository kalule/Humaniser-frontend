import client from './client'
import type { PlagiarismRequest, PlagiarismResponse } from '../types/plagiarism'

export const plagiarismApi = {
  check: async (data: PlagiarismRequest): Promise<PlagiarismResponse> => {
    const res = await client.post<{ success: boolean; data: PlagiarismResponse }>('/api/v1/plagiarism', data)
    return res.data.data ?? (res.data as unknown as PlagiarismResponse)
  },
}
