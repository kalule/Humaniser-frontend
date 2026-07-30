import { create } from 'zustand'
import type { PlagiarismResponse } from '../types/plagiarism'

interface PlagiarismState {
  inputText: string
  isLoading: boolean
  error: string | null
  result: PlagiarismResponse | null
  loadingStage: string
  /** The exact text the current `result` was generated from — lets the UI detect a stale/unchanged re-check. */
  lastCheckedText: string | null

  setInputText: (t: string) => void
  setLoading: (v: boolean, stage?: string) => void
  setError: (e: string | null) => void
  setResult: (r: PlagiarismResponse, checkedText: string) => void
  reset: () => void
}

const initial = {
  inputText:       '',
  isLoading:       false,
  error:           null,
  result:          null,
  loadingStage:    '',
  lastCheckedText: null,
}

export const usePlagiarismStore = create<PlagiarismState>((set) => ({
  ...initial,
  setInputText: (t) => set({ inputText: t }),
  setLoading:   (v, stage = '') => set({ isLoading: v, loadingStage: stage }),
  setError:     (e) => set({ error: e }),
  setResult:    (r, checkedText) => set({ result: r, lastCheckedText: checkedText }),
  reset:        ()  => set(initial),
}))
