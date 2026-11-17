import { describe, expect, it } from 'vitest'
import type { CitationCard } from '../types/citationCheck'
import { buildHighlightIndex, headingForOffset, markTone, splitParagraphs, wordCountOf } from './citationHighlights'

const TEXT = [
  '# Introduction',
  'Sleep supports memory (Smith, 2020). Screens harm sleep (Lee, 2019; Park, 2021).',
  '',
  '## Methods',
  'Diet matters (Ghost, 2015).',
].join('\n')

function card(marker: string, id: string, over: Partial<CitationCard> = {}, occurrence = 0): CitationCard {
  let at = -1
  for (let i = 0; i <= occurrence; i++) at = TEXT.indexOf(marker, at + 1)
  return {
    id, ordinal: 0, markerText: marker, markerOffset: at, markerLength: marker.length, locked: false, resolutionState: 'Verified',
    resolutionNote: null, referenceEntry: null, flags: [], metadataDiffs: [],
    verdict: { verdict: 'Supported', failureType: 'None', confidence: 'High', evidenceLevel: 'FullText', claimText: 'x', evidenceQuote: null,
      evidenceChunkId: null, reasoning: '', suggestedRewrite: null, quoteVerified: false, note: null },
    ...over,
  }
}

describe('splitParagraphs', () => {
  it('splits on LF, keeps blank lines, and strips a heading prefix for display only', () => {
    const p = splitParagraphs(TEXT)
    expect(p.map(x => x.text)).toEqual(['Introduction', 'Sleep supports memory (Smith, 2020). Screens harm sleep (Lee, 2019; Park, 2021).', '', 'Methods', 'Diet matters (Ghost, 2015).'])
    expect(p[0]).toMatchObject({ heading: 1, prefixLength: 2, start: 0 })
    expect(p[3]).toMatchObject({ heading: 2, prefixLength: 3 })
    expect(p[1].heading).toBe(0)
    // offsets stay in draft coordinates
    expect(TEXT.slice(p[4].start, p[4].end)).toBe('Diet matters (Ghost, 2015).')
  })
})

describe('buildHighlightIndex', () => {
  const paragraphs = splitParagraphs(TEXT)

  it('places each marker at its offset, relative to the displayed paragraph', () => {
    const c = card('(Smith, 2020)', 'a')
    const { byParagraph, cardToParagraph, unplaced } = buildHighlightIndex(TEXT, paragraphs, [c])
    const seg = byParagraph.get(1)![0]
    expect(paragraphs[1].text.slice(seg.start, seg.end)).toBe('(Smith, 2020)')
    expect(cardToParagraph.get('a')).toBe(1)
    expect(unplaced).toEqual([])
  })

  it('merges two cards that share one marker into one segment and takes the more serious tone', () => {
    const shared = '(Lee, 2019; Park, 2021)'
    const ok = card(shared, 'lee')
    const bad = card(shared, 'park', { verdict: { ...ok.verdict!, verdict: 'NotSupported' } })
    const { byParagraph } = buildHighlightIndex(TEXT, paragraphs, [ok, bad])
    const segs = byParagraph.get(1)!
    expect(segs).toHaveLength(1)
    expect(segs[0].cardIds).toEqual(['lee', 'park'])
    expect(segs[0].tone).toBe('attention')
  })

  it('does not place a marker whose text is not at its offset', () => {
    const c = { ...card('(Smith, 2020)', 'a'), markerOffset: 3 }
    const { unplaced, byParagraph } = buildHighlightIndex(TEXT, paragraphs, [c])
    expect(unplaced).toEqual(['a'])
    expect(byParagraph.size).toBe(0)
  })

  it('shifts offsets in heading lines by the removed prefix', () => {
    const t = '## Smith (2020) found things\nBody.'
    const c: CitationCard = { ...card('Smith (2020)', 'h'), markerOffset: 3, markerLength: 12, markerText: 'Smith (2020)' }
    const { byParagraph } = buildHighlightIndex(t, splitParagraphs(t), [c])
    const p = splitParagraphs(t)[0]
    const seg = byParagraph.get(0)![0]
    expect(p.text.slice(seg.start, seg.end)).toBe('Smith (2020)')
  })
})

describe('markTone', () => {
  it('uses a distinct tone per state so the text can show more than colour', () => {
    const base = card('(Smith, 2020)', 'a')
    expect(markTone(base)).toBe('ok')
    expect(markTone({ ...base, verdict: null })).toBe('pending')
    expect(markTone({ ...base, locked: true })).toBe('locked')
    expect(markTone({ ...base, verdict: { ...base.verdict!, verdict: 'CannotVerify' } })).toBe('unverified')
    expect(markTone({ ...base, flags: ['OrphanCitation'] })).toBe('attention')
    expect(markTone({ ...base, resolutionState: 'MetadataMismatch' })).toBe('attention')
  })
})

describe('headings and word count', () => {
  it('finds the section a position falls in', () => {
    const p = splitParagraphs(TEXT)
    expect(headingForOffset(p, TEXT.indexOf('Smith'))).toBe('Introduction')
    expect(headingForOffset(p, TEXT.indexOf('Ghost'))).toBe('Methods')
    expect(headingForOffset(p, 0)).toBe('Introduction')
  })
  it('counts words of the whole draft', () => {
    expect(wordCountOf('one two  three\nfour')).toBe(4)
    expect(wordCountOf('   ')).toBe(0)
  })
})
