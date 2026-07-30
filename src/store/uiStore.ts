import { create } from 'zustand'

const ONBOARDING_KEY = 'onboarding_done'
const DOC_EDITOR_FONT_SIZE_KEY = 'doc_editor_font_size'

export type DocEditorFontSize = 14 | 16 | 18
const DOC_EDITOR_FONT_SIZES: DocEditorFontSize[] = [14, 16, 18]

function readDocEditorFontSize(): DocEditorFontSize {
  if (typeof window === 'undefined') return 16
  const stored = Number(localStorage.getItem(DOC_EDITOR_FONT_SIZE_KEY))
  return DOC_EDITOR_FONT_SIZES.includes(stored as DocEditorFontSize) ? (stored as DocEditorFontSize) : 16
}

interface UiState {
  sidebarOpen: boolean
  upgradeBannerDismissed: boolean
  showOnboarding: boolean
  showWordLimitModal: boolean
  wordLimitDetails: { used: number; limit: number; resetDate: string } | null
  showCreditLimitModal: boolean
  creditLimitDetails: { used: number; limit: number; resetDate: string } | null
  docEditorFontSize: DocEditorFontSize

  setSidebarOpen: (v: boolean) => void
  dismissUpgradeBanner: () => void
  dismissOnboarding: () => void
  openWordLimitModal: (details: { used: number; limit: number; resetDate: string }) => void
  closeWordLimitModal: () => void
  openCreditLimitModal: (details: { used: number; limit: number; resetDate: string }) => void
  closeCreditLimitModal: () => void
  setDocEditorFontSize: (size: DocEditorFontSize) => void
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: false,
  upgradeBannerDismissed: false,
  showOnboarding: typeof window !== 'undefined' && !localStorage.getItem(ONBOARDING_KEY),
  showWordLimitModal: false,
  wordLimitDetails: null,
  showCreditLimitModal: false,
  creditLimitDetails: null,
  docEditorFontSize: readDocEditorFontSize(),

  setSidebarOpen: (v: boolean) => set({ sidebarOpen: v }),

  setDocEditorFontSize: (size) => {
    localStorage.setItem(DOC_EDITOR_FONT_SIZE_KEY, String(size))
    set({ docEditorFontSize: size })
  },

  dismissUpgradeBanner: () => set({ upgradeBannerDismissed: true }),

  dismissOnboarding: () => {
    localStorage.setItem(ONBOARDING_KEY, '1')
    set({ showOnboarding: false })
  },

  openWordLimitModal: (details) => set({ showWordLimitModal: true, wordLimitDetails: details }),

  closeWordLimitModal: () => set({ showWordLimitModal: false }),

  openCreditLimitModal: (details) => set({ showCreditLimitModal: true, creditLimitDetails: details }),

  closeCreditLimitModal: () => set({ showCreditLimitModal: false }),
}))
