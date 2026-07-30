import { useEffect, useRef } from 'react'
import { AlertTriangle, ExternalLink, Loader2, Trash2, X } from 'lucide-react'
import type { ResolvedCitation } from '../../lib/citationMatch'
import type { CitationFlag } from '../../types/research'

interface CitationPopoverProps {
  anchor:       { x: number; y: number }   // viewport coords of the clicked citation (bottom-left corner)
  data:         ResolvedCitation | 'loading'
  flag?:        CitationFlag               // open citation-integrity flag for this citation, if any
  onClose:      () => void
  onRemove:     () => void
  onDismissFlag?: () => void
}

const MISMATCH_LABELS: Record<string, string> = {
  ClaimContentMismatch: 'Claim may not be supported by this source',
  JournalMismatch:      'Journal name mismatch',
  AuthorMismatch:       'Author mismatch',
  VenueMismatch:        'Venue mismatch',
  UnresolvedCitation:   "Couldn't verify this citation",
  MissingSourceData:    'Source data unavailable to verify',
  OverusedInSection:    'This source is cited more than twice in this section',
  ClaimPartialMatch:    'This source only partially supports the specific claim it\'s attached to',
}

export function CitationPopover({ anchor, data, flag, onClose, onRemove, onDismissFlag }: CitationPopoverProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  // Keep the card on-screen: flip above the anchor if it would overflow the bottom,
  // clamp horizontally within the viewport with an 12px margin.
  const width = 340
  const left  = Math.min(Math.max(anchor.x, 12), window.innerWidth - width - 12)
  const top   = anchor.y + 260 > window.innerHeight ? anchor.y - 268 : anchor.y + 8

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden"
      style={{ left, top, width }}
    >
      {data === 'loading' ? (
        <div className="flex items-center justify-center gap-2 py-8 text-[12px] text-slate-400">
          <Loader2 size={14} className="animate-spin" /> Compiling reference…
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2 px-4 pt-3.5">
            {data.matchedSource ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#ede9fe] text-[#7c3aed] text-[10px] font-semibold uppercase tracking-wide">
                Source
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[10px] font-semibold uppercase tracking-wide">
                Unmatched
              </span>
            )}
            <button
              onClick={onClose}
              className="w-5 h-5 -mr-1 flex items-center justify-center rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
            >
              <X size={12} />
            </button>
          </div>

          <div className="px-4 pt-2 pb-3">
            <p className="text-[13px] font-semibold text-slate-800 leading-snug">
              {data.displayTitle}
            </p>

            {(data.authors || data.year) && (
              <p className="text-[11.5px] text-slate-500 mt-1">
                {data.authors}{data.authors && data.year ? ' · ' : ''}{data.year}
              </p>
            )}

            {data.abstract && (
              <p className="text-[11.5px] text-slate-500 mt-2 leading-relaxed line-clamp-4">
                {data.abstract}
              </p>
            )}

            {!data.matchedSource && (
              <p className="text-[11px] text-amber-600 mt-2 leading-relaxed">
                No matching source found in this project's literature.
              </p>
            )}

            {flag && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                <div className="flex items-start gap-1.5">
                  <AlertTriangle size={13} className="text-amber-500 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-amber-700 leading-snug">
                      {flag.mismatchTypes.map(t => MISMATCH_LABELS[t] ?? t).join(' · ')}
                    </p>
                    {flag.claimSentence && (
                      <p className="text-[11px] text-amber-700/90 mt-1.5 leading-relaxed">
                        <span className="font-medium">Claim: </span>
                        <span className="line-clamp-3">{flag.claimSentence}</span>
                      </p>
                    )}
                    {flag.actualAbstractExcerpt && (
                      <p className="text-[11px] text-amber-700/90 mt-1.5 leading-relaxed line-clamp-3">
                        <span className="font-medium">Source abstract says: </span>
                        {flag.actualAbstractExcerpt}
                      </p>
                    )}
                    {flag.llmReasoning && (
                      <p className="text-[10.5px] text-amber-600/80 mt-1.5 italic leading-relaxed">
                        {flag.llmReasoning}
                      </p>
                    )}
                    {onDismissFlag && (
                      <button
                        onClick={onDismissFlag}
                        className="mt-2 text-[11px] font-medium text-amber-700 hover:text-amber-900 underline underline-offset-2 transition-colors"
                      >
                        Dismiss flag
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 bg-slate-50/60">
            <button
              onClick={onRemove}
              className="flex items-center gap-1.5 text-[11.5px] font-medium text-slate-500 hover:text-red-600 transition-colors"
            >
              <Trash2 size={12} /> Remove citation
            </button>
            {data.viewUrl && (
              <a
                href={data.viewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[11.5px] font-medium text-[#7c3aed] hover:text-[#6d28d9] transition-colors"
              >
                View source <ExternalLink size={12} />
              </a>
            )}
          </div>
        </>
      )}
    </div>
  )
}
