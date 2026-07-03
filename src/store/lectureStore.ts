import { create } from 'zustand'
import type { LectureJob } from '../types/lecture'

interface LectureStore {
  jobs: LectureJob[]
  selectedJobId: string | null
  isUploading: boolean

  setJobs: (jobs: LectureJob[]) => void
  upsertJob: (job: LectureJob) => void
  removeJob: (id: string) => void
  selectJob: (id: string | null) => void
  setUploading: (v: boolean) => void
}

export const useLectureStore = create<LectureStore>((set) => ({
  jobs: [],
  selectedJobId: null,
  isUploading: false,

  setJobs: (jobs) => set({ jobs }),

  upsertJob: (job) => {
    if (!job?.id) return
    set((s) => {
      const exists = s.jobs.find((j) => j.id === job.id)
      return exists
        ? { jobs: s.jobs.map((j) => (j.id === job.id ? job : j)) }
        : { jobs: [job, ...s.jobs] }
    })
  },

  removeJob: (id) =>
    set((s) => ({
      jobs: s.jobs.filter((j) => j.id !== id),
      selectedJobId: s.selectedJobId === id ? null : s.selectedJobId,
    })),

  selectJob: (selectedJobId) => set({ selectedJobId }),
  setUploading: (isUploading) => set({ isUploading }),
}))
