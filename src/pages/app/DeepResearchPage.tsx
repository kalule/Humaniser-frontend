import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Loader2, Square, ArrowLeft, History, Bell, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '../../lib/utils'
import { BindEvidenceModal } from '../../components/app/BindEvidenceModal'
import { DeepResearchPrompt, type ModeChoice } from '../../components/app/DeepResearchPrompt'
import { DEFAULT_DEPTH, guessIntent, suggestQuestions, type DepthId } from '../../lib/deepResearchIntake'
import { DeepResearchResults } from '../../components/app/DeepResearchResults'
import { statusBanner, type Prefill, type SourceGroup } from '../../lib/deepResearchView'
import { unwatchSession, watchSession } from '../../lib/deepResearchWatch'
import { researchApi } from '../../api/research'
import type { ResearchProject } from '../../types/research'
import {
  deepResearchApi,
  type DeepResearchMode, type DepthEstimate, type DeepResearchReport, type FollowUpQuote, type DeepResearchSession, type DeepResearchSessionSummary, type EvidenceSource,
} from '../../api/deepResearch'
import { RUN_STEPS, currentStep, elapsedLabel, stepState, timeLeftLabel } from '../../lib/deepResearchReport'
import { buildReportLocally, reportToWordHtml } from '../../lib/deepResearchLocalReport'
import {
  POLL_INTERVAL_MS,
  STALL_AFTER_MS, activeSessionFor, apiErrorMessage, reportFailureHint, timeAgo, isQuestionValid, progressPercent, shouldPoll,
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
  // Auto follows what the question looks like; a prefilled run keeps the mode it had.
  const [mode, setMode] = useState<ModeChoice>(prefill?.mode ?? 'Auto')
  const [depth, setDepth] = useState<DepthId>(DEFAULT_DEPTH)
  const [geography, setGeography] = useState(prefill?.geography ?? '')
  const [peerReviewed, setPeerReviewed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [settled, setSettled] = useState(question)
  // The student's own typical run times, once they have enough finished runs; until then the configured ones show.
  const [estimates, setEstimates] = useState<DepthEstimate[] | null>(null)
  useEffect(() => { deepResearchApi.estimates().then(setEstimates).catch(() => {}) }, [])

  useEffect(() => { if (!projectId && projects[0]) setProjectId(projects[0].id) }, [projects, projectId])
  // Look at the question once the student pauses typing, not on every keystroke.
  useEffect(() => { const t = setTimeout(() => setSettled(question), 400); return () => clearTimeout(t) }, [question])

  // `detected` is only set when the question clearly points to one kind of research; a run on Auto still needs a mode.
  const guess = guessIntent(settled)
  const detected = guess.label
  const resolvedMode: DeepResearchMode = mode === 'Auto' ? guess.mode : mode
  const project = projects.find(p => p.id === projectId)
  const suggestions = project ? suggestQuestions(project.title ?? '') : []

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
        projectId, researchQuestion: question.trim(), mode: resolvedMode, depth,
        geography: geography.trim() || undefined,
        requirePeerReviewed: peerReviewed || undefined,
      }))
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not start Deep Research. Please try again.'))
      setBusy(false)
    }
  }

  return (
    <div className="relative max-w-3xl mx-auto space-y-5 pt-4">
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 -top-16 -z-10 h-72 w-[46rem] max-w-full -translate-x-1/2 rounded-full bg-gradient-to-b from-purple-200/60 via-fuchsia-100/40 to-transparent blur-3xl" />
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
        detected={detected}
        depth={depth}
        onDepth={setDepth}
        estimates={estimates}
        suggestions={suggestions}
        onExample={(q, m) => { setQuestion(q); setMode(m) }}
        canStart={canStart}
        busy={busy}
        onStart={() => void start()}
        autoFocus={!!prefill}
        // TODO(add-pdfs): an "Add PDFs" control belongs in this row. There is no reusable upload component that feeds
        // Deep Research (it only searches providers today), so it needs a backend ingest path first and is not built here.
        options={(
          <div role="group" aria-label="Options" className="grid gap-4 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] items-start">
            <div className="min-w-0">
              <label htmlFor="dr-project" className="text-[12px] font-medium text-slate-700 mb-1.5 block">Project</label>
              {projects.length === 0 ? (
                <p className="text-[13px] text-slate-600">Deep Research saves what it finds against a project. <Link to="/app/proposal-studio" className="font-medium text-purple-700 underline underline-offset-2 hover:text-purple-800">Create one in Proposal Studio</Link> to get started.</p>
              ) : (
                <>
                  <select id="dr-project" value={projectId} onChange={e => setProjectId(e.target.value)} title={project?.title || undefined}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-[13px] text-slate-800 bg-white outline-none transition-colors hover:border-slate-300 focus:border-purple-accent focus-visible:ring-2 focus-visible:ring-purple-accent/30">
                    {projects.map(p => <option key={p.id} value={p.id}>{p.title || 'Untitled project'}</option>)}
                  </select>
                  {/* A select clips long titles, so the chosen title is also shown in full. */}
                  <p className="text-[12px] text-slate-500 mt-1.5 leading-snug">{project?.title || 'Untitled project'}</p>
                </>
              )}
            </div>
            <div className="min-w-0">
              <label htmlFor="dr-region" className="text-[12px] font-medium text-slate-700 mb-1.5 block">Study region <span className="font-normal text-slate-500">(optional)</span></label>
              <input id="dr-region" value={geography} onChange={e => setGeography(e.target.value)} placeholder="e.g. South Africa"
                title="Evidence from this region is weighted above evidence from elsewhere."
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-[13px] text-slate-800 outline-none transition-colors hover:border-slate-300 focus:border-purple-accent focus-visible:ring-2 focus-visible:ring-purple-accent/30" />
            </div>
            <label className="sm:col-span-2 flex items-center gap-2.5 text-[13px] text-slate-700 cursor-pointer select-none">
              <input type="checkbox" className="h-4 w-4 rounded border-slate-300 accent-[#7c3aed]" checked={peerReviewed} onChange={e => setPeerReviewed(e.target.checked)} />
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
    case 'Completed': return { label: 'Done', className: 'bg-emerald-50 text-emerald-700' }
    case 'Stopped':   return { label: 'Stopped at limit', className: 'bg-amber-50 text-amber-700' }
    case 'Cancelled': return { label: 'Stopped by you', className: 'bg-slate-100 text-slate-600' }
    case 'NeedsReview': return { label: 'Needs review: off-topic', className: 'bg-red-50 text-red-700' }
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
    <section className="pt-8 mt-4 border-t border-slate-100">
      <h3 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-slate-500 mb-3"><History size={14} /> Your research</h3>
      <ul className="space-y-2">
        {sessions.map(r => {
          const chip = statusChip(r)
          return (
            <li key={r.id} className="rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-slate-300 hover:shadow-sm">
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
  const step = currentStep(p, session.isFinished)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  const canNotify = typeof Notification !== 'undefined'
  const [notify, setNotify] = useState(() => canNotify && Notification.permission === 'granted')
  // The session is already watched from the moment it starts; this asks the browser for permission to show the alert.
  const askToNotify = async () => {
    try {
      const result = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
      setNotify(result === 'granted')
      if (result === 'granted') { watchSession(session.id); toast.success('We will tell you when it is done.') }
      else toast('Notifications are blocked in this browser. You will still find it under Your research.')
    } catch { toast.error('This browser cannot show notifications.') }
  }
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
        <ol aria-label="Progress" className="grid grid-cols-5 gap-1.5">
          {RUN_STEPS.map((label, i) => {
            const st = stepState(i, step)
            return (
              <li key={label} aria-current={st === 'active' ? 'step' : undefined} className="min-w-0">
                <span className={cn('block h-1.5 rounded-full', st === 'todo' ? 'bg-slate-200' : 'bg-purple-accent', st === 'active' && 'animate-pulse')} />
                <span className={cn('mt-1.5 flex items-center gap-1 text-[11px]', st === 'todo' ? 'text-slate-500' : 'font-semibold text-slate-800')}>
                  {st === 'done' && <Check size={11} className="text-emerald-600" aria-hidden="true" />}
                  {label}<span className="sr-only">{st === 'done' ? ' (done)' : st === 'active' ? ' (in progress)' : ''}</span>
                </span>
              </li>
            )
          })}
        </ol>
        <div className="sr-only" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>{pct}%</div>
        <p className="text-[12px] text-slate-600 tabular-nums">
          {elapsedLabel(session.createdAt, now)} elapsed · {timeLeftLabel(session.depth, session.createdAt, now)}
        </p>
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
      <div className="flex flex-wrap items-center justify-end gap-2">
        {canNotify && (
          <button onClick={() => void askToNotify()} disabled={notify} aria-pressed={notify}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-[12px] text-slate-700 hover:bg-slate-50 disabled:text-emerald-700 disabled:bg-emerald-50 disabled:border-emerald-200">
            {notify ? <Check size={12} /> : <Bell size={12} />} {notify ? 'We will notify you' : 'Notify me when done'}
          </button>
        )}
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
  const [report, setReport] = useState<DeepResearchReport | null>(null)
  const [reportFailed, setReportFailed] = useState(false)
  const [reportHint, setReportHint] = useState<string | undefined>()
  const [retryingReport, setRetryingReport] = useState(false)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [exportingReport, setExportingReport] = useState(false)
  const [followUpQuote, setFollowUpQuote] = useState<FollowUpQuote | null>(null)
  const [continuing, setContinuing] = useState(false)
  const [retrying, setRetrying] = useState(false)
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

  // The report is built on demand from the current evidence, so it is fetched again after the student changes a source.
  const loadReport = useCallback(async (id: string) => {
    try {
      const r = await deepResearchApi.report(id)
      if (alive.current) { setReport(r); setReportFailed(false); setReportHint(undefined) }
    } catch (err) { if (alive.current) { setReport(null); setReportFailed(true); setReportHint(reportFailureHint(err)) } }
  }, [])

  // What continuing would cost. The server decides whether the session can be continued, so every finished one asks.
  const loadQuote = useCallback(async (id: string) => {
    try { const q = await deepResearchApi.followUpQuote(id); if (alive.current) setFollowUpQuote(q) }
    catch { if (alive.current) setFollowUpQuote(null) }
  }, [])

  // Load, then poll only while the research is still running.
  useEffect(() => {
    if (!sessionId) { setSession(null); setSources([]); setReport(null); setReportFailed(false); setFollowUpQuote(null); setLoading(false); return }
    let timer: ReturnType<typeof setTimeout> | undefined
    let cancelled = false
    const tick = async () => {
      try {
        const s = await deepResearchApi.get(sessionId)
        if (cancelled) return
        setSession(s)
        setLoading(false)
        if (shouldPoll(s)) { watchSession(sessionId); timer = setTimeout(() => void tick(), POLL_INTERVAL_MS) }
        else {
          unwatchSession(sessionId); void loadSources(sessionId); void loadReport(sessionId)
          void loadQuote(sessionId)
        }
      } catch (err) {
        if (cancelled) return
        setLoading(false)
        toast.error(apiErrorMessage(err, 'Could not load this research session.'))
        setParams({}, { replace: true })
      }
    }
    void tick()
    return () => { cancelled = true; if (timer) clearTimeout(timer) }
  }, [sessionId, setParams, loadSources, loadReport, loadQuote])

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
      const [fresh] = await Promise.all([deepResearchApi.get(session.id), loadSources(session.id), loadReport(session.id)])
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

  // Saves several sources to the project's references with one message, and remembers each as added.
  const addMany = async (sourceIds: string[]) => {
    if (!session || sourceIds.length === 0) return
    let added = 0, already = 0, failed = 0
    const done = new Set<string>()
    for (const id of sourceIds) {
      try {
        const r = await deepResearchApi.addToProject(session.id, id)
        if (r.alreadyInProject) already++; else added++
        done.add(id)
      } catch { failed++ }
    }
    setAddedIds(prev => {
      const next = new Set([...prev, ...done])
      try { localStorage.setItem(`deepResearch.added.${session.id}`, JSON.stringify([...next])) } catch { /* only a convenience */ }
      return next
    })
    if (failed === 0) toast.success(added > 0 ? `Saved ${added} source${added === 1 ? '' : 's'} to your references${already ? ` (${already} already there)` : ''}.` : 'Already in your references.')
    else toast.error(`Saved ${added + already}, but ${failed} could not be added.`)
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

  const continueSession = async () => {
    if (!session || continuing) return
    setContinuing(true)
    try {
      onStarted(await deepResearchApi.start({
        projectId: session.projectId, researchQuestion: session.researchQuestion, mode: session.mode as DeepResearchMode,
        depth: (session.depth as DepthId | null | undefined) ?? undefined, continueFromSessionId: session.id,
      }))
    } catch (err) { toast.error(apiErrorMessage(err, 'Could not continue the research.')) }
    finally { setContinuing(false) }
  }

  // An off-topic run is retried at no cost: same question, a fresh search, scoped by the question itself.
  const retrySession = async () => {
    if (!session || retrying) return
    setRetrying(true)
    try {
      onStarted(await deepResearchApi.start({
        projectId: session.projectId, researchQuestion: session.researchQuestion, mode: session.mode as DeepResearchMode,
        depth: (session.depth as DepthId | null | undefined) ?? undefined, retryOfSessionId: session.id,
      }))
    } catch (err) { toast.error(apiErrorMessage(err, 'Could not retry the search.')) }
    finally { setRetrying(false) }
  }

  const exportReport = async () => {
    if (!session || exportingReport) return
    setExportingReport(true)
    try { await deepResearchApi.exportReportDocx(session.id) }
    catch (error) {
      // The server could not make the .docx. Never leave the student without their report: save a Word-readable file instead.
      const local = report ?? (sources.length > 0 ? buildReportLocally(session, sources) : null)
      if (local) {
        const url = URL.createObjectURL(new Blob(['\ufeff', reportToWordHtml(local)], { type: 'application/msword' }))
        const a = document.createElement('a')
        a.href = url
        a.download = `deep-research-report-${session.id}.doc`
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
        toast.success('Saved as a Word document (.doc). The server could not make the .docx.')
      } else toast.error(apiErrorMessage(error, 'Could not export the report.'))
    }
    finally { setExportingReport(false) }
  }

  const retryReport = async () => {
    if (!session) return
    setRetryingReport(true)
    try { await Promise.all([loadReport(session.id), loadQuote(session.id)]) }
    finally { if (alive.current) setRetryingReport(false) }
  }

  // Builds the report here, from the findings and sources this session already holds.
  const generateReport = () => {
    if (!session) return
    setGeneratingReport(true)
    try { setReport(buildReportLocally(session, sources)); setReportFailed(false); toast.success('Report built from this session\u2019s findings.') }
    finally { setGeneratingReport(false) }
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
            onDecide={decide} onAdd={add} onAddMany={addMany}
            onUse={(g: SourceGroup) => setBindFor(sources.find(r => r.id === g.id) ?? null)}
            onExport={() => void exportPackage()} exporting={exporting}
            onFollowUp={followUp} onNew={newBlank}
            report={report} reportFailed={reportFailed} onExportReport={() => void exportReport()} exportingReport={exportingReport}
            reportErrorHint={reportHint} onRetryReport={() => void retryReport()} retryingReport={retryingReport} onGenerateReport={generateReport} generatingReport={generatingReport}
            followUpQuote={followUpQuote} onContinue={() => void continueSession()} continuing={continuing}
            onRetry={() => void retrySession()} retrying={retrying}
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
