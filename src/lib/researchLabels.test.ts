import { describe, expect, it } from 'vitest'
import { decamel, formatLibraryDate, formatLibraryDateTime, humaniseReason, label, nextStep } from './researchLabels'

describe('label', () => {
  it('maps the values the user saw raw', () => {
    expect(label('sessionStatus', 'NeedsReview')).toEqual({ text: 'Off-topic results', tone: 'danger' })
    expect(label('sessionStatus', 'BudgetExhausted').text).toBe('Stopped at its limit')
    expect(label('completionReason', 'SearchesExhausted').text).toMatch(/^Every search was tried/)
    expect(label('sufficiency', 'PartiallySufficient').text).toBe('Partly answered')
    expect(label('sufficiency', 'Insufficient').text).toBe('Needs more evidence')
    expect(label('questionStatus', 'Exhausted').text).toBe('No more searches to try')
    expect(label('questionStatus', 'Resolved').text).toBe('Answered')
  })

  it('never shows an unknown enum raw', () => {
    expect(label('sessionStatus', 'SomethingNewFromServer').text).toBe('Something new from server')
    expect(label('verification', null).text).toBe('Unknown')
    expect(decamel('EmptyUnconfirmed')).toBe('Empty unconfirmed')
    expect(decamel('LLMCalls')).toBe('Llm calls')
  })
})

describe('humaniseReason', () => {
  it('rewrites the engineer wording, old packages included', () => {
    expect(humaniseReason('Needs 1 accepted source(s); has 0.')).toBe('Needs 1 more source (has 0)')
    expect(humaniseReason('Needs 3 accepted source(s); has 1.')).toBe('Needs 2 more sources (has 1)')
    expect(humaniseReason('Needs 2 strong or moderate source(s); has 1.')).toBe('Needs 1 more strong or moderate source (has 1)')
    expect(humaniseReason('1 source(s) could not be matched to a verified record and were not counted.'))
      .toBe('1 source could not be matched to a verified record and was not counted.')
    expect(humaniseReason('The search for contradictory findings has not yet been answered.')).toBe('The search for contradictory findings has not yet been answered.')
  })
})

describe('nextStep', () => {
  it('says what to do for each kind of unfinished run, and nothing for a full answer', () => {
    expect(nextStep('NeedsReview')).toMatch(/Retry the search for free/)
    expect(nextStep('Completed', 'BudgetIterations')).toMatch(/Continue it in Deep Research/)
    expect(nextStep('Failed')).toMatch(/Resume/)
    expect(nextStep('Completed', 'EvidenceSufficient')).toBeNull()
    expect(nextStep('Running')).toBeNull()
  })
})

describe('library dates', () => {
  it('uses day, short month, year', () => {
    expect(formatLibraryDate(new Date(2026, 10, 10, 9, 5).toISOString())).toBe('10 Nov 2026')
    expect(formatLibraryDateTime(new Date(2026, 10, 10, 9, 5).toISOString())).toBe('10 Nov 2026, 09:05')
    expect(formatLibraryDate('nope')).toBe('')
  })
})
