import { create } from 'zustand'

interface EditorFlushStore {
  /** Set by the mounted DocumentEditorPage; null when no editor is mounted. */
  flush: (() => void | Promise<void>) | null
  register: (fn: () => void | Promise<void>) => void
  unregister: () => void
}

// Single shared owner of "how to safely leave the editor" — DocumentEditorPage
// registers its flush-pending-save closure here on mount and clears it on
// unmount, so the global "Documents" breadcrumb (rendered a level up, in
// AppNavbar, with no access to the editor's own state) can reuse the exact
// same flush instead of a second, divergent copy of the save logic.
//
// Read via getState() at click-time, not the reactive hook — nothing selects
// `flush` through useEditorFlushStore(s => s.flush), so registering/
// unregistering never re-renders AppNavbar or anything else.
export const useEditorFlushStore = create<EditorFlushStore>((set) => ({
  flush: null,
  register: (fn) => set({ flush: fn }),
  unregister: () => set({ flush: null }),
}))
