import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Search, Square, Trash2 } from 'lucide-react'
import { literatureReviewApi } from '../../api/literatureReview'
import { literatureMatrixApi } from '../../api/literatureMatrix'
import { researchApi } from '../../api/research'
import { SavedSourcePicker } from '../webLibrary/SavedSourcePicker'
import {
  errorMessage, EVIDENCE_LABELS, importSummary, PROVIDER_LABELS, SOFT_MIN_SOURCES,
  type Coverage, type ImportResult, type PoolSource, type Reason, type Review,
} from '../../lib/literatureReview'
import type { DiscoveryStatus, LiteratureSearchQuery } from '../../types/research'
import type { MatrixSummary } from '../../lib/literatureMatrix'
import { Chip, Loading, Notice, Panel } from './ui'
import { btn } from './styles'
import { cn } from '../../lib/utils'

type Tab = 'library' | 'search' | 'matrix'
// Search comes first and is the default: a new review usually starts empty, and searching is the one route that works
// without having saved papers or built a matrix first.
const TABS: { id: Tab; label: string }[] = [
  { id: 'search', label: 'Search databases' },
  { id: 'library', label: 'Research Library' },
  { id: 'matrix', label: 'From a Literature Matrix' },
]

/** Step 2: everything that enters the review's source pool. Search results are screened in step 3 before they join. */
export function SourcesStep({ review, onChanged, onNext }: { review: Review; onChanged: () => void; onNext: () => void }) {
  const [tab, setTab] = useState<Tab>('search')
  const [pool, setPool] = useState<PoolSource[] | null>(null)
  const [poolError, setPoolError] = useState<string | null>(null)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  // Held here, not only in SearchTab, so "Continue" knows whether screening has anything to work on while another tab is open.
  const [search, setSearch] = useState<DiscoveryStatus | null>(null)
  useEffect(() => { researchApi.getDiscoveryStatus(review.researchProjectId).then(setSearch).catch(() => {}) }, [review.researchProjectId])

  const searching = search?.status === 'Running'
  const searchFound = search?.status === 'Completed' || search?.status === 'Error' ? search.uniqueCount : 0
  const poolCount = pool?.length ?? 0
  // Screening with nothing to screen is a dead end, and screening mid-search would miss the papers still arriving.
  const blockedReason = searching
    ? (search && search.resultCount > 0 ? `Still searching. Stop the search to screen the ${search.uniqueCount} papers found so far, or wait for it to finish.` : 'Still searching. Wait for the first results.')
    : poolCount === 0 && searchFound === 0 ? 'Search the databases or add sources first. Screening needs papers to work on.'
    : null

  const loadPool = useCallback(() => {
    setPoolError(null)
    literatureReviewApi.sources(review.id).then(setPool).catch(e => setPoolError(errorMessage(e, 'The sources could not be loaded.')))
  }, [review.id])
  useEffect(loadPool, [loadPool])

  const afterImport = (r: ImportResult) => { setMessage({ tone: 'success', text: importSummary(r) }); loadPool(); onChanged() }
  const failed = (e: unknown, fallback: string) => setMessage({ tone: 'error', text: errorMessage(e, fallback) })

  // A search result taken out after screening needs a reason: the methods section accounts for every record screening included,
  // and a marker found "191 included, 20 used" with no reasons the biggest gap in the method.
  const [reasons, setReasons] = useState<Reason[]>([])
  useEffect(() => { literatureReviewApi.reasons().then(r => setReasons(r.filter(x => x.code !== 'NEEDS_FULLTEXT' && x.code !== 'DATE'))).catch(() => setReasons([])) }, [])
  const [removing, setRemoving] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  const remove = async (s: PoolSource, why?: string) => {
    try { await literatureReviewApi.removeSource(review.id, s.id, why); setRemoving(null); setReason(''); loadPool(); onChanged() } catch (e) { failed(e, 'The source could not be removed.') }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-3">
        <div role="tablist" aria-label="Where the sources come from" className="flex flex-wrap gap-1 border-b border-slate-200">
          {TABS.map(t => (
            <button key={t.id} id={`lr-tab-${t.id}`} role="tab" type="button" aria-selected={tab === t.id} aria-controls={`lr-panel-${t.id}`}
              onClick={() => setTab(t.id)}
              onKeyDown={e => {
                const i = TABS.findIndex(x => x.id === tab)
                if (e.key === 'ArrowRight') setTab(TABS[(i + 1) % TABS.length].id)
                if (e.key === 'ArrowLeft') setTab(TABS[(i + TABS.length - 1) % TABS.length].id)
              }}
              className={cn('-mb-px border-b-2 px-3 py-2 text-[14px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40',
                tab === t.id ? 'border-purple-accent text-purple-text' : 'border-transparent text-slate-700 hover:text-slate-900')}>
              {t.label}
            </button>
          ))}
        </div>
        {message ? <Notice tone={message.tone} role="status">{message.text}</Notice> : null}
        <div role="tabpanel" id={`lr-panel-${tab}`} aria-labelledby={`lr-tab-${tab}`}>
          {tab === 'library' ? <LibraryTab reviewId={review.id} onImported={afterImport} onError={failed} /> : null}
          {tab === 'search' ? <SearchTab review={review} onStatus={setSearch} /> : null}
          {tab === 'matrix' ? <MatrixTab reviewId={review.id} ownMatrixId={review.literatureMatrixId} onImported={afterImport} onError={failed} /> : null}
        </div>
      </div>

      <Panel title={`In this review${pool ? ` (${pool.length})` : ''}`} description="Sources you added. Search results join after screening." id="lr-pool">
        {poolError ? <Notice tone="error">{poolError}</Notice> : !pool ? <Loading /> : (
          <>
            {searchFound > 0 ? (
              <Notice tone="info">{searchFound} {searchFound === 1 ? 'paper' : 'papers'} from the search will be screened in the next step.</Notice>
            ) : pool.length > 0 && pool.length < SOFT_MIN_SOURCES ? (
              <Notice tone="warning">A review usually needs at least {SOFT_MIN_SOURCES} sources to compare. You can continue with fewer, but themes and gaps will be thin.</Notice>
            ) : null}
            {pool.length === 0 && searching ? (
              <div className="mt-2 space-y-1.5 text-[13px] text-slate-700">
                <p className="font-medium text-slate-900">While the search runs</p>
                <p>Next you screen what it finds: keep each paper that answers your question and exclude the rest with a reason. Your methods section reports those numbers.</p>
                <p>Papers you saved earlier can go in now from the Research Library tab.</p>
              </div>
            ) : pool.length === 0 ? <p className="mt-2 text-[13px] text-slate-700">Nothing added yet. Search the databases, or add papers from your library or a matrix.</p> : (
              <ul className="mt-2 max-h-[60vh] divide-y divide-slate-100 overflow-y-auto">
                {pool.map(s => (
                  <li key={s.id} className="flex flex-wrap items-start gap-2 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-slate-900 [overflow-wrap:anywhere]">{s.title}</p>
                      <p className="text-[12px] text-slate-600">{s.authors || 'Unknown authors'}{s.year ? ` · ${s.year}` : ''} · {EVIDENCE_LABELS[s.evidenceLevel]} · {s.origin === 'Search' ? 'from search' : 'from your library'}</p>
                    </div>
                    <button type="button" onClick={() => s.origin === 'Search' ? (setRemoving(removing === s.id ? null : s.id), setReason('')) : void remove(s)}
                      aria-expanded={s.origin === 'Search' ? removing === s.id : undefined}
                      className="rounded p-1 text-slate-600 hover:bg-slate-100 hover:text-red-700" aria-label={`Take "${s.title}" out of the review`}><Trash2 size={15} aria-hidden /></button>
                    {removing === s.id ? (
                      <div className="basis-full rounded border border-slate-200 bg-slate-50 p-2">
                        <label className="block text-[12px] font-medium text-slate-800" htmlFor={`lr-why-${s.id}`}>Why take it out? Your methods section reports this.</label>
                        <select id={`lr-why-${s.id}`} value={reason} onChange={e => setReason(e.target.value)} className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-[13px]">
                          <option value="">Choose a reason</option>
                          {reasons.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
                        </select>
                        <div className="mt-2 flex gap-2">
                          <button type="button" disabled={!reason} onClick={() => void remove(s, reason)} className={btn.secondary}>Take it out</button>
                          <button type="button" onClick={() => setRemoving(null)} className={btn.secondary}>Cancel</button>
                        </div>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <button type="button" onClick={onNext} disabled={blockedReason !== null} aria-describedby={blockedReason ? 'lr-continue-why' : undefined}
              className={btn.primary + ' mt-3 w-full justify-center'}>Continue to screening</button>
            {blockedReason ? <p id="lr-continue-why" className="mt-2 text-[12px] text-slate-600">{blockedReason}</p> : null}
          </>
        )}
      </Panel>
    </div>
  )
}

function LibraryTab({ reviewId, onImported, onError }: { reviewId: string; onImported: (r: ImportResult) => void; onError: (e: unknown, f: string) => void }) {
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const add = async () => {
    setBusy(true)
    try { onImported(await literatureReviewApi.addSaved(reviewId, selected)); setSelected([]) } catch (e) { onError(e, 'The sources could not be added.') } finally { setBusy(false) }
  }
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-slate-700">Choose papers you have saved. Ones with details only (no abstract or text) cannot support a claim, so they cannot be chosen.</p>
      <SavedSourcePicker selectedIds={selected} onChange={setSelected} requireText max={100} listClassName="max-h-[50vh]" />
      <button type="button" disabled={busy || selected.length === 0} onClick={() => void add()} className={btn.secondary}>
        {busy ? 'Adding…' : `Add ${selected.length || ''} selected to the review`.replace('  ', ' ')}
      </button>
    </div>
  )
}

function SearchTab({ review, onStatus }: { review: Review; onStatus: (s: DiscoveryStatus) => void }) {
  const projectId = review.researchProjectId
  const [status, setStatus] = useState<DiscoveryStatus | null>(null)
  const [coverage, setCoverage] = useState<Coverage | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Bumped on every failed poll. A failed poll leaves `status` unchanged, so without this the polling effect never
  // re-ran and one transient error (for example the API restarting) froze a running search's progress for good.
  const [failedPolls, setFailedPolls] = useState(0)

  const refresh = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([researchApi.getDiscoveryStatus(projectId), literatureReviewApi.coverage(review.id)])
      setStatus(s)
      onStatus(s)
      setCoverage(c)
      setError(null)
      setFailedPolls(0)
    } catch (e) {
      setError(errorMessage(e, 'The search status could not be loaded. Retrying.'))
      setFailedPolls(n => n + 1)
    }
  }, [projectId, review.id, onStatus])
  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => {
    if (status?.status !== 'Running') return
    // Back off after failures (3s, 6s, 12s, up to 30s) so a down API is not hammered.
    const delay = Math.min(30000, 3000 * 2 ** Math.min(failedPolls, 4))
    const t = window.setTimeout(() => void refresh(), delay)
    return () => window.clearTimeout(t)
  }, [status, failedPolls, refresh])

  const start = async () => {
    setError(null)
    try {
      const queries = await researchApi.listDiscoveryQueries(projectId)
      if (queries.length === 0) {
        setBusy('Planning the search from your question')
        await researchApi.generateTopicScope(projectId)
        // The backend builds queries from the enabled research dimensions, so they must exist first.
        await researchApi.generateDiscoveryDimensions(projectId)
        await researchApi.generateDiscoveryQueries(projectId)
      }
      setBusy('Starting the search')
      await researchApi.startDiscovery(projectId)
      await refresh()
    } catch (e) { setError(errorMessage(e, 'The search could not be started. Try again.')) } finally { setBusy(null) }
  }
  const [retrying, setRetrying] = useState(false)
  const retry = async () => {
    setError(null)
    setRetrying(true)
    try { await researchApi.retryFailedSources(projectId); await refresh() } catch (e) { setError(errorMessage(e, 'The databases could not be retried.')) } finally { setRetrying(false) }
  }
  // Stopping keeps every paper already found (the job finishes with "Stopped by user"), so a slow or stuck database never
  // holds the whole step hostage.
  const stop = async () => {
    setError(null)
    setBusy('Stopping the search')
    try { await researchApi.stopDiscovery(projectId); await refresh() } catch (e) { setError(errorMessage(e, 'The search could not be stopped.')) } finally { setBusy(null) }
  }

  const running = status?.status === 'Running'
  const providers = coverage?.providers ?? []
  const answered = providers.filter(p => p.state === 'Results' || p.state === 'NoSearchResults').length
  const searched = status !== null && status.status !== 'NotStarted'
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-slate-700">
        We search several scholarly databases with queries built from your question{review.yearFrom || review.yearTo ? ' and date range' : ''}. Papers found here are screened in the next step before they join the review.
      </p>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {busy ? <Loading label={busy} /> : null}
      {status ? (
        <div role="status" className="rounded-lg border border-slate-200 p-3 text-[13px] text-slate-800">
          {running ? (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-slate-900">Searching…</p>
                <p className="text-slate-700">{answered} of {providers.length || '?'} databases have answered</p>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                <div className="h-full bg-purple-accent transition-[width]" style={{ width: `${Math.max(3, status.progressPct)}%` }} />
              </div>
              <p className="mt-2 text-slate-700">{foundLine(status.resultCount, status.uniqueCount, status.duplicateCount)}</p>
            </>
          ) : (
            <p className="font-medium text-slate-900">
              {status.status === 'NotStarted' ? 'Not searched yet.'
                : status.status === 'Error' ? (status.statusMessage || 'The search stopped with an error.')
                : `${status.stopReason === 'Stopped by user' ? 'Search stopped' : 'Search finished'}: ${status.uniqueCount} unique papers (${status.duplicateCount} duplicates merged).`}
            </p>
          )}
        </div>
      ) : null}
      {providers.length > 0 ? (
        <ul className="grid gap-1.5 sm:grid-cols-2" aria-label="What each database did">
          {providers.map(p => (
            <li key={p.id} className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-[13px]">
              <span className="min-w-0">
                <span className="font-medium text-slate-900">{p.name}</span>
                {p.state === 'ProviderUnavailable' ? (
                  <span className="block text-slate-700">
                    Didn't respond, so its papers are missing.{' '}
                    <button type="button" onClick={() => void retry()} disabled={retrying || running} className={btn.link}>{retrying ? 'Retrying…' : 'Retry'}</button>
                  </span>
                ) : <span className="block text-slate-700">{p.message}</span>}
              </span>
              <Chip className={cn('whitespace-nowrap', p.state === 'ProviderUnavailable' ? 'border-red-300 bg-red-50 text-red-900' : p.state === 'Results' ? 'border-green-300 bg-green-50 text-green-900' : 'border-slate-300 bg-slate-50 text-slate-800')}>
                {PROVIDER_LABELS[p.state]}
              </Chip>
            </li>
          ))}
        </ul>
      ) : null}
      {searched ? <SearchedQueries projectId={projectId} yearFrom={review.yearFrom} yearTo={review.yearTo} refreshKey={status?.completedAt ?? status?.status ?? ''} /> : null}
      <div className="flex flex-wrap gap-2">
        {running ? (
          <button type="button" onClick={() => void stop()} disabled={!!busy} className={btn.secondary}>
            <Square size={14} aria-hidden /> Stop and use what's found
          </button>
        ) : (
          // The first search is the main action on an empty step, so it is filled; once it has run, "Continue" takes over.
          <button type="button" onClick={() => void start()} disabled={!!busy} className={searched ? btn.secondary : btn.primary}>
            {searched ? <RefreshCw size={16} aria-hidden /> : <Search size={16} aria-hidden />}
            {searched ? 'Search again' : 'Search databases'}
          </button>
        )}
      </div>
    </div>
  )
}

function foundLine(records: number, unique: number, duplicates: number) {
  if (records === 0) return 'No records yet.'
  return duplicates > 0
    ? `${records} records so far, ${unique} unique after ${duplicates} duplicates are merged.`
    : `${records} records so far.`
}

/** The queries actually sent, collapsed by default. A scoping or systematic review has to report its search strategy. */
function SearchedQueries({ projectId, yearFrom, yearTo, refreshKey }: { projectId: string; yearFrom: number | null; yearTo: number | null; refreshKey: string }) {
  const [queries, setQueries] = useState<LiteratureSearchQuery[] | null>(null)
  useEffect(() => { researchApi.listDiscoveryQueries(projectId).then(q => setQueries(q.filter(x => x.enabled))).catch(() => setQueries(null)) }, [projectId, refreshKey])
  if (!queries || queries.length === 0) return null
  const range = yearFrom || yearTo ? `${yearFrom ?? 'any year'}–${yearTo ?? 'now'}` : 'Any year'
  return (
    <details className="rounded-lg border border-slate-200 px-3 py-2 text-[13px]">
      <summary className="cursor-pointer font-medium text-slate-900">What we searched ({queries.length} {queries.length === 1 ? 'query' : 'queries'})</summary>
      <p className="mt-2 text-slate-700">Date range: {range}. You can copy these into your methods section.</p>
      <ol className="mt-2 list-decimal space-y-1.5 pl-5">
        {queries.map(q => (
          <li key={q.id} className="text-slate-800">
            <code className="rounded bg-slate-50 px-1 text-[12px] [overflow-wrap:anywhere]">{q.queryText}</code>
            {q.targets.length > 0 ? <span className="text-slate-600"> · {q.targets.join(', ')}</span> : null}
          </li>
        ))}
      </ol>
    </details>
  )
}

function MatrixTab({ reviewId, ownMatrixId, onImported, onError }: { reviewId: string; ownMatrixId: string | null; onImported: (r: ImportResult) => void; onError: (e: unknown, f: string) => void }) {
  const [matrices, setMatrices] = useState<MatrixSummary[] | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  useEffect(() => { literatureMatrixApi.list().then(setMatrices).catch(() => setUnavailable(true)) }, [])
  const add = async (m: MatrixSummary) => {
    setBusy(m.id)
    try { onImported(await literatureReviewApi.addMatrix(reviewId, m.id)) } catch (e) { onError(e, 'The studies could not be added.') } finally { setBusy(null) }
  }
  if (unavailable) return <Notice>Your matrices could not be loaded. The Literature Matrix may be switched off.</Notice>
  if (!matrices) return <Loading />
  // The review's own extraction matrix is already its pool; every other matrix can be imported.
  const own = matrices.filter(m => m.id !== ownMatrixId)
  if (own.length === 0) return <p className="text-[13px] text-slate-700">You have no Literature Matrix yet. Matrices you build appear here, and their studies can be added in one go.</p>
  return (
    <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200">
      {own.map(m => (
        <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
          <span className="min-w-0 text-[14px] text-slate-900 [overflow-wrap:anywhere]">{m.name} <span className="text-[13px] text-slate-600">· {m.studyCount} {m.studyCount === 1 ? 'study' : 'studies'}</span></span>
          <button type="button" onClick={() => void add(m)} disabled={busy !== null || m.studyCount === 0} className={btn.small}>{busy === m.id ? 'Adding…' : 'Add its studies'}</button>
        </li>
      ))}
    </ul>
  )
}
