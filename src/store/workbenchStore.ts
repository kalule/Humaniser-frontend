import { create } from 'zustand'
import toast from 'react-hot-toast'
import { pinnedChartsApi } from '../api/pinnedCharts'
import type { PinnedChart, FlaggedBlock, CitationAsset, AssumptionReport } from '../types/workbench'

// ── Store ─────────────────────────────────────────────────────────────────────

interface WorkbenchStore {
  pinnedCharts:       PinnedChart[]
  pinnedChartsLoaded: boolean
  loadPinnedCharts:   () => Promise<void>
  pinChart:   (chart: { base64Png: string; caption?: string; sourcePrompt: string }) => Promise<void>
  unpinChart: (id: string) => Promise<void>

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
  /** Drops pinned charts from memory on logout — a shared browser shouldn't carry the
   *  previous account's charts into a fresh session before loadPinnedCharts() re-fetches. */
  clearPinnedCharts: () => void
}

export const useWorkbenchStore = create<WorkbenchStore>((set, get) => ({
  pinnedCharts:       [],
  pinnedChartsLoaded: false,

  loadPinnedCharts: async () => {
    try {
      const pinnedCharts = await pinnedChartsApi.getCharts()
      set({ pinnedCharts, pinnedChartsLoaded: true })
    } catch {
      toast.error('Could not load your pinned charts — please refresh and try again.')
    }
  },

  pinChart: async (chart) => {
    try {
      const created = await pinnedChartsApi.createChart(chart)
      set(s => ({ pinnedCharts: [created, ...s.pinnedCharts] }))
    } catch (err) {
      toast.error('Could not pin the chart — please try again.')
      throw err
    }
  },

  unpinChart: async (id) => {
    const previous = get().pinnedCharts
    set(s => ({ pinnedCharts: s.pinnedCharts.filter(c => c.id !== id) }))
    try {
      await pinnedChartsApi.deleteChart(id)
    } catch {
      set({ pinnedCharts: previous })
      toast.error('Could not unpin the chart — please try again.')
    }
  },

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
      // pinnedCharts intentionally left alone — it's a persistent asset library now,
      // not per-analysis-session state, so resetting a session shouldn't clear it.
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

  clearPinnedCharts: () => set({ pinnedCharts: [], pinnedChartsLoaded: false }),
}))

// ── One-time localStorage → API migration ────────────────────────────────────
export async function migrateLocalPinnedChartsIfPresent(userId: string): Promise<void> {
  const migratedFlagKey = `pinned-charts-migrated:${userId}`
  if (localStorage.getItem(migratedFlagKey) === 'true') return

  const legacyKey = 'wb_pinned_charts_v1'
  const raw = localStorage.getItem(legacyKey)

  if (!raw) {
    localStorage.setItem(migratedFlagKey, 'true')
    return
  }

  try {
    const oldCharts = JSON.parse(raw) as PinnedChart[]
    // Batched via a single transactional call — a loop of individual creates would leave
    // successfully-imported charts behind on a mid-migration failure, then duplicate them
    // on retry (the flag never gets set, so the next login re-runs the whole thing). The old
    // store capped at 20 charts, well under the import endpoint's 50-per-batch limit.
    if (oldCharts.length > 0) {
      await pinnedChartsApi.importCharts(oldCharts.map(chart => ({
        base64Png:    chart.base64Png,
        caption:      chart.caption,
        sourcePrompt: chart.sourcePrompt,
      })))
    }

    localStorage.removeItem(legacyKey)
    localStorage.setItem(migratedFlagKey, 'true')
  } catch {
    // Don't set the flag — retry on next login instead of losing data silently.
  }
}
