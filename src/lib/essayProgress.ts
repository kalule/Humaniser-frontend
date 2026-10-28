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
    case 'checking-thesis': return 'Checking your thesis against the evidence found…'
    default: return null
  }
  const index = STEPS.indexOf(name as (typeof STEPS)[number])
  return index >= 0 ? `Step ${index + 1} of ${STEPS.length} · ${text}` : text
}
