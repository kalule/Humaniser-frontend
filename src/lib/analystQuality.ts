import type { AnalyticalMethod, ColumnSchema, QualityIssue, QualitySeverity } from '../types/analyst'

/**
 * Pure logic for the Data Analyst "Prepare your dataset" step: the Continue gate, the health
 * score explanation, issue relevance and the suggested objective. Kept free of React and the
 * store so the gate can be unit-tested directly.
 */

/** Must match the backend (DataQualityAnalyzer.Score): 100 minus these points per issue, floored at 0. */
export const SEVERITY_PENALTY: Record<QualitySeverity, number> = { high: 12, medium: 5, low: 1 }

export type IssueDecisions = Record<string, 'ignore'>

/** High-severity issues the user has not yet fixed, excluded or chosen to keep. */
export function unresolvedHighIssues(issues: QualityIssue[], decisions: IssueDecisions): QualityIssue[] {
  return issues.filter((i) => i.severity === 'high' && !decisions[i.id])
}

export interface GateItem {
  id: 'objective' | 'issues'
  label: string
  done: boolean
}

export interface GateInput {
  hasReport: boolean
  objective: AnalyticalMethod | null
  customIntent: string
  unresolvedHigh: number
}

/** The two things Continue waits for, in the order the user should do them. */
export function gateChecklist({ hasReport, objective, customIntent, unresolvedHigh }: GateInput): GateItem[] {
  const objectiveDone = objective !== null && (objective !== 'custom' || customIntent.trim().length > 0)
  const objectiveLabel = objective === 'custom' && !objectiveDone
    ? 'Describe your research goal'
    : 'Choose a research objective'

  const issuesLabel = !hasReport
    ? 'Run the data quality check'
    : unresolvedHigh > 0
      ? `Resolve ${unresolvedHigh} high-severity issue${unresolvedHigh !== 1 ? 's' : ''}`
      : 'High-severity issues resolved'

  return [
    { id: 'objective', label: objectiveLabel, done: objectiveDone },
    { id: 'issues', label: issuesLabel, done: hasReport && unresolvedHigh === 0 },
  ]
}

export function firstUnmet(items: GateItem[]): GateItem | null {
  return items.find((i) => !i.done) ?? null
}

/** Total penalty points before the floor at 0. Can exceed 100 on very messy data. */
export function penaltyPoints(issues: QualityIssue[]): number {
  return issues.reduce((sum, i) => sum + SEVERITY_PENALTY[i.severity], 0)
}

export function scoreFor(issues: QualityIssue[]): number {
  return Math.max(0, 100 - penaltyPoints(issues))
}

export interface ScoreGain {
  issue: QualityIssue
  /** Penalty points this issue costs. */
  points: number
  /** Real change in the displayed score if only this issue were gone (can be 0 while the score is floored). */
  delta: number
}

/** What resolving each issue would do to the score, biggest first. Computed, never estimated. */
export function scoreGains(issues: QualityIssue[]): ScoreGain[] {
  const current = scoreFor(issues)
  return issues
    .map((issue) => ({
      issue,
      points: SEVERITY_PENALTY[issue.severity],
      delta: scoreFor(issues.filter((i) => i.id !== issue.id)) - current,
    }))
    .sort((a, b) => b.points - a.points || b.issue.count - a.issue.count)
}

/**
 * Whether an issue touches the variables the user picked for their analysis.
 * Returns null when no variables have been picked yet, because then we cannot honestly say.
 */
export function issueRelevance(issue: QualityIssue, focusColumns: string[]): 'affects' | 'minor' | null {
  if (focusColumns.length === 0) return null
  if (issue.column === '__row__') return 'affects'          // duplicate rows touch every variable
  return focusColumns.includes(issue.column) ? 'affects' : 'minor'
}

const ID_OR_DATE_NAME = /(^|[_\s])(id|date|time|timestamp)$/i
const isNumericSample = (v: string) => v.trim() !== '' && !Number.isNaN(Number(v))

/** A column whose sample values are mostly numbers (dtype can be "object" before cleaning). */
function looksNumeric(c: ColumnSchema): boolean {
  if (/^(int|float|double)/i.test(c.dtype)) return true
  const samples = c.sampleValues ?? []
  return samples.length > 0 && samples.filter(isNumericSample).length >= Math.ceil(samples.length * 0.67)
}

export interface ObjectiveSuggestion {
  id: AnalyticalMethod
  reason: string
}

/**
 * One explainable rule: group columns plus numeric columns suggest comparing groups;
 * only numeric columns suggest modelling; anything else suggests a descriptive summary.
 */
export function suggestObjective(columns: ColumnSchema[]): ObjectiveSuggestion | null {
  if (columns.length === 0) return null
  const usable  = columns.filter((c) => !ID_OR_DATE_NAME.test(c.name))
  const numeric = usable.filter(looksNumeric)
  const groups  = usable.filter((c) => !looksNumeric(c))

  if (groups.length > 0 && numeric.length > 0) {
    return {
      id: 'hypothesis_testing',
      reason: `You have group columns (such as ${groups[0].name}) and numeric columns (such as ${numeric[0].name}) to compare.`,
    }
  }
  if (numeric.length >= 3) {
    return { id: 'regression', reason: `${numeric.length} numeric columns can be modelled against each other.` }
  }
  return { id: 'descriptive', reason: 'Mostly text or category columns, which suit counts and summaries.' }
}
