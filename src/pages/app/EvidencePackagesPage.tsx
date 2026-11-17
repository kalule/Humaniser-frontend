import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ChevronDown, Download, FileJson, Loader2, RotateCcw, Search, X } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  deepResearchApi, type DeepResearchMode, type DeepResearchSessionSummary, type EvidenceSource, type VerifiedEvidencePackage,
} from '../../api/deepResearch'
import { apiErrorMessage, authorLine } from '../../lib/deepResearch'
import { WebLibraryTabBar } from '../../components/webLibrary/WebLibraryTabBar'
import { StatusChip } from '../../components/webLibrary/StatusChip'
import { Select } from '../../components/ui/Select'
import { researchApi } from '../../api/research'
import { useAuthStore } from '../../store/authStore'
import { cn } from '../../lib/utils'
import { formatLibraryDate, formatLibraryDateTime, humaniseReason, label, labelText, nextStep } from '../../lib/researchLabels'
import { groupPackages, isInProgress, questionSummary, scopeDetails, type PackageGroup } from '../../lib/evidencePackagesView'

const LIST_POLL_MS = 5000
const secondary = 'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50'
const primary = 'inline-flex items-center gap-1.5 rounded-lg bg-purple-accent px-3.5 py-1.5 text-[13px] font-medium text-white hover:bg-purple-deep disabled:opacity-60'
const uniqueSources = (sources: EvidenceSource[]) => [...new Map(sources.map(source => [source.id, source])).values()]
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function SourceList({ sources }: { sources: EvidenceSource[] }) {
  return <ul className="space-y-2.5">{uniqueSources(sources).map(source => <li key={source.id} className="rounded-lg border border-slate-200 bg-white p-3">
    <p className="text-[13.5px] font-medium text-slate-900">{source.title}</p>
    <p className="mt-0.5 text-[12.5px] text-slate-600">{authorLine(source)}{source.journal ? ` · ${source.journal}` : ''}</p>
    <div className="mt-1.5 flex flex-wrap gap-1">
      <StatusChip kind="polarity" value={source.polarity} />
      <StatusChip kind="strength" value={source.strength} />
      <StatusChip kind="verification" value={source.verification} />
      <StatusChip kind="geography" value={source.geography} />
    </div>
    {source.doi && <p className="mt-1.5 break-all text-[12px] text-slate-600">DOI {source.doi}</p>}
    {source.quote && <blockquote className="mt-2 border-l-2 border-purple-200 pl-3 text-[13px] text-slate-700">{source.quote}</blockquote>}
  </li>)}</ul>
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h3 className="mb-2 text-[14px] font-semibold text-slate-900">{title}</h3>{children}</section>
}

/** Failed, off-topic, stopped or partial: say why, what to do next, and offer the one action that helps. */
function OutcomeBanner({ summary, evidence }: { summary: DeepResearchSessionSummary; evidence: VerifiedEvidencePackage | null }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [canRetryFree, setCanRetryFree] = useState<boolean | null>(null)
  const offTopic = summary.status === 'NeedsReview' || evidence?.completionReason === 'OffTopicResults'

  useEffect(() => {
    if (!offTopic) return
    let live = true
    deepResearchApi.followUpQuote(summary.id).then(q => { if (live) setCanRetryFree(!!q.canRetryFree) }).catch(() => { if (live) setCanRetryFree(false) })
    return () => { live = false }
  }, [offTopic, summary.id])

  const step = nextStep(summary.status, evidence?.completionReason)
  if (evidence?.evidenceSufficient && !offTopic) return null
  if (!step && !offTopic) return null

  const go = (id: string) => navigate(`/app/deep-research?session=${encodeURIComponent(id)}`)
  const retryFree = async () => {
    setBusy(true)
    try {
      // Same request the Deep Research page sends: same question and depth, marked as a retry, so no credits are held.
      const session = await deepResearchApi.get(summary.id)
      const next = await deepResearchApi.start({
        projectId: session.projectId, researchQuestion: session.researchQuestion, mode: session.mode as DeepResearchMode,
        depth: (session.depth as 'summary' | 'standard' | 'deep' | null | undefined) ?? undefined, retryOfSessionId: session.id,
      })
      go(next.id)
    } catch (err) { toast.error(apiErrorMessage(err, 'Could not retry the search.')) } finally { setBusy(false) }
  }
  const resume = async () => {
    setBusy(true)
    try { go((await deepResearchApi.resume(summary.id)).id) }
    catch (err) { toast.error(apiErrorMessage(err, 'Could not resume the research.')) } finally { setBusy(false) }
  }

  // Off-topic is decided at session level, so it wins over the stored completion reason
  // (a run can end "SearchesExhausted" and then be marked off-topic on review).
  const reason = offTopic ? label('completionReason', 'OffTopicResults')
    : evidence ? label('completionReason', evidence.completionReason) : label('sessionStatus', summary.status)
  const danger = offTopic || summary.status === 'Failed'
  return (
    <div role="status" className={cn('rounded-lg border p-3', danger ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50')}>
      <p className={cn('text-[13.5px] font-medium', danger ? 'text-red-800' : 'text-amber-900')}>
        {evidence && !evidence.evidenceSufficient && !danger ? 'Partial evidence. ' : ''}{reason.text}.
      </p>
      {step && <p className={cn('mt-0.5 text-[13px]', danger ? 'text-red-800' : 'text-amber-900')}>{step}</p>}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {offTopic && canRetryFree && <button type="button" className={primary} disabled={busy} onClick={() => void retryFree()}>{busy ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />} Retry for free</button>}
        {offTopic && canRetryFree === false && <span className="text-[12.5px] text-red-800">This run has already been retried once.</span>}
        {!offTopic && summary.canResume && <button type="button" className={primary} disabled={busy} onClick={() => void resume()}>{busy ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />} Resume</button>}
        <button type="button" className={offTopic || summary.canResume ? secondary : primary} onClick={() => go(summary.id)}>Continue in Deep Research <ArrowRight size={13} /></button>
      </div>
    </div>
  )
}

function PackageDetails({ evidence, summary, group, onSelectRun }: {
  evidence: VerifiedEvidencePackage
  /** Null when the package was opened by link and its session isn't in the loaded list. */
  summary: DeepResearchSessionSummary | null
  group: PackageGroup | null
  onSelectRun: (id: string) => void
}) {
  const isAdmin = useAuthStore(s => s.user?.role === 'Admin')
  const sources = new Map(evidence.acceptedEvidence.map(source => [source.id, source]))
  const sourceCount = uniqueSources(evidence.acceptedEvidence).length
  const question = (id: string) => evidence.evidenceQuestions.find(item => item.id === id)?.question ?? 'Evidence question'
  const qs = questionSummary(evidence.evidenceQuestions)
  const scope = scopeDetails(evidence)
  const [downloading, setDownloading] = useState(false)

  const downloadJson = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(evidence, null, 2)], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = `evidence-package-${evidence.sessionId}.json`; anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const downloadReport = async () => {
    setDownloading(true)
    try { await deepResearchApi.exportReportDocx(evidence.sessionId) }
    catch (err) { toast.error(apiErrorMessage(err, 'The Word report could not be made. Open the session in Deep Research to download it.')) }
    finally { setDownloading(false) }
  }

  return <article className="min-w-0">
    {/* Sticky: the question, its runs and the actions stay in view while the evidence scrolls. */}
    <header className="sticky top-0 z-10 space-y-3 border-b border-slate-200 bg-white/95 px-5 pb-4 pt-5 backdrop-blur">
      <h2 className="line-clamp-3 break-words text-[17px] font-semibold leading-snug text-slate-900">{evidence.researchQuestion}</h2>
      <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-slate-600">
        {summary && <StatusChip kind="sessionStatus" value={summary.status} />}
        <span>{plural(sourceCount, 'source')}</span><span aria-hidden>·</span>
        <span>{plural(evidence.usage.searches, 'search', 'searches')}</span>
        {summary && <><span aria-hidden>·</span><span>{formatLibraryDate(summary.createdAt)}</span></>}
        {summary && group && group.runs.length > 1 && (
          <Select aria-label="Run of this question" wrapperClassName="ml-auto w-auto" value={summary.id} onChange={e => onSelectRun(e.target.value)}>
            {[...group.runs].reverse().map(r => (
              <option key={r.session.id} value={r.session.id}>
                Run {r.runNumber} of {group.runs.length} · {formatLibraryDateTime(r.session.createdAt)} · {labelText('sessionStatus', r.session.status)}
              </option>
            ))}
          </Select>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link className={primary} to={`/app/research-agent/${evidence.projectId}/proposal-workflow?package=${evidence.sessionId}`}>Reuse in Proposal Studio <ArrowRight size={13} /></Link>
        <button type="button" className={secondary} disabled={downloading} onClick={() => void downloadReport()}>{downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Download report (Word)</button>
        <button type="button" className={secondary} onClick={downloadJson}><FileJson size={13} /> Download data (JSON)</button>
        <Link className={secondary} to={`/app/deep-research?session=${encodeURIComponent(evidence.sessionId)}`}>Open in Deep Research</Link>
      </div>
    </header>

    <div className="space-y-6 px-5 py-5">
      {summary && <OutcomeBanner summary={summary} evidence={evidence} />}

      {scope.length > 0 && (
        <Section title="Scope">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
            {scope.map(s => <div key={s.label} className="contents"><dt className="text-slate-600">{s.label}</dt><dd className="text-slate-900">{s.value}</dd></div>)}
          </dl>
        </Section>
      )}

      <Section title="Evidence questions">
        {qs.total > 0 && (
          <div className="mb-3">
            <p className="text-[13px] text-slate-700"><span className="font-semibold text-slate-900">{qs.answered} of {qs.total}</span> questions answered{qs.partly ? `, ${qs.partly} partly` : ''}</p>
            <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${qs.answered} of ${qs.total} answered, ${qs.partly} partly`}>
              <div className="bg-green-500" style={{ width: `${(qs.answered / qs.total) * 100}%` }} />
              <div className="bg-amber-400" style={{ width: `${(qs.partly / qs.total) * 100}%` }} />
            </div>
          </div>
        )}
        <ul className="space-y-2.5">{evidence.evidenceQuestions.map(item => <li key={item.id} className="rounded-lg border border-slate-200 bg-white p-3 text-[13px]">
          <div className="flex flex-wrap items-start gap-2">
            <p className="min-w-0 flex-1 font-medium text-slate-900">{item.question}</p>
            <StatusChip kind="sufficiency" value={item.sufficiency} />
          </div>
          {item.status === 'Exhausted' && item.sufficiency !== 'Sufficient' && <p className="mt-1 text-[12.5px] text-slate-600">{labelText('questionStatus', item.status)}.</p>}
          {item.reasons.length > 0 && <ul className="mt-1 space-y-0.5 text-[12.5px] text-slate-600">{item.reasons.map((reason, index) => <li key={index}>{humaniseReason(reason)}</li>)}</ul>}
        </li>)}</ul>
      </Section>

      <Section title="Key findings">{!evidence.keyFindings.length && <p className="text-[13px] text-slate-600">No supported findings recorded.</p>}
        <ul className="space-y-3">{evidence.keyFindings.map((finding, index) => <li key={index} className="rounded-lg bg-slate-50 p-3 text-[13px]">
          <p className="font-medium text-slate-900">{finding.statement}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5"><StatusChip kind="strength" value={finding.strength} />{finding.scope && <span className="text-[12.5px] text-slate-600">{finding.scope}</span>}</div>
          {(['supportingSourceIds', 'contradictingSourceIds'] as const).map(key => finding[key].length > 0 && <div key={key} className="mt-2"><p className="text-[12.5px] font-medium text-slate-700">{key === 'supportingSourceIds' ? 'Supporting sources' : 'Contradicting sources'}</p><ul className="list-disc pl-5 text-slate-700">{finding[key].map(id => <li key={id}>{sources.get(id)?.title ?? 'Source unavailable in this package'}</li>)}</ul></div>)}
          {finding.caveats.map((caveat, i) => <p key={i} className="mt-2 text-amber-800">{caveat}</p>)}
        </li>)}</ul>
      </Section>

      <details className="group/acc"><summary className="cursor-pointer text-[14px] font-semibold text-slate-900">Sources ({sourceCount})</summary><div className="mt-3"><SourceList sources={evidence.acceptedEvidence} /></div></details>
      <details><summary className="cursor-pointer text-[14px] font-semibold text-slate-900">Contradicting and no-effect sources ({uniqueSources(evidence.contradictions).length})</summary><div className="mt-3"><SourceList sources={evidence.contradictions} /></div></details>

      <Section title="Possible research gaps"><p className="mb-2 text-[12.5px] text-slate-600">These are candidates to check, not conclusions. Empty or failed searches don't show a gap.</p>
        {!evidence.potentialResearchGaps.length && <p className="text-[13px] text-slate-600">No possible gaps found.</p>}
        {evidence.potentialResearchGaps.map((gap, index) => <div key={index} className="mb-3 text-[13px]"><p className="font-medium text-slate-900">{question(gap.questionId)}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">{gap.type && <StatusChip kind="gapType" value={gap.type} />}{gap.confidence && <StatusChip kind="gapConfidence" value={gap.confidence} />}</div>
          {gap.reasons.map((reason, i) => <p key={i} className="mt-1 text-slate-700">{humaniseReason(reason)}</p>)}</div>)}
      </Section>

      {evidence.insufficientEvidence.length > 0 && <Section title="Questions still needing evidence">{evidence.insufficientEvidence.map((gap, index) => <div key={index} className="mb-3 text-[13px]"><p className="font-medium text-slate-900">{gap.question}</p>{gap.reasons.map((reason, i) => <p key={i} className="text-slate-600">{humaniseReason(reason)}</p>)}</div>)}</Section>}

      {evidence.limitations.length > 0 && <Section title="Limitations"><ul className="list-disc space-y-1 pl-5 text-[13px] text-slate-700">{evidence.limitations.map((limitation, index) => <li key={index}>{limitation}</li>)}</ul></Section>}

      <details className="text-[13px]"><summary className="cursor-pointer text-[14px] font-semibold text-slate-900">Search coverage</summary><div className="mt-3 space-y-3">
        {evidence.providerCoverage.map((provider, index) => <p key={index} className="text-slate-700"><span className="font-medium text-slate-900">{provider.provider}</span>: {plural(provider.searches, 'search', 'searches')}, {provider.withResults} with results, {provider.empty} empty{provider.unavailable ? `, ${provider.unavailable} unavailable` : ''}{provider.rateLimited ? `, ${provider.rateLimited} rate limited` : ''}</p>)}
        {evidence.searchCoverage.map((search, index) => <div key={index} className="rounded-lg border border-slate-200 p-3"><p className="break-words font-medium text-slate-900">{search.query}</p><p className="text-slate-600">{search.newCandidates} new · {search.duplicates} already found</p>
          <div className="mt-1 flex flex-wrap gap-1">{search.providers.map((provider, i) => <span key={i} className="inline-flex items-center gap-1 text-[12px] text-slate-700">{provider.provider} <StatusChip kind="providerOutcome" value={provider.outcome} /></span>)}</div></div>)}
      </div></details>

      <details className="text-[12.5px] text-slate-600"><summary className="cursor-pointer text-[13px] font-medium text-slate-700">Technical details</summary><div className="mt-2 space-y-0.5">
        <p>Took {Math.round(evidence.usage.elapsedSeconds)} seconds · {evidence.usage.providerCalls} provider calls · {(evidence.usage.inputTokens + evidence.usage.outputTokens).toLocaleString()} model tokens</p>
        {isAdmin && <p>Estimated model cost ${evidence.usage.estimatedLlmCostUsd.toFixed(4)} (admins only)</p>}
        <p>Schema {evidence.schemaVersion}</p><p className="break-all">Content hash {evidence.contentHash}</p>
        <p className="mt-1">This snapshot keeps the evidence as it was when the run finished. Later source decisions appear in the research session.</p>
      </div></details>
    </div>
  </article>
}

export default function EvidencePackagesPage() {
  const [params, setParams] = useSearchParams()
  const sessionId = params.get('session') ?? ''
  const projectId = params.get('projectId') ?? ''
  const [sessions, setSessions] = useState<DeepResearchSessionSummary[]>([])
  const [evidence, setEvidence] = useState<VerifiedEvidencePackage | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [listError, setListError] = useState('')
  const [detailError, setDetailError] = useState('')
  const [detailAttempt, setDetailAttempt] = useState(0)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([])
  const [projectError, setProjectError] = useState('')

  useEffect(() => {
    let current = true
    researchApi.list().then(items => { if (current) setProjects(items) })
      .catch(() => { if (current) setProjectError('Project names could not be loaded. You can still browse packages.') })
    return () => { current = false }
  }, [])

  // Loads the list; later loads are silent so a running session can update without the list flashing.
  const loadList = useCallback(async (silent: boolean) => {
    if (!silent) { setLoading(true); setListError('') }
    try {
      setSessions(await deepResearchApi.list(projectId || undefined, 100))
      setListError('')
    } catch (error) {
      if (!silent) setListError(apiErrorMessage(error, 'Could not load evidence packages.'))
    } finally { if (!silent) setLoading(false) }
  }, [projectId])

  useEffect(() => { void loadList(false) }, [loadList])

  // Auto-update while anything is still running; stops by itself once every run has finished.
  const anyRunning = sessions.some(isInProgress)
  useEffect(() => {
    if (!anyRunning) return
    const timer = setInterval(() => { if (document.visibilityState !== 'hidden') void loadList(true) }, LIST_POLL_MS)
    return () => clearInterval(timer)
  }, [anyRunning, loadList])

  const summary = sessions.find(s => s.id === sessionId) ?? null
  // Wait for the list: until it loads we can't tell a running session (no package yet) from a finished one.
  // A session missing from the list (opened by link, older than the latest 100) is fetched directly.
  const canLoadPackage = !!sessionId && !loading && (summary ? !isInProgress(summary) : true)
  useEffect(() => {
    let current = true
    setEvidence(null); setDetailError('')
    if (!canLoadPackage) { setDetailLoading(false); return }
    setDetailLoading(true)
    deepResearchApi.evidencePackage(sessionId).then(item => { if (current) setEvidence(item) })
      .catch(error => { if (current) setDetailError(apiErrorMessage(error, 'Could not load this evidence package.')) })
      .finally(() => { if (current) setDetailLoading(false) })
    return () => { current = false }
  }, [sessionId, canLoadPackage, detailAttempt])

  const groups = useMemo(() => groupPackages(sessions), [sessions])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? groups.filter(g => g.question.toLowerCase().includes(q)) : groups
  }, [groups, query])
  const selectedGroup = groups.find(g => g.runs.some(r => r.session.id === sessionId)) ?? null
  const projectName = (id: string) => projects.find(p => p.id === id)?.title || null

  const select = (id: string) => { const next = new URLSearchParams(params); next.set('session', id); setParams(next) }
  const closePackage = () => { const next = new URLSearchParams(params); next.delete('session'); setParams(next) }
  const setProject = (id: string) => { const next = new URLSearchParams(params); next.delete('session'); if (id) next.set('projectId', id); else next.delete('projectId'); setParams(next) }

  return <div className="flex h-full min-h-0 flex-col bg-white">
    <WebLibraryTabBar active="packages" />

    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
      <div className="relative min-w-[12rem] max-w-sm flex-1">
        <Search size={14} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input aria-label="Search evidence packages" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by question…"
          className="w-full rounded-lg border border-slate-200 py-1.5 pl-9 pr-8 text-[13px] text-slate-800 placeholder-slate-500 outline-none focus:border-purple-accent focus:ring-2 focus:ring-purple-accent/20" />
        {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-500 hover:text-slate-800"><X size={13} /></button>}
      </div>
      <Select aria-label="Filter packages by project" wrapperClassName="w-56" value={projectId} onChange={event => setProject(event.target.value)}>
        <option value="">All projects</option>
        {projectId && !projects.some(project => project.id === projectId) && <option value={projectId}>Selected project</option>}
        {projects.map(project => <option key={project.id} value={project.id}>{project.title || 'Untitled project'}</option>)}
      </Select>
      {anyRunning && <span className="inline-flex items-center gap-1.5 text-[12.5px] text-slate-600" role="status"><Loader2 size={13} className="animate-spin text-purple-accent" /> Updating while research runs…</span>}
      <div className="flex-1" />
      <Link to={`/app/deep-research${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`} className={primary}>New research</Link>
    </div>

    <div className="grid min-h-0 flex-1 lg:grid-cols-[340px_minmax(0,1fr)]">
      {/* List and detail scroll independently. Below lg there is room for one: the list, or the open package. */}
      <aside className={cn('min-h-0 overflow-y-auto border-slate-200 p-4 lg:block lg:border-r', sessionId && 'hidden')}>
        <p className="mb-3 text-[13px] text-slate-600">Saved Deep Research results: each package keeps the sources it found and its verdict on every question.</p>
        {projectError && <p role="status" className="mb-2 text-[12px] text-amber-800">{projectError}</p>}
        {loading ? <div className="space-y-2" aria-label="Loading packages">{[0, 1, 2].map(i => <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />)}</div>
          : listError ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-[13px] text-red-700">{listError} <button type="button" className="ml-1 font-medium underline" onClick={() => void loadList(false)}>Try again</button></div>
          : <>
            <p className="mb-2 text-[12px] text-slate-600">
              {plural(groups.length, 'package')} from {plural(sessions.length, 'session')}{sessions.length === 100 ? ' (latest 100; filter by project for older ones)' : ''}
            </p>
            {!filtered.length && <div className="rounded-xl border border-slate-200 p-4 text-[13px] text-slate-700"><p>{groups.length ? 'No packages match your search.' : 'No research packages yet. Run Deep Research on a question and its results are saved here.'}</p></div>}
            <ul className="space-y-2">{filtered.map(group => {
              const latest = group.latest.session
              const active = group.runs.some(r => r.session.id === sessionId)
              const isOpen = expanded === group.key
              return <li key={group.key} className={cn('rounded-xl border bg-white transition-colors', active ? 'border-purple-accent/50 bg-purple-tint/30' : 'border-slate-200 hover:border-purple-accent/30')}>
                <button type="button" onClick={() => select(latest.id)} aria-current={active && sessionId === latest.id ? 'true' : undefined} className="w-full p-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-accent/40 rounded-xl">
                  <p className="line-clamp-2 break-words text-[13.5px] font-medium leading-snug text-slate-900" title={group.question}>{group.question}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] text-slate-600">
                    <StatusChip kind="sessionStatus" value={latest.status} />
                    {!isInProgress(latest) && <span>{plural(latest.acceptedSources, 'source')}</span>}
                    <span aria-hidden>·</span><span>{formatLibraryDate(latest.createdAt)}</span>
                  </div>
                  {!projectId && projectName(group.projectId) && <p className="mt-1 truncate text-[12px] text-slate-600">{projectName(group.projectId)}</p>}
                </button>
                {group.runs.length > 1 && <>
                  <button type="button" onClick={() => setExpanded(isOpen ? null : group.key)} aria-expanded={isOpen}
                    className="flex w-full items-center gap-1 border-t border-slate-100 px-3.5 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50">
                    <ChevronDown size={13} className={cn('transition-transform', isOpen && 'rotate-180')} /> {group.runs.length} runs of this question
                  </button>
                  {isOpen && <ol className="border-t border-slate-100 px-2 py-1.5">{[...group.runs].reverse().map(r => <li key={r.session.id}>
                    <button type="button" onClick={() => select(r.session.id)} aria-current={sessionId === r.session.id ? 'true' : undefined}
                      className={cn('flex w-full flex-wrap items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-left text-[12px] text-slate-700 hover:bg-slate-50', sessionId === r.session.id && 'bg-purple-tint/50')}>
                      <span className="font-medium text-slate-900">Run {r.runNumber}</span><span>{formatLibraryDateTime(r.session.createdAt)}</span>
                      <StatusChip kind="sessionStatus" value={r.session.status} />
                      {!isInProgress(r.session) && <span>{plural(r.session.acceptedSources, 'source')}</span>}
                    </button></li>)}</ol>}
                </>}
              </li>
            })}</ul>
          </>}
      </aside>

      <main className={cn('min-h-0 overflow-y-auto bg-slate-50/40 lg:block', !sessionId && 'hidden')}>
        {sessionId && <button type="button" onClick={closePackage} className="flex items-center gap-1 px-5 pt-3 text-[13px] font-medium text-purple-accent hover:underline lg:hidden">
          <ArrowLeft size={14} /> Back to packages
        </button>}
        {!sessionId ? <div className="m-5 rounded-xl border border-dashed border-slate-300 p-8 text-[13px] text-slate-600">Select a package to see its findings, sources and coverage.</div>
          : summary && isInProgress(summary) ? <div className="m-5 space-y-3 rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-[17px] font-semibold text-slate-900">{summary.researchQuestion}</h2>
              <StatusChip kind="sessionStatus" value={summary.status} />
              <p className="text-[13px] text-slate-600">{summary.message || 'This research is still running.'} The package appears here when it finishes; this page updates by itself.</p>
              <Link className={secondary} to={`/app/deep-research?session=${encodeURIComponent(summary.id)}`}>Watch it in Deep Research <ArrowRight size={13} /></Link>
            </div>
          : detailLoading || loading ? <div className="flex justify-center p-12" role="status" aria-label="Loading evidence package"><Loader2 className="animate-spin text-purple-accent" /></div>
          : detailError ? <div className="m-5 space-y-3">
              {summary && <OutcomeBanner summary={summary} evidence={null} />}
              <div role="alert" className="rounded-xl border border-slate-200 bg-white p-5 text-[13px] text-red-700">{detailError}<button type="button" className={`${secondary} ml-3`} onClick={() => setDetailAttempt(n => n + 1)}>Try again</button></div>
            </div>
          : evidence ? <PackageDetails evidence={evidence} summary={summary} group={selectedGroup} onSelectRun={select} />
          : null}
      </main>
    </div>
  </div>
}
