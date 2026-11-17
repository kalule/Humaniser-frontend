import { describe, expect, it } from 'vitest'
import { buildRuns, percent, trimSelection, METHOD_LABELS, METHOD_NOTES, AUDIT_LABELS } from './qualitative'

describe('buildRuns', () => {
  const text = 'P01: We are on our own here.\n\nINT: Why?'
  const segments = [{ id: 's1', start: 5, end: 28 }, { id: 's2', start: 35, end: 39 }]

  it('tiles the whole text with no gap or overlap', () => {
    const runs = buildRuns(text.length, segments, [])
    expect(runs[0].start).toBe(0)
    expect(runs[runs.length - 1].end).toBe(text.length)
    for (let i = 1; i < runs.length; i++) expect(runs[i].start).toBe(runs[i - 1].end)
    expect(runs.map(r => text.slice(r.start, r.end)).join('')).toBe(text)
  })

  it('marks speaker labels and blank lines as outside every segment', () => {
    const runs = buildRuns(text.length, segments, [])
    expect(runs.filter(r => r.segmentId === null).map(r => text.slice(r.start, r.end))).toEqual(['P01: ', '\n\nINT: '])
  })

  it('counts overlapping codes and keeps other marks separate', () => {
    const runs = buildRuns(text.length, segments, [
      { start: 5, end: 15, kind: 'code' }, { start: 10, end: 20, kind: 'code' }, { start: 12, end: 14, kind: 'selected' }, { start: 20, end: 28, kind: 'language' },
    ])
    const at = (offset: number) => runs.find(r => r.start <= offset && offset < r.end)!
    expect(at(6).codes).toBe(1)
    expect(at(11).codes).toBe(2)
    expect(at(12).selected).toBe(true)
    expect(at(16).codes).toBe(1)
    expect(at(22)).toMatchObject({ codes: 0, language: true, segmentId: 's1' })
  })

  it('ignores marks outside the text', () => {
    const runs = buildRuns(10, [], [{ start: -5, end: 50, kind: 'code' }])
    expect(runs).toEqual([{ start: 0, end: 10, segmentId: null, codes: 1, language: false, selected: false, evidence: false }])
  })
})

describe('percent', () => {
  it('rounds, and shows a dash when there is nothing to divide by', () => {
    expect(percent(0.4567)).toBe('46%')
    expect(percent(0)).toBe('0%')
    expect(percent(null)).toBe('—')
    expect(percent(undefined)).toBe('—')
  })
})

describe('wording', () => {
  it('never says themes emerged or that a result is valid, saturated or trustworthy', () => {
    const all = [...Object.values(METHOD_LABELS), ...Object.values(METHOD_NOTES), ...Object.values(AUDIT_LABELS)].join(' ').toLowerCase()
    for (const word of ['emerge', 'valid', 'saturat', 'trustworth']) expect(all).not.toContain(word)
  })

  it('says agreement is not used for the interpretive methods', () => {
    for (const m of ['ReflexiveTA', 'GroundedTheory', 'IPA'] as const) expect(METHOD_NOTES[m]).toContain('not used')
    for (const m of ['CodebookTA', 'ContentAnalysis', 'Framework'] as const) expect(METHOD_NOTES[m]).toContain('can be reported')
  })
})

describe('trimSelection', () => {
  const text = 'It is the money.  A child is not a number.\n'
  it('drops the space a double-click adds after a word', () => {
    expect(trimSelection(text, { start: 3, end: 6 })).toEqual({ start: 3, end: 5 })
  })
  it('drops spaces and line breaks at both ends and keeps inner ones', () => {
    expect(trimSelection(text, { start: 16, end: text.length })).toEqual({ start: 18, end: 42 })
  })
  it('leaves a selection with no outer whitespace as it is', () => {
    expect(trimSelection(text, { start: 6, end: 16 })).toEqual({ start: 6, end: 16 })
  })
  it('returns null when only whitespace is selected', () => {
    expect(trimSelection(text, { start: 16, end: 18 })).toBeNull()
  })
})
