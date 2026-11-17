import { useEffect, useState, type FormEvent } from 'react'
import { errorMessage, qualApi, type MemoKind, type QualCode, type QualMemo, type QualStudy, type QualTranscript } from '../../api/qualitativeAnalysis'
import { Skeleton } from '../ui/Skeleton'
import { useConfirm } from '../ui/ConfirmDialog'
import { DangerButton, Notice, Pill, PrimaryButton, SecondaryButton, Section, dateTime, inputClass, labelClass } from './ui'

const KINDS: { value: MemoKind; label: string; hint: string }[] = [
  { value: 'Reflexive', label: 'Reflexive', hint: 'Your own position, assumptions and reactions.' },
  { value: 'Code', label: 'About a code', hint: 'What a code means and how it changed.' },
  { value: 'Transcript', label: 'About a transcript', hint: 'Notes on one interview or group.' },
  { value: 'Comparison', label: 'Comparison', hint: 'Similarities and differences across cases or codes.' },
]

/** Memos. Their text is stored encrypted, because memos often quote participants. */
export function MemosTab({ study }: { study: QualStudy }) {
  const [memos, setMemos] = useState<QualMemo[] | null>(null)
  const [codes, setCodes] = useState<QualCode[]>([])
  const [transcripts, setTranscripts] = useState<QualTranscript[]>([])
  const [error, setError] = useState<string | null>(null)
  const load = () => qualApi.listMemos(study.id).then(setMemos).catch(e => setError(errorMessage(e, 'The memos could not be loaded.')))
  useEffect(() => {
    void load()
    qualApi.listCodes(study.id).then(setCodes).catch(() => setCodes([]))
    qualApi.listTranscripts(study.id).then(setTranscripts).catch(() => setTranscripts([]))
  }, [study.id])

  const targetName = (m: QualMemo) => m.kind === 'Code' || m.kind === 'Comparison' ? codes.find(c => c.id === m.targetId)?.name : m.kind === 'Transcript' ? transcripts.find(t => t.id === m.targetId)?.label : undefined

  return (
    <>
      <Section title="Write a memo" id="qa-new-memo"><NewMemo studyId={study.id} codes={codes} transcripts={transcripts} onCreated={load} /></Section>
      <Section title="Memos" id="qa-memos">
        {error && <Notice tone="error">{error}</Notice>}
        {memos === null && !error ? <Skeleton lines={3} tone="light" /> : memos && memos.length === 0 ? <p className="text-[14px] text-slate-700">No memos yet.</p> : memos && (
          <ul className="space-y-2">{memos.map(m => <MemoItem key={m.id} memo={m} about={targetName(m)} onChanged={load} />)}</ul>
        )}
      </Section>
    </>
  )
}

function NewMemo({ studyId, codes, transcripts, onCreated }: { studyId: string; codes: QualCode[]; transcripts: QualTranscript[]; onCreated: () => void }) {
  const [kind, setKind] = useState<MemoKind>('Reflexive')
  const [targetId, setTargetId] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const targets = kind === 'Code' || kind === 'Comparison' ? codes.map(c => ({ id: c.id, label: c.name })) : kind === 'Transcript' ? transcripts.map(t => ({ id: t.id, label: t.label })) : []
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(null)
    if (!body.trim()) { setError('Write something first.'); return }
    if ((kind === 'Code' || kind === 'Transcript') && !targetId) { setError('Choose what the memo is about.'); return }
    setBusy(true)
    try { await qualApi.createMemo(studyId, { kind, targetId: targetId || null, body }); setBody(''); onCreated() }
    catch (err) { setError(errorMessage(err, 'The memo could not be saved.')) } finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="max-w-3xl space-y-3 rounded-xl border border-slate-200 p-4" noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="qa-memo-kind" className={labelClass}>Kind</label>
          <select id="qa-memo-kind" value={kind} onChange={e => { setKind(e.target.value as MemoKind); setTargetId('') }} className={inputClass} aria-describedby="qa-memo-kind-hint">
            {KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
          <p id="qa-memo-kind-hint" className="mt-1 text-[12px] text-slate-700">{KINDS.find(k => k.value === kind)?.hint}</p>
        </div>
        {targets.length > 0 && (
          <div>
            <label htmlFor="qa-memo-target" className={labelClass}>About{kind === 'Comparison' ? ' (optional)' : ''}</label>
            <select id="qa-memo-target" value={targetId} onChange={e => setTargetId(e.target.value)} className={inputClass}>
              <option value="">{kind === 'Comparison' ? 'Nothing in particular' : 'Choose…'}</option>
              {targets.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
        )}
      </div>
      <div><label htmlFor="qa-memo-body" className={labelClass}>Memo</label><textarea id="qa-memo-body" rows={5} maxLength={20000} value={body} onChange={e => setBody(e.target.value)} className={inputClass} /></div>
      {error && <Notice tone="error">{error}</Notice>}
      <PrimaryButton type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save memo'}</PrimaryButton>
    </form>
  )
}

function MemoItem({ memo, about, onChanged }: { memo: QualMemo; about?: string; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const [body, setBody] = useState(memo.body)
  const [error, setError] = useState<string | null>(null)
  const { confirm: ask, dialog } = useConfirm()
  const save = async () => { try { await qualApi.updateMemo(memo.id, body); setEditing(false); onChanged() } catch (e) { setError(errorMessage(e)) } }
  const remove = async () => { if (await ask({ title: 'Delete this memo?', message: 'This cannot be undone.', confirmLabel: 'Delete memo', tone: 'danger' })) { try { await qualApi.deleteMemo(memo.id); onChanged() } catch (e) { setError(errorMessage(e)) } } }
  return (
    <li className="rounded-xl border border-slate-200 p-3 text-[14px]">
      {dialog}
      <p className="mb-1 flex flex-wrap items-center gap-2 text-[13px] text-slate-700">
        <Pill>{KINDS.find(k => k.value === memo.kind)?.label ?? memo.kind}</Pill>{about && <span>{about}</span>}<span>· {dateTime(memo.updatedAt)}</span>
      </p>
      {editing ? (
        <>
          <label htmlFor={`qa-memo-${memo.id}`} className="sr-only">Memo text</label>
          <textarea id={`qa-memo-${memo.id}`} rows={5} maxLength={20000} value={body} onChange={e => setBody(e.target.value)} className={inputClass} />
          <div className="mt-2 flex gap-2"><PrimaryButton onClick={save}>Save</PrimaryButton><SecondaryButton onClick={() => { setBody(memo.body); setEditing(false) }}>Cancel</SecondaryButton></div>
        </>
      ) : (
        <>
          <p className="whitespace-pre-wrap text-slate-900 [overflow-wrap:anywhere]">{memo.body}</p>
          <div className="mt-2 flex gap-2"><SecondaryButton onClick={() => setEditing(true)}>Edit</SecondaryButton><DangerButton onClick={remove}>Delete</DangerButton></div>
        </>
      )}
      {error && <Notice tone="error" className="mt-2">{error}</Notice>}
    </li>
  )
}
