import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Download, RefreshCw, Search } from 'lucide-react'
import { deepResearchApi, type DeepResearchSessionSummary, type EvidenceSource, type VerifiedEvidencePackage } from '../../api/deepResearch'
import { apiErrorMessage } from '../../lib/deepResearch'
import { WebLibraryTabBar } from '../../components/webLibrary/WebLibraryTabBar'
import { researchApi } from '../../api/research'

const button = 'rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50'
const uniqueSources = (sources: EvidenceSource[]) => [...new Map(sources.map(source => [source.id, source])).values()]

function SourceList({ sources }: { sources: EvidenceSource[] }) {
  return <ul className="space-y-3">{uniqueSources(sources).map(source => <li key={source.id} className="rounded-lg border border-slate-200 p-3">
    <p className="font-medium">{source.title}</p>
    <p className="text-sm text-slate-500">{source.authors.join(', ')} · {source.year ?? 'Year unknown'}</p>
    <p className="text-sm">{source.polarity} · {source.strength} · {source.verification} · {source.geography}</p>
    {source.doi && <p className="break-all text-sm text-slate-500">DOI: {source.doi}</p>}
    {source.quote && <blockquote className="mt-2 border-l-2 border-purple-200 pl-3 text-sm">{source.quote}</blockquote>}
  </li>)}</ul>
}

function PackageDetails({ evidence }: { evidence: VerifiedEvidencePackage }) {
  const sources = new Map(evidence.acceptedEvidence.map(source => [source.id, source]))
  const question = (id: string) => evidence.evidenceQuestions.find(item => item.id === id)?.question ?? 'Evidence question'
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(evidence, null, 2)], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = `evidence-package-${evidence.sessionId}.json`; anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <article className="min-w-0 space-y-5 rounded-xl border border-slate-200 bg-white p-5">
    <header className="space-y-3">
      <h2 className="break-words text-xl font-semibold">{evidence.researchQuestion}</h2>
      <p className={`rounded-lg p-3 text-sm ${evidence.evidenceSufficient ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>
        {evidence.evidenceSufficient ? 'Evidence sufficiency criteria met' : 'Partial evidence — sufficiency not established'} · {evidence.completionReason}
      </p>
      <div className="flex flex-wrap gap-2">
        <button className={button} onClick={download}><Download size={14} className="mr-2 inline" />Download package</button>
        <Link className={button} to={`/app/research-agent/${evidence.projectId}/proposal-workflow?package=${evidence.sessionId}`}>Reuse in Proposal Studio</Link>
        <Link className={button} to={`/app/deep-research?session=${encodeURIComponent(evidence.sessionId)}`}>Open research session</Link>
      </div>
      <p className="text-sm text-slate-500">{uniqueSources(evidence.acceptedEvidence).length} verified accepted sources · {evidence.usage.searches} searches · {Math.round(evidence.usage.elapsedSeconds)} seconds · estimated LLM cost ${evidence.usage.estimatedLlmCostUsd.toFixed(4)}</p>
    </header>
    <section><h3 className="mb-2 font-semibold">Scope</h3>{evidence.scope ? <p className="text-sm">{[evidence.scope.topic, evidence.scope.relationship, evidence.scope.academicField, evidence.scope.population.join(', '), evidence.scope.geography.join(', '), evidence.scope.timePeriod].filter(Boolean).join(' · ')}</p> : <p className="text-sm text-slate-500">Scope was not established.</p>}</section>
    <section><h3 className="mb-2 font-semibold">Evidence questions</h3><ul className="space-y-2">{evidence.evidenceQuestions.map(item => <li key={item.id} className="text-sm"><p className="font-medium">{item.question}</p><p>{item.sufficiency} · {item.status}</p>{item.reasons.map((reason, index) => <p key={index} className="text-slate-500">{reason}</p>)}</li>)}</ul></section>
    <section><h3 className="mb-2 font-semibold">Key findings</h3>{!evidence.keyFindings.length && <p className="text-sm text-slate-500">No supported findings recorded.</p>}
      <ul className="space-y-4">{evidence.keyFindings.map((finding, index) => <li key={index} className="rounded-lg bg-slate-50 p-3 text-sm">
        <p className="font-medium">{finding.statement}</p><p className="text-slate-500">{finding.strength} · {finding.scope}</p>
        {(['supportingSourceIds', 'contradictingSourceIds'] as const).map(key => <div key={key} className="mt-2"><p className="font-medium">{key === 'supportingSourceIds' ? 'Supporting sources' : 'Contradicting sources'}</p><ul>{finding[key].map(id => <li key={id}>{sources.get(id)?.title ?? 'Source unavailable in this package'}</li>)}</ul>{!finding[key].length && <p className="text-slate-500">None recorded</p>}</div>)}
        {finding.caveats.map((caveat, i) => <p key={i} className="mt-2 text-amber-800">{caveat}</p>)}
      </li>)}</ul>
    </section>
    <details><summary className="cursor-pointer font-semibold">Accepted evidence ({uniqueSources(evidence.acceptedEvidence).length})</summary><div className="mt-3"><SourceList sources={evidence.acceptedEvidence} /></div></details>
    <details><summary className="cursor-pointer font-semibold">Contradictory and null evidence ({uniqueSources(evidence.contradictions).length})</summary><div className="mt-3"><SourceList sources={evidence.contradictions} /></div></details>
    <section><h3 className="mb-2 font-semibold">Potential research gaps</h3><p className="mb-2 text-sm text-slate-500">Candidates require validation. Empty or failed searches do not establish a research gap.</p>
      {!evidence.potentialResearchGaps.length && <p className="text-sm">No potential gaps established.</p>}
      {evidence.potentialResearchGaps.map((gap, index) => <div key={index} className="mb-3 text-sm"><p className="font-medium">{question(gap.questionId)}</p><p>{gap.type} · {gap.confidence}</p>{gap.reasons.map((reason, i) => <p key={i}>{reason}</p>)}</div>)}
    </section>
    <section><h3 className="mb-2 font-semibold">Insufficient evidence</h3>{!evidence.insufficientEvidence.length && <p className="text-sm text-slate-500">None recorded.</p>}{evidence.insufficientEvidence.map((gap, index) => <div key={index} className="mb-3 text-sm"><p className="font-medium">{gap.question}</p>{gap.reasons.map((reason, i) => <p key={i}>{reason}</p>)}</div>)}</section>
    <section><h3 className="mb-2 font-semibold">Limitations</h3><ul className="list-disc space-y-1 pl-5 text-sm">{evidence.limitations.map((limitation, index) => <li key={index}>{limitation}</li>)}</ul></section>
    <details><summary className="cursor-pointer font-semibold">Search and provider coverage</summary><div className="mt-3 space-y-3 text-sm">
      {evidence.providerCoverage.map((provider, index) => <p key={index}>{provider.provider}: {provider.searches} searches; {provider.withResults} with results; {provider.empty} empty; {provider.unavailable} unavailable; {provider.rateLimited} rate limited; {provider.unconfirmed} unconfirmed</p>)}
      {evidence.searchCoverage.map((search, index) => <div key={index} className="rounded-lg border p-3"><p className="break-words font-medium">{search.query}</p><p>{search.intent} · {search.newCandidates} new · {search.duplicates} duplicates</p>{search.providers.map((provider, i) => <p key={i}>{provider.provider}: {provider.outcome} ({provider.results} results){provider.detail ? ` — ${provider.detail}` : ''}</p>)}</div>)}
    </div></details>
    <details className="text-sm text-slate-500"><summary className="cursor-pointer">Package provenance</summary><p>Project: {evidence.projectId}</p><p>Schema: {evidence.schemaVersion}</p><p className="break-all">Content hash: {evidence.contentHash}</p><p>{evidence.usage.inputTokens + evidence.usage.outputTokens} LLM tokens · {evidence.usage.providerCalls} provider calls</p><p className="mt-2">This snapshot preserves the evidence at completion. Later source decisions appear in the research session.</p></details>
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
  const [refresh, setRefresh] = useState(0)
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([])
  const [projectError, setProjectError] = useState('')
  useEffect(() => {
    let current = true
    setProjectError('')
    researchApi.list().then(items => { if (current) setProjects(items) })
      .catch(() => { if (current) setProjectError('Project filters could not be loaded. You can still browse packages.') })
    return () => { current = false }
  }, [refresh])
  useEffect(() => {
    let current = true
    setLoading(true); setListError(''); setSessions([])
    deepResearchApi.list(projectId || undefined, 100).then(items => { if (current) setSessions(items) })
      .catch(error => { if (current) setListError(apiErrorMessage(error, 'Could not load evidence packages.')) })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [projectId, refresh])
  useEffect(() => {
    let current = true
    setEvidence(null); setDetailError(''); setDetailLoading(Boolean(sessionId))
    if (sessionId) deepResearchApi.evidencePackage(sessionId).then(item => { if (current) setEvidence(item) })
      .catch(error => { if (current) setDetailError(apiErrorMessage(error, 'Could not load this evidence package.')) })
      .finally(() => { if (current) setDetailLoading(false) })
    return () => { current = false }
  }, [sessionId, refresh])
  const finished = sessions.filter(item => item.isFinished)
  const filtered = finished.filter(item => item.researchQuestion.toLowerCase().includes(query.trim().toLowerCase()))
  return <div className="flex h-full min-h-0 flex-col bg-slate-50">
    <WebLibraryTabBar active="packages" />
    <main className="overflow-y-auto p-4 md:p-6">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-semibold">Evidence packages</h1><p className="mt-1 text-sm text-slate-500">Browse saved Deep Research evidence for your projects.</p></div><button className={button} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={14} className="mr-2 inline" />Refresh</button></header>
      <div className="grid items-start gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-3">
          <select aria-label="Filter packages by project" value={projectId} onChange={event => { const next = new URLSearchParams(params); next.delete('session'); if (event.target.value) next.set('projectId', event.target.value); else next.delete('projectId'); setParams(next) }} className="w-full rounded-lg border bg-white p-2 text-sm"><option value="">All projects</option>{projectId && !projects.some(project => project.id === projectId) && <option value={projectId}>Selected project</option>}{projects.map(project => <option key={project.id} value={project.id}>{project.title || 'Untitled project'}</option>)}</select>
          {projectError && <p role="status" className="text-xs text-amber-800">{projectError}</p>}
          <label className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2"><Search size={16} /><input aria-label="Search evidence packages" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search packages…" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
          {projectId && <button className={button} onClick={() => { const next = new URLSearchParams(params); next.delete('projectId'); setParams(next) }}>Show all projects</button>}
          {loading ? <p role="status" className="text-sm">Loading packages…</p> : listError ? <p role="alert" className="text-sm text-red-700">{listError} Use Refresh to try again.</p> : <>
            <p className="text-xs text-slate-500">{finished.length} finished sessions in the latest {sessions.length} research sessions{sessions.length === 100 ? ' (limited to 100; filter by project for older sessions)' : ''}.</p>
            {!filtered.length && <div className="rounded-xl border bg-white p-4 text-sm"><p>{finished.length ? 'No packages match your search.' : 'No finished research packages yet.'}</p><Link className="mt-2 inline-block text-purple-700" to={`/app/deep-research${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`}>Open Deep Research</Link></div>}
            {filtered.map(item => <button key={item.id} onClick={() => { const next = new URLSearchParams(params); next.set('session', item.id); setParams(next) }} aria-pressed={sessionId === item.id} className={`w-full rounded-xl border p-4 text-left ${sessionId === item.id ? 'border-purple-400 bg-purple-50' : 'border-slate-200 bg-white hover:border-purple-200'}`}><p className="break-words text-sm font-medium">{item.researchQuestion}</p><p className="mt-2 text-xs text-slate-500">{item.status} · {new Date(item.updatedAt).toLocaleDateString()}</p><p className="mt-1 text-xs text-slate-500">{item.message}</p></button>)}
          </>}
        </aside>
        {detailLoading ? <p role="status">Loading evidence package…</p> : detailError ? <div role="alert" className="rounded-xl border bg-white p-5 text-red-700">{detailError}<button className={`${button} ml-3`} onClick={() => setRefresh(value => value + 1)}>Retry</button></div> : evidence ? <PackageDetails evidence={evidence} /> : <div className="rounded-xl border border-dashed border-slate-300 p-8 text-sm text-slate-500">Select a package to inspect its evidence, findings, and coverage.</div>}
      </div>
    </main>
  </div>
}
