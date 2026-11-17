import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { errorMessage, qualApi, type AiMode, type QualAuditEvent, type QualAvailability, type QualMethod, type QualStudy } from '../../api/qualitativeAnalysis'
import { AUDIT_LABELS, METHOD_LABELS, METHOD_NOTES } from '../../lib/qualitative'
import { Skeleton } from '../ui/Skeleton'
import { useConfirm } from '../ui/ConfirmDialog'
import { DangerButton, Notice, PrimaryButton, SecondaryButton, Section, date, dateTime, inputClass, labelClass } from './ui'

export function SettingsTab({ study, features, onChange }: { study: QualStudy; features: QualAvailability; onChange: (s: QualStudy) => void }) {
  const navigate = useNavigate()
  const [title, setTitle] = useState(study.title)
  const [method, setMethod] = useState<QualMethod>(study.method)
  const [aiMode, setAiMode] = useState<AiMode>(study.aiMode)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [audit, setAudit] = useState<{ events: QualAuditEvent[]; chainIntact: boolean } | null>(null)
  const [confirmTitle, setConfirmTitle] = useState('')
  const { confirm: ask, dialog } = useConfirm()
  useEffect(() => { qualApi.audit(study.id).then(setAudit).catch(() => setAudit({ events: [], chainIntact: true })) }, [study.id, study.updatedAt])

  const save = async () => {
    setBusy(true); setMessage(null)
    try { onChange(await qualApi.updateStudy(study.id, { title: title.trim(), method, aiMode })); setMessage({ tone: 'success', text: 'Saved.' }) }
    catch (e) { setMessage({ tone: 'error', text: errorMessage(e, 'The settings could not be saved.') }) } finally { setBusy(false) }
  }
  const discardKey = async () => {
    if (!(await ask({ title: 'Discard the identifier key?', message: 'The tokens stay in the transcripts, but they can no longer be traced back to the original names. This cannot be undone.', confirmLabel: 'Discard key', tone: 'danger' }))) return
    try { onChange(await qualApi.discardIdentifierKey(study.id)); setMessage({ tone: 'success', text: 'The identifier key was discarded.' }) }
    catch (e) { setMessage({ tone: 'error', text: errorMessage(e) }) }
  }
  const remove = async () => {
    try { await qualApi.deleteStudy(study.id); navigate('/app/qualitative-analysis') } catch (e) { setMessage({ tone: 'error', text: errorMessage(e, 'The study could not be deleted.') }) }
  }

  return (
    <>
      {dialog}
      <Section title="Study settings" id="qa-settings">
        <div className="max-w-2xl space-y-3 rounded-xl border border-slate-200 p-4">
          <div><label htmlFor="qa-s-title" className={labelClass}>Title</label><input id="qa-s-title" value={title} maxLength={200} onChange={e => setTitle(e.target.value)} className={inputClass} /></div>
          <div>
            <label htmlFor="qa-s-method" className={labelClass}>Method</label>
            <select id="qa-s-method" value={method} onChange={e => setMethod(e.target.value as QualMethod)} className={inputClass} aria-describedby="qa-s-method-note">
              {features.methods.map(m => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}
            </select>
            <p id="qa-s-method-note" className="mt-1 text-[12px] text-slate-700">{METHOD_NOTES[method]}</p>
          </div>
          <fieldset>
            <legend className={labelClass}>AI suggestions</legend>
            <label className="flex items-start gap-2 text-[14px]"><input type="radio" className="mt-1" checked={aiMode === 'ManualOnly'} onChange={() => setAiMode('ManualOnly')} /> Manual coding only. Nothing is sent to an AI model.</label>
            <label className="mt-1 flex items-start gap-2 text-[14px]"><input type="radio" className="mt-1" checked={aiMode === 'AiAssisted'} onChange={() => setAiMode('AiAssisted')} /> Allow AI code suggestions when I ask for them.{!features.ai && <em className="ml-1 text-slate-700">Not available yet on this account.</em>}</label>
          </fieldset>
          {message && <Notice tone={message.tone}>{message.text}</Notice>}
          <PrimaryButton onClick={save} disabled={busy || !title.trim()}>{busy ? 'Saving…' : 'Save settings'}</PrimaryButton>
        </div>
      </Section>

      <Section title="Data" id="qa-data">
        <div className="max-w-2xl space-y-3 text-[14px] text-slate-800">
          <p>Transcripts and memos are stored encrypted. This study is deleted on {date(study.deleteAfter)} if nothing is done in it before then.</p>
          {study.hasIdentifierKey ? (
            <div className="rounded-xl border border-slate-200 p-3">
              <p>An identifier key is kept: it records which original name each token such as [PERSON A] stands for. It is never sent to an AI model and never exported.</p>
              <SecondaryButton className="mt-2" onClick={discardKey}>Discard the identifier key</SecondaryButton>
            </div>
          ) : <p>No identifier key is kept for this study: tokens cannot be traced back to the original names.</p>}
        </div>
      </Section>

      <Section title="Record of the analysis" id="qa-audit">
        <p className="mb-2 text-[13px] text-slate-800">Every change you make is recorded here, in order. It records what you decided; it holds no transcript text.</p>
        {audit === null ? <Skeleton lines={3} tone="light" /> : (
          <>
            {!audit.chainIntact && <Notice tone="error" className="mb-2">The record does not check out: an entry was changed outside the tool.</Notice>}
            <ol className="max-h-96 divide-y divide-slate-200 overflow-y-auto rounded-xl border border-slate-200 text-[13px]">
              {[...audit.events].reverse().map(e => (
                <li key={e.seq} className="flex flex-wrap justify-between gap-2 px-3 py-1.5"><span className="text-slate-900">{AUDIT_LABELS[e.eventType] ?? e.eventType}{auditDetail(e)}</span><span className="text-slate-700">{dateTime(e.at)}</span></li>
              ))}
            </ol>
          </>
        )}
      </Section>

      <Section title="Delete this study" id="qa-delete">
        <div className="max-w-2xl space-y-2 rounded-xl border border-red-200 p-4 text-[14px] text-slate-800">
          <p>Deleting removes every transcript, code, quote, memo, suggestion and the record of the analysis, for good. Nothing can be recovered.</p>
          <label htmlFor="qa-del-confirm" className={labelClass}>Type the study title to confirm</label>
          <input id="qa-del-confirm" value={confirmTitle} onChange={e => setConfirmTitle(e.target.value)} className={inputClass} autoComplete="off" />
          <DangerButton disabled={confirmTitle.trim() !== study.title} onClick={remove}>Delete the study</DangerButton>
        </div>
      </Section>
    </>
  )
}

/** A few safe details from an audit event (names of the researcher's own codes, counts). Never transcript text, which the record does not hold. */
function auditDetail(e: QualAuditEvent): string {
  try {
    const d = JSON.parse(e.detailJson) as Record<string, unknown>
    const name = (d.codeName ?? d.name ?? d.targetName) as string | undefined
    if (e.eventType === 'CodeChanged' && d.nameFrom && d.nameTo) return `: “${d.nameFrom}” → “${d.nameTo}”`
    if (e.eventType === 'CodeMerged') return `: “${d.sourceName}” into “${d.targetName}”`
    if (e.eventType === 'AiRunFinished') return `: ${d.stored ?? 0} suggestions, ${d.creditsCharged ?? 0} credits`
    return name ? `: “${name}”` : ''
  } catch { return '' }
}
