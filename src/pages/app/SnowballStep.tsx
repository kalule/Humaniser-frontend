import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowRight, GitBranch, Loader2, Sparkles } from 'lucide-react'
import { useSystematicReviewStore } from '../../store/systematicReviewStore'
import type { SnowballResult, SystematicReviewDetail } from '../../types/systematicReview'

interface SnowballStepProps {
  reviewId: string
  detail:   SystematicReviewDetail
  onSaved:  () => void
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
      <p className="text-[22px] font-bold text-slate-800 tabular-nums leading-none mb-1">{value.toLocaleString()}</p>
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
    </div>
  )
}

export default function SnowballStep({ reviewId, detail, onSaved }: SnowballStepProps) {
  const runSnowballSearch = useSystematicReviewStore(s => s.runSnowballSearch)
  const [, setSearchParams] = useSearchParams()

  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<SnowballResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const includedCount = detail.fullTextScreeningSummary?.included ?? 0

  const handleRun = async () => {
    setRunning(true)
    setError(null)
    try {
      const res = await runSnowballSearch(reviewId)
      setResult(res)
      onSaved()
    } catch {
      setError('Could not run citation chaining. Please try again.')
    } finally {
      setRunning(false)
    }
  }

  const goToDedup = () => setSearchParams({ step: 'dedup' }, { replace: false })

  return (
    <div className="max-w-3xl px-6 py-6">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-violet-500 mb-1">Supplementary search</p>
      <h2 className="text-[18px] font-bold text-slate-900 mb-1">Citation Chaining</h2>
      <p className="text-[13px] text-slate-500 mb-5 max-w-2xl">
        Backward and forward citation searching of your included studies — checking each included paper's own
        reference list, and finding papers that cite it — to catch relevant studies a database search alone can miss.
        This runs over OpenAlex and seeds from every paper <span className="font-medium text-slate-700">Included at Full Text Screening</span>.
      </p>

      {includedCount === 0 ? (
        <div className="py-16 text-center border border-slate-200 border-dashed rounded-xl bg-slate-50/50 mb-6">
          <GitBranch size={22} className="text-slate-300 mx-auto mb-3" />
          <p className="text-[14px] font-semibold text-slate-600 mb-1">No included studies yet</p>
          <p className="text-[13px] text-slate-400 max-w-sm mx-auto">
            Complete Full Text Screening first — citation chaining seeds from the papers confirmed Included there.
          </p>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl p-4 mb-6 bg-white">
          <p className="text-[13px] text-slate-700 mb-3">
            <span className="font-semibold">{includedCount}</span> included paper{includedCount === 1 ? '' : 's'} available
            to seed the search{includedCount > 30 ? ' (only the first 30 are processed per run — re-run to cover more)' : ''}.
          </p>
          <button
            onClick={handleRun}
            disabled={running}
            className="flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[13px] font-semibold transition-colors shadow-sm shadow-violet-200 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {running ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {running ? 'Searching references and citations…' : result ? 'Run again' : 'Run Citation Chaining'}
          </button>
        </div>
      )}

      {error && (
        <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      {result && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <StatTile label="Papers searched" value={result.sourcePapersProcessed} />
            <StatTile label="Backward references found" value={result.backwardReferencesFound} />
            <StatTile label="Forward citations found" value={result.forwardCitationsFound} />
            <StatTile label="New candidates added" value={result.newPapersAdded} />
          </div>

          {result.sourcePapersSkippedNoDoi > 0 && (
            <p className="text-[12px] text-slate-400 mb-4">
              {result.sourcePapersSkippedNoDoi} included paper{result.sourcePapersSkippedNoDoi === 1 ? '' : 's'} skipped — no DOI on record.
            </p>
          )}

          {result.newPapersAdded > 0 ? (
            <div className="flex items-center justify-between gap-4 bg-violet-50 border border-violet-200 rounded-xl px-4 py-3">
              <p className="text-[12px] text-violet-900 leading-relaxed">
                {result.newPapersAdded} new candidate{result.newPapersAdded === 1 ? '' : 's'} added — they still need to pass
                deduplication and mechanical filters before they appear in screening.
              </p>
              <button
                onClick={goToDedup}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[12px] font-semibold transition-colors whitespace-nowrap"
              >
                Re-run Dedup &amp; filters <ArrowRight size={12} />
              </button>
            </div>
          ) : (
            <p className="text-[12px] text-slate-400">No new candidates found beyond papers already in this review.</p>
          )}
        </>
      )}
    </div>
  )
}
