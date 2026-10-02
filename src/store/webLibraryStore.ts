import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import toast from 'react-hot-toast'
import { webLibraryApi } from '../api/webLibrary'
import type { ResearchDocument, LibraryFolder, ColumnKey, PaperSearchResult, Collection } from '../types/webLibrary'

const TRASH = '__trash__'

interface WebLibraryStore {
  documents:  ResearchDocument[]
  folders:    LibraryFolder[]
  isLoading:  boolean
  hasLoaded:  boolean
  // The only field that's genuinely a UI preference, not user content — persisted below.
  visibleColumns: ColumnKey[]

  loadDocuments: () => Promise<void>
  addDocument:   (doc: Partial<ResearchDocument>) => Promise<ResearchDocument>
  updateDocument: (id: string, patch: Partial<ResearchDocument>) => Promise<ResearchDocument>
  deleteDocument: (id: string) => Promise<void>
  trashDocument:  (id: string) => Promise<ResearchDocument>

  createFolder: (name: string) => Promise<LibraryFolder>
  deleteFolder: (id: string) => Promise<void>
  renameFolder: (id: string, name: string) => Promise<void>

  addColumn:      (key: ColumnKey) => void
  removeColumn:   (key: ColumnKey) => void
  reorderColumns: (keys: ColumnKey[]) => void

  // ── Find Papers (search) — transient, never persisted ──────────────────────
  searchQuery:   string
  searchResults: PaperSearchResult[]
  isSearching:   boolean
  searchError:   string | null
  searchPapers:  (query: string) => Promise<void>
  clearSearch:   () => void
  /** Optimistic: flips isSaved on the matching search result immediately, rolls back on failure. */
  saveFromSearch: (result: PaperSearchResult) => Promise<ResearchDocument>
  /** Patches a search result's collectionIds locally after batch add/remove calls elsewhere have
   *  already updated the server — keeps the Find Papers list in sync without a re-search. */
  setSearchResultCollections: (canonicalId: string, collectionIds: string[]) => void

  // ── Research Collections ────────────────────────────────────────────────────
  collections:         Collection[]
  collectionsLoaded:   boolean
  loadCollections:     () => Promise<void>
  createCollection:    (name: string, description?: string) => Promise<Collection>
  updateCollection:    (id: string, name: string, description?: string) => Promise<Collection>
  deleteCollection:    (id: string) => Promise<void>
  addToCollection:     (collectionId: string, documentId: string) => Promise<void>
  removeFromCollection: (collectionId: string, documentId: string) => Promise<void>

  /** Resets in-memory content on logout — documents now live server-side, not in localStorage. */
  clear: () => void
}

const DEFAULTS: Omit<ResearchDocument, 'id' | 'createdAt' | 'updatedAt'> = {
  title:   'Untitled',
  authors: [],
  docType: 'Journal Article',
  tags:    [],
  folderId: null,
}

function toPayload(doc: Partial<ResearchDocument> & typeof DEFAULTS) {
  return {
    title:       doc.title,
    authors:     doc.authors,
    docType:     doc.docType,
    year:        doc.year,
    journal:     doc.journal,
    filePath:    doc.filePath,
    isFullText:  doc.isFullText ?? false,
    tldr:        doc.tldr,
    conclusions: doc.conclusions,
    abstract:    doc.abstract,
    results:     doc.results,
    intro:       doc.intro,
    methodology: doc.methodology,
    limitations: doc.limitations,
    literature:  doc.literature,
    tags:        doc.tags,
    folderId:    doc.folderId,
  }
}

export const useWebLibraryStore = create<WebLibraryStore>()(
  persist(
    (set, get) => ({
      documents: [],
      folders:   [],
      isLoading: false,
      hasLoaded: false,
      visibleColumns: ['tldr', 'conclusions'],

      searchQuery:   '',
      searchResults: [],
      isSearching:   false,
      searchError:   null,

      collections:       [],
      collectionsLoaded: false,

      loadDocuments: async () => {
        set({ isLoading: true })
        try {
          const [documents, folders] = await Promise.all([
            webLibraryApi.getDocuments(),
            webLibraryApi.getFolders(),
          ])
          set({ documents, folders, isLoading: false, hasLoaded: true })
        } catch {
          set({ isLoading: false })
          toast.error('Could not load your web library — please refresh and try again.')
        }
      },

      addDocument: async (patch = {}) => {
        const merged = { ...DEFAULTS, ...patch }
        try {
          const doc = await webLibraryApi.saveDocument(toPayload(merged))
          set(s => ({ documents: [doc, ...s.documents] }))
          return doc
        } catch (err) {
          toast.error('Could not add the document — please try again.')
          throw err
        }
      },

      updateDocument: async (id, patch) => {
        const current = get().documents.find(d => d.id === id)
        if (!current) throw new Error(`updateDocument: document ${id} not found in local state`)

        const merged = { ...current, ...patch }
        try {
          const doc = await webLibraryApi.saveDocument({ id, ...toPayload(merged) })
          set(s => ({ documents: s.documents.map(d => (d.id === id ? doc : d)) }))
          return doc
        } catch (err) {
          toast.error('Could not save your changes — please try again.')
          throw err
        }
      },

      deleteDocument: async (id) => {
        try {
          await webLibraryApi.deleteDocument(id)
          set(s => ({ documents: s.documents.filter(d => d.id !== id) }))
        } catch (err) {
          toast.error('Could not delete the document — please try again.')
          throw err
        }
      },

      trashDocument: (id) => get().updateDocument(id, { folderId: TRASH }),

      createFolder: async (name) => {
        try {
          const folder = await webLibraryApi.createFolder(name)
          set(s => ({ folders: [folder, ...s.folders] }))
          return folder
        } catch (err) {
          toast.error('Could not create the folder — please try again.')
          throw err
        }
      },

      deleteFolder: async (id) => {
        try {
          await webLibraryApi.deleteFolder(id)
          set(s => ({
            folders:   s.folders.filter(f => f.id !== id),
            documents: s.documents.map(d => (d.folderId === id ? { ...d, folderId: null } : d)),
          }))
        } catch (err) {
          toast.error('Could not delete the folder — please try again.')
          throw err
        }
      },

      renameFolder: async (id, name) => {
        try {
          const folder = await webLibraryApi.renameFolder(id, name)
          set(s => ({ folders: s.folders.map(f => (f.id === id ? folder : f)) }))
        } catch (err) {
          toast.error('Could not rename the folder — please try again.')
          throw err
        }
      },

      addColumn: (key) =>
        set(s => ({
          visibleColumns: s.visibleColumns.includes(key)
            ? s.visibleColumns
            : [...s.visibleColumns, key],
        })),

      removeColumn: (key) =>
        set(s => ({
          visibleColumns: s.visibleColumns.filter(k => k !== key),
        })),

      reorderColumns: (keys) => set(() => ({ visibleColumns: keys })),

      // ── Find Papers (search) ─────────────────────────────────────────────────

      searchPapers: async (query) => {
        set({ isSearching: true, searchError: null, searchQuery: query })
        try {
          const response = await webLibraryApi.searchPapers(query)
          set({ searchResults: response.results, isSearching: false })
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Search failed — please try again.'
          set({ isSearching: false, searchResults: [], searchError: message })
        }
      },

      clearSearch: () => set({ searchQuery: '', searchResults: [], searchError: null }),

      setSearchResultCollections: (canonicalId, collectionIds) =>
        set(s => ({
          searchResults: s.searchResults.map(r =>
            r.canonicalId === canonicalId ? { ...r, collectionIds } : r),
        })),

      saveFromSearch: async (result) => {
        set(s => ({
          searchResults: s.searchResults.map(r =>
            r.canonicalId === result.canonicalId ? { ...r, isSaved: true } : r),
        }))
        try {
          const doc = await webLibraryApi.saveFromSearch({
            canonicalId:    result.canonicalId,
            openAlexWorkId: result.openAlexWorkId,
            doi:            result.doi,
            title:          result.title,
            authors:        result.authors,
            year:           result.year,
            journal:        result.journal,
            abstract:       result.abstract,
            citationCount:  result.citationCount,
          })
          set(s => ({
            documents: s.documents.some(d => d.id === doc.id) ? s.documents : [doc, ...s.documents],
            searchResults: s.searchResults.map(r =>
              r.canonicalId === result.canonicalId ? { ...r, isSaved: true, savedDocumentId: doc.id } : r),
          }))
          return doc
        } catch (err) {
          set(s => ({
            searchResults: s.searchResults.map(r =>
              r.canonicalId === result.canonicalId ? { ...r, isSaved: false } : r),
          }))
          toast.error('Could not save this paper — please try again.')
          throw err
        }
      },

      // ── Research Collections ─────────────────────────────────────────────────

      loadCollections: async () => {
        try {
          const collections = await webLibraryApi.getCollections()
          set({ collections, collectionsLoaded: true })
        } catch {
          toast.error('Could not load your collections — please refresh and try again.')
        }
      },

      createCollection: async (name, description) => {
        try {
          const collection = await webLibraryApi.createCollection(name, description)
          set(s => ({ collections: [collection, ...s.collections] }))
          return collection
        } catch (err) {
          toast.error('Could not create the collection — please try again.')
          throw err
        }
      },

      updateCollection: async (id, name, description) => {
        try {
          const collection = await webLibraryApi.updateCollection(id, name, description)
          set(s => ({ collections: s.collections.map(c => (c.id === id ? collection : c)) }))
          return collection
        } catch (err) {
          toast.error('Could not update the collection — please try again.')
          throw err
        }
      },

      deleteCollection: async (id) => {
        try {
          await webLibraryApi.deleteCollection(id)
          set(s => ({ collections: s.collections.filter(c => c.id !== id) }))
        } catch (err) {
          toast.error('Could not delete the collection — please try again.')
          throw err
        }
      },

      addToCollection: async (collectionId, documentId) => {
        try {
          await webLibraryApi.addToCollection(collectionId, documentId)
          set(s => ({
            collections: s.collections.map(c =>
              c.id === collectionId ? { ...c, paperCount: c.paperCount + 1 } : c),
          }))
        } catch (err) {
          toast.error('Could not add this paper to the collection — please try again.')
          throw err
        }
      },

      removeFromCollection: async (collectionId, documentId) => {
        try {
          await webLibraryApi.removeFromCollection(collectionId, documentId)
          set(s => ({
            collections: s.collections.map(c =>
              c.id === collectionId ? { ...c, paperCount: Math.max(0, c.paperCount - 1) } : c),
          }))
        } catch (err) {
          toast.error('Could not remove this paper from the collection — please try again.')
          throw err
        }
      },

      clear: () => set({
        documents: [], folders: [], isLoading: false, hasLoaded: false,
        searchQuery: '', searchResults: [], isSearching: false, searchError: null,
        collections: [], collectionsLoaded: false,
      }),
    }),
    {
      name: 'humanise-web-library-prefs',
      // Only the column layout preference persists locally — documents/folders are
      // API-backed now (see loadDocuments) and must never be cached across accounts.
      partialize: (state) => ({ visibleColumns: state.visibleColumns }),
    },
  ),
)

// The old client-only store shipped hardcoded seed documents to every browser — never
// migrate those, only real user-created ones.
const LEGACY_SEED_IDS = new Set(['doc-seed-1', 'doc-seed-2'])

// ── One-time localStorage → API migration ────────────────────────────────────
export async function migrateLocalWebLibraryIfPresent(userId: string): Promise<void> {
  const migratedFlagKey = `web-library-migrated:${userId}`
  if (localStorage.getItem(migratedFlagKey) === 'true') return

  const legacyKey = 'humanise-web-library'
  const raw = localStorage.getItem(legacyKey)

  if (!raw) {
    localStorage.setItem(migratedFlagKey, 'true')
    return
  }

  try {
    const parsed = JSON.parse(raw) as { state?: { documents?: ResearchDocument[]; folders?: LibraryFolder[] } }
    const oldDocuments = (parsed.state?.documents ?? []).filter(d => !LEGACY_SEED_IDS.has(d.id))
    const oldFolders   = parsed.state?.folders ?? []

    const folderIdMap = new Map<string, string>()
    for (const folder of oldFolders) {
      const created = await webLibraryApi.createFolder(folder.name)
      folderIdMap.set(folder.id, created.id)
    }

    if (oldDocuments.length > 0) {
      await webLibraryApi.importDocuments(oldDocuments.map(d => ({
        title:       d.title || 'Untitled',
        authors:     d.authors ?? [],
        docType:     d.docType ?? 'Journal Article',
        year:        d.year,
        journal:     d.journal,
        filePath:    d.filePath,
        isFullText:  !!d.isFullText,
        tldr:        d.tldr,
        conclusions: d.conclusions,
        abstract:    d.abstract,
        results:     d.results,
        intro:       d.intro,
        methodology: d.methodology,
        limitations: d.limitations,
        literature:  d.literature,
        tags:        d.tags ?? [],
        folderId:    d.folderId === '__trash__' ? '__trash__' : (d.folderId ? (folderIdMap.get(d.folderId) ?? null) : null),
      })))
    }

    localStorage.removeItem(legacyKey)
    localStorage.setItem(migratedFlagKey, 'true')
  } catch {
    // Don't set the flag — retry on next login instead of losing data silently.
  }
}
