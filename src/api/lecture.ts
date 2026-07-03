import client from './client'
import type { LectureJob } from '../types/lecture'

const unwrap = <T>(res: { data: { success: boolean; data: T } }): T =>
  res.data.data ?? (res.data as unknown as T)

export const lectureApi = {
  upload: async (file: File): Promise<LectureJob> => {
    const form = new FormData()
    form.append('file', file)
    const res = await client.post<{ success: boolean; data: LectureJob }>(
      '/api/v1/lectures/upload',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
    return res.data.data ?? (res.data as unknown as LectureJob)
  },

  getJobs: async (): Promise<LectureJob[]> =>
    unwrap(await client.get<{ success: boolean; data: LectureJob[] }>('/api/v1/lectures/jobs')),

  getJob: async (id: string): Promise<LectureJob> =>
    unwrap(await client.get<{ success: boolean; data: LectureJob }>(`/api/v1/lectures/jobs/${id}`)),

  deleteJob: async (id: string): Promise<void> => {
    await client.delete(`/api/v1/lectures/jobs/${id}`)
  },
}
