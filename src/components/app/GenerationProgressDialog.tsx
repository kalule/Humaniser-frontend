import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle, BookText, Check, Circle, Loader2, Minimize2, Maximize2, X,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import {
  buildProgressRows, estimateRemainingMs, formatClock, isGenerationActive,
  progressPercent, summarizeRows, type ProgressRow, type ProgressStep,
} from '../../lib/proposalGenerationProgress'
import type { GenerationPhase, ProjectSection } from '../../types/research'

// The live progress dialog for the one-click proposal generator. Purely presentational: it is fed
// the polled generation status and the project's sections and reports user intent (stop / done /
// open) back up. Generation itself is a server-side Hangfire job, so hiding this dialog never
// affects it — only Stop does.

export interface GenerationProgressProps {
  title:            string
  phase:            GenerationPhase
  completedCount:   number
  totalCount:       number
  currentSection:   string | null | undefined
  wordsWritten:     number
  failedCount:      number
  lastActivity?: string | null
  stalled:          boolean
  /** Per-section word target the run was started with. */
  targetWords:      number
  /** Epoch ms the run was first seen; null when unknown (e.g. reattached after a refresh). */
  startedAt:        number | null
  steps:            ProgressStep[]
  sections:         Pick<ProjectSection, 'code' | 'status' | 'wordCount' | 'generationError' | 'content' | 'title'>[]
  articleView:      boolean
  onToggleArticleView: () => void
  onStop:           () => void
  onDone:           () => void
  onResume?:        () => void
  resuming?:        boolean
  onOpenDocument:   () => void
}

const TERMINAL_MESSAGE: Partial<Record<GenerationPhase, string>> = {
  Error:       'The agent could not continue after automatic retries. Your completed sections are safe.',
  NeedsReview: 'Generation paused for evidence or consistency review. Review the current section in your workspace, then click Resume generation here.',
}

function headline(phase: GenerationPhase): string {
  switch (phase) {
    case 'Starting': return 'Waiting for generation worker?'
    case 'NotStarted': return 'Generation not started'
    case 'Completed':   return 'Proposal generated!'
    case 'Cancelled':   return 'Generation stopped'
    case 'Error':       return 'Generation stopped'
    case 'NeedsReview': return 'Proposal needs review'
    default:            return 'Generating proposal…'
  }
}

function RowIcon({ state }: { state: ProgressRow['state'] }) {
  if (state === 'complete') return <Check size={13} className="text-emerald-600" aria-hidden />
  if (state === 'drafting') return <Loader2 size={13} className="animate-spin text-[#7c3aed]" aria-hidden />
  if (state === 'failed')   return <AlertTriangle size={13} className="text-amber-600" aria-hidden />
  return <Circle size={9} className="text-slate-300" aria-hidden />
}

const STATE_LABEL: Record<ProgressRow['state'], string> = {
  queued: 'Queued', drafting: 'Drafting · gathering sources first', complete: 'Complete', failed: 'Needs retry',
}

function Row({ row, activity }: { row: ProgressRow; activity?: string | null }) {
  const ref = useRef<HTMLLIElement>(null)
  // Keep the section being written in view without fighting a user who has scrolled away: only
  // follows when it newly becomes the drafting row.
  useEffect(() => {
    if (row.state === 'drafting') ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [row.state])

  return (
    <li
      ref={ref}
      className={cn(
        'rounded-xl border px-3.5 py-2.5 transition-colors',
        row.state === 'drafting' && 'border-violet-200 bg-violet-50',
        row.state === 'complete' && 'border-emerald-100 bg-emerald-50/50',
        row.state === 'failed'   && 'border-amber-200 bg-amber-50',
        row.state === 'queued'   && 'border-slate-100 bg-white',
      )}
    >
      <div className="flex items-center gap-3">
        <span className="grid place-items-center w-5 h-5 shrink-0"><RowIcon state={row.state} /></span>
        <div className="min-w-0 flex-1">
          <p className={cn('text-[13px] font-medium truncate', row.state === 'queued' ? 'text-slate-500' : 'text-slate-800')}>
            {row.label}
          </p>
          <p className="text-[11px] text-slate-400">{row.state === 'drafting' && activity ? `Last activity: ${activity}` : STATE_LABEL[row.state]}</p>
        </div>
        <p className="text-[12px] tabular-nums text-slate-500 shrink-0">
          {row.state === 'complete' ? row.words.toLocaleString() : 0} / {row.target.toLocaleString()}
          <span className="text-slate-400"> words</span>
        </p>
      </div>
      {(row.state === 'drafting' || row.state === 'complete') && (
        <div className="mt-2 h-1 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={cn('h-full rounded-full', row.state === 'complete' ? 'w-full bg-emerald-500' : 'w-1/3 bg-[#7c3aed] animate-pulse')}
          />
        </div>
      )}
    </li>
  )
}

export function GenerationProgressDialog(props: GenerationProgressProps) {
  const {
    phase, completedCount, totalCount, currentSection, wordsWritten, failedCount, stalled,
    targetWords, startedAt, steps, sections, articleView, onDone,
  } = props
  const active = isGenerationActive(phase)

  const [minimized, setMinimized]       = useState(false)
  const [confirmStop, setConfirmStop]   = useState(false)

  // Whole-second clock while running; frozen at the moment the run ends so a finished run does
  // not keep counting.
  const [now, setNow] = useState(() => Date.now())
  const endedAtRef    = useRef<number | null>(null)
  useEffect(() => {
    if (!active) { endedAtRef.current ??= Date.now(); return }
    endedAtRef.current = null
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [active])

  const rows = useMemo(
    () => buildProgressRows({ steps, sections, currentSection, phase, targetWords }),
    [steps, sections, currentSection, phase, targetWords],
  )
  const fullyComplete = phase === 'Completed' && totalCount > 0 && completedCount >= totalCount && failedCount === 0
  const summary = summarizeRows(rows)
  const sectionTotal = rows.length || totalCount
  const totalTargetWords = targetWords * sectionTotal
  const percent = progressPercent(phase, completedCount, totalCount || sectionTotal)

  const clockEnd = active ? now : (endedAtRef.current ?? now)
  const elapsedMs = startedAt ? Math.max(0, clockEnd - startedAt) : null
  const remainingMs = active && elapsedMs !== null
    ? estimateRemainingMs({ elapsedMs, wordsWritten, totalTargetWords })
    : null

  // Escape hides a running dialog (never stops the job) and dismisses a finished one.
  useEffect(() => {
    if (minimized) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (active) setMinimized(true)
      else onDone()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [minimized, active, onDone])

  // A new run (or a run that finishes while hidden) should be visible again.
  useEffect(() => { if (!active) setMinimized(false); setConfirmStop(false) }, [active])

  const completedLabel = `${completedCount} of ${totalCount || sectionTotal} sections complete`

  if (minimized && active) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm mb-8 px-5 py-3.5 flex items-center gap-4" role="status" aria-live="polite">
        <Loader2 size={16} className="animate-spin text-[#7c3aed] shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-slate-800 truncate">
            Generating proposal — {completedLabel}
          </p>
          <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-[#7c3aed] transition-all duration-500" style={{ width: `${percent}%` }} />
          </div>
        </div>
        <span className="text-[12px] tabular-nums text-slate-500 shrink-0">{percent}%</span>
        <button
          onClick={() => setMinimized(false)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-[12px] font-medium text-slate-600 hover:bg-slate-50 transition-colors shrink-0"
        >
          <Maximize2 size={13} aria-hidden /> View progress
        </button>
      </div>
    )
  }

  const bannerMessage = TERMINAL_MESSAGE[phase]
  const hasContent = sections.some(s => s.content)

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="gen-progress-title"
        className="relative w-full max-w-[640px] max-h-[88vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
          <div className="flex items-start gap-3 min-w-0">
            <span className={cn(
              'grid place-items-center w-9 h-9 rounded-xl shrink-0',
              fullyComplete ? 'bg-emerald-50 text-emerald-600'
                : active ? 'bg-violet-50 text-[#7c3aed]' : 'bg-amber-50 text-amber-600',
            )}>
              {fullyComplete ? <Check size={18} aria-hidden />
                : active ? <Loader2 size={18} className="animate-spin" aria-hidden />
                : <AlertTriangle size={18} aria-hidden />}
            </span>
            <div className="min-w-0">
              <h2 id="gen-progress-title" className="text-[15px] font-semibold text-slate-900">{phase === 'Completed' && !fullyComplete ? 'Generation incomplete' : headline(phase)}</h2>
              <p className="text-[12px] text-slate-500 truncate" aria-live="polite">
                {completedLabel}
                {props.title ? <span className="text-slate-400"> · {props.title}</span> : null}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {hasContent && !active && (
              <button
                onClick={props.onToggleArticleView}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-[12px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <BookText size={13} aria-hidden /> {articleView ? 'Progress' : 'Article view'}
              </button>
            )}
            {active && (
              <button
                onClick={() => setMinimized(true)}
                aria-label="Hide progress — generation keeps running"
                title="Hide — generation keeps running"
                className="grid place-items-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <Minimize2 size={15} aria-hidden />
              </button>
            )}
            {!active && (
              <button
                onClick={props.onDone}
                aria-label="Close"
                className="grid place-items-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={15} aria-hidden />
              </button>
            )}
          </div>
        </div>

        {/* Progress summary */}
        <div className="px-6 pb-4">
          <div className="flex items-baseline justify-between text-[12px]">
            <span className="font-semibold text-slate-700 tabular-nums">{percent}% complete</span>
            <span className="text-slate-500 tabular-nums">
              {wordsWritten.toLocaleString()} / {totalTargetWords.toLocaleString()} words
            </span>
          </div>
          <div
            className="mt-1.5 h-2 rounded-full bg-slate-100 overflow-hidden"
            role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Proposal generation progress"
          >
            <div
              className={cn('h-full rounded-full transition-all duration-500', fullyComplete ? 'bg-emerald-500' : 'bg-[#7c3aed]')}
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400 tabular-nums">
            <span>{elapsedMs !== null ? `Elapsed: ${formatClock(elapsedMs)}` : ''}</span>
            <span>
              {active
                ? (remainingMs !== null ? `Estimated remaining: ~${formatClock(remainingMs)}` : 'Estimating remaining time…')
                : fullyComplete ? 'Remaining: ~0:00' : ''}
            </span>
          </div>
          {active && stalled && (
            <p className="mt-2 text-[12px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              This is taking longer than usual. Progress has not changed recently; generation may be processing evidence or waiting for recovery. Your saved sections are preserved.
            </p>
          )}
          {bannerMessage && (
            <p className="mt-2 text-[12px] text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">{bannerMessage}</p>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4 border-t border-slate-100 pt-4 bg-slate-50/40">
          {articleView ? (
            <div className="flex flex-col gap-5">
              {steps.filter(s => s.sectionKey).map(step => {
                const sec = sections.find(s => s.code === step.sectionKey)
                if (!sec?.content) return null
                return (
                  <div key={step.id}>
                    <p className="text-[13px] font-bold text-slate-800 mb-1.5">{sec.title || step.label}</p>
                    <p className="text-[13px] text-slate-600 leading-relaxed whitespace-pre-wrap">{sec.content}</p>
                  </div>
                )
              })}
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {rows.map(row => <Row key={row.code} row={row} activity={props.lastActivity} />)}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[12px] text-slate-500 flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" />{summary.completed} completed</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#7c3aed]" />{summary.inProgress} in progress</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-300" />{summary.pending} pending</span>
            {(summary.failed > 0 || failedCount > 0) && (
              <span className="inline-flex items-center gap-1.5 text-amber-700">
                <span className="w-2 h-2 rounded-full bg-amber-500" />{Math.max(summary.failed, failedCount)} need retry
              </span>
            )}
          </p>

          <div className="flex items-center gap-2">
            {active ? (
              confirmStop ? (
                <>
                  <span className="text-[12px] text-slate-500">Stop generating? Finished sections are kept.</span>
                  <button onClick={() => setConfirmStop(false)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-[12px] font-medium text-slate-600 hover:bg-slate-50">
                    Keep going
                  </button>
                  <button onClick={() => { setConfirmStop(false); props.onStop() }} className="px-3.5 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-[12px] font-semibold">
                    Stop
                  </button>
                </>
              ) : (
                <button onClick={() => setConfirmStop(true)} className="px-3.5 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-[12px] font-semibold transition-colors">
                  Stop
                </button>
              )
            ) : (
              <>
                {(['NeedsReview', 'Error', 'Cancelled'].includes(phase) || (phase === 'Completed' && !fullyComplete)) && props.onResume && (
                  <button onClick={props.onResume} disabled={props.resuming} className="px-4 py-1.5 rounded-lg bg-[#7c3aed] hover:bg-[#4c1d95] text-white text-[12px] font-semibold transition-colors disabled:opacity-50">
                    {props.resuming ? 'Resuming...' : 'Resume generation'}
                  </button>
                )}
                <button onClick={props.onOpenDocument} className="px-4 py-1.5 rounded-lg bg-[#7c3aed] hover:bg-[#4c1d95] text-white text-[12px] font-semibold transition-colors">
                  {fullyComplete ? 'Continue' : phase === 'NeedsReview' ? 'Review in workspace' : 'Open document'}
                </button>
                <button onClick={props.onDone} className="px-4 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-[12px] font-semibold transition-colors">
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
