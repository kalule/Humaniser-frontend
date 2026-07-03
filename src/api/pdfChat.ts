import client from './client'
import type {
  DocChatIngestResponse,
  DocChatJobStatus,
  DocChatQueryRequest,
  DocChatQueryResponse,
} from '../types/pdfChat'

const unwrap = <T>(res: { data: { success: boolean; data: T } }): T =>
  res.data.data ?? (res.data as unknown as T)

export const pdfChatApi = {
  upload: async (file: File): Promise<DocChatIngestResponse> => {
    const form = new FormData()
    form.append('file', file)
    const res = await client.post<{ success: boolean; data: DocChatIngestResponse }>(
      '/api/v1/document-chat/upload',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
    return res.data.data ?? (res.data as unknown as DocChatIngestResponse)
  },

  pollStatus: async (jobId: string): Promise<DocChatJobStatus> =>
    unwrap(
      await client.get<{ success: boolean; data: DocChatJobStatus }>(
        `/api/v1/document-chat/status/${jobId}`,
      ),
    ),

  query: async (data: DocChatQueryRequest): Promise<DocChatQueryResponse> =>
    unwrap(
      await client.post<{ success: boolean; data: DocChatQueryResponse }>(
        '/api/v1/document-chat/query',
        data,
      ),
    ),

  deleteDocument: async (documentId: string): Promise<void> => {
    await client.delete(`/api/v1/document-chat/${documentId}`)
  },
}
