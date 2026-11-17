import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ChevronDown, ChevronUp, Copy, Info, LocateFixed, RotateCw, Search, WifiOff } from 'lucide-react'
import toast from 'react-hot-toast'
import type { CitationCard, CitationCheckReport } from '../../../types/citationCheck'
import {
  attentionLine, FILTER_LABELS, filterCards, filterCounts, headline, isTerminal, limitNote, lockedNote, progress, queueNotice,
  scoreTone, summaryChips, type CardFilter,
} from '../../../lib/citationCheckView'
import { cn } from '../../../lib/utils'
import { dismissalKey, loadDismissed, saveDismissed } from '../../../lib/citationCheckOverstatement'
import { markTone, splitParagraphs } from '../../../lib/citationHighlights'
import {
  allCorrectedReferences, groupByReference, groupBySection, hasHeadings, isRetryable, searchCards, sortCards, stepIssue,
  type CardGroup, type GroupMode, type SortMode,
} from '../../../lib/citationResults'
import { cardElementId, goToCard, goToMark, tintMark } from '../../../lib/citationLinking'
import type { ExportFormat } from '../../../lib/documentExport'
import { DownloadMenu } from '../DownloadMenu'
import { CitationCardView, CollapsedCitationRow, TONE_CLASS, ToneBadge } from './CitationCheckCardView'

const FILTER_ORDER: CardFilter[] = ['all', 'attention', 'differs', 'supported', 'unverified', 'locked']

// What each summary chip filters to. Chips with no matching filter (strongly worded) stay plain text.
const CHIP_FILTER: Record<string, CardFilter | undefined> = {
  supported: 'supported', partial: 'attention', notSupported: 'attention', contradicted: 'attention', yearMismatch: 'attention',
  cannotVerify: 'unverified', locked: 'locked',
}

interface Props {
  report: CitationCheckReport
  /** The connection to the server dropped; the check may still be running. */
  lostMessage: string | null
  queuedForMs: number
  onRetry: () => void
  /** Add a citation to the writer's reference list. Absent: the button is not offered. */
  onAddReference?: (card: CitationCard) => void
  /** The draft is shown beside the results, so each card can point at its passage. */
  linkedToDocument?: boolean
  /** The draft text, used only to group results by the section they are in. */
  draftText?: string
  /** Run only the failed citations again (optionally just these). Absent: the button is not offered. */
  onRetryFailed?: (ids?: string[]) => void
  /** Download the report. Absent: the control is not offered. */
  onDownload?: (format: ExportFormat) => void
  downloadBusy?: ExportFormat | null
}

function ProgressBar({ report }: { report: CitationCheckReport }) {
  const p = progress(report)
  return (
    <div className="space-y-1.5">
      <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100}
        aria-valuenow={p.indeterminate ? undefined : Math.round(p.fraction * 100)} aria-label={p.label}>
        <div className={cn('h-full rounded-full bg-purple-accent transition-all duration-500', p.indeterminate && 'w-1/3 animate-pulse')}
          style={p.indeterminate ? undefined : { width: `${Math.round(p.fraction * 100)}%` }} />
      </div>
      <p className="text-[12px] text-slate-700">{p.label}</p>
    </div>
  )
}

const selectClass = 'text-[12px] rounded-lg border border-[#e0e0da] bg-white px-2 py-1.5 text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent'
const actionClass = 'inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1.5 rounded-lg border border-[#e0e0da] bg-white text-slate-800 hover:bg-neutral-50 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent'

export function CitationCheckReportView({
  report, lostMessage, queuedForMs, onRetry, onAddReference, linkedToDocument = false, draftText, onRetryFailed, onDownload, downloadBusy = null,
}: Props) {
  const [filter, setFilter] = useState<CardFilter>('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortMode>('issues')
  const [group, setGroup] = useState<GroupMode>('none')
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const [currentIssue, setCurrentIssue] = useState<string | null>(null)
  const [jumpTo, setJumpTo] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => loadDismissed(report.runId))
  const dismissOverstatement = (card: CitationCard) => {
    if (!card.overstatement) return
    const next = new Set(dismissed).add(dismissalKey(card, card.overstatement))
    setDismissed(next)
    saveDismissed(report.runId, next)
  }
  const finished = isTerminal(report.status)
  const failed = report.status === 'Failed'

  const paragraphs = useMemo(() => (draftText ? splitParagraphs(draftText) : []), [draftText])
  const sectionsAvailable = draftText ? hasHeadings(paragraphs) : false

  const counts = useMemo(() => filterCounts(report.cards), [report.cards])
  const visible = useMemo(
    () => sortCards(searchCards(filterCards(report.cards, filter), query), sort),
    [report.cards, filter, query, sort],
  )
  const groups: CardGroup[] | null = useMemo(() => {
    if (group === 'reference') return groupByReference(visible)
    if (group === 'section' && sectionsAvailable && draftText) return groupBySection(visible, paragraphs, draftText)
    return null
  }, [group, visible, sectionsAvailable, draftText, paragraphs])

  const chips = summaryChips(report.summary)
  const attention = attentionLine(report.cards)
  const notices = [limitNote(report), queueNotice(report.status, queuedForMs)].filter((n): n is string => !!n)
  const lockNote = lockedNote(report)
  const score = report.summary.integrityScore
  const issueCount = counts.attention
  const corrected = useMemo(() => allCorrectedReferences(report.cards), [report.cards])
  const failedCards = useMemo(() => report.cards.filter(isRetryable), [report.cards])

  // A jump may need the list to show everything first (a filter or search could be hiding the card), so it waits for that render.
  useEffect(() => {
    if (!jumpTo) return
    const id = jumpTo
    const t = window.setTimeout(() => { goToCard(id); if (linkedToDocument) goToMark(id); setJumpTo(null) }, 0)
    return () => window.clearTimeout(t)
  }, [jumpTo, linkedToDocument])

  const step = (direction: 1 | -1) => {
    const next = stepIssue([...report.cards].sort((a, b) => a.ordinal - b.ordinal), currentIssue, direction)
    if (!next) return
    if (filter !== 'all' && !matchesVisible(next)) { setFilter('all'); setQuery('') }
    else if (query && !matchesVisible(next)) setQuery('')
    setCurrentIssue(next.id)
    setJumpTo(next.id)
  }
  const matchesVisible = (c: CitationCard) => visible.some(v => v.id === c.id)

  const copyAllCorrected = async () => {
    try {
      await navigator.clipboard.writeText(corrected.join('\n\n'))
      toast.success(corrected.length === 1 ? 'Copied 1 corrected reference.' : `Copied ${corrected.length} corrected references.`)
    } catch {
      toast.error('Clipboard access denied')
    }
  }

  const renderCard = (c: CitationCard) => {
    const collapsed = !c.locked && markTone(c) === 'ok' && !expanded.has(c.id)
    return (
      // The wrapper is the link target for a clicked highlight (focusable by script, not by Tab) and the click target for going
      // the other way. Clicks on the card's own links and buttons keep their own meaning.
      <div key={c.id} id={cardElementId(c.id)} tabIndex={-1}
        className="cc-card-wrap rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-purple-accent"
        onClick={linkedToDocument && !c.locked && !collapsed ? (e) => { if (!(e.target as HTMLElement).closest('a,button,summary,details,input,textarea')) goToMark(c.id) } : undefined}
        onMouseEnter={linkedToDocument ? () => tintMark(c.id, true) : undefined}
        onMouseLeave={linkedToDocument ? () => tintMark(c.id, false) : undefined}
        onFocus={linkedToDocument ? () => tintMark(c.id, true) : undefined}
        onBlur={linkedToDocument ? () => tintMark(c.id, false) : undefined}>
        {collapsed ? (
          <CollapsedCitationRow card={c} onOpen={() => setExpanded(new Set(expanded).add(c.id))} />
        ) : (
          <>
            <CitationCardView card={c} onAddReference={onAddReference}
              dismissedOverstatements={dismissed} onDismissOverstatement={dismissOverstatement}
              onRetry={onRetryFailed ? () => onRetryFailed([c.id]) : undefined} />
            <div className="mt-1 ml-1 flex items-center gap-3">
              {linkedToDocument && !c.locked && (
                <button type="button" onClick={() => goToMark(c.id)}
                  className="inline-flex items-center gap-1 text-[11.5px] font-medium text-slate-600 hover:text-purple-text focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent rounded">
                  <LocateFixed size={11} aria-hidden /> Show in document
                </button>
              )}
              {!c.locked && markTone(c) === 'ok' && (
                <button type="button" onClick={() => { const n = new Set(expanded); n.delete(c.id); setExpanded(n) }}
                  className="text-[11.5px] font-medium text-slate-600 hover:text-purple-text focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent rounded">
                  Collapse
                </button>
              )}
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {/* Result or progress */}
      <div className="rounded-xl border border-[#e0e0da] bg-white p-4 space-y-3">
        {finished && !failed ? (
          <div className="flex items-center gap-4">
            <div className={cn('shrink-0 w-16 h-16 rounded-2xl border flex flex-col items-center justify-center', TONE_CLASS[scoreTone(score)])}>
              <span className="text-[22px] font-semibold leading-none tabular-nums">{score ?? '–'}</span>
              {score !== null && <span className="text-[9px] uppercase tracking-wide mt-0.5">of 100</span>}
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-medium text-slate-900">{headline(report)}</p>
              {attention && <p className="text-[12px] text-slate-700 mt-0.5">{attention}</p>}
              <p className="text-[11px] text-slate-600 mt-1">Citations we could not verify are left out of the score.</p>
            </div>
          </div>
        ) : failed ? (
          <p className="text-[14px] font-medium text-red-600">{headline(report)}</p>
        ) : (
          <ProgressBar report={report} />
        )}

        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5" aria-label="Filter by status">
            {chips.map(c => {
              const target = CHIP_FILTER[c.key]
              const badge = <ToneBadge tone={c.tone}>{c.count} {c.label.toLowerCase()}</ToneBadge>
              return target ? (
                <button key={c.key} type="button" onClick={() => setFilter(target)} aria-pressed={filter === target}
                  title={`Show: ${FILTER_LABELS[target]}`}
                  className={cn('rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent', filter === target && 'ring-2 ring-purple-accent')}>
                  {badge}
                </button>
              ) : <span key={c.key}>{badge}</span>
            })}
          </div>
        )}
      </div>

      {lostMessage && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 flex items-start gap-2.5">
          <WifiOff size={14} className="text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-[12px] text-amber-800">{lostMessage}</p>
            <button type="button" onClick={onRetry} className="mt-1.5 text-[12px] font-semibold text-amber-800 underline">Try again</button>
          </div>
        </div>
      )}

      {notices.map(n => (
        <p key={n} className="text-[12px] text-slate-700 flex items-start gap-2">
          <Info size={13} className="mt-0.5 shrink-0 text-slate-600" /> <span>{n}</span>
        </p>
      ))}

      {lockNote && (
        <p className="text-[12px] text-slate-700 flex items-start gap-2">
          <Info size={13} className="mt-0.5 shrink-0 text-slate-600" />
          <span>{lockNote} <Link to="/app/upgrade" className="text-purple-text font-medium hover:underline">See plans</Link></span>
        </p>
      )}

      {report.warnings.map(w => (
        <p key={w} className="text-[12px] text-amber-700 flex items-start gap-2">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" /> <span>{w}</span>
        </p>
      ))}

      {report.cards.length > 0 && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter citations">
            {FILTER_ORDER.filter(f => f === 'all' || counts[f] > 0).map(f => (
              <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}
                className={cn('text-[12px] px-2.5 py-1 rounded-full border transition-colors',
                  filter === f ? 'bg-purple-accent text-white border-purple-accent' : 'bg-white text-slate-700 border-[#e0e0da] hover:bg-neutral-50')}>
                {FILTER_LABELS[f]} <span className="tabular-nums opacity-70">{counts[f]}</span>
              </button>
            ))}
          </div>

          {/* Find, order, group */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative flex-1 min-w-[160px]">
              <span className="sr-only">Search citations by author or year</span>
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search author or year…"
                className="w-full text-[12px] rounded-lg border border-[#e0e0da] bg-white pl-8 pr-2 py-1.5 text-slate-900 placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent" />
            </label>
            <label className="flex items-center gap-1.5 text-[12px] text-slate-700">Sort
              <select value={sort} onChange={e => setSort(e.target.value as SortMode)} className={selectClass}>
                <option value="issues">Issues first</option>
                <option value="document">Document order</option>
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-[12px] text-slate-700">Group
              <select value={group} onChange={e => setGroup(e.target.value as GroupMode)} className={selectClass}>
                <option value="none">None</option>
                <option value="reference">By reference</option>
                {sectionsAvailable && <option value="section">By section</option>}
              </select>
            </label>
          </div>

          {/* Walk through the problems, and act on all of them */}
          <div className="flex flex-wrap items-center gap-2">
            {issueCount > 0 && (
              <div className="inline-flex items-center gap-1" role="group" aria-label="Go through citations that need attention">
                <button type="button" onClick={() => step(-1)} className={actionClass} aria-label="Previous issue"><ChevronUp size={13} aria-hidden /> Previous</button>
                <button type="button" onClick={() => step(1)} className={actionClass} aria-label="Next issue">Next issue <ChevronDown size={13} aria-hidden /></button>
                <span className="text-[12px] text-slate-700 ml-1" aria-live="polite">{issueCount} need{issueCount === 1 ? 's' : ''} attention</span>
              </div>
            )}
            <span className="flex-1" />
            {corrected.length > 0 && (
              <button type="button" onClick={copyAllCorrected} className={actionClass}>
                <Copy size={12} aria-hidden /> Copy all corrected references ({corrected.length})
              </button>
            )}
            {finished && failedCards.length > 0 && onRetryFailed && (
              <button type="button" onClick={() => onRetryFailed()} className={actionClass}>
                <RotateCw size={12} aria-hidden /> Retry {failedCards.length} failed
              </button>
            )}
            {finished && !failed && onDownload && (
              <DownloadMenu busyFormat={downloadBusy} onDownload={onDownload} label="Download report" />
            )}
          </div>
        </>
      )}

      {/* Cards: issues first by default, supported ones as single lines */}
      <div className="space-y-3">
        {groups
          ? groups.map(g => (
            <details key={g.key} open={g.issues > 0 || groups.length <= 6} className="rounded-xl border border-[#e0e0da] bg-slate-50/60">
              <summary className="cursor-pointer px-3.5 py-2 flex flex-wrap items-center gap-2 text-[13px] font-medium text-slate-900">
                <span>{g.label}</span>
                <span className="text-[12px] font-normal text-slate-600">
                  {group === 'reference' && g.cards.length > 1 ? `cited ${g.cards.length} times` : `${g.cards.length} citation${g.cards.length === 1 ? '' : 's'}`}
                  {g.issues > 0 ? ` · ${g.issues} need${g.issues === 1 ? 's' : ''} attention` : ''}
                </span>
              </summary>
              <div className="space-y-2 px-2 pb-2">{g.cards.map(renderCard)}</div>
            </details>
          ))
          : visible.map(renderCard)}
        {visible.length === 0 && report.cards.length > 0 && <p className="text-[12px] text-slate-600 text-center py-4">Nothing matches.</p>}
      </div>

      {report.unusedReferences.length > 0 && (
        <details className="rounded-xl border border-[#e0e0da] bg-white px-3.5 py-3">
          <summary className="cursor-pointer text-[12px] font-medium text-slate-700">
            {report.unusedReferences.length} reference{report.unusedReferences.length === 1 ? '' : 's'} in your list never cited in the text
          </summary>
          <ul className="mt-2 space-y-1.5 text-[12px] text-slate-700 list-disc pl-4">
            {report.unusedReferences.map(r => <li key={r} className="break-words">{r}</li>)}
          </ul>
        </details>
      )}
    </div>
  )
}

