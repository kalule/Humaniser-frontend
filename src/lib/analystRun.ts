import type { AnalyticalMethod, CleaningLogEntry, DatasetSchema, WorkbenchMode } from '../types/analyst'

/**
 * One source of truth for what an analysis run is doing. The status line, the progress card and
 * the terminal header are all rendered from the single RunView returned by `describeRun`, so they
 * cannot disagree. Pure: no React, no store.
 */

export type RunStage = 'preparing' | 'generating' | 'running' | 'explaining'

export const RUN_STAGES: { id: RunStage; label: string; description: string }[] = [
  { id: 'preparing',  label: 'Preparing',            description: 'Sending your question and setting up a private workspace for your data.' },
  { id: 'generating', label: 'Generating analysis',  description: 'Working out the right method and writing the analysis for your question.' },
  { id: 'running',    label: 'Running',              description: 'Running the analysis on your data in an isolated sandbox.' },
  { id: 'explaining', label: 'Writing explanation',  description: 'Collecting the tables and charts and writing up what they show.' },
]

// Backend log markers (AnalystJobs.cs). The LAST marker seen decides the stage.
const MARKERS: [RegExp, RunStage][] = [
  [/Generating Python analysis script|Self-corrected script|self-healing|Retrying with output hint|Code validation failed/i, 'generating'],
  [/Executing script in isolated/i, 'running'],
  [/Execution complete|Downloading \d+ chart|downloaded\.|Citation context|natural-language interpretation|conceptual guide|skipping interpretation/i, 'explaining'],
]

const RETRY_MARKER  = /self-healing|Retrying with output hint|Self-corrected|Code validation failed/i
const ATTEMPT       = /attempt (\d+)\s*\/\s*(\d+)/i
const ATTEMPT_NOISE = /\s*\(attempt \d+\s*\/\s*\d+\)|\s+on attempt \d+|^⚠ Attempt \d+ /i

export function deriveRunStage(status: 'pending' | 'running', logStream: string[] = []): RunStage {
  if (status === 'pending') return 'preparing'
  let stage: RunStage = 'preparing'
  for (const line of logStream)
    for (const [pattern, s] of MARKERS)
      if (pattern.test(line)) { stage = s; break }
  return stage
}

export interface RunView {
  stage:       RunStage
  stageIndex:  number
  /** The one status sentence shown in the status line and the terminal header. */
  statusText:  string
  description: string
  retrying:    boolean
}

export function describeRun(
  status: 'pending' | 'running', logStream: string[] = [], mode: WorkbenchMode = 'student', retryCount = 0,
): RunView {
  const stage = deriveRunStage(status, logStream)
  const def   = RUN_STAGES.find((s) => s.id === stage)!
  const retrying = retryCount > 0 || logStream.some((l) => RETRY_MARKER.test(l))
  const midRetry = retrying && (stage === 'generating' || stage === 'running')

  let statusText = `${def.label}…`
  let description = def.description
  if (midRetry) {
    if (mode === 'developer') {
      // Developers keep the attempt counter the backend reports.
      const last = [...logStream].reverse().map((l) => ATTEMPT.exec(l)).find(Boolean)
      statusText = last ? `${def.label} (attempt ${last[1]}/${last[2]})…` : `${def.label} (retrying)…`
    } else {
      statusText = 'Refining the analysis…'
      description = 'The first attempt needed a correction, so the analysis is being adjusted and run again.'
    }
  }
  return { stage, stageIndex: RUN_STAGES.findIndex((s) => s.id === stage), statusText, description, retrying }
}

/** Terminal lines for a mode: Student mode never sees attempt counters. */
export function terminalLines(logStream: string[], mode: WorkbenchMode): string[] {
  if (mode === 'developer') return logStream
  return logStream.map((l) => (/^⚠ Attempt \d+ /i.test(l) ? l.replace(/^⚠ Attempt \d+ /i, '⚠ The last run ') : l.replace(ATTEMPT_NOISE, '')))
}

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`
}

// ── Column types in plain language ───────────────────────────────────────────

export function friendlyDtype(dtype: string): string {
  const d = dtype.toLowerCase()
  if (d.startsWith('datetime') || d === 'date') return 'Date'
  if (d.startsWith('bool')) return 'True/False'
  if (d.startsWith('int') || d.startsWith('float') || d.startsWith('uint') || d === 'double') return 'Number'
  return 'Text / category'
}

export function dtypeLabel(dtype: string, mode: WorkbenchMode): string {
  return mode === 'developer' ? dtype : friendlyDtype(dtype)
}

// ── Suggestions that follow the chosen research objective ────────────────────

const isNumber = (dtype: string) => friendlyDtype(dtype) === 'Number'
const ID_OR_DATE = /(^|[_\s])(id|date|time|timestamp)$/i

/** Up to six prompts, phrased with real column names, ordered for the chosen objective. */
export function suggestQuestions(schema: DatasetSchema | null, objective: AnalyticalMethod | null): string[] {
  if (!schema) return []
  const usable  = schema.columns.filter((c) => (c.nullPercent ?? 0) < 100 && !ID_OR_DATE.test(c.name))
  const numeric = usable.filter((c) => isNumber(c.dtype)).map((c) => c.name)
  const groups  = usable.filter((c) => friendlyDtype(c.dtype) === 'Text / category').map((c) => c.name)
  const timeCol = schema.columns.find((c) => c.name.toLowerCase().includes('year') || friendlyDtype(c.dtype) === 'Date')
  const [n1, n2] = numeric
  const [g1, g2] = groups

  const descriptive = [
    'Summarise all columns with descriptive statistics',
    n1 ? `Show the distribution of ${n1} as a histogram` : null,
    g1 ? `How many respondents are in each ${g1} group? Show a bar chart.` : null,
    'Which columns have missing values and what percentage are missing?',
    n1 && g1 ? `What is the average ${n1} grouped by ${g1}?` : null,
    n1 && n2 ? 'Plot a correlation heatmap of all numeric columns' : null,
  ]
  const hypothesis = [
    n1 && g1 ? `Is ${n1} different between ${g1} groups? Choose and run the right test (t-test or ANOVA).` : null,
    g1 && g2 ? `Is ${g1} associated with ${g2}? Run a chi-square test.` : null,
    n1 && n2 ? `Is ${n1} correlated with ${n2}? Report r and the p-value.` : null,
    n1 && g1 ? `Check the assumptions (normality, equal variances) for comparing ${n1} across ${g1}.` : null,
    'Summarise all columns with descriptive statistics',
    n1 && g1 ? `What is the average ${n1} grouped by ${g1}?` : null,
  ]
  const predictive = [
    n1 && n2 ? `Run a linear regression predicting ${n2} from ${n1}` : null,
    numeric.length >= 3 ? `Run a multiple regression predicting ${n1} from the other numeric columns` : null,
    n1 && n2 ? 'Plot a correlation heatmap of all numeric columns' : null,
    n1 ? `Which columns are the strongest predictors of ${n1}?` : null,
    n1 && g1 ? `Does ${g1} improve a model predicting ${n1}?` : null,
    'Summarise all columns with descriptive statistics',
  ]
  const general = [
    descriptive[0], descriptive[5], descriptive[4], predictive[0],
    timeCol && n1 ? `Plot ${numeric.find((n) => n !== timeCol.name) ?? n1} over time by ${timeCol.name}` : null,
    descriptive[3], descriptive[1],
  ]

  const ordered =
    objective === 'descriptive' ? descriptive
    : objective === 'hypothesis_testing' ? hypothesis
    : objective === 'regression' ? predictive
    : general
  return [...new Set(ordered.filter((q): q is string => !!q))].slice(0, 6)
}

// ── Cleaning log as a methods paragraph ──────────────────────────────────────

/** A plain-language paragraph for a methods section, built only from the logged steps. */
export function cleaningMethodsText(fileName: string, log: CleaningLogEntry[], finalRows: number): string {
  if (log.length === 0) return `The dataset (${fileName}) was analysed as uploaded; no cleaning steps were applied.`
  const removed = log.reduce((n, e) => n + e.rowsRemoved, 0)
  const changed = log.reduce((n, e) => n + e.cellsChanged, 0)
  const steps = log.map((e) => e.summary.replace(/\.$/, '')).map((t) => t.charAt(0).toLowerCase() + t.slice(1))
  const list = steps.length === 1 ? steps[0] : `${steps.slice(0, -1).join('; ')}; and ${steps[steps.length - 1]}`
  return (
    `Before analysis, the dataset (${fileName}) was screened for duplicate records, missing and placeholder values, ` +
    `out-of-range values, inconsistent category labels and inconsistent date formats. ` +
    `${log.length} cleaning step${log.length !== 1 ? 's were' : ' was'} applied in the following order: ${list}. ` +
    `In total, ${removed} row${removed !== 1 ? 's were' : ' was'} removed and ${changed} value${changed !== 1 ? 's were' : ' was'} changed, ` +
    `leaving ${finalRows} rows for analysis. The original file was retained unchanged.`
  )
}
