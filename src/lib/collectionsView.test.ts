import { describe, expect, it } from 'vitest'
import { referenceList, sortCollections, yearRangeLabel } from './collectionsView'
import { sortSavedPapers } from './savedPaperFilters'
import type { Collection, ResearchDocument } from '../types/webLibrary'

const col = (name: string, paperCount: number, updatedAt: string): Collection => ({ id: name, name, paperCount, createdAt: updatedAt, updatedAt })
const doc = (patch: Partial<ResearchDocument> & { id: string }): ResearchDocument => ({
  title: 'Untitled', authors: [], docType: 'Journal Article', tags: [], folderId: null,
  createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', ...patch,
})

describe('yearRangeLabel', () => {
  it('collapses a single year and needs both ends', () => {
    expect(yearRangeLabel(2004, 2019)).toBe('2004–2019')
    expect(yearRangeLabel(2016, 2016)).toBe('2016')
    expect(yearRangeLabel(null, 2016)).toBeNull()
  })
})

describe('sortCollections', () => {
  const list = [col('Anxiety', 3, '2026-09-30'), col('AI in health care', 5, '2026-09-08'), col('test', 3, '2026-10-04')]
  it('sorts each field both ways, ties by name', () => {
    expect(sortCollections(list, 'updated', 'desc').map(c => c.name)).toEqual(['test', 'Anxiety', 'AI in health care'])
    expect(sortCollections(list, 'name', 'asc').map(c => c.name)).toEqual(['AI in health care', 'Anxiety', 'test'])
    expect(sortCollections(list, 'name', 'desc').map(c => c.name)).toEqual(['test', 'Anxiety', 'AI in health care'])
    expect(sortCollections(list, 'count', 'desc').map(c => c.name)).toEqual(['AI in health care', 'Anxiety', 'test'])
    expect(sortCollections(list, 'count', 'asc').map(c => c.name)).toEqual(['Anxiety', 'test', 'AI in health care'])
  })
})

describe('sortSavedPapers', () => {
  const docs = [doc({ id: 'a', title: 'B', year: 2010 }), doc({ id: 'b', title: 'A' }), doc({ id: 'c', title: 'C', year: 2020 })]
  it('keeps papers with no year last in either direction', () => {
    expect(sortSavedPapers(docs, 'year', 'desc').map(d => d.id)).toEqual(['c', 'a', 'b'])
    expect(sortSavedPapers(docs, 'year', 'asc').map(d => d.id)).toEqual(['a', 'c', 'b'])
    expect(sortSavedPapers(docs, 'title', 'asc').map(d => d.title)).toEqual(['A', 'B', 'C'])
  })
})

describe('referenceList', () => {
  it('formats every paper and counts the ones it cannot cite', () => {
    const r = referenceList([
      doc({ id: 'a', title: 'AIDS, South Africa, and the Politics of Knowledge', authors: ['Jeremy Youde'], year: 2016, journal: 'Routledge' }),
      doc({ id: 'b', title: '   ' }),
    ], 'apa7')
    expect(r.entries).toHaveLength(1)
    expect(r.entries[0]).toContain('Youde')
    expect(r.entries[0]).toContain('2016')
    expect(r.skipped).toBe(1)
    expect(referenceList([], 'apa7')).toEqual({ entries: [], skipped: 0 })
  })
})
