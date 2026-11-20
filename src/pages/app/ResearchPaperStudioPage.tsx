import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { FileText, Plus, Trash2 } from 'lucide-react'
import { researchPaperApi } from '../../api/researchPaper'
import { ComingSoon } from '../../components/app/ToolGate'
import { DocumentList, type DocumentListEntry } from '../../components/app/DocumentList'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import { Skeleton } from '../../components/ui/Skeleton'
import { StudioStepRail } from '../../components/literatureReview/StudioStepRail'
import { Notice } from '../../components/literatureReview/ui'
import { btn, inputClass } from '../../components/literatureReview/styles'
import { QuestionStage } from '../../components/researchPaper/QuestionStage'
import { EvidenceStage } from '../../components/researchPaper/EvidenceStage'
import { ScreeningStage } from '../../components/researchPaper/ScreeningStage'
import { SynthesisStage } from '../../components/researchPaper/SynthesisStage'
import { WritingStage } from '../../components/researchPaper/WritingStage'
import { CheckStage } from '../../components/researchPaper/CheckStage'
import { ExportStage } from '../../components/researchPaper/ExportStage'
import {
  errorMessage, reachedStage, stageIndex, STAGES, STATUS_LABELS,
  type Paper, type PaperOptions, type PaperSummary,
} from '../../lib/researchPaper'
import { cn, formatShortDate } from '../../lib/utils'

type Load<T> = { state: 'loading' } | { state: 'ready'; value: T } | { state: 'missing' } | { state: 'error'; message: string }

function Frame({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return <div className="h-full overflow-y-auto bg-white"><div className="px-4 py-6 sm:px-6"><div className={cn('mx-auto', wide ? 'max-w-[1400px]' : 'max-w-5xl')}>{children}</div></div></div>
}

/**
 * Research Paper Studio, reached only from its side-menu item (user decision 2026-11-18): `/app/research-paper` lists
 * papers and starts one; `/app/research-paper/:id` is one paper's workspace, from question to export.
 */
export default function ResearchPaperStudioPage() {
  const { id } = useParams<{ id: string }>()
  return id ? <Workspace key={id} id={id} /> : <ListRoute />
}

function useAvailability(): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  useEffect(() => { researchPaperApi.availability().then(a => setEnabled(a.enabled)).catch(() => setEnabled(false)) }, [])
  return enabled
}

// ── My papers ───────────────────────────────────────────────────────────────────────────────────────────

function ListRoute() {
  const enabled = useAvailability()
  if (enabled === null) return <Frame><Skeleton lines={6} tone="light" /></Frame>
  if (!enabled) return <ComingSoon tool="research-paper" />
  return <Frame wide><PaperList /></Frame>
}

function PaperList() {
  const navigate = useNavigate()
  const { confirm, dialog } = useConfirm()
  const [list, setList] = useState<Load<PaperSummary[]>>({ state: 'loading' })
  const [options, setOptions] = useState<PaperOptions | null>(null)
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const load = useCallback(() => {
    researchPaperApi.list().then(value => setList({ state: 'ready', value })).catch(e => setList({ state: 'error', message: errorMessage(e, 'Your papers could not be loaded.') }))
  }, [])
  useEffect(() => { load(); researchPaperApi.options().then(setOptions).catch(() => setOptions(null)) }, [load])

  const typeLabel = useCallback((t: string) => options?.paperTypes.find(p => p.type === t)?.label ?? t, [options])
  const entries: DocumentListEntry[] = useMemo(() => list.state !== 'ready' ? [] : list.value
    .filter(p => !search.trim() || p.title.toLowerCase().includes(search.trim().toLowerCase()))
    .map(p => ({
      id: p.id, icon: <FileText size={18} aria-hidden />, iconClassName: 'bg-purple-tint text-purple-text', title: p.title,
      metaLine: `${typeLabel(p.paperType)} · ${p.sourceCount} source${p.sourceCount === 1 ? '' : 's'} · Updated ${formatShortDate(p.updatedAt)}`,
      statusBadge: { label: STATUS_LABELS[p.status], className: p.status === 'Ready' ? 'bg-green-50 text-green-800' : 'bg-purple-tint text-purple-text', progressPct: p.progressPercent },
      onOpen: () => navigate(`/app/research-paper/${p.id}`),
      inlineActions: [],
      overflowActions: [{
        key: 'delete', icon: <Trash2 size={14} aria-hidden />, label: 'Delete', onClick: async () => {
          if (!(await confirm({ title: 'Delete this paper?', message: 'Its sections, checks and screening decisions are deleted. Your saved sources are not touched.', confirmLabel: 'Delete', tone: 'danger' }))) return
          try { await researchPaperApi.remove(p.id); load() } catch (e) { setList({ state: 'error', message: errorMessage(e, 'The paper could not be deleted.') }) }
        },
      }],
    })), [list, search, navigate, confirm, load, typeLabel])

  if (list.state === 'loading') return <Skeleton lines={6} tone="light" />
  if (list.state === 'error') return <Notice tone="error">{list.message} <button type="button" onClick={load} className={btn.link}>Try again</button></Notice>
  return (
    <>
      <h1 className="mb-1 text-[22px] font-semibold text-slate-900">Research papers</h1>
      <p className="mb-4 max-w-3xl text-[15px] text-slate-800">
        Go from a topic to an evidence-grounded paper: approve your research question, find and screen sources, compare the evidence, then draft
        and check a paper in which every claim is tied to a source. Results are written only from results you supply.
      </p>
      {creating && options ? <NewPaperForm options={options} onCancel={() => setCreating(false)} onCreated={p => navigate(`/app/research-paper/${p.id}`)} /> : null}
      <DocumentList
        entries={entries}
        totalCount={list.state === 'ready' ? list.value.length : 0}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search papers…"
        headerRight={creating ? null : <button type="button" onClick={() => setCreating(true)} disabled={!options} className={btn.primary}><Plus size={16} aria-hidden /> New paper</button>}
        emptyIcon={<FileText size={22} aria-hidden />}
        emptyTitle="No papers yet"
        emptySubtitle="Start one from a topic."
      />
      {dialog}
    </>
  )
}

function NewPaperForm({ options, onCreated, onCancel }: { options: PaperOptions; onCreated: (p: Paper) => void; onCancel: () => void }) {
  const [topic, setTopic] = useState('')
  const [paperType, setPaperType] = useState(options.paperTypes[0]?.type ?? 'LiteratureReview')
  const [level, setLevel] = useState('Masters')
  const [studentMode, setStudentMode] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const type = options.paperTypes.find(t => t.type === paperType)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setError(null)
    try { onCreated(await researchPaperApi.create({ topic, paperType, academicLevel: level, studentMode })) }
    catch (err) { setError(errorMessage(err, 'The paper could not be created.')) } finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="mb-5 space-y-3 rounded-xl border border-slate-200 p-4" noValidate aria-label="New paper">
      <div>
        <label htmlFor="rp-topic" className="block text-[14px] font-medium text-slate-900">Topic</label>
        <textarea id="rp-topic" rows={2} value={topic} maxLength={1000} onChange={e => setTopic(e.target.value)} autoFocus aria-describedby="rp-topic-hint"
          placeholder="For example: sleep and academic performance in secondary school students" className={inputClass + ' mt-1'} />
        <p id="rp-topic-hint" className="mt-1 text-[13px] text-slate-700">At least 10 characters{topic.trim().length > 0 && topic.trim().length < 10 ? ` (${10 - topic.trim().length} more)` : ''}. A sentence naming the subject and the group or setting works best.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="rp-type" className="block text-[14px] font-medium text-slate-900">Type of paper</label>
          <select id="rp-type" value={paperType} aria-describedby={type ? 'rp-type-desc' : undefined} onChange={e => setPaperType(e.target.value as typeof paperType)} className={inputClass + ' mt-1'}>
            {options.paperTypes.map(t => <option key={t.type} value={t.type}>{t.label}</option>)}
          </select>
          {type ? <p id="rp-type-desc" className="mt-1 text-[13px] text-slate-700">{type.description}</p> : null}
        </div>
        <div>
          <label htmlFor="rp-level" className="block text-[14px] font-medium text-slate-900">Academic level</label>
          <select id="rp-level" value={level} onChange={e => setLevel(e.target.value)} className={inputClass + ' mt-1'}>
            {options.academicLevels.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>
      {type?.usesSystematicReviewModule ? (
        <Notice tone="info">A systematic review is written in the <Link to="/app/systematic-review" className={btn.link}>Systematic Review</Link> workspace, which keeps its screening ledger and PRISMA counts.</Notice>
      ) : null}
      <label className="flex items-start gap-2 text-[14px] text-slate-900">
        <input type="checkbox" checked={studentMode} onChange={e => setStudentMode(e.target.checked)} className="mt-1" />
        <span>Student mode: show guidance at each stage and a reminder that you are responsible for the work and for your institution's AI-use policy.</span>
      </label>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={busy || topic.trim().length < 10} className={btn.primary}>{busy ? 'Creating…' : 'Create paper'}</button>
        <button type="button" onClick={onCancel} className={btn.secondary}>Cancel</button>
      </div>
    </form>
  )
}

// ── One paper ───────────────────────────────────────────────────────────────────────────────────────────

function Workspace({ id }: { id: string }) {
  const [params, setParams] = useSearchParams()
  const enabled = useAvailability()
  const [paper, setPaper] = useState<Load<Paper>>({ state: 'loading' })

  const load = useCallback(() => {
    researchPaperApi.get(id).then(value => setPaper({ state: 'ready', value }))
      .catch(e => setPaper((e as { response?: { status?: number } })?.response?.status === 404 || /not found/i.test((e as { message?: string })?.message ?? '')
        ? { state: 'missing' } : { state: 'error', message: errorMessage(e, 'The paper could not be loaded.') }))
  }, [id])
  useEffect(() => { if (enabled) load() }, [enabled, load])

  if (enabled === false) return <ComingSoon tool="research-paper" />
  if (enabled === null || paper.state === 'loading') return <Frame><Skeleton lines={8} tone="light" /></Frame>
  if (paper.state === 'missing') return <Frame><Notice tone="info" role="alert">This paper does not exist, or it was deleted. <Link to="/app/research-paper" className={btn.link}>See your papers</Link></Notice></Frame>
  if (paper.state !== 'ready') return <Frame><Notice tone="error">{paper.state === 'error' ? paper.message : 'Something went wrong.'} <button type="button" onClick={load} className={btn.link}>Try again</button></Notice></Frame>

  const p = paper.value
  const reached = reachedStage(p.status)
  const current = params.get('stage') ? stageIndex(params.get('stage')) : reached
  const go = (i: number, section?: string) => { setParams(section ? { stage: STAGES[i].id, section } : { stage: STAGES[i].id }); window.scrollTo?.(0, 0) }
  const onChanged = (next?: Paper) => (next ? setPaper({ state: 'ready', value: next }) : load())
  const steps = STAGES.map(s => ({ ...s, count: s.id === 'evidence' && p.sourceCount > 0 ? `${p.sourceCount} source${p.sourceCount === 1 ? '' : 's'}` : undefined }))
  const stage = STAGES[current].id

  return (
    <Frame wide>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <nav aria-label="Breadcrumb" className="text-[13px] text-slate-600"><Link to="/app/research-paper" className="hover:underline">Research papers</Link> / {STAGES[current].label}</nav>
          <h1 className="mt-0.5 text-[22px] font-semibold text-slate-900 [overflow-wrap:anywhere]">{p.title}</h1>
          <p className="mt-0.5 text-[13px] text-slate-700">{p.sourceCount} approved source{p.sourceCount === 1 ? '' : 's'} · {current > reached ? STATUS_LABELS[p.status] : STAGES[current].label}</p>
        </div>
        <div className="w-48" aria-label={`${p.progressPercent}% through the workflow`}>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-purple-accent" style={{ width: `${p.progressPercent}%` }} /></div>
          <p className="mt-1 text-right text-[12px] text-slate-600">{p.progressPercent}% through</p>
        </div>
      </header>
      {p.studentMode ? (
        <div className="mb-4"><Notice tone="info">You are responsible for this paper and for following your institution's policy on the use of AI. The studio drafts from the evidence you approve; read and check what it writes.</Notice></div>
      ) : null}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <StudioStepRail steps={steps} current={current} reached={reached} onSelect={go} label="Research paper stages" />
        <main className="min-w-0">
          {stage === 'question' ? <QuestionStage paper={p} onChanged={onChanged} onNext={() => go(1)} /> : null}
          {stage === 'evidence' ? <EvidenceStage paper={p} onChanged={onChanged} onNext={() => go(2)} /> : null}
          {stage === 'screening' ? <ScreeningStage paper={p} onChanged={onChanged} onNext={() => go(3)} /> : null}
          {stage === 'synthesis' ? <SynthesisStage paper={p} onNext={() => go(4)} /> : null}
          {stage === 'writing' ? <WritingStage paper={p} onChanged={onChanged} onNext={() => go(5)} focusSection={params.get('section')} /> : null}
          {stage === 'check' ? <CheckStage paper={p} onChanged={onChanged} onOpenSection={code => go(4, code)} onNext={() => go(6)} /> : null}
          {stage === 'export' ? <ExportStage paper={p} /> : null}
        </main>
      </div>
    </Frame>
  )
}
