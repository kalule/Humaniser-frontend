import { describe, expect, it } from 'vitest'
import { editorSourceFromSaved, filterSavedSources, matchesSavedSourceQuery, savedSourceByline, savedSourceText, TRASH_FOLDER } from './savedSources'
import type { ResearchDocument } from '../types/webLibrary'
import { formatEssayReferenceListEntry } from './citationFormat'

const doc = (patch: Partial<ResearchDocument> & { id: string }): ResearchDocument => ({
  title: 'Untitled', authors: [], docType: 'Journal Article', tags: [], folderId: null,
  createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', ...patch,
})

const anxiety = doc({ id: 'a', title: 'Effects of exercise on anxiety', authors: ['Jane Nakato', 'Peter Okello'], year: 2021, journal: 'Sports Medicine', doi: '10.1000/ABC', abstract: 'Exercise reduced anxiety.', tags: ['rct'], canonicalWorkId: 'canon-a', openAlexWorkId: 'W1' })
const upload = doc({ id: 'b', title: '4. Editor new document', isFullText: true, filePath: 'blob:http://localhost:3000/x', folderId: 'folder-1' })
const trashed = doc({ id: 'c', title: 'Trashed exercise paper', abstract: 'Text.', folderId: TRASH_FOLDER })
const old = doc({ id: 'd', title: 'Machine learning trends', authors: ['M. Jordan'], year: 2015, abstract: 'Text.' })
const all = [anxiety, upload, trashed, old]

describe('savedSourceText', () => {
  it('counts only an abstract as text, whatever the full-text flag says', () => {
    expect(savedSourceText(anxiety)).toBe('abstract')
    expect(savedSourceText(upload)).toBe('metadata')
    expect(savedSourceText(doc({ id: 'x', abstract: '   ' }))).toBe('metadata')
  })
})

describe('filterSavedSources', () => {
  it('never offers a trashed paper', () => {
    expect(filterSavedSources(all).map(d => d.id)).toEqual(['a', 'b', 'd'])
    expect(filterSavedSources(all, { query: 'trashed' })).toEqual([])
  })

  it('searches title, author, journal, year, DOI and tags, requiring every term', () => {
    expect(filterSavedSources(all, { query: 'nakato' }).map(d => d.id)).toEqual(['a'])
    expect(filterSavedSources(all, { query: 'sports 2021' }).map(d => d.id)).toEqual(['a'])
    expect(filterSavedSources(all, { query: 'rct' }).map(d => d.id)).toEqual(['a'])
    expect(filterSavedSources(all, { query: 'exercise jordan' })).toEqual([])
  })

  it('finds a paper by DOI in any case and with the resolver prefix', () => {
    expect(matchesSavedSourceQuery(anxiety, '10.1000/abc')).toBe(true)
    expect(matchesSavedSourceQuery(anxiety, 'https://doi.org/10.1000/ABC')).toBe(true)
  })

  it('narrows by folder, and by collection only through the supplied membership', () => {
    expect(filterSavedSources(all, { location: 'folder-1' }).map(d => d.id)).toEqual(['b'])
    expect(filterSavedSources(all, { location: 'collection:1', collectionMemberIds: new Set(['d', 'c']) }).map(d => d.id)).toEqual(['d'])
    expect(filterSavedSources(all, { location: 'collection:1', collectionMemberIds: null })).toEqual([])
  })

  it('filters by abstract, DOI, year range and type', () => {
    expect(filterSavedSources(all, { withAbstractOnly: true }).map(d => d.id)).toEqual(['a', 'd'])
    expect(filterSavedSources(all, { withDoiOnly: true }).map(d => d.id)).toEqual(['a'])
    expect(filterSavedSources(all, { yearFrom: 2016 }).map(d => d.id)).toEqual(['a'])
    expect(filterSavedSources(all, { yearTo: 2016 }).map(d => d.id)).toEqual(['d'])
    expect(filterSavedSources(all, { docType: 'Book' })).toEqual([])
  })
})

describe('editorSourceFromSaved', () => {
  it('keeps the link to the saved record and its canonical identity', () => {
    expect(editorSourceFromSaved(anxiety)).toMatchObject({
      id: 'saved:a', documentId: 'a', canonicalId: 'canon-a', openAlexWorkId: 'W1',
      title: 'Effects of exercise on anxiety', authors: 'Jane Nakato; Peter Okello', year: 2021, venue: 'Sports Medicine',
      doi: '10.1000/ABC', url: 'https://doi.org/10.1000/ABC', abstract: 'Exercise reduced anxiety.',
    })
  })

  it('splits display names into family and given names so the reference list keeps every author', () => {
    // The names exactly as OpenAlex saved them for the paper that exposed the bug in the browser.
    const price = doc({ id: 'p', title: 'Exercise in Pregnancy', authors: ['BRADLEY B. PRICE', 'Saeid B. Amini', 'KAELYN KAPPELER'], year: 2012, journal: 'Medicine & Science in Sports & Exercise' })
    const source = editorSourceFromSaved(price)
    expect(source.authorDetails?.map(a => a.family)).toEqual(['PRICE', 'Amini', 'KAPPELER'])
    const line = formatEssayReferenceListEntry(source, 'Harvard', 0)
    expect(line).toMatch(/^PRICE, B\. ?B\., Amini, S\. ?B\. and KAPPELER, K\. \(2012\)/)
  })

  it('invents nothing for a record with no authors, year or DOI', () => {
    expect(editorSourceFromSaved(upload)).toMatchObject({ id: 'saved:b', authors: null, year: null, doi: null, url: null })
    expect(editorSourceFromSaved(upload).abstract).toBeUndefined()
  })
})

describe('savedSourceByline', () => {
  it('names the first author and says when there is none', () => {
    expect(savedSourceByline(anxiety)).toBe('Jane Nakato et al. · 2021')
    expect(savedSourceByline(old)).toBe('M. Jordan · 2015')
    expect(savedSourceByline(upload)).toBe('No author recorded · n.d.')
  })
})
