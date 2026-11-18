import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, ShieldCheck, Wrench } from 'lucide-react'
import { researchPaperApi } from '../../api/researchPaper'
import { useRunPoll } from '../../hooks/useRunPoll'
import { Chip, Loading, Notice, Panel, RunBanner } from '../literatureReview/ui'
import { btn, inputClass } from '../literatureReview/styles'
import { errorMessage, isRunActive, type FindingGroup, type Integrity, type Paper, type Severity } from '../../lib/researchPaper'

const SEVERITY_STYLE: Record<Severity, string> = {
  Critical: 'border-red-300 bg-red-50 text-red-900',
  Important: 'border-amber-300 bg-amber-50 text-amber-950',
  Suggestion: 'border-slate-300 bg-slate-50 text-slate-800',
}
const SEVERITY_LABEL: Record<Severity, string> = { Critical: 'Critical', Important: 'Important', Suggestion: 'Suggestion' }
const plain = (t: string) => t.replace(/\{\{cite:[^}]+\}\}/g, '').replace(/\s+/g, ' ').trim()

/**
 * Stage 6: the integrity check, as a short list of grouped issues. One group is one underlying issue (the same rule on the
 * same sentence across its sources, or on the same source); every finding behind it stays listed. Critical issues come
 * first and block final export; suggestions are collapsed. Fixes say what to do; automatic ones can be applied in bulk,
 * and only a new check marks anything resolved.
 */
export function CheckStage({ paper, onChanged, onOpenSection, onNext }: { paper: Paper; onChanged: (p?: Paper) => void; onOpenSection: (code?: string) => void; onNext: () => void }) {
  const [data, setData] = useState<Integrity | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [filter, setFilter] = useState<{ severity: string; section: string; category: string }>({ severity: '', section: '', category: '' })
  const [showSuggestions, setShowSuggestions] = useState(false)
  const load = useCallback(() => {
    researchPaperApi.integrity(paper.id).then(setData).catch(e => setError(errorMessage(e, 'The check results could not be loaded.')))
  }, [paper.id])
  useEffect(load, [load])
  const fetchVerify = useCallback(() => researchPaperApi.latestRun(paper.id, 'Verify'), [paper.id])
  const verify = useRunPoll(fetchVerify, () => { load(); onChanged() })
  const fetchDraft = useCallback(() => researchPaperApi.latestRun(paper.id, 'DraftSections'), [paper.id])
  const repair = useRunPoll(fetchDraft, load)
  const fetchSentenceRepair = useCallback(() => researchPaperApi.latestRun(paper.id, 'RepairSentences'), [paper.id])
  const sentenceRepair = useRunPoll(fetchSentenceRepair, () => { load(); onChanged() })
  const running = isRunActive(verify.run) || isRunActive(repair.run) || isRunActive(sentenceRepair.run)

  const act = async (fn: () => Promise<void>, failure: string) => {
    setBusy(true); setError(null); setNote(null)
    try { await fn() } catch (e) { setError(errorMessage(e, failure)) } finally { setBusy(false) }
  }
  const fixOne = (g: FindingGroup) => act(async () => {
    const r = await researchPaperApi.fix(paper.id, g.issueIds[0])
    if (r.run) { if (r.action === 'Regenerating') repair.setRun(r.run); else if (r.action === 'Repairing') sentenceRepair.setRun(r.run); else verify.setRun(r.run) }
    setNote(r.action === 'Edited' ? 'Edited. Check the paper again to confirm the fix.' : r.action === 'Checking' ? 'Checking the sources again.'
      : r.action === 'Repairing' ? 'Rewriting the sentence from its cited passages, then checking it.' : 'Rewriting the section with this problem given to the writer.')
    load()
  }, 'The fix could not be applied.')
  const bulk = (groups: FindingGroup[], action: 'Apply' | 'RemoveSentences') => act(async () => {
    const r = await researchPaperApi.bulkFix(paper.id, groups.flatMap(g => g.issueIds), action)
    setNote(`${r.applied} change${r.applied === 1 ? '' : 's'} made${r.skipped.length ? `, ${r.skipped.length} skipped` : ''}. Check the paper again to confirm.`)
    load(); onChanged()
  }, 'The changes could not be made.')

  const groups = useMemo(() => data?.groups ?? [], [data])
  const live = groups.filter(g => g.status !== 'Dismissed')
  const dismissed = groups.filter(g => g.status === 'Dismissed')
  const sections = useMemo(() => {
    const m = new Map<string, string>()
    for (const g of live) for (const s of g.sentences) if (s.sectionCode && s.sectionTitle) m.set(s.sectionCode, s.sectionTitle)
    for (const i of data?.issues ?? []) if (i.sectionCode && i.sectionTitle) m.set(i.sectionCode, i.sectionTitle)
    return [...m.entries()]
  }, [live, data])
  const categories = useMemo(() => [...new Set(live.map(g => g.category))].sort(), [live])
  const shown = live.filter(g => (!filter.severity || g.severity === filter.severity) && (!filter.section || g.sectionCodes.includes(filter.section))
    && (!filter.category || g.category === filter.category))
  const main = shown.filter(g => g.severity !== 'Suggestion')
  const suggestions = shown.filter(g => g.severity === 'Suggestion')
  const removable = main.filter(g => g.severity === 'Critical' && g.sentences.length > 0 && g.status === 'Open' && g.verification === 'Checked')
  const automatic = main.filter(g => g.status === 'Open' && (g.fixKind === 'RemoveClaim' || g.fixKind === 'MakeNarrative'))
  const repairable = live.filter(g => g.status === 'Open' && g.severity === 'Critical' && (g.fixKind === 'RepairSentence' || g.code === 'PROMPT_ECHO'))

  if (!data) return <Panel>{error ? <Notice tone="error">{error}</Notice> : <Loading />}</Panel>
  const r = data.readiness
  const s = data.summary
  const v = data.verification
  const incomplete = v?.state === 'Incomplete'
  const status = v?.state === 'Running' ? 'Checking…' : data.stateLabel ?? (incomplete ? 'Verification incomplete' : r.ready ? 'Ready for final export'
    : !data.lastVerifiedAt ? 'Not checked yet' : r.sectionsUnverified > 0 ? 'Changed since the last check' : r.blocking > 0 ? 'Corrections required' : 'Checked')

  return (
    <div className="space-y-4">
      {paper.studentMode ? <Notice tone="info">Fix the critical issues first: they are statements the sources do not support. Important issues weaken the paper; suggestions are optional.</Notice> : null}
      <Panel title="Integrity check" id="rp-check" description={data.notice}
        actions={<button type="button" onClick={() => void act(async () => { verify.setRun(await researchPaperApi.verify(paper.id)) }, 'The check could not be started.')} disabled={busy || running} className={btn.primary}><ShieldCheck size={16} aria-hidden /> Check the paper</button>}>
        <RunBanner run={verify.run} label="Checking" />
        <RunBanner run={repair.run} label="Rewriting" />
        <RunBanner run={sentenceRepair.run} label="Repairing" />
        <div className="mt-3 space-y-2">
          <p className="text-[16px] font-semibold text-slate-900" role="status">{status}</p>
          <div className="flex flex-wrap gap-2 text-[14px]" aria-label="Issue counts">
            <Chip className={SEVERITY_STYLE.Critical}>{s?.critical ?? r.blocking} critical</Chip>
            <Chip className={SEVERITY_STYLE.Important}>{s?.important ?? r.warnings} important</Chip>
            <Chip className={SEVERITY_STYLE.Suggestion}>{s?.suggestion ?? r.suggestions ?? 0} suggestion{(s?.suggestion ?? r.suggestions ?? 0) === 1 ? '' : 's'}</Chip>
          </div>
          {incomplete && v ? (
            <Notice tone="warning">
              {v.notChecked > 0 ? `${v.notChecked} claim check${v.notChecked === 1 ? ' was' : 's were'} not reached` : ''}{v.notChecked > 0 && v.failed > 0 ? ' and ' : ''}
              {v.failed > 0 ? `${v.failed} failed` : ''}. This check is not complete, so the paper cannot be approved yet. Check again to finish: claims already checked are not checked or charged again.
            </Notice>
          ) : null}
          {r.reasons.map(x => <p key={x} className="text-[14px] text-slate-700">{x}</p>)}
          {v && (v.reused > 0 || v.judged > 0) ? <p className="text-[12px] text-slate-600">{v.judged} claim check{v.judged === 1 ? '' : 's'} made now, {v.reused} reused from earlier checks because nothing they depend on changed.</p> : null}
          {s && s.raw > s.groups ? <p className="text-[12px] text-slate-600">{s.raw} findings, grouped into {s.groups} issues.</p> : null}
          <p className="text-[12px] text-slate-600">{data.lastVerifiedAt ? `Last checked ${data.lastVerifiedAt.slice(0, 16).replace('T', ' ')}` : 'Not checked yet.'}</p>
        </div>
      </Panel>

      {note ? <Notice tone="success" role="status">{note}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      <ApprovalPanel paper={paper} data={data} busy={busy || running} onApproved={next => { setData(next); onChanged() }} setError={setError} />

      {live.length ? (
        <Panel title="Issues" id="rp-issues">
          <div className="mb-3 flex flex-wrap gap-2 text-[13px]">
            <label className="sr-only" htmlFor="rp-f-sev">Severity</label>
            <select id="rp-f-sev" value={filter.severity} onChange={e => setFilter(f => ({ ...f, severity: e.target.value }))} className="rounded-md border border-slate-300 px-2 py-1">
              <option value="">All severities</option>{(['Critical', 'Important', 'Suggestion'] as const).map(x => <option key={x} value={x}>{SEVERITY_LABEL[x]}</option>)}
            </select>
            <label className="sr-only" htmlFor="rp-f-sec">Section</label>
            <select id="rp-f-sec" value={filter.section} onChange={e => setFilter(f => ({ ...f, section: e.target.value }))} className="max-w-[16rem] rounded-md border border-slate-300 px-2 py-1">
              <option value="">All sections</option>{sections.map(([code, title]) => <option key={code} value={code}>{title}</option>)}
            </select>
            <label className="sr-only" htmlFor="rp-f-cat">Category</label>
            <select id="rp-f-cat" value={filter.category} onChange={e => setFilter(f => ({ ...f, category: e.target.value }))} className="rounded-md border border-slate-300 px-2 py-1">
              <option value="">All categories</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {repairable.length ? (
            <div className="mb-3 rounded-lg border border-purple-accent/30 bg-purple-tint/40 p-3 text-[14px] text-slate-900">
              <p>{repairable.length} critical issue{repairable.length === 1 ? '' : 's'} can be repaired automatically: each sentence is rewritten from its cited passages and checked. A sentence that still fails stays here with a suggested fix.</p>
              <button type="button" className={btn.primary + ' mt-2'} disabled={busy || running}
                onClick={() => void act(async () => { sentenceRepair.setRun(await researchPaperApi.repair(paper.id)) }, 'The repair could not be started.')}>
                <Wrench size={16} aria-hidden /> Repair automatically
              </button>
            </div>
          ) : null}
          {automatic.length || removable.length ? (
            <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Fix several at once">
              {automatic.length ? <button type="button" className={btn.small} disabled={busy || running} onClick={() => void bulk(automatic, 'Apply')}><Wrench size={14} aria-hidden /> Apply {automatic.length} automatic fix{automatic.length === 1 ? '' : 'es'}</button> : null}
              {removable.length ? <button type="button" className={btn.small} disabled={busy || running} onClick={() => void bulk(removable, 'RemoveSentences')}>Remove the {removable.length} unsupported sentence{removable.length === 1 ? '' : 's'}</button> : null}
            </div>
          ) : null}
          <ul className="space-y-2">
            {main.map(g => <GroupRow key={g.key} group={g} busy={busy || running} onFix={() => void fixOne(g)} onOpen={onOpenSection} issues={data.issues}
              onDismiss={reason => act(async () => { for (const id of g.issueIds) await researchPaperApi.dismiss(paper.id, id, reason); load() }, 'The issue could not be dismissed.')} />)}
            {main.length === 0 ? <li className="text-[14px] text-slate-700">Nothing here with these filters.</li> : null}
          </ul>
          {suggestions.length ? (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <button type="button" className={btn.link} aria-expanded={showSuggestions} onClick={() => setShowSuggestions(v => !v)}>
                {showSuggestions ? <ChevronDown size={14} className="mr-1 inline" aria-hidden /> : <ChevronRight size={14} className="mr-1 inline" aria-hidden />}
                {suggestions.length} suggestion{suggestions.length === 1 ? '' : 's'} (optional)
              </button>
              {showSuggestions ? <ul className="mt-2 space-y-2">{suggestions.map(g => <GroupRow key={g.key} group={g} busy={busy || running} onFix={() => void fixOne(g)} onOpen={onOpenSection} issues={data.issues}
                onDismiss={reason => act(async () => { for (const id of g.issueIds) await researchPaperApi.dismiss(paper.id, id, reason); load() }, 'The issue could not be dismissed.')} />)}</ul> : null}
            </div>
          ) : null}
        </Panel>
      ) : data.lastVerifiedAt ? <Notice tone="success" role="status">Nothing left to fix.</Notice> : null}

      {dismissed.length ? (
        <Panel title="Dismissed" id="rp-dismissed" description="Kept on record. A dismissed critical issue still blocks final export.">
          <ul className="space-y-1 text-[13px] text-slate-800">{dismissed.map(g => <li key={g.key}><Chip className={SEVERITY_STYLE[g.severity]}>{SEVERITY_LABEL[g.severity]}</Chip> {g.message} <span className="text-slate-600">— {data.issues.find(i => i.id === g.issueIds[0])?.dismissReason}</span></li>)}</ul>
        </Panel>
      ) : null}

      <button type="button" onClick={onNext} className={btn.primary}>Continue to export</button>
    </div>
  )
}

/**
 * Approval for final export (audit doc 21.11). A finished check is not acceptance: the student approves, only when the
 * check is complete and nothing critical is open, and the approval lapses when the text changes. Every decision is kept.
 */
function ApprovalPanel({ paper, data, busy, onApproved, setError }: {
  paper: Paper; data: Integrity; busy: boolean; onApproved: (next: Integrity) => void; setError: (e: string | null) => void
}) {
  const [confirm, setConfirm] = useState(false)
  const [sending, setSending] = useState(false)
  const state = data.state
  if (!state) return null
  const approve = async () => {
    setSending(true); setError(null)
    try { onApproved(await researchPaperApi.approveFinal(paper.id, true)) } catch (e) { setError(errorMessage(e, 'The paper could not be approved.')) } finally { setSending(false) }
  }
  return (
    <Panel title="Approval for final export" id="rp-approval">
      {state === 'ReadyForFinalExport' ? (
        <Notice tone="success" role="status">Approved for final export. Changing the text takes the approval back.</Notice>
      ) : state === 'VerificationCompleted' ? (
        <div className="space-y-2 text-[14px] text-slate-900">
          {(data.stateReasons ?? []).map(x => <p key={x}>{x}</p>)}
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={confirm} onChange={e => setConfirm(e.target.checked)} className="mt-1" />
            <span>I have read the paper and checked its sources, and I take responsibility for it. A completed check is not academic acceptance.</span>
          </label>
          <button type="button" className={btn.primary} disabled={busy || sending || !confirm} onClick={() => void approve()}>Approve for final export</button>
        </div>
      ) : (
        <div className="space-y-1 text-[14px] text-slate-900">
          <p className="font-medium">The paper cannot be approved yet:</p>
          <ul className="list-disc space-y-1 pl-5">{(data.stateReasons ?? []).map(x => <li key={x}>{x}</li>)}</ul>
          <p className="text-[13px] text-slate-700">You can still export a draft.</p>
        </div>
      )}
      {data.approvals?.length ? (
        <details className="mt-3 text-[13px] text-slate-800">
          <summary className="cursor-pointer">Decision history ({data.approvals.length})</summary>
          <ul className="mt-2 space-y-1">{data.approvals.map(a => (
            <li key={a.at + a.decision}>{a.at.slice(0, 16).replace('T', ' ')} · {a.decision === 'Approved' ? 'Approved' : 'Refused'} · {a.reasons.join(' ')}</li>
          ))}</ul>
        </details>
      ) : null}
    </Panel>
  )
}

function GroupRow({ group: g, busy, onFix, onDismiss, onOpen, issues }: {
  group: FindingGroup; busy: boolean; onFix: () => void; onDismiss: (reason: string) => Promise<void>; onOpen: (code?: string) => void; issues: Integrity['issues']
}) {
  const [open, setOpen] = useState(false)
  const [dismissing, setDismissing] = useState(false)
  const [reason, setReason] = useState('')
  const members = issues.filter(i => g.issueIds.includes(i.id))
  return (
    <li className="rounded-lg border border-slate-200 p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip className={SEVERITY_STYLE[g.severity]}>{SEVERITY_LABEL[g.severity]}</Chip>
        <Chip className="border-slate-300 text-slate-800">{g.category}</Chip>
        {g.status === 'Stale' ? <Chip className="border-slate-300 text-slate-700">Changed: check again to confirm</Chip> : null}
        {g.verification === 'Inconclusive' ? <Chip className="border-slate-300 text-slate-700">Could not be confirmed</Chip> : null}
      </div>
      <p className="mt-1.5 text-[14px] text-slate-900">{g.message}</p>
      {g.sentences.slice(0, 2).map(s => <p key={`${s.sectionCode}-${s.ordinal}-${s.text.slice(0, 20)}`} className="mt-1 text-[13px] text-slate-700 [overflow-wrap:anywhere]">“{plain(s.text)}”{s.sectionTitle ? <span className="text-slate-500"> — {s.sectionTitle}</span> : null}</p>)}
      {g.sentences.length > 2 ? <p className="mt-1 text-[12px] text-slate-600">and {g.sentences.length - 2} more sentence{g.sentences.length - 2 === 1 ? '' : 's'}</p> : null}
      <p className="mt-1.5 text-[13px] text-slate-800"><span className="font-medium">What to do:</span> {g.recommendedAction}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {g.oneClick && g.status === 'Open' ? <button type="button" className={btn.small} disabled={busy} onClick={onFix}><Wrench size={14} aria-hidden /> {g.fixKind === 'RepairSentence' ? 'Repair this sentence' : g.fixKind === 'Regenerate' ? 'Rewrite the section' : g.fixKind === 'RemoveClaim' ? 'Remove the claim' : g.fixKind === 'MakeNarrative' ? 'Make it narrative' : g.fixKind === 'VerifySources' ? 'Check the sources' : 'Draft it'}</button> : null}
        {g.sectionCodes[0] ? <button type="button" className={btn.small} onClick={() => onOpen(g.sectionCodes[0])}>Open the section</button> : null}
        <button type="button" className={btn.small} aria-expanded={open} onClick={() => setOpen(v => !v)}>{open ? 'Hide details' : 'Details'}</button>
        {g.canDismiss && g.status === 'Open' ? <button type="button" className={btn.small} onClick={() => setDismissing(d => !d)}>Dismiss</button> : null}
      </div>
      {open ? (
        <div className="mt-2 space-y-2 border-t border-slate-100 pt-2 text-[13px]">
          {members.map(m => (
            <div key={m.id}>
              <p className="text-slate-900">{m.message}</p>
              {m.evidence ? <blockquote className="mt-1 border-l-2 border-purple-accent/50 pl-2 text-slate-800">“{m.evidence}”</blockquote> : null}
            </div>
          ))}
        </div>
      ) : null}
      {dismissing ? (
        <div className="mt-2 space-y-2">
          <label htmlFor={`rp-dismiss-${g.key}`} className="block text-[13px] font-medium text-slate-900">Why does this not apply?</label>
          <input id={`rp-dismiss-${g.key}`} value={reason} maxLength={500} onChange={e => setReason(e.target.value)} className={inputClass} />
          {g.severity === 'Critical' ? <p className="text-[12px] text-slate-700">Dismissing is recorded, but a critical issue still blocks final export.</p> : null}
          <button type="button" className={btn.small} disabled={reason.trim().length < 10} onClick={() => void onDismiss(reason).then(() => setDismissing(false))}>Dismiss with this reason</button>
        </div>
      ) : null}
    </li>
  )
}
