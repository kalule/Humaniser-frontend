import type {
  RankingStatus, ScreeningLabelDecision, ScreeningProgress, ScreeningRecordState, ScreeningStage,
} from '../types/screeningLedger'

export interface DecisionOption {
  decision: ScreeningLabelDecision
  label: string
  hint: string
  key: string
  tone: 'green' | 'red' | 'amber' | 'slate'
}

/** The decisions a reviewer can make at each stage, with their keyboard shortcuts. */
export function decisionOptions(stage: ScreeningStage): DecisionOption[] {
  const common: DecisionOption[] = [
    stage === 'TitleAbstract'
      ? { decision: 'Include', label: 'Include', hint: 'Get the full text (not yet included in the review)', key: 'i', tone: 'green' }
      : { decision: 'Include', label: 'Include study', hint: 'Meets every criterion on the full text', key: 'i', tone: 'green' },
    { decision: 'Exclude', label: 'Exclude', hint: 'Give the reason', key: 'e', tone: 'red' },
    { decision: 'Uncertain', label: 'Uncertain', hint: 'Leave unresolved for clarification', key: 'u', tone: 'amber' },
  ]
  if (stage === 'FullText')
    common.push({ decision: 'FullTextUnavailable', label: 'Full text unavailable', hint: 'Could not be obtained (not an exclusion)', key: 'n', tone: 'slate' })
  return common
}

export function decisionForKey(stage: ScreeningStage, key: string): ScreeningLabelDecision | null {
  return decisionOptions(stage).find(o => o.key === key.toLowerCase())?.decision ?? null
}

/** Client-side mirror of the server rule: an exclusion needs a criterion or a written reason. */
export function exclusionReasonError(decision: ScreeningLabelDecision, criterionId: string | null, reasonText: string): string | null {
  if (decision !== 'Exclude') return null
  if (criterionId) return null
  return reasonText.trim().length > 0 ? null : 'Choose the criterion the record fails, or write a reason.'
}

export const STATE_LABELS: Record<ScreeningRecordState, string> = {
  AwaitingTitleAbstract: 'Awaiting title/abstract screening',
  AwaitingClarification: 'Awaiting clarification',
  ExcludedTitleAbstract: 'Excluded at title/abstract',
  FullTextSought: 'Full text sought',
  FullTextUnavailable: 'Full text unavailable',
  AwaitingFullTextAssessment: 'Awaiting full-text assessment',
  ExcludedFullText: 'Excluded at full text',
  IncludedStudy: 'Included study',
  AwaitingAdjudication: 'Awaiting adjudication',
}

export const DECISION_LABELS: Record<ScreeningLabelDecision, string> = {
  Withdrawn: 'Withdrawn',
  Include: 'Include',
  Exclude: 'Exclude',
  Uncertain: 'Uncertain',
  FullTextUnavailable: 'Full text unavailable',
}

/** How fresh the record order is, in words. Never phrased as a likelihood that a record is eligible. */
export function rankingSummary(r: RankingStatus): { text: string; tone: 'green' | 'amber' | 'slate' | 'red' } {
  switch (r.state) {
    case 'fresh': return { text: `Prioritised order is up to date (trained on ${r.trainedOnLabels ?? r.relevantLabels + r.irrelevantLabels} decisions)`, tone: 'green' }
    case 'stale': return { text: 'Prioritised order is out of date and will refresh', tone: 'amber' }
    case 'invalidated': return { text: 'Prioritised order withdrawn after a changed decision; showing a fixed random order', tone: 'amber' }
    case 'queued': return { text: 'Updating the order…', tone: 'slate' }
    case 'running': return { text: 'Updating the order…', tone: 'slate' }
    case 'failed': return { text: 'Prioritising unavailable; showing a fixed random order', tone: 'red' }
    case 'not_trainable': return { text: 'Fixed random order until there is at least one include and one exclude', tone: 'slate' }
    default: return { text: 'Fixed random order', tone: 'slate' }
  }
}

/**
 * Progress in counts only. There is deliberately no recall percentage: while records remain unscreened, true recall is
 * unknown, and a run of irrelevant records or low model positions does not show that the relevant ones are all found.
 */
export function progressLines(p: ScreeningProgress): string[] {
  const lines = [
    `${p.screened} of ${p.uniqueRecords} records decided; ${p.unscreened} remaining${p.awaitingOtherReviewers ? ` (${p.awaitingOtherReviewers} awaiting another reviewer)` : ''}.`,
    `${p.relevantIdentified} included at this stage so far.`,
  ]
  if (p.unresolved) lines.push(`${p.unresolved} marked uncertain and unresolved.`)
  if (p.conflicts) lines.push(`${p.conflicts} disagreements awaiting adjudication.`)
  if (p.needsReassessment) lines.push(`${p.needsReassessment} decided under earlier criteria and awaiting reassessment.`)
  if (p.recentWindow > 0) lines.push(`Recent yield: ${p.recentRelevant} of the last ${p.recentWindow} decisions were includes.`)
  if (p.recordsSinceLastRelevant !== null && p.recordsSinceLastRelevant > 0)
    lines.push(`${p.recordsSinceLastRelevant} records decided since the last include.`)
  if (p.unscreened > 0) lines.push('Recall is unknown while records remain unscreened.')
  return lines
}

export function percent(part: number, whole: number): number {
  return whole <= 0 ? 0 : Math.round((part / whole) * 100)
}
