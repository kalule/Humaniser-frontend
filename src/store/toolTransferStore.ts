import { create } from 'zustand'

interface ToolTransferState {
  text: string | null
  source: string | null
  setTransfer: (text: string, source: string) => void
  clearTransfer: () => void
}

export const useToolTransferStore = create<ToolTransferState>((set) => ({
  text: null,
  source: null,
  setTransfer: (text, source) => set({ text, source }),
  clearTransfer: () => set({ text: null, source: null }),
}))
