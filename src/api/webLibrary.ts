import client from './client'
import type { ResearchDocument, LibraryFolder } from '../types/webLibrary'

export interface SaveWebLibraryDocumentPayload {
  id?:          string
  title:        string
  authors:      string[]
  docType:      string
  year?:        number
  journal?:     string
  filePath?:    string
  isFullText:   boolean
  tldr?:        string
  conclusions?: string
  abstract?:    string
  results?:     string
  intro?:       string
  methodology?: string
  limitations?: string
  literature?:  string
  tags:         string[]
  folderId?:    string | null
}

export type ImportWebLibraryDocumentItem = Omit<SaveWebLibraryDocumentPayload, 'id'>

export const webLibraryApi = {
  getDocuments: async (): Promise<ResearchDocument[]> => {
    const res = await client.get<{ success: boolean; data: ResearchDocument[] }>('/api/v1/web-library')
    return res.data.data ?? (res.data as unknown as ResearchDocument[])
  },

  saveDocument: async (payload: SaveWebLibraryDocumentPayload): Promise<ResearchDocument> => {
    const res = await client.post<{ success: boolean; data: ResearchDocument }>('/api/v1/web-library', payload)
    return res.data.data ?? (res.data as unknown as ResearchDocument)
  },

  deleteDocument: async (id: string): Promise<void> => {
    await client.delete(`/api/v1/web-library/${id}`)
  },

  importDocuments: async (documents: ImportWebLibraryDocumentItem[]): Promise<{ importedCount: number }> => {
    const res = await client.post<{ success: boolean; data: { importedCount: number } }>(
      '/api/v1/web-library/import',
      { documents },
    )
    return res.data.data ?? (res.data as unknown as { importedCount: number })
  },

  getFolders: async (): Promise<LibraryFolder[]> => {
    const res = await client.get<{ success: boolean; data: LibraryFolder[] }>('/api/v1/web-library/folders')
    return res.data.data ?? (res.data as unknown as LibraryFolder[])
  },

  createFolder: async (name: string): Promise<LibraryFolder> => {
    const res = await client.post<{ success: boolean; data: LibraryFolder }>('/api/v1/web-library/folders', { name })
    return res.data.data ?? (res.data as unknown as LibraryFolder)
  },

  renameFolder: async (id: string, name: string): Promise<LibraryFolder> => {
    const res = await client.put<{ success: boolean; data: LibraryFolder }>(`/api/v1/web-library/folders/${id}`, { name })
    return res.data.data ?? (res.data as unknown as LibraryFolder)
  },

  deleteFolder: async (id: string): Promise<void> => {
    await client.delete(`/api/v1/web-library/folders/${id}`)
  },
}
