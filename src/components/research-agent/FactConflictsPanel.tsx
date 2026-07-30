import { AlertTriangle, Check, X } from 'lucide-react'
import type { FactConflict } from '../../types/research'

interface FactConflictsPanelProps {
  conflicts:    FactConflict[]
  onDismiss:    (conflictId: string) => void
  onAcceptNew:  (conflictId: string) => void
}

// Surfaces open cross-section fact conflicts (sample size, institution count, methodology
// type, etc. disagreeing between chapters) with per-conflict actions — the generic alignment
// issue list (see the banner above this in ResearchAgentPage) shows the same conflicts as
// plain text with no actions, so this panel is the actionable counterpart.
export function FactConflictsPanel({ conflicts, onDismiss, onAcceptNew }: FactConflictsPanelProps) {
  if (conflicts.length === 0) return null

  return (
    <div className="shrink-0 bg-amber-50 border-b border-amber-100 px-4 py-2 space-y-2">
      {conflicts.map(c => (
        <div key={c.id} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2">
          <AlertTriangle size={13} className="text-amber-500 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[11.5px] font-semibold text-amber-700 leading-snug">
              {c.factKey}: section {c.conflictingSectionCode} states "{c.conflictingValue}", but section{' '}
              {c.canonicalSourceSectionCode} already established "{c.canonicalValue}"
            </p>
            {c.conflictingExcerpt && (
              <p className="text-[11px] text-slate-500 mt-1 italic leading-relaxed line-clamp-2">
                "{c.conflictingExcerpt}"
              </p>
            )}
            <div className="flex items-center gap-3 mt-1.5">
              <button
                onClick={() => onAcceptNew(c.id)}
                className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                <Check size={11} /> Accept "{c.conflictingValue}" as canonical
              </button>
              <button
                onClick={() => onDismiss(c.id)}
                className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-700 transition-colors"
              >
                <X size={11} /> Dismiss
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
