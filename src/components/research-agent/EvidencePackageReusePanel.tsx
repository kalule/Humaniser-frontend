import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { deepResearchApi, type DeepResearchSessionSummary, type EvidencePackageReuse, type EvidenceSource, type VerifiedEvidencePackage } from '../../api/deepResearch'
import { reviewerApi } from '../../api/reviewer'
import { apiErrorMessage } from '../../lib/deepResearch'
import { BindEvidenceModal } from '../app/BindEvidenceModal'

const button = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-40'
export default function EvidencePackageReusePanel({ projectId, specificationId, onChanged, studentMode = false, onReview }: { onReview?: () => void; studentMode?: boolean; projectId: string; specificationId: string | null; onChanged: () => Promise<void> }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [sessions, setSessions] = useState<DeepResearchSessionSummary[]>([])
  const [handoffs, setHandoffs] = useState<EvidencePackageReuse[]>([])
  const [sessionId, setSessionId] = useState(params.get('package') ?? '')
  const [evidence, setEvidence] = useState<VerifiedEvidencePackage | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [acknowledged, setAcknowledged] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [bind, setBind] = useState<{ sessionId: string; source: EvidenceSource } | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [feedback, setFeedback] = useState<Awaited<ReturnType<typeof deepResearchApi.projectReviewFeedback>>>(null)
  useEffect(() => {
    let current = true
    setHandoffs([]); setSessions([]); setFeedback(null); setError(''); setLoading(true)
    Promise.all([deepResearchApi.list(projectId, 100), deepResearchApi.projectPackages(projectId), deepResearchApi.projectReviewFeedback(projectId)])
      .then(([items, reused, reviewed]) => { if (current) { setSessions(items.filter(item => item.isFinished)); setHandoffs(reused); setFeedback(reviewed) } })
      .catch(e => { if (current) setError(studentMode ? 'We could not load supporting research. Please try again.' : apiErrorMessage(e, 'Could not load supporting research.')) })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [projectId, specificationId, refresh])
  useEffect(() => {
    let current = true
    setEvidence(null); setSelected([]); setAcknowledged(false)
    if (sessionId) deepResearchApi.evidencePackage(sessionId).then(item => {
      if (!current) return
      if (item.projectId !== projectId) { setError('This package belongs to another project. Select a package for this project.'); return }
      setEvidence(item)
    }).catch(e => { if (current) setError(studentMode ? 'We could not load these sources. Please try again.' : apiErrorMessage(e, 'Could not load this package.')) })
    return () => { current = false }
  }, [sessionId, projectId])
  async function attach() {
    if (!evidence || !specificationId || busy) return
    setBusy(true); setError('')
    try {
      await deepResearchApi.reusePackage(evidence.sessionId, { expectedSpecificationId: specificationId, expectedPackageHash: evidence.contentHash, sourceIds: selected, acknowledgePartialEvidence: acknowledged })
      setRefresh(value => value + 1); await onChanged()
    } catch (e) { setError(studentMode ? 'We could not save your sources. Please try again.' : apiErrorMessage(e, 'Package reuse could not be saved.')) }
    finally { setBusy(false) }
  }
  async function review() {
    setBusy(true); setError('')
    try {
      const result = await reviewerApi.create({ reviewType: 'Proposal', sourceType: 'ResearchProject', researchProjectId: projectId, highQuality: false })
      navigate(`/app/reviewer/${result.id}`)
    } catch (e) { setError(studentMode ? 'We could not review these sources. Please try again.' : apiErrorMessage(e, 'Project review could not be completed.')) }
    finally { setBusy(false) }
  }
  return <section className="space-y-3 rounded-xl border border-violet-200 bg-violet-50/30 p-4">
    <h3 className="text-lg font-semibold">{studentMode ? "Research evidence" : "Reuse Deep Research evidence"}</h3>
    <p className="text-sm text-slate-600">{studentMode ? "Review supporting sources and their limitations. Each writing claim still needs a source check." : "Select verified sources for this research revision. Stored findings and coverage follow your project into review, research design and thesis writing. Claim bindings still require your approval."}</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <button className={button} disabled={busy} onClick={() => setRefresh(value => value + 1)}>{studentMode ? 'Refresh sources' : 'Refresh packages'}</button>
    {loading ? <p role="status">{studentMode ? 'Loading sources...' : 'Loading packages...'}</p> : <>
      {!specificationId && <p className="text-sm text-amber-800">{studentMode ? 'Accept your research design before including these sources.' : 'Accept a research specification below before attaching evidence.'}</p>}
      <select aria-label={studentMode ? "Supporting research" : "Research evidence package"} className="w-full rounded-lg border bg-white p-2 text-sm" value={sessionId} onChange={event => { setError(''); setSessionId(event.target.value) }}><option value="">{studentMode ? 'Select completed supporting research' : 'Select a finished research package'}</option>{sessionId && !sessions.some(item => item.id === sessionId) && <option value={sessionId}>{studentMode ? 'Linked research' : 'Linked package'}</option>}{sessions.map(item => <option key={item.id} value={item.id}>{item.researchQuestion} · {item.status}</option>)}</select>
      {!sessions.length && <Link className="text-sm text-violet-700" to={`/app/deep-research?projectId=${projectId}`}>{studentMode ? 'Find supporting research' : 'Open Deep Research for this project'}</Link>}
      {evidence && <div className="space-y-3 text-sm"><p className="font-medium">{evidence.researchQuestion}</p><p>{evidence.scope ? [...evidence.scope.population, ...evidence.scope.geography].join(' · ') : 'Scope not established'}</p><Link className="text-violet-700" to={`/app/web-library/packages?projectId=${projectId}&session=${evidence.sessionId}`}>Inspect findings, contradictions and search coverage</Link>
        {[...new Map(evidence.acceptedEvidence.map(source => [source.id, source])).values()].map(source => <label key={source.id} className="flex items-start gap-2 rounded-lg border bg-white p-2"><input type="checkbox" checked={selected.includes(source.id)} onChange={event => setSelected(ids => event.target.checked ? [...ids, source.id] : ids.filter(id => id !== source.id))} /><span>{source.title} · {source.polarity}</span></label>)}
        {!evidence.evidenceSufficient && <label className="flex items-start gap-2 text-amber-900"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} /><span>{studentMode ? "This supporting research is incomplete. Including it does not prove a research gap or resolve missing evidence." : `I understand this package is partial (${evidence.completionReason}); reuse does not validate a research gap or establish sufficient evidence.`}</span></label>}
        <button className={button} disabled={busy || !specificationId || !selected.length || (!evidence.evidenceSufficient && !acknowledged)} onClick={() => void attach()}>{busy ? 'Saving…' : 'Reuse selected evidence'}</button>
      </div>}
      {handoffs.map(handoff => <div key={handoff.id} className="space-y-2 rounded-lg border bg-white p-3 text-sm"><p className="font-medium">{handoff.package.researchQuestion}</p><p className={handoff.isCurrent ? 'text-emerald-800' : 'text-amber-800'}>{handoff.isCurrent ? 'Attached to current research revision' : 'Stale — review and attach again'} · {handoff.sources.length} selected sources</p>{handoff.limitations.map((limitation, i) => <p key={i} className="text-amber-800">{limitation}</p>)}
        <button className={button} disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await deepResearchApi.detachPackage(handoff.sessionId); setRefresh(value => value + 1); await onChanged() } catch (e) { setError(studentMode ? 'We could not update your sources. Please try again.' : apiErrorMessage(e, 'Could not stop using this package.')) } finally { setBusy(false) } }}>{studentMode ? 'Stop using these sources' : 'Stop using package'}</button>
        {handoff.isCurrent && handoff.package.acceptedEvidence.filter((source, index, items) => items.findIndex(item => item.id === source.id) === index).map(source => <button key={source.id} className={button} disabled={busy} onClick={() => setBind({ sessionId: handoff.sessionId, source })}>{studentMode ? "Check claim support:" : "Propose binding:"} {source.title}</button>)}
      </div>)}
      {handoffs.some(handoff => handoff.isCurrent) && <div className="flex flex-wrap gap-2"><button className={button} disabled={busy || handoffs.some(handoff => !handoff.isCurrent)} onClick={() => studentMode && onReview ? onReview() : void review()}>Review proposal with evidence</button>{!studentMode && <Link className={button} to={`/app/research-agent/${projectId}/dashboard?tab=validation`}>Research design and thesis readiness</Link>}</div>}
      {feedback && <div className="space-y-2 text-sm"><p>{feedback.isCurrent ? 'Reviewer feedback available for research design' : 'Reviewer feedback is stale — run review again'} · {feedback.review.Verdict}</p><Link className="text-violet-700" to={`/app/reviewer/${feedback.review.Id}`}>Open reviewer findings</Link>{feedback.isCurrent && feedback.review.Findings.map((finding, index) => <p key={index}>{finding.Text} {finding.Suggestion}</p>)}</div>}
    </>}
    {bind && <BindEvidenceModal open onClose={() => { setBind(null); void onChanged() }} projectId={projectId} sessionId={bind.sessionId} sourceId={bind.source.id} title={bind.source.title} />}
  </section>
}
