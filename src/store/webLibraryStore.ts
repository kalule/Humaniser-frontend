import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import toast from 'react-hot-toast'
import { webLibraryApi } from '../api/webLibrary'
import type { ResearchDocument, LibraryFolder, ColumnKey } from '../types/webLibrary'

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

      clear: () => set({ documents: [], folders: [], isLoading: false, hasLoaded: false }),
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
