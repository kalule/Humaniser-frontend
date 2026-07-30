import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import { reviewerApi } from '../api/reviewer'
import type { DocumentReviewSummary, ReviewType } from '../types/reviewer'

interface ReviewerStore {
  reviews: DocumentReviewSummary[]
  loadReviews:  (reviewType?: ReviewType) => Promise<void>
  deleteReview: (id: string) => Promise<void>
}

const safeLocalStorage: StateStorage = {
  getItem: (name) => localStorage.getItem(name),
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value)
    } catch (err) {
      console.warn(`[reviewerStore] Failed to persist "${name}" — continuing without persisting this change.`, err)
    }
  },
  removeItem: (name) => localStorage.removeItem(name),
}

export const useReviewerStore = create<ReviewerStore>()(
  persist(
    (set) => ({
      reviews: [],

      loadReviews: async (reviewType) => {
        const list = await reviewerApi.list(reviewType)
        set({ reviews: list })
      },

      deleteReview: async (id) => {
        await reviewerApi.delete(id)
        set(s => ({ reviews: s.reviews.filter(r => r.id !== id) }))
      },
    }),
    {
      name: 'humanise-reviewer',
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (state) => ({ reviews: state.reviews }),
    },
  ),
)
