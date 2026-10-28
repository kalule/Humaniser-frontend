import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { FetchedLiterature } from '../../types/research'
import { candidatesForAmbiguousFlag } from '../../lib/citationMatch'
import { AmbiguousSourceChooser } from './AmbiguousSourceChooser'

function lit(id: string, authors: string, year: number, title: string, doi?: string): FetchedLiterature {
  return {
    id, title, authors, year, doi, abstract: undefined, url: undefined, harvardCitation: '', apaCitation: '',
    source: 'openalex', includedByStudent: true, citationCount: 0, citedInSections: [],
  }
}

describe('candidatesForAmbiguousFlag', () => {
  const a = lit('a', 'Smith, J.', 2024, 'Paper A', '10.1/a')
  const b = lit('b', 'Smith, K.', 2024, 'Paper B', '10.1/b')
  const otherYear = lit('c', 'Smith, L.', 2023, 'Paper C')
  const otherAuthor = lit('d', 'Jones, M.', 2024, 'Paper D')

  it('lists every paper sharing the pick\'s first author and year, with the pick first', () => {
    // The flag records b as the pick, so b leads even though a comes first in the pool.
    const result = candidatesForAmbiguousFlag('b', [a, b, otherYear, otherAuthor])
    expect(result.map(c => c.id)).toEqual(['b', 'a'])
    expect(result[1].viewUrl).toBe('https://doi.org/10.1/a')
  })

  it('treats curly and straight apostrophes as the same author', () => {
    const curly = lit('x', 'Lamis F. Al-Qora’n', 2025, 'X')
    const straight = lit('y', "Amro Al-Qora'n", 2025, 'Y')
    expect(candidatesForAmbiguousFlag('x', [curly, straight]).map(c => c.id)).toEqual(['x', 'y'])
  })

  it('is empty when the pick is unknown or nothing else shares its key', () => {
    expect(candidatesForAmbiguousFlag(undefined, [a, b])).toEqual([])
    expect(candidatesForAmbiguousFlag('missing', [a, b])).toEqual([])
    expect(candidatesForAmbiguousFlag('a', [a, otherYear, otherAuthor])).toEqual([])
  })
})

describe('AmbiguousSourceChooser', () => {
  const candidates = [
    { id: 'a', title: 'Paper A', authors: 'Smith, J.', year: 2024, viewUrl: 'https://doi.org/10.1/a' },
    { id: 'b', title: 'Paper B', authors: 'Smith, K.', year: 2024 },
  ]

  it('offers "Keep this one" for the paper in use and "Use this paper" for the others', () => {
    const html = renderToStaticMarkup(<AmbiguousSourceChooser candidates={candidates} busy={false} onChoose={() => {}} />)
    expect(html).toContain('Paper A')
    expect(html).toContain('Paper B')
    expect(html).toContain('Keep this one')
    expect(html).toContain('currently used')
    expect(html.match(/Use this paper/g)).toHaveLength(1)
    expect(html).toContain('https://doi.org/10.1/a')
  })

  it('disables every choice while a choice is being saved', () => {
    const html = renderToStaticMarkup(<AmbiguousSourceChooser candidates={candidates} busy onChoose={() => {}} />)
    expect(html.match(/disabled=""/g)).toHaveLength(2)
  })

  it('says so, instead of rendering an empty list, when the candidates could not be found', () => {
    const html = renderToStaticMarkup(<AmbiguousSourceChooser candidates={[]} busy={false} onChoose={() => {}} />)
    expect(html).toContain('could not be listed')
    expect(html).not.toContain('Use this paper')
  })
})
