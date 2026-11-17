import client from './client'
import type {
  Declaration, DeclarationCategory, DeclarationDraft, DeclarationTemplate, DocumentSummary, EvidenceDocument, Outcome, Report,
  ReportSummary, Settings, UsageEntry, VersionComparison, VersionContent,
} from '../lib/authorshipEvidence'

// The shared client already unwraps the server's ApiResponse envelope.
const data = <T>(response: { data: T }) => response.data
const base = '/api/v1/authorship-evidence'

export interface UsageEntryInput {
  documentId?: string | null
  occurredAt?: string | null
  tool?: string
  assistanceType?: string
  section?: string | null
  wordsAffected?: number | null
  outcome?: Outcome | null
  note?: string | null
}

export const authorshipEvidenceApi = {
  /** With the feature switched off on the server every route answers a bare 404. */
  settings: () => client.get<Settings>(`${base}/settings`).then(data),
  setSettings: (change: { recordingAccepted?: boolean; keepFullText?: boolean }) => client.put<Settings>(`${base}/settings`, change).then(data),

  documents: () => client.get<DocumentSummary[]>(`${base}/documents`).then(data),
  document: (id: string) => client.get<EvidenceDocument>(`${base}/documents/${id}`).then(data),
  setRecording: (id: string, paused: boolean) => client.post<EvidenceDocument>(`${base}/documents/${id}/recording`, { paused }).then(data),
  deleteEvidence: (id: string) => client.delete(`${base}/documents/${id}/evidence`).then(() => undefined),
  deleteAll: () => client.delete(`${base}/all`).then(() => undefined),

  saveVersion: (id: string) => client.post<EvidenceDocument>(`${base}/documents/${id}/versions`).then(data),
  version: (versionId: string) => client.get<VersionContent>(`${base}/versions/${versionId}`).then(data),
  compare: (fromId: string, toId: string) => client.get<VersionComparison>(`${base}/versions/${fromId}/compare/${toId}`).then(data),
  importDraft: (id: string, text: string, fileName: string | null, declaredDate: string | null) =>
    client.post<EvidenceDocument>(`${base}/documents/${id}/imports`, { text, fileName, declaredDate }).then(data),
  /** .pdf and .docx are read on the server. */
  importDraftFile: (id: string, file: File, declaredDate: string | null) => {
    const form = new FormData()
    form.append('file', file)
    if (declaredDate) form.append('declaredDate', declaredDate)
    return client.post<EvidenceDocument>(`${base}/documents/${id}/imports/upload`, form).then(data)
  },

  register: (documentId?: string) => client.get<UsageEntry[]>(`${base}/register`, { params: documentId ? { documentId } : undefined }).then(data),
  addEntry: (input: UsageEntryInput) => client.post<UsageEntry>(`${base}/register`, input).then(data),
  patchEntry: (entryId: string, patch: { outcome?: Outcome; note?: string; documentId?: string; unlink?: boolean }) =>
    client.patch<UsageEntry>(`${base}/register/${entryId}`, patch).then(data),
  correctEntry: (entryId: string, input: UsageEntryInput) => client.post<UsageEntry>(`${base}/register/${entryId}/corrections`, input).then(data),
  deleteEntry: (entryId: string) => client.delete(`${base}/register/${entryId}`).then(() => undefined),

  templates: () => client.get<DeclarationTemplate[]>(`${base}/templates`).then(data),
  saveTemplate: (input: { name: string; institution?: string | null; category?: string | null; body: string }, id?: string) =>
    (id ? client.put<DeclarationTemplate>(`${base}/templates/${id}`, input) : client.post<DeclarationTemplate>(`${base}/templates`, input)).then(data),
  deleteTemplate: (id: string) => client.delete(`${base}/templates/${id}`).then(() => undefined),

  draftDeclaration: (id: string, input: { category?: DeclarationCategory | null; templateKey?: string | null; explanation?: string | null; useAiWording?: boolean }) =>
    client.post<DeclarationDraft>(`${base}/documents/${id}/declaration/draft`, input).then(data),
  saveDeclaration: (id: string, input: { category: DeclarationCategory; text: string; templateKey?: string | null; draftOrigin?: string }) =>
    client.put<Declaration>(`${base}/documents/${id}/declaration`, input).then(data),
  confirmDeclaration: (id: string, accuracyConfirmed: boolean) =>
    client.post<Declaration>(`${base}/documents/${id}/declaration/confirm`, { accuracyConfirmed }).then(data),

  previewReport: (id: string) => client.get<Report>(`${base}/documents/${id}/report-preview`).then(data),
  generateReport: (id: string) => client.post<Report>(`${base}/documents/${id}/reports`).then(data),
  reports: (documentId?: string) => client.get<ReportSummary[]>(`${base}/reports`, { params: documentId ? { documentId } : undefined }).then(data),
  report: (reportId: string) => client.get<Report>(`${base}/reports/${reportId}`).then(data),
  deleteReport: (reportId: string) => client.delete(`${base}/reports/${reportId}`).then(() => undefined),
  /** The stored report as a file. The server renders it from the content frozen when the report was created. */
  exportReport: (reportId: string, format: 'pdf' | 'docx') =>
    client.get<Blob>(`${base}/reports/${reportId}/export`, { params: { format }, responseType: 'blob' }),
}
