// Research Gap Finder — mirrors HumaniseAI.Application/DTOs/GapFinding/GapFindingDtos.cs.
// There is deliberately no confidence field: verification status + coverage replace it.

export type GapRunStatus = 'queued' | 'running' | 'awaiting_scope' | 'completed' | 'failed' | 'cancelled'

export type GapType = 'insufficient' | 'unreliable_methods' | 'conflicting' | 'wrong_question'

export type GapVerificationStatus =
  | 'no_clear_answer_found'
  | 'partly_addressed'
  | 'narrowed'
  | 'rejected'
  | 'not_verified'

export interface GapScope {
  concepts: string[]
  population: string | null
  location: string | null
  queries: string[]
  isComputerScience: boolean
}

export interface GapCorpusPaper {
  workId: string
  title: string
  year: number | null
  isPreprint: boolean
  isReview: boolean
  doi: string | null
  url: string | null
  sources: string[]
}

export interface GapCorpusSummary {
  papersScreened: number
  papersUsed: number
  preprintShare: number
  papers: GapCorpusPaper[]
}

export interface GapEvidence {
  workId: string
  title: string
  year: number | null
  doi: string | null
  url: string | null
  claim: string
  passage: string
  verified: boolean
}

export interface GapClosestWork {
  workId: string
  title: string
  judgement: 'addresses' | 'partly' | 'does_not'
  snippet: string | null
  url: string | null
}

export interface GapVerification {
  status: GapVerificationStatus
  queriesRun: string[]
  hitsJudged: number
  closestWorks: GapClosestWork[]
}

export interface GapCoverage {
  papersScreened: number
  papersUsed: number
  abstractsOnly: number
  fullTexts: number
  preprintShare: number
  sources: string[]
  searchDate: string
  notReviewed: string[]
  notes: string[]
}

export interface GapCard {
  gapId: string
  type: GapType
  statement: string
  whatIsKnown: string
  evidence: GapEvidence[]
  verification: GapVerification
  suggestedQuestion: string
  coverage: GapCoverage
  promptVersion: string
}

export interface GapRejection {
  type: GapType
  statement: string
  reason: string
}

export type GapStage = 'scope' | 'retrieve' | 'screen' | 'extract' | 'candidates' | 'verify' | 'present'

export interface GapRun {
  id: string
  projectId: string
  topic: string
  status: GapRunStatus
  stage: GapStage
  statusMessage: string
  scope: GapScope | null
  corpus: GapCorpusSummary | null
  cards: GapCard[]
  rejections: GapRejection[]
  noMoreQualifiedReason: string | null
  failureReason: string | null
  usedGapId: string | null
  caveat: string
  createdAt: string
  completedAt: string | null
}

export interface ConfirmGapScopePayload {
  concepts: string[]
  population: string | null
  location: string | null
  queries: string[]
  isComputerScience: boolean
}

export interface UseGapResult {
  gapId: string
  title: string
  statement: string
  suggestedQuestion: string
}
