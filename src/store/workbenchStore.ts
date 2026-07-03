import { create } from 'zustand'
import type { PinnedChart, FlaggedBlock, CitationAsset, AssumptionReport } from '../types/workbench'

// ── localStorage persistence ──────────────────────────────────────────────────

const PINNED_KEY = 'wb_pinned_charts_v1'

function loadPinned(): PinnedChart[] {
  try {
    const raw = localStorage.getItem(PINNED_KEY)
    return raw ? (JSON.parse(raw) as PinnedChart[]) : []
  } catch {
    return []
  }
}

function savePinned(charts: PinnedChart[]) {
  try {
    // Store only the 20 most recent to stay inside storage quota
    localStorage.setItem(PINNED_KEY, JSON.stringify(charts.slice(0, 20)))
  } catch { /* quota exceeded — silently ignore */ }
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface WorkbenchStore {
  pinnedCharts: PinnedChart[]
  pinChart:     (chart: PinnedChart) => void
  unpinChart:   (id: string) => void

  manuscriptText:       string
  setManuscriptText:    (text: string) => void

  abstractText:         string
  setAbstractText:      (text: string) => void
  isGeneratingAbstract: boolean
  setGeneratingAbstract:(v: boolean) => void

  isOptimizingProse:    boolean
  setOptimizingProse:   (v: boolean) => void

  aiScore:       number | null
  flaggedBlocks: FlaggedBlock[]
  citations:     CitationAsset[]
  isScanning:    boolean
  setComplianceResults: (score: number, flags: FlaggedBlock[], citations: CitationAsset[]) => void
  setScanning:   (v: boolean) => void

  assumptionReport:      AssumptionReport | null
  isCheckingAssumptions: boolean
  setAssumptionReport:      (report: AssumptionReport | null) => void
  setCheckingAssumptions:   (v: boolean) => void

  reset: () => void
}

export const useWorkbenchStore = create<WorkbenchStore>((set) => ({
  // Rehydrate pinned charts from localStorage on startup
  pinnedCharts: loadPinned(),

  pinChart: (chart) => set((s) => {
    const updated = [chart, ...s.pinnedCharts]
    savePinned(updated)
    return { pinnedCharts: updated }
  }),

  unpinChart: (id) => set((s) => {
    const updated = s.pinnedCharts.filter((c) => c.id !== id)
    savePinned(updated)
    return { pinnedCharts: updated }
  }),

  manuscriptText:       '',
  setManuscriptText:    (manuscriptText) => set({ manuscriptText }),

  abstractText:         '',
  setAbstractText:      (abstractText) => set({ abstractText }),
  isGeneratingAbstract: false,
  setGeneratingAbstract:(isGeneratingAbstract) => set({ isGeneratingAbstract }),

  isOptimizingProse:    false,
  setOptimizingProse:   (isOptimizingProse) => set({ isOptimizingProse }),

  aiScore:       null,
  flaggedBlocks: [],
  citations:     [],
  isScanning:    false,

  setComplianceResults: (score, flags, citations) =>
    set({ aiScore: score, flaggedBlocks: flags, citations }),
  setScanning: (isScanning) => set({ isScanning }),

  assumptionReport:      null,
  isCheckingAssumptions: false,
  setAssumptionReport:      (assumptionReport) => set({ assumptionReport }),
  setCheckingAssumptions:   (isCheckingAssumptions) => set({ isCheckingAssumptions }),

  reset: () =>
    set({
      pinnedCharts:         [],
      manuscriptText:       '',
      abstractText:         '',
      isGeneratingAbstract: false,
      isOptimizingProse:    false,
      aiScore:              null,
      flaggedBlocks:        [],
      citations:            [],
      isScanning:           false,
      assumptionReport:     null,
      isCheckingAssumptions: false,
    }),
}))
