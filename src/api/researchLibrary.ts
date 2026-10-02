import client from './client'
import type { FullTextAvailability, PaperDetails } from '../types/researchLibrary'

function unwrap<T>(payload: { data?: T } | T): T {
  return ((payload as { data?: T }).data ?? payload) as T
}

export const researchLibraryApi = {
  getPaper: async (workId: string): Promise<PaperDetails> => {
    const response = await client.get(`/api/v1/research-library/papers/${encodeURIComponent(workId)}`)
    return unwrap<PaperDetails>(response.data)
  },
  getFullText: async (workId: string): Promise<FullTextAvailability> => {
    const response = await client.get(`/api/v1/research-library/papers/${encodeURIComponent(workId)}/full-text`)
    return unwrap<FullTextAvailability>(response.data)
  },
  recordAccess: async (workId: string): Promise<void> => {
    await client.post(`/api/v1/research-library/papers/${encodeURIComponent(workId)}/access`)
  },
  getPdfBlob: async (workId: string, signal?: AbortSignal): Promise<Blob> => {
    const response = await client.get(`/api/v1/research-library/papers/${encodeURIComponent(workId)}/pdf`, {
      responseType: 'blob', signal,
    })
    return response.data as Blob
  },
}
