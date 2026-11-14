import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { feedbackTrackerApi } from '../../api/feedbackTracker'
import {
  RECHECK_CREDITS, describeDraftCheck, failureMessage, matchesFilter, progress,
  type FeedbackItem, type FeedbackThread, type ItemFilter, type ItemStatus,
} from '../../lib/feedbackTracker'
import { cn, formatShortDate } from '../../lib/utils'
import { DraftInput, EMPTY_DRAFT, draftError, type DraftValue } from './DraftInput'
import { ItemCard } from './ItemCard'

const FILTERS: { id: ItemFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'todo', label: 'Not done' },
  { id: 'attention', label: 'Check found a problem' },
]

interface Props {
  thread: FeedbackThread
  onChange: (thread: FeedbackThread) => void
  onDeleted: () => void
}

export function ThreadView({ thread, onChange, onDeleted }: Props) {
  const [filter, setFilter] = useState<ItemFilter>('all')
  const [busyItem, setBusyItem] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [draft, setDraft] = useState<DraftValue>(EMPTY_DRAFT)
  const [draftSubmitted, setDraftSubmitted] = useState(false)
  const [checking, setChecking] = useState(false)
  const [draftFailure, setDraftFailure] = useState<string | null>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  const p = progress(thread.items)
  const latest = thread.drafts[thread.drafts.length - 1]
  const shown = thread.items.filter(i => matchesFilter(i, filter))
  const draftProblem = draftError(draft)

  const patch = async (item: FeedbackItem, change: { status?: ItemStatus; studentNote?: string; actionText?: string }) => {
    setBusyItem(item.id); setFailure(null); setMessage(null)
    try {
      onChange(await feedbackTrackerApi.patchItem(item.id, change))
      setMessage(`Item ${item.ordinal} saved.`)
      return true
    } catch (err) {
      setFailure(failureMessage(err, 'save'))
      return false
    } finally {
      setBusyItem(null)
    }
  }

  const removeItem = async (item: FeedbackItem) => {
    if (!window.confirm(`Remove item ${item.ordinal} from the checklist? Use this for something that is not a request for a change.`)) return
    setBusyItem(item.id); setFailure(null); setMessage(null)
    try {
      onChange(await feedbackTrackerApi.deleteItem(item.id))
      setMessage(`Item ${item.ordinal} removed.`)
    } catch (err) {
      setFailure(failureMessage(err, 'save'))
    } finally {
      setBusyItem(null)
    }
  }

  const submitDraft = async (e: FormEvent) => {
    e.preventDefault()
    setDraftSubmitted(true); setDraftFailure(null)
    if (draftProblem) { document.getElementById('ft-revised-text')?.focus(); return }
    setChecking(true)
    try {
      const next = draft.file
        ? await feedbackTrackerApi.addDraftFromFile(thread.id, draft.file)
        : await feedbackTrackerApi.addDraft(thread.id, draft.text, draft.textFileName ?? undefined)
      onChange(next)
      setDraft(EMPTY_DRAFT); setDraftSubmitted(false); setFilter('all')
      requestAnimationFrame(() => resultRef.current?.focus())
    } catch (err) {
      setDraftFailure(failureMessage(err, 'recheck'))
    } finally {
      setChecking(false)
    }
  }

  const deleteThread = async () => {
    setDeleting(true); setFailure(null)
    try {
      await feedbackTrackerApi.deleteThread(thread.id)
      onDeleted()
    } catch (err) {
      setFailure(failureMessage(err, 'delete'))
      setDeleting(false)
    }
  }

  return (
    <div>
      <Link to="/app/feedback-tracker" className="inline-flex items-center gap-1 rounded text-[13px] font-semibold text-purple-deep underline outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40">
        <ArrowLeft size={14} aria-hidden="true" /> All checklists
      </Link>

      <header className="mt-3">
        <h2 className="text-[20px] font-semibold leading-snug text-slate-900">{thread.title}</h2>
        <p className="mt-1 text-[14px] text-slate-800" data-testid="ft-progress">
          <span className="font-semibold">{p.done} of {p.total} marked done</span>
          {p.inProgress > 0 ? ` · ${p.inProgress} in progress` : ''}{p.disputed > 0 ? ` · ${p.disputed} to discuss` : ''}
          {' · '}version {latest.version} of the draft
        </p>
        <div className="mt-2 h-2 max-w-md overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label="Items marked done" aria-valuemin={0} aria-valuemax={p.total} aria-valuenow={p.done}>
          <div className="h-full rounded-full bg-emerald-600" style={{ width: `${p.total === 0 ? 0 : (p.done / p.total) * 100}%` }} />
        </div>
        {p.doneButUnconfirmed > 0 ? (
          <p className="mt-2 text-[13px] font-medium text-amber-900">
            {p.doneButUnconfirmed} {p.doneButUnconfirmed === 1 ? 'item is' : 'items are'} marked done although the last check did not confirm {p.doneButUnconfirmed === 1 ? 'it' : 'them'}.
          </p>
        ) : null}
        <p className="mt-3 max-w-3xl rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[13px] text-slate-800">
          The check compares two versions of your draft and can be wrong. It never marks an item done; you do. Read the change yourself before you tell your supervisor it is fixed.
        </p>
      </header>

      {/* Latest draft: how it was checked, and any figures that disagree. Focused after a re-check so the outcome is announced. */}
      <div ref={resultRef} tabIndex={-1} className="mt-5 rounded-xl border border-slate-200 bg-white p-4 outline-none" aria-label={`Version ${latest.version} of the draft`}>
        <h3 className="text-[14px] font-semibold text-slate-900">
          Version {latest.version}{latest.fileName ? ` · ${latest.fileName}` : ''} <span className="font-normal text-slate-700">· added {formatShortDate(latest.createdAt)} · {latest.charCount.toLocaleString('en-GB')} characters</span>
        </h3>
        <p className="mt-1 text-[14px] text-slate-800">{describeDraftCheck(latest)}</p>
        {latest.numberWarnings.length > 0 ? (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900" data-testid="ft-number-warnings">
            <p className="flex items-center gap-1.5 text-[14px] font-semibold"><AlertTriangle size={16} aria-hidden="true" /> Figures that disagree in this draft</p>
            <p className="mt-1 text-[13px]">The same quantity is stated differently in different places. This is a text comparison: check each one, some may be different things.</p>
            <ul className="mt-1.5 space-y-1 text-[13.5px]">
              {latest.numberWarnings.map(w => (
                <li key={w.quantity}>
                  <span className="font-semibold">{w.quantity}: </span>
                  {w.values.map(v => `${v.value}${v.sections.length > 0 ? ` (${v.sections.join(', ')})` : ''}`).join(' · ')}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <form onSubmit={submitDraft} noValidate aria-label="Add a revised draft" className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-[15px] font-semibold text-slate-900">Check a revised draft</h3>
        <div className="mt-2">
          <DraftInput idPrefix="ft-revised" label={`Version ${latest.version + 1} of the draft`} value={draft} onChange={setDraft} disabled={checking}
            hint={`It is compared with version ${latest.version}, and each item is checked against what changed. Use the same file type as before where you can.`}
            error={draftSubmitted ? draftProblem : null} />
        </div>
        {draftFailure ? <p role="alert" className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-[14px] text-red-800">{draftFailure}</p> : null}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="submit" disabled={checking}
            className="min-h-10 rounded-lg bg-purple-accent px-4 text-[14px] font-semibold text-white outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-purple-accent/50 focus-visible:ring-offset-2 disabled:opacity-60">
            {checking ? 'Checking the draft…' : `Check this draft (up to ${RECHECK_CREDITS} credits)`}
          </button>
          <p className="text-[13px] text-slate-700" aria-live="polite">
            {checking ? 'This can take a minute. Keep this page open.' : 'Free when nothing relevant changed. You are charged only if the check completes.'}
          </p>
        </div>
      </form>

      <section aria-label="Checklist" className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[16px] font-semibold text-slate-900">Checklist</h3>
          <div role="group" aria-label="Show items" className="flex flex-wrap gap-1.5">
            {FILTERS.map(f => (
              <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}
                className={cn('min-h-8 rounded-full border px-3 text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40',
                  filter === f.id ? 'border-purple-accent bg-purple-accent text-white' : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50')}>
                {f.label} ({thread.items.filter(i => matchesFilter(i, f.id)).length})
              </button>
            ))}
          </div>
        </div>
        <p className="sr-only" role="status" aria-live="polite">{message ?? ''}</p>
        {failure ? <p role="alert" className="mt-2 rounded-lg border border-red-300 bg-red-50 p-3 text-[14px] text-red-800">{failure}</p> : null}
        {shown.length === 0 ? (
          <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-[14px] text-slate-800">
            {thread.items.length === 0 ? 'Every item has been removed from this checklist.' : 'No items match this filter.'}
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {shown.map(item => (
              <ItemCard key={item.id} item={item} busy={busyItem === item.id || checking}
                onPatch={change => patch(item, change)} onDelete={() => { void removeItem(item) }} />
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Stored data" className="mt-8 border-t border-slate-200 pt-4 text-[13px] text-slate-700">
        <p>
          Stored encrypted. Deleted for good on {formatShortDate(thread.purgeAfter)} if you do not use this checklist before then ({thread.retentionDays} days without activity).
        </p>
        {confirmDelete ? (
          <div role="alertdialog" aria-labelledby="ft-delete-title" className="mt-2 rounded-lg border border-red-300 bg-red-50 p-3 text-red-900">
            <p id="ft-delete-title" className="text-[14px] font-semibold">Delete this checklist, the comments and all {thread.drafts.length} draft {thread.drafts.length === 1 ? 'version' : 'versions'}?</p>
            <p className="mt-0.5">This cannot be undone. Nothing is kept.</p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => { void deleteThread() }} disabled={deleting} className="rounded-lg bg-red-700 px-3 py-1.5 text-[13px] font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-red-700/50 focus-visible:ring-offset-1 disabled:opacity-60">{deleting ? 'Deleting…' : 'Delete everything'}</button>
              <button type="button" onClick={() => setConfirmDelete(false)} disabled={deleting} className="rounded-lg border border-slate-400 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40">Keep it</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className="mt-1.5 rounded font-semibold text-red-700 underline outline-none focus-visible:ring-2 focus-visible:ring-red-700/40">Delete this checklist now</button>
        )}
      </section>
    </div>
  )
}
