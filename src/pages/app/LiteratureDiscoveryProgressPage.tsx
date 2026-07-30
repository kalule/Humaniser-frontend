import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, Check, ChevronDown, Loader2, Plus, RefreshCw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '../../lib/utils'
import { researchApi } from '../../api/research'
import { useResearchStore } from '../../store/researchStore'
import { CITATION_LABELS, CITATION_STYLES, LR_STEPS } from './LiteratureReviewPage'
import type { CitationStyle, DiscoveryConfig, DiscoveryStatus } from '../../types/research'

const DISCOVERY_STAGES = [
  { index: 1, label: 'Strategy ready' },
  { index: 2, label: 'Search databases' },
  { index: 3, label: 'Collapse duplicates' },
  { index: 4, label: 'Measure coverage and gaps' },
  { index: 5, label: 'Ready for screening' },
]

const EMPTY_PAPER_FORM = { title: '', doi: '', authors: '', journal: '', url: '' }

// client.ts's response interceptor normalizes structured API errors into a plain
// { code, message } object (not an axios error), so `err.message` covers both that and
// any raw Error thrown before the request even went out.
const extractErrorMessage = (err: unknown): string | undefined =>
  err instanceof Error ? err.message : (err as { message?: string } | undefined)?.message

export default function LiteratureDiscoveryProgressPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('projectId')

  const { projects, loadProject, updateProject, syncProject } = useResearchStore()
  const project = projects.find(p => p.id === projectId) ?? null

  const [config, setConfig] = useState<DiscoveryConfig | null>(null)
  const [status, setStatus] = useState<DiscoveryStatus | null>(null)
  const [citation, setCitation] = useState<CitationStyle>('apa7')
  const [citeMenuOpen, setCiteMenuOpen] = useState(false)
  const [paperForm, setPaperForm] = useState(EMPTY_PAPER_FORM)
  const [showImportForm, setShowImportForm] = useState(false)
  const [importing, setImporting] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [starting, setStarting] = useState(false)
  const hydratedRef = useRef(false)

  useEffect(() => {
    if (!projectId) return
    loadProject(projectId).catch(() => toast.error('Could not load this research project.'))
    researchApi.getDiscoveryConfig(projectId)
      .then(setConfig)
      .catch(() => toast.error('Could not load the discovery configuration.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  useEffect(() => {
    if (project && !hydratedRef.current) {
      hydratedRef.current = true
      setCitation(project.citationStyle)
    }
  }, [project])

  useEffect(() => {
    if (!projectId) return
    let mounted = true
    let interval: ReturnType<typeof setInterval> | null = null

    const poll = async () => {
      try {
        const s = await researchApi.getDiscoveryStatus(projectId)
        if (!mounted) return
        setStatus(s)
        if (s.status === 'Running') {
          if (!interval) interval = setInterval(poll, 2000)
        } else if (interval) {
          clearInterval(interval)
          interval = null
        }
      } catch { /* transient poll failure — try again next tick */ }
    }
    poll()

    return () => { mounted = false; if (interval) clearInterval(interval) }
  }, [projectId])

  const setCitationStyle = (style: CitationStyle) => {
    setCitation(style)
    setCiteMenuOpen(false)
    if (!project) return
    updateProject(project.id, { citationStyle: style })
    syncProject(project.id).catch(() => toast.error('Could not save your citation style.'))
  }

  const goToStep = (stepIndex: number) => {
    if (project) {
      updateProject(project.id, { currentStep: stepIndex })
      syncProject(project.id).catch(() => toast.error('Could not save your progress.'))
    }
    navigate(`/app/literature-review?projectId=${projectId}`)
  }

  const handleStart = async () => {
    if (!projectId) return
    setStarting(true)
    try {
      await researchApi.startDiscovery(projectId)
      const s = await researchApi.getDiscoveryStatus(projectId)
      setStatus(s)
    } catch (err) {
      const message = extractErrorMessage(err)
      toast.error(message ?? 'Could not start literature discovery.')
    } finally {
      setStarting(false)
    }
  }

  // "Pause" and "Stop and review" both request cooperative cancellation — there's no
  // resumable pause; the job finishes dedupe/relevance on whatever was gathered so far.
  const handleStop = async () => {
    if (!projectId) return
    try {
      await researchApi.stopDiscovery(projectId)
      toast.success('Stopping — finishing up with what has been gathered.')
    } catch {
      toast.error('Could not stop literature discovery.')
    }
  }

  const handleImportPaper = async () => {
    if (!projectId || !paperForm.title.trim()) return
    setImporting(true)
    try {
      const s = await researchApi.importManualPaper(projectId, {
        title:   paperForm.title.trim(),
        doi:     paperForm.doi.trim() || undefined,
        authors: paperForm.authors.trim() || undefined,
        journal: paperForm.journal.trim() || undefined,
        url:     paperForm.url.trim() || undefined,
      })
      setStatus(s)
      setPaperForm(EMPTY_PAPER_FORM)
      setShowImportForm(false)
      toast.success('Paper added to the corpus.')
    } catch (err) {
      const message = extractErrorMessage(err)
      toast.error(message ?? 'Could not import this paper.')
    } finally {
      setImporting(false)
    }
  }

  const handleRetryFailedSources = async () => {
    if (!projectId) return
    setRetrying(true)
    try {
      await researchApi.retryFailedSources(projectId)
      const s = await researchApi.getDiscoveryStatus(projectId)
      setStatus(s)
    } catch (err) {
      const message = extractErrorMessage(err)
      toast.error(message ?? 'Could not retry failed sources.')
    } finally {
      setRetrying(false)
    }
  }

  const databaseDisplayName = (id: string) => config?.databases.find(d => d.id === id)?.name ?? id
  const enabledQueries = config?.queries.filter(q => q.enabled) ?? []
  const gatheredCount = project?.selectedLibraryDocumentIds?.length ?? 0

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#F8F9FA' }}>
      {/* ── Header bar ─────────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-5 py-3 flex items-center gap-4">
        <button
          onClick={() => navigate(`/app/literature-review?projectId=${projectId}`)}
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
          aria-label="Back to Literature Review"
        >
          <ArrowLeft size={16} />
        </button>

        <div className="shrink-0 flex items-center gap-2">
          <h1 className="text-[15px] font-bold text-slate-800">Literature Review</h1>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            Generator
          </span>
        </div>

        <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
          {LR_STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => goToStep(i)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all whitespace-nowrap',
                i === 1 ? 'bg-[#1e293b] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100',
              )}
            >
              <span className={cn(
                'w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
                i === 1 ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500',
              )}>
                {i + 1}
              </span>
              {s.label}
            </button>
          ))}
        </div>

        <div className="shrink-0 flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[12px] text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Saved
          </span>

          <div className="relative">
            <button
              onClick={() => setCiteMenuOpen(v => !v)}
              className="flex items-center gap-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-600 hover:bg-slate-50 transition-colors"
            >
              {CITATION_LABELS[citation]} <ChevronDown size={11} />
            </button>
            {citeMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setCiteMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-xl shadow-xl z-20 py-1 overflow-hidden border border-slate-200">
                  {CITATION_STYLES.map(s => (
                    <button
                      key={s}
                      onClick={() => setCitationStyle(s)}
                      className={cn(
                        'w-full text-left px-3 py-1.5 text-[12px] transition-colors hover:bg-slate-50',
                        s === citation ? 'font-semibold text-slate-800' : 'text-slate-600',
                      )}
                    >
                      {CITATION_LABELS[s]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <span className="flex items-center gap-1 border border-slate-200 rounded-lg px-2 py-1.5 text-[12px] text-slate-500">
            {gatheredCount}
          </span>

          <span className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-slate-600">
            0 approved sources
          </span>
        </div>
      </div>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto py-8 px-4">
        <div className="max-w-3xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm p-8 space-y-8">
          {!config || !status ? (
            <div className="p-8 flex items-center justify-center gap-2 text-slate-400 text-[13px]">
              <Loader2 size={14} className="animate-spin" /> Loading discovery progress…
            </div>
          ) : (
            <>
              {/* Strategy header */}
              <div>
                <div className="flex items-start justify-between gap-4 mb-1 flex-wrap">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-orange-500 mb-1">Literature Discovery</p>
                    <h2 className="text-[16px] font-bold text-slate-800">Search strategy and canonical literature corpus</h2>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={config.strategy}
                      disabled
                      className="text-[12px] border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 outline-none disabled:bg-slate-50"
                    >
                      <option>{config.strategy}</option>
                    </select>
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      Candidate cap
                      <input
                        type="number"
                        value={config.candidateCap}
                        disabled
                        className="w-20 text-[12px] border border-slate-200 rounded-lg px-2 py-1.5 outline-none bg-slate-50"
                      />
                    </label>
                  </div>
                </div>
                <p className="text-[12px] text-slate-500">
                  Opening this tab prepares the strategy. Database searches begin only when you click Start Literature Discovery.
                </p>
              </div>

              {/* Progress bar + stage stepper + live activity + summary stats — one card, shown for any run that has started */}
              {status.status !== 'NotStarted' && (
                <div className="border border-slate-200 rounded-xl p-5">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p className="text-[13px] font-medium text-slate-700">
                      {status.status === 'Completed'
                        ? `Discovery complete: ${status.resultCount} found, ${status.duplicateCount} duplicates collapsed, ${status.uniqueCount} unique candidates.`
                        : status.statusMessage || (status.status === 'Running' ? 'Starting…' : status.status)}
                    </p>
                    <span className="text-[13px] font-semibold text-slate-500 shrink-0">{status.progressPct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden mb-5">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500', status.status === 'Error' ? 'bg-red-400' : 'bg-orange-500')}
                      style={{ width: `${status.progressPct}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {DISCOVERY_STAGES.map(stage => {
                      const done   = status.stageIndex > stage.index || status.status === 'Completed'
                      const active = !done && status.stageIndex === stage.index && status.status === 'Running'
                      return (
                        <span
                          key={stage.index}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium border',
                            done ? 'bg-orange-100 border-orange-200 text-orange-700'
                              : active ? 'bg-orange-50 border-orange-300 text-orange-700'
                              : 'border-slate-200 text-slate-400',
                          )}
                        >
                          {done ? <Check size={11} /> : active ? <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" /> : stage.index}
                          {stage.label}
                        </span>
                      )
                    })}
                  </div>
                  {status.status === 'Running' && status.liveActivityMessage && (
                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 mb-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Live activity</p>
                      <p className="flex items-center gap-1.5 text-[12px] text-slate-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse shrink-0" />
                        {status.liveActivityMessage}
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-5 gap-3 mb-4">
                    {[
                      { label: 'Discovered', value: status.resultCount },
                      { label: 'Duplicates', value: status.duplicateCount },
                      { label: 'Unique', value: status.uniqueCount },
                      { label: 'Likely relevant', value: status.likelyRelevantCount },
                      { label: 'Coverage', value: `${status.coveragePct}%` },
                    ].map(m => (
                      <div key={m.label}>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">{m.label}</p>
                        <p className="text-[18px] font-bold text-slate-800">{m.value}</p>
                      </div>
                    ))}
                  </div>
                  {status.status === 'Running' && (
                    <div className="flex items-center gap-2">
                      <button onClick={handleStop} className="px-3 py-1.5 rounded-lg border border-slate-200 text-[12px] text-slate-600 hover:bg-slate-50 transition-colors">
                        Pause
                      </button>
                      <button onClick={handleStop} className="px-3 py-1.5 rounded-lg border border-red-200 text-[12px] text-red-600 hover:bg-red-50 transition-colors">
                        Stop and review
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Search rounds and stopping evidence */}
              {status.status !== 'Running' && status.status !== 'NotStarted' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[15px] font-bold text-slate-800">Search rounds and stopping evidence</p>
                    <span className="text-[11px] text-slate-400">Auditable per query and database</span>
                  </div>
                  <div className="border border-slate-200 rounded-xl p-4">
                    <p className="text-[13px] font-semibold text-slate-700 mb-3">
                      Round 1 · {status.resultCount} found · {status.uniqueCount} new unique · {status.likelyRelevantCount} likely relevant · {status.coveragePct}% coverage
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Database totals</p>
                        <p className="text-[12px] text-slate-600">
                          {Object.entries(status.sourceCounts).map(([id, count]) => `${databaseDisplayName(id)}: ${count}`).join(' · ') || 'No results yet.'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Queries</p>
                        <div className="space-y-2">
                          {enabledQueries.map(q => (
                            <p key={q.id} className="text-[12px] text-slate-600">
                              <span className="font-semibold text-slate-700">{q.title}:</span> {q.queryText}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                    {status.stopReason && (
                      <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-[12px] font-medium text-amber-800">
                        Stopped because: {status.stopReason}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Manual paper import — compact by default, expands to the form on demand */}
              {status.status !== 'Running' && status.status !== 'NotStarted' && (
                <div className="border border-slate-200 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[14px] font-bold text-slate-800">Manual paper import</p>
                      <p className="text-[12px] text-slate-500">Add a known paper to this same canonical corpus. Screening rules still apply.</p>
                    </div>
                    {!showImportForm && (
                      <button
                        onClick={() => setShowImportForm(true)}
                        className="shrink-0 px-3 py-1.5 rounded-lg border border-slate-200 text-[12px] text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        Add paper
                      </button>
                    )}
                  </div>
                  {showImportForm && (
                    <div className="mt-3">
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <input
                          placeholder="Title *"
                          value={paperForm.title}
                          onChange={e => setPaperForm(f => ({ ...f, title: e.target.value }))}
                          className="col-span-2 text-[12px] border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-slate-400"
                        />
                        <input
                          placeholder="DOI"
                          value={paperForm.doi}
                          onChange={e => setPaperForm(f => ({ ...f, doi: e.target.value }))}
                          className="text-[12px] border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-slate-400"
                        />
                        <input
                          placeholder="Authors"
                          value={paperForm.authors}
                          onChange={e => setPaperForm(f => ({ ...f, authors: e.target.value }))}
                          className="text-[12px] border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-slate-400"
                        />
                        <input
                          placeholder="Journal"
                          value={paperForm.journal}
                          onChange={e => setPaperForm(f => ({ ...f, journal: e.target.value }))}
                          className="text-[12px] border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-slate-400"
                        />
                        <input
                          placeholder="URL"
                          value={paperForm.url}
                          onChange={e => setPaperForm(f => ({ ...f, url: e.target.value }))}
                          className="text-[12px] border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-slate-400"
                        />
                      </div>
                      <button
                        onClick={handleImportPaper}
                        disabled={importing || !paperForm.title.trim()}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-[12px] text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                      >
                        {importing ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Add paper
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Source issues */}
              {status.failedSources.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={14} className="text-amber-600" />
                    <p className="text-[13px] font-bold text-amber-800">Source issues</p>
                  </div>
                  <p className="text-[12px] text-amber-700 mb-2">
                    Discovery continued with the remaining sources. You can retry unavailable sources after this run.
                  </p>
                  <div className="space-y-1">
                    {status.failedSources.map(f => (
                      <p key={f.source} className="text-[12px] text-amber-700">
                        {f.displayName}: {f.message}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {status.status === 'NotStarted' && (
                <div className="flex items-center justify-end">
                  <button
                    onClick={handleStart}
                    disabled={starting}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-[12px] font-semibold disabled:opacity-60 transition-all"
                  >
                    {starting ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Start Literature Discovery
                  </button>
                </div>
              )}

              {status.status !== 'Running' && status.status !== 'NotStarted' && (
                <div className="flex items-center justify-end gap-2">
                  {status.failedSources.length > 0 && (
                    <button
                      onClick={handleRetryFailedSources}
                      disabled={retrying}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-[12px] text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                      {retrying ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Retry failed sources
                    </button>
                  )}
                  <button
                    onClick={() => goToStep(2)}
                    className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-[12px] font-semibold transition-colors"
                  >
                    Continue to Evidence Screening
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-white border-t border-slate-200 px-5 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate(`/app/literature-review?projectId=${projectId}`)}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[13px] text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
        >
          <ArrowLeft size={14} /> Back to strategy
        </button>
        <p className="flex-1 text-center text-[12px] text-slate-400 flex items-center justify-center gap-1.5">
          <Check size={12} className="text-emerald-400" /> All changes saved
        </p>
      </div>
    </div>
  )
}
