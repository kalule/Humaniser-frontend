import client from './client'
import type {
  UploadDatasetResponse,
  AnalystQueryRequest,
  AnalystJobResponse,
  LiteratureCitation,
  WriteUpRequest,
  WriteUpResponse,
  MethodologyAppendixResponse,
  DataHealthReport,
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
  upload: async (file: File): Promise<UploadDatasetResponse> => {
    const form = new FormData()
    form.append('file', file)
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
