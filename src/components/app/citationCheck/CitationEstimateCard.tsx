import { AlertTriangle, FileText, Info } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { CitationCheckEstimate } from '../../../types/citationCheck'
import { formatEstimateTime } from '../../../lib/citationResults'

interface Props {
  fileName: string | null
  estimate: CitationCheckEstimate
  onStart: () => void
  onCancel: () => void
}

/**
 * Shown before a large, plan-limited or imperfectly-read check starts: what was found, how many this plan will check, and a rough
 * time. Nothing has been stored or paid for yet, so Cancel costs nothing.
 */
export function CitationEstimateCard({ fileName, estimate: e, onStart, onCancel }: Props) {
  return (
    <div className="absolute inset-0 flex items-center justify-center px-6 overflow-y-auto">
      <div className="max-w-sm w-full rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3 my-4" role="region" aria-label="Before we start">
        <div className="flex items-center gap-2 rounded-lg bg-white border border-slate-200 px-3 py-2">
          <FileText size={14} className="text-slate-600 shrink-0" aria-hidden />
          <span className="text-[13px] font-medium text-slate-900 truncate">{fileName ?? 'Pasted text'}</span>
          <span className="text-[11.5px] text-slate-600 shrink-0 tabular-nums">· {e.wordCount.toLocaleString()} words</span>
        </div>

        <p className="text-[13px] font-medium text-slate-900">
          Found {e.citationCount.toLocaleString()} {e.citationCount === 1 ? 'citation' : 'citations'} and {e.referenceCount.toLocaleString()} {e.referenceCount === 1 ? 'reference' : 'references'}.
        </p>
        <p className="text-[12.5px] text-slate-700">
          We will check {e.willCheck.toLocaleString()}. This usually takes {formatEstimateTime(e.estimatedSeconds)}; it is a rough estimate. You can leave the page and come back.
        </p>

        {e.locked > 0 && e.planLimit != null && (
          <p className="text-[12px] text-slate-700 flex items-start gap-2">
            <Info size={13} className="mt-0.5 shrink-0 text-slate-600" aria-hidden />
            <span>
              Your plan checks the first {e.planLimit} citations in each run, so {e.locked} will be left unchecked.{' '}
              <Link to="/app/upgrade" className="text-purple-text font-medium hover:underline">See plans</Link>
            </span>
          </p>
        )}
        {e.warnings.map(w => (
          <p key={w} className="text-[12px] text-amber-800 flex items-start gap-2">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden /> <span>{w}</span>
          </p>
        ))}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button type="button" onClick={onCancel}
            className="text-[12px] font-medium px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent">
            Cancel
          </button>
          <button type="button" onClick={onStart} autoFocus
            className="text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-purple-accent text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent focus-visible:ring-offset-1">
            Start check
          </button>
        </div>
      </div>
    </div>
  )
}
