/**
 * Stage names the essay preparation stream reports, as "name" or "name:detail" (a count). The research step takes about two minutes, so
 * each stage says what is happening and, where the backend knows it, how much: nothing is invented here.
 */
const STEPS = ['planning-question', 'searching-sources', 'assessing-evidence', 'searching-gaps', 'building-outline'] as const

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** The readable label for a stage, or null when the stage is not one of these (the caller keeps its own label). */
export function essayStageLabel(stage: string | null | undefined): string | null {
  if (!stage) return null
  const [name, detail] = stage.split(':')
  const n = detail !== undefined && /^\d+$/.test(detail) ? Number(detail) : null
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

/** Which phase a backend stage belongs to (0-2), or null when the stage is not an essay stage. Unknown late stages count as writing. */
export function essayPhase(stage: string | null | undefined): number | null {
  if (!stage) return null
  const name = stage.split(':')[0]
  switch (name) {
    case 'starting': case 'planning-question': case 'planning-essay': return 0
    case 'searching-sources': case 'assessing-evidence': case 'searching-gaps': case 'finding-landmark-studies': return 1
    default: return essayStageLabel(stage) ? 2 : null
  }
}

/** The stage's own wording without the "Step n of 5" prefix, for the line under the current phase. */
export function essayStageDetail(stage: string | null | undefined): string | null {
  const label = essayStageLabel(stage)
  return label ? label.replace(/^Step \d+ of \d+ · /, '') : null
}
