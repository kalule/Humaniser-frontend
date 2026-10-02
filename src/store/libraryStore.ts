import { create } from 'zustand'
import toast from 'react-hot-toast'
import { libraryApi } from '../api/library'
import type { WorkspaceDocument, WorkspaceFolder } from '../types/library'

interface LibraryStore {
  documents:  WorkspaceDocument[]
  folders:    WorkspaceFolder[]
  isLoading:  boolean
  hasLoaded:  boolean

  loadDocuments: () => Promise<void>
  createDocument: (patch?: Partial<WorkspaceDocument>) => Promise<WorkspaceDocument>
  updateDocument: (id: string, patch: Partial<WorkspaceDocument>) => Promise<WorkspaceDocument>
  deleteDocument: (id: string) => Promise<void>

  createFolder: (name: string) => Promise<WorkspaceFolder>
  deleteFolder: (id: string) => Promise<void>
  renameFolder: (id: string, name: string) => Promise<void>

  /** Resets in-memory state on logout — documents now live server-side, not in localStorage. */
  clear: () => void
}

const DEFAULTS: Omit<WorkspaceDocument, 'id' | 'createdAt' | 'updatedAt'> = {
  title:    'Untitled document',
  content:  '',
  type:     'doc',
  isPdf:    false,
  folderId: null,
}

export const useLibraryStore = create<LibraryStore>()((set, get) => ({
  documents: [],
  folders:   [],
  isLoading: false,
  hasLoaded: false,

  loadDocuments: async () => {
    set({ isLoading: true })
    try {
      const [documents, folders] = await Promise.all([
        libraryApi.getDocuments(),
        libraryApi.getFolders(),
      ])
      set({ documents, folders, isLoading: false, hasLoaded: true })
    } catch {
      set({ isLoading: false })
      toast.error('Could not load your library — please refresh and try again.')
    }
  },

  createDocument: async (patch = {}) => {
    const merged = { ...DEFAULTS, ...patch }
    try {
      const doc = await libraryApi.saveDocument({
        title:    merged.title,
        content:  merged.content,
        filePath: merged.filePath,
        type:     merged.type,
        folderId: merged.folderId,
        isPdf:    merged.isPdf,
        citationStyle: merged.citationStyle,
        documentType:  merged.documentType,
        // Lets the server collapse a double-clicked "New"/"Create" or a retried request onto the
        // same row instead of inserting a duplicate — see SaveDocumentPayload's doc comment.
        clientRequestId: crypto.randomUUID(),
      })
      set(s => ({ documents: [doc, ...s.documents] }))
      return doc
    } catch (err) {
      toast.error('Could not create the document — please try again.')
      throw err
    }
  },

  updateDocument: async (id, patch) => {
    const current = get().documents.find(d => d.id === id)
    if (!current) throw new Error(`updateDocument: document ${id} not found in local state`)

    const merged = { ...current, ...patch }
    try {
      const doc = await libraryApi.saveDocument({
        id,
        title:    merged.title,
        content:  merged.content,
        filePath: merged.filePath,
        type:     merged.type,
        folderId: merged.folderId,
        isPdf:    merged.isPdf,
        // Full-replace, same as title/type above — forwarding merged's value so a patch that
        // doesn't touch these (e.g. a content-only autosave) carries the existing value forward
        // instead of clearing it.
        citationStyle: merged.citationStyle,
        documentType:  merged.documentType,
        // PR20 — forwarding merged's value (not re-deriving it) keeps this a no-op for normal
        // edits: patch objects for title/content changes never set workbenchGenerationAuditId, so
        // merged just carries forward whatever current already had (undefined until
        // handleAiGenerated's one stamping call, its returned value from then on).
        workbenchGenerationAuditId: merged.workbenchGenerationAuditId,
      })
      set(s => ({ documents: s.documents.map(d => (d.id === id ? doc : d)) }))
      return doc
    } catch (err) {
      toast.error('Could not save your changes — please try again.')
      throw err
    }
  },

  deleteDocument: async (id) => {
    try {
      await libraryApi.deleteDocument(id)
      set(s => ({ documents: s.documents.filter(d => d.id !== id) }))
    } catch (err) {
      toast.error('Could not delete the document — please try again.')
      throw err
    }
  },

  createFolder: async (name) => {
    try {
      const folder = await libraryApi.createFolder(name)
      set(s => ({ folders: [folder, ...s.folders] }))
      return folder
    } catch (err) {
      toast.error('Could not create the folder — please try again.')
      throw err
    }
  },

  deleteFolder: async (id) => {
    try {
      await libraryApi.deleteFolder(id)
      set(s => ({
        folders:   s.folders.filter(f => f.id !== id),
        // Server sets FolderId to null via FK on delete — mirror that locally too.
        documents: s.documents.map(d => (d.folderId === id ? { ...d, folderId: null } : d)),
      }))
    } catch (err) {
      toast.error('Could not delete the folder — please try again.')
      throw err
    }
  },

  renameFolder: async (id, name) => {
    try {
      const folder = await libraryApi.renameFolder(id, name)
      set(s => ({ folders: s.folders.map(f => (f.id === id ? folder : f)) }))
    } catch (err) {
      toast.error('Could not rename the folder — please try again.')
      throw err
    }
  },

  clear: () => set({ documents: [], folders: [], isLoading: false, hasLoaded: false }),
}))

// ── One-time localStorage → API migration ────────────────────────────────────
//
// Documents used to live in localStorage (first as a single shared key, later
// namespaced per-user as `humanise-library:{userId}` after an earlier fix for
// cross-account leakage). Now that they live server-side, carry over whatever's
// still sitting in this browser the first time each account logs in post-deploy,
// then retire the local copy. Gated by a per-user flag so it only ever runs once
// — and left un-set on failure so a flaky request gets retried on next login
// rather than silently losing the import.
export async function migrateLocalLibraryIfPresent(userId: string): Promise<void> {
  const migratedFlagKey = `library-migrated:${userId}`
  if (localStorage.getItem(migratedFlagKey) === 'true') return

  const userKey = `humanise-library:${userId}`
  const legacyKey = 'humanise-library'
  const raw = localStorage.getItem(userKey) ?? localStorage.getItem(legacyKey)

  if (!raw) {
    localStorage.setItem(migratedFlagKey, 'true')
    return
  }

  try {
    const parsed = JSON.parse(raw) as { state?: { documents?: WorkspaceDocument[]; folders?: WorkspaceFolder[] } }
    const oldDocuments = parsed.state?.documents ?? []
    const oldFolders   = parsed.state?.folders ?? []

    // Recreate folders first so documents can be remapped onto their real server ids —
    // the old ids were client-generated nanoids with no meaning to the API.
    const folderIdMap = new Map<string, string>()
    for (const folder of oldFolders) {
      const created = await libraryApi.createFolder(folder.name)
      folderIdMap.set(folder.id, created.id)
    }

    if (oldDocuments.length > 0) {
      await libraryApi.importDocuments(oldDocuments.map(d => ({
        title:    d.title || 'Untitled document',
        content:  d.content ?? '',
        filePath: d.filePath,
        type:     d.type ?? 'doc',
        folderId: d.folderId ? (folderIdMap.get(d.folderId) ?? null) : null,
        isPdf:    !!d.isPdf,
      })))
    }

    localStorage.removeItem(userKey)
    localStorage.removeItem(legacyKey)
    localStorage.setItem(migratedFlagKey, 'true')
  } catch {
    // Don't set the flag — retry on next login instead of losing data silently.
  }
}
