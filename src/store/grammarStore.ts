import { create } from 'zustand'
import type { GrammarCheckResponse, GrammarContext, GrammarLanguage, ErrorCategory } from '../types/grammar'

const ALL_CATEGORIES: ErrorCategory[] = [
  'Spelling', 'Grammar', 'Punctuation', 'Style', 'Clarity', 'Conciseness', 'Consistency', 'Tone'
]

interface GrammarStore {
  inputText: string;
  context: GrammarContext;
  language: GrammarLanguage;
  enabledCategories: ErrorCategory[];
  isLoading: boolean;
  error: string | null;
  result: GrammarCheckResponse | null;

  setInputText: (text: string) => void;
  setContext: (ctx: GrammarContext) => void;
  setLanguage: (lang: GrammarLanguage) => void;
  toggleCategory: (cat: ErrorCategory) => void;
  setEnabledCategories: (cats: ErrorCategory[]) => void;
  setLoading: (v: boolean) => void;
  setError: (err: string | null) => void;
  setResult: (result: GrammarCheckResponse | null) => void;
  reset: () => void;
}

export const useGrammarStore = create<GrammarStore>((set) => ({
  inputText: '',
  context: 'General',
  language: 'AmericanEnglish',
  enabledCategories: ALL_CATEGORIES,
  isLoading: false,
  error: null,
  result: null,

  setInputText: (text) => set({ inputText: text }),
  setContext: (context) => set({ context }),
  setLanguage: (language) => set({ language }),
  toggleCategory: (cat) => set((s) => ({
    enabledCategories: s.enabledCategories.includes(cat)
      ? s.enabledCategories.filter((c) => c !== cat)
      : [...s.enabledCategories, cat]
  })),
  setEnabledCategories: (enabledCategories) => set({ enabledCategories }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setResult: (result) => set({ result }),
  reset: () => set({ result: null, error: null }),
}))
