import client from './client'
import type { StudioDocument, StudioType, WizardMode } from '../types/studio'

export interface SaveStudioDocumentPayload {
  id?:             string
  title:           string
  studioType:      StudioType
  wizardMode:      WizardMode
  linkedEditorId?: string | null
}

export interface ImportStudioDocumentItem {
  title:      string
  studioType: StudioType
  wizardMode: WizardMode
}

export const studioApi = {
  getDocuments: async (): Promise<StudioDocument[]> => {
    const res = await client.get<{ success: boolean; data: StudioDocument[] }>('/api/v1/studio')
    return res.data.data ?? (res.data as unknown as StudioDocument[])
  },

  saveDocument: async (payload: SaveStudioDocumentPayload): Promise<StudioDocument> => {
    const res = await client.post<{ success: boolean; data: StudioDocument }>('/api/v1/studio', payload)
    return res.data.data ?? (res.data as unknown as StudioDocument)
  },

  deleteDocument: async (id: string): Promise<void> => {
    await client.delete(`/api/v1/studio/${id}`)
  },

  importDocuments: async (documents: ImportStudioDocumentItem[]): Promise<{ importedCount: number }> => {
    const res = await client.post<{ success: boolean; data: { importedCount: number } }>(
      '/api/v1/studio/import',
      { documents },
    )
    return res.data.data ?? (res.data as unknown as { importedCount: number })
  },
}
