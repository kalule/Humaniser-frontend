import { describe, expect, it } from 'vitest'
import type { DashboardLiteratureCard, DashboardLiteraturePage } from '../types/research'
import { applyInclusionChange } from './literatureInclusion'

const card = (id: string, includedByStudent: boolean): DashboardLiteratureCard => ({
  id, title: `Source ${id}`, authors: 'Duby, Z.', year: 2022,
  source: 'openalex', includedByStudent, citationCount: 0, citedInSections: [],
})

const page = (items: DashboardLiteratureCard[]): DashboardLiteraturePage => ({
  items,
  page: 1,
  pageSize: 25,
  totalCount: items.length,
  matchingCount: items.length,
  counts: {
    all: items.length,
    cited: 0,
    unresolved: 0,
    prioritised: items.filter(i => i.includedByStudent).length,
    available:   items.filter(i => !i.includedByStudent).length,
    excluded: 0,
  },
  citationIndexStatus: 'Ready',
  unresolvedCitations: [],
})

describe('applyInclusionChange', () => {
  it('flips the row and moves both counts', () => {
    const next = applyInclusionChange(page([card('a', false), card('b', false)]), 'a', true, 'all')

    expect(next.items.find(i => i.id === 'a')?.includedByStudent).toBe(true)
    expect(next.counts.prioritised).toBe(1)
    expect(next.counts.available).toBe(1)
  })

  it('keeps the row under filters the flag does not define', () => {
    for (const filter of ['all', 'cited', 'unresolved', 'excluded'] as const) {
      const next = applyInclusionChange(page([card('a', false)]), 'a', true, filter)
      expect(next.items.map(i => i.id)).toEqual(['a'])
      expect(next.matchingCount).toBe(1)
    }
  })

  it('drops a demoted row while viewing Prioritised, and decrements matchingCount', () => {
    const next = applyInclusionChange(page([card('a', true), card('b', true)]), 'a', false, 'prioritised')

    expect(next.items.map(i => i.id)).toEqual(['b'])
    expect(next.matchingCount).toBe(1)
    expect(next.counts.prioritised).toBe(1)
    expect(next.counts.available).toBe(1)
  })

  it('drops a promoted row while viewing Available', () => {
    const next = applyInclusionChange(page([card('a', false), card('b', false)]), 'a', true, 'available')

    expect(next.items.map(i => i.id)).toEqual(['b'])
    expect(next.matchingCount).toBe(1)
  })

  it('is a no-op for an unknown id or a value that is already set', () => {
    const original = page([card('a', true)])

    expect(applyInclusionChange(original, 'missing', true, 'all')).toBe(original)
    expect(applyInclusionChange(original, 'a', true, 'all')).toBe(original)
  })

  it('never produces a negative count', () => {
    const zeroed = { ...page([card('a', true)]), counts: { ...page([card('a', true)]).counts, prioritised: 0 } }

    const next = applyInclusionChange(zeroed, 'a', false, 'all')

    expect(next.counts.prioritised).toBe(0)
  })

  it('does not mutate the page it was given', () => {
    const original = page([card('a', false)])

    applyInclusionChange(original, 'a', true, 'all')

    expect(original.items[0]!.includedByStudent).toBe(false)
    expect(original.counts.prioritised).toBe(0)
  })
})
