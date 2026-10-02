import { useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, BookMarked, ChevronRight, Loader2, Plus, RefreshCw, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { ParsedReference } from '../../lib/citationFormat'
import type { CitationFixAction, CitationFlag, CitationMismatchType, CitationStyle, FetchedLiterature } from '../../types/research'
import { getReplacementCandidates, MIN_REPLACEMENT_QUERY_LENGTH } from './replacementCandidates'
import { citationFixBlockedReason } from './citationFixOptions'

interface ReferencesDrawerProps {
  open:          boolean
  onClose:       () => void
  loading:       boolean
  entries:       ParsedReference[]
  citationStyle: CitationStyle
  onInsert:      (ref: ParsedReference, index: number) => void
  onRefresh:     () => void
  onManageFull:  () => void
  flags?:        CitationFlag[]
  literature?:   FetchedLiterature[]
  busyFlagId?:   string | null
  onRepairFlag?: (flagId: string, action: CitationFixAction, replacementLiteratureId?: string) => void
  onRemoveClaim?: (flagId: string) => void
  onDismissFlag?: (flagId: string, reason?: string) => void
}

const CITATION_LABELS: Record<CitationStyle, string> = {
  apa7:    'APA 7',
  harvard: 'Harvard',
  mla:     'MLA',
  ieee:    'IEEE',
}

const FLAG_LABELS: Record<CitationMismatchType, string> = {
  ClaimContentMismatch: 'The source does not support this claim',
  ClaimPartialMatch: 'The source only partially supports this claim',
  ImplausibleYear: 'The publication year is implausible',
  JournalMismatch: 'The journal does not match the verified source',
  AuthorMismatch: 'The authors do not match the verified source',
  VenueMismatch: 'The publication venue does not match',
  UnresolvedCitation: 'This citation could not be matched to a source',
  MissingSourceData: 'There is not enough source data to verify this citation',
  OverusedInSection: 'This source is cited too many times in this section',
  UnresolvedGapMarker: 'This claim still needs a citation',
  OrphanedReference: 'This bibliography entry is not cited in the section',
  MalformedCitationShape: 'This looks like a reference-list line with no citing sentence around it',
  BibliographicDetailMismatch: 'The bibliography details differed from the verified source',
  TemporallyImpossibleSource: 'The source predates a year asserted by this claim',
  GeographicMismatch: 'The source evidence does not cover the country or region claimed',
  GeneralizationBeyondSample: 'The claim generalises beyond the verified sample',
  PopulationScopeViolation: 'The source population or institutional scope does not match the claim',
}

export const getActiveCitationFlags = (flags: CitationFlag[]) =>
  flags.filter(flag => flag.status === 'Open')

export function getFlaggedSourceLabel(flag: CitationFlag): string | null {
  if (!flag.literatureId && !flag.doi) return null
  const source = flag.sourceAuthors || flag.sourceTitle || flag.doi
  if (!source) return null
  return `${source}${flag.sourceYear ? ` (${flag.sourceYear})` : ''}`
}

export function ReferencesDrawer({
  open, onClose, loading, entries, citationStyle, onInsert, onRefresh, onManageFull,
  flags = [], literature = [], busyFlagId, onRepairFlag, onRemoveClaim, onDismissFlag,
}: ReferencesDrawerProps) {
  const [replaceFlagId, setReplaceFlagId] = useState<string | null>(null)
  const [dismissFlagId, setDismissFlagId] = useState<string | null>(null)
  const [dismissReason, setDismissReason] = useState('')
  const [replacementQuery, setReplacementQuery] = useState('')
  if (!open) return null
  // The backend endpoint is active-only; retain this presentation-boundary guard so an older or
  // stale deployment cannot turn resolved audit history back into student-facing issue cards.
  const openFlags = getActiveCitationFlags(flags)

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ type: 'spring', damping: 28, stiffness: 340 }}
      className="fixed top-0 right-0 bottom-0 w-[360px] bg-white shadow-2xl border-l border-slate-100 z-40 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-100 shrink-0">
        <div className="w-8 h-8 rounded-xl bg-[#ede9fe] flex items-center justify-center shrink-0">
          <BookMarked size={16} className="text-[#7c3aed]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-slate-800 leading-none">References</p>
          <p className="text-[11px] text-slate-400 mt-0.5 truncate">
            {loading
              ? 'Compiling…'
              : `${openFlags.length} section issue${openFlags.length === 1 ? '' : 's'} · ${entries.length} project reference${entries.length === 1 ? '' : 's'} · ${CITATION_LABELS[citationStyle]}`}
          </p>
        </div>
        <button
          onClick={onRefresh}
          title="Refresh"
          disabled={loading}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition-colors shrink-0"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
        >
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {openFlags.length > 0 && (
          <section className="mb-4" aria-label="Citation issues">
            <div className="mb-2 flex items-center gap-1.5 px-1">
              <AlertTriangle size={14} className="text-amber-500" />
              <h3 className="text-[12px] font-semibold text-amber-800">
                {openFlags.length} citation issue{openFlags.length === 1 ? '' : 's'} in this section
              </h3>
            </div>
            <ul className="space-y-2">
              {openFlags.map(flag => {
                const flaggedSource = getFlaggedSourceLabel(flag)
                const rewriteBlocked = citationFixBlockedReason(flag, 'RewriteClaim')
                const replaceBlocked = citationFixBlockedReason(flag, 'ReplaceCitation')
                const markBlocked = citationFixBlockedReason(flag, 'MarkResearcherProposed')
                return (
                <li key={flag.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-[11.5px] font-semibold leading-snug text-amber-800">
                    {flag.mismatchTypes.map(type => FLAG_LABELS[type] ?? type).join(' · ')}
                  </p>
                  {flaggedSource && (
                    <p className="mt-1.5 text-[11px] font-semibold text-slate-800">
                      Flagged source: {flaggedSource}
                    </p>
                  )}
                  {flag.citationRawText && (
                    <p className="mt-1.5 text-[11px] font-medium text-slate-700">Citation group: {flag.citationRawText}</p>
                  )}
                  {flag.claimSentence && (
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                      <span className="font-medium">Claim:</span> {flag.claimSentence}
                    </p>
                  )}
                  {flag.actualAbstractExcerpt && (
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                      <span className="font-medium">Verified source:</span> {flag.actualAbstractExcerpt}
                    </p>
                  )}
                  {flag.llmReasoning && (
                    <p className="mt-1 text-[10.5px] italic leading-relaxed text-amber-700">{flag.llmReasoning}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {onRepairFlag && <button disabled={busyFlagId === flag.id || !!rewriteBlocked} title={rewriteBlocked} type="button" onClick={() => onRepairFlag(flag.id, 'RewriteClaim')} className="rounded-md bg-white px-2 py-1 text-[10.5px] font-semibold text-violet-700 border border-violet-200 disabled:opacity-50">Rewrite claim</button>}
                    {onRepairFlag && <button disabled={busyFlagId === flag.id || !!replaceBlocked} title={replaceBlocked} type="button" onClick={() => { setReplaceFlagId(replaceFlagId === flag.id ? null : flag.id); setReplacementQuery('') }} className="rounded-md bg-white px-2 py-1 text-[10.5px] font-semibold text-violet-700 border border-violet-200 disabled:opacity-50">Replace citation</button>}
                    {onRepairFlag && <button disabled={busyFlagId === flag.id || !!markBlocked} title={markBlocked} type="button" onClick={() => onRepairFlag(flag.id, 'MarkResearcherProposed')} className="rounded-md bg-white px-2 py-1 text-[10.5px] font-semibold text-slate-600 border border-slate-200 disabled:opacity-50">Researcher-proposed</button>}
                    {onRemoveClaim && <button disabled={busyFlagId === flag.id} type="button" onClick={() => onRemoveClaim(flag.id)} className="rounded-md bg-white px-2 py-1 text-[10.5px] font-semibold text-red-600 border border-red-200 disabled:opacity-50">Remove claim</button>}
                    {onDismissFlag && (() => {
                      // Dismiss only ever confirms a genuine false positive — that requires having
                      // checked the source's full text, not just its abstract, which is all this
                      // verdict was judged against. Backend also rejects this (defense in depth).
                      const abstractOnly = flag.coverage === 'MetadataOnly' || flag.coverage === 'Abstract'
                      return (
                        <button
                          disabled={busyFlagId === flag.id || abstractOnly}
                          type="button"
                          title={abstractOnly ? 'Checked against the abstract only — verify the full text before dismissing' : undefined}
                          onClick={() => { setDismissFlagId(dismissFlagId === flag.id ? null : flag.id); setDismissReason('') }}
                          className="rounded-md px-2 py-1 text-[10.5px] font-semibold text-amber-800 underline disabled:opacity-50 disabled:no-underline"
                        >
                          Dismiss
                        </button>
                      )
                    })()}
                  </div>
                  {replaceFlagId === flag.id && (() => {
                    // The picker can only offer APPROVED sources, because PreviewCitationFixAsync
                    // rejects anything else. On most real projects that set is empty (candidates in
                    // the thousands, approved in the single digits), which used to render as a
                    // search box and a permanently empty dropdown — the action looked broken. When
                    // there is nothing to pick, offer the backend's own no-source-supplied path
                    // instead: it runs one live search keyed on this claim and verifies the result
                    // against it before proposing anything. That branch has existed since
                    // docs/OPEN_ITEMS.md #56 and was until now unreachable from the UI.
                    const { eligible, matches, queryTooShort } =
                      getReplacementCandidates(literature, flag, replacementQuery)
                    const findAutomatically = (
                      <button
                        type="button"
                        disabled={busyFlagId === flag.id}
                        onClick={() => onRepairFlag?.(flag.id, 'ReplaceCitation')}
                        className="rounded-md bg-violet-600 px-2 py-1 text-[10.5px] font-semibold text-white disabled:opacity-50"
                      >
                        Find a supporting source
                      </button>
                    )
                    return (
                      <div className="mt-2 rounded-md border border-violet-200 bg-white p-2">
                        {eligible.length === 0 ? (
                          <>
                            <p className="text-[10.5px] font-semibold text-slate-600">No approved sources to choose from</p>
                            <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                              {literature.length === 0
                                ? 'This project has no literature loaded yet.'
                                : `This project has ${literature.length} candidate source${literature.length === 1 ? '' : 's'}, but none approved — only approved sources can be picked by hand.`}
                              {' '}Search for one that actually supports this claim, or approve sources first.
                            </p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              {findAutomatically}
                              <button type="button" onClick={onManageFull} className="rounded-md bg-white px-2 py-1 text-[10.5px] font-semibold text-slate-600 border border-slate-200">
                                Approve sources…
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="mb-1 text-[10.5px] font-semibold text-slate-600">
                              Choose an approved replacement source ({eligible.length} available)
                            </p>
                            <input value={replacementQuery} onChange={e => setReplacementQuery(e.target.value)} placeholder="Search title or author" className="mb-1.5 w-full rounded border border-slate-200 p-1.5 text-[11px]" />
                            <select value="" onChange={e => { if (e.target.value) onRepairFlag?.(flag.id, 'ReplaceCitation', e.target.value) }} className="w-full rounded border border-slate-200 p-1.5 text-[11px]">
                              <option value="" disabled>Select source…</option>
                              {matches.map(source => (
                                <option key={source.id} value={source.id}>{source.authors} ({source.year}) — {source.title}</option>
                              ))}
                            </select>
                            {queryTooShort
                              ? <p className="mt-1 text-[10px] text-slate-400">Enter at least {MIN_REPLACEMENT_QUERY_LENGTH} characters to search these {eligible.length} sources.</p>
                              : matches.length === 0 && <p className="mt-1 text-[10px] text-slate-400">No approved source matches that search.</p>}
                            <div className="mt-1.5">{findAutomatically}</div>
                          </>
                        )}
                      </div>
                    )
                  })()}
                  {dismissFlagId === flag.id && (
                    <div className="mt-2 flex gap-1.5">
                      <input value={dismissReason} onChange={e => setDismissReason(e.target.value)} maxLength={500} placeholder="Reason (optional)" className="min-w-0 flex-1 rounded border border-amber-200 bg-white px-2 py-1 text-[11px]" />
                      <button type="button" onClick={() => onDismissFlag?.(flag.id, dismissReason.trim() || undefined)} className="rounded bg-amber-700 px-2 py-1 text-[10.5px] font-semibold text-white">Confirm</button>
                    </div>
                  )}
                </li>
                )
              })}
            </ul>
          </section>
        )}
        {!loading && entries.length > 0 && (
          <h3 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Project bibliography ({entries.length})
          </h3>
        )}
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
            <Loader2 size={20} className="animate-spin text-[#7c3aed]" />
            <p className="text-[12px] text-slate-400">Compiling bibliography…</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
            <BookMarked size={22} className="text-slate-300" />
            <p className="text-[12px] text-slate-500 font-medium">No references yet</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Generate at least one section first, then refresh this panel.
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {entries.map((ref, i) => (
              <li key={ref.id} className="group relative rounded-lg border border-slate-100 hover:border-[#ddd6fe] hover:bg-[#faf5ff] transition-colors">
                <div className="flex items-start gap-2 px-3 py-2.5">
                  <p className="flex-1 min-w-0 text-[12px] text-slate-600 leading-relaxed line-clamp-3">
                    {ref.raw}
                  </p>
                  <button
                    onClick={() => onInsert(ref, i)}
                    title="Insert citation at cursor"
                    className={cn(
                      'shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-all',
                      'bg-[#ede9fe] text-[#7c3aed] opacity-70 group-hover:opacity-100 hover:bg-[#7c3aed] hover:text-white',
                    )}
                  >
                    <Plus size={13} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-100 px-3 py-2.5 shrink-0">
        <button
          onClick={onManageFull}
          className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[12px] text-slate-500 hover:text-[#7c3aed] hover:bg-[#faf5ff] transition-colors"
        >
          <span>Manage full bibliography</span>
          <ChevronRight size={13} />
        </button>
      </div>
    </motion.div>
  )
}
