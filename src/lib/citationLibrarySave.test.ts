import { describe, expect, it, vi } from 'vitest'
import type { CitationDto, SaveCitationRequest } from '../types/citation'
import { saveCitationToLibrary } from './citationLibrarySave'

const payload: SaveCitationRequest = { title: 'Study', itemType: 'article', authors: [{ firstName: 'Jane', middleInitial: '', lastName: 'Smith' }], publicationYear: 2024, journalName: null, volume: null, issue: null, pages: null, doi: '10.1234/work', url: null, publisher: null, cachedApa7: null, cachedHarvard: null, cachedIeee: null, cachedMla: null, cachedChicago: null, cachedVancouver: null }
const saved: CitationDto = { ...payload, id: 'library-id', createdAt: '2026-10-20' }

describe('citation library persistence', () => {
  it('reuses an existing DOI record rather than creating a duplicate', async () => {
    const api = { getLibrary: vi.fn(async () => [{ ...saved, doi: 'https://doi.org/10.1234/work' }]), save: vi.fn(async () => saved) }
    expect((await saveCitationToLibrary(payload, undefined, api)).id).toBe(saved.id)
    expect(api.save).not.toHaveBeenCalled()
  })
  it('coalesces simultaneous saves of a work into one persisted source', async () => {
    const api = { getLibrary: vi.fn(async () => []), save: vi.fn(async () => saved) }
    const [one, two] = await Promise.all([saveCitationToLibrary(payload, undefined, api), saveCitationToLibrary(payload, undefined, api)])
    expect(one.id).toBe(two.id); expect(api.save).toHaveBeenCalledTimes(1)
  })
  it('allows retry after a failed request and never returns a false saved state', async () => {
    const api = { getLibrary: vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue([]), save: vi.fn(async () => saved) }
    await expect(saveCitationToLibrary(payload, undefined, api)).rejects.toThrow('offline')
    expect(api.save).not.toHaveBeenCalled()
    await expect(saveCitationToLibrary(payload, undefined, api)).resolves.toEqual(saved)
  })
  it('deduplicates sources without DOIs using exact stored metadata', async () => {
    const api = { getLibrary: vi.fn(async () => [{ ...saved, doi: null }]), save: vi.fn(async () => saved) }
    await saveCitationToLibrary({ ...payload, doi: null }, undefined, api)
    expect(api.save).not.toHaveBeenCalled()
  })
})
