import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SummariseMode, SummariseLength, SummariseResponse } from '../types/summarise'

interface SummariseState {
  inputText: string
  selectedMode: SummariseMode
  selectedLength: SummariseLength
  isLoading: boolean
  error: string | null
  result: SummariseResponse | null

  setInputText:    (t: string) => void
  setMode:         (m: SummariseMode) => void
  setLength:       (l: SummariseLength) => void
  setLoading:      (v: boolean) => void
  setError:        (e: string | null) => void
  setResult:       (r: SummariseResponse) => void
  reset:           () => void
}

const initial = {
  inputText:      '',
  selectedMode:   'KeyPoints' as SummariseMode,
  selectedLength: 'medium'    as SummariseLength,
  isLoading:      false,
  error:          null,
  result:         null,
}

// Mode and length are remembered across sessions (and survive Clear): people
// who summarise the same kind of document repeat the same settings every time.
// Text, results and loading state are deliberately not persisted.
export const useSummariseStore = create<SummariseState>()(
  persist(
    (set, get) => ({
      ...initial,
      setInputText: (t) => set({ inputText: t }),
      setMode:      (m) => set({ selectedMode: m }),
      setLength:    (l) => set({ selectedLength: l }),
      setLoading:   (v) => set({ isLoading: v }),
      setError:     (e) => set({ error: e }),
      setResult:    (r) => set({ result: r }),
      reset:        ()  => set({
        ...initial,
        selectedMode: get().selectedMode,
        selectedLength: get().selectedLength,
      }),
    }),
    {
      name: 'summarise-prefs',
      partialize: (s) => ({ selectedMode: s.selectedMode, selectedLength: s.selectedLength }),
    },
  ),
)
