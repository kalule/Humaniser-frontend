import { describe, expect, it } from 'vitest'
import type { CleaningLogEntry, ColumnSchema, DatasetSchema } from '../types/analyst'
import {
  RUN_STAGES, cleaningMethodsText, describeRun, deriveRunStage, dtypeLabel, formatElapsed,
  suggestQuestions, terminalLines,
} from './analystRun'

// Real lines from AnalystJobs.cs, in the order a run emits them.
const GEN      = '[*] Generating Python analysis script (attempt 1/3)…'
const COMPILED = '[✓] Script compiled.'
const EXEC     = '[*] Executing script in isolated E2B microVM…'
const FAULT    = '⚠ Runtime exception on attempt 1. Engaging self-healing route…'
const FIXED    = '[✓] Self-corrected script compiled (attempt 2/3).'
const DONE     = '[✓] Execution complete. Results captured.'
const INTERP   = '[*] Generating natural-language interpretation…'

describe('run stage', () => {
  it('follows the backend log, last marker wins', () => {
    expect(deriveRunStage('pending', [])).toBe('preparing')
    expect(deriveRunStage('running', [])).toBe('preparing')
    expect(deriveRunStage('running', [GEN])).toBe('generating')
    expect(deriveRunStage('running', [GEN, COMPILED])).toBe('generating')
    expect(deriveRunStage('running', [GEN, COMPILED, EXEC])).toBe('running')
    expect(deriveRunStage('running', [GEN, COMPILED, EXEC, FAULT])).toBe('generating')
    expect(deriveRunStage('running', [GEN, COMPILED, EXEC, DONE, INTERP])).toBe('explaining')
  })

  it('never says "sandbox" while the script is still being generated', () => {
    const view = describeRun('running', [GEN], 'student')
    expect(view.stage).toBe('generating')
    expect(view.statusText).toBe('Generating analysis…')
  })

  it('status text always matches the stage, in both modes, at every point of a run', () => {
    const full = [GEN, COMPILED, EXEC, FAULT, FIXED, EXEC, DONE, INTERP]
    for (const mode of ['student', 'developer'] as const) {
      for (let n = 0; n <= full.length; n++) {
        const log = full.slice(0, n)
        const view = describeRun('running', log, mode)
        const label = RUN_STAGES[view.stageIndex].label
        expect(RUN_STAGES[view.stageIndex].id).toBe(view.stage)
        // Either the stage's own label, or the Student retry wording during generate/run.
        const refining = view.statusText === 'Refining the analysis…'
        expect(refining || view.statusText.startsWith(label)).toBe(true)
        if (refining) {
          expect(mode).toBe('student')
          expect(['generating', 'running']).toContain(view.stage)
        }
      }
    }
  })
})

describe('retries by mode', () => {
  const retryLog = [GEN, COMPILED, EXEC, FAULT, FIXED]

  it('Student mode hides the attempt counter and says "Refining the analysis…"', () => {
    const view = describeRun('running', retryLog, 'student')
    expect(view.statusText).toBe('Refining the analysis…')
    expect(view.statusText).not.toMatch(/attempt/i)
    expect(terminalLines(retryLog, 'student').join('\n')).not.toMatch(/attempt \d/i)
  })

  it('Student mode shows no attempt counter on a first, clean attempt either', () => {
    expect(describeRun('running', [GEN], 'student').statusText).not.toMatch(/attempt/i)
    expect(terminalLines([GEN], 'student')).toEqual(['[*] Generating Python analysis script…'])
  })

  it('Developer mode keeps the attempt counter and the raw lines', () => {
    expect(describeRun('running', retryLog, 'developer').statusText).toBe('Generating analysis (attempt 2/3)…')
    expect(terminalLines(retryLog, 'developer')).toEqual(retryLog)
  })

  it('does not call a finished retry "refining" once the explanation is being written', () => {
    const view = describeRun('running', [...retryLog, EXEC, DONE, INTERP], 'student')
    expect(view.statusText).toBe('Writing explanation…')
  })
})

describe('elapsed time and column types', () => {
  it('formats elapsed time', () => {
    expect(formatElapsed(0)).toBe('0s')
    expect(formatElapsed(42_900)).toBe('42s')
    expect(formatElapsed(125_000)).toBe('2m 05s')
  })

  it('shows plain types to students and raw dtypes to developers', () => {
    expect(dtypeLabel('object', 'student')).toBe('Text / category')
    expect(dtypeLabel('str', 'student')).toBe('Text / category')
    expect(dtypeLabel('int64', 'student')).toBe('Number')
    expect(dtypeLabel('Int64', 'student')).toBe('Number')
    expect(dtypeLabel('float64', 'student')).toBe('Number')
    expect(dtypeLabel('datetime64[us]', 'student')).toBe('Date')
    expect(dtypeLabel('bool', 'student')).toBe('True/False')
    expect(dtypeLabel('object', 'developer')).toBe('object')
  })
})

describe('suggestions follow the research objective', () => {
  const c = (name: string, dtype: string): ColumnSchema => ({ name, dtype, nullable: false, sampleValues: [] })
  const schema = {
    columns: [c('respondent_id', 'object'), c('age', 'int64'), c('gender', 'object'), c('province', 'object'),
              c('PU1', 'float64'), c('PU2', 'float64'), c('completion_date', 'datetime64')],
  } as DatasetSchema

  it('uses real column names and skips id and date columns as variables', () => {
    const all = (['descriptive', 'hypothesis_testing', 'regression', null] as const).flatMap((o) => suggestQuestions(schema, o))
    expect(all.some((q) => q.includes('gender'))).toBe(true)
    expect(all.some((q) => q.includes('age'))).toBe(true)
    expect(all.some((q) => /grouped by respondent_id|by completion_date groups/.test(q))).toBe(false)
  })

  it('leads with summaries for descriptive, tests for hypothesis testing, regression for predictive', () => {
    expect(suggestQuestions(schema, 'descriptive')[0]).toBe('Summarise all columns with descriptive statistics')
    expect(suggestQuestions(schema, 'hypothesis_testing')[0]).toMatch(/t-test or ANOVA/)
    expect(suggestQuestions(schema, 'hypothesis_testing')[1]).toMatch(/chi-square/)
    expect(suggestQuestions(schema, 'regression')[0]).toMatch(/linear regression/)
  })

  it('returns at most six, without duplicates, and nothing without a dataset', () => {
    const q = suggestQuestions(schema, 'hypothesis_testing')
    expect(q.length).toBeLessThanOrEqual(6)
    expect(new Set(q).size).toBe(q.length)
    expect(suggestQuestions(null, 'descriptive')).toEqual([])
  })
})

describe('methods text', () => {
  const entry = (step: number, summary: string, cellsChanged: number, rowsRemoved: number): CleaningLogEntry =>
    ({ step, issueId: '', action: 'fix', summary, cellsChanged, rowsRemoved, appliedAt: '2026-11-11T09:00:00Z' })

  it('is built only from the logged steps and totals', () => {
    const text = cleaningMethodsText('survey_messy.csv', [
      entry(1, 'Removed 6 exact duplicate rows (kept the first occurrence of each).', 0, 6),
      entry(2, "Set 5 out-of-range values in 'INT5' to missing.", 5, 0),
    ], 300)
    expect(text).toContain('2 cleaning steps were applied')
    expect(text).toContain('removed 6 exact duplicate rows')
    expect(text).toContain("set 5 out-of-range values in 'INT5' to missing")
    expect(text).toContain('6 rows were removed and 5 values were changed, leaving 300 rows')
    expect(text).toContain('original file was retained unchanged')
  })

  it('says so plainly when nothing was cleaned', () => {
    expect(cleaningMethodsText('a.csv', [], 10)).toBe('The dataset (a.csv) was analysed as uploaded; no cleaning steps were applied.')
  })
})
