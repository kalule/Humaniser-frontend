import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ExternalLink, Loader2, Trash2, X } from 'lucide-react'
import type { ResolvedCitation } from '../../lib/citationMatch'
import type { CitationFixAction, CitationFlag, FetchedLiterature } from '../../types/research'
import { citationFixBlockedReason } from './citationFixOptions'
import { AmbiguousSourceChooser } from './AmbiguousSourceChooser'
import { candidatesForAmbiguousFlag } from '../../lib/citationMatch'

interface CitationPopoverProps {
  anchor:       { x: number; y: number }   // viewport coords of the clicked citation (bottom-left corner)
  // One entry per resolved clause — a grouped Harvard/APA citation like "(Alabi, 2020;
  // Moodley, 2024)" resolves to two entries, each shown as its own card.
  data:         ResolvedCitation[] | 'loading'
  flags?:       (CitationFlag | undefined)[]   // open citation-integrity flag per entry in `data`, aligned by index
  literature?:  FetchedLiterature[]
  busyFlagId?:  string | null
  onClose:      () => void
  onRemove:     () => void                     // removes the whole clicked span (all clauses together)
  onRepairFlag?: (flagId: string, action: CitationFixAction, replacementLiteratureId?: string) => void
  onRemoveClaim?: (flagId: string) => void
  onDismissFlag?: (flagId: string, reason?: string) => void
  onChooseSource?: (flagId: string, literatureId: string) => void
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
  GeographicMismatch:   'The source studies a different country or region',
  GeneralizationBeyondSample: 'The claim is broader than the source sample supports',
  PopulationScopeViolation: 'The source population does not match this claim',
  AmbiguousCitation:    'Several papers share this author and year',
}

export function CitationPopover({
  anchor, data, flags, literature = [], busyFlagId, onClose, onRemove,
  onRepairFlag, onRemoveClaim, onDismissFlag, onChooseSource,
}: CitationPopoverProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [replaceFlagId, setReplaceFlagId] = useState<string | null>(null)
  const [replacementQuery, setReplacementQuery] = useState('')
  const [dismissFlagId, setDismissFlagId] = useState<string | null>(null)
  const [dismissReason, setDismissReason] = useState('')

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
  // clamp horizontally within the viewport with an 12px margin. A grouped citation renders
  // several entries, so cap height and let the body scroll rather than growing unbounded.
  const width = 340
  const maxHeight = 420
  const left  = Math.min(Math.max(anchor.x, 12), window.innerWidth - width - 12)
  const top   = anchor.y + maxHeight > window.innerHeight ? Math.max(12, anchor.y - maxHeight - 8) : anchor.y + 8

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
      style={{ left, top, width, maxHeight }}
    >
      {data === 'loading' ? (
        <div className="flex items-center justify-center gap-2 py-8 text-[12px] text-slate-400">
          <Loader2 size={14} className="animate-spin" /> Compiling reference…
        </div>
      ) : (
        <>
          <button
            onClick={onClose}
            className="absolute right-2.5 top-2.5 w-5 h-5 flex items-center justify-center rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
          >
            <X size={12} />
          </button>

          <div className="overflow-y-auto">
            {data.map((entry, i) => (
              <div key={i} className={i > 0 ? 'border-t border-slate-100' : undefined}>
                <div className="flex items-start justify-between gap-2 px-4 pt-3.5">
                  {entry.matchedSource && entry.candidates ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[10px] font-semibold uppercase tracking-wide">
                      Ambiguous
                    </span>
                  ) : entry.matchedSource ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#ede9fe] text-[#7c3aed] text-[10px] font-semibold uppercase tracking-wide">
                      Source
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[10px] font-semibold uppercase tracking-wide">
                      Unmatched
                    </span>
                  )}
                </div>

                <div className="px-4 pt-2 pb-3">
                  <p className="text-[13px] font-semibold text-slate-800 leading-snug">
                    {entry.displayTitle}
                  </p>

                  {(entry.authors || entry.year) && (
                    <p className="text-[11.5px] text-slate-500 mt-1">
                      {entry.authors}{entry.authors && entry.year ? ' · ' : ''}{entry.year}
                    </p>
                  )}

                  {entry.abstract && (
                    <p className="text-[11.5px] text-slate-500 mt-2 leading-relaxed line-clamp-4">
                      {entry.abstract}
                    </p>
                  )}

                  {!entry.matchedSource && (
                    <p className="text-[11px] text-amber-600 mt-2 leading-relaxed">
                      No matching source found in this project's literature.
                    </p>
                  )}

                  {entry.candidates && (
                    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                      <p className="text-[11px] font-semibold text-amber-700 leading-snug">
                        {entry.candidates.length} papers in this project match this author and year
                      </p>
                      <p className="text-[11px] text-amber-700/90 mt-1 leading-relaxed">
                        The one shown above may not be the paper you meant. Check the list, and cite the exact
                        paper (for example by adding a, b to the year) if it is not the first.
                      </p>
                      <ul className="mt-1.5 space-y-1.5">
                        {entry.candidates.map(c => (
                          <li key={c.id} className="text-[11px] text-slate-700 leading-snug">
                            <span className="font-medium">{c.title}</span>
                            <span className="text-slate-500"> — {c.authors}</span>
                            {c.viewUrl && (
                              <a href={c.viewUrl} target="_blank" rel="noopener noreferrer"
                                 className="ml-1 inline-flex items-center gap-0.5 text-[#7c3aed] hover:text-[#6d28d9]">
                                view <ExternalLink size={10} />
                              </a>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {entry.viewUrl && (
                    <a
                      href={entry.viewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[#7c3aed] hover:text-[#6d28d9] transition-colors mt-2"
                    >
                      View source <ExternalLink size={12} />
                    </a>
                  )}

                  {flags?.[i] && (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                      <div className="flex items-start gap-1.5">
                        <AlertTriangle size={13} className="text-amber-500 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-amber-700 leading-snug">
                            {flags[i]!.mismatchTypes.map(t => MISMATCH_LABELS[t] ?? t).join(' · ')}
                          </p>
                          {flags[i]!.claimSentence && (
                            <p className="text-[11px] text-amber-700/90 mt-1.5 leading-relaxed">
                              <span className="font-medium">Claim: </span>
                              <span className="line-clamp-3">{flags[i]!.claimSentence}</span>
                            </p>
                          )}
                          {flags[i]!.actualAbstractExcerpt && (
                            <p className="text-[11px] text-amber-700/90 mt-1.5 leading-relaxed line-clamp-3">
                              <span className="font-medium">Source abstract says: </span>
                              {flags[i]!.actualAbstractExcerpt}
                            </p>
                          )}
                          {flags[i]!.llmReasoning && (
                            <p className="text-[10.5px] text-amber-600/80 mt-1.5 italic leading-relaxed">
                              {flags[i]!.llmReasoning}
                            </p>
                          )}
                          {flags[i]!.mismatchTypes.includes('AmbiguousCitation') && onChooseSource && (
                            <AmbiguousSourceChooser
                              candidates={candidatesForAmbiguousFlag(flags[i]!.literatureId, literature)}
                              busy={busyFlagId === flags[i]!.id}
                              onChoose={id => onChooseSource(flags[i]!.id, id)}
                            />
                          )}
                          <div className="mt-2 flex flex-wrap gap-1">
                            {onRepairFlag && !flags[i]!.mismatchTypes.includes('AmbiguousCitation') && <button disabled={busyFlagId === flags[i]!.id || !!citationFixBlockedReason(flags[i]!, 'RewriteClaim')} title={citationFixBlockedReason(flags[i]!, 'RewriteClaim')} onClick={() => onRepairFlag(flags[i]!.id, 'RewriteClaim')} className="rounded border border-violet-200 bg-white px-1.5 py-1 text-[10px] font-semibold text-violet-700 disabled:opacity-50">Rewrite</button>}
                            {onRepairFlag && !flags[i]!.mismatchTypes.includes('AmbiguousCitation') && <button disabled={busyFlagId === flags[i]!.id || !!citationFixBlockedReason(flags[i]!, 'ReplaceCitation')} title={citationFixBlockedReason(flags[i]!, 'ReplaceCitation')} onClick={() => { setReplaceFlagId(flags[i]!.id); setReplacementQuery('') }} className="rounded border border-violet-200 bg-white px-1.5 py-1 text-[10px] font-semibold text-violet-700 disabled:opacity-50">Replace source</button>}
                            {onRepairFlag && !flags[i]!.mismatchTypes.includes('AmbiguousCitation') && <button disabled={busyFlagId === flags[i]!.id || !!citationFixBlockedReason(flags[i]!, 'MarkResearcherProposed')} title={citationFixBlockedReason(flags[i]!, 'MarkResearcherProposed')} onClick={() => onRepairFlag(flags[i]!.id, 'MarkResearcherProposed')} className="rounded border border-slate-200 bg-white px-1.5 py-1 text-[10px] font-semibold text-slate-600 disabled:opacity-50">Researcher-proposed</button>}
                            {onRemoveClaim && <button disabled={busyFlagId === flags[i]!.id} onClick={() => onRemoveClaim(flags[i]!.id)} className="rounded border border-red-200 bg-white px-1.5 py-1 text-[10px] font-semibold text-red-600 disabled:opacity-50">Remove claim</button>}
                            {onDismissFlag && <button disabled={busyFlagId === flags[i]!.id} onClick={() => { setDismissFlagId(flags[i]!.id); setDismissReason('') }} className="px-1 py-1 text-[10px] font-semibold text-amber-800 underline disabled:opacity-50">Dismiss</button>}
                          </div>
                          {replaceFlagId === flags[i]!.id && (
                            <div className="mt-2">
                              <input value={replacementQuery} onChange={e => setReplacementQuery(e.target.value)} placeholder="Search approved sources" className="w-full rounded border border-amber-200 bg-white px-2 py-1 text-[10.5px]" />
                              {replacementQuery.trim().length >= 2 && (
                                <div className="mt-1 max-h-28 overflow-y-auto rounded border border-slate-200 bg-white">
                                  {literature.filter(source => source.includedByStudent && source.id !== flags[i]!.literatureId && `${source.title} ${source.authors}`.toLocaleLowerCase().includes(replacementQuery.trim().toLocaleLowerCase())).slice(0, 25).map(source => (
                                    <button key={source.id} onClick={() => onRepairFlag?.(flags[i]!.id, 'ReplaceCitation', source.id)} className="block w-full border-b border-slate-100 px-2 py-1.5 text-left text-[10px] text-slate-600 last:border-0 hover:bg-violet-50">
                                      {source.authors} ({source.year}) — {source.title}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          {dismissFlagId === flags[i]!.id && (
                            <div className="mt-2 flex gap-1">
                              <input value={dismissReason} onChange={e => setDismissReason(e.target.value)} maxLength={500} placeholder="Reason (optional)" className="min-w-0 flex-1 rounded border border-amber-200 bg-white px-2 py-1 text-[10.5px]" />
                              <button onClick={() => onDismissFlag?.(flags[i]!.id, dismissReason.trim() || undefined)} className="rounded bg-amber-700 px-2 py-1 text-[10px] font-semibold text-white">Confirm</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end px-4 py-2.5 border-t border-slate-100 bg-slate-50/60 shrink-0">
            <button
              onClick={onRemove}
              className="flex items-center gap-1.5 text-[11.5px] font-medium text-slate-500 hover:text-red-600 transition-colors"
            >
              <Trash2 size={12} /> Remove citation{data.length > 1 ? ' (all)' : ''}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
