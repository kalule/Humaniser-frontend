import { describe, expect, it } from 'vitest'
import type { CitationFlag, FetchedLiterature } from '../../types/research'
import {
  getReplacementCandidates, MAX_REPLACEMENT_OPTIONS, MIN_REPLACEMENT_QUERY_LENGTH,
} from './replacementCandidates'

const source = (over: Partial<FetchedLiterature> & { id: string }): FetchedLiterature => ({
  title:             'Digital learning platforms in higher education',
  authors:           'Duby, Z.',
  year:              2022,
  harvardCitation:   '',
  apaCitation:       '',
  source:            'openalex',
  includedByStudent: true,
  citationCount:     0,
  citedInSections:   [],
  ...over,
})

const flag = (over: Partial<CitationFlag> = {}): CitationFlag => ({
  id:             'flag-1',
  sectionCode:    '5.1',
  citationRawText: '(Duby, 2022)',
  claimSentence:  'South African higher education institutions have accelerated adoption.',
  mismatchTypes:  ['ClaimContentMismatch'],
  status:         'Open',
  ...over,
} as CitationFlag)

describe('getReplacementCandidates', () => {
  it('excludes sources the student has not approved', () => {
    const { eligible } = getReplacementCandidates(
      [source({ id: 'a', includedByStudent: false }), source({ id: 'b' })], flag(), 'digital')

    expect(eligible.map(s => s.id)).toEqual(['b'])
  })

  it('excludes the already-flagged source itself', () => {
    const { eligible } = getReplacementCandidates(
      [source({ id: 'flagged' }), source({ id: 'other' })],
      flag({ literatureId: 'flagged' }), 'digital')

    expect(eligible.map(s => s.id)).toEqual(['other'])
  })

  // The live case behind the bug: 1,831 candidates, none approved. eligible must come back empty so
  // the caller renders the automatic-search path rather than a dead dropdown.
  it('reports an empty eligible set when nothing is approved, and does not claim the query is short', () => {
    const unapproved = Array.from({ length: 50 }, (_, i) =>
      source({ id: `cand-${i}`, includedByStudent: false }))

    const { eligible, matches, queryTooShort } = getReplacementCandidates(unapproved, flag(), '')

    expect(eligible).toHaveLength(0)
    expect(matches).toHaveLength(0)
    expect(queryTooShort).toBe(false)
  })

  it('flags a too-short query only when there is something it could have matched', () => {
    const approved = [source({ id: 'a' })]

    expect(getReplacementCandidates(approved, flag(), 'd').queryTooShort).toBe(true)
    expect(getReplacementCandidates(approved, flag(), '  ').queryTooShort).toBe(true)
    expect(getReplacementCandidates(approved, flag(), 'di').queryTooShort).toBe(false)
    expect(MIN_REPLACEMENT_QUERY_LENGTH).toBe(2)
  })

  it('matches on title or author, case- and whitespace-insensitively', () => {
    const literature = [
      source({ id: 'title-hit',  title: 'Platform Usability in Rural Campuses', authors: 'Ncube, T.' }),
      source({ id: 'author-hit', title: 'Something unrelated',                  authors: 'Maruping, K.' }),
      source({ id: 'miss',       title: 'Unrelated work',                       authors: 'Smith, J.' }),
    ]

    expect(getReplacementCandidates(literature, flag(), '  USABILITY ').matches.map(s => s.id))
      .toEqual(['title-hit'])
    expect(getReplacementCandidates(literature, flag(), 'maruping').matches.map(s => s.id))
      .toEqual(['author-hit'])
  })

  it('caps the option list so a large approved corpus cannot flood the dropdown', () => {
    const many = Array.from({ length: MAX_REPLACEMENT_OPTIONS + 25 }, (_, i) =>
      source({ id: `s-${i}`, title: `Digital learning study ${i}` }))

    const { matches } = getReplacementCandidates(many, flag(), 'digital')

    expect(matches).toHaveLength(MAX_REPLACEMENT_OPTIONS)
  })
})
