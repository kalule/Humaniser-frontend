import client from './client'
import type { CalculateRequest, CalculationResult } from '../lib/studyDesign'

// The shared client already unwraps the server's ApiResponse envelope.
const data = <T>(response: { data: T }) => response.data
const base = '/api/v1/study-design'

export interface StudyDesignAvailability {
  enabled: boolean
  /** The design advisor makes a paid model call and has its own switch. */
  advisor?: boolean
  advisorCredits?: number
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
  storedMethodsText: (projectId: string, id: string, style: 'harvard' | 'apa') =>
    client.get<{ text: string; style: string; projectChangedSince: boolean }>(`${base}/projects/${projectId}/calculations/${id}/methods-text`, { params: { style } }).then(data),
}
