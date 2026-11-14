import client from './client'
import type { CalculateRequest, CalculationResult } from '../lib/studyDesign'
import type { QuestionnaireDocument, QuestionnaireDto } from '../lib/questionnaire'
import { downloadBlob } from '../lib/utils'

// The shared client already unwraps the server's ApiResponse envelope.
const data = <T>(response: { data: T }) => response.data
const base = '/api/v1/study-design'

export interface StudyDesignAvailability {
  enabled: boolean
  /** The design advisor makes a paid model call and has its own switch. */
  advisor?: boolean
  advisorCredits?: number
  /** The questionnaire builder and codebook export. */
  instrument?: boolean
  /** The ethics-readiness checklist. */
  ethics?: boolean
  /** The consistency checks across the project, the primary calculation and the questionnaire. */
  consistency?: boolean
  /** Design name -> family, the closed list the advisor works with. */
  designs?: Record<string, string>
  formulaVersion: string
  calculators: string[]
}

export interface DesignAdvisorInput {
  title: string
  questions: string[]
  objectives: string[]
  hypotheses: string[]
  discipline: string
  degreeLevel: string
  statedDesign: string
  nonProbabilitySampling: boolean
  reachableParticipants: number | null
  requiredInvitations: number | null
}

export interface DesignAdviceRequest {
  projectId?: string
  title: string
  questions: string[]
  objectives: string[]
  hypotheses: string[]
  discipline: string
  degreeLevel: string
  statedDesign: string
  reachableParticipants?: number
}

export interface DesignMismatch { code: string; quotedPhrase: string; where: string; suggestion: string; origin: 'rule' | 'model' }

export interface DesignAdvice {
  schemaVersion: number
  /** rulesOnly: the advisor's answer was unavailable or failed its checks; nothing was charged. */
  source: 'model' | 'rulesOnly'
  notice: string | null
  recommended: { family: string; design: string; rationale: string[]; fitsQuestionIds: number[] } | null
  strongestAlternative: { family: string; design: string; whenItWouldBeBetter: string; whatItCosts: string } | null
  caveats: { code: string; text: string }[]
  mismatches: DesignMismatch[]
  questionsForStudent: string[]
  notCovered: string[]
}

export interface DesignAdviceResponse {
  id: string | null
  projectId: string | null
  createdAt: string
  creditsCharged: number
  input: DesignAdvisorInput
  advice: DesignAdvice
}

export interface StoredCalculation {
  id: string
  projectId: string
  calculator: string
  formulaVersion: string
  label: string | null
  isPrimary: boolean
  createdAt: string
  /** The project's title, objectives, hypotheses or methodology changed after this was calculated. */
  projectChangedSince: boolean
  result: CalculationResult
}

export interface MethodsTexts { harvard: string; apa: string }

export interface PilotDataset { id: string; fileName: string; rowCount: number; columnCount: number; uploadedAt: string }
export interface ItemReliability {
  variable: string
  reverseCoded: boolean
  nValid: number
  nMissing: number
  nOutOfRange: number
  nNotANumber: number
  mean: number | null
  sd: number | null
  itemRestCorrelation: number | null
  alphaIfDeleted: number | null
}
export interface ScaleReliability {
  name: string
  label: string
  scaleMin: number
  scaleMax: number
  missingColumns: string[]
  nRows: number
  nComplete: number
  /** null when it could not be computed; reason then says why. */
  alpha: number | null
  reasonCode: string | null
  reason: string | null
  scoreMean: number | null
  scoreSd: number | null
  items: ItemReliability[]
  notes: { code: string; text: string }[]
}
export interface PilotReliability {
  datasetId: string
  fileName: string
  questionnaireVersion: number
  banner: string
  report: {
    formulaVersion: string
    formulaName: string
    nRows: number
    variablesNotInDataset: string[]
    scales: ScaleReliability[]
    assumptions: { code: string; text: string }[]
  }
}

export type EthicsState = 'NotStarted' | 'InProgress' | 'Done' | 'NotApplicable'
export interface EthicsItem { id: string; text: string; state: EthicsState; note: string }
export interface EthicsEntry { itemId: string; state: EthicsState; note: string | null }
export interface EthicsChecklist {
  projectId: string
  version: number
  updatedAt: string | null
  checklistVersion: string
  header: string
  wordingNotice: string
  groups: { id: string; title: string; items: EthicsItem[] }[]
  /** Facts from elsewhere in Study Design shown beside an item. They never set a state. */
  links: { itemId: string; text: string }[]
  counts: Record<EthicsState, number>
}

export interface ConsistencyFinding {
  key: string
  code: string
  severity: 'warning' | 'info'
  message: string
  values: { label: string; value: string; source: string }[]
  foundInText: boolean
  canDismiss: boolean
  quote?: string | null
}
export interface ConsistencyResult {
  projectId: string
  checkedAt: string
  report: {
    rulesVersion: string
    findings: ConsistencyFinding[]
    dismissed: ConsistencyFinding[]
    hasPrimaryCalculation: boolean
    hasQuestionnaire: boolean
    sectionsRead: number
    notes: { code: string; text: string }[]
  }
}

export const studyDesignApi = {
  availability: () => client.get<StudyDesignAvailability>(`${base}/availability`).then(data),
  /** Nothing is stored. */
  calculate: (request: CalculateRequest) => client.post<CalculationResult>(`${base}/calculate`, request).then(data),
  /** Recalculated on the server from the same inputs; the text is never built from figures held in the browser. */
  methodsText: (request: CalculateRequest) => client.post<MethodsTexts>(`${base}/methods-text`, request).then(data),
  save: (projectId: string, request: CalculateRequest) => client.post<StoredCalculation>(`${base}/projects/${projectId}/calculations`, request).then(data),
  list: (projectId: string) => client.get<StoredCalculation[]>(`${base}/projects/${projectId}/calculations`).then(data),
  update: (projectId: string, id: string, change: { label?: string; isPrimary?: boolean }) =>
    client.put<StoredCalculation>(`${base}/projects/${projectId}/calculations/${id}`, change).then(data),
  remove: (projectId: string, id: string) => client.delete(`${base}/projects/${projectId}/calculations/${id}`).then(() => undefined),
  adviceInputs: (projectId: string) => client.get<DesignAdvisorInput>(`${base}/projects/${projectId}/advice/inputs`).then(data),
  /** The last advice stored for the project, or null when there is none. */
  latestAdvice: (projectId: string) =>
    client.get<DesignAdviceResponse | { none: true }>(`${base}/projects/${projectId}/advice/latest`).then(data).then(r => ('none' in r ? null : r)),
  advise: (request: DesignAdviceRequest) => client.post<DesignAdviceResponse>(`${base}/advice`, request).then(data),
  /** The project's questionnaire, or an unsaved starting point (version 0) built from its title and objectives. */
  instrument: (projectId: string) => client.get<QuestionnaireDto>(`${base}/projects/${projectId}/instrument`).then(data),
  /** Runs the checks on the server without storing anything. */
  checkInstrument: (document: QuestionnaireDocument) => client.post<QuestionnaireDto>(`${base}/instrument/check`, { document, expectedVersion: 0 }).then(data),
  /** expectedVersion is the version this edit started from; the server refuses the save if it has moved on. */
  saveInstrument: (projectId: string, document: QuestionnaireDocument, expectedVersion: number) =>
    client.put<QuestionnaireDto>(`${base}/projects/${projectId}/instrument`, { document, expectedVersion }).then(data),
  setInstrumentStatus: (projectId: string, status: { contentValidityReviewed: boolean; contentValidityNote?: string; piloted: boolean; pilotNote?: string }) =>
    client.put<QuestionnaireDto>(`${base}/projects/${projectId}/instrument/status`, status).then(data),
  deleteInstrument: (projectId: string) => client.delete(`${base}/projects/${projectId}/instrument`).then(() => undefined),
  downloadCodebook: async (projectId: string, format: 'json' | 'csv'): Promise<void> => {
    const res = await client.get(`${base}/projects/${projectId}/instrument/codebook`, { params: { format }, responseType: 'blob' })
    downloadBlob(new Blob([res.data], { type: format === 'json' ? 'application/json' : 'text/csv' }), `codebook.${format}`)
  },
  /** The user's Data Analyst datasets, to choose pilot data from. */
  datasets: () => client.get<PilotDataset[]>(`${base}/datasets`).then(data),
  /** Cronbach's alpha per scale, computed on the server from the saved questionnaire and the chosen dataset. */
  reliability: (projectId: string, datasetId: string) => client.post<PilotReliability>(`${base}/projects/${projectId}/instrument/reliability`, { datasetId }).then(data),
  ethicsChecklist: (projectId: string) => client.get<EthicsChecklist>(`${base}/projects/${projectId}/ethics-checklist`).then(data),
  /** expectedVersion is the version this edit started from; the server refuses the save if it has moved on. */
  saveEthicsChecklist: (projectId: string, entries: EthicsEntry[], expectedVersion: number) =>
    client.put<EthicsChecklist>(`${base}/projects/${projectId}/ethics-checklist`, { entries, expectedVersion }).then(data),
  /** Every finding is worked out on the server. Nothing in the project is changed. */
  consistency: (projectId: string) => client.get<ConsistencyResult>(`${base}/projects/${projectId}/consistency`).then(data),
  dismissFinding: (projectId: string, key: string) => client.post<ConsistencyResult>(`${base}/projects/${projectId}/consistency/dismissals`, { key }).then(data),
  restoreFinding: (projectId: string, key: string) =>
    client.delete<ConsistencyResult>(`${base}/projects/${projectId}/consistency/dismissals/${encodeURIComponent(key)}`).then(data),
  storedMethodsText: (projectId: string, id: string, style: 'harvard' | 'apa') =>
    client.get<{ text: string; style: string; projectChangedSince: boolean }>(`${base}/projects/${projectId}/calculations/${id}/methods-text`, { params: { style } }).then(data),
}
