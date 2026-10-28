import { ProposalDesignReadinessPanel } from '../../components/research-design/ProposalDesignReadinessPanel'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import type { ProposalRepairPreview, ProposalDesignReadiness } from '../../types/proposalWorkflow'
import EvidencePackageReusePanel from "../../components/research-agent/EvidencePackageReusePanel"
import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { proposalJourneyApi } from '../../api/proposalJourney'
import { proposalStageLabel, proposalError, workspaceTab, proposalCommandKey, forgetProposalCommand } from '../../lib/proposalJourney'
import type { WritingExperience } from '../../types/proposalJourney'
import { ResearchDesignWorkspace } from './ResearchDesignPage'
import { GenerationPanel } from '../../components/app/AutonomousProposalTools'
import toast from 'react-hot-toast'
import { proposalWorkflowApi as api } from '../../api/proposalWorkflow'
import { researchApi } from '../../api/research'
import ResearchSpecificationEditor, { ResearchField, ResearchLinks } from '../../components/research-agent/ResearchSpecificationEditor'
import type { GapDossier, WorkflowHistory, WorkflowSource, WorkflowState } from '../../types/proposalWorkflow'
import type { LiteratureSearchQuery } from '../../types/research'

const button = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40'
const select = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm'
const emptyGap: GapDossier = { gap: '', type: '', scope: '', evidenceIds: [], counterEvidenceIds: [], searchQueryIds: [], coverageLimitations: '', counterEvidenceAssessment: '' }
const errorText = proposalError
export default function ProposalWorkflowPage() {
  const { projectId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const userId = useAuthStore(v => v.user?.id ?? '')
  const client = useQueryClient()
  const journeyKey = ['proposal-journey', userId, projectId]
  const journey = useQuery({ queryKey: journeyKey, queryFn: ({ signal }) => proposalJourneyApi.current(projectId, signal), enabled: !!userId && !!projectId, retry: false, staleTime: 0, refetchOnWindowFocus: true, refetchInterval: q => ['Starting', 'Generating'].includes(q.state.data?.generation?.status ?? '') ? 8000 : false })
  const [writingChoice, setWritingChoice] = useState<WritingExperience | null>(null)
  const [articleView, setArticleView] = useState(false)
  const [progressDismissed, setProgressDismissed] = useState(false)
  const [state, setState] = useState<WorkflowState | null>(null)
  const [history, setHistory] = useState<WorkflowHistory | null>(null)
  const [sources, setSources] = useState<WorkflowSource[]>([])
  const [queries, setQueries] = useState<LiteratureSearchQuery[]>([])
  const requestedTab = params.get('tab')
  const tab = requestedTab && ['design', 'evidence', 'sections', 'review', 'history', 'gap'].includes(requestedTab) ? requestedTab : journey.data ? workspaceTab(journey.data.summary.nextAction) : 'design'
  const [regenerateCode, setRegenerateCode] = useState<string | null>(null)
  const [preview, setPreview] = useState<ProposalRepairPreview | null>(null)
  const [readiness, setReadiness] = useState<ProposalDesignReadiness | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sourceId, setSourceId] = useState('')
  const [sourceText, setSourceText] = useState<{ abstract: string; fullTextContent: string | null } | null>(null)
  const [coverage, setCoverage] = useState('FullText')
  const [sectionCode, setSectionCode] = useState('1.0')
  const [claim, setClaim] = useState('')
  const [purpose, setPurpose] = useState('Support')
  const [passage, setPassage] = useState({ start: 0, quote: '' })
  const [gap, setGap] = useState<GapDossier>(emptyGap)
  const [selectedSection, setSelectedSection] = useState('')
  const [editedContent, setEditedContent] = useState('')
  const [editedEvidence, setEditedEvidence] = useState<string[]>([])
  const [editedVersion, setEditedVersion] = useState<string | null>(null)
  const operationLock = useRef(false)
  const alive = useRef(true)
  const currentProject = useRef(projectId)
  currentProject.current = projectId
  const attempts = useRef(new Map<string, string>())
  const refresh = async () => {
    const [next, trail] = await Promise.all([api.state(projectId), api.history(projectId)])
    if (alive.current && currentProject.current === projectId) { setState(next); setHistory(trail) }
  }
  useEffect(() => {
    let cancelled = false
    alive.current = true
    setSources([]); setQueries([]); setBusy(false); setSelectedSection(''); setEditedContent(''); setEditedEvidence([]); setEditedVersion(null)
    setState(null); setHistory(null); setError(''); setSourceId(''); setSourceText(null); attempts.current.clear()
    setPreview(null); setRegenerateCode(null); setReadiness(null); setWritingChoice(null); setProgressDismissed(false)
    void refresh().catch(e => { if (!cancelled && alive.current) setError(errorText(e)) })
    return () => { cancelled = true; alive.current = false }
  }, [projectId])
  useEffect(() => {
    if (!['evidence', 'gap'].includes(tab)) return
    let cancelled = false
    void api.sources(projectId).then(value => { if (!cancelled) setSources(value) }).catch(e => { if (!cancelled) setError(errorText(e)) })
    if (tab === 'gap') void researchApi.listDiscoveryQueries(projectId).then(value => { if (!cancelled) setQueries(value) }).catch(() => {})
    return () => { cancelled = true }
  }, [projectId, tab])
  useEffect(() => {
    let cancelled = false
    setSourceText(null); setPassage({ start: 0, quote: '' })
    if (sourceId) void api.source(projectId, sourceId).then(value => { if (!cancelled) setSourceText(value) }).catch(e => { if (!cancelled) setError(errorText(e)) })
    return () => { cancelled = true }
  }, [projectId, sourceId])
  const run = async (action: () => Promise<unknown>) => {
    if (operationLock.current) return
    operationLock.current = true; setBusy(true); setError('')
    try { await action(); await refresh() }
    catch (e) { if (alive.current && currentProject.current === projectId) setError(errorText(e)) }
    finally { operationLock.current = false; if (alive.current && currentProject.current === projectId) setBusy(false) }
  }
  useEffect(() => { setReadiness(journey.error ? null : journey.data?.readiness ?? null) }, [journey.data, journey.error])
  const openTab = (value: string) => { setParams({ tab: value }, { replace: false }) }
  const chooseWriting = async (mode: WritingExperience) => {
    const summary = journey.data?.summary
    if (!summary) return
    if (!summary.designRequired && summary.allowedActions.includes('RetryLegacyDraft') && mode === 'FirstDraft') {
      const saved = await researchApi.get(projectId)
      const target = Number.parseInt(saved.sectionContent?.targetSectionWordCount ?? '', 10)
      await researchApi.generateAutonomous(projectId, Number.isFinite(target) && target > 0 ? target : 500); setWritingChoice(null); setProgressDismissed(false); await journey.refetch(); return
    }
    if (!summary.acceptedRevisionId || !summary.allowedActions.includes('ChooseWritingMode')) return
    const slot = `writing:${userId}:${projectId}:${summary.acceptedRevisionId}:${mode}`
    const stored = await proposalCommandKey(slot)
    const key = attempts.current.get(slot) ?? stored.key; attempts.current.set(slot, key)
    const result = await proposalJourneyApi.writing(projectId, mode, summary.acceptedRevisionId, key)
    if (!alive.current || currentProject.current !== projectId) return
    setProgressDismissed(false); client.setQueryData(journeyKey, result); attempts.current.delete(slot); forgetProposalCommand(stored.storageKey); setWritingChoice(null); setSelectedSection(state?.contracts[0]?.code ?? '1.0'); openTab('sections')
    await refresh()
  }
  const generate = async (code: string, confirmed = false) => {
    const section = history?.sections.find(s => s.sectionCode === code)
    if (section?.content && !confirmed) { setRegenerateCode(code); return }
    const attemptSlot = `${state?.accepted?.id}|${code}|${section?.contentVersion ?? 'new'}`
    const idempotencyKey = attempts.current.get(attemptSlot) ?? crypto.randomUUID()
    attempts.current.set(attemptSlot, idempotencyKey)
    try { await api.generate(projectId, code, section?.contentVersion ?? null, idempotencyKey, state?.accepted?.id, confirmed) }
    catch (e) {
      // Preserve ambiguous requests for an idempotent retry; explicit failed attempts may restart.
      if (errorText(e).includes('previously failed')) attempts.current.delete(attemptSlot)
      throw e
    }
    attempts.current.delete(attemptSlot)
    toast.success('Draft generated. Review it before acceptance.')
  }
  if (!state) return <main className="research-design mx-auto max-w-6xl p-8"><Link className="text-violet-700" to={`/app/research-agent/${projectId}/dashboard`}>Back to research</Link><p role={error ? 'alert' : 'status'} className="mt-6 text-slate-600">{error || 'Loading research workflow…'}</p>{error && <button className={button} onClick={() => void refresh().catch(e => setError(errorText(e)))}>Retry</button>}</main>
  const currentText = coverage === 'FullText' ? sourceText?.fullTextContent ?? '' : sourceText?.abstract ?? ''
  const ready = state.accepted !== null && !state.findings.some(f => f.severity === 'Blocker' && !['Pass', 'NotApplicable'].includes(f.status))
  return <main className="research-design mx-auto max-w-6xl space-y-6 px-6 py-8">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><Link className="text-sm text-violet-700" to="/app/proposal-studio">Back to proposals</Link><h1 className="mt-3 text-2xl font-semibold text-slate-900">{state.accepted?.specification.title || state.importedDraft.title || "Your proposal"}</h1><p className="mt-1 text-sm text-slate-600">{proposalStageLabel(journey.data?.summary.stage)}</p></div><Button disabled={busy} variant="secondary" onClick={() => void run(async () => { await refresh(); await journey.refetch() })}>Refresh proposal</Button></header>
    {error && <div role="alert" className="whitespace-pre-wrap rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
    {journey.error && <div role="alert" className="text-sm"><p>We could not check the next step for your proposal.</p><Button variant="ghost" onClick={() => void journey.refetch()}>Try again</Button></div>}
    {state.accepted && readiness && (readiness.findings.length > 0 || readiness.sections.some(x => x.affected)) && <ProposalDesignReadinessPanel projectId={projectId} providedView={readiness} onChanged={() => { void refresh(); void journey.refetch() }} />}
    {journey.data && !journey.data.summary.designRequired && readiness?.mode !== 'CanonicalResearchDesign' && <p className="text-sm text-slate-600">This existing proposal uses the earlier setup. <Link className="underline text-violet-700" to={`/app/research-agent/${projectId}${journey.data.summary.hasContent ? '?section=1.0' : ''}`}>Open your saved proposal</Link>. You can keep reading and editing it without accepting a new design.</p>}

    <nav aria-label="Proposal workflow" className="flex flex-wrap gap-2">{[['design', 'Design study'], ['evidence', 'Sources'], ['sections', 'Proposal'], ['review', 'Review']].map(([key, label]) => <button key={key} className={`${button} ${tab === key ? '!border-violet-500 !bg-violet-50 !text-violet-800' : ''}`} aria-current={tab === key ? "step" : undefined} onClick={() => openTab(key)}>{label}</button>)}</nav>
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      {tab === 'design' && journey.data?.summary.designRequired && <ResearchDesignWorkspace key={`${userId}:${projectId}`} projectId={projectId} embedded onAccepted={() => { void refresh(); void journey.refetch(); openTab('sections') }} />}
      {tab === 'design' && journey.data && !journey.data.summary.designRequired && <div className="space-y-4"><p className="text-sm">Your saved setup and methodology remain available in the existing proposal editor.</p><Link className="text-violet-700 underline" to={`/app/research-agent/${projectId}`}>Open existing setup</Link><details><summary>Review or reconcile the existing research specification</summary><ResearchSpecificationEditor key={`${projectId}|${state.accepted?.id ?? 'import'}`} initial={{ ...(state.accepted?.specification ?? state.importedDraft), methodologyVersion: state.importedDraft.methodologyVersion }} pending={busy} onAccept={async spec => { await run(async () => { await api.accept(projectId, state.accepted?.id ?? null, spec); void journey.refetch() }) }} /></details></div>}
      {tab === 'evidence' && <div className="space-y-4"><h2 className="text-lg font-semibold">Supporting research</h2><p className="text-sm text-slate-600">Design evidence is checked as needed. Writing also checks the exact sources behind each claim.</p><EvidencePackageReusePanel studentMode onReview={() => openTab('review')} key={projectId} projectId={projectId} specificationId={state.accepted?.id ?? null} onChanged={async () => { await refresh(); setSources(await api.sources(projectId)); void journey.refetch() }} /><details><summary className="cursor-pointer text-sm">Review a claim and its source</summary><div className="mt-4 space-y-4"><p className="text-sm text-slate-600">Select a passage from an included source and state the precise claim it supports or challenges. Support is reviewed for this pair; the same source can support one claim and fail another.</p>
        <div className="grid gap-3 md:grid-cols-3"><label className="grid gap-1 text-sm">Section<select className={select} value={sectionCode} onChange={e => setSectionCode(e.target.value)}>{state.contracts.map(c => <option key={c.code} value={c.code}>{c.code} {c.title}</option>)}</select></label><label className="grid gap-1 text-sm">Source<select className={select} value={sourceId} onChange={e => setSourceId(e.target.value)}><option value="">Select a source</option>{sources.map(s => <option key={s.id} value={s.id} disabled={s.isRetracted}>{s.title}{s.isRetracted ? ' (retracted)' : ''}</option>)}</select></label><label className="grid gap-1 text-sm">Evidence coverage<select className={select} value={coverage} onChange={e => { setCoverage(e.target.value); setPassage({ start: 0, quote: '' }) }}><option value="FullText">Full text</option><option value="Abstract">Abstract only</option></select></label></div>
        <ResearchField label="Exact claim" value={claim} multiline onChange={setClaim} /><label className="grid gap-1 text-sm">Purpose<select className={select} value={purpose} onChange={e => setPurpose(e.target.value)}><option>Support</option><option>CounterEvidence</option></select></label>
        <label className="grid gap-1 text-sm text-slate-600">Source text — highlight the relevant passage<textarea className="min-h-60 rounded-lg border border-slate-300 p-3 text-sm" readOnly value={currentText} onSelect={e => { const el = e.currentTarget; if (el.selectionEnd > el.selectionStart) setPassage({ start: el.selectionStart, quote: el.value.slice(el.selectionStart, el.selectionEnd) }) }} /></label>
        {!currentText && <p className="text-sm text-amber-700">This source has no text for the selected coverage. Upload full text in the research library or use an available abstract.</p>}
        {passage.quote && <blockquote className="whitespace-pre-wrap border-l-4 border-violet-300 bg-violet-50 p-3 text-sm text-slate-700">{passage.quote}</blockquote>}
        <button className={button} disabled={busy || !state.accepted || !sourceId || !claim.trim() || !passage.quote} onClick={() => void run(() => api.evidence(projectId, { sectionCode, claim, literatureId: sourceId, coverage, start: passage.start, length: passage.quote.length, quote: passage.quote, purpose }))}>Review Claim Against Passage</button>
        <div className="space-y-3 pt-4">{state.evidence.map(e => <article key={e.id} className="rounded-xl border p-4"><p className="text-sm font-semibold">{e.sectionCode} · {e.status} · {e.purpose}</p><p className="mt-1 text-sm">{e.claim}</p><p className="mt-2 text-xs text-slate-500">{e.message}</p></article>)}</div>
        </div></details><details><summary className="text-sm cursor-pointer">Research gap and search coverage</summary><Button variant="ghost" onClick={() => openTab('gap')}>Review the research gap</Button></details>
      </div>}
      {tab === 'gap' && <div className="space-y-4"><h2 className="text-lg font-semibold">Scoped research gap dossier</h2><p className="text-sm text-slate-600">Complete literature discovery in the research workspace first. Record supporting studies, counterevidence and the limits of the search. A missing search result alone does not establish novelty.</p>{(['gap', 'type', 'scope', 'coverageLimitations', 'counterEvidenceAssessment'] as const).map(key => <ResearchField key={key} label={key.replace(/([A-Z])/g, ' $1')} value={gap[key]} multiline onChange={value => setGap(g => ({ ...g, [key]: value }))} />)}
        <div className="grid gap-3 md:grid-cols-2"><ResearchLinks label="Supporting evidence" options={state.evidence.filter(e => e.status === 'Pass' && e.purpose === 'Support').map(e => ({ id: e.id, text: e.claim }))} selected={gap.evidenceIds} onChange={evidenceIds => setGap(g => ({ ...g, evidenceIds }))} /><ResearchLinks label="Counterevidence" options={state.evidence.filter(e => e.status === 'Pass' && e.purpose === 'CounterEvidence').map(e => ({ id: e.id, text: e.claim }))} selected={gap.counterEvidenceIds} onChange={counterEvidenceIds => setGap(g => ({ ...g, counterEvidenceIds }))} /></div>
        <ResearchLinks label="Completed search queries" options={queries.filter(q => q.enabled).map(q => ({ id: q.id, text: q.queryText }))} selected={gap.searchQueryIds} onChange={searchQueryIds => setGap(g => ({ ...g, searchQueryIds }))} />
        <button className={button} disabled={busy || !state.accepted} onClick={() => void run(() => api.gap(projectId, gap))}>Assess Research Gap</button>
        {state.gaps.map(g => <article key={g.id} className="rounded-xl border p-4 text-sm"><p className="font-semibold">{g.status} · {g.dossier.gap}</p><p className="mt-2 text-slate-600">{g.message}</p></article>)}
      </div>}
      {tab === 'sections' && <div className="space-y-4"><h2 className="text-lg font-semibold">Create your proposal</h2>
        {!state.accepted && <p className="text-sm">Accept your research design before starting a new proposal draft.</p>}
        {state.accepted && journey.data?.summary.allowedActions.includes('ChooseWritingMode') && !journey.data.summary.writingMode && <div className="space-y-4"><p>How would you like to write?</p><div className="flex flex-wrap gap-3"><Button disabled={busy} onClick={() => void run(() => chooseWriting('Guided'))}>Write with guidance</Button><Button variant="secondary" disabled={busy} onClick={() => setWritingChoice('FirstDraft')}>Create first draft</Button></div><p className="text-sm text-slate-600">Both use your accepted design and the same source checks. Work section by section, or review a complete first draft.</p></div>}
        {journey.data?.summary.writingMode && journey.data.summary.allowedActions.includes('ChooseWritingMode') && <details><summary className="cursor-pointer text-sm">Writing options</summary><div className="mt-3 flex flex-wrap gap-3"><Button variant="secondary" disabled={busy} onClick={() => void run(() => chooseWriting('Guided'))}>Write with guidance</Button><Button variant="secondary" disabled={busy} onClick={() => setWritingChoice('FirstDraft')}>Create first draft</Button></div></details>}
        {progressDismissed && journey.data?.generation && ['Starting', 'Generating', 'NeedsReview', 'Error', 'Cancelled'].includes(journey.data.generation.status) && <Button variant="ghost" onClick={() => setProgressDismissed(false)}>View drafting progress</Button>}
        {!progressDismissed && journey.data?.generation && ['Starting', 'Generating', 'NeedsReview', 'Error', 'Cancelled'].includes(journey.data.generation.status) && journey.data.summary.writingMode === 'FirstDraft' && <GenerationPanel gen={{ projectId, title: state.accepted?.specification.title || state.importedDraft.title, phase: journey.data.generation.status, index: journey.data.generation.completedCount, totalCount: journey.data.generation.totalCount, words: journey.data.generation.wordsWritten, failedCount: journey.data.generation.failedCount, currentSection: journey.data.generation.currentSection, currentLabel: journey.data.generation.currentSection ?? '', articleView, stalled: false }} onToggleArticleView={() => setArticleView(v => !v)} onCancel={() => void run(async () => { await researchApi.cancelGeneration(projectId); await journey.refetch() })} onClose={() => setProgressDismissed(true)} onOpenDocument={() => { setProgressDismissed(true); setSelectedSection(state.contracts[0]?.code ?? '1.0') }} onResume={() => setWritingChoice('FirstDraft')} resuming={busy} />}
        {state.contracts.length > 0 && <label className="grid gap-2 text-sm" htmlFor="proposal-section">Proposal section<select id="proposal-section" className={select} value={selectedSection || state.contracts[0].code} onChange={e => { setSelectedSection(e.target.value); setEditedContent(''); setEditedEvidence([]); setEditedVersion(null) }}>{state.contracts.map(c => <option key={c.code} value={c.code}>{c.code} {c.title}</option>)}</select></label>}<p className="text-sm text-slate-600">Word targets and prerequisites come from the accepted research design. Review each draft before accepting it. Generation pauses when evidence or prerequisites are missing.</p>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-3">Section</th><th className="p-3">Prose words</th><th className="p-3">Prerequisites</th><th className="p-3">Actions</th></tr></thead><tbody>{state.contracts.filter(c => c.code === (selectedSection || state.contracts[0]?.code)).map(c => <tr key={c.code} className="border-b"><td className="p-3">{c.code} {c.title}</td><td className="p-3">{c.minWords}–{c.maxWords}</td><td className="p-3">{c.dependencies.join(', ') || 'None'}</td><td className="flex flex-wrap gap-2 p-3"><button className={button} disabled={busy || !readiness?.allowedActions.includes('Generate') || (!!journey.data?.summary.designRequired && !journey.data.summary.writingMode)} onClick={() => void run(() => generate(c.code))}>Generate</button><button className={button} onClick={() => { setSelectedSection(c.code); setEditedContent('' ); setEditedEvidence([]); setEditedVersion(null) }}>Read</button><button className={button} disabled={busy || !history?.sections.some(s => s.sectionCode === c.code && s.content)} onClick={() => void run(() => api.acceptSection(projectId, c.code))}>Accept</button></td></tr>)}</tbody></table></div>
        {selectedSection && <article className="space-y-4 rounded-xl bg-slate-50 p-5"><h3 className="font-semibold">Section {selectedSection}</h3><p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{history?.sections.find(s => s.sectionCode === selectedSection)?.content || 'No draft yet.'}</p><button className={button} onClick={() => { const original = history?.sections.find(s => s.sectionCode === selectedSection); const content = original?.content ?? ''; setEditedVersion(original?.contentVersion ?? null); setEditedContent(content); setEditedEvidence(state.evidence.filter(e => e.sectionCode === selectedSection && e.status === 'Pass' && e.purpose === 'Support' && content.includes(e.claim)).map(e => e.id)) }}>Edit and Reconcile Draft</button>
          {state.accepted && <Button variant="ghost" size="sm" disabled={busy} onClick={() => void run(async () => { const s = history?.sections.find(s => s.sectionCode === selectedSection); if (s && state.accepted) { const result = await api.repairPreview(projectId, selectedSection, state.accepted.id, s.contentVersion); if (alive.current && currentProject.current === projectId) setPreview(result) } })}>Preview targeted repair</Button>}
          {editedContent && <div className="space-y-3"><ResearchField label="Revised section — preserve exact supported claims and their citations" value={editedContent} multiline onChange={setEditedContent} /><ResearchLinks label="Exact claims retained in this revision" options={state.evidence.filter(e => e.sectionCode === selectedSection && e.status === 'Pass' && e.purpose === 'Support').map(e => ({ id: e.id, text: e.claim }))} selected={editedEvidence} onChange={setEditedEvidence} /><button className={button} disabled={busy} onClick={() => void run(async () => { const section = history?.sections.find(s => s.sectionCode === selectedSection); if (!section || !editedVersion) throw new Error('Reload the draft before editing.'); const slot = JSON.stringify(['reconcile', state.accepted?.id, selectedSection, editedVersion, editedContent, [...editedEvidence].sort()]); const stored = await proposalCommandKey(slot)
    const key = attempts.current.get(slot) ?? stored.key; attempts.current.set(slot, key); await api.reconcileSection(projectId, selectedSection, editedVersion, editedContent, editedEvidence, state.accepted?.id, key); attempts.current.delete(slot); if (alive.current && currentProject.current === projectId) setEditedContent('') })}>Save Reconciled Draft</button></div>}
        </article>}
      </div>}
      {tab === 'review' && <div className="space-y-4"><h2 className="text-lg font-semibold">Review your proposal</h2><p className="text-sm text-slate-600">A submission document requires current research, section acceptance, evidence checks and successful semantic and examiner reviews. Draft downloads remain available from the research workspace.</p><div className="flex flex-wrap gap-3"><button className={button} disabled={busy || !state.accepted} onClick={() => void run(() => api.review(projectId, 'semantic'))}>Check proposal consistency</button><button className={button} disabled={busy || !state.accepted} onClick={() => void run(() => api.review(projectId, 'examiner'))}>Review academic requirements</button><button className={`${button} !bg-violet-700 !text-white`} disabled={busy || !ready} onClick={() => void run(async () => { const final = await api.finalize(projectId, state.fingerprint); await api.download(projectId, final.id) })}>Finish & download</button></div>
        {state.findings.length === 0 ? <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">All current readiness checks passed.</p> : <div className="space-y-2">{state.findings.map((f, i) => <div key={`${f.key}|${i}`} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"><span className="font-semibold">{f.status}{f.sectionCode ? ` · ${f.sectionCode}` : ''}</span><p className="mt-1 text-slate-700">{f.message}</p></div>)}</div>}
      </div>}
      {tab === 'history' && <div className="space-y-5"><h2 className="text-lg font-semibold">Research revisions and review history</h2><div className="space-y-2">{history?.revisions.map(r => <p key={r.id} className="rounded-lg border p-3 text-sm">Revision {r.version} · {r.createdReason} · {new Date(r.createdAt).toLocaleString()}{r.specificationSchemaVersion === 0 ? ' · historical snapshot, unverified' : ''}</p>)}</div><div className="space-y-2">{history?.artifacts.map(a => <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"><span>{a.kind.replace(/([A-Z])/g, ' $1').trim()} · {a.sectionCode} · {a.status} · {new Date(a.createdAt).toLocaleString()}</span>{a.kind === 'Finalization' && <button className={button} disabled={busy} onClick={() => void run(() => api.download(projectId, a.id))}>Download Archived Final</button>}</div>)}</div></div>}
    </section>
    <Modal panelClassName="research-design" isOpen={!!regenerateCode} onClose={() => { if (!busy) setRegenerateCode(null) }} title="Replace this draft?">
      <p className="text-sm text-text-secondary">Regeneration replaces the current section, including your edits, using the displayed accepted design. You can cancel and reconcile your existing paragraphs instead. This may use credits.</p>
      <div className="mt-5 flex justify-end gap-3"><Button variant="ghost" disabled={busy} onClick={() => setRegenerateCode(null)}>Keep my draft</Button><Button disabled={busy} onClick={() => { const code = regenerateCode; setRegenerateCode(null); if (code) void run(() => generate(code, true)) }}>Replace draft</Button></div>
    </Modal>
    <Modal panelClassName="research-design" isOpen={!!preview} onClose={() => setPreview(null)} title="Review a targeted repair" size="lg">
      {preview && <div className="space-y-4"><p className="text-sm text-text-secondary">Your saved section has not changed. Review the suggestion before using it in the reconciliation editor.</p>{preview.findings.map((f, i) => <p className="text-sm" key={i}>{f.expected}</p>)}{preview.suggestedContent ? <><details><summary>Current text</summary><p className="whitespace-pre-wrap text-sm">{preview.originalContent}</p></details><p className="whitespace-pre-wrap text-sm">{preview.suggestedContent}</p><Button onClick={() => { setEditedContent(preview.suggestedContent!); setEditedVersion(preview.contentVersion); setEditedEvidence(state.evidence.filter(e => e.sectionCode === preview.sectionCode && e.status === 'Pass' && e.purpose === 'Support' && preview.suggestedContent!.includes(e.claim)).map(e => e.id)); setPreview(null) }}>Use suggestion in editor</Button></> : <p className="text-sm">Review this section manually; there is no safe automatic suggestion.</p>}</div>}
    </Modal>
    {writingChoice && <Modal isOpen title={journey.data?.summary.allowedActions.includes('RetryLegacyDraft') ? "Resume your saved draft?" : "Create your first draft?"} onClose={() => { if (!busy) setWritingChoice(null) }} panelClassName="research-design"><p className="text-sm">{journey.data?.summary.allowedActions.includes('RetryLegacyDraft') ? 'Resume this existing proposal using its saved research setup and writing preferences. It has not been validated by the new Research Design workflow. This uses credits. Review the result before finishing.' : "We'll use your accepted research design and check the sources for each section. Existing paragraphs are protected; unresolved evidence may pause drafting. This uses credits. You will review the result before finishing."}</p><div className="mt-5 flex justify-end gap-3"><Button variant="ghost" disabled={busy} onClick={() => setWritingChoice(null)}>Cancel</Button><Button disabled={busy || !(journey.data?.summary.allowedActions.includes('ChooseWritingMode') || journey.data?.summary.allowedActions.includes('RetryLegacyDraft'))} isLoading={busy} onClick={() => void run(() => chooseWriting(writingChoice))}>Create draft</Button></div></Modal>}
    <details className="text-sm"><summary className="cursor-pointer">Proposal history</summary><Button variant="ghost" onClick={() => openTab('history')}>View previous versions and downloads</Button></details>
    {busy && <p role="status" className="text-sm text-violet-700">Processing and preserving the review result…</p>}
  </main>
}
