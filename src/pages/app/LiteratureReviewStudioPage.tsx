import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BookOpenCheck, Plus, Trash2 } from 'lucide-react'
import { literatureReviewApi } from '../../api/literatureReview'
import { ComingSoon } from '../../components/app/ToolGate'
import { DocumentList, type DocumentListEntry } from '../../components/app/DocumentList'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import { Skeleton } from '../../components/ui/Skeleton'
import { StudioStepRail } from '../../components/literatureReview/StudioStepRail'
import { ScopeStep } from '../../components/literatureReview/ScopeStep'
import { SourcesStep } from '../../components/literatureReview/SourcesStep'
import { ScreenStep } from '../../components/literatureReview/ScreenStep'
import { ThemesStep } from '../../components/literatureReview/ThemesStep'
import { DraftStep } from '../../components/literatureReview/DraftStep'
import { ReviewStep } from '../../components/literatureReview/ReviewStep'
import { Notice } from '../../components/literatureReview/ui'
import { btn, inputClass } from '../../components/literatureReview/styles'
import { MatrixListPanel } from './LiteratureMatrixPage'
import {
  errorMessage, reachedStep, REVIEW_TYPE_LABELS, STATUS_LABELS, STEPS, stepIndex,
  type Review, type ReviewOptions, type ReviewSummary,
} from '../../lib/literatureReview'
import { cn, formatShortDate } from '../../lib/utils'

type Load<T> = { state: 'loading' } | { state: 'ready'; value: T } | { state: 'off' } | { state: 'missing' } | { state: 'error'; message: string }

function Frame({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return <div className="h-full overflow-y-auto bg-white"><div className="px-4 py-6 sm:px-6"><div className={cn('mx-auto', wide ? 'max-w-[1400px]' : 'max-w-5xl')}>{children}</div></div></div>
}

/**
 * Literature Review Studio: `/app/literature-review` lists reviews (and the student's Literature Matrices, which live
 * under the same menu item); `/app/literature-review/:id` is one review's guided workflow.
 */
export default function LiteratureReviewStudioPage() {
  const { id } = useParams<{ id: string }>()
  const [params] = useSearchParams()
  // Links from the retired literature-review page carried a Proposal Studio project id.
  const legacyProject = params.get('projectId')
  if (!id && legacyProject) return <Navigate to={`/app/research-agent/${legacyProject}`} replace />
  return id ? <Workspace key={id} id={id} /> : <ListRoute />
}

function useAvailability(): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  useEffect(() => { literatureReviewApi.availability().then(a => setEnabled(a.enabled)).catch(() => setEnabled(false)) }, [])
  return enabled
}

// ── List ────────────────────────────────────────────────────────────────────────────────────────────────

function ListRoute() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'matrices' ? 'matrices' : 'reviews'
  const enabled = useAvailability()
  if (enabled === null) return <Frame><Skeleton lines={6} tone="light" /></Frame>
  if (!enabled && tab === 'reviews') return <ComingSoon tool="literature-review" />
  return (
    <Frame wide>
      <div role="tablist" aria-label="Literature review" className="mb-5 flex gap-1 border-b border-slate-200">
        {(['reviews', 'matrices'] as const).map(t => (
          <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => setParams(t === 'matrices' ? { tab: 'matrices' } : {})}
            className={cn('-mb-px border-b-2 px-3 py-2 text-[14px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40',
              tab === t ? 'border-purple-accent text-purple-text' : 'border-transparent text-slate-700 hover:text-slate-900')}>
            {t === 'reviews' ? 'Reviews' : 'Literature matrices'}
          </button>
        ))}
      </div>
      {tab === 'reviews' ? <ReviewList /> : <div className="-mx-4 -my-6 sm:-mx-6"><MatrixListPanel /></div>}
    </Frame>
  )
}

function ReviewList() {
  const navigate = useNavigate()
  const { confirm, dialog } = useConfirm()
  const [list, setList] = useState<Load<ReviewSummary[]>>({ state: 'loading' })
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const load = useCallback(() => {
    literatureReviewApi.list().then(value => setList({ state: 'ready', value })).catch(e => setList({ state: 'error', message: errorMessage(e, 'Your reviews could not be loaded.') }))
  }, [])
  useEffect(load, [load])

  const entries: DocumentListEntry[] = useMemo(() => list.state !== 'ready' ? [] : list.value
    .filter(r => !search.trim() || `${r.title} ${r.question}`.toLowerCase().includes(search.trim().toLowerCase()))
    .map(r => ({
      id: r.id, icon: <BookOpenCheck size={18} aria-hidden />, iconClassName: 'bg-purple-tint text-purple-text', title: r.title,
      metaLine: `${REVIEW_TYPE_LABELS[r.reviewType] ?? r.reviewType} · ${r.sourceCount} source${r.sourceCount === 1 ? '' : 's'} · Updated ${formatShortDate(r.updatedAt)}`,
      statusBadge: { label: STATUS_LABELS[r.status], className: r.status === 'Ready' ? 'bg-green-50 text-green-800' : 'bg-purple-tint text-purple-text', progressPct: r.progressPercent },
      onOpen: () => navigate(`/app/literature-review/${r.id}`),
      inlineActions: [],
      overflowActions: [{
        key: 'delete', icon: <Trash2 size={14} aria-hidden />, label: 'Delete', onClick: async () => {
          if (!(await confirm({ title: 'Delete this review?', message: 'Its themes and drafts are deleted. Your saved sources are not touched.', confirmLabel: 'Delete', tone: 'danger' }))) return
          try { await literatureReviewApi.remove(r.id); load() } catch (e) { setList({ state: 'error', message: errorMessage(e, 'The review could not be deleted.') }) }
        },
      }],
    })), [list, search, navigate, confirm, load])

  if (list.state === 'loading') return <Skeleton lines={6} tone="light" />
  if (list.state === 'error') return <Notice tone="error">{list.message} <button type="button" onClick={load} className={btn.link}>Try again</button></Notice>
  return (
    <>
      <p className="mb-4 max-w-3xl text-[15px] text-slate-800">
        Go from a research question to a checked literature review: find and screen sources, extract the evidence, find themes across studies, then draft with every claim tied to a source.
        For a formal systematic review, use <Link to="/app/systematic-review" className={btn.link}>Systematic Review</Link>.
      </p>
      {creating ? <NewReviewForm onCancel={() => setCreating(false)} onCreated={r => navigate(`/app/literature-review/${r.id}`)} /> : null}
      <DocumentList
        entries={entries}
        totalCount={list.state === 'ready' ? list.value.length : 0}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search reviews…"
        headerRight={creating ? null : <button type="button" onClick={() => setCreating(true)} className={btn.primary}><Plus size={16} aria-hidden /> New literature review</button>}
        emptyIcon={<BookOpenCheck size={22} aria-hidden />}
        emptyTitle="No literature reviews yet"
        emptySubtitle="Start one from a research question."
      />
      {dialog}
    </>
  )
}

function NewReviewForm({ onCreated, onCancel }: { onCreated: (r: Review) => void; onCancel: () => void }) {
  const [question, setQuestion] = useState('')
  const [reviewType, setReviewType] = useState('Thematic')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try { onCreated(await literatureReviewApi.create({ question, reviewType })) }
    catch (err) { setError(errorMessage(err, 'The review could not be created.')) } finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="mb-5 space-y-3 rounded-xl border border-slate-200 p-4" noValidate>
      <div>
        <label htmlFor="lr-new-question" className="block text-[14px] font-medium text-slate-900">Research question or topic</label>
        <textarea id="lr-new-question" rows={2} value={question} maxLength={1000} onChange={e => setQuestion(e.target.value)} autoFocus
          placeholder="For example: How does social media use relate to anxiety in adolescents?" className={inputClass + ' mt-1'} />
      </div>
      <div>
        <label htmlFor="lr-new-type" className="block text-[14px] font-medium text-slate-900">Type of review</label>
        <select id="lr-new-type" value={reviewType} onChange={e => setReviewType(e.target.value)} className={inputClass + ' mt-1 max-w-sm'}>
          {Object.entries(REVIEW_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={btn.primary}>{busy ? 'Creating…' : 'Create review'}</button>
        <button type="button" onClick={onCancel} className={btn.secondary}>Cancel</button>
      </div>
    </form>
  )
}

// ── Workspace ───────────────────────────────────────────────────────────────────────────────────────────

function Workspace({ id }: { id: string }) {
  const [params, setParams] = useSearchParams()
  const enabled = useAvailability()
  const [review, setReview] = useState<Load<Review>>({ state: 'loading' })
  const [options, setOptions] = useState<ReviewOptions | null>(null)

  const load = useCallback(() => {
    literatureReviewApi.get(id).then(value => setReview({ state: 'ready', value }))
      .catch(e => setReview((e as { response?: { status?: number } })?.response?.status === 404 || /not found/i.test((e as { message?: string })?.message ?? '')
        ? { state: 'missing' } : { state: 'error', message: errorMessage(e, 'The review could not be loaded.') }))
  }, [id])
  useEffect(() => { if (enabled) { load(); literatureReviewApi.options().then(setOptions).catch(() => setOptions(null)) } }, [enabled, load])

  if (enabled === false) return <ComingSoon tool="literature-review" />
  if (enabled === null || review.state === 'loading') return <Frame><Skeleton lines={8} tone="light" /></Frame>
  if (review.state === 'missing') {
    return <Frame><Notice tone="info" role="alert">This review does not exist, or it was deleted. <Link to="/app/literature-review" className={btn.link}>See your reviews</Link></Notice></Frame>
  }
  if (review.state !== 'ready') return <Frame><Notice tone="error">{review.state === 'error' ? review.message : 'Something went wrong.'} <button type="button" onClick={load} className={btn.link}>Try again</button></Notice></Frame>

  const r = review.value
  const reached = Math.max(reachedStep(r.status), r.currentStep)
  const current = params.get('step') ? stepIndex(params.get('step')) : Math.min(reached, STEPS.length - 1)
  const go = (i: number) => {
    setParams({ step: STEPS[i].id })
    if (i > r.currentStep) void literatureReviewApi.update(r.id, { currentStep: i }).then(value => setReview({ state: 'ready', value })).catch(() => {})
    window.scrollTo?.(0, 0)
  }
  const next = () => go(Math.min(current + 1, STEPS.length - 1))
  const steps = STEPS.map(s => ({ ...s, count: s.id === 'sources' ? `${r.sourceCount} source${r.sourceCount === 1 ? '' : 's'}` : undefined }))

  return (
    <Frame wide>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] text-slate-600"><Link to="/app/literature-review" className="hover:underline">Literature reviews</Link> / {REVIEW_TYPE_LABELS[r.reviewType] ?? r.reviewType}</p>
          <h1 className="mt-0.5 text-[22px] font-semibold text-slate-900 [overflow-wrap:anywhere]">{r.title}</h1>
          <p className="mt-0.5 text-[13px] text-slate-700">{r.sourceCount} source{r.sourceCount === 1 ? '' : 's'} in the review · {STATUS_LABELS[r.status]}</p>
        </div>
        <div className="w-48" aria-label={`Step ${current + 1} of ${STEPS.length}, ${r.progressPercent}% through the workflow`}>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-purple-accent" style={{ width: `${r.progressPercent}%` }} /></div>
          <p className="mt-1 text-right text-[12px] text-slate-600">Step {current + 1} of {STEPS.length}</p>
        </div>
      </header>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <StudioStepRail steps={steps} current={current} reached={reached} onSelect={go} label="Literature review steps" />
        <main className="min-w-0">
          {STEPS[current].id === 'scope' && options ? <ScopeStep review={r} options={options} onSaved={v => setReview({ state: 'ready', value: v })} onNext={next} /> : null}
          {STEPS[current].id === 'sources' ? <SourcesStep review={r} onChanged={load} onNext={next} /> : null}
          {STEPS[current].id === 'screen' ? <ScreenStep review={r} onChanged={load} onNext={next} /> : null}
          {STEPS[current].id === 'themes' ? <ThemesStep review={r} onChanged={load} onNext={next} /> : null}
          {STEPS[current].id === 'draft' ? <DraftStep review={r} onChanged={load} onNext={next} /> : null}
          {STEPS[current].id === 'review' ? <ReviewStep review={r} onChanged={load} /> : null}
        </main>
      </div>
    </Frame>
  )
}
