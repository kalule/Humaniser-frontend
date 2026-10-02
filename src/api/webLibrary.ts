import client from './client'
import type { ResearchDocument, LibraryFolder, PaperSearchResult, Collection, CollectionDetail } from '../types/webLibrary'

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

export interface WebLibrarySearchResponse {
  query:         string
  results:       PaperSearchResult[]
  page:          number
  pageSize:      number
  totalReturned: number
}

export interface SaveFromSearchPayload {
  canonicalId:    string
  openAlexWorkId?: string
  doi?:            string
  title:           string
  authors:         string[]
  year?:           number
  journal?:        string
  abstract?:       string
  citationCount?:  number
  folderId?:       string | null
}

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

  searchPapers: async (query: string, page = 1, pageSize = 20): Promise<WebLibrarySearchResponse> => {
    const res = await client.get<{ success: boolean; data: WebLibrarySearchResponse }>('/api/v1/web-library/search', {
      params: { query, page, pageSize },
    })
    return res.data.data ?? (res.data as unknown as WebLibrarySearchResponse)
  },

  saveFromSearch: async (payload: SaveFromSearchPayload): Promise<ResearchDocument> => {
    const res = await client.post<{ success: boolean; data: ResearchDocument }>('/api/v1/web-library/save-from-search', payload)
    return res.data.data ?? (res.data as unknown as ResearchDocument)
  },

  getCollections: async (): Promise<Collection[]> => {
    const res = await client.get<{ success: boolean; data: Collection[] }>('/api/v1/web-library/collections')
    return res.data.data ?? (res.data as unknown as Collection[])
  },

  getCollectionDetail: async (id: string): Promise<CollectionDetail> => {
    const res = await client.get<{ success: boolean; data: CollectionDetail }>(`/api/v1/web-library/collections/${id}`)
    return res.data.data ?? (res.data as unknown as CollectionDetail)
  },

  createCollection: async (name: string, description?: string): Promise<Collection> => {
    const res = await client.post<{ success: boolean; data: Collection }>('/api/v1/web-library/collections', { name, description })
    return res.data.data ?? (res.data as unknown as Collection)
  },

  updateCollection: async (id: string, name: string, description?: string): Promise<Collection> => {
    const res = await client.put<{ success: boolean; data: Collection }>(`/api/v1/web-library/collections/${id}`, { name, description })
    return res.data.data ?? (res.data as unknown as Collection)
  },

  deleteCollection: async (id: string): Promise<void> => {
    await client.delete(`/api/v1/web-library/collections/${id}`)
  },

  addToCollection: async (collectionId: string, documentId: string): Promise<void> => {
    await client.post(`/api/v1/web-library/collections/${collectionId}/papers`, { documentId })
  },

  removeFromCollection: async (collectionId: string, documentId: string): Promise<void> => {
    await client.delete(`/api/v1/web-library/collections/${collectionId}/papers/${documentId}`)
  },
}
