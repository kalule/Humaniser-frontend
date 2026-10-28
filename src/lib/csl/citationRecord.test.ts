import { describe, expect, it } from 'vitest'
import { FORMAT_STYLES, type ResolvedCitation } from '../../types/citation'
import { citationRecordReference, citationRecordSource, cslCitationSaveRequest } from './citationRecord'

const record: ResolvedCitation = {
  title: 'Assessment Handbook', authors: [{ firstName: 'Jane', middleInitial: 'A.', lastName: 'Smith' }],
  itemType: 'Book', publicationYear: 2024, publisher: 'Example Press', journalName: null,
  volume: null, issue: null, pages: null, doi: null, url: null,
  apa7: 'STALE', harvard: 'STALE', mla: 'STALE', ieee: 'STALE', chicago: 'STALE', vancouver: 'STALE',
}

describe('Citation Generator CSL records', () => {
  it.each(FORMAT_STYLES)('renders %s from metadata rather than cached server strings', style => {
    const text = citationRecordReference(record, style)!
    expect(text).toContain('Example Press')
    expect(text.toLowerCase()).toContain('assessment handbook')
    expect(text).not.toContain('STALE')
  })

  it('preserves exact structured author fields, publication fields and requested identity', () => {
    expect(citationRecordSource(record, 'library:id')).toMatchObject({ id: 'library:id',
      authorDetails: [{ family: 'Smith', given: 'Jane A.' }], publisher: 'Example Press', venue: null, itemType: 'Book' })
  })

  it('saves all six displayed CSL presets and only the API metadata fields', () => {
    const saved = cslCitationSaveRequest(record)!
    expect(saved.cachedApa7).toBe(citationRecordReference(record, 'apa7'))
    expect(saved.cachedHarvard).toBe(citationRecordReference(record, 'harvard'))
    expect(saved.cachedMla).toBe(citationRecordReference(record, 'mla'))
    expect(saved.cachedIeee).toBe(citationRecordReference(record, 'ieee'))
    expect(saved.cachedChicago).toBe(citationRecordReference(record, 'chicago'))
    expect(saved.cachedVancouver).toBe(citationRecordReference(record, 'vancouver'))
    expect(saved.authors).toEqual(record.authors)
    expect(saved).not.toHaveProperty('apa7')
  })

  it('rejects invalid metadata even when a cached label exists', () => {
    const invalid = { ...record, title: ' ' }
    expect(citationRecordReference(invalid, 'apa7')).toBeNull()
    expect(cslCitationSaveRequest(invalid)).toBeNull()
  })

  it('renders missing-author and missing-year records without guessing either field', () => {
    const text = citationRecordReference({ ...record, authors: [], publicationYear: null }, 'apa7')!
    expect(text).toContain('n.d.')
    expect(text).not.toContain('Smith')
    expect(text).not.toContain('2024')
  })
})
