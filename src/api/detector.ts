import client from './client'
import type { DetectRequest, DetectResponse, DetectionHistoryResponse } from '../types/detector'

export const detectorApi = {
  detect: async (data: DetectRequest): Promise<DetectResponse> => {
    const res = await client.post<{ success: boolean; data: DetectResponse }>('/api/v1/detector', data)
    return res.data.data ?? (res.data as unknown as DetectResponse)
  },

  getHistory: async (page = 1, pageSize = 20): Promise<DetectionHistoryResponse> => {
    const res = await client.get<{ success: boolean; data: DetectionHistoryResponse }>(
      '/api/v1/detector/history',
      { params: { page, pageSize } }
    )
    return res.data.data ?? (res.data as unknown as DetectionHistoryResponse)
  },

  deleteHistoryItem: async (id: string): Promise<void> => {
    await client.delete(`/api/v1/detector/history/${id}`)
  },
}
