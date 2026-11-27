import { describe, expect, it } from 'vitest'
import {
  counters, DEFAULT_VIEW, exclusionsCsv, filterKey, isFiltered, orderExcludeReasons, rangeBetween, readView, toQuery, writeView,
} from './literatureReviewScreening'

describe('screening view in the URL', () => {
  it('round-trips every filter and keeps the other keys of the page', () => {
    const view = { ...DEFAULT_VIEW, state: 'Included' as const, search: 'citation', yearFrom: 2019, yearTo: 2024, database: 'openalex', hasAbstract: false, verdict: 'Uncertain' as const, sort: 'citations' as const, page: 3 }
    const params = writeView(new URLSearchParams('step=screen'), view)
    expect(params.get('step')).toBe('screen')
    expect(readView(params)).toEqual(view)
  })

  it('leaves defaults out, so a plain link stays plain', () => {
    expect(writeView(new URLSearchParams('step=screen&q=old&page=4'), DEFAULT_VIEW).toString()).toBe('step=screen')
  })

  it('falls back to the default for malformed or unknown values', () => {
    expect(readView(new URLSearchParams('state=Bogus&sort=newest&verdict=Maybe&from=20&to=abcd&page=-2&abstract=perhaps'))).toEqual(DEFAULT_VIEW)
  })

  it('stores the trimmed search', () => {
    expect(writeView(new URLSearchParams(), { ...DEFAULT_VIEW, search: '  ai  ' }).get('q')).toBe('ai')
  })
})

describe('the server query', () => {
  it('sends only what narrows the list', () => {
    expect(toQuery(DEFAULT_VIEW, 25)).toEqual({ page: 1, pageSize: 25 })
    expect(toQuery({ ...DEFAULT_VIEW, search: ' x ', hasAbstract: false, sort: 'year' }, 25)).toEqual({ page: 1, pageSize: 25, search: 'x', hasAbstract: false, sort: 'year' })
  })

  it('treats sort and page as not filtering, and keys selection on the filters and tab only', () => {
    expect(isFiltered({ ...DEFAULT_VIEW, sort: 'title', page: 5 })).toBe(false)
    expect(isFiltered({ ...DEFAULT_VIEW, hasAbstract: false })).toBe(true)
    expect(filterKey({ ...DEFAULT_VIEW, page: 2, sort: 'year' })).toBe(filterKey(DEFAULT_VIEW))
    expect(filterKey({ ...DEFAULT_VIEW, search: 'AI ' })).toBe(filterKey({ ...DEFAULT_VIEW, search: 'ai' }))
    expect(filterKey({ ...DEFAULT_VIEW, state: 'Included' })).not.toBe(filterKey(DEFAULT_VIEW))
  })
})

describe('shift-click ranges', () => {
  const order = ['a', 'b', 'c', 'd', 'e']
  it('covers both ends in either direction', () => {
    expect(rangeBetween(order, 'b', 'd')).toEqual(['b', 'c', 'd'])
    expect(rangeBetween(order, 'd', 'b')).toEqual(['b', 'c', 'd'])
    expect(rangeBetween(order, 'c', 'c')).toEqual(['c'])
  })
  it('is empty when the anchor is not on this page', () => {
    expect(rangeBetween(order, 'z', 'b')).toEqual([])
  })
})

describe('decision counters', () => {
  it('group the states the way the reviewer reads them', () => {
    expect(counters({ Included: 5, AwaitingFullText: 2, Excluded: 3, NotRelevant: 4, PotentiallyRelevant: 1, UnableToAssess: 6, NotScreened: 7, Suggested: 9 }))
      .toEqual({ included: 5, needsFullText: 2, excluded: 7, undecided: 7, notScreened: 7, suggested: 9 })
    expect(counters({})).toEqual({ included: 0, needsFullText: 0, excluded: 0, undecided: 0, notScreened: 0, suggested: 0 })
  })
})

describe('excluded records CSV', () => {
  it('quotes every field, escapes quotes and neutralises spreadsheet formulas', () => {
    const csv = exclusionsCsv([
      { candidateId: '1', title: 'A "quoted", title', year: '2020', doi: '10.1/x', reasonCode: 'TOPIC', reason: 'Not about the topic', decidedBy: 'Student' },
      { candidateId: '2', title: '=HYPERLINK("http://x")', year: '', doi: '', reasonCode: null, reason: 'Off topic.', decidedBy: 'AI' },
    ])
    const lines = csv.replace('﻿', '').trim().split('\r\n')
    expect(csv.startsWith('﻿')).toBe(true)
    expect(lines[0]).toBe('"Title","Year","DOI","Reason","Decided by"')
    expect(lines[1]).toBe('"A ""quoted"", title","2020","10.1/x","Not about the topic","Reviewer"')
    expect(lines[2]).toBe('"\'=HYPERLINK(""http://x"")","","","Off topic.","AI screening"')
  })
})

describe('exclude reasons', () => {
  it('offer the common reasons first, Other last, and never "need the full text"', () => {
    const reasons = ['OTHER', 'LANGUAGE', 'NEEDS_FULLTEXT', 'DUPLICATE', 'TOPIC', 'OPINION'].map(code => ({ code, label: code }))
    expect(orderExcludeReasons(reasons).map(r => r.code)).toEqual(['TOPIC', 'OPINION', 'DUPLICATE', 'LANGUAGE', 'OTHER'])
  })
})
