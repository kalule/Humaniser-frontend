import { describe, expect, it } from 'vitest'
import type { CitationFlag, FetchedLiterature } from '../types/research'
import { describeCitation, findCitations, swapCitationText, type CitationContext } from './citationCard'

function lit(id: string, authors: string, year: number, extra: Partial<FetchedLiterature> = {}): FetchedLiterature {
  return { id, title: `Title ${id}`, authors, year, doi: `10.1/${id}`, harvardCitation: '', apaCitation: '', source: 'OpenAlex',
    includedByStudent: true, citationCount: 0, citedInSections: [], ...extra }
}
function flag(doi: string, mismatchTypes: CitationFlag['mismatchTypes']): CitationFlag {
  return { id: `f-${doi}`, sectionCode: '3.2', doi, citationRawText: '', claimSentence: '', mismatchTypes, confidence: 0.8, status: 'Open', createdAt: '' }
}

const pillay = lit('pillay', 'Kavitha Pillay, Anisha Beharry-Ramraj', 2024, { hasFullText: true })
const klishi = lit('klishi', 'Lindiwe Klishi', 2024)
const ctx = (extra: Partial<CitationContext> = {}): CitationContext =>
  ({ style: 'harvard', literature: [pillay, klishi], bibliography: [], flags: [], pending: false, ...extra })

const text = 'Small retailers face high costs (Pillay and Beharry-Ramraj, 2024; Klishi, 2024), as Klishi (2024) shows.'

describe('citation card', () => {
  it('finds parenthetical and narrative citations', () => {
    expect(findCitations(text, ctx()).map(h => text.slice(h.from, h.to)))
      .toEqual(['(Pillay and Beharry-Ramraj, 2024; Klishi, 2024)', 'Klishi (2024)'])
  })

  it('describes each source in a grouped citation: exists, full text, claim check', () => {
    const [hit] = findCitations(text, ctx())
    const entries = describeCitation(hit, text, ctx({ flags: [flag('10.1/klishi', ['ClaimPartialMatch'])] }))
    expect(entries).toMatchObject([
      { clause: 'Pillay and Beharry-Ramraj, 2024', sourceExists: true, fullTextPinned: true, support: 'no_issues', note: null, literatureId: 'pillay' },
      { clause: 'Klishi, 2024', sourceExists: true, fullTextPinned: false, support: 'partly', note: 'The source supports only part of this claim.' },
    ])
  })

  it('says a claim is being checked while verification is pending, and never "no issues" for an unknown source', () => {
    const [hit] = findCitations('Costs rose (Nkohla, 2024).', ctx())
    expect(describeCitation(hit, '', ctx())).toEqual([expect.objectContaining({ sourceExists: false, support: 'not_checked', fullTextPinned: null })])
    const [known] = findCitations('Costs rose (Klishi, 2024).', ctx())
    expect(describeCitation(known, '', ctx({ pending: true }))[0].support).toBe('checking')
  })

  it('marks a claim the source contradicts as not supported', () => {
    const [hit] = findCitations('Costs rose (Klishi, 2024).', ctx())
    expect(describeCitation(hit, '', ctx({ flags: [flag('10.1/klishi', ['ClaimContentMismatch'])] }))[0].support).toBe('not_supported')
  })

  it('swaps one source in a grouped citation and keeps narrative citations narrative', () => {
    const nkohla = lit('nkohla', 'Thabo Nkohla', 2023)
    expect(swapCitationText('(Pillay and Beharry-Ramraj, 2024; Klishi, 2024)', 1, nkohla, 'harvard'))
      .toBe('(Pillay and Beharry-Ramraj, 2024; Nkohla, 2023)')
    expect(swapCitationText('Klishi (2024)', 0, nkohla, 'harvard')).toBe('Nkohla (2023)')
    expect(swapCitationText('[3]', 0, nkohla, 'ieee')).toBeNull()
  })
})
