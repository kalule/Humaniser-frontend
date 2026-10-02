import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PaperSearchResult, Collection, ResearchDocument } from '../types/webLibrary'
import type { WebLibrarySearchResponse } from '../api/webLibrary'

const mocks = vi.hoisted(() => ({
  searchPapers: vi.fn(),
  saveFromSearch: vi.fn(),
  createCollection: vi.fn(),
  deleteCollection: vi.fn(),
  addToCollection: vi.fn(),
  removeFromCollection: vi.fn(),
}))

vi.mock('../api/webLibrary', () => ({
  webLibraryApi: {
    searchPapers: mocks.searchPapers,
    saveFromSearch: mocks.saveFromSearch,
    createCollection: mocks.createCollection,
    deleteCollection: mocks.deleteCollection,
    addToCollection: mocks.addToCollection,
    removeFromCollection: mocks.removeFromCollection,
  },
}))

function result(overrides: Partial<PaperSearchResult> = {}): PaperSearchResult {
  return {
    canonicalId: 'canonical-1',
    title: 'AI in healthcare: a review',
    authors: ['Jane Smith'],
    year: 2024,
    journal: 'Journal of Testing',
    isRetracted: false,
    isSaved: false,
    collectionIds: [],
    ...overrides,
  }
}

function savedDoc(overrides: Partial<ResearchDocument> = {}): ResearchDocument {
  return {
    id: 'doc-1',
    title: 'AI in healthcare: a review',
    authors: ['Jane Smith'],
    docType: 'Journal Article',
    tags: [],
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    canonicalWorkId: 'canonical-1',
    ...overrides,
  }
}

function collection(overrides: Partial<Collection> = {}): Collection {
  return {
    id: 'col-1',
    name: 'AI in Healthcare',
    paperCount: 0,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    ...overrides,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('webLibraryStore — Find Papers search', () => {
  beforeEach(() => {
    vi.resetModules()
    Object.values(mocks).forEach(m => m.mockReset())
  })

  it('populates searchResults and clears isSearching on success', async () => {
    const { useWebLibraryStore } = await import('./webLibraryStore')
    const response: WebLibrarySearchResponse = {
      query: 'AI in healthcare', results: [result()], page: 1, pageSize: 20, totalReturned: 1,
    }
    mocks.searchPapers.mockResolvedValue(response)

    await useWebLibraryStore.getState().searchPapers('AI in healthcare')

    const state = useWebLibraryStore.getState()
    expect(state.isSearching).toBe(false)
    expect(state.searchResults).toHaveLength(1)
    expect(state.searchResults[0].title).toBe('AI in healthcare: a review')
    expect(state.searchError).toBeNull()
  })

  it('surfaces an error message and clears stale results on failure', async () => {
    const { useWebLibraryStore } = await import('./webLibraryStore')
    useWebLibraryStore.setState({ searchResults: [result()] })
    mocks.searchPapers.mockRejectedValue(new Error('OpenAlex unavailable'))

    await useWebLibraryStore.getState().searchPapers('AI in healthcare')

    const state = useWebLibraryStore.getState()
    expect(state.isSearching).toBe(false)
    expect(state.searchResults).toHaveLength(0)
    expect(state.searchError).toBe('OpenAlex unavailable')
  })

  it('optimistically marks a result as saved before the save request resolves, then attaches the document id', async () => {
    const { useWebLibraryStore } = await import('./webLibraryStore')
    const unsaved = result()
    useWebLibraryStore.setState({ searchResults: [unsaved] })
    const pending = deferred<ResearchDocument>()
    mocks.saveFromSearch.mockReturnValue(pending.promise)

    const savePromise = useWebLibraryStore.getState().saveFromSearch(unsaved)

    // Optimistic flip happens synchronously, before the request settles.
    expect(useWebLibraryStore.getState().searchResults[0].isSaved).toBe(true)

    pending.resolve(savedDoc())
    await savePromise

    const state = useWebLibraryStore.getState()
    expect(state.searchResults[0].savedDocumentId).toBe('doc-1')
    expect(state.documents[0]?.id).toBe('doc-1')
  })

  it('rolls back the optimistic save flag when the request fails', async () => {
    const { useWebLibraryStore } = await import('./webLibraryStore')
    const unsaved = result()
    useWebLibraryStore.setState({ searchResults: [unsaved] })
    mocks.saveFromSearch.mockRejectedValue(new Error('save failed'))

    await expect(useWebLibraryStore.getState().saveFromSearch(unsaved)).rejects.toThrow()

    const state = useWebLibraryStore.getState()
    expect(state.searchResults[0].isSaved).toBe(false)
    expect(state.documents).toHaveLength(0)
  })

  it('does not duplicate an already-saved document already present in local state', async () => {
    const { useWebLibraryStore } = await import('./webLibraryStore')
    useWebLibraryStore.setState({ documents: [savedDoc()], searchResults: [result()] })
    mocks.saveFromSearch.mockResolvedValue(savedDoc())

    await useWebLibraryStore.getState().saveFromSearch(result())

    expect(useWebLibraryStore.getState().documents).toHaveLength(1)
  })
})

describe('webLibraryStore — Research Collections', () => {
  beforeEach(() => {
    vi.resetModules()
    Object.values(mocks).forEach(m => m.mockReset())
  })

  it('prepends a newly created collection', async () => {
    const { useWebLibraryStore } = await import('./webLibraryStore')
    mocks.createCollection.mockResolvedValue(collection())

    await useWebLibraryStore.getState().createCollection('AI in Healthcare')

    expect(useWebLibraryStore.getState().collections).toHaveLength(1)
    expect(useWebLibraryStore.getState().collections[0].name).toBe('AI in Healthcare')
  })

  it('removes a deleted collection from local state without touching documents', async () => {
    const { useWebLibraryStore } = await import('./webLibraryStore')
    useWebLibraryStore.setState({ collections: [collection()], documents: [savedDoc()] })
    mocks.deleteCollection.mockResolvedValue(undefined)

    await useWebLibraryStore.getState().deleteCollection('col-1')

    const state = useWebLibraryStore.getState()
    expect(state.collections).toHaveLength(0)
    expect(state.documents).toHaveLength(1)
  })

  it('increments paperCount on add and decrements (floored at 0) on remove', async () => {
    const { useWebLibraryStore } = await import('./webLibraryStore')
    useWebLibraryStore.setState({ collections: [collection({ paperCount: 0 })] })
    mocks.addToCollection.mockResolvedValue(undefined)
    mocks.removeFromCollection.mockResolvedValue(undefined)

    await useWebLibraryStore.getState().addToCollection('col-1', 'doc-1')
    expect(useWebLibraryStore.getState().collections[0].paperCount).toBe(1)

    await useWebLibraryStore.getState().removeFromCollection('col-1', 'doc-1')
    expect(useWebLibraryStore.getState().collections[0].paperCount).toBe(0)

    // A second remove (e.g. a stale double-click) must never go negative.
    await useWebLibraryStore.getState().removeFromCollection('col-1', 'doc-1')
    expect(useWebLibraryStore.getState().collections[0].paperCount).toBe(0)
  })
})
