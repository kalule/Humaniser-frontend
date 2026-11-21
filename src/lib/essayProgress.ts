/**
 * Stage names the essay preparation stream reports, as "name" or "name:detail" (a count). The research step takes about two minutes, so
 * each stage says what is happening and, where the backend knows it, how much: nothing is invented here.
 */
const STEPS = ['planning-question', 'searching-sources', 'assessing-evidence', 'searching-gaps', 'building-outline'] as const

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** The stage name and its count, when the detail after ":" is a whole number. */
function splitStage(stage: string): { name: string; n: number | null } {
  const [name, detail] = stage.split(':')
  return { name, n: detail !== undefined && /^\d+$/.test(detail) ? Number(detail) : null }
}

/** The readable label for a stage, or null when the stage is not one of these (the caller keeps its own label). */
export function essayStageLabel(stage: string | null | undefined): string | null {
  if (!stage) return null
  const { name, n } = splitStage(stage)
  let text: string | null = null
  switch (name) {
    case 'planning-question': text = 'Breaking your question into parts…'; break
    case 'searching-sources': text = n ? `Searching academic databases (${plural(n, 'search', 'searches')})…` : 'Searching academic databases…'; break
    case 'assessing-evidence': text = n ? `Checking ${plural(n, 'source', 'sources')} against each part of your question…` : 'Checking sources against each part of your question…'; break
    case 'searching-gaps': text = n ? `Looking for more evidence on ${plural(n, 'part', 'parts')} still missing…` : 'Looking for more evidence on the parts still missing…'; break
    case 'building-outline': text = 'Planning your sections…'; break
    case 'planning-essay': return 'Planning your essay…'
    case 'finding-landmark-studies': return 'Finding landmark studies…'
    case 'checking-claims': return 'Checking claims and citations…'
    case 'reviewing-answer': return 'Checking your argument…'
    case 'repairing-draft-format': return 'Repairing draft format…'
    case 'repairing-passages': return 'Repairing affected passages…'
    case 'validating-repair': return 'Validating the repaired passages…'
    case 'finalising': return 'Finalising your essay…'
    case 'ready': return 'Your draft is ready'
    case 'checking-thesis': return 'Checking your thesis against the evidence found…'
    default: return null
  }
  const index = STEPS.indexOf(name as (typeof STEPS)[number])
  return index >= 0 ? `Step ${index + 1} of ${STEPS.length} · ${text}` : text
}

/** The three plain-language phases the five technical stages roll up into. */
export const ESSAY_PHASES = [
  'Understanding your question',
  'Finding and checking sources',
  'Writing your essay',
] as const

/**
 * Which phase a backend stage belongs to (0-2), or null when there is no stage. Every stage after the research phase counts as
 * writing, labelled or not: an unlabelled one ("drafting", 2026-11-20) used to fall back to phase 0 and the progress looked restarted.
 */
export function essayPhase(stage: string | null | undefined): number | null {
  if (!stage) return null
  const name = stage.split(':')[0]
  switch (name) {
    case 'starting': case 'planning-question': case 'planning-essay': return 0
    case 'searching-sources': case 'assessing-evidence': case 'searching-gaps': case 'finding-landmark-studies': return 1
    default: return 2
  }
}

/** The phase to show: never earlier than one already reached in this run, so progress cannot appear to go backwards. */
export function nextEssayPhase(previous: number, stage: string | null | undefined): number {
  const phase = essayPhase(stage)
  return phase === null ? previous : Math.max(previous, phase)
}

/**
 * The status line under the current phase: what is happening now, with the count the stage carries when it has one (searches run, sources
 * being checked, parts searched again). Only stage names and counts the backend sends are used. Null for a stage it does not know, so the
 * caller keeps its own label.
 */
export function essayStageDetail(stage: string | null | undefined): string | null {
  if (!stage) return null
  const { name, n } = splitStage(stage)
  switch (name) {
    case 'planning-question': return 'Breaking your question into the parts it asks you to answer…'
    case 'searching-sources': return n ? `Running ${plural(n, 'search', 'searches')} across academic databases…` : 'Searching academic databases…'
    case 'assessing-evidence': return n ? `Checking ${plural(n, 'source', 'sources')} against your question…` : 'Checking sources against your question…'
    case 'searching-gaps': return n === 1 ? 'Searching again for the part that needs more evidence…'
      : n ? `Searching again for ${n} parts that need more evidence…` : 'Searching again for the parts that need more evidence…'
    case 'finding-landmark-studies': return 'Looking for the key studies on this topic…'
    case 'building-outline': return 'Planning your sections from the evidence found…'
    default: {
      const label = essayStageLabel(stage)
      return label ? label.replace(/^Step \d+ of \d+ · /, '') : null
    }
  }
}

// ─── Parts of the question and their evidence ({ parts } and { coverage } stream frames) ───────────────────────────────────────────────

/** Whether a part has evidence so far. Only the assessment's own "supported" is ever shown as supported. */
export type EssayCoverageState = 'supported' | 'partial' | 'unsupported' | 'unknown'

/** One part of the student's question: the plan's id and a short label from the question's own wording. */
export interface EssayPart { id: string; label: string }

export interface EssayPartCoverage { id: string; state: EssayCoverageState }

/** Any state other than the three the backend names, a missing one included, is "unknown", never "supported". */
export function essayCoverageState(raw: unknown): EssayCoverageState {
  return raw === 'supported' || raw === 'partial' || raw === 'unsupported' ? raw : 'unknown'
}

/** What each state says next to the part. Thin evidence is information, not an error, so nothing here is alarming. */
export const ESSAY_COVERAGE_TEXT: Record<EssayCoverageState, string> = {
  supported: 'Evidence found',
  partial: 'Some evidence found',
  unsupported: 'Little evidence found so far',
  unknown: 'Not checked yet',
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

/** The parts in a { parts } frame, with malformed entries dropped; null when the frame does not hold a list. */
export function parseEssayParts(raw: unknown): EssayPart[] | null {
  if (!Array.isArray(raw)) return null
  return raw.filter(isRecord)
    .filter(p => typeof p.id === 'string' && p.id.trim() !== '' && typeof p.label === 'string' && p.label.trim() !== '')
    .slice(0, 16)
    .map(p => ({ id: p.id as string, label: (p.label as string).trim().slice(0, 120) }))
}

/** The rows in a { coverage } frame, with malformed entries dropped and every state passed through essayCoverageState. */
export function parseEssayCoverage(raw: unknown): EssayPartCoverage[] | null {
  if (!Array.isArray(raw)) return null
  return raw.filter(isRecord)
    .filter(c => typeof c.id === 'string' && c.id.trim() !== '')
    .map(c => ({ id: c.id as string, state: essayCoverageState(c.state) }))
}

/** How many sources the progress screen lists before "+N more". */
export const VISIBLE_SOURCES = 6

/** The latest `cap` items, in the order they were found, and how many earlier ones are not shown. */
export function visibleSources<T>(all: readonly T[], cap = VISIBLE_SOURCES): { shown: T[]; more: number } {
  return all.length <= cap ? { shown: [...all], more: 0 } : { shown: all.slice(-cap), more: all.length - cap }
}
