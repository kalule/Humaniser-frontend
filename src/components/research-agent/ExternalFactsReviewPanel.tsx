import { AlertTriangle, Check } from 'lucide-react'
import type { ExternalFact } from '../../types/research'

interface ExternalFactsReviewPanelProps {
  facts:      ExternalFact[]
  onConfirm:  (factKey: string) => void
}

// Surfaces facts pulled from an externally-uploaded proposal (see UploadExternalProposalAsync)
// that the student hasn't confirmed yet — same card layout as FactConflictsPanel, but a plain
// "Confirm" action instead of accept/dismiss since there's no competing value to choose between.
export function ExternalFactsReviewPanel({ facts, onConfirm }: ExternalFactsReviewPanelProps) {
  const pending = facts.filter(f => !f.locked)
  if (pending.length === 0) return null

  return (
    <div className="shrink-0 bg-amber-50 border-b border-amber-100 px-4 py-2 space-y-2">
      {pending.map(f => (
        <div key={f.factKey} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2">
          <AlertTriangle size={13} className="text-amber-500 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[11.5px] font-semibold text-amber-700 leading-snug">
              {f.factKey}: "{f.value}"
            </p>
            {f.excerpt && (
              <p className="text-[11px] text-slate-500 mt-1 italic leading-relaxed line-clamp-2">
                "{f.excerpt}"
              </p>
            )}
            <div className="flex items-center gap-3 mt-1.5">
              <button
                onClick={() => onConfirm(f.factKey)}
                className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                <Check size={11} /> Confirm this is correct
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
