import { describe, expect, it } from 'vitest'
import type { BibliographyResult } from '../types/research'
import {
  bibliographyReferences,
  buildBibliographyKey,
  describeBibliography,
  type BibliographyState,
} from './bibliographyState'
import { parseBibliographyResultEntries } from './citationFormat'

function result(overrides: Partial<BibliographyResult> = {}): BibliographyResult {
  return {
    status: 'ready',
    entries: [],
    unresolvedCitations: [],
    diagnostics: { draftedSections: 1, eligibleSources: 1, citationOccurrences: 1, resolvedOccurrences: 1, distinctEntries: 0 },
    revision: 'r1',
    ...overrides,
  }
}
const entry = (n: number) => ({ sourceId: `src-${n}`, formattedText: `Author${n}, A. (2026) 'Title ${n}'. Journal.` })
const ready = (data: BibliographyResult): BibliographyState => ({ status: 'ready', data })

describe('describeBibliography — each condition says what actually happened', () => {
  it('idle and loading are "Compiling", never a zero count', () => {
    for (const state of [{ status: 'idle' }, { status: 'loading' }] as BibliographyState[]) {
      const d = describeBibliography(state)
      expect(d.summary).toBe('Compiling…')
      expect(d.message).toBeNull()
    }
  })

  it('a failed fetch offers retry and does not report zero references', () => {
    const d = describeBibliography({ status: 'error', message: 'boom' })
    expect(d.message).toBe('References couldn’t load.')
    expect(d.canRetry).toBe(true)
    expect(d.tone).toBe('error')
    expect(d.summary).not.toMatch(/\b0\b/)
  })

  it('no drafted sections', () => {
    const d = describeBibliography(ready(result({ status: 'no_sections' })))
    expect(d.message).toBe('References will appear as you add citations.')
    expect(d.canRetry).toBe(false)
  })

  it('drafts with no detected citations', () => {
    const d = describeBibliography(ready(result({ status: 'no_citations' })))
    expect(d.message).toBe('No citations found in this draft.')
  })

  it('citations detected but none matched', () => {
    const d = describeBibliography(ready(result({
      status: 'needs_review',
      unresolvedCitations: [{ sectionCode: '1.0', citationText: '(Li, 2026)', reason: 'no_match' }],
    })))
    expect(d.message).toBe('Some citations need to be linked to sources.')
    expect(d.tone).toBe('review')
  })

  it('partially resolved shows both counts and still lists the references', () => {
    const d = describeBibliography(ready(result({
      status: 'needs_review',
      entries: Array.from({ length: 12 }, (_, i) => entry(i)),
      unresolvedCitations: Array.from({ length: 3 }, () => ({ sectionCode: '2.0', citationText: '(X, 2026)', reason: 'ambiguous' as const })),
    })))
    expect(d.summary).toBe('12 cited references · 3 citations to review')
    expect(d.message).toBeNull()
  })

  it('singular wording and the "Cited references" label', () => {
    const d = describeBibliography(ready(result({
      status: 'needs_review',
      entries: [entry(1)],
      unresolvedCitations: [{ sectionCode: '2.0', citationText: '(X, 2026)', reason: 'ambiguous' }],
    })))
    expect(d.summary).toBe('1 cited reference · 1 citation to review')
    expect(describeBibliography(ready(result({ entries: [entry(1), entry(2)] }))).summary).toBe('2 cited references')
  })
})

describe('structured entries — numbering is not part of the contract', () => {
  it('keeps every entry whatever its text looks like, and carries the source id', () => {
    const refs = parseBibliographyResultEntries([
      { sourceId: 'a', formattedText: "Tarhini, A. (2026) 'Role of AI characteristics'. Journal." },
      { sourceId: 'b', formattedText: '12. Looks like a numbered line but is just a title (2025)' },
      { sourceId: 'c', formattedText: '  - bullet style, no year at all  ' },
    ])
    expect(refs).toHaveLength(3)
    expect(refs.map(r => r.sourceId)).toEqual(['a', 'b', 'c'])
    expect(refs[0].surnames).toEqual(['Tarhini'])
    expect(refs[0].year).toBe('2026')
    expect(refs[2].year).toBeNull()
  })

  it('exposes null until a result exists, so "not compiled" differs from "compiled, zero"', () => {
    expect(bibliographyReferences({ status: 'idle' })).toBeNull()
    expect(bibliographyReferences({ status: 'loading' })).toBeNull()
    expect(bibliographyReferences({ status: 'error', message: 'x' })).toBeNull()
    expect(bibliographyReferences(ready(result()))).toEqual([])
    expect(bibliographyReferences(ready(result({ entries: [entry(1)] })))).toHaveLength(1)
  })
})

describe('buildBibliographyKey — the cache identity changes with everything the result depends on', () => {
  const base = {
    projectId: 'p1',
    citationStyle: 'harvard',
    sections: [{ code: '1.0', status: 'Draft' as const, content: 'Text (Wang, 2024).' }],
    literature: [{ id: 'l1', year: 2024, harvardCitation: 'Wang (2024)', apaCitation: 'Wang (2024)' }],
  }

  it('is stable for identical input', () => {
    expect(buildBibliographyKey(base)).toBe(buildBibliographyKey({ ...base }))
  })

  it.each([
    ['saved section content', { sections: [{ ...base.sections[0], content: 'Text (Wang, 2025).' }] }],
    ['section status', { sections: [{ ...base.sections[0], status: 'Approved' as const }] }],
    ['an added section', { sections: [...base.sections, { code: '2.0', status: 'Draft' as const, content: 'More.' }] }],
    ['citation style', { citationStyle: 'apa7' }],
    ['source added to the registry', { literature: [...base.literature, { id: 'l2', year: 2026, harvardCitation: 'Amer (2026)', apaCitation: 'Amer (2026)' }] }],
    ['source citation metadata', { literature: [{ ...base.literature[0], harvardCitation: 'Wang, Z. (2024)' }] }],
    ['source year', { literature: [{ ...base.literature[0], year: 2025 }] }],
    ['literature finishing loading', { literature: null }],
  ])('changes when %s changes', (_label, change) => {
    expect(buildBibliographyKey({ ...base, ...change } as typeof base)).not.toBe(buildBibliographyKey(base))
  })
})
