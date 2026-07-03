import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type { StudioDocument, StudioType, WizardMode } from '../types/studio'

interface StudioStore {
  documents: StudioDocument[]
  createDocument: (opts: {
    title?:      string
    studioType?: StudioType
    wizardMode:  WizardMode
    linkedEditorId?: string
  }) => StudioDocument
  updateDocument: (id: string, patch: Partial<StudioDocument>) => void
  deleteDocument: (id: string) => void
}

const now = () => new Date().toISOString()

export const useStudioStore = create<StudioStore>()(
  persist(
    (set) => ({
      documents: [],

      createDocument: ({ title = 'Untitled Proposal', studioType = 'GENERATOR', wizardMode, linkedEditorId = null }) => {
        const doc: StudioDocument = {
          id: nanoid(),
          title,
          studioType,
          wizardMode,
          linkedEditorId,
          updatedAt: now(),
          createdAt: now(),
        }
        set(s => ({ documents: [doc, ...s.documents] }))
        return doc
      },

      updateDocument: (id, patch) =>
        set(s => ({
          documents: s.documents.map(d =>
            d.id === id ? { ...d, ...patch, updatedAt: now() } : d,
          ),
        })),

      deleteDocument: (id) =>
        set(s => ({ documents: s.documents.filter(d => d.id !== id) })),
    }),
    { name: 'humanise-studio' },
  ),
)
