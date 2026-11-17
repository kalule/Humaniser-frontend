import { useCallback, useEffect, useState } from 'react'
import { literatureReviewApi } from '../../api/literatureReview'
import { literatureMatrixApi } from '../../api/literatureMatrix'
import { researchApi } from '../../api/research'
import { MatrixWorkspace } from '../literatureMatrix/MatrixWorkspace'
import type { Matrix } from '../../lib/literatureMatrix'
import {
  errorMessage, isRunActive, SCREENING_STATES, stateLabel,
  type Extraction, type Reason, type Review, type ScreeningItem, type ScreeningList, type ScreeningState,
} from '../../lib/literatureReview'
import { Chip, Loading, Notice, Panel } from './ui'
import { btn, inputClass } from './styles'
import { cn } from '../../lib/utils'

const PAGE_SIZE = 25

/**
 * Step 3: decide on what the search found, approve it into the review, then extract evidence from every source in
 * the review through its Literature Matrix (shown here, editable, with the passage behind every value).
 */
export function ScreenStep({ review, onChanged, onNext }: { review: Review; onChanged: () => void; onNext: () => void }) {
  return (
    <div className="space-y-4">
      <ScreeningPanel review={review} onChanged={onChanged} />
      <ExtractionPanel review={review} onChanged={onChanged} onNext={onNext} />
    </div>
  )
}

function ScreeningPanel({ review, onChanged }: { review: Review; onChanged: () => void }) {
  const [filter, setFilter] = useState<ScreeningState | ''>('')
  const [page, setPage] = useState(1)
  const [list, setList] = useState<ScreeningList | null>(null)
  const [reasons, setReasons] = useState<Reason[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [ack, setAck] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    literatureReviewApi.screening(review.id, { state: filter || undefined, page, pageSize: PAGE_SIZE })
      .then(l => { setList(l); setError(null) })
      .catch(e => setError(errorMessage(e, 'The papers could not be loaded.')))
  }, [review.id, filter, page])
  useEffect(load, [load])
  useEffect(() => { literatureReviewApi.reasons().then(setReasons).catch(() => setReasons([])) }, [])
  useEffect(() => {
    if (list?.screeningStatus !== 'Running') return
    const t = window.setTimeout(load, 3000)
    return () => window.clearTimeout(t)
  }, [list, load])

  const startScreening = async () => {
    setBusy(true)
    try { await researchApi.startScreening(review.researchProjectId); load() } catch (e) { setError(errorMessage(e, 'Screening could not be started.')) } finally { setBusy(false) }
  }
  const approve = async () => {
    setBusy(true)
    setNotice(null)
    try {
      const r = await literatureReviewApi.approve(review.id, ack)
      setNotice(`${r.addedToPool} paper${r.addedToPool === 1 ? '' : 's'} added to the review${r.excludedForDateRange ? `; ${r.excludedForDateRange} excluded as outside your date range (you can include them again)` : ''}. The review now has ${r.poolSize} sources.`)
      load(); onChanged()
    } catch (e) { setError(errorMessage(e, 'The papers could not be approved.')) } finally { setBusy(false) }
  }
  const replace = (item: ScreeningItem) => setList(l => l && { ...l, items: l.items.map(i => i.candidateId === item.candidateId ? item : i) })

  if (!list && !error) return <Panel title="Screen what the search found" id="lr-screen"><Loading /></Panel>
  const total = list ? Object.values(list.stateCounts).reduce((a, b) => a + b, 0) : 0
  const pages = list ? Math.max(1, Math.ceil(list.totalCount / PAGE_SIZE)) : 1
  const needsScreening = !!list && list.screeningStatus !== 'Completed' && list.screeningStatus !== 'Running' && total > 0
  // Papers screening could not judge stay pending on the server, so running it again retries just those. Without this the page said
  // "Run screening again" on every such paper but offered no way to do it once a run had finished.
  const unassessed = list?.stateCounts.UnableToAssess ?? 0
  const canRescreen = !!list && list.screeningStatus === 'Completed' && unassessed > 0

  return (
    <Panel title="Screen what the search found" id="lr-screen"
      description={total === 0 ? 'No search results yet. Sources you added from your library or a matrix are already in the review.' : `${total} papers found. Papers that need your decision are listed first; nothing is thrown away.`}>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {notice ? <div className="mb-3"><Notice tone="success" role="status">{notice}</Notice></div> : null}
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
          <div role="group" aria-label="Show papers by state" className="mb-3 flex flex-wrap gap-1.5">
            <button type="button" onClick={() => { setFilter(''); setPage(1) }} aria-pressed={filter === ''} className={cn(btn.small, filter === '' && 'border-purple-accent bg-purple-tint text-purple-text')}>All ({total})</button>
            {SCREENING_STATES.filter(s => list.stateCounts[s.state] > 0).map(s => (
              <button key={s.state} type="button" onClick={() => { setFilter(s.state); setPage(1) }} aria-pressed={filter === s.state}
                className={cn(btn.small, filter === s.state && 'border-purple-accent bg-purple-tint text-purple-text')}>{s.label} ({list.stateCounts[s.state]})</button>
            ))}
          </div>
          <ul className="space-y-2">
            {list.items.map(item => <ScreeningRow key={item.candidateId} reviewId={review.id} item={item} reasons={reasons} onUpdated={replace} onError={m => setError(m)} />)}
          </ul>
          {pages > 1 ? (
            <div className="mt-3 flex items-center gap-2 text-[13px]">
              <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className={btn.small}>Previous</button>
              <span>Page {page} of {pages}</span>
              <button type="button" disabled={page >= pages} onClick={() => setPage(p => p + 1)} className={btn.small}>Next</button>
            </div>
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
    </Panel>
  )
}

function ScreeningRow({ reviewId, item, reasons, onUpdated, onError }: {
  reviewId: string; item: ScreeningItem; reasons: Reason[]; onUpdated: (i: ScreeningItem) => void; onError: (m: string) => void
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
  return (
    <li className="rounded-lg border border-slate-200 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium text-slate-900 [overflow-wrap:anywhere]">{item.title}</p>
          <p className="text-[12px] text-slate-600">{item.authors || 'Unknown authors'}{item.year ? ` · ${item.year}` : ''}{item.journal ? ` · ${item.journal}` : ''}{item.inPool ? ' · in the review' : ''}</p>
        </div>
        <Chip className={tone}>{stateLabel(item.state)}</Chip>
      </div>
      <p className="mt-1.5 text-[13px] text-slate-800">{item.reasonLabel ? <span className="font-medium">{item.reasonLabel}. </span> : null}{item.explanation}</p>
      {item.abstract ? (
        <details className="mt-1 text-[13px] text-slate-700"><summary className="cursor-pointer text-slate-800">Abstract</summary><p className="mt-1">{item.abstract}</p></details>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {!item.inPool ? <>
          <button type="button" disabled={busy} onClick={() => void decide('include')} className={btn.small}>Include</button>
          <button type="button" disabled={busy} onClick={() => void decide('include', 'NEEDS_FULLTEXT')} className={btn.small}>Include, need full text</button>
          <button type="button" disabled={busy} onClick={() => setExcluding(v => !v)} aria-expanded={excluding} className={btn.small}>Exclude…</button>
          {decided ? <button type="button" disabled={busy} onClick={() => void decide('undo')} className={btn.small}>Undo my decision</button> : null}
        </> : null}
      </div>
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
  }, [review.id])
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
  return (
    <Panel title="Extract the evidence" id="lr-extract"
      description="Each source's aim, context, method, sample, findings and limitations, every value tied to the passage it came from. Unchanged sources are never extracted or charged twice.">
      {error ? <Notice tone="error">{error}</Notice> : null}
      <p className="text-[13px] text-slate-800">
        {state.poolSize} sources in the review · {state.extracted} extracted{remaining ? ` · ${remaining} to extract` : ''}{state.notLinked ? ` · ${state.notLinked} could not be matched to a matrix row` : ''}.
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
          <MatrixWorkspace matrix={matrix} onMatrixChange={setMatrix} onDeleted={() => { setMatrix(null); void load() }} />
        </div>
      ) : null}
    </Panel>
  )
}
