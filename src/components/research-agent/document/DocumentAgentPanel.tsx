import { memo, useState, type ReactNode } from 'react'
import { AlertTriangle, ArrowDown, Check, ChevronDown, ChevronRight, Circle, Download, Pause, Play, X } from 'lucide-react'
import type { GenerationStatus, ProjectSection } from '../../../types/research'
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

/**
 * The one thing the student should do now, shown first in the panel with its only primary button.
 * Chosen in DocumentModeView, in this order: set the key study decisions (drafting waits for them);
 * run the final review once every section is drafted; review the next drafted section; draft the
 * rest (or resume); export when everything is approved; otherwise nothing (the agent is working).
 */
export type NextStep =
  | { kind: 'decisions' }
  | { kind: 'final_review' }
  | { kind: 'review'; section: ProjectSection; more: number }
  | { kind: 'draft'; remaining: number }
  | { kind: 'resume' }
  | { kind: 'export' }
  | { kind: 'waiting' }

interface Props {
  run?:         RunInfo | null
  projectId:    string
  writing:      ProjectSection[]
  /** Flagged sections in reading order (empty when flag counts are hidden). */
  flagGroups:   FlagGroup[]
  onNextFlag:   () => void
  nextStep:     NextStep
  /** Sections still waiting in the agent's queue. */
  queued:       string[]
  /** Words a section is drafted to (a proposal section: its share of the fixed length). */
  wordsFor:     (code: string) => number
  activity:     ActivityEntry[]
  onJump:       (code: string) => void
  /** Sections drafted or edited since the last consistency check. */
  staleAlignment: string[]
  isValidating: boolean
  onCheckAlignment: () => void
  /** The opt-in "draft ahead, review later" setting, shown only while chapter order is enforced. */
  draftAhead:   boolean
  showDraftAhead: boolean
  onToggleDraftAhead: () => void
  /** The document's own section counts: the same numbers the outline shows. */
  counts:       DocumentCounts
  onPause:      () => void
  pausing:      boolean
  /** Something was paused (a queue or the whole-proposal run) and can be resumed. */
  paused:       boolean
  onResume:     () => void
  onDraftAll:   () => void
  onExport:     () => void
  isExporting:  boolean
  /** The Study decisions card. Rendered as the Next step when nextStep is 'decisions'. */
  decisions:    ReactNode
  /** The whole-document review, rendered inside the Next step card when nextStep is 'final_review'. */
  review:       ReactNode
}

export interface FlagGroup { code: string; label: string; count: number }

/** Rows shown before "Show all". */
const FLAG_ROWS = 5

const secondary = 'dm-action shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold disabled:opacity-60'
const secondaryStyle = { border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }
const primary = 'dm-action self-start inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold text-white disabled:opacity-60'
const primaryStyle = { background: 'var(--color-purple)' }

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
        <button type="button" onClick={onNextFlag} className={secondary} style={secondaryStyle}>
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

/** The Next step card frame: accent border and a "Next step" eyebrow. */
function NextStepFrame({ children }: { children: ReactNode }) {
  return (
    <section aria-label="Next step" className="rounded-[10px] p-3.5 flex flex-col gap-2" style={{ border: '1.5px solid var(--color-purple)' }}>
      <div className="text-[11px] font-semibold tracking-[0.08em]" style={{ color: 'var(--color-purple-text)' }}>NEXT STEP</div>
      {children}
    </section>
  )
}

function NextStepCard({ step, review, onJump, onDraftAll, onResume, onExport, isExporting, resuming }: {
  step: NextStep; review: ReactNode; onJump: (code: string) => void; onDraftAll: () => void; onResume: () => void
  onExport: () => void; isExporting: boolean; resuming: boolean
}) {
  switch (step.kind) {
    case 'decisions':
      return null // the Study decisions card is the Next step itself
    case 'final_review':
      return <NextStepFrame>{review}</NextStepFrame>
    case 'review':
      return (
        <NextStepFrame>
          <div className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>Review {label(step.section)}</div>
          <p className="m-0 text-[12px] leading-[1.45]" style={{ color: 'var(--text-secondary)' }}>
            Read it, then approve or rewrite it{step.more > 0 ? `. ${step.more} more after this one` : ''}
          </p>
          <button type="button" onClick={() => onJump(step.section.code)} className={primary} style={primaryStyle}>
            Go to {step.section.displayCode || step.section.code}
          </button>
        </NextStepFrame>
      )
    case 'draft':
      return (
        <NextStepFrame>
          <div className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            {step.remaining} section{step.remaining === 1 ? '' : 's'} still to draft
          </div>
          <p className="m-0 text-[12px] leading-[1.45]" style={{ color: 'var(--text-secondary)' }}>
            The agent drafts them in order. Each stops at Ready for review; nothing is approved for you
          </p>
          <button type="button" onClick={onDraftAll} className={primary} style={primaryStyle}>Draft all remaining</button>
        </NextStepFrame>
      )
    case 'resume':
      return (
        <NextStepFrame>
          <div className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>Drafting is paused</div>
          <p className="m-0 text-[12px] leading-[1.45]" style={{ color: 'var(--text-secondary)' }}>
            Text written so far is kept. Resume to carry on from the next unwritten section
          </p>
          <button type="button" onClick={onResume} disabled={resuming} className={primary} style={primaryStyle} aria-label="Resume drafting">
            <Play size={11} aria-hidden="true" /> {resuming ? 'Resuming…' : 'Resume'}
          </button>
        </NextStepFrame>
      )
    case 'export':
      return (
        <NextStepFrame>
          <div className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>Every section is approved</div>
          <p className="m-0 text-[12px] leading-[1.45]" style={{ color: 'var(--text-secondary)' }}>Export the proposal as a Word document</p>
          <button type="button" onClick={onExport} disabled={isExporting} className={primary} style={primaryStyle}>
            <Download size={12} aria-hidden="true" /> {isExporting ? 'Exporting…' : 'Export .docx'}
          </button>
        </NextStepFrame>
      )
    case 'waiting':
    default:
      return (
        <section aria-label="Next step" className="rounded-[10px] px-3.5 py-3" style={{ border: '0.5px solid var(--border-strong)' }}>
          <div className="text-[11px] font-semibold tracking-[0.08em] mb-1" style={{ color: 'var(--text-secondary)' }}>NEXT STEP</div>
          <p className="m-0 text-[13px]" style={{ color: 'var(--text-secondary)' }}>Nothing needed from you right now. The agent is drafting</p>
        </section>
      )
  }
}

/** One line under the drafting progress bar: sources read, then what the agent is doing. */
function LiveLine({ projectId, section, targetWords }: { projectId: string; section: ProjectSection; targetWords: number }) {
  const live = useLiveDraft(projectId, section.code)
  const pct = Math.min(100, Math.round((live.words / Math.max(1, targetWords)) * 100))
  const doing = live.streamEnded ? 'checking citations and claims'
    : live.words > 0 ? 'writing'
    : (live.activities[live.activities.length - 1] ?? 'finding sources').toLowerCase()
  const sources = live.sourcesRead !== null ? `${live.sourcesRead} source${live.sourcesRead === 1 ? '' : 's'} read · ` : ''
  return (
    <>
      <div className="h-1.5 rounded-full mt-2" style={{ background: 'var(--surface-rail)' }}
        role="progressbar" aria-valuemin={0} aria-valuemax={targetWords} aria-valuenow={live.words} aria-label={`${live.words} of about ${targetWords} words`}>
        <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: 'var(--color-purple)', transition: 'width .2s' }} />
      </div>
      <p className="m-0 mt-1.5 text-[12px] truncate" style={{ color: 'var(--text-secondary)' }} aria-live="polite">{sources}{doing}</p>
    </>
  )
}

/**
 * What the agent is doing, compactly: the section being drafted (with a live progress line), how
 * many are waiting, and Pause. After a pause it says so; Resume lives in the Next step card.
 */
function DraftingCard({ projectId, writing, queued, run, counts, wordsFor, onJump, onPause, pausing, paused, onResume }: {
  projectId: string; writing: ProjectSection[]; queued: string[]; run: RunInfo | null | undefined; counts: DocumentCounts
  wordsFor: (code: string) => number; onJump: (code: string) => void; onPause: () => void; pausing: boolean; paused: boolean
  /** Set when the Next step card is showing something else, so Resume stays reachable here (secondary). */
  onResume?: () => void
}) {
  const runActive = isRunActive(run?.status)
  const busy = writing.length > 0 || queued.length > 0 || runActive
  const current = writing[0]
  const runError = run?.status.status === 'Error'
  if (!busy && !paused && !runError) return null
  return (
    <section aria-label="Drafting" className="rounded-[10px] p-3.5" style={{ border: '0.5px solid var(--border-strong)' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
            <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full shrink-0 ${busy ? 'dm-pulse' : ''}`}
              style={{ background: busy ? 'var(--color-purple)' : 'var(--color-amber)' }} />
            {busy ? 'Drafting' : runError ? 'Stopped by an error' : run?.status.status === 'NeedsReview' ? 'Paused for your review' : 'Paused'}
            {runActive && <span> · {Math.min(counts.drafted, counts.total)} of {counts.total} drafted</span>}
          </div>
          {current ? (
            <button type="button" onClick={() => onJump(current.code)} className="dm-action text-left text-[13px] font-semibold hover:underline truncate max-w-full" style={{ color: 'var(--text-primary)' }}>
              {label(current)}{writing.length > 1 ? ` +${writing.length - 1} more` : ''}
            </button>
          ) : busy ? (
            <div className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>Preparing the next section…</div>
          ) : (
            <div className="text-[12px] leading-[1.45]" style={{ color: 'var(--text-secondary)' }}>
              {runError ? 'Written sections are kept; you can try again.' : 'Text written so far is kept for review.'}
            </div>
          )}
        </div>
        {busy ? (
          <button type="button" onClick={onPause} disabled={pausing} className={secondary} style={secondaryStyle} aria-label="Pause drafting">
            <Pause size={10} aria-hidden="true" /> {pausing ? 'Pausing…' : 'Pause'}
          </button>
        ) : onResume && (paused || runError) && (
          <button type="button" onClick={onResume} disabled={run?.resuming} className={secondary} style={secondaryStyle} aria-label="Resume drafting">
            <Play size={10} aria-hidden="true" /> {run?.resuming ? 'Resuming…' : 'Resume'}
          </button>
        )}
      </div>
      {current && <LiveLine projectId={projectId} section={current} targetWords={wordsFor(current.code)} />}
      {!current && runActive && run?.status.lastActivity && (
        <p className="m-0 mt-1.5 text-[12px] truncate" style={{ color: 'var(--text-secondary)' }} title={run.status.lastActivity}>{run.status.lastActivity}</p>
      )}
      {busy && queued.length > 0 && (
        <p className="m-0 mt-1.5 text-[12px]" style={{ color: 'var(--text-muted)' }}>Then {queued.length} more, in order</p>
      )}
    </section>
  )
}

/** "1.0 changed since the last check" in one line, with a link to check. */
function ConsistencyLine({ codes, isValidating, onCheck }: { codes: string[]; isValidating: boolean; onCheck: () => void }) {
  const named = codes.length <= 3 ? codes.join(', ') : `${codes.slice(0, 2).join(', ')} and ${codes.length - 2} more`
  return (
    <p className="m-0 flex items-start gap-1.5 text-[12px] leading-[1.45]" style={{ color: 'var(--text-secondary)' }} role="status">
      <AlertTriangle size={12} className="mt-[2px] shrink-0" aria-hidden="true" style={{ color: 'var(--color-amber)' }} />
      <span>
        {named} changed since the last check. Sections may drift apart.{' '}
        <button type="button" onClick={onCheck} disabled={isValidating}
          className="dm-action font-semibold hover:underline disabled:opacity-60" style={{ color: 'var(--color-purple-text)' }}>
          {isValidating ? 'Checking…' : 'Check consistency'}
        </button>
      </span>
    </p>
  )
}

/** The activity log, collapsed by default. */
function ActivityLog({ activity }: { activity: ActivityEntry[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls="agent-activity"
        className="dm-action inline-flex items-center gap-1 text-[11px] font-semibold tracking-[0.08em]" style={{ color: 'var(--text-secondary)' }}>
        {open ? <ChevronDown size={12} aria-hidden="true" /> : <ChevronRight size={12} aria-hidden="true" />}
        ACTIVITY <span className="font-normal tracking-normal" style={{ color: 'var(--text-muted)' }}>· {activity.length}</span>
      </button>
      {open && (
        <ul id="agent-activity" className="list-none m-0 mt-2 p-0 flex flex-col gap-2 text-[13px] leading-[1.4]" style={{ color: 'var(--text-secondary)' }}>
          {activity.map(a => <li key={a.id} className="flex gap-2"><Mark state={a.state === 'active' ? 'done' : a.state} />{a.text}</li>)}
        </ul>
      )}
    </div>
  )
}

/**
 * The agent panel, top to bottom: the Next step (the one thing to do now, the panel's only primary
 * button), what the agent is drafting, a one-line consistency warning, the Study decisions (when
 * they are not the next step), and the activity log, collapsed.
 */
function DocumentAgentPanelImpl({
  run, projectId, writing, flagGroups, onNextFlag, nextStep, queued, wordsFor,
  activity, onJump, staleAlignment, isValidating, onCheckAlignment, draftAhead, showDraftAhead, onToggleDraftAhead,
  counts, onPause, pausing, paused, onResume, onDraftAll, onExport, isExporting, decisions, review,
}: Props) {
  const runActive = isRunActive(run?.status)

  return (
    <aside aria-label="Agent" className="h-full flex flex-col gap-4 p-[18px] overflow-y-auto dm-scroll">
      <h2 className="m-0 text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>Agent</h2>

      {nextStep.kind === 'decisions' && decisions}
      <NextStepCard step={nextStep} review={review} onJump={onJump} onDraftAll={onDraftAll} onResume={onResume}
        onExport={onExport} isExporting={isExporting} resuming={run?.resuming ?? false} />

      <DraftingCard projectId={projectId} writing={writing} queued={queued} run={run} counts={counts} wordsFor={wordsFor}
        onJump={onJump} onPause={onPause} pausing={pausing} paused={paused}
        onResume={nextStep.kind === 'resume' ? undefined : onResume} />

      {staleAlignment.length > 0 && !runActive && (
        <ConsistencyLine codes={staleAlignment} isValidating={isValidating} onCheck={onCheckAlignment} />
      )}

      {nextStep.kind !== 'decisions' && decisions}

      {flagGroups.length > 0 && <FlagsCard groups={flagGroups} onJump={onJump} onNextFlag={onNextFlag} />}

      {activity.length > 0 && <ActivityLog activity={activity} />}

      {showDraftAhead && (
        <div className="mt-auto flex items-start gap-2.5 pt-2.5" style={{ borderTop: '0.5px solid var(--border-hairline)' }}>
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
      )}
    </aside>
  )
}

export const DocumentAgentPanel = memo(DocumentAgentPanelImpl)
