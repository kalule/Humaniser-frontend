import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle, ChevronDown, Download, ExternalLink, FileText, History, Keyboard, Loader2, RefreshCw, Settings2,
  ShieldCheck, Square, Undo2, Users,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '../../../lib/utils'
import { Modal } from '../../ui/Modal'
import { ledgerErrorMessage, screeningLedgerApi } from '../../../api/screeningLedger'
import {
  DECISION_LABELS, STATE_LABELS, decisionForKey, decisionOptions, exclusionReasonError, percent, progressLines, rankingSummary,
} from '../../../lib/screeningLedger'
import type {
  LedgerExportFormat, QueueView, ScreeningLabel, ScreeningLabelDecision, ScreeningQueue, ScreeningStage,
} from '../../../types/screeningLedger'
import ScreeningSettingsDialog from './ScreeningSettingsDialog'
import StopScreeningDialog from './StopScreeningDialog'

interface LedgerScreeningPanelProps {
  reviewId: string
  stage:    ScreeningStage
  /** Called after any change that may alter counts shown elsewhere in the workspace. */
  onChanged?: () => void
}

const TONE: Record<'green' | 'red' | 'amber' | 'slate', string> = {
  green: 'bg-green-accent hover:brightness-95 text-white',
  red:   'bg-red-500 hover:bg-red-600 text-white',
  amber: 'bg-amber-accent hover:brightness-95 text-white',
  slate: 'bg-slate-600 hover:bg-slate-700 text-white',
}

const CHIP: Record<'green' | 'red' | 'amber' | 'slate', string> = {
  green: 'bg-green-tint text-green-text border-green-200',
  red:   'bg-red-50 text-red-700 border-red-200',
  amber: 'bg-amber-tint text-amber-text border-amber-200',
  slate: 'bg-slate-50 text-slate-600 border-slate-200',
}

const VIEW_LABELS: Record<QueueView, string> = {
  next: 'To screen', unresolved: 'Unresolved', reassess: 'Reassess', conflicts: 'Disagreements',
}

/** A dialog is open (this panel's own or anyone else's): screening shortcuts must not act behind it. */
function dialogOpen(): boolean {
  return document.querySelector('[aria-modal="true"]') !== null
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export default function LedgerScreeningPanel({ reviewId, stage, onChanged }: LedgerScreeningPanelProps) {
  const [view, setView] = useState<QueueView>('next')
  const [queue, setQueue] = useState<ScreeningQueue | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [excluding, setExcluding] = useState(false)
  const [criterionId, setCriterionId] = useState<string | null>(null)
  const [reasonText, setReasonText] = useState('')
  const [note, setNote] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const [undoStack, setUndoStack] = useState<{ paperId: string; title: string; adjudication: boolean }[]>([])
  const [history, setHistory] = useState<ScreeningLabel[] | null>(null)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showStop, setShowStop] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showExports, setShowExports] = useState(false)
  const [methodsText, setMethodsText] = useState<string | null>(null)
  const [hideAi, setHideAi] = useState<boolean>(() => {
    try { return localStorage.getItem('ledger.hideAi') === '1' } catch { return false }
  })
  const reasonRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async (nextView: QueueView = view) => {
    setLoading(true)
    try {
      const q = await screeningLedgerApi.getQueue(reviewId, stage, nextView, 10)
      setQueue(q)
      setLoadError(null)
    } catch (err) {
      setLoadError(ledgerErrorMessage(err, 'Could not load the screening queue.'))
    } finally {
      setLoading(false)
    }
  }, [reviewId, stage, view])

  useEffect(() => { load(view) }, [reviewId, stage, view]) // eslint-disable-line react-hooks/exhaustive-deps

  // While the order is being updated, poll only its status; the record in front of the reviewer never jumps.
  const rankingState = queue?.ranking.state
  useEffect(() => {
    if (rankingState !== 'queued' && rankingState !== 'running') return
    const timer = window.setInterval(async () => {
      try {
        const ranking = await screeningLedgerApi.getRankingStatus(reviewId, stage)
        setQueue(q => (q ? { ...q, ranking } : q))
      } catch { /* the chip just stays as it was */ }
    }, 4000)
    return () => window.clearInterval(timer)
  }, [rankingState, reviewId, stage])

  const current = queue?.items[0] ?? null
  const canAdjudicate = queue?.access === 'owner' || queue?.access === 'adjudicator'
  const isOwner = queue?.access === 'owner'
  const adjudicating = view === 'conflicts'
  const independent = (queue?.requiredReviewers ?? 1) >= 2
  const aiHidden = hideAi || independent

  const resetForm = () => {
    setExcluding(false)
    setCriterionId(null)
    setReasonText('')
    setNote('')
    setFormError(null)
    setHistory(null)
  }

  const decide = useCallback(async (decision: ScreeningLabelDecision) => {
    if (!current || saving) return
    if (decision === 'Exclude' && !excluding) {
      setExcluding(true)
      setTimeout(() => reasonRef.current?.focus(), 0)
      return
    }
    const problem = exclusionReasonError(decision, criterionId, reasonText)
    if (problem) { setFormError(problem); return }

    setSaving(true)
    try {
      await screeningLedgerApi.recordDecision(reviewId, current.paperId, {
        stage, decision,
        reason: decision === 'Exclude' ? (reasonText.trim() || null) : null,
        exclusionCriterionId: decision === 'Exclude' ? criterionId : null,
        note: note.trim() || null,
        rankingRunId: current.rankingRunId,
        rankPosition: current.rankPosition,
        asAdjudication: adjudicating,
        expectedCurrentLabelId: adjudicating ? null : current.currentLabel?.id ?? null,
      })
      setUndoStack(s => [...s.slice(-19), { paperId: current.paperId, title: current.title, adjudication: adjudicating }])
      resetForm()
      await load()
      onChanged?.()
    } catch (err) {
      setFormError(ledgerErrorMessage(err, 'The decision could not be saved. Nothing was changed.'))
    } finally {
      setSaving(false)
    }
  }, [current, saving, excluding, criterionId, reasonText, note, reviewId, stage, adjudicating, load, onChanged])

  const undo = useCallback(async () => {
    const last = undoStack[undoStack.length - 1]
    if (!last || saving) return
    setSaving(true)
    try {
      await screeningLedgerApi.undo(reviewId, last.paperId, stage, last.adjudication)
      setUndoStack(s => s.slice(0, -1))
      toast.success(`Decision withdrawn: ${last.title.slice(0, 60)}`)
      resetForm()
      await load()
      onChanged?.()
    } catch (err) {
      toast.error(ledgerErrorMessage(err, 'Could not undo that decision.'))
    } finally {
      setSaving(false)
    }
  }, [undoStack, saving, reviewId, stage, load, onChanged])

  const toggleHistory = useCallback(async () => {
    if (!current) return
    if (history) { setHistory(null); return }
    try { setHistory(await screeningLedgerApi.getHistory(reviewId, current.paperId)) }
    catch (err) { toast.error(ledgerErrorMessage(err, 'Could not load the history.')) }
  }, [current, history, reviewId])

  // Keyboard: I/E/U/N decide, 1–9 pick a criterion while excluding, Enter confirms, Esc cancels, Z undoes, H shows history.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (dialogOpen()) return
      if (excluding && e.key === 'Escape') { e.preventDefault(); resetForm(); return }
      if (excluding && e.key === 'Enter') { e.preventDefault(); decide('Exclude'); return }
      if (isTyping(e.target)) return
      if (excluding && /^[1-9]$/.test(e.key) && queue) {
        const c = queue.criteria[Number(e.key) - 1]
        if (c) { e.preventDefault(); setCriterionId(c.id) }
        return
      }
      if (e.key === 'z' || e.key === 'Z') { e.preventDefault(); undo(); return }
      if (e.key === 'h' || e.key === 'H') { e.preventDefault(); toggleHistory(); return }
      if (e.key === '?') { e.preventDefault(); setShowShortcuts(v => !v); return }
      const d = decisionForKey(stage, e.key)
      if (d) { e.preventDefault(); decide(d) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [excluding, decide, undo, toggleHistory, stage, queue])

  const refreshOrder = async () => {
    try {
      const ranking = await screeningLedgerApi.refreshRanking(reviewId, stage)
      setQueue(q => (q ? { ...q, ranking } : q))
    } catch (err) { toast.error(ledgerErrorMessage(err, 'Could not request a new order.')) }
  }

  const runExport = async (format: LedgerExportFormat) => {
    setShowExports(false)
    try {
      const blob = await screeningLedgerApi.exportCsv(reviewId, format)
      download(blob, `${format === 'asreview' ? 'asreview-labels' : format === 'audit' ? 'screening-audit' : 'screening-ledger'}-${reviewId}.csv`)
    } catch (err) { toast.error(ledgerErrorMessage(err, 'The export failed.')) }
  }

  const openMethods = async () => {
    setShowExports(false)
    try { setMethodsText(await screeningLedgerApi.getMethodsText(reviewId)) }
    catch (err) { toast.error(ledgerErrorMessage(err, 'Could not build the methods text.')) }
  }

  if (loading && !queue) {
    return <div className="flex items-center gap-2 text-[13px] text-slate-400 py-10 justify-center"><Loader2 size={14} className="animate-spin" />Loading screening queue…</div>
  }
  if (loadError && !queue) {
    return <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{loadError}</p>
  }
  if (!queue) return null

  const p = queue.progress
  const ranking = rankingSummary(queue.ranking)
  const options = decisionOptions(stage)
  const decided = p.screened + p.unresolved + p.conflicts

  return (
    <div className="mb-6">
      {/* Toolbar: views, order freshness, actions */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="flex p-0.5 bg-slate-100 rounded-lg border border-slate-200">
          {(['next', 'unresolved', 'reassess', ...(canAdjudicate ? ['conflicts'] as const : [])] as QueueView[]).map(v => {
            const count = v === 'unresolved' ? p.unresolved : v === 'reassess' ? p.needsReassessment : v === 'conflicts' ? p.conflicts : p.unscreened
            return (
              <button key={v} onClick={() => { resetForm(); setView(v) }}
                className={cn('px-3 py-1 text-[12px] font-medium rounded-md transition-all',
                  view === v ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                {VIEW_LABELS[v]} ({count})
              </button>
            )
          })}
        </div>

        <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-semibold border rounded-full px-2.5 py-1', CHIP[ranking.tone])}
          title={[queue.ranking.message, queue.ranking.modelName && `Model ${queue.ranking.modelName}, ASReview ${queue.ranking.asReviewVersion ?? '?'}, seed ${queue.ranking.seed ?? '?'}`,
            queue.ranking.serviceAvailable === false ? 'Ranking service unreachable' : null, 'The order is only a suggestion of what to screen first. It is not a probability that a record is eligible.']
            .filter(Boolean).join('\n')}>
          {(queue.ranking.state === 'queued' || queue.ranking.state === 'running') && <Loader2 size={11} className="animate-spin" />}
          {ranking.text}
        </span>

        <div className="flex items-center gap-2 ml-auto">
          {queue.ranking.canTrain && (
            <button onClick={refreshOrder} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
              <RefreshCw size={12} /> Refresh order
            </button>
          )}
          <div className="relative">
            <button onClick={() => setShowExports(v => !v)} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
              <Download size={12} /> Export <ChevronDown size={12} />
            </button>
            {showExports && (
              <div className="absolute right-0 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1 text-[12px]">
                <button onClick={() => runExport('ledger')} className="w-full text-left px-3 py-2 hover:bg-slate-50">Screening ledger (every record, unscreened included)</button>
                <button onClick={() => runExport('audit')} className="w-full text-left px-3 py-2 hover:bg-slate-50">Audit history (every decision and change)</button>
                <button onClick={() => runExport('asreview')} className="w-full text-left px-3 py-2 hover:bg-slate-50">ASReview LAB import file</button>
                <button onClick={openMethods} className="w-full text-left px-3 py-2 hover:bg-slate-50 border-t border-slate-100">Methods text from the record</button>
              </div>
            )}
          </div>
          {isOwner && (
            <>
              <button onClick={() => setShowStop(true)} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
                <Square size={12} /> Stop screening
              </button>
              <button onClick={() => setShowSettings(true)} className="p-1.5 text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50" aria-label="Screening settings">
                <Settings2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Progress: counts only, no recall figure */}
      <div className="border border-slate-200 rounded-xl px-4 py-3 mb-4">
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden flex mb-2" aria-label={`${decided} of ${p.uniqueRecords} decided`}>
          <div className="bg-violet-500" style={{ width: `${percent(p.screened, p.uniqueRecords)}%` }} />
          <div className="bg-amber-400" style={{ width: `${percent(p.unresolved + p.conflicts, p.uniqueRecords)}%` }} />
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-slate-600">
          {progressLines(p).map(line => <span key={line}>{line}</span>)}
          {p.agreement && (
            <span className="inline-flex items-center gap-1"><Users size={12} />
              Agreement {p.agreement.percentAgreement}% over {p.agreement.pairs} records{p.agreement.cohensKappa !== null && `, κ = ${p.agreement.cohensKappa}`}
            </span>
          )}
        </div>
        {p.latestStop && (
          <p className="text-[11px] text-slate-500 mt-2">
            Screening was stopped on {new Date(p.latestStop.stoppedAt).toLocaleDateString()} ({p.latestStop.reason}); {p.latestStop.unscreenedCount} records were left unscreened and remain unscreened. You can still continue.
          </p>
        )}
      </div>

      {!current ? (
        <div className="py-12 text-center border border-slate-200 border-dashed rounded-xl bg-slate-50/50">
          <p className="text-[14px] font-semibold text-slate-600 mb-1">
            {view === 'next' ? (p.uniqueRecords === 0 ? 'No records are in scope for this stage yet.' : 'Nothing left for you to screen here.') : `No records in "${VIEW_LABELS[view]}".`}
          </p>
          {view === 'next' && p.awaitingOtherReviewers > 0 && <p className="text-[12px] text-slate-400">{p.awaitingOtherReviewers} records are waiting for another reviewer's independent decision.</p>}
          {undoStack.length > 0 && (
            <button onClick={undo} className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-violet-600 hover:text-violet-700"><Undo2 size={12} /> Undo last decision</button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="flex flex-wrap items-center gap-2 mb-2 text-[11px]">
                <span className="font-semibold text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">{STATE_LABELS[current.state]}</span>
                {current.rankPosition !== null && (
                  <span className="text-slate-500" title="Its place in the suggested order. Not a probability of eligibility.">#{current.rankPosition} in the suggested order</span>
                )}
                {current.needsReassessment && <span className="font-semibold text-amber-text bg-amber-tint rounded px-1.5 py-0.5">Decided under earlier criteria</span>}
                {current.linkedDuplicates > 0 && <span className="text-slate-500">{current.linkedDuplicates} duplicate record{current.linkedDuplicates > 1 ? 's' : ''} merged into this one</span>}
                {current.evidenceRole === 'Contextual' && <span className="text-slate-500">Marked as background source</span>}
                {current.otherReviewerCount > 0 && !adjudicating && (
                  <span className="inline-flex items-center gap-1 text-slate-500"><ShieldCheck size={11} />
                    {current.otherReviewerCount} other reviewer{current.otherReviewerCount > 1 ? 's have' : ' has'} decided — hidden until you decide
                  </span>
                )}
              </div>
              <h3 className="text-[16px] font-bold text-slate-900 leading-snug mb-1">{current.title}</h3>
              <p className="text-[12px] text-slate-500">
                {current.authors || 'Authors not recorded'}
                {current.publicationDate && ` · ${current.publicationDate}`}
                {current.journal && ` · ${current.journal}`}
                {` · ${current.source}`}
                {current.sourceUrl && (
                  <a href={current.sourceUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-0.5 ml-2 text-violet-600 hover:text-violet-700">
                    Source <ExternalLink size={11} />
                  </a>
                )}
              </p>
            </div>

            <div className="px-5 py-4 text-[13px] leading-relaxed text-slate-700 max-h-[360px] overflow-y-auto">
              {current.hasAbstract
                ? <p className="whitespace-pre-line">{current.abstract}</p>
                : <p className="text-slate-400 italic">No abstract is available. Decide on the title and details, mark it uncertain, or retrieve the full text. A missing abstract is not a reason to exclude.</p>}
            </div>

            {!aiHidden && current.aiSuggestion && current.aiSuggestion.overall !== 'Pending' && (
              <p className="px-5 pb-3 text-[11px] text-slate-400">
                AI suggestion: {current.aiSuggestion.overall}. This is not a screening decision and is never used to train the order.
              </p>
            )}

            {adjudicating && <AdjudicationContext reviewId={reviewId} paperId={current.paperId} stage={stage} />}

            <div className="px-5 py-4 bg-slate-50/70 border-t border-slate-100">
              {excluding && (
                <div className="mb-3">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Reason for exclusion</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {queue.criteria.map((c, i) => (
                      <button key={c.id} onClick={() => { setCriterionId(id => (id === c.id ? null : c.id)); setFormError(null) }}
                        className={cn('px-2.5 py-1 text-[12px] rounded-lg border transition',
                          criterionId === c.id ? 'bg-red-50 border-red-300 text-red-700 font-semibold' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300')}>
                        <span className="text-slate-400 mr-1">{i + 1}</span>{c.name || c.type}
                      </button>
                    ))}
                  </div>
                  <input ref={reasonRef} value={reasonText} onChange={e => { setReasonText(e.target.value); setFormError(null) }}
                    placeholder={criterionId ? 'Add detail (optional)' : 'Or write the reason'}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-[13px] outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
                </div>
              )}
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional, kept in the audit history)"
                className="w-full mb-3 px-3 py-1.5 border border-slate-200 rounded-lg text-[12px] outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
              {formError && <p className="text-[12px] text-red-600 mb-2">{formError}</p>}

              <div className="flex flex-wrap items-center gap-2">
                {options.map(o => (
                  <button key={o.decision} disabled={saving} onClick={() => decide(o.decision)} title={o.hint}
                    className={cn('px-4 py-2 rounded-lg text-[13px] font-semibold transition disabled:opacity-60', TONE[o.tone],
                      excluding && o.decision === 'Exclude' && 'ring-2 ring-red-300')}>
                    {excluding && o.decision === 'Exclude' ? 'Confirm exclusion' : o.label}
                    <kbd className="ml-2 text-[10px] opacity-70 uppercase">{excluding && o.decision === 'Exclude' ? '↵' : o.key}</kbd>
                  </button>
                ))}
                {excluding && <button onClick={resetForm} className="text-[12px] text-slate-500 hover:text-slate-700 px-2">Cancel</button>}
                {saving && <Loader2 size={14} className="animate-spin text-slate-400" />}
                <div className="flex items-center gap-1 ml-auto">
                  <button onClick={undo} disabled={undoStack.length === 0 || saving} className="flex items-center gap-1 px-2 py-1.5 text-[12px] text-slate-500 hover:text-slate-700 disabled:opacity-40" title="Undo your last decision (Z)">
                    <Undo2 size={13} /> Undo
                  </button>
                  <button onClick={toggleHistory} className="flex items-center gap-1 px-2 py-1.5 text-[12px] text-slate-500 hover:text-slate-700" title="Decision history (H)">
                    <History size={13} /> History
                  </button>
                  <button onClick={() => setShowShortcuts(v => !v)} className="p-1.5 text-slate-400 hover:text-slate-600" aria-label="Keyboard shortcuts"><Keyboard size={13} /></button>
                </div>
              </div>
              {adjudicating && <p className="text-[11px] text-slate-500 mt-2">Your choice settles the disagreement. Each reviewer's own decision is kept.</p>}
              {showShortcuts && (
                <p className="text-[11px] text-slate-500 mt-2">
                  {options.map(o => `${o.key.toUpperCase()} ${o.label}`).join(' · ')} · 1–9 pick a criterion while excluding · Enter confirm · Esc cancel · Z undo · H history
                </p>
              )}
            </div>

            {history && (
              <div className="px-5 py-3 border-t border-slate-100 text-[12px]">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Decision history</p>
                {history.length === 0 ? <p className="text-slate-400">No decisions you can see yet.</p> : (
                  <ul className="space-y-1">
                    {history.map(h => (
                      <li key={h.id} className={cn('flex flex-wrap gap-x-2', !h.isCurrent && 'text-slate-400')}>
                        <span className="font-semibold">{h.stage === 'FullText' ? 'Full text' : 'Title/abstract'}: {DECISION_LABELS[h.decision]}</span>
                        {h.role === 'Adjudication' && <span>(adjudication)</span>}
                        <span>by {h.reviewerName ?? 'a reviewer'}</span>
                        <span>{new Date(h.decidedAt).toLocaleString()}</span>
                        {h.reason && <span>— {h.reason}</span>}
                        {h.importedFromLegacy && <span>(copied from an earlier manual decision)</span>}
                        {h.needsReassessment && h.isCurrent && <span className="text-amber-text">(earlier criteria)</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <aside className="border border-slate-200 rounded-xl px-4 py-3 h-fit">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><FileText size={12} /> Eligibility criteria</p>
            {queue.criteria.length === 0 ? <p className="text-[12px] text-slate-400">No criteria with a description yet.</p> : (
              <ol className="space-y-2.5">
                {queue.criteria.map((c, i) => (
                  <li key={c.id} className="text-[12px] text-slate-600">
                    <p className="font-semibold text-slate-800"><span className="text-slate-400 mr-1">{i + 1}.</span>{c.name || c.type}</p>
                    <p>{c.description}</p>
                    {c.include && <p className="text-green-text">Include: {c.include}</p>}
                    {c.exclude && <p className="text-red-600">Exclude: {c.exclude}</p>}
                  </li>
                ))}
              </ol>
            )}
            {!independent && (
              <label className="flex items-center gap-2 mt-4 text-[11px] text-slate-500 cursor-pointer">
                <input type="checkbox" checked={hideAi} onChange={e => {
                  setHideAi(e.target.checked)
                  try { localStorage.setItem('ledger.hideAi', e.target.checked ? '1' : '0') } catch { /* ignore */ }
                }} />
                Hide AI suggestions while I screen
              </label>
            )}
            {independent && <p className="mt-4 text-[11px] text-slate-500">Independent screening: AI suggestions and other reviewers' decisions are hidden until you decide.</p>}
          </aside>
        </div>
      )}

      {showStop && (
        <StopScreeningDialog reviewId={reviewId} stage={stage} progress={p} onClose={() => setShowStop(false)}
          onStopped={() => { setShowStop(false); load(); onChanged?.() }} />
      )}
      {showSettings && (
        <ScreeningSettingsDialog reviewId={reviewId} onClose={() => setShowSettings(false)}
          onChanged={() => { load(); onChanged?.() }} />
      )}
      <Modal isOpen={methodsText !== null} onClose={() => setMethodsText(null)} title="Methods text from the screening record" size="lg">
        <p className="text-[13px] leading-relaxed text-slate-700 whitespace-pre-line mb-3">{methodsText}</p>
        <p className="text-[11px] text-slate-400 mb-3">Built only from recorded decisions, settings and stopping records. It states unfinished work as unfinished.</p>
        <button onClick={() => { navigator.clipboard?.writeText(methodsText ?? ''); toast.success('Copied') }}
          className="px-3 py-1.5 text-[12px] font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-lg">Copy</button>
      </Modal>
    </div>
  )
}

/** For an adjudicator: every reviewer's decision on the disputed record (visible because all required reviewers have decided). */
function AdjudicationContext({ reviewId, paperId, stage }: { reviewId: string; paperId: string; stage: ScreeningStage }) {
  const [labels, setLabels] = useState<ScreeningLabel[] | null>(null)
  useEffect(() => {
    let cancelled = false
    screeningLedgerApi.getHistory(reviewId, paperId)
      .then(h => { if (!cancelled) setLabels(h.filter(l => l.isCurrent && l.stage === stage && l.role === 'Reviewer')) })
      .catch(() => { if (!cancelled) setLabels([]) })
    return () => { cancelled = true }
  }, [reviewId, paperId, stage])
  if (!labels || labels.length === 0) return null
  return (
    <div className="px-5 pb-3">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-text mb-1"><AlertTriangle size={12} /> Reviewers disagree</p>
      <ul className="text-[12px] text-slate-600 space-y-0.5">
        {labels.map(l => <li key={l.id}>{l.reviewerName ?? 'Reviewer'}: <span className="font-semibold">{DECISION_LABELS[l.decision]}</span>{l.reason && ` — ${l.reason}`}</li>)}
      </ul>
    </div>
  )
}
