import { describe, expect, it } from 'vitest'
import { groupLimitations } from './deepResearchView'

const cap = (q: string, n = 16) => `“${q}” reached its share of the source limit (${n}); further results for it were not tracked.`

describe('groupLimitations', () => {
  it('shows the repeated source-limit notes once, in the place of the first', () => {
    const out = groupLimitations([cap('What is A?'), 'Some accepted sources were judged from their abstract only.', cap('What is B?'), cap('What is C?')])
    expect(out).toEqual([
      '3 questions reached their share of the source limit (16 each); further results for them were not tracked.',
      'Some accepted sources were judged from their abstract only.',
    ])
  })
  it('leaves a single note, and unrelated notes, untouched', () => {
    const one = [cap('What is A?'), 'Another note.']
    expect(groupLimitations(one)).toEqual(one)
  })
  it('does not claim one limit when the limits differ', () => {
    expect(groupLimitations([cap('A?', 8), cap('B?', 16)])[0]).toBe('2 questions reached their share of the source limit; further results for them were not tracked.')
  })
})
