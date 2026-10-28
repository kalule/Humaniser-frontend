import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2, Square, ArrowLeft, History } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '../../lib/utils'
import { BindEvidenceModal } from '../../components/app/BindEvidenceModal'
import { DeepResearchPrompt } from '../../components/app/DeepResearchPrompt'
import { DeepResearchResults } from '../../components/app/DeepResearchResults'
import { statusBanner, type Prefill, type SourceGroup } from '../../lib/deepResearchView'
import { unwatchSession, watchSession } from '../../lib/deepResearchWatch'
import { researchApi } from '../../api/research'
import type { ResearchProject } from '../../types/research'
import {
  deepResearchApi,
  type DeepResearchMode, type DeepResearchSession, type DeepResearchSessionSummary, type EvidenceSource,
} from '../../api/deepResearch'
import {
  POLL_INTERVAL_MS,
  STALL_AFTER_MS, activeSessionFor, apiErrorMessage, timeAgo, isQuestionValid, progressPercent, shouldPoll,
} from '../../lib/deepResearch'

// ── start form ──────────────────────────────────────────────────────────────────────────────

function StartForm({ projects, initialProjectId, prefill, sessions, onStarted, onOpen, onStop, onResume }: {
  projects: ResearchProject[]
  initialProjectId: string
  prefill: Prefill | null
  sessions: DeepResearchSessionSummary[]
  onStarted: (s: DeepResearchSession) => void
  onOpen: (id: string) => void
  onStop: (id: string) => void
  onResume: (id: string) => void
}) {
  const [projectId, setProjectId] = useState(prefill?.projectId ?? initialProjectId)
  const [question, setQuestion] = useState(prefill?.question ?? '')
  const [mode, setMode] = useState<DeepResearchMode>(prefill?.mode ?? 'TopicExploration')
  const [geography, setGeography] = useState(prefill?.geography ?? '')
  const [peerReviewed, setPeerReviewed] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (!projectId && projects[0]) setProjectId(projects[0].id) }, [projects, projectId])

  // The server allows one unfinished session per project, so say so up front and point at it,
  // instead of letting the student fill the form in and be refused.
  const active = activeSessionFor(sessions, projectId)
  const canStart = !!projectId && isQuestionValid(question) && !busy && !active

  const start = async () => {
    if (!canStart) return
    setBusy(true)
    // Ask (once, on this click) to be told when it finishes, so the student can leave the page.
    try { if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission() } catch { /* unsupported */ }
    try {
      onStarted(await deepResearchApi.start({
        projectId, researchQuestion: question.trim(), mode,
        geography: geography.trim() || undefined,
        requirePeerReviewed: peerReviewed || undefined,
      }))
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not start Deep Research. Please try again.'))
      setBusy(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {active && (
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 flex items-start gap-3">
          <Loader2 size={16} className="animate-spin text-purple-accent mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-slate-800">Research is already running for this project</p>
            <p className="text-[12px] text-slate-600 mt-0.5 line-clamp-2">{active.researchQuestion}</p>
            <p className="text-[12px] text-slate-500 mt-0.5">{active.message}</p>
            <div className="flex gap-3 mt-2">
              <button onClick={() => onOpen(active.id)} className="text-[12px] font-medium text-purple-accent hover:underline">Open it</button>
              {active.canResume
                ? <button onClick={() => onResume(active.id)} className="text-[12px] font-medium text-purple-accent hover:underline">Pick up where it left off</button>
                : <button onClick={() => onStop(active.id)} className="text-[12px] font-medium text-slate-600 hover:underline">Stop it</button>}
            </div>
          </div>
        </div>
      )}
      {prefill && (
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-3 text-[12px] text-purple-900">
          Started from an earlier session — edit the question if you like.
          {prefill.unanswered.length > 0 && (
            <details className="mt-1.5">
              <summary className="cursor-pointer font-medium">{prefill.unanswered.length} question{prefill.unanswered.length === 1 ? '' : 's'} that session did not answer</summary>
              <ul className="list-disc pl-5 mt-1 space-y-0.5">{prefill.unanswered.map((q, i) => <li key={i}>{q}</li>)}</ul>
            </details>
          )}
        </div>
      )}
      <DeepResearchPrompt
        question={question}
        onQuestion={setQuestion}
        mode={mode}
        onMode={setMode}
        onExample={(q, m) => { setQuestion(q); setMode(m) }}
        canStart={canStart}
        busy={busy}
        onStart={() => void start()}
        autoFocus={!!prefill}
        options={(
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[12px] text-slate-500 mb-1 block">Project</label>
              {projects.length === 0 ? (
                <p className="text-[13px] text-slate-600">Create a research project first — Deep Research saves what it finds against a project.</p>
              ) : (
                <select value={projectId} onChange={e => setProjectId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-[13px] text-slate-700 bg-white outline-none focus:border-purple-accent">
                  {projects.map(p => <option key={p.id} value={p.id}>{p.title || 'Untitled project'}</option>)}
                </select>
              )}
            </div>
            <div>
              <label className="text-[12px] text-slate-500 mb-1 block">Study region <span className="text-slate-400">(optional)</span></label>
              <input value={geography} onChange={e => setGeography(e.target.value)} placeholder="e.g. South Africa"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-[13px] text-slate-700 outline-none focus:border-purple-accent" />
              <p className="text-[11px] text-slate-500 mt-1">Evidence from this region is weighted above evidence from elsewhere.</p>
            </div>
            <label className="sm:col-span-2 flex items-center gap-2 text-[13px] text-slate-600">
              <input type="checkbox" checked={peerReviewed} onChange={e => setPeerReviewed(e.target.checked)} />
              Peer-reviewed sources only
            </label>
          </div>
        )}
      />

      <MyResearch sessions={sessions} projects={projects} onOpen={onOpen} onStop={onStop} onResume={onResume} />
    </div>
  )
}

// ── my research ─────────────────────────────────────────────────────────────────────────────

function statusChip(s: DeepResearchSessionSummary): { label: string; className: string } {
  if (!s.isFinished) return s.canResume
    ? { label: 'Paused', className: 'bg-amber-50 text-amber-700' }
    : { label: 'Running', className: 'bg-purple-50 text-purple-700' }
  switch (s.status) {
    case 'Completed': return { label: 'Complete', className: 'bg-emerald-50 text-emerald-700' }
    case 'Stopped':   return { label: 'Stopped at limit', className: 'bg-amber-50 text-amber-700' }
    case 'Cancelled': return { label: 'Stopped by you', className: 'bg-slate-100 text-slate-600' }
    default:          return { label: 'Could not finish', className: 'bg-red-50 text-red-700' }
  }
}

function MyResearch({ sessions, projects, onOpen, onStop, onResume }: {
  sessions: DeepResearchSessionSummary[]
  projects: ResearchProject[]
  onOpen: (id: string) => void
  onStop: (id: string) => void
  onResume: (id: string) => void
}) {
  if (sessions.length === 0) return null
  const projectName = (id: string) => projects.find(p => p.id === id)?.title || 'Untitled project'
  return (
    <section className="pt-4 border-t border-slate-100">
      <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-800 mb-2"><History size={14} /> Your research</h3>
      <ul className="space-y-2">
        {sessions.map(r => {
          const chip = statusChip(r)
          return (
            <li key={r.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <button onClick={() => onOpen(r.id)} className="min-w-0 text-left">
                  <p className="text-[13px] font-medium text-slate-800 line-clamp-2">{r.researchQuestion}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                    {projectName(r.projectId)} · {timeAgo(r.createdAt)}
                    {r.isFinished && r.status !== 'Failed' ? ` · ${r.acceptedSources} source${r.acceptedSources === 1 ? '' : 's'}` : ''}
                  </p>
                  {!r.isFinished && <p className="text-[11px] text-slate-500 mt-0.5">{r.message}</p>}
                </button>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium', chip.className)}>{chip.label}</span>
                  {!r.isFinished && (r.canResume
                    ? <button onClick={() => onResume(r.id)} className="text-[11px] text-purple-accent hover:underline">Resume</button>
                    : <button onClick={() => onStop(r.id)} className="text-[11px] text-slate-500 hover:underline">Stop</button>)}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// ── running ─────────────────────────────────────────────────────────────────────────────────

function RunningView({ session, onStop, stopping, onResume }: { session: DeepResearchSession; onStop: () => void; stopping: boolean; onResume: () => void }) {
  const p = session.progress
  const pct = progressPercent(session)
  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex items-start gap-3">
          <Loader2 size={18} className="animate-spin text-purple-accent mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-slate-800" aria-live="polite">{p.message}</p>
            <p className="text-[12px] text-slate-500 mt-0.5 truncate">{session.researchQuestion}</p>
          </div>
        </div>
        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-primary transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          {[
            ['Searches run', p.searchesRun],
            ['Sources found', p.sourcesDiscovered],
            ['Relevant', p.sourcesRelevant],
            ['Verified', p.sourcesVerified],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-lg bg-slate-50 py-2">
              <dd className="text-[18px] font-semibold text-slate-800">{value}</dd>
              <dt className="text-[11px] text-slate-500">{label}</dt>
            </div>
          ))}
        </dl>
      </div>
      {Date.now() - new Date(session.updatedAt).getTime() > STALL_AFTER_MS && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-center justify-between gap-3">
          <p className="text-[12px] text-amber-800">This research has not moved for a few minutes. It may have been interrupted.</p>
          <button onClick={onResume} className="shrink-0 text-[12px] font-medium text-amber-900 underline">Pick up where it left off</button>
        </div>
      )}
      <div className="flex justify-end">
        <button onClick={onStop} disabled={stopping}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-[12px] text-slate-600 hover:bg-slate-50 disabled:opacity-50">
          <Square size={12} /> {stopping ? 'Stopping…' : 'Stop and keep what was found'}
        </button>
      </div>
    </div>
  )
}

// ── page ────────────────────────────────────────────────────────────────────────────────────

export default function DeepResearchPage() {
  const [params, setParams] = useSearchParams()
  const sessionId = params.get('session')
  const [projects, setProjects] = useState<ResearchProject[]>([])
  const [session, setSession] = useState<DeepResearchSession | null>(null)
  const [sources, setSources] = useState<EvidenceSource[]>([])
  const [loading, setLoading] = useState(!!sessionId)
  const [stopping, setStopping] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [bindFor, setBindFor] = useState<EvidenceSource | null>(null)
  const [mySessions, setMySessions] = useState<DeepResearchSessionSummary[]>([])
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const [prefill, setPrefill] = useState<Prefill | null>(null)
  const [exporting, setExporting] = useState(false)
  const alive = useRef(true)

  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    if (!sessionId) return
    try { setAddedIds(new Set(JSON.parse(localStorage.getItem(`deepResearch.added.${sessionId}`) ?? '[]'))) } catch { setAddedIds(new Set()) }
  }, [sessionId])
  useEffect(() => { researchApi.list().then(p => alive.current && setProjects(p)).catch(() => {}) }, [])

  const loadSources = useCallback(async (id: string) => {
    try {
      const all = await deepResearchApi.evidence(id, 'all')
      if (alive.current) setSources(all)
    } catch { /* the session view still renders without the source list */ }
  }, [])

  // Load, then poll only while the research is still running.
  useEffect(() => {
    if (!sessionId) { setSession(null); setSources([]); setLoading(false); return }
    let timer: ReturnType<typeof setTimeout> | undefined
    let cancelled = false
    const tick = async () => {
      try {
        const s = await deepResearchApi.get(sessionId)
        if (cancelled) return
        setSession(s)
        setLoading(false)
        if (shouldPoll(s)) { watchSession(sessionId); timer = setTimeout(() => void tick(), POLL_INTERVAL_MS) }
        else { unwatchSession(sessionId); void loadSources(sessionId) }
      } catch (err) {
        if (cancelled) return
        setLoading(false)
        toast.error(apiErrorMessage(err, 'Could not load this research session.'))
        setParams({}, { replace: true })
      }
    }
    void tick()
    return () => { cancelled = true; if (timer) clearTimeout(timer) }
  }, [sessionId, setParams, loadSources])

  // "Your research": loaded whenever the start screen is showing, refreshed while anything is still running.
  const refreshSessions = useCallback(async () => {
    try {
      const rows = await deepResearchApi.list(undefined, 10)
      if (alive.current) setMySessions(rows)
      return rows
    } catch { return [] as DeepResearchSessionSummary[] }
  }, [])

  useEffect(() => {
    if (sessionId) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let cancelled = false
    const tick = async () => {
      const rows = await refreshSessions()
      if (!cancelled && rows.some(r => !r.isFinished && !r.canResume)) timer = setTimeout(() => void tick(), 5000)
    }
    void tick()
    return () => { cancelled = true; if (timer) clearTimeout(timer) }
  }, [sessionId, refreshSessions])

  const openSession = (id: string) => setParams({ session: id }, { replace: false })
  const stopById = async (id: string) => {
    try { await deepResearchApi.cancel(id); toast.success('Stopped. What was found so far is kept.') }
    catch (err) { toast.error(apiErrorMessage(err, 'Could not stop the research.')) }
    void refreshSessions()
  }
  const resumeById = async (id: string) => {
    try { await deepResearchApi.resume(id); watchSession(id); toast.success('Picking up where it left off.') }
    catch (err) { toast.error(apiErrorMessage(err, 'Could not continue the research.')) }
    void refreshSessions()
  }

  const onStarted = (s: DeepResearchSession) => { watchSession(s.id); setSession(s); setParams({ session: s.id }, { replace: true }) }

  const stop = async () => {
    if (!session) return
    setStopping(true)
    try { setSession(await deepResearchApi.cancel(session.id)) }
    catch (err) { toast.error(apiErrorMessage(err, 'Could not stop the research.')) }
    finally { setStopping(false) }
  }

  const resume = async () => {
    if (!session) return
    try { setSession(await deepResearchApi.resume(session.id)); setParams({ session: session.id }, { replace: true }) }
    catch (err) { toast.error(apiErrorMessage(err, 'Could not continue the research.')) }
  }

  const decide = async (sourceId: string, decision: 'accept' | 'reject' | 'clear') => {
    if (!session) return
    setBusyId(sourceId)
    try {
      await deepResearchApi.decide(session.id, sourceId, decision)
      const [fresh] = await Promise.all([deepResearchApi.get(session.id), loadSources(session.id)])
      if (alive.current) setSession(fresh)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not save your decision.'))
    } finally { setBusyId(null) }
  }

  const add = async (sourceId: string) => {
    if (!session || busyId === sourceId) return              // double-click guard: one request per source at a time
    setBusyId(sourceId)
    try {
      const r = await deepResearchApi.addToProject(session.id, sourceId)
      setAddedIds(prev => {
        const next = new Set(prev).add(sourceId)
        try { localStorage.setItem(`deepResearch.added.${session.id}`, JSON.stringify([...next])) } catch { /* only a convenience */ }
        return next
      })
      toast.success(r.alreadyInProject ? 'Already in your references.' : 'Added to your references.')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not add this source.'))
    } finally { setBusyId(null) }
  }

  const exportPackage = async () => {
    if (!session || exporting) return
    setExporting(true)
    try {
      const evidence = await deepResearchApi.evidencePackage(session.id)
      const url = URL.createObjectURL(new Blob([JSON.stringify(evidence, null, 2)], { type: 'application/json' }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `evidence-${session.id}.json`
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) { toast.error(apiErrorMessage(error, 'Could not download the evidence package.')) }
    finally { setExporting(false) }
  }

  // A stopped or failed session cannot be continued, so a follow-up is a new session with the question filled in.
  const followUp = (p: Prefill) => { setPrefill(p); setParams({ projectId: p.projectId }, { replace: false }) }
  const newBlank = () => { setPrefill(null); setParams({}, { replace: true }) }

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="px-6 py-8">
        {sessionId && (
          <div className="max-w-6xl mx-auto mb-4">
            <button onClick={() => setParams({}, { replace: false })} className="inline-flex items-center gap-1 text-[12px] text-slate-500 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40 rounded">
              <ArrowLeft size={13} /> All research
            </button>
          </div>
        )}
        {!sessionId && (
          <p className="max-w-2xl mx-auto mb-5 text-[13px] text-slate-500">Searches the literature, checks every source, and gives you an evidence package you can review.</p>
        )}

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-slate-400" /></div>
        ) : !session ? (
          <StartForm key={prefill ? `${prefill.projectId}:${prefill.question}` : 'blank'} projects={projects} initialProjectId={params.get('projectId') ?? ''} prefill={prefill} sessions={mySessions}
            onStarted={onStarted} onOpen={openSession} onStop={id => void stopById(id)} onResume={id => void resumeById(id)} />
        ) : !session.isFinished ? (
          <RunningView session={session} onStop={() => void stop()} stopping={stopping} onResume={() => void resume()} />
        ) : session.status === 'Failed' && !session.result?.acceptedSources ? (
          <div className="max-w-2xl mx-auto space-y-4">
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">
              <p className="text-[14px] font-semibold">{statusBanner(session, 0, 0).title}</p>
              <p className="text-[13px] mt-0.5">{session.completionNote ?? 'It stopped before it found anything to keep.'} You were not charged for work that produced nothing.</p>
            </div>
            <button
              onClick={() => followUp({ projectId: session.projectId, question: session.researchQuestion, mode: session.mode as Prefill['mode'], geography: '', unanswered: [] })}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-accent hover:bg-purple-deep text-white text-[13px] font-semibold"
            >Start new research from this</button>
          </div>
        ) : (
          <DeepResearchResults
            session={session} rows={sources} busyId={busyId} addedIds={addedIds}
            onDecide={decide} onAdd={add}
            onUse={(g: SourceGroup) => setBindFor(sources.find(r => r.id === g.id) ?? null)}
            onExport={() => void exportPackage()} exporting={exporting}
            onFollowUp={followUp} onNew={newBlank}
          />
        )}
      </div>
      {bindFor && session && (
        <BindEvidenceModal open onClose={() => setBindFor(null)} projectId={session.projectId} sessionId={session.id}
          sourceId={bindFor.id} title={bindFor.title} />
      )}
    </div>
  )
}
