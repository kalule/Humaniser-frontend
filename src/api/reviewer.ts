import client from './client'
import { downloadBlob } from '../lib/utils'
import { reviewReportFilename } from '../lib/reviewerExport'
import type { DocumentReview, DocumentReviewSummary, ReviewSourceType, ReviewType } from '../types/reviewer'

type Wrap<T> = { success: boolean; data: T }
const unwrap = <T>(res: { data: Wrap<T> }): T => res.data.data ?? (res.data as unknown as T)

export interface CreateReviewPayload {
  reviewType:         ReviewType
  sourceType:         Extract<ReviewSourceType, 'ResearchProject' | 'SystematicReview' | 'PastedText'>
  researchProjectId?: string | null
  systematicReviewId?: string | null
  sourceText?:        string | null
  documentTitle?:     string | null
  highQuality:        boolean
}

export const reviewerApi = {
  list: async (reviewType?: ReviewType): Promise<DocumentReviewSummary[]> =>
    unwrap(
      await client.get<Wrap<DocumentReviewSummary[]>>('/api/v1/reviewer/reviews', {
        params: reviewType ? { reviewType } : undefined,
      }),
    ),

  get: async (id: string): Promise<DocumentReview> =>
    unwrap(await client.get<Wrap<DocumentReview>>(`/api/v1/reviewer/reviews/${id}`)),

  create: async (payload: CreateReviewPayload): Promise<DocumentReview> =>
    unwrap(await client.post<Wrap<DocumentReview>>('/api/v1/reviewer/reviews', payload)),

  upload: async (file: File, reviewType: ReviewType, highQuality: boolean): Promise<DocumentReview> => {
    const form = new FormData()
    form.append('file', file)
    form.append('reviewType', reviewType)
    form.append('highQuality', String(highQuality))
    return unwrap(
      await client.post<Wrap<DocumentReview>>('/api/v1/reviewer/reviews/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    )
  },

  delete: async (id: string): Promise<void> => {
    await client.delete(`/api/v1/reviewer/reviews/${id}`)
  },

  exportPdf: async (id: string, documentTitle: string): Promise<void> => {
    const res = await client.get(`/api/v1/reviewer/reviews/${id}/export`, {
      params: { format: 'pdf' },
      responseType: 'blob',
    })
    downloadBlob(new Blob([res.data], { type: 'application/pdf' }), reviewReportFilename(documentTitle, 'pdf'))
  },
}
