import { describe, expect, it } from 'vitest'
import type { CitationCard } from '../types/citationCheck'
import { splitParagraphs } from './citationHighlights'
import {
  allCorrectedReferences, correctedReference, formatEstimateTime, groupByReference, groupBySection, hasHeadings, isRetryable, referenceKey,
  searchCards, sortCards, stepIssue,
} from './citationResults'

function card(id: string, ordinal: number, over: Partial<CitationCard> = {}): CitationCard {
  return {
    id, ordinal, markerText: `(Smith, 20${ordinal})`, markerOffset: ordinal * 10, markerLength: 5, locked: false, resolutionState: 'Verified', resolutionNote: null,
    referenceEntry: null, flags: [], metadataDiffs: [], citedLabel: `Smith (20${ordinal})`, citedAuthors: 'Smith', citedYear: `20${ordinal}`,
    verdict: { verdict: 'Supported', failureType: 'None', confidence: 'High', evidenceLevel: 'FullText', claimText: `Claim ${ordinal}`, evidenceQuote: null,
      evidenceChunkId: null, reasoning: '', suggestedRewrite: null, quoteVerified: false, note: null },
    ...over,
  }
}
const bad = (id: string, o: number, over: Partial<CitationCard> = {}) =>
  card(id, o, { ...over, verdict: { ...card(id, o).verdict!, verdict: 'NotSupported' } })

describe('sortCards', () => {
  const cards = [card('a', 0), card('b', 1, { verdict: null }), bad('c', 2), card('d', 3, { locked: true }), card('e', 4, { verdict: { ...card('x', 4).verdict!, verdict: 'CannotVerify' } })]
  it('puts issues first, then could-not-verify, in-progress, locked, supported — each in document order', () => {
    expect(sortCards(cards, 'issues').map(c => c.id)).toEqual(['c', 'e', 'b', 'd', 'a'])
  })
  it('can keep document order', () => {
    expect(sortCards([...cards].reverse(), 'document').map(c => c.id)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })
})

describe('searchCards', () => {
  const cards = [card('a', 0, { citedAuthors: 'Lee', citedLabel: 'Lee (2019)', citedYear: '2019' }), card('b', 1, { citedAuthors: 'Park', citedLabel: 'Park (2021)', citedYear: '2021' })]
  it('matches author and year, every word must match', () => {
    expect(searchCards(cards, 'lee').map(c => c.id)).toEqual(['a'])
    expect(searchCards(cards, 'park 2021').map(c => c.id)).toEqual(['b'])
    expect(searchCards(cards, 'park 2019')).toEqual([])
    expect(searchCards(cards, '  ')).toBe(cards)
  })
  it('also matches the claim text', () => {
    const withClaims = [card('a', 0, { verdict: { ...card('a', 0).verdict!, claimText: 'Alpha finding' } }), card('b', 1, { verdict: { ...card('b', 1).verdict!, claimText: 'Beta finding' } })]
    expect(searchCards(withClaims, 'beta').map(c => c.id)).toEqual(['b'])
  })
})

describe('isRetryable', () => {
  it('is only a failure on our side or a lookup that did not answer — never a locked or a judged citation', () => {
    expect(isRetryable(card('a', 0, { flags: ['CheckFailed'] }))).toBe(true)
    expect(isRetryable(card('a', 0, { flags: ['LookupFailed'] }))).toBe(true)
    expect(isRetryable(card('a', 0, { flags: ['SourceNotFound'] }))).toBe(false)
    expect(isRetryable(card('a', 0, { flags: ['CheckFailed'], locked: true }))).toBe(false)
    expect(isRetryable(card('a', 0))).toBe(false)
  })
})

describe('groupByReference (one reference, cited N times)', () => {
  const entry = 'Smith, J. (2020). Sleep and memory. Journal, 1(1), 1-2.'
  const smith = { citedAuthors: 'Smith', citedYear: '2020', citedLabel: 'Smith (2020)' }
  const cards = [card('a', 0, { ...smith, referenceEntry: entry }), card('b', 1, { ...smith, referenceEntry: entry.toUpperCase() }), bad('c', 2, { referenceEntry: 'Lee, K. (2019). Other.' })]
  it('puts every citation of the same work in one group, keeping first-seen order', () => {
    const groups = groupByReference(cards)
    expect(groups.map(g => g.cards.map(c => c.id))).toEqual([['a', 'b'], ['c']])
    expect(groups[0].label).toBe('Smith (2020)')
    expect(groups.map(g => g.issues)).toEqual([0, 1])
  })
  it('falls back to author and year when there is no reference entry', () => {
    expect(referenceKey(card('a', 0, { citedAuthors: 'Lee', citedYear: '2019' }))).toBe(referenceKey(card('b', 1, { citedAuthors: 'LEE', citedYear: '2019' })))
  })
})

describe('groupBySection', () => {
  const text = '# Intro\nSmith (2020)\n# Methods\nLee (2019)'
  const paragraphs = splitParagraphs(text)
  it('groups by the heading above each citation, with the count of issues', () => {
    const cards = [card('a', 0, { markerOffset: text.indexOf('Smith') }), bad('b', 1, { markerOffset: text.indexOf('Lee') })]
    const groups = groupBySection(cards, paragraphs, text)
    expect(groups.map(g => [g.label, g.cards.length, g.issues])).toEqual([['Intro', 1, 0], ['Methods', 1, 1]])
    expect(hasHeadings(paragraphs)).toBe(true)
    expect(hasHeadings(splitParagraphs('no headings here'))).toBe(false)
  })
})

describe('stepIssue', () => {
  const cards = [card('a', 0), bad('b', 1), card('c', 2), bad('d', 3)]
  it('walks the issues in order and wraps round, in both directions', () => {
    expect(stepIssue(cards, null, 1)?.id).toBe('b')
    expect(stepIssue(cards, 'b', 1)?.id).toBe('d')
    expect(stepIssue(cards, 'd', 1)?.id).toBe('b')
    expect(stepIssue(cards, null, -1)?.id).toBe('d')
    expect(stepIssue(cards, 'b', -1)?.id).toBe('d')
  })
  it('is null when nothing needs attention', () => expect(stepIssue([card('a', 0)], null, 1)).toBeNull())
})

describe('correctedReference', () => {
  const diffs = [{ field: 'year', inDraft: '2019', inRecord: '2020' }]
  it('swaps the draft year for the record year, without touching the rest', () => {
    expect(correctedReference({ referenceEntry: 'Fine, F. (2019). A paper 2019. Journal, 2019(1).', metadataDiffs: diffs, locked: false }))
      .toBe('Fine, F. (2020). A paper 2019. Journal, 2019(1).'.replace('A paper 2019', 'A paper 2019'))
  })
  it('is null when the draft value is not in the entry, there is no diff, or the card is locked', () => {
    expect(correctedReference({ referenceEntry: 'Fine, F. (2018). Paper.', metadataDiffs: diffs, locked: false })).toBeNull()
    expect(correctedReference({ referenceEntry: 'Fine, F. (2019).', metadataDiffs: [], locked: false })).toBeNull()
    expect(correctedReference({ referenceEntry: 'Fine, F. (2019).', metadataDiffs: diffs, locked: true })).toBeNull()
  })
  it('collects each distinct corrected reference once', () => {
    const a = card('a', 0, { referenceEntry: 'Fine, F. (2019). Paper.', metadataDiffs: diffs })
    const b = card('b', 1, { referenceEntry: 'Fine, F. (2019). Paper.', metadataDiffs: diffs })
    expect(allCorrectedReferences([b, a])).toEqual(['Fine, F. (2020). Paper.'])
  })
})

describe('formatEstimateTime', () => {
  it('speaks in minutes', () => {
    expect(formatEstimateTime(30)).toBe('under a minute')
    expect(formatEstimateTime(70)).toBe('about a minute')
    expect(formatEstimateTime(600)).toBe('about 10 minutes')
  })
})
