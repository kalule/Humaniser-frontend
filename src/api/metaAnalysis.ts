import client from './client'

type Wrap<T> = { success: boolean; data: T }
const unwrap = <T>(res: { data: Wrap<T> }): T => res.data.data ?? (res.data as unknown as T)

export type EffectDataType = 'Continuous' | 'Dichotomous'
export type EffectDataStatus = 'Unverified' | 'Verified' | 'ReviewerEntered' | 'NotReported'

export interface EffectDataRow {
  id: string
  paperId: string
  paperTitle: string
  outcomeId: string
  dataType: EffectDataType
  status: EffectDataStatus
  verificationNote: string | null
  group1Label: string | null
  group2Label: string | null
  timepoint: string | null
  n1: number | null
  mean1: number | null
  sd1: number | null
  events1: number | null
  n2: number | null
  mean2: number | null
  sd2: number | null
  events2: number | null
  sourceExcerpt: string | null
  isManualOverride: boolean
}

export interface StudyEffect {
  paperId: string
  paperTitle: string
  estimate: number
  ciLow: number
  ciHigh: number
  weightPercent: number | null
}

export interface OutcomeMetaAnalysis {
  outcomeId: string
  outcomeName: string
  dataType: EffectDataType | null
  measure: string | null
  studiesWithUsableData: number
  studiesPooled: number
  estimate: number | null
  ciLow: number | null
  ciHigh: number | null
  predictionLow: number | null
  predictionHigh: number | null
  i2: number | null
  tau2: number | null
  q: number | null
  qDf: number | null
  qp: number | null
  p: number | null
  eggerP: number | null
  inconsistencySerious: boolean | null
  inconsistencyVerySerious: boolean | null
  imprecisionSerious: boolean | null
  gradeReasons: string[]
  notPooledReason: string | null
  studies: StudyEffect[]
  rows: EffectDataRow[]
}

export interface MetaAnalysisResponse {
  isExtracting: boolean
  method: string
  outcomes: OutcomeMetaAnalysis[]
}

export interface UpdateEffectDataPayload {
  dataType: EffectDataType
  notReported: boolean
  group1Label: string | null
  group2Label: string | null
  timepoint: string | null
  n1: number | null
  mean1: number | null
  sd1: number | null
  events1: number | null
  n2: number | null
  mean2: number | null
  sd2: number | null
  events2: number | null
}

const base = (id: string) => `/api/v1/systematicreview/${id}/meta-analysis`

export const metaAnalysisApi = {
  get: async (id: string): Promise<MetaAnalysisResponse> =>
    unwrap(await client.get<Wrap<MetaAnalysisResponse>>(base(id))),

  extract: async (id: string): Promise<{ jobId: string }> =>
    unwrap(await client.post<Wrap<{ jobId: string }>>(`${base(id)}/extract`)),

  extractStatus: async (id: string): Promise<{ isRunning: boolean; done: number; total: number }> =>
    unwrap(await client.get<Wrap<{ isRunning: boolean; done: number; total: number }>>(`${base(id)}/extract/status`)),

  updateRow: async (id: string, rowId: string, payload: UpdateEffectDataPayload): Promise<EffectDataRow> =>
    unwrap(await client.put<Wrap<EffectDataRow>>(`${base(id)}/rows/${rowId}`, payload)),
}
