import client from './client'
import type {
  UploadDatasetResponse,
  AnalystQueryRequest,
  AnalystJobResponse,
  AnalystJobSummary,
  LiteratureCitation,
  WriteUpRequest,
  WriteUpResponse,
  MethodologyAppendixResponse,
  DataHealthReport,
  QualityState,
  QualityFixAction,
  CleanDatasetConfig,
  CleanDatasetResponse,
  PreparationBlueprintRequest,
  PreparationBlueprint,
  AcademicSynthesisRequest,
  AcademicSynthesis,
  SessionSummary,
  SessionDetail,
} from '../types/analyst'

const unwrap = <T>(res: { data: { success: boolean; data: T } }): T =>
  res.data.data ?? (res.data as unknown as T)

export const analystApi = {
  // isSyntheticData: self-declared, undefined/omitted means "not asked" (kept distinct from an
  // affirmative "declared real") — see AnalystDataset.IsSyntheticData's own doc comment for why.
  upload: async (file: File, isSyntheticData?: boolean): Promise<UploadDatasetResponse> => {
    const form = new FormData()
    form.append('file', file)
    if (isSyntheticData !== undefined) form.append('isSyntheticData', String(isSyntheticData))
    const res = await client.post<{ success: boolean; data: UploadDatasetResponse }>(
      '/api/v1/analyst/upload',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
    return res.data.data ?? (res.data as unknown as UploadDatasetResponse)
  },

  query: async (data: AnalystQueryRequest): Promise<AnalystJobResponse> => {
    const res = await client.post<{ success: boolean; data: AnalystJobResponse }>(
      '/api/v1/analyst/query',
      data,
    )
    return res.data.data ?? (res.data as unknown as AnalystJobResponse)
  },

  pollJob: async (jobId: string): Promise<AnalystJobResponse> => {
    const res = await client.get<{ success: boolean; data: AnalystJobResponse }>(
      `/api/v1/analyst/jobs/${jobId}`,
    )
    return res.data.data ?? (res.data as unknown as AnalystJobResponse)
  },

  // Phase 4 — jobs eligible to link to a Research Paper's Results/Discussion generation.
  listJobsWithStatistics: async (): Promise<AnalystJobSummary[]> =>
    unwrap(await client.get<{ success: boolean; data: AnalystJobSummary[] }>(
      '/api/v1/analyst/jobs/with-statistics',
    )),

  getLiterature: async (jobId: string): Promise<LiteratureCitation[]> =>
    unwrap(await client.get<{ success: boolean; data: LiteratureCitation[] }>(
      `/api/v1/analyst/jobs/${jobId}/literature`,
    )),

  generateWriteUp: async (data: WriteUpRequest): Promise<WriteUpResponse> =>
    unwrap(await client.post<{ success: boolean; data: WriteUpResponse }>(
      '/api/v1/analyst/writeup', data,
    )),

  getMethodologyAppendix: async (jobId: string, styleGuide = 'APA7'): Promise<MethodologyAppendixResponse> =>
    unwrap(await client.get<{ success: boolean; data: MethodologyAppendixResponse }>(
      `/api/v1/analyst/jobs/${jobId}/methodology?styleGuide=${styleGuide}`,
    )),

  exportMethodologyDocx: (jobId: string, styleGuide = 'APA7'): string =>
    `/api/v1/analyst/jobs/${jobId}/methodology/export?styleGuide=${styleGuide}`,

  downloadMethodologyDocx: async (jobId: string, styleGuide = 'APA7'): Promise<Blob> => {
    const res = await client.post<Blob>(
      `/api/v1/analyst/jobs/${jobId}/methodology/export?styleGuide=${styleGuide}`,
      {},
      { responseType: 'blob' }
    )
    return res.data
  },

  profileDataset: async (datasetId: string): Promise<DataHealthReport> =>
    unwrap(await client.post<{ success: boolean; data: DataHealthReport }>(
      `/api/v1/analyst/datasets/${datasetId}/profile`,
      {},
    )),

  /** Ask the server to stop a run. Resolves with the job's status after the request. */
  cancelJob: async (jobId: string): Promise<string> =>
    unwrap(await client.post<{ success: boolean; data: { status: string } }>(
      `/api/v1/analyst/jobs/${jobId}/cancel`,
      {},
    )).status,

  getQualityState: async (datasetId: string): Promise<QualityState> =>
    unwrap(await client.get<{ success: boolean; data: QualityState }>(
      `/api/v1/analyst/datasets/${datasetId}/quality/log`,
    )),

  applyQualityFix: async (datasetId: string, issueId: string, action: QualityFixAction): Promise<QualityState> =>
    unwrap(await client.post<{ success: boolean; data: QualityState }>(
      `/api/v1/analyst/datasets/${datasetId}/quality/fix`,
      { issueId, action },
    )),

  /** Change one cell of the working copy. `row` is the spreadsheet row number; an empty value clears the cell. */
  editQualityCell: async (datasetId: string, column: string, row: number, value: string): Promise<QualityState> =>
    unwrap(await client.post<{ success: boolean; data: QualityState }>(
      `/api/v1/analyst/datasets/${datasetId}/quality/edit`,
      { column, row, value },
    )),

  /** Undo one step (the rest are replayed from the original upload), or every step when `step` is omitted. */
  undoCleaning: async (datasetId: string, step?: number): Promise<QualityState> =>
    unwrap(await client.delete<{ success: boolean; data: QualityState }>(
      `/api/v1/analyst/datasets/${datasetId}/quality/log`,
      { params: step === undefined ? {} : { step } },
    )),

  cleanDataset: async (config: CleanDatasetConfig): Promise<CleanDatasetResponse> =>
    unwrap(await client.post<{ success: boolean; data: CleanDatasetResponse }>(
      `/api/v1/analyst/datasets/${config.datasetId}/clean`,
      config,
    )),

  parseCleaningInstruction: async (datasetId: string, instruction: string): Promise<CleanDatasetConfig> =>
    unwrap(await client.post<{ success: boolean; data: CleanDatasetConfig }>(
      `/api/v1/analyst/datasets/${datasetId}/clean/parse`,
      { instruction },
    )),

  generatePreparationBlueprint: async (
    datasetId: string,
    request: PreparationBlueprintRequest,
  ): Promise<PreparationBlueprint> =>
    unwrap(await client.post<{ success: boolean; data: PreparationBlueprint }>(
      `/api/v1/analyst/datasets/${datasetId}/prepare`,
      request,
    )),

  generateSynthesis: async (
    jobId: string,
    request: AcademicSynthesisRequest,
  ): Promise<AcademicSynthesis> =>
    unwrap(await client.post<{ success: boolean; data: AcademicSynthesis }>(
      `/api/v1/analyst/jobs/${jobId}/synthesis`,
      request,
    )),

  // ── Session endpoints ───────────────────────────────────────────────────────

  getSessions: async (): Promise<SessionSummary[]> =>
    unwrap(await client.get<{ success: boolean; data: SessionSummary[] }>(
      '/api/v1/analyst/sessions',
    )),

  getSession: async (sessionId: string): Promise<SessionDetail> =>
    unwrap(await client.get<{ success: boolean; data: SessionDetail }>(
      `/api/v1/analyst/sessions/${sessionId}`,
    )),

  deleteSession: async (sessionId: string): Promise<void> => {
    await client.delete(`/api/v1/analyst/sessions/${sessionId}`)
  },

  downloadSessionDocx: async (sessionId: string): Promise<Blob> => {
    const res = await client.get<Blob>(
      `/api/v1/analyst/sessions/${sessionId}/export/docx`,
      { responseType: 'blob' },
    )
    return res.data
  },
}
