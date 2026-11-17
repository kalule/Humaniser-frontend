import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Search, Trash2 } from 'lucide-react'
import { literatureReviewApi } from '../../api/literatureReview'
import { literatureMatrixApi } from '../../api/literatureMatrix'
import { researchApi } from '../../api/research'
import { SavedSourcePicker } from '../webLibrary/SavedSourcePicker'
import {
  errorMessage, EVIDENCE_LABELS, importSummary, PROVIDER_LABELS, SOFT_MIN_SOURCES,
  type Coverage, type ImportResult, type PoolSource, type Review,
} from '../../lib/literatureReview'
import type { DiscoveryStatus } from '../../types/research'
import type { MatrixSummary } from '../../lib/literatureMatrix'
import { Chip, Loading, Notice, Panel } from './ui'
import { btn } from './styles'
import { cn } from '../../lib/utils'

type Tab = 'library' | 'search' | 'matrix'
const TABS: { id: Tab; label: string }[] = [
  { id: 'library', label: 'Research Library' },
  { id: 'search', label: 'Search databases' },
  { id: 'matrix', label: 'From a Literature Matrix' },
]

/** Step 2: everything that enters the review's source pool. Search results are screened in step 3 before they join. */
export function SourcesStep({ review, onChanged, onNext }: { review: Review; onChanged: () => void; onNext: () => void }) {
  const [tab, setTab] = useState<Tab>('library')
  const [pool, setPool] = useState<PoolSource[] | null>(null)
  const [poolError, setPoolError] = useState<string | null>(null)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  const loadPool = useCallback(() => {
    setPoolError(null)
    literatureReviewApi.sources(review.id).then(setPool).catch(e => setPoolError(errorMessage(e, 'The sources could not be loaded.')))
  }, [review.id])
  useEffect(loadPool, [loadPool])

  const afterImport = (r: ImportResult) => { setMessage({ tone: 'success', text: importSummary(r) }); loadPool(); onChanged() }
  const failed = (e: unknown, fallback: string) => setMessage({ tone: 'error', text: errorMessage(e, fallback) })

  const remove = async (s: PoolSource) => {
    try { await literatureReviewApi.removeSource(review.id, s.id); loadPool(); onChanged() } catch (e) { failed(e, 'The source could not be removed.') }
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
          {tab === 'search' ? <SearchTab review={review} /> : null}
          {tab === 'matrix' ? <MatrixTab reviewId={review.id} ownMatrixId={review.literatureMatrixId} onImported={afterImport} onError={failed} /> : null}
        </div>
      </div>

      <Panel title={`In this review${pool ? ` (${pool.length})` : ''}`} description="Sources you added. Search results join after screening." id="lr-pool">
        {poolError ? <Notice tone="error">{poolError}</Notice> : !pool ? <Loading /> : (
          <>
            {pool.length < SOFT_MIN_SOURCES ? (
              <Notice tone="warning">A review usually needs at least {SOFT_MIN_SOURCES} sources to compare. You can continue with fewer, but themes and gaps will be thin.</Notice>
            ) : null}
            {pool.length === 0 ? <p className="mt-2 text-[13px] text-slate-700">Nothing yet. Add sources from your library, a matrix, or run a search.</p> : (
              <ul className="mt-2 max-h-[60vh] divide-y divide-slate-100 overflow-y-auto">
                {pool.map(s => (
                  <li key={s.id} className="flex items-start gap-2 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-slate-900 [overflow-wrap:anywhere]">{s.title}</p>
                      <p className="text-[12px] text-slate-600">{s.authors || 'Unknown authors'}{s.year ? ` · ${s.year}` : ''} · {EVIDENCE_LABELS[s.evidenceLevel]} · {s.origin === 'Search' ? 'from search' : 'from your library'}</p>
                    </div>
                    <button type="button" onClick={() => void remove(s)} className="rounded p-1 text-slate-600 hover:bg-slate-100 hover:text-red-700" aria-label={`Take "${s.title}" out of the review`}><Trash2 size={15} aria-hidden /></button>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" onClick={onNext} className={btn.primary + ' mt-3 w-full justify-center'}>Continue to screening</button>
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

function SearchTab({ review }: { review: Review }) {
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
      setCoverage(c)
      setError(null)
      setFailedPolls(0)
    } catch (e) {
      setError(errorMessage(e, 'The search status could not be loaded. Retrying.'))
      setFailedPolls(n => n + 1)
    }
  }, [projectId, review.id])
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
  const retry = async () => {
    setError(null)
    try { await researchApi.retryFailedSources(projectId); await refresh() } catch (e) { setError(errorMessage(e, 'The databases could not be retried.')) }
  }

  const running = status?.status === 'Running'
  const unavailable = coverage?.providers.filter(p => p.state === 'ProviderUnavailable') ?? []
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-slate-700">
        We search several scholarly databases with queries built from your question{review.yearFrom || review.yearTo ? ' and date range' : ''}. Papers found here are screened in the next step before they join the review.
      </p>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {busy ? <Loading label={busy} /> : null}
      {status ? (
        <div role="status" className="rounded-lg border border-slate-200 p-3 text-[13px] text-slate-800">
          <p className="font-medium text-slate-900">
            {status.status === 'NotStarted' ? 'Not searched yet.' : running ? `Searching… ${status.progressPct}%` : status.status === 'Error' ? (status.statusMessage || 'The search stopped with an error.') : `Search finished: ${status.uniqueCount} unique papers (${status.duplicateCount} duplicates merged).`}
          </p>
          {running && status.liveActivityMessage ? <p className="mt-1 text-slate-700">{status.liveActivityMessage}</p> : null}
        </div>
      ) : null}
      {coverage && coverage.providers.length > 0 ? (
        <ul className="grid gap-1.5 sm:grid-cols-2" aria-label="What each database did">
          {coverage.providers.map(p => (
            <li key={p.id} className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-[13px]">
              <span className="min-w-0"><span className="font-medium text-slate-900">{p.name}</span><span className="block text-slate-700">{p.message}</span></span>
              <Chip className={p.state === 'ProviderUnavailable' ? 'border-red-300 bg-red-50 text-red-900' : p.state === 'Results' ? 'border-green-300 bg-green-50 text-green-900' : 'border-slate-300 bg-slate-50 text-slate-800'}>
                {PROVIDER_LABELS[p.state]}
              </Chip>
            </li>
          ))}
        </ul>
      ) : null}
      {unavailable.length > 0 ? (
        <Notice tone="warning">
          {unavailable.map(p => p.name).join(', ')} did not respond, so their results are missing, not empty.{' '}
          <button type="button" onClick={() => void retry()} className={btn.link}>Try them again</button>
        </Notice>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void start()} disabled={running || !!busy} className={btn.secondary}>
          {status && status.status !== 'NotStarted' ? <RefreshCw size={16} aria-hidden /> : <Search size={16} aria-hidden />}
          {status && status.status !== 'NotStarted' ? 'Search again' : 'Search databases'}
        </button>
      </div>
    </div>
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
