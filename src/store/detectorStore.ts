import { create } from 'zustand'
import type { DetectResponse } from '../types/detector'

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

interface DetectorState {
  inputText: string
  result: DetectResponse | null
  isLoading: boolean
  error: string | null
  wordCount: number
  setInputText: (text: string) => void
  setResult: (result: DetectResponse | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
}

export const useDetectorStore = create<DetectorState>((set) => ({
  inputText: '',
  result: null,
  isLoading: false,
  error: null,
  wordCount: 0,

  setInputText: (text) => set({ inputText: text, wordCount: countWords(text) }),
  setResult: (result) => set({ result }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  reset: () => set({
    inputText: '',
    result: null,
    isLoading: false,
    error: null,
    wordCount: 0,
  }),
}))
