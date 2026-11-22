import client from './client'
import type {
  AddSourcesResult, Evidence, EvidenceCell, HandOffResult, Matrix, MatrixPreset, MatrixRun, MatrixStudy, MatrixStudyPage, MatrixSummary,
} from '../lib/literatureMatrix'
import type { PaperSearchResult } from '../types/webLibrary'

// The shared client already unwraps the server's ApiResponse envelope.
const data = <T>(response: { data: T }) => response.data
const base = '/api/v1/literature-matrix'

export { projectResearchQuestions } from './projectContext'

const fileForm = (file: File, fields: Record<string, string | undefined>) => {
  const form = new FormData()
  form.append('file', file)
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) form.append(k, v)
  return form
}

export const literatureMatrixApi = {
  /** With the feature switched off on the server every route answers a bare 404. */
  presets: () => client.get<MatrixPreset[]>(`${base}/presets`).then(data),
  list: () => client.get<MatrixSummary[]>(`${base}/matrices`).then(data),
  get: (id: string) => client.get<Matrix>(`${base}/matrices/${id}`).then(data),
  create: (input: { name: string; researchQuestion?: string; researchProjectId?: string | null; preset?: string }) =>
    client.post<Matrix>(`${base}/matrices`, input).then(data),
  update: (id: string, patch: { name?: string; researchQuestion?: string; researchProjectId?: string; unlinkProject?: boolean }) =>
    client.patch<Matrix>(`${base}/matrices/${id}`, patch).then(data),
  remove: (id: string) => client.delete(`${base}/matrices/${id}`).then(() => undefined),

  // Rows (a matrix holds at most a few hundred, so the table loads them all and pages on screen)
  studies: (id: string) => client.get<MatrixStudyPage>(`${base}/matrices/${id}/studies`, { params: { pageSize: 500 } }).then(data),
  addSaved: (id: string, documentIds: string[]) => client.post<AddSourcesResult>(`${base}/matrices/${id}/sources/saved`, { documentIds }).then(data),
  /** The linked project's papers; no ids means every paper the student included there. */
  addProject: (id: string, literatureIds?: string[]) => client.post<AddSourcesResult>(`${base}/matrices/${id}/sources/project`, { literatureIds: literatureIds ?? null }).then(data),
  addSearch: (id: string, query: string, results: PaperSearchResult[]) =>
    client.post<AddSourcesResult>(`${base}/matrices/${id}/sources/search`, {
      query,
      results: results.map(r => ({ canonicalId: r.canonicalId, openAlexWorkId: r.openAlexWorkId, doi: r.doi, title: r.title, authors: r.authors, year: r.year, journal: r.journal, abstract: r.abstract, citationCount: r.citationCount })),
    }).then(data),
  upload: (id: string, file: File, consentAccepted: boolean, title?: string) =>
    client.post<AddSourcesResult>(`${base}/matrices/${id}/sources/upload`, fileForm(file, { consentAccepted: String(consentAccepted), title })).then(data),
  removeStudy: (studyId: string) => client.delete(`${base}/studies/${studyId}`).then(() => undefined),
  attachFullText: (studyId: string, file: File, consentAccepted: boolean) =>
    client.post<MatrixStudy>(`${base}/studies/${studyId}/full-text`, fileForm(file, { consentAccepted: String(consentAccepted) })).then(data),
  removeFullText: (studyId: string) => client.delete<MatrixStudy>(`${base}/studies/${studyId}/full-text`).then(data),
  /** Looks for a free open-access copy by DOI. Free: no model call, no credits. Can take up to a minute. */
  findFullText: (studyId: string) =>
    client.post<{ study: MatrixStudy; found: boolean }>(`${base}/studies/${studyId}/full-text/find`).then(data),
  resolveDuplicate: (studyId: string, action: 'merge' | 'keep') => client.post(`${base}/studies/${studyId}/duplicate`, { action }).then(() => undefined),
  updateStudy: (studyId: string, patch: { notes?: string; design?: string; themes?: string[] }) =>
    client.patch<MatrixStudy>(`${base}/studies/${studyId}`, patch).then(data),

  // Extraction
  startExtraction: (id: string, input: { studyIds?: string[]; consentAccepted: boolean; force?: boolean }) =>
    client.post<MatrixRun>(`${base}/matrices/${id}/extraction`, input).then(data),
  latestRun: (id: string) => client.get<MatrixRun | null>(`${base}/matrices/${id}/extraction`).then(data),

  // Evidence and cells
  evidence: (studyId: string) => client.get<Evidence>(`${base}/studies/${studyId}/evidence`).then(data),
  compare: (id: string, studyIds: string[]) => client.get<Evidence[]>(`${base}/matrices/${id}/compare`, { params: { studyIds: studyIds.join(',') } }).then(data),
  updateCell: (studyId: string, columnId: string, patch: { value?: string; verified?: boolean }) =>
    client.put<EvidenceCell>(`${base}/studies/${studyId}/cells/${columnId}`, patch).then(data),
  bulkVerify: (id: string, studyIds: string[], verified = true) =>
    client.post<{ changed: number; skippedUncertain: number }>(`${base}/matrices/${id}/verify`, { studyIds, verified }).then(data),

  // Columns
  addColumn: (id: string, label: string, instruction: string) => client.post<Matrix>(`${base}/matrices/${id}/columns`, { label, instruction }).then(data),
  updateColumn: (columnId: string, patch: { label?: string; instruction?: string; isVisible?: boolean; ordinal?: number }) =>
    client.patch<Matrix>(`${base}/columns/${columnId}`, patch).then(data),
  deleteColumn: (columnId: string) => client.delete<Matrix>(`${base}/columns/${columnId}`).then(data),

  // Export and hand-off
  export: async (id: string, format: string, studyIds: string[] = []): Promise<Blob> =>
    (await client.get<Blob>(`${base}/matrices/${id}/export`, { params: { format, studyIds: studyIds.length ? studyIds.join(',') : undefined }, responseType: 'blob' })).data,
  handOff: (id: string, projectId: string, studyIds: string[]) =>
    client.post<HandOffResult>(`${base}/matrices/${id}/hand-off`, { projectId, studyIds }).then(data),
}
