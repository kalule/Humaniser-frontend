import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage, qualApi, type QualCode, type QualRun, type QualStudy, type QualThemeRunEstimate, type QualThemeSuggestion } from '../../api/qualitativeAnalysis'
import { RUN_FAILURES } from '../../lib/qualitative'
import { Skeleton } from '../ui/Skeleton'
import { useConfirm } from '../ui/ConfirmDialog'
import { Notice, Pill, PrimaryButton, SecondaryButton, inputClass, labelClass } from './ui'

/**
 * AI proposals for grouping your codes into themes. Only code names, definitions and counts are sent; no transcript
 * text. Each proposal becomes a theme only if you accept or change it.
 */
export function ThemeProposals({ study, codes, onDecided }: { study: QualStudy; codes: QualCode[]; onDecided: () => void }) {
  const { confirm: ask, dialog } = useConfirm()
  const [estimate, setEstimate] = useState<QualThemeRunEstimate | null>(null)
  const [estimateError, setEstimateError] = useState<string | null>(null)
  const [run, setRun] = useState<QualRun | null>(null)
  const [pending, setPending] = useState<QualThemeSuggestion[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const timer = useRef<number | null>(null)

  const loadPending = useCallback(() => qualApi.themeSuggestions(study.id, 'Pending').then(setPending).catch(e => setError(errorMessage(e))), [study.id])
  const loadEstimate = useCallback(() => qualApi.estimateThemes(study.id).then(e => { setEstimate(e); setEstimateError(null) }).catch(e => setEstimateError(errorMessage(e, 'Theme proposals are not available for this study.'))), [study.id])
  useEffect(() => {
    void loadPending(); void loadEstimate()
    qualApi.listRuns(study.id).then(rs => { const live = rs.find(r => r.step === 'Themes' && (r.status === 'Queued' || r.status === 'Running')); if (live) setRun(live) }).catch(() => undefined)
  }, [study.id, loadPending, loadEstimate])
  useEffect(() => {
    if (!run || (run.status !== 'Queued' && run.status !== 'Running')) return
    timer.current = window.setTimeout(() => { qualApi.getRun(run.id).then(r => { setRun(r); if (r.status !== 'Queued' && r.status !== 'Running') void loadPending() }).catch(e => setError(errorMessage(e))) }, 3000)
    return () => { if (timer.current) window.clearTimeout(timer.current) }
  }, [run, loadPending])

  const start = async () => {
    if (!estimate) return
    if (!(await ask({ title: `Send ${estimate.codesToSend} code names and definitions to ${estimate.model}?`, message: `No transcript text is sent. It goes via ${estimate.provider} and uses up to ${estimate.maxCredits} credit${estimate.maxCredits === 1 ? '' : 's'}.`, confirmLabel: 'Send', tone: 'warning' }))) return
    setStarting(true); setError(null)
    try { setRun(await qualApi.startThemes(study.id)) } catch (e) { setError(errorMessage(e, 'The run could not be started.')) } finally { setStarting(false) }
  }
  const running = run && (run.status === 'Queued' || run.status === 'Running')

  return (
    <section aria-labelledby="qa-theme-ai" className="mt-6 rounded-xl border border-purple-200 p-4">
      {dialog}
      <h3 id="qa-theme-ai" className="text-[16px] font-semibold text-slate-900">AI proposals for grouping codes into themes</h3>
      {running ? <p className="mt-2 text-[14px] text-slate-800" aria-live="polite">Working… You can keep working meanwhile.</p>
        : estimate ? (
          <div className="mt-2 space-y-2 text-[14px] text-slate-800">
            <p className="text-[13px]">{estimate.note}</p>
            {estimate.enoughCodes ? (
              <>
                <p>{estimate.codesToSend} codes would be sent{estimate.codesLeftOut > 0 ? ` (the ${estimate.codesLeftOut} least-used are left out)` : ''}. Up to {estimate.maxCredits} credit{estimate.maxCredits === 1 ? '' : 's'}. Model: {estimate.model} via {estimate.provider}.</p>
                <PrimaryButton onClick={start} disabled={starting}>{starting ? 'Starting…' : 'Propose themes'}</PrimaryButton>
              </>
            ) : <p>Apply at least four codes to your transcripts first.</p>}
          </div>
        ) : estimateError ? <p className="mt-2 text-[14px] text-slate-800">{estimateError}</p> : <Skeleton lines={2} tone="light" />}
      {run && !running && (
        <Notice tone={run.status === 'Succeeded' ? 'success' : 'error'} className="mt-3">
          {run.status === 'Succeeded' ? `${run.stored} proposal${run.stored === 1 ? '' : 's'} to review.` : RUN_FAILURES[run.failureCode ?? ''] ?? 'The run did not finish.'}
          {run.droppedInvalid > 0 && ` ${run.droppedInvalid} proposal${run.droppedInvalid === 1 ? ' was' : 's were'} dropped for naming codes that do not exist, or for claiming how common a view is.`}
          {run.droppedPreviouslyRejected > 0 && ` ${run.droppedPreviouslyRejected} you had rejected before ${run.droppedPreviouslyRejected === 1 ? 'was' : 'were'} not shown again.`}
        </Notice>
      )}
      {error && <Notice tone="error" className="mt-2">{error}</Notice>}
      <div className="mt-4">
        <h4 className="text-[14px] font-semibold text-slate-900">Waiting for your decision{pending ? ` (${pending.length})` : ''}</h4>
        {pending === null ? <Skeleton lines={2} tone="light" /> : pending.length === 0 ? <p className="text-[13px] text-slate-700">Nothing waiting.</p> : (
          <ul className="mt-2 space-y-2">{pending.map(p => <Proposal key={p.id} p={p} codes={codes} onDecided={() => { void loadPending(); onDecided() }} />)}</ul>
        )}
      </div>
    </section>
  )
}

function Proposal({ p, codes, onDecided }: { p: QualThemeSuggestion; codes: QualCode[]; onDecided: () => void }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(p.name)
  const [definition, setDefinition] = useState(p.definition)
  const [selected, setSelected] = useState<Set<string>>(new Set(p.codes.map(c => c.id)))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const act = async (f: () => Promise<unknown>) => { setBusy(true); setError(null); try { await f(); onDecided() } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) } }
  const toggle = (id: string) => setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const selectable = codes.filter(c => c.status !== 'Merged')
  return (
    <li className="rounded-lg border border-slate-200 p-3 text-[14px]">
      <p className="flex flex-wrap items-center gap-2"><Pill tone="purple">AI proposal</Pill><span className="font-semibold text-slate-900">{p.name}</span></p>
      {p.definition && <p className="mt-0.5 text-[13px] text-slate-800">{p.definition}</p>}
      <p className="mt-1 text-[13px] text-slate-700">Codes: {p.codes.map(c => c.name + (c.status === 'Active' ? '' : ` (${c.status.toLowerCase()})`)).join(', ')}</p>
      {editing && (
        <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-2">
          <div><label htmlFor={`qa-tp-n-${p.id}`} className={labelClass}>Name</label><input id={`qa-tp-n-${p.id}`} value={name} maxLength={120} onChange={e => setName(e.target.value)} className={inputClass} /></div>
          <div><label htmlFor={`qa-tp-d-${p.id}`} className={labelClass}>What the theme says</label><textarea id={`qa-tp-d-${p.id}`} rows={2} maxLength={4000} value={definition} onChange={e => setDefinition(e.target.value)} className={inputClass} /></div>
          <fieldset><legend className={labelClass}>Codes</legend>
            <div className="grid gap-1 sm:grid-cols-2">{selectable.map(c => <label key={c.id} className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} /> {c.name}</label>)}</div>
          </fieldset>
        </div>
      )}
      {error && <Notice tone="error" className="mt-2">{error}</Notice>}
      <div className="mt-2 flex flex-wrap gap-2">
        {editing ? (
          <>
            <PrimaryButton disabled={busy || !name.trim() || selected.size === 0} onClick={() => act(() => qualApi.editTheme(p.id, { name: name.trim(), definition, codeIds: [...selected] }))}>Save my version</PrimaryButton>
            <SecondaryButton disabled={busy} onClick={() => setEditing(false)}>Cancel</SecondaryButton>
          </>
        ) : (
          <>
            <PrimaryButton disabled={busy} onClick={() => act(() => qualApi.acceptTheme(p.id))}>Accept</PrimaryButton>
            <SecondaryButton disabled={busy} onClick={() => setEditing(true)}>Change, then accept</SecondaryButton>
            <SecondaryButton disabled={busy} onClick={() => act(() => qualApi.rejectTheme(p.id))}>Reject</SecondaryButton>
          </>
        )}
      </div>
    </li>
  )
}
