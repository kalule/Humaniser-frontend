import { describe, expect, it } from 'vitest'
import type { FetchedLiterature } from '../types/research'
import { resolveHitAgainstLiterature, scanTextForCitations, type CitationHit } from './citationMatch'

function lit(overrides: Partial<FetchedLiterature> & { title: string; authors: string; year: number }): FetchedLiterature {
  return {
    doi:               undefined,
    abstract:          undefined,
    url:               undefined,
    harvardCitation:   '',
    apaCitation:       '',
    source:            'openalex',
    includedByStudent: true,
    citationCount:     0,
    citedInSections:   [],
    ...overrides,
    id:                overrides.id ?? 'test-literature-id',
  }
}

// Regression coverage for a live bug reported against the editor: clicking a grouped
// Harvard citation "(Alabi, 2020; Moodley, 2024)" showed "Unmatched" even though both
// sources exist in the project's literature. resolveHitAgainstLiterature used to treat
// the whole parenthetical as one clause, pairing the FIRST surname with the LAST year
// (Alabi + 2024), which matches neither real source. Each `;`-separated clause must
// resolve independently.
describe('resolveHitAgainstLiterature — grouped Harvard/APA citations', () => {
  const literature = [
    lit({ title: 'Additive manufacturing in engineering education', authors: 'Alabi, M. O.', year: 2020, doi: '10.1108/rpj-02-2019-0041' }),
    lit({ title: 'Institutional constraints on AI adoption', authors: 'Moodley, D.', year: 2024, doi: '10.38140/pie.v42i2.7830' }),
  ]

  it('resolves each clause of a grouped citation to its own source', () => {
    const hit: CitationHit = { from: 0, to: 0, inner: 'Alabi, 2020; Moodley, 2024' }
    const resolved = resolveHitAgainstLiterature(hit, 'harvard', literature)

    expect(resolved).not.toBeNull()
    expect(resolved).toHaveLength(2)
    expect(resolved![0]).toMatchObject({ matchedSource: true, doi: '10.1108/rpj-02-2019-0041' })
    expect(resolved![1]).toMatchObject({ matchedSource: true, doi: '10.38140/pie.v42i2.7830' })
  })

  it('marks only the failing clause as unmatched when one of several sources is missing', () => {
    const hit: CitationHit = { from: 0, to: 0, inner: 'Alabi, 2020; Nkosi, 2019' }
    const resolved = resolveHitAgainstLiterature(hit, 'harvard', literature)

    expect(resolved).toHaveLength(2)
    expect(resolved![0].matchedSource).toBe(true)
    expect(resolved![1]).toMatchObject({ matchedSource: false, displayTitle: '(Nkosi, 2019)' })
  })

  it('still resolves a single, non-grouped citation', () => {
    const hit: CitationHit = { from: 0, to: 0, inner: 'Moodley, 2024' }
    const resolved = resolveHitAgainstLiterature(hit, 'apa7', literature)

    expect(resolved).toHaveLength(1)
    expect(resolved![0]).toMatchObject({ matchedSource: true, doi: '10.38140/pie.v42i2.7830' })
  })

  it('scans the whole grouped parenthetical as a single clickable span', () => {
    const text = 'This is shaped by context (Alabi, 2020; Moodley, 2024).'
    const hits = scanTextForCitations(text, 'harvard', new Set())

    expect(hits).toHaveLength(1)
    expect(hits[0].inner).toBe('Alabi, 2020; Moodley, 2024')
  })
})

// Regression coverage for a live UNMATCHED-citation incident, end-to-end through the actual
// popover resolution path (not just the surname-extraction unit in citationFormat.test.ts) —
// both real sources genuinely exist in the project's literature (confirmed via direct DB query)
// but showed as UNMATCHED before this fix: "Sadeghi D." (surname-first, no comma) had its
// trailing initial misread as the surname; "Shira Zelber‐Sagi" (Unicode hyphen) never matched
// the plain-ASCII-hyphen "(Zelber-Sagi, ...)" a drafting model writes.
describe('resolveHitAgainstLiterature — genuinely-existing sources previously shown as UNMATCHED', () => {
  it('resolves a citation against a "Surname Initial." (no comma) literature record', () => {
    const literature = [
      lit({ title: 'Clarification of poor adherence to treatment among patients with type 2 diabetes in Iran',
        authors: 'Sadeghi D.', year: 2026, doi: '10.1007/s40200-026-01983-8' }),
    ]
    const hit: CitationHit = { from: 0, to: 0, inner: 'Sadeghi, 2026' }
    const resolved = resolveHitAgainstLiterature(hit, 'harvard', literature)

    expect(resolved).toHaveLength(1)
    expect(resolved![0]).toMatchObject({ matchedSource: true, doi: '10.1007/s40200-026-01983-8' })
  })

  it('resolves a plain-ASCII-hyphen citation against a Unicode-hyphen literature record', () => {
    const literature = [
      lit({ title: 'Nutrition and physical activity in NAFLD',
        authors: 'Shira Zelber‐Sagi', year: 2011, doi: '10.3748/wjg.v17.i29.3377' }),
    ]
    const hit: CitationHit = { from: 0, to: 0, inner: 'Zelber-Sagi, 2011' }
    const resolved = resolveHitAgainstLiterature(hit, 'harvard', literature)

    expect(resolved).toHaveLength(1)
    expect(resolved![0]).toMatchObject({ matchedSource: true, doi: '10.3748/wjg.v17.i29.3377' })
  })
})

describe('narrative Harvard/APA citations', () => {
  const literature = [
    lit({ title: 'eLearning usage in South African universities', authors: 'Bagarukayo, E.', year: 2015, doi: '10.1234/bagarukayo' }),
    lit({ title: 'Collaborative learning', authors: 'Smith, J., Jones, A.', year: 2023, doi: '10.1234/smith-jones' }),
    lit({ title: 'Digital inclusion', authors: 'Patel, R., Nkosi, T., Adams, P.', year: 2024, doi: '10.1234/patel' }),
  ]

  it('scans and resolves a single-author narrative citation as one unit', () => {
    const hits = scanTextForCitations('Bagarukayo (2015) examined eLearning usage.', 'harvard', new Set())

    expect(hits).toEqual([{ from: 0, to: 17, inner: 'Bagarukayo, 2015' }])
    expect(resolveHitAgainstLiterature(hits[0], 'harvard', literature)?.[0])
      .toMatchObject({ matchedSource: true, doi: '10.1234/bagarukayo' })
  })

  it('resolves two-author and et-al narrative citations', () => {
    const twoAuthor = scanTextForCitations('Smith and Jones (2023) found a pattern.', 'apa7', new Set())[0]
    const etAl = scanTextForCitations('Patel et al. (2024) reported a difference.', 'apa7', new Set())[0]

    expect(resolveHitAgainstLiterature(twoAuthor, 'apa7', literature)?.[0])
      .toMatchObject({ matchedSource: true, doi: '10.1234/smith-jones' })
    expect(resolveHitAgainstLiterature(etAl, 'apa7', literature)?.[0])
      .toMatchObject({ matchedSource: true, doi: '10.1234/patel' })
  })

  it('does not attach an ordinary bare year parenthetical to lowercase prose', () => {
    expect(scanTextForCitations('The study was completed in (2015).', 'harvard', new Set()))
      .toEqual([{ from: 27, to: 33, inner: '2015' }])
  })
})
