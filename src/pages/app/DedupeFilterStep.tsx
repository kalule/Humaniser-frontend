import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Filter, Layers, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useSystematicReviewStore } from '../../store/systematicReviewStore'
import { computeStepStaleness } from '../../lib/reviewStaleness'
import type { DedupeRun, SystematicReviewDetail } from '../../types/systematicReview'

interface DedupeFilterStepProps {
  reviewId: string
  detail:   SystematicReviewDetail
  onSaved:  () => void
}

interface FilterFields {
  dateFrom:         string
  dateTo:           string
  minCitations:     number
  abstractRequired: boolean
}

const toFields = (protocol: SystematicReviewDetail['protocol']): FilterFields => ({
  dateFrom:         protocol.dateRangeStart ?? '',
  dateTo:           protocol.dateRangeEnd ?? '',
  minCitations:     protocol.minCitations,
  abstractRequired: protocol.abstractRequired,
})

// The filter values a given run actually applied — a persisted snapshot, not client memory,
// so "filters changed since this run" survives a page reload.
const runToFields = (run: DedupeRun): FilterFields => ({
  dateFrom:         run.filterDateRangeStart ?? '',
  dateTo:           run.filterDateRangeEnd ?? '',
  minCitations:     run.filterMinCitations,
  abstractRequired: run.filterAbstractRequired,
})

const fieldsEqual = (a: FilterFields, b: FilterFields) =>
  a.dateFrom === b.dateFrom && a.dateTo === b.dateTo &&
  a.minCitations === b.minCitations && a.abstractRequired === b.abstractRequired

function StatCard({ label, value, tone }: { label: string; value: number; tone: 'neutral' | 'amber' | 'accent' }) {
  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3',
        tone === 'neutral' && 'bg-slate-50 border-slate-200',
        tone === 'amber'   && 'bg-amber-tint border-amber-accent/30',
        tone === 'accent'  && 'bg-violet-50 border-violet-200',
      )}
    >
      <p className={cn(
        'text-[10px] font-semibold uppercase tracking-widest mb-1',
        tone === 'neutral' && 'text-slate-400',
        tone === 'amber'   && 'text-amber-text',
        tone === 'accent'  && 'text-violet-500',
      )}>
        {label}
      </p>
      <p className={cn(
        'font-bold tabular-nums',
        tone === 'accent' ? 'text-[26px] text-violet-700' : 'text-[22px] text-slate-800',
      )}>
        {value}
      </p>
    </div>
  )
}

function BreakdownRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-[12px] text-slate-600">{label}</span>
      <span className="text-[13px] font-semibold text-slate-800 tabular-nums">{value}</span>
    </div>
  )
}

export default function DedupeFilterStep({ reviewId, detail, onSaved }: DedupeFilterStepProps) {
  const runDedupeAndFilter = useSystematicReviewStore(s => s.runDedupeAndFilter)
  const updateProtocol = useSystematicReviewStore(s => s.updateProtocol)

  const [fields, setFields] = useState<FilterFields>(() => toFields(detail.protocol))
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const fieldsRef = useRef(fields)
  fieldsRef.current = fields

  // Re-sync local field state if the protocol changes from elsewhere (e.g. the Eligibility
  // Criteria step's Selection Filters panel), so the two views never drift.
  useEffect(() => {
    setFields(toFields(detail.protocol))
  }, [detail.protocol.dateRangeStart, detail.protocol.dateRangeEnd, detail.protocol.minCitations, detail.protocol.abstractRequired])

  const run = detail.latestDedupeRun
  const { dedupPending: pendingSinceRun } = computeStepStaleness(detail)
  // Compared against the run's persisted filter snapshot (not client memory), so this stays
  // correct across a page reload rather than resetting to "in sync" on every mount.
  const pendingRerun = run !== null && !fieldsEqual(fields, runToFields(run))

  const persist = async (patch: Partial<FilterFields>) => {
    const next = { ...fieldsRef.current, ...patch }
    setFields(next)
    await updateProtocol(reviewId, {
      databasesSearched: detail.protocol.databasesSearched,
      dateRangeStart:    next.dateFrom || null,
      dateRangeEnd:      next.dateTo || null,
      minCitations:      next.minCitations,
      abstractRequired:  next.abstractRequired,
    })
    onSaved()
  }

  const handleRerun = async () => {
    setRunning(true)
    setRunError(null)
    try {
      await runDedupeAndFilter(reviewId)
      onSaved()
    } catch {
      setRunError('Could not run deduplication & filters. Please try again.')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="px-6 py-6">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-violet-500 mb-1">Paper selection</p>
          <h2 className="text-[18px] font-bold text-slate-900 mb-1">Deduplication &amp; mechanical filters</h2>
          <p className="text-[13px] text-slate-500 max-w-2xl">
            This stage removes duplicate records, excludes papers without abstracts, and applies
            publication-date and citation-count thresholds before title and abstract screening.
          </p>
          {/* The counts below describe the corpus this run SAW. New papers since then are invisible
              here and in every downstream step, and the step still reads as complete — which is how
              a repaired corpus went unnoticed behind a green tick. */}
          {pendingSinceRun > 0 && (
            <p className="mt-2 text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 max-w-2xl">
              <span className="font-semibold">{pendingSinceRun.toLocaleString()} paper{pendingSinceRun === 1 ? '' : 's'}</span>{' '}
              {pendingSinceRun === 1 ? 'has' : 'have'} been fetched since this last ran, so the counts below
              do not include {pendingSinceRun === 1 ? 'it' : 'them'}. Re-run to bring{' '}
              {pendingSinceRun === 1 ? 'it' : 'them'} into screening.
            </p>
          )}
        </div>
        <button
          onClick={handleRerun}
          disabled={running}
          className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white hover:border-violet-300 hover:text-violet-700 text-slate-700 text-[12px] font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {running ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Re-run dedupe &amp; filters
        </button>
      </div>

      {runError && (
        <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{runError}</p>
      )}

      {!run && !running && (
        <div className="flex items-start gap-2.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 mb-5">
          <AlertCircle size={14} className="text-slate-400 shrink-0 mt-0.5" />
          <p className="text-[12px] text-slate-500">
            No run yet — click "Re-run dedupe &amp; filters" to compute duplicates and apply mechanical filters.
          </p>
        </div>
      )}

      {pendingRerun && run && (
        <div className="flex items-start gap-2.5 bg-amber-tint border border-amber-accent/30 rounded-lg px-3 py-2.5 mb-5">
          <AlertCircle size={14} className="text-amber-text shrink-0 mt-0.5" />
          <p className="text-[12px] text-amber-900">
            Filter changes are saved but not yet applied — click "Re-run dedupe &amp; filters" to update the counts below.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Fetched records"      value={detail.paperCount}                         tone="neutral" />
        <StatCard label="Duplicates removed"   value={(run?.duplicatesRemovedByDoi ?? 0) + (run?.duplicatesRemovedByTitle ?? 0)} tone="amber" />
        <StatCard label="Mechanically excluded" value={(run?.excludedWithoutAbstract ?? 0) + (run?.excludedByPublicationDate ?? 0) + (run?.excludedByCitationThreshold ?? 0)} tone="amber" />
        <StatCard label="Ready for screening"  value={run?.readyForScreeningCount ?? 0}          tone="accent" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Layers size={13} className="text-slate-400" />
            <h3 className="text-[12px] font-bold text-slate-800">Stage breakdown</h3>
          </div>
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <BreakdownRow label="Duplicates removed by DOI"      value={run?.duplicatesRemovedByDoi ?? 0} />
            <BreakdownRow label="Duplicates removed by title"    value={run?.duplicatesRemovedByTitle ?? 0} />
            <BreakdownRow label="Excluded without abstract"      value={run?.excludedWithoutAbstract ?? 0} />
            <BreakdownRow label="Excluded by publication date"   value={run?.excludedByPublicationDate ?? 0} />
            <BreakdownRow label="Excluded by citation threshold" value={run?.excludedByCitationThreshold ?? 0} />
          </div>
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Filter size={13} className="text-slate-400" />
            <h3 className="text-[12px] font-bold text-slate-800">Mechanical filters</h3>
          </div>
          <div className="border border-slate-200 rounded-xl p-4 bg-white">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Publication date from</label>
                <input
                  type="date"
                  value={fields.dateFrom}
                  onChange={e => setFields(f => ({ ...f, dateFrom: e.target.value }))}
                  onBlur={() => persist({ dateFrom: fieldsRef.current.dateFrom })}
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-[12px] text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Publication date to</label>
                <input
                  type="date"
                  value={fields.dateTo}
                  onChange={e => setFields(f => ({ ...f, dateTo: e.target.value }))}
                  onBlur={() => persist({ dateTo: fieldsRef.current.dateTo })}
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-[12px] text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition"
                />
              </div>
            </div>

            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Minimum citation count</label>
            <input
              type="number"
              min={0}
              value={fields.minCitations}
              onChange={e => setFields(f => ({ ...f, minCitations: Math.max(0, Number(e.target.value) || 0) }))}
              onBlur={() => persist({ minCitations: fieldsRef.current.minCitations })}
              className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-[12px] text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition mb-3"
            />

            <label className="flex items-start gap-2 text-[12px] text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={fields.abstractRequired}
                onChange={e => persist({ abstractRequired: e.target.checked })}
                className="mt-0.5 rounded border-slate-300 text-violet-600 focus:ring-violet-400"
              />
              Exclude papers that do not have an abstract before screening.
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
