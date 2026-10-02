import { create } from 'zustand'
import type { DocumentGenre } from '../types/library'
import type { FormatStyle } from '../types/citation'

export interface PendingDraft {
  documentId:    string
  topic:         string
  documentType:  DocumentGenre
  citationStyle: FormatStyle
}

interface DraftHandoffStore {
  pending: PendingDraft | null
  setPending: (draft: PendingDraft) => void
  /** Reads and clears in one step — the editor should only ever auto-open the AI modal once per handoff. */
  consume: (documentId: string) => PendingDraft | null
}

// New-document creation card (prompt #3), "Create with draft" path. The creation card creates
// the document and navigates straight to its editor — it doesn't call workbenchApi.writeWithAi
// itself, since the response is turned into document content by DocumentEditorPage's
// handleAiGenerated (citation-token resolution, per-archetype section rendering, ~150 lines tied
// to that page's own live TipTap instance). Duplicating that here would mean two implementations
// of the same rendering logic drifting apart. Instead this store just carries the prompt across
// the navigation; DocumentEditorPage consumes it on mount and opens WriteWithAiModal pre-filled,
// reusing the entire existing generation pipeline untouched — the user's only remaining step is
// clicking "Generate" inside the modal they already saw once in the creation card.
export const useDraftHandoffStore = create<DraftHandoffStore>((set, get) => ({
  pending: null,
  setPending: (draft) => set({ pending: draft }),
  consume: (documentId) => {
    const current = get().pending
    if (!current || current.documentId !== documentId) return null
    set({ pending: null })
    return current
  },
}))
