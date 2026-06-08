import { create } from 'zustand'

const ONBOARDING_KEY = 'onboarding_done'

interface UiState {
  sidebarOpen: boolean
  upgradeBannerDismissed: boolean
  showOnboarding: boolean
  showWordLimitModal: boolean
  wordLimitDetails: { used: number; limit: number; resetDate: string } | null

  setSidebarOpen: (v: boolean) => void
  dismissUpgradeBanner: () => void
  dismissOnboarding: () => void
  openWordLimitModal: (details: { used: number; limit: number; resetDate: string }) => void
  closeWordLimitModal: () => void
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: false,
  upgradeBannerDismissed: false,
  showOnboarding: typeof window !== 'undefined' && !localStorage.getItem(ONBOARDING_KEY),
  showWordLimitModal: false,
  wordLimitDetails: null,

  setSidebarOpen: (v: boolean) => set({ sidebarOpen: v }),

  dismissUpgradeBanner: () => set({ upgradeBannerDismissed: true }),

  dismissOnboarding: () => {
    localStorage.setItem(ONBOARDING_KEY, '1')
    set({ showOnboarding: false })
  },

  openWordLimitModal: (details) => set({ showWordLimitModal: true, wordLimitDetails: details }),

  closeWordLimitModal: () => set({ showWordLimitModal: false }),
}))
