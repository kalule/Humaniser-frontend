import { useEffect, useState, type FormEvent } from 'react'
import { errorMessage, qualApi, type QualAgreement, type QualCoder, type QualCompletion, type QualStudy, type QualTranscript } from '../../api/qualitativeAnalysis'
import { METHOD_LABELS } from '../../lib/qualitative'
import { Skeleton } from '../ui/Skeleton'
import { useConfirm } from '../ui/ConfirmDialog'
import { ImportCoder } from './ImportCoder'
import { DangerButton, Notice, PrimaryButton, Section, inputClass, labelClass } from './ui'

const fixed = (n: number | null | undefined, digits = 2) => (n === null || n === undefined ? '—' : n.toFixed(digits))
const pct = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${Math.round(n * 100)}%`)

/**
 * A second coder and agreement between coders. Offered only for methods where agreement is a fitting check. The
 * second coder codes blind: neither coder sees the other's coding. Agreement is computed on transcripts both have
 * marked finished, and no value is called good or bad.
 */
export function CodersTab({ study }: { study: QualStudy }) {
  const [coders, setCoders] = useState<QualCoder[] | null>(null)
  const [completions, setCompletions] = useState<QualCompletion[]>([])
  const [transcripts, setTranscripts] = useState<QualTranscript[]>([])
  const [agreement, setAgreement] = useState<QualAgreement | null>(null)
  const [agreementNote, setAgreementNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedCoder, setSelectedCoder] = useState<string>('')
  const { confirm: ask, dialog } = useConfirm()

  const load = () => {
    setError(null)
    qualApi.listCoders(study.id).then(c => { setCoders(c); const seconds = c.filter(x => x.kind !== 'Owner'); if (!seconds.some(s => s.id === selectedCoder)) setSelectedCoder(seconds[0]?.id ?? '') }).catch(e => setError(errorMessage(e)))
    qualApi.completions(study.id).then(setCompletions).catch(() => setCompletions([]))
    qualApi.listTranscripts(study.id).then(t => setTranscripts(t.filter(x => x.status === 'Ready'))).catch(() => setTranscripts([]))
  }
  useEffect(load, [study.id])
  useEffect(() => {
    setAgreement(null); setAgreementNote(null)
    if (!selectedCoder) return
    qualApi.agreement(study.id, selectedCoder).then(setAgreement).catch(e => setAgreementNote(errorMessage(e)))
  }, [study.id, selectedCoder, completions.length])

  if (!study.agreementApplies) {
    return <Notice className="mt-6">Agreement between coders is not used for {METHOD_LABELS[study.method].toLowerCase()}, where the analysis is your interpretation. It is available for codebook thematic analysis, content analysis and framework analysis.</Notice>
  }
  const seconds = (coders ?? []).filter(c => c.kind !== 'Owner')
  const finished = (transcriptId: string, coderId: string) => completions.some(c => c.transcriptId === transcriptId && c.coderId === coderId && c.current)
  const owner = (coders ?? []).find(c => c.kind === 'Owner')

  return (
    <>
      {dialog}
      {error && <Notice tone="error" className="mt-6">{error}</Notice>}
      <Section title="Coders" id="qa-coders">
        {coders === null ? <Skeleton lines={2} tone="light" /> : (
          <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 text-[14px]">
            {coders.length === 0 && <li className="px-3 py-2 text-slate-700">You are the only coder. Your own row appears once you code something.</li>}
            {coders.map(c => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span><span className="font-semibold text-slate-900">{c.label}</span> <span className="text-slate-700">{c.kind === 'Owner' ? '(you)' : c.kind === 'Import' ? '(imported from a file)' : c.email}</span></span>
                <span className="flex items-center gap-3 text-[13px] text-slate-700">
                  {c.passages} passage{c.passages === 1 ? '' : 's'} · finished {c.transcriptsFinished} transcript{c.transcriptsFinished === 1 ? '' : 's'}
                  {c.kind !== 'Owner' && <DangerButton onClick={async () => { if (await ask({ title: `Remove ${c.label}?`, message: 'Their coding is deleted and they lose access to this study.', confirmLabel: 'Remove coder', tone: 'danger' })) { try { await qualApi.removeCoder(c.id); load() } catch (e) { setError(errorMessage(e)) } } }}>Remove</DangerButton>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Invite a second coder" id="qa-invite"><Invite studyId={study.id} onInvited={load} /></Section>
      <Section title="Or import a coder's work from a file" id="qa-import-coder"><ImportCoder studyId={study.id} onImported={load} /></Section>

      {seconds.length > 0 && transcripts.length > 0 && (
        <Section title="Who has finished coding" id="qa-finished">
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-[14px]">
              <caption className="sr-only">Finished marks per transcript and coder</caption>
              <thead className="bg-slate-50 text-[13px] text-slate-800"><tr><th scope="col" className="px-3 py-2">Transcript</th>{owner && <th scope="col" className="px-3 py-2">{owner.label} (you)</th>}{seconds.map(s => <th key={s.id} scope="col" className="px-3 py-2">{s.label}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-200">
                {transcripts.map(t => (
                  <tr key={t.id}>
                    <th scope="row" className="px-3 py-2 font-medium text-slate-900">{t.label}</th>
                    {owner && <td className="px-3 py-2">{finished(t.id, owner.id) ? 'Finished' : 'Not yet'}</td>}
                    {seconds.map(s => <td key={s.id} className="px-3 py-2">{finished(t.id, s.id) ? 'Finished' : 'Not yet'}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-[12px] text-slate-700">Each coder marks a transcript finished on its coding screen. Changing your coding afterwards takes the mark back.</p>
        </Section>
      )}

      {seconds.length > 0 && (
        <Section title="Agreement" id="qa-agreement" actions={seconds.length > 1 ? (
          <label className="flex items-center gap-2 text-[13px]">Compare with
            <select value={selectedCoder} onChange={e => setSelectedCoder(e.target.value)} className="rounded border border-slate-300 px-2 py-1">{seconds.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
          </label>) : undefined}>
          {agreementNote ? <Notice>{agreementNote}</Notice> : agreement === null ? <Skeleton lines={3} tone="light" /> : <AgreementView a={agreement} />}
        </Section>
      )}
    </>
  )
}

function Invite({ studyId, onInvited }: { studyId: string; onInvited: () => void }) {
  const [email, setEmail] = useState('')
  const [ack, setAck] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setMessage(null)
    if (!ack) { setMessage({ tone: 'error', text: 'Confirm the statement first.' }); return }
    setBusy(true)
    try { const c = await qualApi.inviteCoder(studyId, email.trim()); setEmail(''); setAck(false); setMessage({ tone: 'success', text: `${c.label} can now open this study from their own Qualitative Analysis page.` }); onInvited() }
    catch (err) { setMessage({ tone: 'error', text: errorMessage(err, 'The invitation failed.') }) }
    finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="max-w-2xl space-y-3 rounded-xl border border-slate-200 p-4" noValidate>
      <p className="text-[13px] text-slate-800">The second coder needs their own account. They will see your confirmed, de-identified transcripts and your codebook, and code with them. They will not see your coding, your memos, your quotes or your settings, and you will not see their coding until you compare.</p>
      <div><label htmlFor="qa-invite-email" className={labelClass}>Their account email</label><input id="qa-invite-email" type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} autoComplete="off" /></div>
      <label className="flex items-start gap-2 text-[13px] text-slate-900">
        <input type="checkbox" className="mt-0.5" checked={ack} onChange={e => setAck(e.target.checked)} />
        <span>My ethics approval and my participants’ consent allow this person to read the de-identified transcripts.</span>
      </label>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <PrimaryButton type="submit" disabled={busy || !email.trim()}>{busy ? 'Inviting…' : 'Invite'}</PrimaryButton>
    </form>
  )
}

function AgreementView({ a }: { a: QualAgreement }) {
  if (a.transcriptsCompared === 0) return <Notice>Nothing to compare yet: no transcript has been marked finished by both {a.coderALabel} and {a.coderBLabel}. {a.transcriptsWaiting > 0 ? `${a.transcriptsWaiting} confirmed transcript${a.transcriptsWaiting === 1 ? ' is' : 's are'} waiting.` : ''}</Notice>
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-slate-800">{a.note}</p>
      <dl className="grid gap-3 sm:grid-cols-4">
        {([['Transcripts compared', String(a.transcriptsCompared)], ['Participant turns', String(a.units)], ['Observed agreement (all codes)', pct(a.pooledPercentAgreement)], ["Cohen's kappa (all codes)", fixed(a.pooledKappa)]] as const).map(([k, v]) => (
          <div key={k} className="rounded-xl border border-slate-200 p-3"><dt className="text-[13px] text-slate-700">{k}</dt><dd className="text-[20px] font-semibold text-slate-900">{v}</dd></div>
        ))}
      </dl>
      {a.pooledUndefinedReason && <Notice>{a.pooledUndefinedReason}</Notice>}
      {a.transcriptsWaiting > 0 && <p className="text-[13px] text-slate-700">{a.transcriptsWaiting} other confirmed transcript{a.transcriptsWaiting === 1 ? ' is' : 's are'} not included yet.</p>}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-[14px]">
          <caption className="sr-only">Agreement per code</caption>
          <thead className="bg-slate-50 text-[13px] text-slate-800"><tr>
            <th scope="col" className="px-3 py-2">Code</th><th scope="col" className="px-3 py-2">Both</th><th scope="col" className="px-3 py-2">{a.coderALabel} only</th><th scope="col" className="px-3 py-2">{a.coderBLabel} only</th>
            <th scope="col" className="px-3 py-2">Neither</th><th scope="col" className="px-3 py-2">Agreement</th><th scope="col" className="px-3 py-2">Kappa</th><th scope="col" className="px-3 py-2">Alpha</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-200">
            {a.codes.map(c => (
              <tr key={c.codeId}>
                <th scope="row" className="px-3 py-2 font-medium text-slate-900">{c.name}{c.undefinedReason && <p className="text-[12px] font-normal text-slate-700">{c.undefinedReason}</p>}</th>
                <td className="px-3 py-2">{c.both}</td><td className="px-3 py-2">{c.onlyA}</td><td className="px-3 py-2">{c.onlyB}</td><td className="px-3 py-2">{c.neither}</td>
                <td className="px-3 py-2">{pct(c.percentAgreement)}</td><td className="px-3 py-2">{fixed(c.kappa)}</td><td className="px-3 py-2">{fixed(c.alpha)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {a.codes.some(c => c.disagreements.length > 0) && (
        <details className="rounded-xl border border-slate-200 p-3 text-[13px]">
          <summary className="cursor-pointer font-medium text-slate-900">Turns where the coders differ ({a.codes.reduce((n, c) => n + c.disagreements.length, 0)})</summary>
          <ul className="mt-2 space-y-1">
            {a.codes.flatMap(c => c.disagreements.map(d => (
              <li key={c.codeId + d.segmentId}>{c.name}: {d.transcriptLabel}, turn {d.ordinal + 1} ({d.pseudonym ?? 'participant'}), coded by {d.codedBy}</li>
            )))}
          </ul>
        </details>
      )}
    </div>
  )
}
