import { describe, expect, it } from 'vitest'
import type { DeepResearchReport } from '../api/deepResearch'
import {
  RUN_STEPS, citationNumbers, citedOnly, claimMarkers, currentStep, dedupeQuotes, elapsedLabel, funnelRows, isUncited, stepState, timeLeftLabel,
} from './deepResearchReport'

const ref = (n: number, id: string) => ({ number: n, sourceId: id, title: `Paper ${n}`, authors: [], year: 2022, journal: null, doi: null })
const report = (over: Partial<DeepResearchReport> = {}): DeepResearchReport => ({
  sessionId: 's', researchQuestion: 'q', evidenceStrength: 'Moderate', bottomLine: [], bottomLineNote: null, sections: [], conflicts: [], gaps: [],
  references: [ref(1, 'a'), ref(2, 'b')], status: 'Completed', ...over,
})

describe('report citations', () => {
  const numbers = citationNumbers(report())

  it('maps each source to its reference number, in order', () => {
    expect(claimMarkers({ text: 'x', sourceIds: ['b', 'a'] }, numbers)).toEqual([{ id: 'b', n: 2 }, { id: 'a', n: 1 }])
  })
  it('treats a claim with no resolvable source as uncited', () => {
    expect(isUncited({ text: 'x', sourceIds: [] }, numbers)).toBe(true)
    expect(isUncited({ text: 'x', sourceIds: ['unknown'] }, numbers)).toBe(true)
    expect(isUncited({ text: 'x', sourceIds: ['a'] }, numbers)).toBe(false)
  })
  it('never lets an uncited or empty sentence through to the page', () => {
    const shown = citedOnly([
      { text: 'Cited.', sourceIds: ['a'] },
      { text: 'Uncited.', sourceIds: [] },
      { text: 'Cites nothing we list.', sourceIds: ['zzz'] },
      { text: '   ', sourceIds: ['a'] },
    ], numbers)
    expect(shown.map(c => c.text)).toEqual(['Cited.'])
  })
})

describe('run stepper', () => {
  it.each([
    ['Queued', 'Waiting to start', 0], ['Planning', 'Planning your research', 0],
    ['Researching', 'Searching: usability', 1], ['Researching', 'Checking for conflicting findings', 1],
    ['Researching', 'Verifying sources', 2], ['Researching', 'Reviewing 4 candidate sources', 2], ['Researching', 'Assessing the evidence', 2],
    ['Summarising', 'Summarising the evidence', 3],
  ])('%s / %s → step %i', (phase, message, step) => expect(currentStep({ phase, message }, false)).toBe(step))

  it('is past the last step once finished, and marks steps done / active / to do', () => {
    expect(currentStep({ phase: 'Complete', message: '' }, true)).toBe(RUN_STEPS.length)
    expect(RUN_STEPS.map((_, i) => stepState(i, 2))).toEqual(['done', 'done', 'active', 'todo', 'todo'])
    expect(RUN_STEPS.map((_, i) => stepState(i, RUN_STEPS.length)).every(s => s === 'done')).toBe(true)
  })
})

describe('time', () => {
  const start = '2026-11-07T10:00:00Z'
  const at = (s: number) => new Date(start).getTime() + s * 1000
  it('shows elapsed time as m:ss', () => {
    expect(elapsedLabel(start, at(125))).toBe('2:05')
    expect(elapsedLabel(start, at(0))).toBe('0:00')
  })
  it('counts down the depth’s usual time, and admits when it is running over', () => {
    expect(timeLeftLabel('standard', start, at(60))).toBe('about 5 min left')
    expect(timeLeftLabel('summary', start, at(60))).toBe('about 2 min left')
    expect(timeLeftLabel('summary', start, at(600))).toBe('taking a little longer than usual')
    expect(timeLeftLabel(null, start, at(60))).toBe('about 9 min left')          // no depth recorded: the longest tier
  })
})

describe('dedupeQuotes', () => {
  it('drops repeats and shorter excerpts of a quote that is also listed', () => {
    const long = 'Usability was positively associated with satisfaction (r = 0.42, p < .01) among first-year students.'
    expect(dedupeQuotes([
      'Usability was positively associated with satisfaction',
      long,
      long,
      '“' + long + '”',
      'A different finding altogether.',
    ])).toEqual([long, 'A different finding altogether.'])
  })
  it('ignores empty and missing quotes and keeps order', () => {
    expect(dedupeQuotes([null, '', 'B one.', undefined, 'A two.'])).toEqual(['B one.', 'A two.'])
  })
})

describe('funnelRows', () => {
  it('draws "disagree" as a nested subset of accepted, never wider than it', () => {
    const rows = funnelRows({ found: 40, used: 10 }, 3)
    expect(rows.map(r => r.n)).toEqual([40, 10, 3])
    expect(rows[2]).toMatchObject({ label: 'of which disagree with you', nested: true })
    expect(rows[0].widthPct).toBeGreaterThan(rows[1].widthPct)
    expect(rows[1].widthPct).toBeGreaterThan(rows[2].widthPct)
  })
  it('clamps a subset that would exceed its parent, and copes with nothing found', () => {
    expect(funnelRows({ found: 5, used: 2 }, 9)[2].n).toBe(2)
    expect(funnelRows({ found: 0, used: 0 }, 0).map(r => r.widthPct)).toEqual([0, 0, 0])
  })
})
