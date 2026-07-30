import client from './client'
import type { PinnedChart } from '../types/workbench'

export interface CreatePinnedChartPayload {
  base64Png:    string
  caption?:     string
  sourcePrompt: string
}

export const pinnedChartsApi = {
  getCharts: async (): Promise<PinnedChart[]> => {
    const res = await client.get<{ success: boolean; data: PinnedChart[] }>('/api/v1/workbench/pinned-charts')
    return res.data.data ?? (res.data as unknown as PinnedChart[])
  },

  createChart: async (payload: CreatePinnedChartPayload): Promise<PinnedChart> => {
    const res = await client.post<{ success: boolean; data: PinnedChart }>('/api/v1/workbench/pinned-charts', payload)
    return res.data.data ?? (res.data as unknown as PinnedChart)
  },

  deleteChart: async (id: string): Promise<void> => {
    await client.delete(`/api/v1/workbench/pinned-charts/${id}`)
  },

  importCharts: async (charts: CreatePinnedChartPayload[]): Promise<{ importedCount: number }> => {
    const res = await client.post<{ success: boolean; data: { importedCount: number } }>(
      '/api/v1/workbench/pinned-charts/import',
      { charts },
    )
    return res.data.data ?? (res.data as unknown as { importedCount: number })
  },
}
