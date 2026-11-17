import { useEffect, useMemo, useState } from 'react'
import { errorMessage, qualApi, type ListedClass, type QualListedItem, type QualReview, type SpeakerRole } from '../../api/qualitativeAnalysis'
import { Skeleton } from '../ui/Skeleton'
import { useConfirm } from '../ui/ConfirmDialog'
import { Notice, PrimaryButton, SecondaryButton, Section, inputClass, labelClass } from './ui'

const CLASSES: { value: ListedClass; label: string }[] = [
  { value: 'PERSON', label: 'Person' }, { value: 'ORG', label: 'Organisation' }, { value: 'PLACE', label: 'Place' }, { value: 'ROLE', label: 'Role or job title' }, { value: 'OTHER', label: 'Other' },
]
const ROLES: SpeakerRole[] = ['Participant', 'Interviewer', 'Moderator']

/**
 * De-identification review. Code replaces what is listed and anything shaped like an email, phone, web address,
 * handle or ID number. Nothing is sent to any model. Confirming deletes the imported text and keeps only the
 * de-identified version.
 */
export function ReviewPanel({ transcriptId, onConfirmed }: { transcriptId: string; onConfirmed: () => void }) {
  const [review, setReview] = useState<QualReview | null>(null)
  const [roles, setRoles] = useState<Record<string, SpeakerRole | ''>>({})
  const [listed, setListed] = useState<QualListedItem[]>([])
  const [longNumbers, setLongNumbers] = useState(true)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState<'save' | 'confirm' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { confirm: ask, dialog } = useConfirm()

  const adopt = (r: QualReview) => {
    setReview(r)
    setRoles(Object.fromEntries(r.speakers.map(s => [s.label, s.role ?? (r.choices?.speakers.find(c => c.label === s.label)?.role ?? '')])))
    setListed(r.choices?.listed.map(l => ({ text: l.text, class: l.class, speakerLabel: l.speakerLabel ?? null })) ?? [])
    setLongNumbers(r.choices?.replaceLongNumbers ?? true)
    setDirty(false)
  }
  useEffect(() => { qualApi.getReview(transcriptId).then(adopt).catch(e => setError(errorMessage(e, 'The review could not be loaded.'))) }, [transcriptId])

  const allAssigned = review !== null && review.speakers.every(s => roles[s.label])
  const hasParticipant = Object.values(roles).includes('Participant')
  const canConfirm = review !== null && !dirty && review.textIsDeidentified && review.speakersAssigned && busy === null

  const save = async () => {
    if (!review) return
    setError(null)
    if (review.speakers.length > 0 && !allAssigned) { setError('Say who each speaker is first.'); return }
    const clean = listed.map(l => ({ ...l, text: l.text.trim() })).filter(l => l.text.length > 0)
    setBusy('save')
    try {
      adopt(await qualApi.saveReview(transcriptId, { speakers: review.speakers.map(s => ({ label: s.label, role: roles[s.label] as SpeakerRole })), listed: clean, replaceLongNumbers: longNumbers }))
    } catch (e) { setError(errorMessage(e, 'The choices could not be saved.')) } finally { setBusy(null) }
  }

  const confirm = async () => {
    if (!(await ask({ title: 'Confirm de-identification?', message: 'The imported text is deleted and only this de-identified version is kept. You can still replace more text later, while coding.', confirmLabel: 'Confirm', tone: 'warning' }))) return
    setBusy('confirm'); setError(null)
    try { await qualApi.confirm(transcriptId); onConfirmed() }
    catch (e) { setError(errorMessage(e, 'The transcript could not be confirmed.')); setBusy(null) }
  }

  const update = (i: number, patch: Partial<QualListedItem>) => { setListed(l => l.map((x, j) => j === i ? { ...x, ...patch } : x)); setDirty(true) }
  // A speaker label that was replaced at the start of each turn can still stand elsewhere (a header line such as "Participant: P07"),
  // where it would let a reader link the kept text back to the original. Names and labels only; no transcript text is shown.
  const leakedLabels = useMemo(() => {
    if (!review?.textIsDeidentified) return []
    const standsAlone = (label: string) => {
      const escaped = label.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&')
      return new RegExp('(?<![\\p{L}\\p{N}])' + escaped + '(?![\\p{L}\\p{N}])', 'u').test(review.text)
    }
    return review.speakers.filter(s => s.pseudonym && s.pseudonym !== s.label && standsAlone(s.label)).map(s => s.label)
  }, [review])
  const participantLabels = useMemo(() => review?.speakers.filter(s => roles[s.label] === 'Participant').map(s => s.label) ?? [], [review, roles])

  if (!review) return error ? <Notice tone="error" className="mt-4">{error}</Notice> : <div className="mt-4"><Skeleton lines={8} tone="light" /></div>

  return (
    <>
      {dialog}
      <Notice className="mt-4" title="Step 1 of 2: remove identifiers">
        Nothing has been sent anywhere. Say who each speaker is, list the names and places to replace, then preview. Emails, phone numbers, web addresses, social handles and ID numbers are replaced without being listed.
      </Notice>

      <Section title="Speakers" id="qa-speakers">
        {review.speakers.length === 0 ? (
          <Notice tone="warning">No speaker labels were found. Each paragraph will be treated as one unit with no speaker, so counts by participant will not be available. To fix this, start each turn on a new line with a label such as <code>P1:</code> and import again.</Notice>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-[14px]">
              <thead className="bg-slate-50 text-[13px] text-slate-800"><tr><th scope="col" className="px-3 py-2">Label in the text</th><th scope="col" className="px-3 py-2">Turns</th><th scope="col" className="px-3 py-2">Words</th><th scope="col" className="px-3 py-2">Who this is</th><th scope="col" className="px-3 py-2">Shown as</th></tr></thead>
              <tbody className="divide-y divide-slate-200">
                {review.speakers.map(s => (
                  <tr key={s.label}>
                    <td className="px-3 py-2 font-medium text-slate-900 [overflow-wrap:anywhere]">{s.label}</td>
                    <td className="px-3 py-2 text-slate-800">{s.turns}</td>
                    <td className="px-3 py-2 text-slate-800">{s.words.toLocaleString()}</td>
                    <td className="px-3 py-2">
                      <label className="sr-only" htmlFor={`qa-role-${s.label}`}>Role of {s.label}</label>
                      <select id={`qa-role-${s.label}`} value={roles[s.label] ?? ''} onChange={e => { setRoles(r => ({ ...r, [s.label]: e.target.value as SpeakerRole })); setDirty(true) }} className={inputClass}>
                        <option value="">Choose…</option>
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-slate-800">{s.pseudonym ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {review.speakers.length > 0 && allAssigned && !hasParticipant && <Notice tone="warning" className="mt-2">No speaker is a participant, so nothing here can be coded as participant evidence.</Notice>}
      </Section>

      <Section title="Names and places to replace" id="qa-listed" actions={<SecondaryButton onClick={() => { setListed(l => [...l, { text: '', class: 'PERSON', speakerLabel: null }]); setDirty(true) }}>Add a name or place</SecondaryButton>}>
        <p className="mb-2 text-[13px] text-slate-800">List each name the way it is written. A person’s first name and surname are also replaced on their own, with or without a title such as Mr or Dr. A speaker label that is a person’s name is replaced by their pseudonym.</p>
        {listed.length === 0 ? <p className="text-[14px] text-slate-700">Nothing listed yet.</p> : (
          <ul className="space-y-2">
            {listed.map((l, i) => (
              <li key={i} className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 p-2">
                <div className="min-w-[12rem] flex-1">
                  <label htmlFor={`qa-listed-${i}`} className={labelClass}>Text</label>
                  <input id={`qa-listed-${i}`} value={l.text} maxLength={120} onChange={e => update(i, { text: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label htmlFor={`qa-listed-class-${i}`} className={labelClass}>Kind</label>
                  <select id={`qa-listed-class-${i}`} value={l.class} onChange={e => update(i, { class: e.target.value as ListedClass })} className={inputClass}>
                    {CLASSES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                {l.class === 'PERSON' && participantLabels.length > 0 && (
                  <div>
                    <label htmlFor={`qa-listed-speaker-${i}`} className={labelClass}>This person is the speaker</label>
                    <select id={`qa-listed-speaker-${i}`} value={l.speakerLabel ?? ''} onChange={e => update(i, { speakerLabel: e.target.value || null })} className={inputClass}>
                      <option value="">Not a speaker</option>
                      {participantLabels.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                )}
                <SecondaryButton onClick={() => { setListed(x => x.filter((_, j) => j !== i)); setDirty(true) }} aria-label={`Remove ${l.text || 'this row'}`}>Remove</SecondaryButton>
              </li>
            ))}
          </ul>
        )}
        <label className="mt-3 flex items-start gap-2 text-[14px] text-slate-900">
          <input type="checkbox" className="mt-1" checked={longNumbers} onChange={e => { setLongNumbers(e.target.checked); setDirty(true) }} />
          <span>Also replace other long numbers (7 digits or more), such as student, account or meter numbers.</span>
        </label>
        <div className="mt-3"><PrimaryButton onClick={save} disabled={busy !== null}>{busy === 'save' ? 'Saving…' : review.textIsDeidentified ? 'Save and preview again' : 'Save and preview'}</PrimaryButton></div>
      </Section>

      <Section title={review.textIsDeidentified ? 'Preview: the text as it will be kept' : 'The text as imported'} id="qa-preview">
        {review.textIsDeidentified && review.replacements.length > 0 && (
          <p className="mb-2 text-[13px] text-slate-800">Replaced: {review.replacements.map(r => `${r.token} ×${r.count}`).join(', ')}</p>
        )}
        {leakedLabels.length > 0 && (
          <Notice tone="warning" className="mb-2" title="A speaker label still appears in the text">
            {leakedLabels.join(', ')} {leakedLabels.length === 1 ? 'is' : 'are'} replaced at the start of each turn but not elsewhere, for example in a header line. List {leakedLabels.length === 1 ? 'it' : 'each'} above, choose the speaker under “This person is the speaker”, then save and preview again.
          </Notice>
        )}
        {review.residual.length > 0 && (
          <Notice tone="warning" className="mb-2" title="Still looks like an identifier">
            {review.residual.map(r => `${r.count} × ${r.class.toLowerCase()}`).join(', ')}. Find it in the text and add it to the list above.
          </Notice>
        )}
        {review.notes.map(n => <Notice key={n} className="mb-2">{n}</Notice>)}
        <pre className="max-h-[32rem] overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-4 font-sans text-[14px] leading-relaxed text-slate-900">{review.text}</pre>
      </Section>

      {error && <Notice tone="error" className="mt-4">{error}</Notice>}
      <Section title="Step 2 of 2: confirm" id="qa-confirm">
        <p className="mb-2 text-[13px] text-slate-800">
          {dirty ? 'You have changes that are not saved. Save and preview them first.' : !review.textIsDeidentified ? 'Save and preview first.' : !review.speakersAssigned ? 'Say who each speaker is first.' : 'Read the preview. When you confirm, the imported text is deleted and this version is the one you code.'}
        </p>
        <PrimaryButton onClick={confirm} disabled={!canConfirm}>{busy === 'confirm' ? 'Confirming…' : 'Confirm de-identification'}</PrimaryButton>
      </Section>
    </>
  )
}
