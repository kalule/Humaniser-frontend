import { useState, type FormEvent } from 'react'
import { authorshipEvidenceApi, type UsageEntryInput } from '../../api/authorshipEvidence'
import {
  ASSISTANCE_TYPES, OUTCOMES, assistanceLabel, failureMessage, formatDateTime, n, outcomeLabel, usageInstant,
  type EvidenceDocument, type Outcome, type UsageEntry,
} from '../../lib/authorshipEvidence'
import { Empty, ErrorNote, LabelBadge, Note, field, labelText, linkButton, primaryButton, secondaryButton } from './ui'

const today = () => new Date().toISOString().slice(0, 10)

/** The form for an entry the student writes themselves: a new one, or a correction of an existing one. */
function EntryForm({ idPrefix, initial, submitLabel, busy, onSubmit, onCancel }: {
  idPrefix: string
  initial?: UsageEntry
  submitLabel: string
  busy: boolean
  onSubmit: (input: UsageEntryInput) => void
  onCancel: () => void
}) {
  const [tool, setTool] = useState(initial?.tool ?? '')
  const [type, setType] = useState(initial?.assistanceType ?? 'Other')
  const [date, setDate] = useState(initial ? initial.occurredAt.slice(0, 10) : today())
  const [section, setSection] = useState(initial?.section ?? '')
  const [words, setWords] = useState(initial ? String(initial.wordsAffected) : '')
  const [outcome, setOutcome] = useState<Outcome>(initial?.outcome ?? 'NotRecorded')
  const [note, setNote] = useState('')
  const [problem, setProblem] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const count = words.trim() === '' ? 0 : Number(words)
    if (tool.trim().length === 0) { setProblem('Name the tool, for example "ChatGPT" or "Grammarly".'); document.getElementById(`${idPrefix}-tool`)?.focus(); return }
    if (!Number.isInteger(count) || count < 0 || count > 1_000_000) { setProblem('Words affected must be a whole number between 0 and 1,000,000.'); document.getElementById(`${idPrefix}-words`)?.focus(); return }
    if (date > today()) { setProblem('The date of use cannot be in the future.'); document.getElementById(`${idPrefix}-date`)?.focus(); return }
    setProblem(null)
    onSubmit({ tool: tool.trim(), assistanceType: type, occurredAt: usageInstant(date), section: section.trim() || null, wordsAffected: count, outcome, note: note.trim() || null })
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${idPrefix}-tool`} className={labelText}>Tool</label>
          <input id={`${idPrefix}-tool`} value={tool} onChange={e => setTool(e.target.value)} maxLength={60} disabled={busy} placeholder="For example: ChatGPT" className={field} />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-type`} className={labelText}>What it helped with</label>
          <select id={`${idPrefix}-type`} value={type} onChange={e => setType(e.target.value)} disabled={busy} className={field}>
            {ASSISTANCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`${idPrefix}-date`} className={labelText}>Date of use</label>
          <input id={`${idPrefix}-date`} type="date" value={date} max={today()} onChange={e => setDate(e.target.value)} disabled={busy} className={field} />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-words`} className={labelText}>Words affected <span className="font-normal text-slate-700">(your estimate)</span></label>
          <input id={`${idPrefix}-words`} inputMode="numeric" value={words} onChange={e => setWords(e.target.value)} disabled={busy} placeholder="0" className={field} />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-section`} className={labelText}>Section <span className="font-normal text-slate-700">(optional)</span></label>
          <input id={`${idPrefix}-section`} value={section} onChange={e => setSection(e.target.value)} maxLength={200} disabled={busy} placeholder="For example: 2.3 Methods" className={field} />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-outcome`} className={labelText}>What you did with the result</label>
          <select id={`${idPrefix}-outcome`} value={outcome} onChange={e => setOutcome(e.target.value as Outcome)} disabled={busy} className={field}>
            {OUTCOMES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-note`} className={labelText}>Note <span className="font-normal text-slate-700">(optional)</span></label>
        <textarea id={`${idPrefix}-note`} rows={2} value={note} onChange={e => setNote(e.target.value)} maxLength={2000} disabled={busy} className={field} placeholder="For example: used it to check the tense in my methods section" />
      </div>
      {problem ? <p role="alert" className="text-[13px] font-medium text-red-700">{problem}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className={primaryButton}>{busy ? 'Saving…' : submitLabel}</button>
        <button type="button" onClick={onCancel} disabled={busy} className={secondaryButton}>Cancel</button>
        <span className="text-[13px] text-slate-700">Saved as "User supplied": your own account, not something the platform saw.</span>
      </div>
    </form>
  )
}

/**
 * The AI usage register for one document. Entries the platform recorded cannot be edited or removed one by one;
 * the student can add their own, say what they did with a result, and correct an entry (the original is kept).
 */
export function RegisterTab({ doc, onReload }: { doc: EvidenceDocument; onReload: () => Promise<void> }) {
  const [adding, setAdding] = useState(false)
  const [correcting, setCorrecting] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  const run = async (action: 'save' | 'delete', work: () => Promise<unknown>) => {
    setBusy(true)
    setFailure(null)
    try {
      await work()
      await onReload()
      setAdding(false)
      setCorrecting(null)
    } catch (err) {
      setFailure(failureMessage(err, action))
    } finally {
      setBusy(false)
    }
  }

  const entries = [...doc.register].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))

  return (
    <div className="space-y-5">
      <Note>
        This lists each AI tool use tied to this document. By default only the tool, the time and the lengths are kept, not the text.
        Tools you used outside HumaniseAI are not here unless you add them.
      </Note>
      {failure ? <ErrorNote>{failure}</ErrorNote> : null}

      {entries.length === 0 ? (
        <Empty>No AI tool use is recorded for this document. That does not show that none was used: it means none was recorded here.</Empty>
      ) : (
        <ul className="space-y-3">
          {entries.map(e => (
            <li key={e.id} className={`rounded-xl border p-3 sm:p-4 ${e.corrected ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white'}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="min-w-0 text-[14px] font-semibold text-slate-900 [overflow-wrap:anywhere]">
                  {e.tool} <span className="font-normal text-slate-700">· {assistanceLabel(e.assistanceType)}</span>
                </p>
                <p className="whitespace-nowrap text-[13px] text-slate-700">{formatDateTime(e.occurredAt)}</p>
              </div>
              <p className="mt-1 text-[13px] text-slate-800">
                {n(e.wordsAffected)} words{e.section ? ` · section: ${e.section}` : ''}
                {e.evidenceLabel === 'Verified' ? ` · ${n(e.inputChars)} characters in, ${n(e.outputChars)} out` : ''}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-slate-700">
                <LabelBadge label={e.evidenceLabel} />
                {e.linkLabel === 'UserSupplied' && e.evidenceLabel === 'Verified' ? <span>Linked to this document by you</span> : null}
                {e.correctsEntryId ? <span>Correction of an earlier entry</span> : null}
                {e.corrected ? <span className="font-medium text-slate-900">Corrected by a later entry; kept for the record</span> : null}
                {e.hasFullText && e.fullTextPurgeAfter ? <span>Full text kept until {formatDateTime(e.fullTextPurgeAfter)}</span> : null}
              </div>
              {e.note ? <p className="mt-2 rounded-lg bg-slate-50 p-2 text-[13px] text-slate-900 [overflow-wrap:anywhere]"><span className="font-semibold">Your note:</span> {e.note}</p> : null}

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px]">
                <label htmlFor={`ae-outcome-${e.id}`} className="font-medium text-slate-800">What you did with the result</label>
                {e.outcomeLabel === 'Verified' ? (
                  <span className="text-slate-900">{outcomeLabel(e.outcome)} <LabelBadge label="Verified" /></span>
                ) : (
                  <>
                    <select id={`ae-outcome-${e.id}`} value={e.outcome} disabled={busy || e.corrected}
                      onChange={ev => { void run('save', () => authorshipEvidenceApi.patchEntry(e.id, { outcome: ev.target.value as Outcome })) }}
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[13px] text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/30">
                      {OUTCOMES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    {e.outcomeLabel ? <LabelBadge label={e.outcomeLabel} /> : null}
                  </>
                )}
                {!e.corrected ? <button type="button" onClick={() => { setAdding(false); setCorrecting(correcting === e.id ? null : e.id) }} className={linkButton}>Correct this entry</button> : null}
                {e.evidenceLabel === 'UserSupplied' && !e.corrected ? (
                  <button type="button" disabled={busy}
                    onClick={() => { if (window.confirm('Remove this entry you added?')) void run('delete', () => authorshipEvidenceApi.deleteEntry(e.id)) }}
                    className="rounded font-semibold text-red-700 underline outline-none focus-visible:ring-2 focus-visible:ring-red-700/40">Remove</button>
                ) : null}
              </div>

              {correcting === e.id ? (
                <div className="mt-3 rounded-lg border border-slate-300 bg-slate-50 p-3">
                  <p className="mb-2 text-[13px] text-slate-800">Your correction is added as a new entry. This one stays in the register, marked as corrected.</p>
                  <EntryForm idPrefix={`ae-correct-${e.id}`} initial={e} submitLabel="Add correction" busy={busy} onCancel={() => setCorrecting(null)}
                    onSubmit={input => { void run('save', () => authorshipEvidenceApi.correctEntry(e.id, input)) }} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <section aria-labelledby="ae-add-title" className="rounded-xl border border-slate-300 bg-slate-50 p-3 sm:p-4">
          <h3 id="ae-add-title" className="mb-2 text-[15px] font-semibold text-slate-900">Add an AI tool use</h3>
          <EntryForm idPrefix="ae-add" submitLabel="Add to register" busy={busy} onCancel={() => setAdding(false)}
            onSubmit={input => { void run('save', () => authorshipEvidenceApi.addEntry({ ...input, documentId: doc.documentId })) }} />
        </section>
      ) : (
        <button type="button" onClick={() => { setCorrecting(null); setAdding(true) }} className={secondaryButton}>Add an AI tool use the platform did not record</button>
      )}
    </div>
  )
}
