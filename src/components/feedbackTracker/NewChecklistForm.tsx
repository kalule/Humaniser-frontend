import { useRef, useState, type FormEvent } from 'react'
import { feedbackTrackerApi } from '../../api/feedbackTracker'
import {
  DOCUMENT_TYPES, EXTRACTION_CREDITS, failureMessage, validateComments,
  type DocumentType, type FeedbackThread,
} from '../../lib/feedbackTracker'
import { DraftInput, EMPTY_DRAFT, draftError, type DraftValue } from './DraftInput'

const field = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[14px] text-slate-900 outline-none placeholder:text-slate-500 focus:border-purple-accent focus-visible:ring-2 focus-visible:ring-purple-accent/30'

/** Comments + the draft they were written about -> a checklist. One paid step; nothing is checked yet. */
export function NewChecklistForm({ retentionDays, onCreated }: { retentionDays: number; onCreated: (thread: FeedbackThread) => void }) {
  const [title, setTitle] = useState('')
  const [documentType, setDocumentType] = useState<DocumentType>('Proposal')
  const [comments, setComments] = useState('')
  const [draft, setDraft] = useState<DraftValue>(EMPTY_DRAFT)
  const [consent, setConsent] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const failureRef = useRef<HTMLParagraphElement>(null)

  const commentsProblem = validateComments(comments)
  const draftProblem = draftError(draft)
  const consentProblem = consent ? null : "Confirm that you may share your supervisor's comments."

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setFailure(null)
    if (commentsProblem || draftProblem || consentProblem) {
      const first = commentsProblem ? 'ft-new-comments' : draftProblem ? 'ft-new-draft-text' : 'ft-new-consent'
      document.getElementById(first)?.focus()
      return
    }
    setBusy(true)
    try {
      const input = { title: title.trim(), documentType, commentsText: comments, consentAccepted: true }
      const thread = draft.file
        ? await feedbackTrackerApi.createFromFile(input, draft.file)
        : await feedbackTrackerApi.create(input, draft.text, draft.textFileName ?? undefined)
      onCreated(thread)
    } catch (err) {
      setFailure(failureMessage(err, 'create'))
      requestAnimationFrame(() => failureRef.current?.focus())
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate aria-label="New checklist" className="space-y-5">
      <div>
        <label htmlFor="ft-new-comments" className="mb-1 block text-[13px] font-medium text-slate-800">Your supervisor's comments</label>
        <p id="ft-new-comments-hint" className="mb-1.5 text-[13px] text-slate-700">
          Paste them exactly as you received them. Each request for a change becomes one item, in the supervisor's own words. Nothing is added.
        </p>
        <textarea id="ft-new-comments" value={comments} onChange={e => setComments(e.target.value)} disabled={busy} rows={8}
          aria-describedby={`ft-new-comments-hint${submitted && commentsProblem ? ' ft-new-comments-error' : ''}`} aria-invalid={submitted && commentsProblem ? true : undefined}
          placeholder="Paste the comments here" className={`${field} leading-relaxed`} />
        {submitted && commentsProblem ? <p id="ft-new-comments-error" role="alert" className="mt-1 text-[13px] font-medium text-red-700">{commentsProblem}</p> : null}
      </div>

      <DraftInput idPrefix="ft-new-draft" label="The draft the comments are about" value={draft} onChange={setDraft} disabled={busy}
        hint="This is version 1. Later versions are compared with it. Use the chapter or section that was commented on, not the whole thesis."
        error={submitted ? draftProblem : null} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="ft-new-title" className="mb-1 block text-[13px] font-medium text-slate-800">Name <span className="font-normal text-slate-700">(optional)</span></label>
          <input id="ft-new-title" value={title} onChange={e => setTitle(e.target.value)} disabled={busy} maxLength={300} placeholder="For example: Chapter 3, second round" className={field} />
        </div>
        <div>
          <label htmlFor="ft-new-type" className="mb-1 block text-[13px] font-medium text-slate-800">Kind of document</label>
          <select id="ft-new-type" value={documentType} onChange={e => setDocumentType(e.target.value as DocumentType)} disabled={busy} className={field}>
            {DOCUMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <label className="flex items-start gap-2.5 text-[14px] text-slate-900">
          <input id="ft-new-consent" type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} disabled={busy}
            aria-describedby={`ft-new-privacy${submitted && consentProblem ? ' ft-new-consent-error' : ''}`}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-400 accent-[var(--color-purple)]" />
          <span>These comments were written for me, and I may share them with this tool.</span>
        </label>
        <p id="ft-new-privacy" className="mt-2 text-[13px] text-slate-700">
          The comments and your drafts are stored encrypted. They are deleted for good after {retentionDays} days without activity, or at once when you delete the checklist.
          Remove names and student numbers you do not want stored.
        </p>
        {submitted && consentProblem ? <p id="ft-new-consent-error" role="alert" className="mt-1.5 text-[13px] font-medium text-red-700">{consentProblem}</p> : null}
      </div>

      {failure ? <p ref={failureRef} tabIndex={-1} role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-[14px] text-red-800 outline-none">{failure}</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy}
          className="min-h-10 rounded-lg bg-purple-accent px-4 text-[14px] font-semibold text-white outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-purple-accent/50 focus-visible:ring-offset-2 disabled:opacity-60">
          {busy ? 'Reading the comments…' : `Create checklist (${EXTRACTION_CREDITS} credits)`}
        </button>
        <p className="text-[13px] text-slate-700" aria-live="polite">{busy ? 'This usually takes under a minute.' : 'You are charged only if a checklist is created.'}</p>
      </div>
    </form>
  )
}
