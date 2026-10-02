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
