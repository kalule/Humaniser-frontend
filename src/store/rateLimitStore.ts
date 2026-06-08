import { create } from 'zustand'

interface PreviewLimitData {
  message: string
  signUpUrl: string
  upgradeUrl: string
}

interface PlanLimitData {
  retryAfterSeconds: number
  plan: string
  upgradeUrl: string
  upgradeRequired: boolean
}

interface RateLimitStore {
  previewLimitModal: PreviewLimitData | null
  planLimit: PlanLimitData | null
  showPreviewLimitModal: (data: PreviewLimitData) => void
  hidePreviewLimitModal: () => void
  setPlanLimit: (data: PlanLimitData) => void
  clearPlanLimit: () => void
}

export const useRateLimitStore = create<RateLimitStore>((set) => ({
  previewLimitModal: null,
  planLimit: null,
  showPreviewLimitModal: (data) => set({ previewLimitModal: data }),
  hidePreviewLimitModal: () => set({ previewLimitModal: null }),
  setPlanLimit: (data) => set({ planLimit: data }),
  clearPlanLimit: () => set({ planLimit: null }),
}))
