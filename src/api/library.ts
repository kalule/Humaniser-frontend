import client from './client'
import type { WorkspaceDocument, WorkspaceFolder } from '../types/library'

export interface SaveDocumentPayload {
  id?:        string
  title:      string
  content?:   string
  filePath?:  string
  type:       string
  folderId?:  string | null
  isPdf:      boolean
  // PR20 — omit on normal edits; the server preserves whatever's already stored when this is
  // absent. Only handleAiGenerated's save call should ever set it.
  workbenchGenerationAuditId?: string
  // Create-path only — ignored by the server when `id` is set. A client-generated id for this
  // creation attempt; the server returns the existing row instead of inserting again if this
  // same id was already used, so a double-clicked create or a dropped-response retry can't
  // produce two documents. See useLibraryStore.createDocument, the only caller that sets this.
  clientRequestId?: string
  // New-document creation card (prompt #3) — full-replace fields, same as title/type, not
  // write-once like workbenchGenerationAuditId above.
  citationStyle?: string
  documentType?: string
}

export interface ImportDocumentItem {
  title:     string
  content?:  string
  filePath?: string
  type:      string
  folderId?: string | null
  isPdf:     boolean
}

export const libraryApi = {
  getDocuments: async (): Promise<WorkspaceDocument[]> => {
    const res = await client.get<{ success: boolean; data: WorkspaceDocument[] }>('/api/v1/library')
    return res.data.data ?? (res.data as unknown as WorkspaceDocument[])
  },

  saveDocument: async (payload: SaveDocumentPayload): Promise<WorkspaceDocument> => {
    const res = await client.post<{ success: boolean; data: WorkspaceDocument }>('/api/v1/library', payload)
    return res.data.data ?? (res.data as unknown as WorkspaceDocument)
  },

  deleteDocument: async (id: string): Promise<void> => {
    await client.delete(`/api/v1/library/${id}`)
  },

  // Real .docx / PDF. The server reads the body from the DB for the authenticated owner (404 for
  // anyone else's id); only the formatted reference-list entries come from the client.
  exportDocument: async (id: string, format: 'docx' | 'pdf', references: string[]): Promise<Blob> => {
    try {
      const res = await client.post<Blob>(`/api/v1/library/${id}/export`, { format, references }, { responseType: 'blob' })
      return res.data
    } catch (err) {
      // With responseType 'blob' an error body arrives as a Blob — read the server's message out of it.
      const data = (err as { response?: { data?: unknown } })?.response?.data
      if (data instanceof Blob) {
        let message: string | undefined
        try {
          const body = JSON.parse(await data.text()) as { error?: { message?: string } | string; message?: string }
          message = typeof body.error === 'string' ? body.error : body.error?.message ?? body.message
        } catch { /* not JSON — fall through to the original error */ }
        if (message) throw new Error(message)
      }
      throw err
    }
  },

  importDocuments: async (documents: ImportDocumentItem[]): Promise<{ importedCount: number }> => {
    const res = await client.post<{ success: boolean; data: { importedCount: number } }>(
      '/api/v1/library/import',
      { documents },
    )
    return res.data.data ?? (res.data as unknown as { importedCount: number })
  },

  getFolders: async (): Promise<WorkspaceFolder[]> => {
    const res = await client.get<{ success: boolean; data: WorkspaceFolder[] }>('/api/v1/library/folders')
    return res.data.data ?? (res.data as unknown as WorkspaceFolder[])
  },

  createFolder: async (name: string): Promise<WorkspaceFolder> => {
    const res = await client.post<{ success: boolean; data: WorkspaceFolder }>('/api/v1/library/folders', { name })
    return res.data.data ?? (res.data as unknown as WorkspaceFolder)
  },

  renameFolder: async (id: string, name: string): Promise<WorkspaceFolder> => {
    const res = await client.put<{ success: boolean; data: WorkspaceFolder }>(`/api/v1/library/folders/${id}`, { name })
    return res.data.data ?? (res.data as unknown as WorkspaceFolder)
  },

  deleteFolder: async (id: string): Promise<void> => {
    await client.delete(`/api/v1/library/folders/${id}`)
  },
}
