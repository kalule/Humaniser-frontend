import client from './client'
import type { DocumentType, FeedbackThread, FeedbackThreadSummary, ItemStatus } from '../lib/feedbackTracker'

// The shared client already unwraps the server's ApiResponse envelope.
const data = <T>(response: { data: T }) => response.data
const base = '/api/v1/feedback-tracker'

export interface NewThreadInput {
  title: string
  documentType: DocumentType
  commentsText: string
  consentAccepted: boolean
}

export const feedbackTrackerApi = {
  /** With the feature switched off on the server every route answers a bare 404. */
  list: () => client.get<FeedbackThreadSummary[]>(`${base}/threads`).then(data),
  get: (id: string) => client.get<FeedbackThread>(`${base}/threads/${id}`).then(data),

  create: (input: NewThreadInput, draftText: string, draftFileName?: string) =>
    client.post<FeedbackThread>(`${base}/threads`, { ...input, draftText, draftSource: draftFileName ? 'UploadedFile' : 'PastedText', draftFileName }).then(data),
  /** .pdf and .docx are read on the server, by the same extractor that reads later versions. */
  createFromFile: (input: NewThreadInput, file: File) => {
    const form = new FormData()
    form.append('file', file)
    form.append('title', input.title)
    form.append('documentType', input.documentType)
    form.append('commentsText', input.commentsText)
    form.append('consentAccepted', String(input.consentAccepted))
    return client.post<FeedbackThread>(`${base}/threads/upload`, form).then(data)
  },

  addDraft: (threadId: string, draftText: string, draftFileName?: string) =>
    client.post<FeedbackThread>(`${base}/threads/${threadId}/drafts`, { draftText, draftSource: draftFileName ? 'UploadedFile' : 'PastedText', draftFileName, highQuality: false }).then(data),
  addDraftFromFile: (threadId: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    form.append('highQuality', 'false')
    return client.post<FeedbackThread>(`${base}/threads/${threadId}/drafts/upload`, form).then(data)
  },

  patchItem: (itemId: string, patch: { status?: ItemStatus; studentNote?: string; actionText?: string }) =>
    client.patch<FeedbackThread>(`${base}/items/${itemId}`, patch).then(data),
  deleteItem: (itemId: string) => client.delete<FeedbackThread>(`${base}/items/${itemId}`).then(data),
  deleteThread: (id: string) => client.delete(`${base}/threads/${id}`).then(() => undefined),
}
