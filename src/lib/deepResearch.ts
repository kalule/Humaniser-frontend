import type { DeepResearchMode, DeepResearchSession, EvidenceSource } from '../api/deepResearch'
import { labelText } from './researchLabels'

export interface DeepResearchModeInfo {
  value: DeepResearchMode
  label: string
  hint: string
  /** Shown in the empty textarea once this mode is chosen. */
  placeholder: string
  /** An editable starting sentence; `___` marks what the student fills in. */
  template: string
}

export const DEEP_RESEARCH_MODES: DeepResearchModeInfo[] = [
  { value: 'TopicExploration', label: 'Explore a topic', hint: 'What does the literature say about this area?',
    placeholder: 'e.g. What factors influence digital learning adoption among university students in South Africa?', template: 'What does the literature say about ___ in ___?' },
  { value: 'EvidenceForClaim', label: 'Find evidence for a claim', hint: 'Is there published support for a specific statement?',
    placeholder: 'e.g. Is there evidence that retrieval practice improves exam performance in higher education?', template: 'Is there evidence that ___?' },
  { value: 'RelationshipInvestigation', label: 'Investigate a relationship', hint: 'Does X influence Y? Looks for conflicting findings too.',
    placeholder: 'e.g. Does learning management system usability influence student satisfaction in South African universities?', template: 'Does ___ influence ___ in ___?' },
  { value: 'TheoreticalFramework', label: 'Find a theoretical framework', hint: 'Which theories are used to study this?',
    placeholder: 'e.g. Which theories explain technology adoption among university students?', template: 'Which theories are used to study ___ in ___?' },
  { value: 'MeasurementInstrument', label: 'Find a measurement instrument', hint: 'Which validated scales or instruments exist?',
    placeholder: 'e.g. Which validated scales measure students’ attitudes towards generative AI?', template: 'Which validated scales measure ___?' },
  { value: 'MethodologyEvidence', label: 'Support a methodology choice', hint: 'Evidence for a design, sampling or analysis approach.',
    placeholder: 'e.g. What evidence supports purposive sampling for studying lecturers’ views on AI?', template: 'What evidence supports ___ for studying ___?' },
  { value: 'ContradictoryEvidence', label: 'Look for conflicting evidence', hint: 'Studies that disagree with a position.',
    placeholder: 'e.g. What evidence disagrees that social media use lowers academic performance?', template: 'What evidence disagrees that ___?' },
  { value: 'ResearchGapInvestigation', label: 'Investigate a possible gap', hint: 'Checks whether something looks under-studied.',
    placeholder: 'e.g. Is AI-assisted feedback under-researched in African universities?', template: 'Is ___ under-researched in ___?' },
]

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
  // An unfilled template slot ("Does ___ influence ___?") is long enough but is not a question yet.
  return n >= MIN_QUESTION_CHARS && n <= MAX_QUESTION_CHARS && !/_{2,}/.test(question)
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

// Wording lives in researchLabels, shared with the Research Library's evidence packages.
export const sufficiencyLabel = (s: string): string => labelText('sufficiency', s)
export const strengthLabel = (s: string): string => labelText('strength', s)
export const geographyLabel = (g: string): string => labelText('geography', g)

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

/**
 * Why a report request failed, in words a student can act on. A 404 here almost always means the server is running a
 * version from before the report endpoint existed (it needs restarting), so it says that.
 */
export function reportFailureHint(err: unknown): string {
  const e = err as { response?: { status?: number }; code?: unknown; message?: unknown } | null | undefined
  const status = e?.response?.status
  if (status === 404) return 'The server did not recognise the report request. It is probably running an older version; restarting it brings the report endpoint.'
  if (status === 400) return 'The server says the report is written only once the research has finished or been stopped.'
  if (status !== undefined && status >= 500) return 'The server hit an error while building the report.'
  if (status === undefined && (e?.code === 'ERR_NETWORK' || /network/i.test(String(e?.message ?? '')))) return 'The server could not be reached.'
  return 'The server did not return the report.'
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
