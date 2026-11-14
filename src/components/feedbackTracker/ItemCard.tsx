import { useState } from 'react'
import { AlertTriangle, CheckCircle2, CircleDashed, HelpCircle, Pencil, Trash2, XCircle } from 'lucide-react'
import { STATUS_LABELS, checkDisplay, type CheckTone, type FeedbackItem, type ItemStatus } from '../../lib/feedbackTracker'
import { cn } from '../../lib/utils'

const TONE: Record<CheckTone, { box: string; icon: typeof CheckCircle2 }> = {
  green: { box: 'border-emerald-300 bg-emerald-50 text-emerald-900', icon: CheckCircle2 },
  amber: { box: 'border-amber-300 bg-amber-50 text-amber-900', icon: AlertTriangle },
  red: { box: 'border-red-300 bg-red-50 text-red-900', icon: XCircle },
  grey: { box: 'border-slate-300 bg-slate-50 text-slate-800', icon: HelpCircle },
}
const STATUSES: ItemStatus[] = ['open', 'in_progress', 'addressed', 'disputed']

interface Props {
  item: FeedbackItem
  busy: boolean
  onPatch: (patch: { status?: ItemStatus; studentNote?: string; actionText?: string }) => Promise<boolean>
  onDelete: () => void
}

export function ItemCard({ item, busy, onPatch, onDelete }: Props) {
  const [editing, setEditing] = useState(false)
  const [action, setAction] = useState(item.actionText)
  const [note, setNote] = useState(item.studentNote ?? '')
  const [noteOpen, setNoteOpen] = useState(!!item.studentNote)
  const check = item.latestCheck
  const display = checkDisplay(check)
  const tone = TONE[display.tone]
  const Icon = check ? tone.icon : CircleDashed
  const id = `ft-item-${item.ordinal}`
  // Marked done by the student while the check says otherwise: say so next to the status, without changing it.
  const disagrees = item.status === 'addressed' && check !== null && display.tone !== 'green'

  const saveAction = async () => {
    const text = action.trim()
    if (!text || text === item.actionText) { setAction(item.actionText); setEditing(false); return }
    if (await onPatch({ actionText: text })) setEditing(false)
  }
  const saveNote = () => { if (note.trim() !== (item.studentNote ?? '')) void onPatch({ studentNote: note }) }

  return (
    <li id={id} aria-labelledby={`${id}-title`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-600">
            Item {item.ordinal}{item.draftAnchor ? <span className="font-medium normal-case tracking-normal"> · {item.draftAnchor}</span> : null}
          </p>
          {editing ? (
            <div className="mt-1">
              <label htmlFor={`${id}-action`} className="sr-only">What to do for item {item.ordinal}</label>
              <textarea id={`${id}-action`} value={action} onChange={e => setAction(e.target.value)} rows={2} maxLength={1000} disabled={busy}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[14px] text-slate-900 outline-none focus:border-purple-accent focus-visible:ring-2 focus-visible:ring-purple-accent/30" />
              <div className="mt-1.5 flex gap-2">
                <button type="button" onClick={() => { void saveAction() }} disabled={busy || !action.trim()} className="rounded-lg bg-purple-accent px-3 py-1.5 text-[13px] font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/50 focus-visible:ring-offset-1 disabled:opacity-60">Save</button>
                <button type="button" onClick={() => { setAction(item.actionText); setEditing(false) }} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[13px] font-medium text-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40">Cancel</button>
              </div>
            </div>
          ) : (
            <h3 id={`${id}-title`} className="mt-0.5 text-[15px] font-semibold leading-snug text-slate-900">{item.actionText}</h3>
          )}
        </div>
        <div className="flex items-center gap-1">
          <label htmlFor={`${id}-status`} className="sr-only">Your status for item {item.ordinal}</label>
          <select id={`${id}-status`} value={item.status} disabled={busy} onChange={e => { void onPatch({ status: e.target.value as ItemStatus }) }}
            className={cn('min-h-9 rounded-lg border px-2.5 text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40',
              item.status === 'addressed' ? 'border-emerald-400 bg-emerald-50 text-emerald-900' : 'border-slate-300 bg-white text-slate-900')}>
            {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
          {!editing ? (
            <button type="button" onClick={() => setEditing(true)} disabled={busy} aria-label={`Edit the wording of item ${item.ordinal}`} title="Edit the wording"
              className="rounded-lg p-2 text-slate-700 outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-purple-accent/40"><Pencil size={15} aria-hidden="true" /></button>
          ) : null}
          <button type="button" onClick={onDelete} disabled={busy} aria-label={`Remove item ${item.ordinal}`} title="Remove this item"
            className="rounded-lg p-2 text-slate-700 outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-purple-accent/40"><Trash2 size={15} aria-hidden="true" /></button>
        </div>
      </div>

      <blockquote className="mt-2.5 border-l-[3px] border-slate-300 pl-3 text-[14px] leading-relaxed text-slate-800">
        <span className="sr-only">Your supervisor wrote: </span>{item.sourceSpan}
      </blockquote>

      <div className={cn('mt-3 rounded-lg border p-3', tone.box)} data-check-tone={display.tone}>
        <p className="flex items-center gap-1.5 text-[14px] font-semibold">
          <Icon size={16} aria-hidden="true" className="shrink-0" />
          <span>{check ? `Check of version ${check.draftVersion}: ${display.label}` : 'Not checked yet. Add a revised draft to check this item.'}</span>
        </p>
        {check ? (
          <div className="mt-1.5 space-y-1.5 text-[13.5px] leading-relaxed">
            <p>{check.rationale}</p>
            {check.missing ? <p><span className="font-semibold">Still missing: </span>{check.missing}</p> : null}
            {check.evidenceQuote ? (
              <p>
                <span className="font-semibold">{check.quoteVerified ? 'Found in your draft: ' : 'Quoted, but not found in your draft: '}</span>
                <q className="italic">{check.evidenceQuote}</q>
              </p>
            ) : null}
            {display.cautions.length > 0 ? (
              <ul className="list-disc space-y-0.5 pl-5 font-medium">
                {display.cautions.map(c => <li key={c}>{c}</li>)}
              </ul>
            ) : null}
            {check.facts.length > 0 ? (
              <details>
                <summary className="cursor-pointer rounded font-medium underline outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40">What was checked by text search</summary>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">{check.facts.map(f => <li key={f}>{f}</li>)}</ul>
              </details>
            ) : null}
          </div>
        ) : null}
      </div>
      {disagrees ? (
        <p className="mt-2 text-[13px] font-medium text-amber-900">
          You marked this done. The check above did not confirm it; the decision is yours.
        </p>
      ) : null}

      <div className="mt-2.5">
        {noteOpen ? (
          <>
            <label htmlFor={`${id}-note`} className="mb-1 block text-[13px] font-medium text-slate-800">Your note <span className="font-normal text-slate-700">(what you changed, or why you disagree)</span></label>
            <textarea id={`${id}-note`} value={note} onChange={e => setNote(e.target.value)} onBlur={saveNote} rows={2} maxLength={2000} disabled={busy}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[14px] text-slate-900 outline-none focus:border-purple-accent focus-visible:ring-2 focus-visible:ring-purple-accent/30" />
          </>
        ) : (
          <button type="button" onClick={() => setNoteOpen(true)} className="rounded text-[13px] font-semibold text-purple-deep underline outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40">Add a note</button>
        )}
      </div>
    </li>
  )
}
