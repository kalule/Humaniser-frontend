import { create } from 'zustand'
import type { ParaphraseMode, ParaphraseStrength, ParaphraseResponse } from '../types/paraphrase'

interface ParaphraseState {
  inputText: string
  outputText: string
  selectedMode: ParaphraseMode
  selectedStrength: ParaphraseStrength
  isLoading: boolean
  error: string | null
  lastResponse: ParaphraseResponse | null

  setInputText: (t: string) => void
  setMode: (m: ParaphraseMode) => void
  setStrength: (s: ParaphraseStrength) => void
  setLoading: (v: boolean) => void
  setError: (e: string | null) => void
  setLastResponse: (r: ParaphraseResponse) => void
  reset: () => void
}

const initial = {
  inputText:        '',
  outputText:       '',
  selectedMode:     'Standard' as ParaphraseMode,
  selectedStrength: 'medium' as ParaphraseStrength,
  isLoading:        false,
  error:            null,
  lastResponse:     null,
}

export const useParaphraseStore = create<ParaphraseState>((set) => ({
  ...initial,
  setInputText:    (t) => set({ inputText: t }),
  setMode:         (m) => set({ selectedMode: m }),
  setStrength:     (s) => set({ selectedStrength: s }),
  setLoading:      (v) => set({ isLoading: v }),
  setError:        (e) => set({ error: e }),
  setLastResponse: (r) => set({ lastResponse: r, outputText: r.paraphrasedText }),
  reset:           ()  => set(initial),
}))
