import { create } from 'zustand'
import toast from 'react-hot-toast'
import { studioApi } from '../api/studio'
import type { StudioDocument, StudioType, WizardMode } from '../types/studio'

interface StudioStore {
  documents: StudioDocument[]
  isLoading: boolean
  hasLoaded: boolean

  loadDocuments: () => Promise<void>
  createDocument: (opts: {
    title?:          string
    studioType?:     StudioType
    wizardMode:      WizardMode
    linkedEditorId?: string | null
  }) => Promise<StudioDocument>
  updateDocument: (id: string, patch: Partial<StudioDocument>) => Promise<StudioDocument>
  deleteDocument: (id: string) => Promise<void>

  /** Resets in-memory state on logout — workspaces now live server-side, not in localStorage. */
  clear: () => void
}

export const useStudioStore = create<StudioStore>()((set, get) => ({
  documents: [],
  isLoading: false,
  hasLoaded: false,

  loadDocuments: async () => {
    set({ isLoading: true })
    try {
      const documents = await studioApi.getDocuments()
      set({ documents, isLoading: false, hasLoaded: true })
    } catch {
      set({ isLoading: false })
      toast.error('Could not load your Proposal Studio workspaces — please refresh and try again.')
    }
  },

  createDocument: async ({ title = 'Untitled Proposal', studioType = 'GENERATOR', wizardMode, linkedEditorId = null }) => {
    try {
      const doc = await studioApi.saveDocument({ title, studioType, wizardMode, linkedEditorId })
      set(s => ({ documents: [doc, ...s.documents] }))
      return doc
    } catch (err) {
      toast.error('Could not create the workspace — please try again.')
      throw err
    }
  },

  updateDocument: async (id, patch) => {
    const current = get().documents.find(d => d.id === id)
    if (!current) throw new Error(`updateDocument: studio document ${id} not found in local state`)

    const merged = { ...current, ...patch }
    try {
      const doc = await studioApi.saveDocument({
        id,
        title:          merged.title,
        studioType:     merged.studioType,
        wizardMode:     merged.wizardMode,
        linkedEditorId: merged.linkedEditorId,
      })
      set(s => ({ documents: s.documents.map(d => (d.id === id ? doc : d)) }))
      return doc
    } catch (err) {
      toast.error('Could not save the workspace — please try again.')
      throw err
    }
  },

  deleteDocument: async (id) => {
    try {
      await studioApi.deleteDocument(id)
      set(s => ({ documents: s.documents.filter(d => d.id !== id) }))
    } catch (err) {
      toast.error('Could not delete the workspace — please try again.')
      throw err
    }
  },

  clear: () => set({ documents: [], isLoading: false, hasLoaded: false }),
}))

// ── One-time localStorage → API migration ────────────────────────────────────
export async function migrateLocalStudioIfPresent(userId: string): Promise<void> {
  const migratedFlagKey = `studio-migrated:${userId}`
  if (localStorage.getItem(migratedFlagKey) === 'true') return

  const legacyKey = 'humanise-studio'
  const raw = localStorage.getItem(legacyKey)

  if (!raw) {
    localStorage.setItem(migratedFlagKey, 'true')
    return
  }

  try {
    const parsed = JSON.parse(raw) as { state?: { documents?: StudioDocument[] } }
    const oldDocuments = parsed.state?.documents ?? []

    // Batched via a single transactional call — a loop of individual saves would leave
    // successfully-created rows behind on a mid-migration failure, then duplicate them on
    // retry (the flag never gets set, so the next login re-runs the whole thing).
    //
    // linkedEditorId is deliberately dropped: it pointed at the old client-only
    // libraryStore's nanoid ids, which no longer exist now that library documents are
    // server-issued GUIDs. Reopening the workspace just creates a fresh linked document
    // (see ProposalStudioPage's open() fallback) rather than carrying over a dangling ref.
    if (oldDocuments.length > 0) {
      await studioApi.importDocuments(oldDocuments.map(d => ({
        title:      d.title || 'Untitled Proposal',
        studioType: d.studioType ?? 'GENERATOR',
        wizardMode: d.wizardMode,
      })))
    }

    localStorage.removeItem(legacyKey)
    localStorage.setItem(migratedFlagKey, 'true')
  } catch {
    // Don't set the flag — retry on next login instead of losing data silently.
  }
}
