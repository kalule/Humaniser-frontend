import { describe, expect, it } from 'vitest'
import type { ColumnSchema, QualityIssue, QualitySeverity } from '../types/analyst'
import {
  firstUnmet, gateChecklist, issueRelevance, penaltyPoints, scoreFor, scoreGains,
  suggestObjective, unresolvedHighIssues,
} from './analystQuality'

const issue = (id: string, severity: QualitySeverity, column = 'age', count = 1): QualityIssue => ({
  id, type: 'out_of_range', column, severity, count, totalRows: 306,
  affectedRows: [], affectedRowTotal: count, examples: [], description: '', suggestedFix: '',
})

const col = (name: string, sampleValues: string[], dtype = 'object'): ColumnSchema =>
  ({ name, dtype, nullable: false, sampleValues } as ColumnSchema)

describe('Continue gate', () => {
  const issues = [issue('a', 'high'), issue('b', 'high'), issue('c', 'medium'), issue('d', 'low')]

  it('counts only undecided high-severity issues', () => {
    expect(unresolvedHighIssues(issues, {}).map((i) => i.id)).toEqual(['a', 'b'])
    expect(unresolvedHighIssues(issues, { a: 'ignore' }).map((i) => i.id)).toEqual(['b'])
    expect(unresolvedHighIssues(issues, { a: 'ignore', b: 'ignore', c: 'ignore' })).toEqual([])
  })

  it('is blocked on both items at the start and names the count', () => {
    const items = gateChecklist({ hasReport: true, objective: null, customIntent: '', unresolvedHigh: 12 })
    expect(items).toEqual([
      { id: 'objective', label: 'Choose a research objective', done: false },
      { id: 'issues', label: 'Resolve 12 high-severity issues', done: false },
    ])
    expect(firstUnmet(items)?.id).toBe('objective')
  })

  it('points at the issues once an objective is chosen', () => {
    const items = gateChecklist({ hasReport: true, objective: 'descriptive', customIntent: '', unresolvedHigh: 1 })
    expect(items[0].done).toBe(true)
    expect(items[1].label).toBe('Resolve 1 high-severity issue')
    expect(firstUnmet(items)?.id).toBe('issues')
  })

  it('opens only when an objective is chosen and no high-severity issue is undecided', () => {
    const items = gateChecklist({ hasReport: true, objective: 'regression', customIntent: '', unresolvedHigh: 0 })
    expect(firstUnmet(items)).toBeNull()
  })

  it('stays blocked when the quality check has not completed, even with no known issues', () => {
    const items = gateChecklist({ hasReport: false, objective: 'descriptive', customIntent: '', unresolvedHigh: 0 })
    expect(items[1]).toEqual({ id: 'issues', label: 'Run the data quality check', done: false })
  })

  it('needs a description for a custom objective', () => {
    const blank = gateChecklist({ hasReport: true, objective: 'custom', customIntent: '   ', unresolvedHigh: 0 })
    expect(blank[0]).toEqual({ id: 'objective', label: 'Describe your research goal', done: false })
    const filled = gateChecklist({ hasReport: true, objective: 'custom', customIntent: 'compare groups', unresolvedHigh: 0 })
    expect(filled[0].done).toBe(true)
  })
})

describe('health score', () => {
  it('matches the backend formula and floors at 0', () => {
    expect(scoreFor([issue('a', 'high'), issue('b', 'medium'), issue('c', 'low')])).toBe(82)
    const messy = [
      ...Array.from({ length: 12 }, (_, i) => issue(`h${i}`, 'high')),
      ...Array.from({ length: 3 }, (_, i) => issue(`m${i}`, 'medium')),
      ...Array.from({ length: 12 }, (_, i) => issue(`l${i}`, 'low')),
    ]
    expect(penaltyPoints(messy)).toBe(171)
    expect(scoreFor(messy)).toBe(0)
  })

  it('reports the real gain, which is 0 while the score is floored', () => {
    const messy = Array.from({ length: 12 }, (_, i) => issue(`h${i}`, 'high'))
    expect(scoreGains(messy)[0]).toMatchObject({ points: 12, delta: 0 })
    const light = [issue('a', 'high'), issue('b', 'low')]
    expect(scoreGains(light).map((g) => [g.issue.id, g.delta])).toEqual([['a', 12], ['b', 1]])
  })
})

describe('issue relevance', () => {
  it('says nothing until variables are chosen', () => {
    expect(issueRelevance(issue('a', 'high', 'age'), [])).toBeNull()
  })
  it('tags by chosen variables, and duplicate rows always affect the analysis', () => {
    expect(issueRelevance(issue('a', 'high', 'age'), ['age', 'PU1'])).toBe('affects')
    expect(issueRelevance(issue('a', 'high', 'province'), ['age', 'PU1'])).toBe('minor')
    expect(issueRelevance(issue('a', 'high', '__row__'), ['age'])).toBe('affects')
  })
})

describe('suggested objective', () => {
  it('suggests comparing groups for a survey with group and numeric columns', () => {
    const s = suggestObjective([
      col('respondent_id', ['R0001', 'R0002', 'R0003']),
      col('gender', ['Male', 'Female', 'Male']),
      col('PU1', ['5', '3', '3']),
      col('completion_date', ['2026-05-05', '2026-04-12', '2026-04-04']),
    ])
    expect(s?.id).toBe('hypothesis_testing')
    expect(s?.reason).toContain('gender')
    expect(s?.reason).toContain('PU1')
  })
  it('suggests modelling for all-numeric data and a summary for all-text data', () => {
    expect(suggestObjective([col('a', ['1', '2']), col('b', ['3', '4']), col('c', ['5', '6'])])?.id).toBe('regression')
    expect(suggestObjective([col('name', ['x', 'y']), col('city', ['p', 'q'])])?.id).toBe('descriptive')
    expect(suggestObjective([])).toBeNull()
  })
})
