import { useState } from 'react'
import { authorshipEvidenceApi } from '../../api/authorshipEvidence'
import { failureMessage, formatDateTime, type Settings } from '../../lib/authorshipEvidence'
import { ErrorNote, dangerButton, linkButton, primaryButton, secondaryButton } from './ui'

function Lists({ settings }: { settings: Settings }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <h3 className="text-[14px] font-semibold text-slate-900">What is recorded</h3>
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[13px] text-slate-800">
          {settings.whatIsRecorded.map(x => <li key={x}>{x}</li>)}
        </ul>
      </div>
      <div>
        <h3 className="text-[14px] font-semibold text-slate-900">What is never recorded</h3>
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[13px] text-slate-800">
          {settings.whatIsNotRecorded.map(x => <li key={x}>{x}</li>)}
        </ul>
      </div>
    </div>
  )
}

/**
 * The recording notice. Before the student accepts it nothing is recorded; after, it stays on the page as a
 * collapsed summary so what is recorded can always be read again and switched off.
 */
export function RecordingNotice({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  const [understood, setUnderstood] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const change = async (c: { recordingAccepted?: boolean; keepFullText?: boolean }) => {
    setBusy(true)
    setFailure(null)
    try {
      onChange(await authorshipEvidenceApi.setSettings(c))
    } catch (err) {
      setFailure(failureMessage(err, 'save'))
    } finally {
      setBusy(false)
    }
  }

  const deleteAll = async () => {
    setBusy(true)
    setFailure(null)
    try {
      await authorshipEvidenceApi.deleteAll()
      setConfirmDelete(false)
      onChange({ ...settings })
    } catch (err) {
      setFailure(failureMessage(err, 'delete'))
    } finally {
      setBusy(false)
    }
  }

  if (!settings.recordingAccepted) {
    return (
      <section aria-labelledby="ae-notice-title" className="rounded-xl border border-slate-300 bg-slate-50 p-4 sm:p-5">
        <h2 id="ae-notice-title" className="text-[16px] font-semibold text-slate-900">Before anything is recorded</h2>
        <p className="mt-1 max-w-3xl text-[14px] text-slate-800">
          Nothing is being recorded now. If you switch recording on, HumaniseAI keeps a factual history of how each document you write in the editor develops, so you can show it to a supervisor or examiner if you choose to.
        </p>
        <div className="mt-4"><Lists settings={settings} /></div>
        <p className="mt-4 max-w-3xl text-[13px] text-slate-800">
          The history is stored encrypted and belongs to you. It is deleted for good after {settings.retentionDays} days without activity, when you delete the document, or at once whenever you ask.
          You can switch recording off for any document, and switching it off is itself noted in that document's history.
        </p>
        <label className="mt-4 flex items-start gap-2.5 text-[14px] text-slate-900">
          <input id="ae-notice-consent" type="checkbox" checked={understood} onChange={e => setUnderstood(e.target.checked)} disabled={busy}
            aria-describedby={submitted && !understood ? 'ae-notice-error' : undefined}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-400 accent-[var(--color-purple)]" />
          <span>I have read what is recorded and I want a history kept for the documents I write here.</span>
        </label>
        {submitted && !understood ? <p id="ae-notice-error" role="alert" className="mt-1.5 text-[13px] font-medium text-red-700">Tick the box to switch recording on.</p> : null}
        {failure ? <div className="mt-3"><ErrorNote>{failure}</ErrorNote></div> : null}
        <button type="button" disabled={busy} className={`mt-4 ${primaryButton}`}
          onClick={() => { setSubmitted(true); if (understood) void change({ recordingAccepted: true }); else document.getElementById('ae-notice-consent')?.focus() }}>
          {busy ? 'Switching on…' : 'Switch recording on'}
        </button>
      </section>
    )
  }

  return (
    <section aria-labelledby="ae-recording-title" className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p id="ae-recording-title" className="text-[14px] text-emerald-950">
          <span className="font-semibold">Recording is on</span>
          {settings.recordingAcceptedAt ? <> since {formatDateTime(settings.recordingAcceptedAt)}</> : null}. Documents you write in the editor get a history from their next save.
        </p>
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className={linkButton}>{open ? 'Hide details' : 'What is recorded, and settings'}</button>
      </div>
      {open ? (
        <div className="mt-4 space-y-4 rounded-lg border border-emerald-200 bg-white p-3 sm:p-4">
          <Lists settings={settings} />
          <label className="flex items-start gap-2.5 text-[14px] text-slate-900">
            <input type="checkbox" checked={settings.keepFullText} disabled={busy} onChange={e => { void change({ keepFullText: e.target.checked }) }}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-400 accent-[var(--color-purple)]" />
            <span>
              Also keep the full text I give to AI tools and the text they return.
              <span className="block text-[13px] text-slate-700">Off by default: only the tool, the time and the lengths are kept. If you switch this on, the text is stored encrypted for {settings.fullTextRetentionDays} days, then removed. Switching it off removes text already kept.</span>
            </span>
          </label>
          {failure ? <ErrorNote>{failure}</ErrorNote> : null}
          <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-3">
            <button type="button" disabled={busy} onClick={() => { void change({ recordingAccepted: false }) }} className={secondaryButton}>Stop recording for all documents</button>
            {confirmDelete ? (
              <span role="alertdialog" aria-label="Delete all authorship evidence" className="flex flex-wrap items-center gap-2 rounded-lg border border-red-300 bg-red-50 p-2 text-[13px] text-red-900">
                Delete every history, version, register entry, declaration and report? This cannot be undone.
                <button type="button" disabled={busy} onClick={() => { void deleteAll() }} className={dangerButton}>{busy ? 'Deleting…' : 'Delete everything'}</button>
                <button type="button" disabled={busy} onClick={() => setConfirmDelete(false)} className={secondaryButton}>Keep it</button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="rounded text-[13px] font-semibold text-red-700 underline outline-none focus-visible:ring-2 focus-visible:ring-red-700/40">Delete all my authorship evidence now</button>
            )}
          </div>
          <p className="text-[13px] text-slate-700">Stopping keeps what was already recorded. Deleting removes it for good.</p>
        </div>
      ) : null}
    </section>
  )
}
