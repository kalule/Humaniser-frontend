import { useCallback, useEffect, useState } from 'react'
import { ShieldCheck, Wrench } from 'lucide-react'
import { researchPaperApi } from '../../api/researchPaper'
import { useRunPoll } from '../../hooks/useRunPoll'
import { Chip, Loading, Notice, Panel, RunBanner } from '../literatureReview/ui'
import { btn, inputClass } from '../literatureReview/styles'
import { errorMessage, isRunActive, type Integrity, type Paper, type PaperIssue } from '../../lib/researchPaper'

/**
 * Stage 6: the integrity check. Claims against their sources, references and DOIs, numbers and counts, structure and
 * consistency, as a readiness score and a fix list. One-click fixes where one exists; the rest say what to do. The
 * same findings are marked on their sentences in Writing.
 */
export function CheckStage({ paper, onChanged, onOpenSection, onNext }: { paper: Paper; onChanged: (p?: Paper) => void; onOpenSection: () => void; onNext: () => void }) {
  const [data, setData] = useState<Integrity | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const load = useCallback(() => {
    researchPaperApi.integrity(paper.id).then(setData).catch(e => setError(errorMessage(e, 'The check results could not be loaded.')))
  }, [paper.id])
  useEffect(load, [load])
  const fetchVerify = useCallback(() => researchPaperApi.latestRun(paper.id, 'Verify'), [paper.id])
  const verify = useRunPoll(fetchVerify, () => { load(); onChanged() })
  const fetchDraft = useCallback(() => researchPaperApi.latestRun(paper.id, 'DraftSections'), [paper.id])
  const repair = useRunPoll(fetchDraft, load)
  const running = isRunActive(verify.run) || isRunActive(repair.run)

  const act = async (fn: () => Promise<void>, failure: string) => {
    setBusy(true); setError(null); setNote(null)
    try { await fn() } catch (e) { setError(errorMessage(e, failure)) } finally { setBusy(false) }
  }
  const fix = (issue: PaperIssue) => act(async () => {
    const r = await researchPaperApi.fix(paper.id, issue.id)
    if (r.run) { if (r.action === 'Regenerating') repair.setRun(r.run); else verify.setRun(r.run) }
    setNote(r.action === 'Edited' ? 'Fixed. Check again to confirm.' : r.action === 'Checking' ? 'Checking the sources again.' : 'Rewriting the section with this problem given to the writer.')
    load()
  }, 'The fix could not be applied.')

  if (!data) return <Panel>{error ? <Notice tone="error">{error}</Notice> : <Loading />}</Panel>
  const r = data.readiness
  const open = data.issues.filter(i => i.status === 'Open' || i.status === 'Stale')
  const dismissed = data.issues.filter(i => i.status === 'Dismissed')

  return (
    <div className="space-y-4">
      {paper.studentMode ? <Notice tone="info">Fix what blocks the paper first. A warning can be dismissed with a reason when you have checked it yourself.</Notice> : null}
      <Panel title="Integrity check" id="rp-check" description={data.notice}
        actions={<button type="button" onClick={() => void act(async () => { verify.setRun(await researchPaperApi.verify(paper.id)) }, 'The check could not be started.')} disabled={busy || running} className={btn.primary}><ShieldCheck size={16} aria-hidden /> Check the paper</button>}>
        <RunBanner run={verify.run} label="Checking" />
        <RunBanner run={repair.run} label="Rewriting" />
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <div aria-label={`Readiness ${r.score} out of 100`} className="flex h-16 w-16 items-center justify-center rounded-full border-4 text-[18px] font-semibold"
            style={{ borderColor: r.ready ? '#16a34a' : r.blocking ? '#dc2626' : '#d97706' }}>{r.score}</div>
          <div className="min-w-0 text-[14px] text-slate-900">
            <p className="font-medium">{r.ready ? 'Ready to export.' : 'Not ready yet.'}</p>
            {r.reasons.map(x => <p key={x} className="text-slate-700">{x}</p>)}
            {data.lastVerifiedAt ? <p className="text-[12px] text-slate-600">Last checked {data.lastVerifiedAt.slice(0, 16).replace('T', ' ')}</p> : <p className="text-[12px] text-slate-600">Not checked yet.</p>}
          </div>
        </div>
        {Object.keys(r.byCategory).length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">{Object.entries(r.byCategory).map(([k, n]) => <Chip key={k} className="border-slate-300 text-slate-800">{k}: {n}</Chip>)}</div>
        ) : null}
      </Panel>

      {note ? <Notice tone="success" role="status">{note}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      {open.length ? (
        <Panel title="To fix" id="rp-issues">
          <ul className="space-y-2">
            {open.map(i => <IssueRow key={i.id} issue={i} busy={busy || running} onFix={() => void fix(i)} onOpen={onOpenSection}
              onDismiss={reason => act(async () => { await researchPaperApi.dismiss(paper.id, i.id, reason); load() }, 'The finding could not be dismissed.')} />)}
          </ul>
        </Panel>
      ) : data.lastVerifiedAt ? <Notice tone="success" role="status">Nothing left to fix.</Notice> : null}

      {dismissed.length ? (
        <Panel title="Dismissed" id="rp-dismissed">
          <ul className="space-y-1 text-[13px] text-slate-800">{dismissed.map(i => <li key={i.id}>{i.message} <span className="text-slate-600">— {i.dismissReason}</span></li>)}</ul>
        </Panel>
      ) : null}

      <button type="button" onClick={onNext} className={btn.primary}>Continue to export</button>
    </div>
  )
}

function IssueRow({ issue, busy, onFix, onDismiss, onOpen }: { issue: PaperIssue; busy: boolean; onFix: () => void; onDismiss: (reason: string) => Promise<void>; onOpen: () => void }) {
  const [dismissing, setDismissing] = useState(false)
  const [reason, setReason] = useState('')
  const manual: Record<string, string> = { AddResults: 'Add your results under Writing', RunSynthesis: 'Run the synthesis again', EditReference: "Correct the source's details", None: '' }
  return (
    <li className="rounded-lg border border-slate-200 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-1.5">
            <Chip className={issue.severity === 'Blocking' ? 'border-red-300 bg-red-50 text-red-900' : 'border-amber-300 bg-amber-50 text-amber-950'}>{issue.severity === 'Blocking' ? 'Must fix' : 'Warning'}</Chip>
            <Chip className="border-slate-300 text-slate-800">{issue.category}</Chip>
            {issue.sectionTitle ? <Chip className="border-slate-300 text-slate-800">{issue.sectionTitle}</Chip> : null}
            {issue.status === 'Stale' ? <Chip className="border-slate-300 text-slate-700">Text changed since this check</Chip> : null}
          </div>
          <p className="mt-1.5 text-[14px] text-slate-900">{issue.message}</p>
          {issue.claimText ? <p className="mt-1 text-[13px] text-slate-700">“{issue.claimText.replace(/\{\{cite:[^}]+\}\}/g, '').trim()}”</p> : null}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {issue.oneClick ? <button type="button" className={btn.small} disabled={busy} onClick={onFix}><Wrench size={14} aria-hidden /> {issue.fixKind === 'Regenerate' ? 'Rewrite the section' : issue.fixKind === 'RemoveClaim' ? 'Remove the claim' : issue.fixKind === 'MakeNarrative' ? 'Make it narrative' : issue.fixKind === 'VerifySources' ? 'Check the sources' : 'Draft it'}</button>
          : manual[issue.fixKind] ? <span className="text-[13px] text-slate-700">{manual[issue.fixKind]}.</span> : null}
        {issue.sectionCode ? <button type="button" className={btn.small} onClick={onOpen}>Open in Writing</button> : null}
        {issue.canDismiss ? <button type="button" className={btn.small} onClick={() => setDismissing(d => !d)}>Dismiss</button> : null}
      </div>
      {dismissing ? (
        <div className="mt-2 space-y-2">
          <label htmlFor={`rp-dismiss-${issue.id}`} className="block text-[13px] font-medium text-slate-900">Why does this not apply?</label>
          <input id={`rp-dismiss-${issue.id}`} value={reason} maxLength={500} onChange={e => setReason(e.target.value)} className={inputClass} />
          <button type="button" className={btn.small} disabled={reason.trim().length < 10} onClick={() => void onDismiss(reason).then(() => setDismissing(false))}>Dismiss with this reason</button>
        </div>
      ) : null}
    </li>
  )
}
