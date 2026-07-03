import { create } from 'zustand'
import type { CitationDto, ResolvedCitation } from '../types/citation'

interface CitationStore {
  citations:   CitationDto[]
  resolved:    ResolvedCitation | null
  selectedId:  string | null
  isLoading:   boolean
  isResolving: boolean
  isSaving:    boolean
  isExporting: boolean

  setCitations:  (c: CitationDto[]) => void
  addCitation:   (c: CitationDto) => void
  removeCitation:(id: string) => void
  setResolved:   (r: ResolvedCitation | null) => void
  setSelectedId: (id: string | null) => void
  setLoading:    (v: boolean) => void
  setResolving:  (v: boolean) => void
  setSaving:     (v: boolean) => void
  setExporting:  (v: boolean) => void
}

export const useCitationStore = create<CitationStore>((set) => ({
  citations:   [],
  resolved:    null,
  selectedId:  null,
  isLoading:   false,
  isResolving: false,
  isSaving:    false,
  isExporting: false,

  setCitations:   (citations) => set({ citations }),
  addCitation:    (c) => set((s) => ({ citations: [c, ...s.citations] })),
  removeCitation: (id) => set((s) => ({ citations: s.citations.filter((c) => c.id !== id) })),
  setResolved:    (resolved) => set({ resolved }),
  setSelectedId:  (selectedId) => set({ selectedId }),
  setLoading:     (isLoading) => set({ isLoading }),
  setResolving:   (isResolving) => set({ isResolving }),
  setSaving:      (isSaving) => set({ isSaving }),
  setExporting:   (isExporting) => set({ isExporting }),
}))
