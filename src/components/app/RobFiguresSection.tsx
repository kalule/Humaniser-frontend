import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { RobColourScheme, RobFigureData } from '../../lib/robFigures'
import RobTrafficLightPlot from './RobTrafficLightPlot'
import RobSummaryPlot from './RobSummaryPlot'

interface RobFiguresSectionProps<T extends { paperId: string }> {
  /** Loads EVERY assessed record (the step's table only holds one page). */
  loadAll:     () => Promise<T[]>
  /** The step's current page, which can be newer than the last full load after an inline edit. */
  pageRecords: T[]
  /** Changes when the step's data changes server-side (e.g. a finished run), forcing a reload. */
  refreshKey:  string
  toFigure:    (records: T[]) => RobFigureData
  /** Prefix for downloaded file names, e.g. "rob2". */
  filePrefix:  string
}

/**
 * Collapsible "Figures" block for a risk-of-bias step: robvis-style traffic-light and summary
 * plots over every study, with a Cochrane / colour-blind palette toggle. Collapsed by default, and
 * it loads nothing until opened.
 */
export default function RobFiguresSection<T extends { paperId: string }>({
  loadAll, pageRecords, refreshKey, toFigure, filePrefix,
}: RobFiguresSectionProps<T>) {
  const [open, setOpen] = useState(false)
  const [scheme, setScheme] = useState<RobColourScheme>('cochrane')
  const [all, setAll] = useState<T[] | null>(null)
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!open || loadedKey === refreshKey) return
    let cancelled = false
    setLoading(true)
    setError(false)
    loadAll()
      .then(items => { if (!cancelled) { setAll(items); setLoadedKey(refreshKey) } })
      .catch(err => { console.error('Failed to load risk of bias figures', err); if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, refreshKey])

  const data = useMemo(() => {
    if (!all) return null
    const latest = new Map(pageRecords.map(r => [r.paperId, r]))
    return toFigure(all.map(r => latest.get(r.paperId) ?? r))
  }, [all, pageRecords, toFigure])

  return (
    <div className="border border-slate-200 rounded-xl bg-white mb-4">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
      >
        {open ? <ChevronDown size={15} className="text-slate-400" /> : <ChevronRight size={15} className="text-slate-400" />}
        <span className="text-[13px] font-semibold text-slate-800">Figures</span>
        <span className="text-[12px] text-slate-400">Traffic-light and summary plots, ready to download</span>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Colours</span>
            {([['cochrane', 'Cochrane'], ['colourblind', 'Colour-blind friendly']] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setScheme(id)}
                aria-pressed={scheme === id}
                className={cn(
                  'px-3 py-1 rounded-lg border text-[12px] font-medium transition-colors',
                  scheme === id ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-violet-300',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {loading && !data ? (
            <div className="py-12 flex justify-center"><Loader2 size={20} className="animate-spin text-slate-300" /></div>
          ) : error && !data ? (
            <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">Couldn't load the ratings for the figures. Please try again.</p>
          ) : data && data.studies.length === 0 ? (
            <p className="text-[12px] text-slate-500">No study has a risk of bias judgement yet.</p>
          ) : data ? (
            <div className="space-y-8">
              <section>
                <h4 className="text-[12px] font-semibold text-slate-700 mb-2">Traffic-light plot</h4>
                <RobTrafficLightPlot data={data} scheme={scheme} filename={`${filePrefix}-traffic-light`} />
              </section>
              <section>
                <h4 className="text-[12px] font-semibold text-slate-700 mb-2">Summary plot</h4>
                <RobSummaryPlot data={data} scheme={scheme} filename={`${filePrefix}-summary`} />
              </section>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
