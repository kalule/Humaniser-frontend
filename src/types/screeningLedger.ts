// Reviewer screening ledger — mirrors HumaniseAI.Application.DTOs.SystematicReview.ScreeningLedgerDtos.
// Enums arrive as strings (JsonStringEnumConverter).

export type ScreeningStage = 'TitleAbstract' | 'FullText'
export type ScreeningLabelDecision = 'Withdrawn' | 'Include' | 'Exclude' | 'Uncertain' | 'FullTextUnavailable'
export type ScreeningLabelRole = 'Reviewer' | 'Adjudication'
export type ScreeningMode = 'AiAssisted' | 'ReviewerLedger'
export type ReviewMemberRole = 'Reviewer' | 'Adjudicator'
export type EvidenceRole = 'Direct' | 'Contextual'
export type LabelResolution = 'None' | 'Partial' | 'Agreed' | 'Conflict' | 'Adjudicated'
export type QueueView = 'next' | 'unresolved' | 'reassess' | 'conflicts'
export type ScreeningAccess = 'owner' | 'adjudicator' | 'reviewer'

/** none | queued | running | fresh | stale | invalidated | not_trainable | failed */
export type RankingState = 'none' | 'queued' | 'running' | 'fresh' | 'stale' | 'invalidated' | 'not_trainable' | 'failed'

export type ScreeningRecordState =
  | 'AwaitingTitleAbstract' | 'AwaitingClarification' | 'ExcludedTitleAbstract' | 'FullTextSought'
  | 'FullTextUnavailable' | 'AwaitingFullTextAssessment' | 'ExcludedFullText' | 'IncludedStudy' | 'AwaitingAdjudication'

export interface ScreeningCriterionBrief {
  id: string
  type: string
  name: string
  description: string
  include: string | null
  exclude: string | null
}

export interface ScreeningLabel {
  id: string
  paperId: string
  stage: ScreeningStage
  decision: ScreeningLabelDecision
  role: ScreeningLabelRole
  reason: string | null
  exclusionCriterionId: string | null
  note: string | null
  reviewerId: string
  reviewerName: string | null
  decidedAt: string
  protocolVersion: number
  needsReassessment: boolean
  isCurrent: boolean
  importedFromLegacy: boolean
  rankingRunId: string | null
  rankPosition: number | null
}

export interface ScreeningQueueItem {
  paperId: string
  title: string
  authors: string
  publicationDate: string | null
  journal: string | null
  doi: string | null
  abstract: string | null
  sourceUrl: string | null
  source: string
  hasAbstract: boolean
  fullTextAvailable: boolean
  state: ScreeningRecordState
  resolution: LabelResolution
  /** Position in the published order (1 = first). Not a score, not a probability. */
  rankPosition: number | null
  rankingRunId: string | null
  /** How many other reviewers have decided. Their decisions are never sent before you decide. */
  otherReviewerCount: number
  needsReassessment: boolean
  evidenceRole: EvidenceRole
  studyGroupId: string | null
  linkedDuplicates: number
  aiSuggestion: { overall: string } | null
  currentLabel: ScreeningLabel | null
}

export interface RankingStatus {
  state: RankingState
  runId: string | null
  rankedAt: string | null
  relevantLabels: number
  irrelevantLabels: number
  canTrain: boolean
  message: string | null
  modelName: string | null
  asReviewVersion: string | null
  seed: number | null
  trainedOnLabels: number | null
  serviceAvailable: boolean | null
}

export interface ScreeningStop {
  id: string
  stage: ScreeningStage
  stoppedByUserId: string
  stoppedAt: string
  reason: string
  stoppingRule: string | null
  validationNote: string | null
  validationSampleSize: number | null
  validationRelevantFound: number | null
  protocolVersion: number
  screenedCount: number
  relevantCount: number
  unscreenedCount: number
  unresolvedCount: number
  conflictCount: number
  rankingRunId: string | null
}

export interface ScreeningProgress {
  stage: ScreeningStage
  uniqueRecords: number
  screened: number
  unscreened: number
  unresolved: number
  relevantIdentified: number
  needsReassessment: number
  recentWindow: number
  recentRelevant: number
  stateCounts: Record<string, number>
  includedReports: number
  includedStudies: number
  latestStop: ScreeningStop | null
  conflicts: number
  awaitingOtherReviewers: number
  myDecisions: number
  recordsSinceLastRelevant: number | null
  withoutAbstract: number
  requiredReviewers: number
  agreement: { pairs: number; percentAgreement: number; cohensKappa: number | null } | null
}

export interface ScreeningQueue {
  stage: ScreeningStage
  view: QueueView
  items: ScreeningQueueItem[]
  progress: ScreeningProgress
  ranking: RankingStatus
  criteria: ScreeningCriterionBrief[]
  access: ScreeningAccess
  mode: ScreeningMode
  requiredReviewers: number
}

export interface RecordDecisionPayload {
  stage: ScreeningStage
  decision: ScreeningLabelDecision
  reason?: string | null
  note?: string | null
  rankingRunId?: string | null
  rankPosition?: number | null
  exclusionCriterionId?: string | null
  asAdjudication?: boolean
  expectedCurrentLabelId?: string | null
}

export interface StopScreeningPayload {
  stage: ScreeningStage
  reason: string
  stoppingRule?: string | null
  validationNote?: string | null
  validationSampleSize?: number | null
  validationRelevantFound?: number | null
}

export interface ReviewMember {
  userId: string
  email: string
  name: string | null
  role: ReviewMemberRole
  addedAt: string
}

export interface ScreeningSettings {
  mode: ScreeningMode
  requiredReviewers: number
  ownerId: string
  access: ScreeningAccess
  members: ReviewMember[]
}

export interface SharedReview {
  reviewId: string
  researchQuestion: string | null
  ownerEmail: string
  role: ReviewMemberRole
  addedAt: string
}

export type LedgerExportFormat = 'ledger' | 'audit' | 'asreview'
