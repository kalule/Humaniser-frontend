import { create } from 'zustand'
import type { Tone, Strength, HumaniseResponse } from '../types'

interface HumaniserState {
  inputText: string
  outputText: string
  selectedTone: Tone
  selectedStrength: Strength
  isLoading: boolean
  error: string | null
  lastResponse: HumaniseResponse | null

  setInputText: (text: string) => void
  setOutputText: (text: string) => void
  setTone: (tone: Tone) => void
  setStrength: (strength: Strength) => void
  setLoading: (v: boolean) => void
  setError: (e: string | null) => void
  setLastResponse: (r: HumaniseResponse) => void
  reset: () => void
}

const initialState = {
  inputText: '',
  outputText: '',
  selectedTone: 'casual' as Tone,
  selectedStrength: 'medium' as Strength,
  isLoading: false,
  error: null,
  lastResponse: null,
}

export const useHumaniserStore = create<HumaniserState>((set) => ({
  ...initialState,

  setInputText: (text: string) => set({ inputText: text }),

  setOutputText: (text: string) => set({ outputText: text }),

  setTone: (tone: Tone) => set({ selectedTone: tone }),

  setStrength: (strength: Strength) => set({ selectedStrength: strength }),

  setLoading: (v: boolean) => set({ isLoading: v }),

  setError: (e: string | null) => set({ error: e }),

  setLastResponse: (r: HumaniseResponse) =>
    set({ lastResponse: r, outputText: r.humanisedText }),

  reset: () => set(initialState),
}))
