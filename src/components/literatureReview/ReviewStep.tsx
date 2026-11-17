import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, FileText, ShieldCheck } from 'lucide-react'
import { literatureReviewApi } from '../../api/literatureReview'
import { useLibraryStore } from '../../store/libraryStore'
import { formatStyleToEssayCitationStyle } from '../../lib/draftHandoffMapping'
import type { FormatStyle } from '../../types/citation'
import {
  errorMessage, isRunActive, readinessText, saveStudioHandOff,
  type Issue, type IssueList, type Review,
} from '../../lib/literatureReview'
import { Chip, Loading, Notice, Panel, RunBanner } from './ui'
import { btn, inputClass } from './styles'
import { useRunPoll } from '../../hooks/useRunPoll'

/**
 * Step 6: the check, the issues and the export. The server refuses export and the editor hand-off while anything
 * blocking is open, or while a section has changed since it was checked; this page only explains why.
 */
export function ReviewStep({ review, onChanged }: { review: Review; onChanged: () => void }) {
  const navigate = useNavigate()
  const createDocument = useLibraryStore(s => s.createDocument)
  const [data, setData] = useState<IssueList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    literatureReviewApi.issues(review.id).then(setData).catch(e => setError(errorMessage(e, 'The check results could not be loaded.')))
  }, [review.id])
  useEffect(load, [load])
  const fetchVerify = useCallback(() => literatureReviewApi.latestRun(review.id, 'Verify'), [review.id])
  const verify = useRunPoll(fetchVerify, () => { load(); onChanged() })
  const fetchDraft = useCallback(() => literatureReviewApi.latestRun(review.id, 'Draft'), [review.id])
  const repair = useRunPoll(fetchDraft, () => { load(); onChanged() })
  const running = isRunActive(verify.run) || isRunActive(repair.run)

  const check = async () => {
    setBusy(true); setError(null)
    try { verify.setRun(await literatureReviewApi.verify(review.id)) } catch (e) { setError(errorMessage(e, 'The check could not be started.')) } finally { setBusy(false) }
  }
  const fix = async (issue: Issue) => {
    setBusy(true); setError(null)
    try { repair.setRun(await literatureReviewApi.repair(review.id, issue.id)) } catch (e) { setError(errorMessage(e, 'The fix could not be started.')) } finally { setBusy(false) }
  }
  const dismiss = async (issue: Issue, reason: string) => {
    setError(null)
    try { await literatureReviewApi.dismiss(review.id, issue.id, reason); load(); onChanged() } catch (e) { setError(errorMessage(e, 'The issue could not be dismissed.')) }
  }
  const download = async (format: 'docx' | 'pdf') => {
    setBusy(true); setError(null)
    try {
      const blob = await literatureReviewApi.exportFile(review.id, format)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${review.title.replace(/[^\w\- ]+/g, ' ').trim().slice(0, 80) || 'Literature review'}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) { setError(errorMessage(e, 'The file could not be created.')) } finally { setBusy(false) }
  }
  const openInEditor = async () => {
    setBusy(true); setError(null)
    try {
      const result = { ...(await literatureReviewApi.handOff(review.id) as Record<string, unknown>), title: review.title }
      const doc = await createDocument({ title: review.title, documentType: 'LiteratureReview', citationStyle: review.citationStyle as FormatStyle })
      saveStudioHandOff(doc.id, { result, citationStyle: formatStyleToEssayCitationStyle(review.citationStyle as FormatStyle) })
      navigate(`/app/editor/${doc.id}`)
    } catch (e) { setError(errorMessage(e, 'The review could not be opened in the editor.')); setBusy(false) }
  }

  if (!data && !error) return <Panel><Loading /></Panel>
  const open = data?.issues.filter(i => i.status === 'Open' || i.status === 'Stale') ?? []
  const blocking = open.filter(i => i.severity === 'Blocking')
  const warnings = open.filter(i => i.severity === 'Warning')
  const ready = !!data?.readiness.ready && !running

  return (
    <div className="space-y-4">
      <Panel title="Check and export" id="lr-review" actions={<button type="button" onClick={() => void check()} disabled={busy || running} className={btn.secondary}><ShieldCheck size={16} aria-hidden /> Check the review</button>}>
        {data ? <Notice tone={data.readiness.ready ? 'success' : 'warning'} role="status">{readinessText(data.readiness)}</Notice> : null}
        <div className="mt-2 space-y-2">
          <RunBanner run={verify.run} label="Checking" />
          {isRunActive(repair.run) ? <RunBanner run={repair.run} label="Fixing" /> : null}
          {error ? <Notice tone="error">{error}</Notice> : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => void openInEditor()} disabled={!ready || busy} className={btn.primary}><FileText size={16} aria-hidden /> Open in editor</button>
          <button type="button" onClick={() => void download('docx')} disabled={!ready || busy} className={btn.secondary}><Download size={16} aria-hidden /> Word</button>
          <button type="button" onClick={() => void download('pdf')} disabled={!ready || busy} className={btn.secondary}><Download size={16} aria-hidden /> PDF</button>
        </div>
        {!ready ? <p className="mt-2 text-[12px] text-slate-600">Export opens once nothing blocking is left and every section has been checked as it now reads.</p> : null}
        <p className="mt-2 text-[12px] text-slate-600">In the editor the text is yours to change; the studio's checks apply to what you export from here.</p>
      </Panel>

      <IssueGroup title={`Blocking (${blocking.length})`} empty="Nothing blocking." issues={blocking} busy={busy || running} onFix={fix} onDismiss={dismiss} />
      <IssueGroup title={`Warnings (${warnings.length})`} empty="No warnings." issues={warnings} busy={busy || running} onFix={fix} onDismiss={dismiss} />
      {data && data.issues.some(i => i.status === 'Dismissed') ? (
        <Panel title="Dismissed" id="lr-dismissed">
          <ul className="space-y-1.5 text-[13px] text-slate-700">{data.issues.filter(i => i.status === 'Dismissed').map(i => <li key={i.id}>{i.message} <span className="text-slate-500">— your reason: {i.dismissReason}</span></li>)}</ul>
        </Panel>
      ) : null}
    </div>
  )
}

function IssueGroup({ title, empty, issues, busy, onFix, onDismiss }: {
  title: string; empty: string; issues: Issue[]; busy: boolean; onFix: (i: Issue) => void; onDismiss: (i: Issue, reason: string) => Promise<void>
}) {
  const sections = [...new Set(issues.map(i => i.sectionCode ?? ''))]
  return (
    <Panel title={title}>
      {issues.length === 0 ? <p className="text-[13px] text-slate-700">{empty}</p> : sections.map(code => (
        <div key={code} className="mb-3 last:mb-0">
          <p className="text-[12px] font-medium uppercase tracking-wide text-slate-600">{code.replace(/^[a-z]+-/, '').replace(/-/g, ' ') || 'Whole review'}</p>
          <ul className="mt-1 space-y-2">{issues.filter(i => (i.sectionCode ?? '') === code).map(i => <IssueRow key={i.id} issue={i} busy={busy} onFix={onFix} onDismiss={onDismiss} />)}</ul>
        </div>
      ))}
    </Panel>
  )
}

function IssueRow({ issue, busy, onFix, onDismiss }: { issue: Issue; busy: boolean; onFix: (i: Issue) => void; onDismiss: (i: Issue, reason: string) => Promise<void> }) {
  const [dismissing, setDismissing] = useState(false)
  const [reason, setReason] = useState('')
  return (
    <li className="rounded-lg border border-slate-200 p-3 text-[13px]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-slate-900">{issue.message}</p>
        {issue.status === 'Stale' ? <Chip className="border-slate-300 bg-slate-50 text-slate-800">Changed since the check</Chip> : null}
      </div>
      {issue.claimText ? <p className="mt-1 border-l-2 border-slate-200 pl-2 text-slate-700">“{issue.claimText}”</p> : null}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {issue.sectionCode ? <button type="button" disabled={busy} onClick={() => onFix(issue)} className={btn.small}>Fix{issue.repairAttempts ? ` again (${issue.repairAttempts} tried)` : ''}</button> : null}
        {issue.canDismiss ? <button type="button" disabled={busy} onClick={() => setDismissing(v => !v)} aria-expanded={dismissing} className={btn.small}>Dismiss…</button>
          : issue.status === 'Open' ? <span className="text-[12px] text-slate-600">{issue.repairAttempts === 0 ? 'Try Fix once before dismissing.' : 'This has to be fixed, not dismissed.'}</span> : null}
      </div>
      {dismissing ? (
        <form className="mt-2 space-y-1.5" onSubmit={e => { e.preventDefault(); void onDismiss(issue, reason).then(() => setDismissing(false)) }}>
          <label htmlFor={`lr-dismiss-${issue.id}`} className="block text-[13px] font-medium text-slate-900">Why does this not apply?</label>
          <textarea id={`lr-dismiss-${issue.id}`} rows={2} value={reason} maxLength={500} onChange={e => setReason(e.target.value)} className={inputClass} />
          <button type="submit" disabled={reason.trim().length < 10} className={btn.small}>Dismiss with this reason</button>
        </form>
      ) : null}
    </li>
  )
}
