import type { GenerationPhase, ProjectSection } from '../types/research'

// Pure view-model for the proposal generation progress dialog. Everything here is derived from
// data the app already polls (generation-status + the project's sections); nothing is invented —
// in particular there is no per-section "percent written", because the server only reports a
// section as drafting or finished.

export type ProgressRowState = 'queued' | 'drafting' | 'complete' | 'failed'

export interface ProgressStep { id: string; label: string; sectionKey?: string }

export interface ProgressRow {
  code:   string
  label:  string
  state:  ProgressRowState
  words:  number
  target: number
}

export interface ProgressSummary {
  completed:  number
  inProgress: number
  pending:    number
  failed:     number
}

const FINISHED_STATUSES: ReadonlyArray<ProjectSection['status']> = ['Draft', 'Edited', 'Approved']

export function isGenerationActive(phase: GenerationPhase): boolean {
  return phase === 'Starting' || phase === 'Generating'
}

export function buildProgressRows(args: {
  steps:          ProgressStep[]
  sections:       Pick<ProjectSection, 'code' | 'status' | 'wordCount' | 'generationError'>[]
  currentSection: string | null | undefined
  phase:          GenerationPhase
  targetWords:    number
}): ProgressRow[] {
  const { steps, sections, currentSection, phase, targetWords } = args
  const active = isGenerationActive(phase)

  return steps
    .filter(s => s.sectionKey)
    .map(step => {
      const code = step.sectionKey!
      const section = sections.find(s => s.code === code)
      const isCurrent = active && code === currentSection

      let state: ProgressRowState
      if (section && FINISHED_STATUSES.includes(section.status) && section.wordCount > 0) state = 'complete'
      else if (isCurrent || (active && section?.status === 'Generating')) state = 'drafting'
      else if (section?.generationError) state = 'failed'
      else state = 'queued'

      return { code, label: step.label, state, words: state === 'complete' ? section!.wordCount : 0, target: targetWords }
    })
}

export function summarizeRows(rows: ProgressRow[]): ProgressSummary {
  const count = (s: ProgressRowState) => rows.filter(r => r.state === s).length
  return {
    completed:  count('complete'),
    inProgress: count('drafting'),
    // Failed sections are reported on their own, so "pending" means genuinely not reached yet.
    pending:    count('queued'),
    failed:     count('failed'),
  }
}

/** Completed sections / required sections. Partial terminal runs never show 100%. */
export function progressPercent(phase: GenerationPhase, completedCount: number, totalCount: number): number {
  if (totalCount <= 0) return 0
  if (phase === 'Completed' && completedCount >= totalCount) return 100
  return Math.max(0, Math.min(99, Math.round((completedCount / totalCount) * 100)))
}

/** Words-per-millisecond extrapolation. Null until there is enough signal to be honest about. */
export function estimateRemainingMs(args: {
  elapsedMs: number; wordsWritten: number; totalTargetWords: number
}): number | null {
  const { elapsedMs, wordsWritten, totalTargetWords } = args
  if (elapsedMs < 15_000 || wordsWritten < 200 || totalTargetWords <= 0) return null
  const remainingWords = Math.max(0, totalTargetWords - wordsWritten)
  return Math.round((elapsedMs / wordsWritten) * remainingWords)
}

/** m:ss, or h:mm:ss past an hour. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}
