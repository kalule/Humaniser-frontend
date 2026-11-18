// Research Paper Studio (backend docs/research-paper-studio-audit.md). Types mirror api/v1/research-papers.
import { errorMessage, isRunActive, shortCite, type ReviewRun } from './literatureReview'

export { errorMessage, isRunActive, shortCite }

export type PaperTypeId = 'LiteratureReview' | 'SystematicReview' | 'ScopingReview' | 'Theoretical' | 'Proposal' | 'Empirical'
export type PaperStatus = 'Question' | 'Evidence' | 'Screening' | 'Synthesis' | 'Outline' | 'Writing' | 'Checking' | 'Ready'

export interface PaperType { type: PaperTypeId; label: string; description: string; defaultTargetWords: number; defaultMinSources: number; requiresResultsInput: boolean; usesSystematicReviewModule: boolean }
export interface PaperOptions { paperTypes: PaperType[]; academicLevels: string[]; citationStyles: string[]; minTargetWords: number; maxTargetWords: number; maxQuestions: number; maxObjectives: number }

export interface PaperSummary { id: string; title: string; paperType: PaperTypeId; status: PaperStatus; progressPercent: number; sourceCount: number; questionApproved: boolean; createdAt: string; updatedAt: string }

export interface Paper {
  id: string; title: string; paperType: PaperTypeId; topic: string; problemStatement: string | null; researchQuestions: string[]; objectives: string[]
  scope: string | null; recommendedApproach: string | null; questionApproved: boolean; questionApprovedAt: string | null; academicLevel: string
  discipline: string | null; citationStyle: string; targetWords: number; minSourceTarget: number; status: PaperStatus; progressPercent: number
  studentMode: boolean; evidenceReviewId: string; researchProjectId: string; sourceCount: number; revision: number; createdAt: string; updatedAt: string
}

export interface TopicSuggestion { problemStatement: string | null; researchQuestions: string[]; objectives: string[]; scope: string | null; recommendedApproach: string | null; keyConcepts: string[]; droppedStatements: number; notice: string }

/** The same shape as a Literature Review Studio run, so the shared poll hook and run banner serve both studios. */
export type PaperRun = ReviewRun
export type PaperRunKind = 'VerifySources' | 'RankCandidates' | 'PrioritiseScreening' | 'DraftSections' | 'ReviseSection' | 'Verify'

export interface SearchLogEntry { query: string; database: string; searchedAt: string; resultCount: number; outcome: 'Results' | 'NoResults' | 'Failed'; error: string | null }
export interface SearchLog { entries: SearchLogEntry[]; totalRecords: number; uniqueRecords: number; duplicates: number; databasesSearched: string[]; databasesFailed: string[]; completedAt: string | null }
export interface EvidenceStatus { state: 'NotSearched' | 'Searching' | 'BelowTarget' | 'MeetsTarget'; includedSources: number; candidateSources: number; minSourceTarget: number; isCoverageLimit: boolean; message: string; suggestions: { code: string; message: string }[] }

export interface PaperSource { id: string; title: string; authors: string; year: number; journal: string | null; doi: string | null; evidenceLevel: EvidenceLevel; verification: string | null; verificationNote: string | null; verifiedAt: string | null; retrievedFrom: string | null; retrievedAt: string | null; isRetracted: boolean }
export type EvidenceLevel = 'FullText' | 'AbstractOnly' | 'MetadataOnly'
export interface Candidate { id: string; title: string; authors: string; year: string; doi: string | null; database: string; topicMatchScore: number; semanticScore: number | null; rankScore: number; hasAbstract: boolean; screeningVerdict: string }
export interface CandidateList { items: Candidate[]; total: number; semanticRankingCurrent: boolean }

export interface Criteria { include: string[]; exclude: string[]; yearFrom: number | null; yearTo: number | null; version: number }
export interface ScreeningEntry {
  position: number; priorityReason: string; manualDecision: string; aiVerdict: string
  item: { candidateId: string; title: string; authors: string; year: string; journal: string; doi: string; abstract: string; state: string; reasonCode: string | null; reasonLabel: string | null; explanation: string; studentNote: string | null; relevanceScore: number; evidenceLevel: string; inPool: boolean }
}
export interface ScreeningList { items: ScreeningEntry[]; totalCount: number; page: number; pageSize: number; stateCounts: Record<string, number>; screeningStatus: string; screeningProgressPct: number; canApprove: boolean; orderSource: string; orderNote: string }
export interface DecisionEvent { candidateId: string; title: string; actor: string; decision: string; reasonCode: string | null; reasonLabel: string | null; note: string | null; aiVerdict: string; criteriaVersion: number; at: string }
export interface Flow {
  recordsIdentified: number; duplicatesRemoved: number; recordsScreened: number; excludedByUser: number; excludedByAiOnly: number; excludedByDateRule: number
  userExclusionReasons: Record<string, number>; awaitingDecision: number; includedFromSearch: number; includedFromOtherSources: number; includedTotal: number
  fullText: number; abstractOnly: number; metadataOnly: number; databasesSearched: string[]; databasesFailed: string[]; methodsText: string; caveats: string[]
}
export interface Reason { code: string; label: string }

export interface SynthesisSourceRow { literatureId: string; title: string; authors: string; year: number | null; stance: string; evidenceLevel: EvidenceLevel; design: string | null }
export interface SynthesisThemeRow { themeId: string; title: string; summary: string | null; verificationState: string; sources: SynthesisSourceRow[]; fullTextSources: number; abstractOnlySources: number; stances: Record<string, number>; designs: Record<string, number>; pointCounts: Record<string, number>; unverifiedPoints: number; draftable: boolean; qualityNotes: string[] }
export interface Gap { id: string; themeId: string | null; gapType: string; explanation: string; justification: string | null; classification: string; confidence: string; status: string }
export interface SynthesisTable { themes: SynthesisThemeRow[]; researchGaps: Gap[]; coverageLimits: Gap[]; sourcesInPool: number; sourcesInAnyTheme: number; notes: string[] }

export interface OutlineSection { code: string; title: string; kind: string; purpose: string; themeIds: string[]; targetWords: number; required: boolean }
export interface Outline { sections: OutlineSection[]; totalWords: number; approved: boolean; approvedAt: string | null; notes: string[] }
export interface ResultsInput { methodsDescription: string | null; resultsText: string | null; tablesText: string | null; attestedAt: string | null }
export interface Flag { code: string; message: string }
export interface Section { code: string; title: string; kind: string; sortOrder: number; generationOrder: number; targetWords: number; text: string; wordCount: number; status: 'NotDrafted' | 'Drafted' | 'Edited' | 'Placeholder' | 'Failed'; failureReason: string | null; flags: Flag[]; model: string | null; draftedAt: string | null; editedAt: string | null; versions: number; mayCite: boolean }
export interface SectionVersion { versionNo: number; action: string; note: string | null; model: string | null; wordCount: number; createdAt: string; text: string }
export interface ClaimSource { sourceId: string; title: string; authors: string; year: number | null; evidenceLevel: EvidenceLevel; field: string | null; passage: string | null; verdict: string }
export interface Claim { ordinal: number; text: string; origin: string; support: string; sources: ClaimSource[] }

/** blocking = open critical findings, warnings = open important ones. */
export interface Readiness { score: number; ready: boolean; blocking: number; warnings: number; suggestions: number; sectionsUnverified: number; byCategory: Record<string, number>; reasons: string[] }
export type Severity = 'Critical' | 'Important' | 'Suggestion'
export interface PaperIssue {
  id: string; sectionCode: string | null; sectionTitle: string | null; severity: Severity; code: string; category: string; message: string; claimText: string | null
  sourceIds: string[]; fixKind: string; oneClick: boolean; status: 'Open' | 'Stale' | 'Dismissed' | 'Repaired'; repairAttempts: number; canDismiss: boolean; dismissReason: string | null
  groupKey?: string | null; claimOrdinal?: number | null; citationIds?: string[]; evidence?: string | null; recommendedAction?: string | null; verification?: string | null
  createdAt?: string | null; resolvedAt?: string | null
}
export interface FindingSentence { sectionCode: string | null; sectionTitle: string | null; ordinal: number | null; text: string }
/** One underlying issue: the same rule on the same sentence (across its cited sources), or on the same source. */
export interface FindingGroup {
  key: string; severity: Severity; code: string; category: string; message: string; recommendedAction: string; fixKind: string; oneClick: boolean
  verification: string; count: number; sectionCodes: string[]; sentences: FindingSentence[]; sourceIds: string[]; evidence: string[]; issueIds: string[]
  status: 'Open' | 'Stale' | 'Dismissed'; canDismiss: boolean
}
export interface FindingSummary { raw: number; groups: number; critical: number; important: number; suggestion: number; dismissedCritical: number }
export interface Integrity { readiness: Readiness; issues: PaperIssue[]; lastVerifiedAt: string | null; notice: string; groups?: FindingGroup[]; summary?: FindingSummary }

// ── Stages ──────────────────────────────────────────────────────────────────────────────────────────────

export const STAGES = [
  { id: 'question', label: 'Question', hint: 'Topic, questions, approval' },
  { id: 'evidence', label: 'Sources', hint: 'Search, log, DOI checks' },
  { id: 'screening', label: 'Screening', hint: 'Include, exclude, approve' },
  { id: 'synthesis', label: 'Synthesis', hint: 'Themes before prose' },
  { id: 'writing', label: 'Writing', hint: 'Outline and draft' },
  { id: 'check', label: 'Integrity check', hint: 'Claims, references, numbers' },
  { id: 'export', label: 'Export', hint: 'Word, PDF, RIS, BibTeX' },
] as const
export type StageId = typeof STAGES[number]['id']

/** The furthest stage the paper's status allows opening. */
export function reachedStage(status: PaperStatus): number {
  switch (status) {
    case 'Question': return 0
    case 'Evidence': return 1
    case 'Screening': return 2
    case 'Synthesis': return 3
    case 'Outline': case 'Writing': return 4
    case 'Checking': return 5
    case 'Ready': return 6
  }
}

export function stageIndex(id: string | null): number {
  const i = STAGES.findIndex(s => s.id === id)
  return i < 0 ? 0 : i
}

export const STATUS_LABELS: Record<PaperStatus, string> = {
  Question: 'Shaping the question', Evidence: 'Finding sources', Screening: 'Screening', Synthesis: 'Synthesising',
  Outline: 'Outlining', Writing: 'Writing', Checking: 'Checking', Ready: 'Ready',
}

export const EVIDENCE_LABELS: Record<EvidenceLevel, string> = { FullText: 'Full text', AbstractOnly: 'Abstract only', MetadataOnly: 'Details only' }

export const DOI_LABELS: Record<string, string> = {
  NoDoi: 'No DOI', Verified: 'DOI verified', SingleRegistry: 'DOI in one registry', Mismatch: 'DOI belongs to another work',
  NotFound: 'DOI not found', LookupFailed: 'DOI not checked (registry did not answer)',
}

// ── Citation tokens for editing ─────────────────────────────────────────────────────────────────────────

const TOKEN = /\{\{cite:(n:)?([0-9a-f-]{36})\}\}/g

/**
 * Stored text carries {{cite:<id>}} tokens. For editing they become short numbered markers, [1] or [@1] (narrative),
 * with a legend of what each number is; saving turns them back into the same tokens. Unknown tokens are left as they
 * are, so nothing is lost, and verification still reports them.
 */
export function toEditable(text: string): { text: string; ids: string[] } {
  const ids: string[] = []
  const out = text.replace(TOKEN, (_m, narrative: string | undefined, id: string) => {
    let n = ids.indexOf(id)
    if (n < 0) { ids.push(id); n = ids.length - 1 }
    return narrative ? `[@${n + 1}]` : `[${n + 1}]`
  })
  return { text: out, ids }
}

export function fromEditable(text: string, ids: string[]): string {
  return text.replace(/\[(@?)(\d{1,3})\]/g, (m, narrative: string, num: string) => {
    const id = ids[Number(num) - 1]
    return id ? `{{cite:${narrative ? 'n:' : ''}${id}}}` : m
  })
}

/** The sentences a finding points at, to mark inline: exact match first, then a sentence that contains it. */
export function sentenceMatches(text: string, claim: string | null): boolean {
  if (!claim) return false
  return text.includes(claim.trim())
}
