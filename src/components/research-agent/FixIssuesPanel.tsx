import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, Download, Loader2, Undo2, Wrench } from 'lucide-react'
import toast from 'react-hot-toast'
import { researchApi } from '../../api/research'
import { changedLines } from '../../lib/proposalRepairDiff'
import { nextActionAfterRepair } from '../../lib/proposalRepairFlow'
import type { ProposalIssue, ProposalIssues, RepairReport } from '../../types/research'

interface FixIssuesPanelProps {
  projectId: string
  /** Jump to the step that edits this section; the panel hides the button when the section has no step. */
  canJump: (sectionKey: string) => boolean
  onJump: (sectionKey: string) => void
  /** Save any pending edits before the server looks at the document. */
  prepare: () => Promise<void>
  /** Build and download the .docx. */
  download: () => Promise<void>
  /** Reload sections after the server rewrote some of them. */
  onRepaired: () => Promise<void>
  /** Called when the issue list could not be loaded, so the caller can fall back to its own scan. */
  onUnavailable?: () => void
  /** Lets the caller disable its own download tiles while this panel is working. */
  onBusyChange?: (busy: boolean) => void
}

const ISSUE_LABELS: Record<string, string> = {
  section_missing: 'Missing section',
  section_unapproved: 'Not approved',
  citation_unresolved: 'Unmatched citation',
  reference_year_missing: 'Source without a year',
  citation_matches_undated_source: 'Source has no year',
  citation_stray_year_suffix: 'Year suffix',
  reference_cited_not_listed: 'Reference list incomplete',
  reference_listed_not_cited: 'Uncited reference',
  placeholder_citation_needed: 'Citation needed',
  placeholder_unresolved: 'Unfinished placeholder',
  budget_subtotal_mismatch: 'Budget subtotal',
  budget_contingency_mismatch: 'Budget contingency',
  budget_total_mismatch: 'Budget total',
  budget_duration_mismatch: 'Budget vs timeline',
  timeline_duration_mismatch: 'Timeline duration',
  fact_conflict: 'Conflicting facts',
}

/** The proposal business rules (docs/specs/business-rules.md) arrive as quality_brNN. */
const QUALITY_LABELS: Record<string, string> = {
  br02: 'Unconfirmed study fact',
  br05: 'Objective / question mapping',
  br15: 'Source not in project',
  br20: 'Timeline',
  br22: 'Document integrity',
  br49: 'Source concentration',
  br51: 'Sample plan',
  br52: 'Research questions',
  br53: 'Repeated text or headings',
  br55: 'Study location',
  br56: 'Ethics vs budget',
  br58: 'Appendices',
  br59: 'Presentation',
  br60: 'Repeated claims',
  br61: 'Coded counts as scale',
  // Not a business-rule number: the proposal-integrity check (planned study reported as done).
  pi01: 'Completed work in a proposal',
}

export function issueLabel(type: string): string {
  if (ISSUE_LABELS[type]) return ISSUE_LABELS[type]
  if (type.startsWith('quality_')) return QUALITY_LABELS[type.slice('quality_'.length)] ?? 'Quality check'
  if (type.startsWith('contradiction_')) return 'Contradiction'
  return type.replace(/_/g, ' ')
}

function errorMessage(err: unknown, fallback: string): string {
  const m = (err as { message?: string } | undefined)?.message
  return m && m.trim() ? m : fallback
}

export function FixIssuesPanel({
  projectId, canJump, onJump, prepare, download, onRepaired, onUnavailable, onBusyChange,
}: FixIssuesPanelProps) {
  const [issues, setIssues] = useState<ProposalIssues | null>(null)
  const [report, setReport] = useState<RepairReport | null>(null)
  const [phase, setPhase] = useState<'idle' | 'repairing' | 'downloading'>('idle')
  const [undoing, setUndoing] = useState<string | null>(null)
  const [openDiff, setOpenDiff] = useState<string | null>(null)
  const [confirmWarnings, setConfirmWarnings] = useState(false)

  const busy = phase !== 'idle' || undoing !== null
  useEffect(() => { onBusyChange?.(busy) }, [busy, onBusyChange])

  const refresh = useCallback(async () => {
    try {
      setIssues(await researchApi.getProposalIssues(projectId))
    } catch {
      onUnavailable?.()
    }
  }, [projectId, onUnavailable])

  useEffect(() => { void refresh() }, [refresh])

  const downloadNow = async () => {
    setPhase('downloading')
    const id = toast.loading('Building .docx…')
    try {
      await download()
      toast.success('Download started.', { id })
    } catch (err) {
      toast.error(errorMessage(err, 'Export failed. Check the server is running.'), { id, duration: 9000 })
    } finally {
      setPhase('idle')
    }
  }

  const fixAndDownload = async () => {
    setConfirmWarnings(false)
    setPhase('repairing')
    const id = toast.loading('Checking and fixing your proposal…')
    let result: RepairReport
    try {
      await prepare()
      result = await researchApi.runProposalRepair(projectId)
      setReport(result)
      if (result.fixed.length > 0) await onRepaired()
      await refresh()
    } catch (err) {
      toast.error(errorMessage(err, 'Could not run the repair.'), { id, duration: 9000 })
      setPhase('idle')
      return
    }
    toast.dismiss(id)
    setPhase('idle')

    const next = nextActionAfterRepair(result)
    if (next === 'skipped') {
      toast(result.skippedReason ?? 'Automatic repair is not available for this proposal.', { duration: 8000 })
      return
    }
    if (next === 'confirm-warnings') {
      // Never download over blocking problems without an explicit choice.
      setConfirmWarnings(true)
      return
    }
    toast.success(result.fixed.length > 0
      ? `Fixed ${result.fixed.length} issue${result.fixed.length > 1 ? 's' : ''}.`
      : 'No automatic fixes were needed.')
    await downloadNow()
  }

  const downloadAsIs = async () => {
    await prepare().catch(() => undefined)
    await downloadNow()
  }

  const undo = async (runId: string, repairId: string) => {
    setUndoing(repairId)
    try {
      setReport(await researchApi.undoProposalRepair(projectId, runId, repairId))
      await onRepaired()
      await refresh()
      toast.success('Change undone.')
    } catch (err) {
      toast.error(errorMessage(err, 'Could not undo this change.'), { duration: 9000 })
    } finally {
      setUndoing(null)
    }
  }

  // The student typed the value; the server only substitutes it (undoable, never suggested or generated).
  const fillPlaceholder = async (issue: ProposalIssue, value: string): Promise<boolean> => {
    try {
      setReport(await researchApi.fillProposalPlaceholder(projectId, issue.sectionKey, issue.evidence, value))
      await onRepaired()
      await refresh()
      toast.success('Placeholder replaced. You can undo it below.')
      return true
    } catch (err) {
      toast.error(errorMessage(err, 'Could not replace the placeholder.'), { duration: 9000 })
      return false
    }
  }

  const setSourceYear = async (issue: ProposalIssue, year: number): Promise<boolean> => {
    if (!issue.literatureId) return false
    try {
      setIssues(await researchApi.setProposalSourceYear(projectId, issue.literatureId, year))
      toast.success(`Year set to ${year}.`)
      return true
    } catch (err) {
      toast.error(errorMessage(err, 'Could not set the year.'), { duration: 9000 })
      return false
    }
  }

  if (!issues) return null

  const blocking = issues.issues.filter(i => i.severity === 'Blocking')
  const warnings = issues.issues.filter(i => i.severity === 'Warning')

  return (
    <div className="mb-6 flex flex-col gap-4" data-testid="fix-issues-panel">
      <div className="p-4 rounded-xl bg-white border border-slate-200 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-[14px] font-bold text-slate-800">
              {issues.issues.length === 0 ? 'No issues found' : `Issues in your proposal (${issues.issues.length})`}
            </h3>
            <p className="text-[12px] text-slate-500">
              {issues.issues.length === 0
                ? 'Nothing was flagged. Review the document yourself before submitting; this check does not validate it.'
                : `${blocking.length} blocking, ${warnings.length} to review. Fixing only changes what can be corrected without inventing content.`}
            </p>
          </div>
          <button
            type="button"
            onClick={fixAndDownload}
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-[13px] font-semibold shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {phase === 'repairing' ? <Loader2 size={15} className="animate-spin" /> : <Wrench size={15} />}
            {phase === 'repairing' ? 'Fixing…' : 'Fix issues and download'}
          </button>
          <button
            type="button"
            onClick={downloadAsIs}
            disabled={busy}
            className="text-[12px] font-medium text-slate-600 hover:text-slate-900 underline underline-offset-2 disabled:opacity-60"
          >
            Download as is
          </button>
        </div>

        {!issues.repairsAvailable && issues.repairsUnavailableReason && issues.issues.length > 0 && (
          <p className="text-[11.5px] text-slate-500">{issues.repairsUnavailableReason}</p>
        )}

        {issues.issues.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {[...blocking, ...warnings].map((issue, idx) => (
              <IssueRow key={`${issue.type}|${issue.sectionKey}|${issue.evidence}|${idx}`}
                issue={issue} canJump={canJump(issue.sectionKey)} onJump={onJump} disabled={busy}
                onFill={fillPlaceholder} onSetYear={setSourceYear} />
            ))}
          </div>
        )}
      </div>

      {confirmWarnings && report && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-[13px] text-amber-900 flex flex-wrap items-center gap-3" role="alert">
          <AlertTriangle size={18} className="text-amber-600 shrink-0" />
          <p className="flex-1 min-w-[220px]">
            {report.blockingRemaining} blocking issue{report.blockingRemaining > 1 ? 's' : ''} still need{report.blockingRemaining > 1 ? '' : 's'} your
            decision. The document can be downloaded, but it is a draft with these problems in it.
          </p>
          <button
            type="button"
            onClick={() => { setConfirmWarnings(false); void downloadNow() }}
            disabled={busy}
            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[12px] font-semibold disabled:opacity-60"
          >
            Download with warnings
          </button>
          <button type="button" onClick={() => setConfirmWarnings(false)} className="text-[12px] text-slate-600 hover:text-slate-900">
            Keep editing
          </button>
        </div>
      )}

      {report && !report.skipped && (
        <RepairResult
          report={report} undoing={undoing} openDiff={openDiff}
          onToggleDiff={id => setOpenDiff(openDiff === id ? null : id)}
          onUndo={undo} canJump={canJump} onJump={onJump}
        />
      )}
    </div>
  )
}

/** Which inline input an issue offers, if any. Only issues the student can resolve by typing a value get one. */
export function inlineInputFor(issue: ProposalIssue): 'placeholder' | 'year' | null {
  if (issue.type === 'placeholder_unresolved') return 'placeholder'
  if (issue.type === 'citation_matches_undated_source' && issue.literatureId) return 'year'
  return null
}

export function parseYear(text: string): number | null {
  const t = text.trim()
  if (!/^\d{4}$/.test(t)) return null
  const y = Number(t)
  return y >= 1500 && y <= new Date().getFullYear() + 1 ? y : null
}

function IssueRow({ issue, canJump, onJump, disabled, onFill, onSetYear }: {
  issue: ProposalIssue
  canJump: boolean
  onJump: (key: string) => void
  disabled: boolean
  onFill: (issue: ProposalIssue, value: string) => Promise<boolean>
  onSetYear: (issue: ProposalIssue, year: number) => Promise<boolean>
}) {
  const isBlocking = issue.severity === 'Blocking'
  const input = inlineInputFor(issue)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    try {
      if (input === 'year') {
        const year = parseYear(text)
        if (year === null) { toast.error('Enter a four-digit year, for example 2026.'); return }
        if (await onSetYear(issue, year)) setText('')
      } else if (text.trim()) {
        if (await onFill(issue, text.trim())) setText('')
      }
    } finally {
      setSaving(false)
    }
  }

  const ready = input === 'year' ? parseYear(text) !== null : text.trim().length > 0
  return (
    <div className={`rounded-lg px-3 py-2 text-[12.5px] ${isBlocking ? 'bg-red-50 border border-red-100' : 'bg-amber-50 border border-amber-100'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className={`font-semibold ${isBlocking ? 'text-red-800' : 'text-amber-800'}`}>
            {issueLabel(issue.type)} <span className="font-normal text-slate-500">· {issue.sectionKey}</span>
          </span>
          <span className="block text-slate-700 leading-snug">{issue.message}</span>
        </div>
        {canJump && (
          <button
            type="button"
            onClick={() => onJump(issue.sectionKey)}
            className="px-2.5 py-1 rounded bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-medium text-[11px] shrink-0 transition-colors"
          >
            Jump to {issue.sectionKey}
          </button>
        )}
      </div>
      {input && (
        <form
          className="mt-2 flex flex-wrap items-center gap-2"
          onSubmit={e => { e.preventDefault(); if (ready && !saving && !disabled) void submit() }}
        >
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            disabled={saving || disabled}
            inputMode={input === 'year' ? 'numeric' : undefined}
            maxLength={input === 'year' ? 4 : 500}
            placeholder={input === 'year' ? 'Publication year, e.g. 2026' : 'Type the real value to put here'}
            aria-label={input === 'year' ? 'Publication year' : 'Replacement text'}
            className={`min-w-0 rounded border border-slate-300 bg-white px-2 py-1 text-[12px] ${input === 'year' ? 'w-44' : 'flex-1 min-w-[200px]'}`}
          />
          <button
            type="submit"
            disabled={!ready || saving || disabled}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-900 text-white font-medium text-[11px] disabled:opacity-50"
          >
            {saving && <Loader2 size={11} className="animate-spin" />}
            {input === 'year' ? 'Set year' : 'Replace'}
          </button>
          <span className="text-[10.5px] text-slate-500">
            {input === 'year' ? "Read it from the publisher's page. An existing year is never overwritten." : 'Your text replaces the bracket exactly. You can undo it.'}
          </span>
        </form>
      )}
    </div>
  )
}

export function RepairResult({ report, undoing, openDiff, onToggleDiff, onUndo, canJump, onJump }: {
  report: RepairReport
  undoing: string | null
  openDiff: string | null
  onToggleDiff: (id: string) => void
  onUndo: (runId: string, repairId: string) => void
  canJump: (key: string) => boolean
  onJump: (key: string) => void
}) {
  return (
    <div className="p-4 rounded-xl bg-white border border-slate-200 flex flex-col gap-4" data-testid="repair-result">
      <h3 className="text-[14px] font-bold text-slate-800">What changed</h3>

      <section>
        <h4 className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-700 mb-2">
          <CheckCircle2 size={14} /> Fixed ({report.fixed.length})
        </h4>
        {report.fixed.length === 0 ? (
          <p className="text-[12px] text-slate-500">Nothing could be fixed automatically.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {report.fixed.map(item => {
              const lines = changedLines(item.before, item.after)
              const open = openDiff === item.repairId
              return (
                <li key={item.repairId} className="rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2 text-[12.5px]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="font-semibold text-slate-800">{item.sectionKey}</span>
                      <span className={`block leading-snug ${item.undone ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{item.description}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button type="button" onClick={() => onToggleDiff(item.repairId)}
                        className="inline-flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-900">
                        <ChevronDown size={12} className={open ? 'rotate-180' : ''} /> {open ? 'Hide' : 'Show'} changes
                      </button>
                      {item.undone ? (
                        <span className="text-[11px] text-slate-500">Undone</span>
                      ) : (
                        <button type="button" disabled={undoing !== null} onClick={() => onUndo(report.runId, item.repairId)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 text-[11px] text-slate-700 hover:bg-white disabled:opacity-60">
                          {undoing === item.repairId ? <Loader2 size={11} className="animate-spin" /> : <Undo2 size={11} />} Undo
                        </button>
                      )}
                    </div>
                  </div>
                  {open && (
                    <pre className="mt-2 max-h-56 overflow-auto rounded bg-white border border-slate-200 p-2 text-[11px] leading-relaxed whitespace-pre-wrap break-words">
                      {lines.length === 0 ? 'Only spacing changed.' : lines.map((l, i) => (
                        <span key={i} className={`block ${l.kind === 'removed' ? 'text-red-700 bg-red-50' : 'text-emerald-800 bg-emerald-50'}`}>
                          {l.kind === 'removed' ? '− ' : '+ '}{l.text}
                        </span>
                      ))}
                    </pre>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section>
        <h4 className="flex items-center gap-1.5 text-[12px] font-semibold text-amber-700 mb-2">
          <AlertTriangle size={14} /> Needs your attention ({report.needsUser.length})
        </h4>
        {report.needsUser.length === 0 ? (
          <p className="text-[12px] text-slate-500">Nothing else was flagged.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {report.needsUser.map((n, idx) => (
              <li key={`${n.issue.type}|${n.issue.sectionKey}|${idx}`} className="flex items-start justify-between gap-3 rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2 text-[12.5px]">
                <div className="min-w-0">
                  <span className="font-semibold text-slate-800">{issueLabel(n.issue.type)} · {n.issue.sectionKey}</span>
                  <span className="block text-slate-700 leading-snug">{n.issue.message}</span>
                  <span className="block text-[11px] text-slate-500">{n.reason}</span>
                </div>
                {canJump(n.issue.sectionKey) && (
                  <button type="button" onClick={() => onJump(n.issue.sectionKey)}
                    className="px-2.5 py-1 rounded bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-medium text-[11px] shrink-0">
                    Jump to {n.issue.sectionKey}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {report.unchangedSections.length > 0 && (
        <section>
          <h4 className="text-[12px] font-semibold text-slate-600 mb-1">Unchanged ({report.unchangedSections.length})</h4>
          <p className="text-[11.5px] text-slate-500">{report.unchangedSections.join(', ')}</p>
        </section>
      )}

      <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
        <Download size={11} /> This check does not validate the document for submission.
      </p>
    </div>
  )
}
