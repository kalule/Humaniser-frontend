import type { DeepResearchMode, DeepResearchSession, EvidenceSource } from '../api/deepResearch'

export const DEEP_RESEARCH_MODES: { value: DeepResearchMode; label: string; hint: string }[] = [
  { value: 'TopicExploration', label: 'Explore a topic', hint: 'What does the literature say about this area?' },
  { value: 'EvidenceForClaim', label: 'Find evidence for a claim', hint: 'Is there published support for a specific statement?' },
  { value: 'RelationshipInvestigation', label: 'Investigate a relationship', hint: 'Does X influence Y? Looks for conflicting findings too.' },
  { value: 'TheoreticalFramework', label: 'Find a theoretical framework', hint: 'Which theories are used to study this?' },
  { value: 'MeasurementInstrument', label: 'Find a measurement instrument', hint: 'Which validated scales or instruments exist?' },
  { value: 'MethodologyEvidence', label: 'Support a methodology choice', hint: 'Evidence for a design, sampling or analysis approach.' },
  { value: 'ContradictoryEvidence', label: 'Look for conflicting evidence', hint: 'Studies that disagree with a position.' },
  { value: 'ResearchGapInvestigation', label: 'Investigate a possible gap', hint: 'Checks whether something looks under-studied.' },
]

/** What a run costs, as shown before starting. Mirrors the server's DeepResearch options (CreditsReserved / MinCreditsCharged). */
export const DEEP_RESEARCH_CREDITS = { reserved: 20, minCharged: 5 } as const

/** One-click starting points on the "New research" screen. Each also picks the kind of research that fits it. */
export const DEEP_RESEARCH_EXAMPLES: { question: string; mode: DeepResearchMode }[] = [
  { question: 'Should universities ban generative AI in student assessment?', mode: 'EvidenceForClaim' },
  { question: 'Does retrieval practice improve long-term retention in higher education?', mode: 'RelationshipInvestigation' },
  { question: 'What factors influence digital learning adoption among university students in South Africa?', mode: 'TopicExploration' },
]

export const MIN_QUESTION_CHARS = 12
export const MAX_QUESTION_CHARS = 1500
export const POLL_INTERVAL_MS = 3000
/** Slightly longer than the server's stale-runner window, so we only offer "resume" once the server would accept it. */
export const STALL_AFTER_MS = 6 * 60 * 1000

export function isQuestionValid(question: string): boolean {
  const n = question.trim().length
  return n >= MIN_QUESTION_CHARS && n <= MAX_QUESTION_CHARS
}

/** Poll until the session is finished; never poll a finished one. */
export function shouldPoll(session: Pick<DeepResearchSession, 'isFinished'> | null): boolean {
  return session !== null && !session.isFinished
}

/** 0-100 progress from real counts: questions answered of questions planned, never a fabricated clock. */
export function progressPercent(session: DeepResearchSession): number {
  if (session.isFinished) return 100
  const { evidenceQuestions, questionsAnswered, phase } = session.progress
  if (phase === 'Queued') return 2
  if (phase === 'Scoping' || phase === 'Planning' || evidenceQuestions === 0) return 8
  if (phase === 'Summarising') return 95
  return Math.min(92, 10 + Math.round((questionsAnswered / evidenceQuestions) * 82))
}

const STRENGTH_LABELS: Record<string, string> = {
  Insufficient: 'Not enough evidence',
  Weak: 'Limited evidence',
  Conflicting: 'Conflicting evidence',
  Moderate: 'Moderate evidence',
  Strong: 'Strong evidence',
}
const SUFFICIENCY_LABELS: Record<string, string> = {
  Insufficient: 'Needs more evidence',
  PartiallySufficient: 'Partly answered',
  Sufficient: 'Well supported',
}
export const sufficiencyLabel = (s: string): string => SUFFICIENCY_LABELS[s] ?? s
export const strengthLabel = (s: string): string => STRENGTH_LABELS[s] ?? s

const GEOGRAPHY_LABELS: Record<string, string> = {
  Target: 'From your study region',
  Regional: 'From a neighbouring region',
  International: 'International',
  Unknown: 'Region unclear',
}
export const geographyLabel = (g: string): string => GEOGRAPHY_LABELS[g] ?? g

export function authorLine(s: Pick<EvidenceSource, 'authors' | 'year'>): string {
  const names = s.authors.length === 0 ? 'Unknown authors'
    : s.authors.length <= 3 ? s.authors.join(', ')
    : `${s.authors.slice(0, 3).join(', ')} et al.`
  return s.year ? `${names} (${s.year})` : names
}

/** Sources the student can still act on: pending or accepted by Humaniser, plus anything they decided. */
export function groupSources(sources: EvidenceSource[]): { accepted: EvidenceSource[]; rejected: EvidenceSource[] } {
  return {
    accepted: sources.filter(s => s.decision === 'Accepted'),
    rejected: sources.filter(s => s.decision === 'Rejected'),
  }
}

/**
 * The readable reason behind a failed API call. The shared axios client rewrites most failures into a plain
 * `{ code, message }` ApiError before they reach a caller, so `err.message` is checked first; raw axios errors
 * (`response.data.error` as a string or `{ message }`) and ordinary Errors are handled too. Falls back to
 * `fallback` only when the server gave no reason at all.
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const e = err as {
    message?: unknown
    response?: { data?: { error?: unknown; message?: unknown } }
  } | null | undefined
  const fromData = e?.response?.data
  const candidates: unknown[] = [
    typeof e?.message === 'string' && !/^Request failed with status code/.test(e.message) ? e.message : undefined,
    typeof fromData?.error === 'string' ? fromData.error : (fromData?.error as { message?: unknown } | undefined)?.message,
    fromData?.message,
  ]
  const found = candidates.find((c): c is string => typeof c === 'string' && c.trim().length > 0)
  return found ?? fallback
}

/** "just now", "5 min ago", "3 h ago", "2 d ago" — from an ISO timestamp the server sent. */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (!Number.isFinite(seconds)) return ''
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  return `${Math.floor(hours / 24)} d ago`
}

/** Which of my sessions is still unfinished for this project — at most one can exist, the server enforces it. */
export function activeSessionFor<T extends { projectId: string; isFinished: boolean }>(sessions: T[], projectId: string): T | undefined {
  return sessions.find(s => s.projectId === projectId && !s.isFinished)
}
