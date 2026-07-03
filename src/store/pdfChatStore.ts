import { create } from 'zustand'
import type { DocChatDocument, DocChatMessage } from '../types/pdfChat'

interface PdfChatStore {
  document:    DocChatDocument | null
  messages:    DocChatMessage[]
  isIngesting: boolean
  isQuerying:  boolean
  pdfFileUrl:  string | null

  setDocument:    (doc: DocChatDocument | null) => void
  updateDocument: (patch: Partial<DocChatDocument>) => void
  addMessage:     (msg: DocChatMessage) => void
  updateMessage:  (id: string, patch: Partial<DocChatMessage>) => void
  setIngesting:   (v: boolean) => void
  setQuerying:    (v: boolean) => void
  setPdfFileUrl:  (url: string | null) => void
  reset:          () => void
}

export const usePdfChatStore = create<PdfChatStore>((set) => ({
  document:    null,
  messages:    [],
  isIngesting: false,
  isQuerying:  false,
  pdfFileUrl:  null,

  setDocument: (document) => set({ document }),

  updateDocument: (patch) =>
    set((s) => (s.document ? { document: { ...s.document, ...patch } } : {})),

  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, msg] })),

  updateMessage: (id, patch) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })),

  setIngesting:  (isIngesting) => set({ isIngesting }),
  setQuerying:   (isQuerying)  => set({ isQuerying }),
  setPdfFileUrl: (pdfFileUrl)  => set({ pdfFileUrl }),

  reset: () => set({
    document: null, messages: [], isIngesting: false, isQuerying: false, pdfFileUrl: null,
  }),
}))
