import client from './client'
import type { CitationDto, ResolvedCitation, SaveCitationRequest, FormatStyle } from '../types/citation'

export const citationApi = {
  update: async (id: string, data: SaveCitationRequest): Promise<CitationDto> => {
    const res = await client.put<{ success: boolean; data: CitationDto }>(`/api/v1/citations/${id}`, data)
    return res.data.data ?? (res.data as unknown as CitationDto)
  },
  resolve: async (inputType: string, value: string): Promise<ResolvedCitation> => {
    const res = await client.post<{ success: boolean; data: ResolvedCitation }>(
      '/api/v1/citations/resolve',
      { inputType, value },
    )
    return res.data.data ?? (res.data as unknown as ResolvedCitation)
  },

  save: async (data: SaveCitationRequest): Promise<CitationDto> => {
    const res = await client.post<{ success: boolean; data: CitationDto }>(
      '/api/v1/citations',
      data,
    )
    return res.data.data ?? (res.data as unknown as CitationDto)
  },

  getLibrary: async (): Promise<CitationDto[]> => {
    const res = await client.get<{ success: boolean; data: CitationDto[] }>('/api/v1/citations')
    return res.data.data ?? (res.data as unknown as CitationDto[])
  },

  delete: async (id: string): Promise<void> => {
    await client.delete(`/api/v1/citations/${id}`)
  },

  exportDocx: async (format: FormatStyle): Promise<void> => {
    const res = await client.post('/api/v1/citations/export/docx', { format }, { responseType: 'blob' })
    const url = URL.createObjectURL(new Blob([res.data]))
    const a   = document.createElement('a')
    a.href     = url
    a.download = 'references.docx'
    a.click()
    URL.revokeObjectURL(url)
  },

  exportBibTex: async (): Promise<void> => {
    const res = await client.get('/api/v1/citations/export/bibtex', { responseType: 'blob' })
    const url = URL.createObjectURL(new Blob([res.data], { type: 'text/plain' }))
    const a   = document.createElement('a')
    a.href     = url
    a.download = 'references.bib'
    a.click()
    URL.revokeObjectURL(url)
  },
}
