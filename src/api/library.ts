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
