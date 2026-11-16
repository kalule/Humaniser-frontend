import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage, qualApi, type QualCode, type QualRun, type QualRunEstimate, type QualStudy, type QualSuggestion, type QualTranscript } from '../../api/qualitativeAnalysis'
import { RUN_FAILURES, dateTimeOrDash } from './suggestionText'
import { Skeleton } from '../ui/Skeleton'
import { useConfirm } from '../ui/ConfirmDialog'
import { Notice, Pill, PrimaryButton, SecondaryButton, Section, inputClass, labelClass } from './ui'

/** The study-wide view: every run, and every suggestion still waiting for a decision. */
export function SuggestionsTab({ study }: { study: QualStudy }) {
  const [runs, setRuns] = useState<QualRun[] | null>(null)
  const [pending, setPending] = useState<QualSuggestion[] | null>(null)
  const [codes, setCodes] = useState<QualCode[]>([])
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => {
    qualApi.listRuns(study.id).then(setRuns).catch(e => setError(errorMessage(e)))
    qualApi.listSuggestions(study.id, 'Pending').then(setPending).catch(e => setError(errorMessage(e)))
    qualApi.listCodes(study.id).then(c => setCodes(c.filter(x => x.status === 'Active'))).catch(() => setCodes([]))
  }, [study.id])
  useEffect(load, [load])

  if (study.aiMode !== 'AiAssisted') return <Notice className="mt-6">This study is set to manual coding only, so nothing is sent to an AI model. You can change that in Settings.</Notice>

  return (
    <>
      <Notice className="mt-6" title="How suggestions work">
        Open a transcript to ask for suggestions. Only participants’ turns are sent, after the names you listed are replaced; names you did not list are sent as they are.
        Each suggested passage is checked word for word against the transcript before you see it, and nothing becomes a code until you accept or change it.
      </Notice>
      {error && <Notice tone="error" className="mt-3">{error}</Notice>}
      <Section title="Waiting for your decision" id="qa-pending">
        {pending === null ? <Skeleton lines={3} tone="light" /> : pending.length === 0 ? <p className="text-[14px] text-slate-700">Nothing waiting.</p> : (
          <SuggestionList suggestions={pending} codes={codes} onDecided={load} showTranscript studyId={study.id} />
        )}
      </Section>
      <Section title="Runs" id="qa-runs">
        {runs === null ? <Skeleton lines={2} tone="light" /> : runs.length === 0 ? <p className="text-[14px] text-slate-700">No runs yet.</p> : <RunTable runs={runs} />}
      </Section>
    </>
  )
}

/** Inside the coding screen: estimate, start, follow a run, and decide this transcript's suggestions. */
export function TranscriptSuggestions({ study, transcript, codes, onDecided }: { study: QualStudy; transcript: QualTranscript; codes: QualCode[]; onDecided: () => void }) {
  const { confirm: ask, dialog } = useConfirm()
  const [estimate, setEstimate] = useState<QualRunEstimate | null>(null)
  const [estimateError, setEstimateError] = useState<string | null>(null)
  const [run, setRun] = useState<QualRun | null>(null)
  const [suggestions, setSuggestions] = useState<QualSuggestion[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const timer = useRef<number | null>(null)

  const loadSuggestions = useCallback(() => qualApi.listSuggestions(study.id, 'Pending', transcript.id).then(setSuggestions).catch(e => setError(errorMessage(e))), [study.id, transcript.id])
  const loadEstimate = useCallback(() => qualApi.estimate(transcript.id).then(e => { setEstimate(e); setEstimateError(null) }).catch(e => { setEstimate(null); setEstimateError(errorMessage(e, 'Suggestions are not available for this transcript.')) }), [transcript.id])
  useEffect(() => {
    void loadSuggestions(); void loadEstimate()
    qualApi.listRuns(study.id).then(rs => { const live = rs.find(r => r.transcriptId === transcript.id && (r.status === 'Queued' || r.status === 'Running')); if (live) setRun(live) }).catch(() => undefined)
  }, [loadSuggestions, loadEstimate, study.id, transcript.id, transcript.version])

  // Follow a queued or running run until it finishes.
  useEffect(() => {
    if (!run || (run.status !== 'Queued' && run.status !== 'Running')) return
    timer.current = window.setTimeout(() => {
      qualApi.getRun(run.id).then(r => { setRun(r); if (r.status !== 'Queued' && r.status !== 'Running') { void loadSuggestions(); void loadEstimate() } }).catch(e => setError(errorMessage(e)))
    }, 3000)
    return () => { if (timer.current) window.clearTimeout(timer.current) }
  }, [run, loadSuggestions, loadEstimate])

  const start = async () => {
    if (!estimate) return
    if (!(await ask({ title: `Send ${estimate.segmentsToSend} participant turn${estimate.segmentsToSend === 1 ? '' : 's'} to ${estimate.model} (${estimate.provider})?`, message: `${estimate.batches} batch${estimate.batches === 1 ? '' : 'es'}. This uses up to ${estimate.maxCredits} credit${estimate.maxCredits === 1 ? '' : 's'}; batches that fail are not charged.`, confirmLabel: 'Send', tone: 'warning' }))) return
    setStarting(true); setError(null)
    try { setRun(await qualApi.startRun(transcript.id)) } catch (e) { setError(errorMessage(e, 'The run could not be started.')) } finally { setStarting(false) }
  }

  const running = run && (run.status === 'Queued' || run.status === 'Running')
  return (
    <section aria-labelledby="qa-ai-here" className="mt-6 rounded-xl border border-purple-200 p-4">
      {dialog}
      <h3 id="qa-ai-here" className="text-[16px] font-semibold text-slate-900">AI code suggestions for this transcript</h3>
      {running ? (
        <p className="mt-2 text-[14px] text-slate-800" aria-live="polite">Working: {run.batchesProcessed + run.batchesFailed} of {run.batches} batches done. You can keep coding meanwhile.</p>
      ) : estimate ? (
        <div className="mt-2 space-y-2 text-[14px] text-slate-800">
          <p>{estimate.segmentsToSend} participant turn{estimate.segmentsToSend === 1 ? '' : 's'} not yet suggested for, in {estimate.batches} batch{estimate.batches === 1 ? '' : 'es'}: up to {estimate.maxCredits} credit{estimate.maxCredits === 1 ? '' : 's'}. Model: {estimate.model} via {estimate.provider}.
            {estimate.batchesLeftForLater > 0 && ` ${estimate.batchesLeftForLater} more batch${estimate.batchesLeftForLater === 1 ? '' : 'es'} will be left for another run.`}</p>
          {estimate.languageWarnings && <Notice tone="warning">Some of these turns are probably not in the language of analysis. Suggestions on them are marked; nothing is translated.</Notice>}
          <p className="text-[13px] text-slate-700">{estimate.note}</p>
          <PrimaryButton onClick={start} disabled={starting}>{starting ? 'Starting…' : 'Suggest codes'}</PrimaryButton>
        </div>
      ) : estimateError ? <p className="mt-2 text-[14px] text-slate-800">{estimateError}</p> : <Skeleton lines={2} tone="light" />}
      {run && !running && <RunSummary run={run} />}
      {error && <Notice tone="error" className="mt-2">{error}</Notice>}
      <div className="mt-4">
        <h4 className="text-[14px] font-semibold text-slate-900">Waiting for your decision{suggestions ? ` (${suggestions.length})` : ''}</h4>
        {suggestions === null ? <Skeleton lines={2} tone="light" /> : suggestions.length === 0 ? <p className="text-[13px] text-slate-700">Nothing waiting.</p>
          : <SuggestionList suggestions={suggestions} codes={codes} onDecided={() => { void loadSuggestions(); onDecided() }} />}
      </div>
    </section>
  )
}

function RunSummary({ run }: { run: QualRun }) {
  const dropped = run.droppedUnverifiable + run.droppedWrongSegment + run.droppedInvalid
  return (
    <div className="mt-3 space-y-2">
      <Notice tone={run.status === 'Succeeded' ? 'success' : 'error'}>
        {run.status === 'Succeeded'
          ? `Finished: ${run.stored} suggestion${run.stored === 1 ? '' : 's'} to review from ${run.batchesProcessed} batch${run.batchesProcessed === 1 ? '' : 'es'}. ${run.creditsCharged} credit${run.creditsCharged === 1 ? '' : 's'} used.`
          : RUN_FAILURES[run.failureCode ?? ''] ?? 'The run did not finish.'}
        {dropped > 0 && ` ${dropped} proposal${dropped === 1 ? ' was' : 's were'} dropped because the words were not in the transcript, were in another person’s turn, or did not follow the rules.`}
        {run.droppedPreviouslyRejected > 0 && ` ${run.droppedPreviouslyRejected} you had rejected before ${run.droppedPreviouslyRejected === 1 ? 'was' : 'were'} not shown again.`}
        {run.batchesFailed > 0 && run.status === 'Succeeded' && ` ${run.batchesFailed} batch${run.batchesFailed === 1 ? '' : 'es'} failed and ${run.batchesFailed === 1 ? 'was' : 'were'} not charged; ask again to retry ${run.batchesFailed === 1 ? 'it' : 'them'}.`}
      </Notice>
      {run.warning && <Notice tone="warning">{run.warning}</Notice>}
    </div>
  )
}

function RunTable({ runs }: { runs: QualRun[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-left text-[13px]">
        <caption className="sr-only">AI suggestion runs</caption>
        <thead className="bg-slate-50 text-slate-800"><tr>
          <th scope="col" className="px-3 py-2">Started</th><th scope="col" className="px-3 py-2">Status</th><th scope="col" className="px-3 py-2">Batches</th><th scope="col" className="px-3 py-2">Suggestions</th>
          <th scope="col" className="px-3 py-2">Dropped</th><th scope="col" className="px-3 py-2">Model</th><th scope="col" className="px-3 py-2">Credits</th>
        </tr></thead>
        <tbody className="divide-y divide-slate-200">
          {runs.map(r => (
            <tr key={r.id}>
              <td className="px-3 py-2">{dateTimeOrDash(r.createdAt)}</td>
              <td className="px-3 py-2">{r.status}{r.failureCode ? ` (${RUN_FAILURES[r.failureCode] ? 'see note' : r.failureCode})` : ''}{r.warning && <> <Pill tone="amber">Check</Pill></>}</td>
              <td className="px-3 py-2">{r.batchesProcessed} of {r.batches}{r.batchesFailed ? `, ${r.batchesFailed} failed` : ''}</td>
              <td className="px-3 py-2">{r.stored}</td>
              <td className="px-3 py-2">{r.droppedUnverifiable + r.droppedWrongSegment + r.droppedInvalid}</td>
              <td className="px-3 py-2">{r.model}</td>
              <td className="px-3 py-2">{r.creditsCharged}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SuggestionList({ suggestions, codes, onDecided, showTranscript, studyId }: { suggestions: QualSuggestion[]; codes: QualCode[]; onDecided: () => void; showTranscript?: boolean; studyId?: string }) {
  return <ul className="mt-2 space-y-2">{suggestions.map(s => <SuggestionItem key={s.id} s={s} codes={codes} onDecided={onDecided} showTranscript={showTranscript} studyId={studyId} />)}</ul>
}

function SuggestionItem({ s, codes, onDecided, showTranscript, studyId }: { s: QualSuggestion; codes: QualCode[]; onDecided: () => void; showTranscript?: boolean; studyId?: string }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(s.codeName)
  const [definition, setDefinition] = useState(s.definition)
  const [codeId, setCodeId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const act = async (f: () => Promise<unknown>) => { setBusy(true); setError(null); try { await f(); onDecided() } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) } }
  const existing = s.existingCodeId ? codes.find(c => c.id === s.existingCodeId) : undefined
  const editBody = codeId ? { codeId } : { ...(name !== s.codeName ? { codeName: name } : {}), ...(definition !== s.definition ? { definition } : {}) }

  return (
    <li className="rounded-lg border border-slate-200 p-3 text-[14px]">
      <p className="flex flex-wrap items-center gap-2"><Pill tone="purple">AI suggestion</Pill><span className="font-semibold text-slate-900">{existing ? `${existing.name} (existing code)` : s.codeName}</span></p>
      {!existing && s.definition && <p className="mt-0.5 text-[13px] text-slate-800">{s.definition}</p>}
      {s.state === 'Verified'
        ? <blockquote className="mt-1 border-l-2 border-slate-300 pl-2 text-slate-900">“{s.quote}” <span className="text-[13px] text-slate-700">— {s.pseudonym ?? 'Participant'}{showTranscript ? `, ${s.transcriptLabel}` : ''}{s.segmentOrdinal !== null ? `, turn ${s.segmentOrdinal + 1}` : ''}</span></blockquote>
        : <p className="mt-1 text-[13px] text-amber-950"><Pill tone="amber">Not verified</Pill> The transcript changed after this was suggested. Reject it, or code the passage yourself.</p>}
      {s.languageNote && <Notice tone="warning" className="mt-2">{s.languageNote}</Notice>}
      {showTranscript && studyId && <p className="mt-1 text-[13px]"><Link className="underline" to={`/app/qualitative-analysis/${studyId}/transcripts/${s.transcriptId}`}>Open the transcript</Link></p>}
      {editing && (
        <div className="mt-2 grid gap-2 rounded-lg bg-slate-50 p-2 sm:grid-cols-2">
          <div><label htmlFor={`qa-sn-${s.id}`} className={labelClass}>Code name</label><input id={`qa-sn-${s.id}`} value={name} maxLength={80} disabled={!!codeId} onChange={e => setName(e.target.value)} className={inputClass} /></div>
          <div>
            <label htmlFor={`qa-sc-${s.id}`} className={labelClass}>Or use one of your codes</label>
            <select id={`qa-sc-${s.id}`} value={codeId} onChange={e => setCodeId(e.target.value)} className={inputClass}>
              <option value="">No, use the name</option>
              {codes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2"><label htmlFor={`qa-sd-${s.id}`} className={labelClass}>Definition</label><textarea id={`qa-sd-${s.id}`} rows={2} maxLength={2000} disabled={!!codeId} value={definition} onChange={e => setDefinition(e.target.value)} className={inputClass} /></div>
        </div>
      )}
      {error && <Notice tone="error" className="mt-2">{error}</Notice>}
      <div className="mt-2 flex flex-wrap gap-2">
        {editing ? (
          <>
            <PrimaryButton disabled={busy || Object.keys(editBody).length === 0} onClick={() => act(() => qualApi.edit(s.id, editBody))}>Save my version</PrimaryButton>
            <SecondaryButton disabled={busy} onClick={() => setEditing(false)}>Cancel</SecondaryButton>
          </>
        ) : (
          <>
            <PrimaryButton disabled={busy || s.state !== 'Verified'} onClick={() => act(() => qualApi.accept(s.id))}>Accept</PrimaryButton>
            <SecondaryButton disabled={busy || s.state !== 'Verified'} onClick={() => setEditing(true)}>Change, then accept</SecondaryButton>
            <SecondaryButton disabled={busy} onClick={() => act(() => qualApi.reject(s.id))}>Reject</SecondaryButton>
          </>
        )}
      </div>
    </li>
  )
}
