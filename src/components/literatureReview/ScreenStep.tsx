import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download } from 'lucide-react'
import { literatureReviewApi } from '../../api/literatureReview'
import { literatureMatrixApi } from '../../api/literatureMatrix'
import { researchApi } from '../../api/research'
import { MatrixWorkspace } from '../literatureMatrix/MatrixWorkspace'
import type { Matrix } from '../../lib/literatureMatrix'
import {
  errorMessage, isRunActive, SCREENING_STATES, stateLabel,
  type BulkResult, type Extraction, type Reason, type Review, type ScreeningItem, type ScreeningList,
} from '../../lib/literatureReview'
import {
  counters, exclusionsCsv, filterKey, rangeBetween, readView, toQuery, verdictLabel, writeView, type ScreeningView,
} from '../../lib/literatureReviewScreening'
import { Chip, Loading, Notice, Panel } from './ui'
import { BulkBar, BulkExcludeDialog, ScreeningCounters, ScreeningFilters } from './ScreeningTools'
import { btn, inputClass } from './styles'
import { cn } from '../../lib/utils'
import { SourceCountLine } from './SourceCheck'
import { useSourceCheck } from '../../hooks/useSourceCheck'

const PAGE_SIZE = 25

/**
 * Step 3: decide on what the search found, approve it into the review, then extract evidence from every source in
 * the review through its Literature Matrix (shown here, editable, with the passage behind every value).
 */
export function ScreenStep({ review, onChanged, onNext }: { review: Review; onChanged: () => void; onNext: () => void }) {
  // Refreshed with the review (its revision changes on every decision and approval).
  const { check } = useSourceCheck(review.id, review.revision)
  return (
    <div className="space-y-4">
      <SourceCountLine check={check} />
      <ScreeningPanel review={review} onChanged={onChanged} />
      <ExtractionPanel review={review} onChanged={onChanged} onNext={onNext} />
    </div>
  )
}

/** The view (tab, search, filters, sort, page) lives in the URL next to ?step=, so a refresh or a shared link keeps it. */
function useScreeningView() {
  const [params, setParams] = useSearchParams()
  const view = useMemo(() => readView(params), [params])
  // setSearchParams(fn) hands fn the params of the last render, so two changes before a re-render (a filter changed as the search
  // debounce fires) lost the first. Each change builds on the latest written params instead; navigation (Back) resets them.
  const latest = useRef(params)
  useLayoutEffect(() => { latest.current = params }, [params])
  // Any change but a page change starts again on page 1, so a narrower list is never shown from an empty page.
  const update = useCallback((patch: Partial<ScreeningView>) => {
    const next = writeView(latest.current, { ...readView(latest.current), page: 1, ...patch })
    latest.current = next
    setParams(next, { replace: true })
  }, [setParams])
  return [view, update] as const
}

interface LastBulk { batchId: string; summary: string }

function bulkSummary(r: BulkResult, verb: string): string {
  const parts = [`${r.changed} ${r.changed === 1 ? 'paper' : 'papers'} ${verb}`]
  if (r.unchanged) parts.push(`${r.unchanged} already so`)
  if (r.leftReview) parts.push(`${r.leftReview} taken out of the review (extracted data kept)`)
  if (r.returnedToReview) parts.push(`${r.returnedToReview} back in the review`)
  return parts.join('; ') + '.'
}

function downloadText(text: string, fileName: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function ScreeningPanel({ review, onChanged }: { review: Review; onChanged: () => void }) {
  const [view, setView] = useScreeningView()
  const [list, setList] = useState<ScreeningList | null>(null)
  const [loading, setLoading] = useState(true)
  const [reloadToken, setReloadToken] = useState(0)
  const [reasons, setReasons] = useState<Reason[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [ack, setAck] = useState(false)
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [excluding, setExcluding] = useState(false)
  const [lastBulk, setLastBulk] = useState<LastBulk | null>(null)
  const anchor = useRef<string | null>(null)

  const queryKey = JSON.stringify(toQuery(view, PAGE_SIZE))
  const reload = useCallback(() => setReloadToken(t => t + 1), [])
  useEffect(() => {
    // Abort the request of a view the reviewer has already left, so a slow answer never overwrites a newer one.
    const controller = new AbortController()
    setLoading(true)
    literatureReviewApi.screening(review.id, JSON.parse(queryKey), controller.signal)
      .then(l => { setList(l); setError(null) })
      .catch(e => { if (!controller.signal.aborted) setError(errorMessage(e, 'The papers could not be loaded.')) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [review.id, queryKey, reloadToken])
  useEffect(() => { literatureReviewApi.reasons().then(setReasons).catch(() => setReasons([])) }, [])
  useEffect(() => {
    if (list?.screeningStatus !== 'Running') return
    const t = window.setTimeout(reload, 3000)
    return () => window.clearTimeout(t)
  }, [list, reload])

  // Selection belongs to one filtered view: changing the search, a filter or the tab starts a new one. Within the view it
  // survives paging, and it drops papers that a decision moved out of the view.
  const viewKey = filterKey(view)
  useEffect(() => { setSelected(new Set()); anchor.current = null }, [viewKey])
  useEffect(() => {
    const matching = list?.matchingIds
    if (!matching) return
    const inView = new Set(matching)
    setSelected(s => [...s].every(id => inView.has(id)) ? s : new Set([...s].filter(id => inView.has(id))))
  }, [list])

  // A decision can empty the last page; step back to the last page that has papers rather than showing "no matches".
  useEffect(() => {
    if (!list || loading || list.items.length > 0 || list.totalCount === 0) return
    const last = Math.max(1, Math.ceil(list.totalCount / PAGE_SIZE))
    if (view.page > last) setView({ ...view, page: last })
  }, [list, loading, view, setView])

  const bulkOn = !!list?.bulkScreening
  const pageIds = useMemo(() => list?.items.map(i => i.candidateId) ?? [], [list])
  const toggle = useCallback((id: string, range: boolean) => {
    // Read the anchor now: the updater below runs later, after the anchor has moved to this paper.
    const ids = range && anchor.current ? rangeBetween(pageIds, anchor.current, id) : []
    setSelected(current => {
      const next = new Set(current)
      if (ids.length > 0) {
        // Shift+click sets the whole range to the state of the paper clicked, like a file manager.
        const select = !current.has(id)
        ids.forEach(x => { if (select) next.add(x); else next.delete(x) })
      } else if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    anchor.current = id
  }, [pageIds])

  const startScreening = async () => {
    setBusy(true)
    try { await researchApi.startScreening(review.researchProjectId); reload() } catch (e) { setError(errorMessage(e, 'Screening could not be started.')) } finally { setBusy(false) }
  }
  const approve = async () => {
    setBusy(true)
    setNotice(null)
    try {
      const r = await literatureReviewApi.approve(review.id, ack)
      setNotice(`${r.addedToPool} paper${r.addedToPool === 1 ? '' : 's'} added to the review${r.excludedForDateRange ? `; ${r.excludedForDateRange} excluded as outside your date range (you can include them again)` : ''}. The review now has ${r.poolSize} sources.`)
      reload(); onChanged()
    } catch (e) { setError(errorMessage(e, 'The papers could not be approved.')) } finally { setBusy(false) }
  }
  // A single decision shows at once, then the list reloads so counts, tabs and order follow it.
  const decided = (item: ScreeningItem) => {
    setList(l => l && { ...l, items: l.items.map(i => i.candidateId === item.candidateId ? item : i) })
    reload()
    if (item.inPool !== list?.items.find(i => i.candidateId === item.candidateId)?.inPool) onChanged()
  }
  const runBulk = async (decision: 'include' | 'exclude', reasonCode?: string, note?: string) => {
    const ids = [...selected]
    if (ids.length === 0) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const r = await literatureReviewApi.bulkDecide(review.id, { candidateIds: ids, decision, reasonCode, note })
      setLastBulk(r.batchId ? { batchId: r.batchId, summary: bulkSummary(r, decision === 'include' ? 'included' : 'excluded') } : null)
      if (!r.batchId) setNotice(bulkSummary(r, decision === 'include' ? 'included' : 'excluded'))
      setSelected(new Set())
      setExcluding(false)
      reload()
      if (r.leftReview || r.returnedToReview) onChanged()
    } catch (e) {
      // The server applies all or nothing, so the selection is kept for another try.
      setError(errorMessage(e, 'The papers could not be updated. Nothing was changed.'))
    } finally { setBusy(false) }
  }
  const undoBulk = async () => {
    if (!lastBulk) return
    setBusy(true)
    setError(null)
    try {
      const r = await literatureReviewApi.undoBulk(review.id, lastBulk.batchId)
      setLastBulk(null)
      setNotice(`Undone: ${r.restored} ${r.restored === 1 ? 'paper' : 'papers'} restored${r.skipped ? `; ${r.skipped} decided again since then kept the newer decision` : ''}.`)
      reload(); onChanged()
    } catch (e) { setError(errorMessage(e, 'The last action could not be undone.')) } finally { setBusy(false) }
  }
  const exportExclusions = async () => {
    setBusy(true)
    try {
      const rows = await literatureReviewApi.exclusions(review.id)
      downloadText(exclusionsCsv(rows), `excluded-records-${review.id.slice(0, 8)}.csv`, 'text/csv;charset=utf-8')
    } catch (e) { setError(errorMessage(e, 'The excluded records could not be downloaded.')) } finally { setBusy(false) }
  }

  if (!list && !error) return <Panel title="Screen what the search found" id="lr-screen"><Loading /></Panel>
  const overall = list?.overallCounts ?? list?.stateCounts
  const total = overall ? Object.values(overall).reduce((a, b) => a + b, 0) : 0
  const tabTotal = list ? Object.values(list.stateCounts).reduce((a, b) => a + b, 0) : 0
  const pages = list ? Math.max(1, Math.ceil(list.totalCount / PAGE_SIZE)) : 1
  const needsScreening = !!list && list.screeningStatus !== 'Completed' && list.screeningStatus !== 'Running' && total > 0
  // Papers screening could not judge stay pending on the server, so running it again retries just those. Without this the page said
  // "Run screening again" on every such paper but offered no way to do it once a run had finished.
  const unassessed = overall?.UnableToAssess ?? 0
  const canRescreen = !!list && list.screeningStatus === 'Completed' && unassessed > 0
  const matching = list?.matchingIds ?? []
  const allSelected = matching.length > 0 && matching.every(id => selected.has(id))
  const excludedTotal = overall ? (overall.Excluded ?? 0) + (overall.NotRelevant ?? 0) : 0

  return (
    <Panel title="Screen what the search found" id="lr-screen"
      description={total === 0 ? 'No search results yet. Sources you added from your library or a matrix are already in the review.' : `${total} papers found. Papers that need your decision are listed first; nothing is thrown away.`}>
      {error ? <div className="mb-3"><Notice tone="error">{error}</Notice></div> : null}
      {notice ? <div className="mb-3"><Notice tone="success" role="status">{notice}</Notice></div> : null}
      {lastBulk ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-green-300 bg-green-50 p-3 text-[13px] text-green-900" role="status">
          <span className="min-w-0 flex-1">{lastBulk.summary}</span>
          <button type="button" onClick={() => void undoBulk()} disabled={busy} className={btn.small}>Undo</button>
        </div>
      ) : null}
      {list?.screeningStatus === 'Running' ? <Notice role="status">Screening… {list.screeningProgressPct}%</Notice> : null}
      {list?.screeningStatus === 'Error' ? <div className="mb-3"><Notice tone="error">Screening failed: the screening service could not be reached, so no paper was judged. Run screening again.</Notice></div> : null}
      {needsScreening ? (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void startScreening()} disabled={busy} className={btn.secondary}>Screen {total} papers with AI</button>
          <span className="text-[13px] text-slate-700">Each paper gets a verdict and a reason against your question and criteria. You decide in the end.</span>
        </div>
      ) : null}
      {canRescreen ? (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void startScreening()} disabled={busy} className={btn.secondary}>Run screening again</button>
          <span className="text-[13px] text-slate-700">{unassessed} paper{unassessed === 1 ? '' : 's'} could not be judged. Papers that could not be screened are tried again; ones with no abstract still need your decision.</span>
        </div>
      ) : null}
      {list && total > 0 ? (
        <>
          <ScreeningCounters counts={counters(overall ?? {})} selected={selected.size} showSelected={bulkOn} />
          <ScreeningFilters view={view} databases={list.databases ?? []} matches={loading ? null : list.totalCount} onChange={setView} />
          <div role="group" aria-label="Show papers by state" className="mb-3 flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setView({ state: '' })} aria-pressed={view.state === ''} className={cn(btn.small, view.state === '' && 'border-purple-accent bg-purple-tint text-purple-text')}>All ({tabTotal})</button>
            {SCREENING_STATES.filter(s => list.stateCounts[s.state] > 0 || view.state === s.state).map(s => (
              <button key={s.state} type="button" onClick={() => setView({ state: s.state })} aria-pressed={view.state === s.state}
                className={cn(btn.small, view.state === s.state && 'border-purple-accent bg-purple-tint text-purple-text')}>{s.label} ({list.stateCounts[s.state] ?? 0})</button>
            ))}
          </div>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[13px]">
            {bulkOn && list.totalCount > 0 ? (
              <>
                <button type="button" className={btn.small} disabled={allSelected} onClick={() => setSelected(new Set(matching))}>
                  Select all in this view ({list.totalCount})
                </button>
                <button type="button" className={btn.small} disabled={selected.size === 0} onClick={() => setSelected(new Set())}>Select none</button>
              </>
            ) : null}
            {excludedTotal > 0 ? (
              <button type="button" className={cn(btn.small, 'ml-auto')} disabled={busy} onClick={() => void exportExclusions()}>
                <Download size={13} aria-hidden />Excluded records with reasons (CSV)
              </button>
            ) : null}
          </div>
          {bulkOn && selected.size > 0 ? (
            <BulkBar count={selected.size} busy={busy}
              onInclude={() => void runBulk('include')}
              onIncludeNeedsFullText={() => void runBulk('include', 'NEEDS_FULLTEXT')}
              onExclude={() => setExcluding(true)}
              onClear={() => setSelected(new Set())} />
          ) : null}
          {list.items.length === 0 && list.totalCount === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-[14px] text-slate-700">
              No papers match this search and these filters.
              <button type="button" className={cn(btn.link, 'ml-1')} onClick={() => setView({ state: '', search: '', yearFrom: null, yearTo: null, database: '', hasAbstract: null, verdict: '' })}>Show all papers</button>
            </div>
          ) : (
            <ul className={cn('space-y-2', loading && 'opacity-60 transition-opacity')} aria-busy={loading}>
              {list.items.map(item => (
                <ScreeningRow key={item.candidateId} reviewId={review.id} item={item} reasons={reasons} bulkOn={bulkOn}
                  selected={selected.has(item.candidateId)} onToggle={toggle} onUpdated={decided} onError={m => setError(m)} />
              ))}
            </ul>
          )}
          {pages > 1 ? (
            <nav aria-label="Pages" className="mt-3 flex items-center gap-2 text-[13px]">
              <button type="button" disabled={view.page <= 1} onClick={() => setView({ ...view, page: view.page - 1 })} className={btn.small}>Previous</button>
              <span>Page {Math.min(view.page, pages)} of {pages}</span>
              <button type="button" disabled={view.page >= pages} onClick={() => setView({ ...view, page: view.page + 1 })} className={btn.small}>Next</button>
            </nav>
          ) : null}
          <div className="mt-4 space-y-2 border-t border-slate-200 pt-3">
            <label className="flex items-start gap-2 text-[13px] text-slate-800">
              <input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} className="mt-0.5" />
              I understand that if the search coverage is limited, the review may miss relevant studies.
            </label>
            <button type="button" onClick={() => void approve()} disabled={busy || !list.canApprove} className={btn.secondary}>
              Add the included papers to the review
            </button>
            {!list.canApprove ? <p className="text-[12px] text-slate-600">Finish screening first.</p> : null}
          </div>
        </>
      ) : null}
      {excluding ? (
        <BulkExcludeDialog count={selected.size} reasons={reasons} busy={busy}
          onCancel={() => setExcluding(false)} onConfirm={(code, note) => void runBulk('exclude', code, note)} />
      ) : null}
    </Panel>
  )
}

function ScreeningRow({ reviewId, item, reasons, bulkOn, selected, onToggle, onUpdated, onError }: {
  reviewId: string; item: ScreeningItem; reasons: Reason[]; bulkOn: boolean; selected: boolean
  onToggle: (id: string, range: boolean) => void; onUpdated: (i: ScreeningItem) => void; onError: (m: string) => void
}) {
  const [excluding, setExcluding] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const tone = SCREENING_STATES.find(s => s.state === item.state)?.tone ?? ''
  const decide = async (decision: 'include' | 'exclude' | 'undo', reasonCode?: string) => {
    setBusy(true)
    try { onUpdated(await literatureReviewApi.decide(reviewId, item.candidateId, { decision, reasonCode })); setExcluding(false) }
    catch (e) { onError(errorMessage(e, 'Your decision could not be saved.')) } finally { setBusy(false) }
  }
  const excludeReasons = reasons.filter(r => r.code !== 'NEEDS_FULLTEXT')
  const decided = item.state === 'Excluded' || (item.state === 'Included' && item.explanation.startsWith('Included by you')) || item.state === 'AwaitingFullText'
  // With bulk screening on a paper already in the review can be decided too: excluding takes it out of the review.
  const canDecide = !item.inPool || bulkOn
  // The AI's own reason, shown when the card's text is the reviewer's decision (or the date range) rather than the AI's.
  const showAi = item.aiVerdict !== 'Pending' && !!item.aiReason && item.explanation !== item.aiReason
  const checkboxId = `lr-select-${item.candidateId}`
  return (
    <li className={cn('rounded-lg border p-3', selected ? 'border-purple-accent bg-purple-tint/30' : 'border-slate-200')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        {bulkOn ? (
          <input id={checkboxId} type="checkbox" checked={selected} className="mt-1 h-4 w-4 shrink-0 accent-purple-accent"
            aria-label={`Select ${item.title}`}
            onChange={e => onToggle(item.candidateId, (e.nativeEvent as MouseEvent).shiftKey === true)} />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium text-slate-900 [overflow-wrap:anywhere]">{item.title}</p>
          <p className="text-[12px] text-slate-600">
            {item.authors || 'Unknown authors'}{item.year ? ` · ${item.year}` : ''}{item.journal ? ` · ${item.journal}` : ''}
            {item.citations > 0 ? ` · ${item.citations} citation${item.citations === 1 ? '' : 's'}` : ''}
            {item.source ? ` · ${item.source}` : ''}
            {item.inPool ? ' · in the review' : item.removedFromReview ? ' · taken out of the review' : ''}
          </p>
        </div>
        <Chip className={tone}>{stateLabel(item.state)}</Chip>
      </div>
      {/* For the reviewer's own exclusion the explanation is the reason label itself; say it once, then the note if there is one. */}
      <p className="mt-1.5 text-[13px] text-slate-800">
        {item.reasonLabel ? <span className="font-medium">{item.reasonLabel}.</span> : null}
        {item.explanation && item.explanation !== item.reasonLabel ? `${item.reasonLabel ? ' ' : ''}${item.explanation}` : null}
        {item.studentNote ? <span className="text-slate-700"> Note: {item.studentNote}</span> : null}
      </p>
      {showAi ? (
        <p className="mt-1 text-[12px] text-slate-600"><span className="font-medium">AI verdict: {verdictLabel(item.aiVerdict)}.</span> {item.aiReason}</p>
      ) : null}
      {item.abstract ? (
        <details className="mt-1 text-[13px] text-slate-700"><summary className="cursor-pointer text-slate-800">Abstract</summary><p className="mt-1">{item.abstract}</p></details>
      ) : null}
      {canDecide ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {item.state !== 'Included' || decided ? <button type="button" disabled={busy} onClick={() => void decide('include')} className={btn.small}>Include</button> : null}
          <button type="button" disabled={busy} onClick={() => void decide('include', 'NEEDS_FULLTEXT')} className={btn.small}>Include, need full text</button>
          {item.state !== 'Excluded' ? <button type="button" disabled={busy} onClick={() => setExcluding(v => !v)} aria-expanded={excluding} className={btn.small}>Exclude…</button> : null}
          {decided ? <button type="button" disabled={busy} onClick={() => void decide('undo')} className={btn.small}>Undo my decision</button> : null}
        </div>
      ) : null}
      {excluding ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label htmlFor={`lr-reason-${item.candidateId}`} className="text-[13px] text-slate-800">Reason</label>
          <select id={`lr-reason-${item.candidateId}`} value={reason} onChange={e => setReason(e.target.value)} className={inputClass + ' w-auto py-1'}>
            <option value="">Choose a reason</option>
            {excludeReasons.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
          </select>
          <button type="button" disabled={busy || !reason} onClick={() => void decide('exclude', reason)} className={btn.small}>Exclude</button>
        </div>
      ) : null}
    </li>
  )
}

function ExtractionPanel({ review, onChanged, onNext }: { review: Review; onChanged: () => void; onNext: () => void }) {
  const [state, setState] = useState<Extraction | null>(null)
  const [matrix, setMatrix] = useState<Matrix | null>(null)
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const e = await literatureReviewApi.extraction(review.id)
      setState(e)
      if (e.matrixId) setMatrix(await literatureMatrixApi.get(e.matrixId))
    } catch (err) { setError(errorMessage(err, 'The extraction status could not be loaded.')) }
    // review.sourceCount is a deliberate dependency: adding the screened papers changes it, and without the reload this panel kept
    // saying "0 sources in the review" (and 0 credits) until the page was refreshed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [review.id, review.sourceCount])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!isRunActive(state?.run)) return
    const t = window.setTimeout(() => { void load(); onChanged() }, 3000)
    return () => window.clearTimeout(t)
  }, [state, load, onChanged])

  const start = async () => {
    setBusy(true)
    setError(null)
    try { setState(await literatureReviewApi.startExtraction(review.id, consent || !!state?.consentAccepted)); onChanged(); void load() }
    catch (e) { setError(errorMessage(e, 'Extraction could not be started.')) } finally { setBusy(false) }
  }

  if (!state) return <Panel title="Extract the evidence" id="lr-extract">{error ? <Notice tone="error">{error}</Notice> : <Loading />}</Panel>
  if (!state.matrixAvailable) return <Panel title="Extract the evidence" id="lr-extract"><Notice>Evidence extraction uses the Literature Matrix, which is switched off on this server.</Notice></Panel>
  const running = isRunActive(state.run)
  const remaining = Math.max(0, state.inMatrix - state.extracted)
  const hidden = state.hiddenStudyIds ?? []
  return (
    <Panel title="Extract the evidence" id="lr-extract"
      description="Each source's aim, context, method, sample, findings and limitations, every value tied to the passage it came from. Unchanged sources are never extracted or charged twice.">
      {error ? <Notice tone="error">{error}</Notice> : null}
      <p className="text-[13px] text-slate-800">
        {state.poolSize} sources in the review · {state.extracted} extracted{remaining ? ` · ${remaining} to extract` : ''}{state.notLinked ? ` · ${state.notLinked} could not be matched to a matrix row` : ''}.
        {hidden.length ? ` ${hidden.length} source${hidden.length === 1 ? '' : 's'} taken out of the review ${hidden.length === 1 ? 'is' : 'are'} hidden below; anything extracted from them is kept.` : ''}
      </p>
      {state.run ? (
        <div className="mt-2">
          <Notice tone={state.run.status === 'Failed' ? 'error' : 'info'} role="status">
            {running ? `Extracting… ${state.run.studiesDone} of ${state.run.studiesTotal} done.` : `Last run: ${state.run.status.toLowerCase()}, ${state.run.studiesDone} done, ${state.run.studiesSkipped} unchanged, ${state.run.studiesFailed} could not be read.`}
            {state.run.message ? ` ${state.run.message}` : ''}
          </Notice>
        </div>
      ) : null}
      {!state.consentAccepted ? (
        <label className="mt-3 flex items-start gap-2 text-[13px] text-slate-800">
          <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5" />
          I agree that the text of these sources is sent to an AI service to extract the evidence.
        </label>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {remaining > 0 || state.inMatrix === 0 ? (
          <button type="button" onClick={() => void start()} disabled={busy || running || state.poolSize === 0 || (!state.consentAccepted && !consent)} className={btn.primary}>
            {running ? 'Extracting…' : `Extract evidence (up to ${Math.max(remaining, state.poolSize) * state.creditsPerStudy} credits)`}
          </button>
        ) : (
          <button type="button" onClick={onNext} className={btn.primary}>Continue to themes</button>
        )}
        {remaining > 0 && state.extracted >= 2 ? <button type="button" onClick={onNext} className={btn.secondary}>Continue with what is extracted</button> : null}
      </div>
      {matrix ? (
        <div className="mt-4 h-[70vh] min-h-[420px] overflow-hidden rounded-xl border border-slate-200">
          <MatrixWorkspace matrix={matrix} onMatrixChange={setMatrix} onDeleted={() => { setMatrix(null); void load() }} hiddenStudyIds={hidden} />
        </div>
      ) : null}
    </Panel>
  )
}
