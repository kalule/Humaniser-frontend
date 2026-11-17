import { describe, expect, it } from 'vitest'
import { activeFilterLabels, emptyStateChips, withoutFilter } from './findPapersChips'

describe('emptyStateChips', () => {
  it('shows examples only when there is no history', () => {
    expect(emptyStateChips([], ['A', 'B'])).toEqual({ examples: ['A', 'B'], recent: [] })
    expect(emptyStateChips(['hiv south africa'], ['A', 'B'])).toEqual({ examples: [], recent: ['hiv south africa'] })
  })

  it('never repeats a term and caps the list', () => {
    const r = emptyStateChips(['AI in healthcare', 'ai in healthcare ', 'x', 'y', 'z', 'w', 'v'], [], 5)
    expect(r.recent).toEqual(['AI in healthcare', 'x', 'y', 'z', 'w'])
  })
})

describe('active filter chips', () => {
  it('labels each active filter once and removes them one at a time', () => {
    const f = { yearFrom: 2015, yearTo: 2024, openAccess: true, type: 'review' as const, minCitations: 50, field: ' Public health ' }
    expect(activeFilterLabels(f).map(c => c.label)).toEqual(['2015–2024', 'Review article', 'Open access', '50+ citations', 'Subject: Public health'])
    expect(withoutFilter(f, 'years')).toEqual({ openAccess: true, type: 'review', minCitations: 50, field: ' Public health ' })
    expect(activeFilterLabels({ minCitations: 0, field: '  ' })).toEqual([])
    expect(activeFilterLabels({ yearTo: 2000 })[0].label).toBe('Up to 2000')
  })
})
