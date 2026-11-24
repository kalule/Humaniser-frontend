import { memo, useEffect, useState, type ReactNode } from 'react'
import { ArrowDown, Check, Circle, Play, Square, X } from 'lucide-react'
import type { GenerationStatus, ProjectSection } from '../../../types/research'
import type { DraftAction } from '../../../lib/draftPlan'
import { useLiveDraft } from '../../../lib/liveDraftStore'
import { isRunActive } from '../../../lib/proposalRun'
import type { DocumentCounts } from '../../../lib/documentOutline'
import type { ActivityEntry } from './DocumentModeView'

/** The automatic whole-proposal run, when this project has one. */
export interface RunInfo {
  status:   GenerationStatus
  /** Section label for the run's current section ("1.2 Background"), if known. */
  currentLabel: string | null
  resuming: boolean
  stopping: boolean
  onResume: () => void
  onStop:   () => void
}

interface Props {
  run?:         RunInfo | null
  projectId:    string
  writing:      ProjectSection[]
  /** Flagged sections in reading order (empty when flag counts are hidden). */
  flagGroups:   FlagGroup[]
  onNextFlag:   () => void
  /** First section waiting for review, if any. */
  nextReview:   ProjectSection | null
  /** The next chapter (or section) to draft, with whether it may be drafted now. */
  draftAction:  DraftAction | null
  /** Sections still waiting in the chapter being drafted. */
  queued:       string[]
  onDraftAction: () => void
  targetWords:  number
  activity:     ActivityEntry[]
  onJump:       (code: string) => void
  /** Sections drafted or edited since the last alignment check. */
  staleAlignment: string[]
  isValidating: boolean
  onCheckAlignment: () => void
  /** The opt-in "draft ahead, review later" setting for Chapters 1-3. */
  draftAhead:   boolean
  onToggleDraftAhead: () => void
  /** The document's own section counts: the same numbers the outline shows. */
  counts:       DocumentCounts
  /** Stops everything: the whole-proposal run, every section being drafted, and the queue. */
  onStopAll:    () => void
  stoppingAll:  boolean
  /** Pinned design contract panel, shown first. */
  contract?:    ReactNode
  /** Review issues card. */
  review?:      ReactNode
}

export interface FlagGroup { code: string; label: string; count: number }

/** Rows shown before "Show all": enough to act on, short enough not to crowd Up next. */
const FLAG_ROWS = 5

/** Things to check, by section, in reading order. Calm styling: a to-do list, not an alarm. */
function FlagsCard({ groups, onJump, onNextFlag }: { groups: FlagGroup[]; onJump: (key: string) => void; onNextFlag: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const total = groups.reduce((n, g) => n + g.count, 0)
  const shown = expanded ? groups : groups.slice(0, FLAG_ROWS)
  return (
    <section aria-label="Things to check" className="rounded-[10px] p-3.5" style={{ border: '0.5px solid var(--border-strong)' }}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--color-amber)' }} />
            {total} thing{total === 1 ? '' : 's'} to check
          </div>
          <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>in {groups.length} section{groups.length === 1 ? '' : 's'}</div>
        </div>
        <button type="button" onClick={onNextFlag}
          className="dm-action shrink-0 inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold"
          style={{ border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}>
          Next <ArrowDown size={12} aria-hidden="true" />
        </button>
      </div>
      <ul className="list-none m-0 p-0 flex flex-col">
        {shown.map(g => (
          <li key={g.code}>
            <button type="button" onClick={() => onJump(g.code)}
              aria-label={`${g.label}: ${g.count} to check`}
              className="dm-action w-full flex items-center gap-2 rounded-md px-1.5 py-1 text-left text-[12px] hover:bg-slate-50">
              <span className="flex-1 min-w-0 truncate" style={{ color: 'var(--text-secondary)' }}>{g.label}</span>
              <span className="shrink-0 text-[11px] font-semibold rounded-full px-1.5" style={{ background: 'var(--color-amber-tint)', color: 'var(--color-amber-text)' }}>{g.count}</span>
            </button>
          </li>
        ))}
      </ul>
      {groups.length > FLAG_ROWS && (
        <button type="button" onClick={() => setExpanded(e => !e)} aria-expanded={expanded}
          className="dm-action mt-1 px-1.5 text-[12px] font-semibold hover:underline" style={{ color: 'var(--color-purple-text)' }}>
          {expanded ? 'Show fewer' : `Show all ${groups.length} sections`}
        </button>
      )}
    </section>
  )
}

const label = (s: ProjectSection) => `${s.displayCode || s.code} ${s.title}`

function Mark({ state }: { state: ActivityEntry['state'] }) {
  if (state === 'done') return <Check size={13} className="mt-0.5 shrink-0" aria-label="Done" style={{ color: 'var(--color-green)' }} />
  if (state === 'error') return <X size={13} className="mt-0.5 shrink-0" aria-label="Problem" style={{ color: 'var(--color-red)' }} />
  return <Circle size={9} className="dm-pulse mt-1 shrink-0" aria-label="In progress" fill="var(--color-purple)" style={{ color: 'var(--color-purple)' }} />
}

/** The section being drafted: progress, sources read, and what the run is doing. Watches only its own stream. */
function NowDrafting({ projectId, section, targetWords, queued, onJump }: {
  projectId: string; section: ProjectSection; targetWords: number; queued: string[]
  onJump: (code: string) => void
}) {
  const live = useLiveDraft(projectId, section.code)
  const pct = Math.min(100, Math.round((live.words / Math.max(1, targetWords)) * 100))
  const steps: ActivityEntry[] = [
    ...live.activities.map((a, i) => ({ id: `a${i}`, text: a, state: 'done' as const })),
    { id: 'draft', text: 'Drafting the section', state: live.streamEnded ? 'done' : 'active' },
    ...(live.streamEnded ? [{ id: 'check', text: 'Checking citations and claims', state: 'active' as const }] : []),
  ]
  return (
    <div className="rounded-[10px] p-3.5" style={{ border: '0.5px solid var(--border-strong)' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[12px] mb-1" style={{ color: 'var(--text-secondary)' }}>Now drafting</div>
          <button type="button" onClick={() => onJump(section.code)} className="dm-action text-left text-[14px] font-semibold hover:underline" style={{ color: 'var(--text-primary)' }}>
            {label(section)}
          </button>
        </div>
      </div>
      <div className="h-1.5 rounded-full mt-2.5" style={{ background: 'var(--surface-rail)' }}
        role="progressbar" aria-valuemin={0} aria-valuemax={targetWords} aria-valuenow={live.words} aria-label={`${live.words} of about ${targetWords} words`}>
        <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: 'var(--color-purple)', transition: 'width .2s' }} />
      </div>
      <div className="flex justify-between text-[12px] mt-2" style={{ color: 'var(--text-secondary)' }}>
        <span>{live.words.toLocaleString()} of about {targetWords.toLocaleString()} words</span>
        {live.sourcesRead !== null && <span>{live.sourcesRead} source{live.sourcesRead === 1 ? '' : 's'} read</span>}
      </div>
      <ul className="list-none m-0 mt-3 p-0 flex flex-col gap-1.5 text-[12px] leading-[1.4]" style={{ color: 'var(--text-secondary)' }} aria-live="polite">
        {steps.map(step => <li key={step.id} className="flex gap-2"><Mark state={step.state} />{step.text}</li>)}
      </ul>
      {queued.length > 0 && (
        <p className="m-0 mt-2.5 text-[12px]" style={{ color: 'var(--text-muted)' }}>Then: {queued.join(', ')}</p>
      )}
    </div>
  )
}

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * The whole-proposal run at a glance: what it is writing, how far it is, and, when it pauses for
 * review, which section to look at and a Resume button. The section text itself streams into the
 * document, not here.
 */
function RunCard({ run, counts, onJump }: { run: RunInfo; counts: DocumentCounts; onJump: (code: string) => void }) {
  const { status } = run
  const active = isRunActive(status)
  const started = status.runStartedAt ? Date.parse(status.runStartedAt) : NaN
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [active])
  // The document's count, not the run's: the run covers only the sections it writes (25 of 27).
  const total = Math.max(counts.total, 1)
  const done = Math.min(counts.drafted, total)
  const pct = Math.min(100, Math.round((done / total) * 100))
  const code = status.currentSection
  const where = run.currentLabel ?? code

  const title = active ? (status.status === 'Starting' ? 'Starting the run' : 'Writing your proposal')
    : status.status === 'NeedsReview' ? 'Paused for your review'
    : status.status === 'Completed' ? 'Proposal written'
    : status.status === 'Cancelled' ? 'Run stopped'
    : 'Run stopped by an error'
  const note = status.status === 'NeedsReview'
    ? `${where ?? 'A section'} needs your review before the run can go on. Read it, fix or approve it, then resume.`
    : status.status === 'Error' ? 'The run could not continue. Your written sections are kept; you can try again.'
    : status.status === 'Cancelled' ? 'Written sections are kept. Resume to carry on from the next unwritten section.'
    : status.status === 'Completed' ? 'Every section is drafted. Review each one and approve it.'
    : null
  const dot = active ? 'var(--color-purple)' : status.status === 'Completed' ? 'var(--color-green)' : 'var(--color-amber)'

  return (
    <section aria-label="Whole-proposal run" className="rounded-[10px] p-3.5" style={{ border: '0.5px solid var(--border-strong)' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }} aria-live="polite">
            <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? 'dm-pulse' : ''}`} style={{ background: dot }} />
            <span className="truncate">{title}</span>
          </div>
          <div className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {done} of {total} sections drafted · {status.wordsWritten.toLocaleString()} words
            {active && Number.isFinite(started) && <> · {clock(now - started)}</>}
          </div>
        </div>
        {!active && status.status !== 'Completed' && (
          <button type="button" onClick={run.onResume} disabled={run.resuming}
            className="dm-action shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60"
            style={{ background: 'var(--color-purple)' }}>
            <Play size={10} aria-hidden="true" /> {run.resuming ? 'Resuming…' : 'Resume'}
          </button>
        )}
      </div>
      <div className="h-1.5 rounded-full mt-2.5" style={{ background: 'var(--surface-rail)' }}
        role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label={`${done} of ${total} sections drafted`}>
        <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: dot, transition: 'width .3s' }} />
      </div>
      {active && status.lastActivity && (
        <p className="m-0 mt-2 text-[12px] leading-[1.45] truncate" style={{ color: 'var(--text-secondary)' }} title={status.lastActivity}>{status.lastActivity}</p>
      )}
      {note && <p className="m-0 mt-2 text-[12px] leading-[1.5]" style={{ color: 'var(--text-secondary)' }}>{note}</p>}
      {!active && code && status.status === 'NeedsReview' && (
        <button type="button" onClick={() => onJump(code)}
          className="dm-action mt-2 text-[12px] font-semibold hover:underline" style={{ color: 'var(--color-purple-text)' }}>
          Go to {where}
        </button>
      )}
    </section>
  )
}

function DocumentAgentPanelImpl({
  run, projectId, writing, flagGroups, onNextFlag, nextReview, draftAction, queued, onDraftAction, targetWords,
  activity, onJump, staleAlignment, isValidating, onCheckAlignment, draftAhead, onToggleDraftAhead,
  counts, onStopAll, stoppingAll, contract, review,
}: Props) {
  const runActive = isRunActive(run?.status)
  const busy = writing.length > 0 || queued.length > 0 || runActive

  return (
    <aside aria-label="Agent" className="h-full flex flex-col gap-4 p-[18px] overflow-y-auto dm-scroll">
      <div className="flex items-center justify-between gap-2 min-h-[30px]">
        <h2 className="m-0 text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>Agent</h2>
        {busy && (
          <button type="button" onClick={onStopAll} disabled={stoppingAll}
            className="dm-action shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold disabled:opacity-60"
            style={{ border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}
            aria-label="Stop all drafting">
            <Square size={10} aria-hidden="true" /> {stoppingAll ? 'Stopping…' : 'Stop all'}
          </button>
        )}
      </div>

      {contract}

      {run && <RunCard run={run} counts={counts} onJump={onJump} />}

      {/* One card per section being drafted (writing is already one entry per section code). */}
      {writing.length > 0 ? writing.map(s => (
        <NowDrafting key={s.code} projectId={projectId} section={s} targetWords={targetWords} queued={queued} onJump={onJump} />
      )) : runActive ? (
        <p className="m-0 text-[13px]" style={{ color: 'var(--text-secondary)' }}>Checking the last section and preparing the next one…</p>
      ) : (
        <p className="m-0 text-[13px]" style={{ color: 'var(--text-secondary)' }}>Nothing is being drafted right now.</p>
      )}

      {activity.length > 0 && (
        <div>
          <div className="text-[11px] font-semibold tracking-[0.08em] mb-2" style={{ color: 'var(--text-secondary)' }}>ACTIVITY</div>
          <ul className="list-none m-0 p-0 flex flex-col gap-2 text-[13px] leading-[1.4]" style={{ color: 'var(--text-secondary)' }}>
            {activity.map(a => <li key={a.id} className="flex gap-2"><Mark state={a.state === 'active' ? 'done' : a.state} />{a.text}</li>)}
          </ul>
        </div>
      )}

      {staleAlignment.length > 0 && !runActive && (
        <div className="rounded-[10px] px-3.5 py-3 flex flex-col gap-2" style={{ border: '0.5px solid var(--border-strong)' }}>
          <p className="m-0 text-[12px] leading-[1.5]" style={{ color: 'var(--text-secondary)' }}>
            Alignment has not been checked since {staleAlignment.join(', ')} {staleAlignment.length === 1 ? 'was' : 'were'} drafted or edited.
          </p>
          <button type="button" onClick={onCheckAlignment} disabled={isValidating}
            className="dm-action self-start rounded-lg px-3 py-1.5 text-[12px] font-semibold disabled:opacity-60"
            style={{ border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}>
            {isValidating ? 'Checking…' : 'Check alignment'}
          </button>
        </div>
      )}

      {review}

      {flagGroups.length > 0 && <FlagsCard groups={flagGroups} onJump={onJump} onNextFlag={onNextFlag} />}

      {/* While the whole-proposal run is writing, it owns drafting and approval: nothing here for the student to do. */}
      {!runActive && <div className="mt-auto rounded-[10px] p-3.5 flex flex-col gap-2.5" style={{ border: '0.5px solid var(--border-strong)' }}>
        <div className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>Up next</div>
        {nextReview && (
          <button type="button" onClick={() => onJump(nextReview.code)}
            className="dm-action rounded-lg px-3.5 py-2 text-[13px] text-left hover:bg-slate-50"
            style={{ border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}>
            <span className="block font-semibold truncate">Review {label(nextReview)}</span>
            <span className="block text-[12px]" style={{ color: 'var(--text-secondary)' }}>Approve it, or rewrite it.</span>
          </button>
        )}
        {draftAction ? (
          <>
            {!draftAction.decision.allowed && (
              <p className="m-0 text-[12px] leading-[1.5]" style={{ color: 'var(--text-secondary)' }}>{draftAction.decision.reason}</p>
            )}
            <button type="button" disabled={!draftAction.decision.allowed || busy} onClick={onDraftAction}
              className="dm-action rounded-lg px-3.5 py-2 text-[13px] font-semibold text-left disabled:cursor-not-allowed"
              style={draftAction.decision.allowed && !busy ? { background: 'var(--color-purple)', color: 'white' } : { background: 'var(--surface-rail)', color: 'var(--text-secondary)' }}>
              {draftAction.label}
              {!draftAction.decision.allowed && <span className="sr-only"> (unavailable: {draftAction.decision.reason})</span>}
              {draftAction.decision.allowed && busy && <span className="sr-only"> (available when the current draft finishes)</span>}
            </button>
            {draftAction.decision.allowed && draftAction.codes.length > 1 && (
              <p className="m-0 text-[12px] leading-[1.5]" style={{ color: 'var(--text-muted)' }}>Each finished section stops at Needs review.</p>
            )}
          </>
        ) : !nextReview && (
          <p className="m-0 text-[12px]" style={{ color: 'var(--text-secondary)' }}>Every available section is drafted.</p>
        )}
        <div className="flex items-start gap-2.5 pt-2.5" style={{ borderTop: '0.5px solid var(--border-hairline)' }}>
          <button type="button" role="switch" aria-checked={draftAhead} onClick={onToggleDraftAhead}
            aria-describedby="draft-ahead-help"
            className="dm-action shrink-0 mt-0.5 relative w-8 h-[18px] rounded-full transition-colors"
            style={{ background: draftAhead ? 'var(--color-purple)' : 'var(--border-strong)' }}>
            <span className="sr-only">Draft ahead, review later</span>
            <span aria-hidden="true" className="absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-all" style={{ left: draftAhead ? 16 : 2 }} />
          </button>
          <div>
            <div className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>Draft ahead, review later {draftAhead ? '· On' : '· Off'}</div>
            <p id="draft-ahead-help" className="m-0 text-[11px] leading-[1.45]" style={{ color: 'var(--text-muted)' }}>
              Chapters 1 to 3 draft without waiting for approval. Chapter 4 onward and Results always wait.
            </p>
          </div>
        </div>
      </div>}
    </aside>
  )
}

export const DocumentAgentPanel = memo(DocumentAgentPanelImpl)
