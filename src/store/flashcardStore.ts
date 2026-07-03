import { create } from 'zustand'
import type { StudyDeck } from '../types/flashcard'

type StudyMode = 'flashcard' | 'mcq' | 'scenario' | 'all'

interface FlashcardStore {
  decks:          StudyDeck[]
  activeDeck:     StudyDeck | null
  isGenerating:   boolean
  isLoadingDeck:  boolean
  studyIndex:     number
  studyMode:      StudyMode

  setDecks:        (decks: StudyDeck[]) => void
  addDeck:         (deck: StudyDeck) => void
  updateDeck:      (deck: StudyDeck) => void
  removeDeck:      (id: string) => void
  setActiveDeck:   (deck: StudyDeck | null) => void
  setGenerating:   (v: boolean) => void
  setLoadingDeck:  (v: boolean) => void
  setStudyIndex:   (idx: number) => void
  setStudyMode:    (mode: StudyMode) => void
}

export const useFlashcardStore = create<FlashcardStore>((set) => ({
  decks:         [],
  activeDeck:    null,
  isGenerating:  false,
  isLoadingDeck: false,
  studyIndex:    0,
  studyMode:     'all',

  setDecks:       (decks)      => set({ decks }),
  addDeck:        (deck)       => set((s) => ({ decks: [deck, ...s.decks] })),
  updateDeck:     (deck)       => set((s) => ({
    decks: s.decks.map((d) => (d.id === deck.id ? deck : d)),
    activeDeck: s.activeDeck?.id === deck.id ? deck : s.activeDeck,
  })),
  removeDeck:     (id)         => set((s) => ({
    decks: s.decks.filter((d) => d.id !== id),
    activeDeck: s.activeDeck?.id === id ? null : s.activeDeck,
  })),
  setActiveDeck:  (activeDeck) => set({ activeDeck, studyIndex: 0 }),
  setGenerating:  (isGenerating)  => set({ isGenerating }),
  setLoadingDeck: (isLoadingDeck) => set({ isLoadingDeck }),
  setStudyIndex:  (studyIndex)    => set({ studyIndex }),
  setStudyMode:   (studyMode)     => set({ studyMode, studyIndex: 0 }),
}))
