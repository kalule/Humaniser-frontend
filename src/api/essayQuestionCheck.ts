import client from './client'

export type EssayReadiness = 'Ready' | 'NeedsRefinement' | 'InsufficientInformation'
export type QuestionCheckGate = 'Proceed' | 'Warn' | 'Block'

export interface EssayQuestionCheckRequest {
  question: string
  academicLevel?: string
  wordCount?: number
  discipline?: string
  assignmentBrief?: string
  isSetQuestion?: boolean
}

export interface EssayQuestionAssessment {
  specificityScore: number
  academicDepthScore: number
  searchabilityScore: number
  researchabilityScore: number
  scopeFeasibilityScore: number
  conceptualClarityScore: number
  answerabilityScore: number
  criticalFlags: string[]
  critique: string
  questionInterpretation: string
  questionType: string
  commandWords: string[]
  academicDiscipline: string
  centralConcepts: string[]
  missingContext: string[]
  suggestedPromptMode: 'Rewrites' | 'InterpretationAngles'
  suggestedPrompts: string[]
  searchKeywords: { term: string; type: string }[]
  essayReadiness: EssayReadiness
  readinessExplanation: string
  requiresClarification: boolean
  clarificationQuestion: string | null
}

/** available = false when the check is off, over the daily limit or failed: the student writes as before. */
export interface EssayQuestionCheckResult {
  available: boolean
  assessment: EssayQuestionAssessment | null
  overallPercent: number | null
  classification: string | null
  gate: QuestionCheckGate
  canOverride: boolean
  gateReasons: string[]
  promptVersion: string
}

export const essayQuestionCheckApi = {
  check: (request: EssayQuestionCheckRequest) =>
    // The client's response interceptor already unwraps the { success, data } envelope.
    client.post<EssayQuestionCheckResult>('/api/v1/essay-question-check', request).then(r => r.data),
}
