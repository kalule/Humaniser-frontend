import { Check, Circle, CircleDashed, Contrast, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { ESSAY_COVERAGE_TEXT, ESSAY_PHASES, visibleSources, type EssayCoverageState, type EssayPart } from '../../lib/essayProgress'
import type { EssaySourceBrief } from '../../types/workbench'

export interface EssayProgressPanelProps {
  topic: string
  academicLevel: string
  wordCount: number
  /** The furthest phase reached (0-2); it never moves back. */
  phase: number
  /** What is happening now, from the stage the stream last sent. */
  detail: string | null
  elapsedText: string
  /** The parts of the question, once the stream has sent them. Empty with an older server. */
  parts: EssayPart[]
  /** The latest coverage state per part id. A part with no entry is shown as not checked yet. */
  coverage: Record<string, EssayCoverageState>
  /** Sources that passed evidence checking so far, in the order found. */
  sources: EssaySourceBrief[]
}

/** Icon for a coverage state. Every state also has its text next to it, so the colour is never the only signal. */
function CoverageIcon({ state }: { state: EssayCoverageState }) {
  const common = { size: 14, className: 'mt-[2px] shrink-0', 'aria-hidden': true } as const
  switch (state) {
    case 'supported': return <Check {...common} className={cn(common.className, 'text-emerald-600')} data-state="supported" />
    case 'partial': return <Contrast {...common} className={cn(common.className, 'text-slate-500')} data-state="partial" />
    case 'unsupported': return <CircleDashed {...common} className={cn(common.className, 'text-slate-400')} data-state="unsupported" />
    default: return <Circle {...common} className={cn(common.className, 'text-slate-300')} data-state="unknown" />
  }
}

/**
 * The essay progress screen in the Write with AI dialog. Shows only what the pipeline has established: the phase reached, the stage's own
 * counts, the parts of the question with whether evidence was found for each, and the sources accepted so far. No percentages or estimates.
 */
export function EssayProgressPanel({ topic, academicLevel, wordCount, phase, detail, elapsedText, parts, coverage, sources }: EssayProgressPanelProps) {
  const { shown, more } = visibleSources(sources)
  const withEvidence = parts.filter(p => coverage[p.id] === 'supported').length
  return (
    <div className="px-6 py-6 space-y-5">
      {topic.trim() && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Writing</p>
          <p className="mt-0.5 line-clamp-2 text-[13px] text-slate-700">{topic.trim()}</p>
          <p className="mt-1 text-[11px] text-slate-500">Essay · {academicLevel} · {wordCount.toLocaleString()} words</p>
        </div>
      )}

      <div className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-4">
        {/* The one live region: the phase and what is happening in it. The clock is left out so it is not read out every second. */}
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {ESSAY_PHASES[phase]}{detail ? `. ${detail}` : ''}
        </p>
        <ol className="space-y-3">
          {ESSAY_PHASES.map((label, i) => {
            const done = i < phase
            const current = i === phase
            return (
              <li key={label} aria-current={current ? 'step' : undefined}>
                <div className={cn('flex items-center gap-2 text-[14px]', current ? 'font-semibold text-purple-text' : done ? 'text-slate-600' : 'text-slate-400')}>
                  {current ? <Loader2 size={15} className="motion-safe:animate-spin shrink-0" aria-hidden />
                    : done ? <Check size={15} className="shrink-0 text-emerald-600" aria-hidden />
                    : <span className="w-[15px] h-[15px] shrink-0 rounded-full border border-slate-300" aria-hidden />}
                  <span>{label}</span>
                  <span className="sr-only">{current ? ' (in progress)' : done ? ' (done)' : ''}</span>
                  {current && <span className="ml-auto shrink-0 tabular-nums text-[12px] font-normal text-slate-500" aria-hidden>{elapsedText}</span>}
                </div>
                {current && detail && <p className="mt-1 ml-[23px] text-[12px] text-slate-500">{detail}</p>}
                {i === 1 && parts.length > 0 && (
                  <div className="mt-2 ml-[23px]">
                    <p className="text-[11px] font-semibold text-slate-500">
                      Parts of your question{withEvidence > 0 ? ` · evidence found for ${withEvidence} of ${parts.length}` : ''}
                    </p>
                    <ul className="mt-1 space-y-1.5" aria-label="Parts of your question">
                      {parts.map(part => {
                        const state = coverage[part.id] ?? 'unknown'
                        return (
                          <li key={part.id} className="flex items-start gap-2" data-testid={`part-${part.id}`}>
                            <CoverageIcon state={state} />
                            <span className="min-w-0 text-[12px] font-normal leading-snug text-slate-700">
                              <span className="line-clamp-2 break-words">{part.label}</span>
                              <span className={cn('block text-[11px]', state === 'supported' ? 'text-emerald-700' : 'text-slate-500')}>
                                {ESSAY_COVERAGE_TEXT[state]}
                              </span>
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      </div>

      {(phase >= 1 || sources.length > 0) && (
        <div className="rounded-xl border border-slate-200 px-4 py-3">
          <p className="text-[12px] font-semibold text-slate-600">
            {sources.length > 0
              ? `${sources.length} ${sources.length === 1 ? 'source' : 'sources'} checked and accepted so far`
              : 'Sources appear here once they pass checking'}
          </p>
          {/* Room for the full list is kept from the start, so the note below does not move as sources arrive. */}
          <ul className="mt-1.5 min-h-[140px] space-y-1" aria-label="Sources accepted so far">
            {shown.map(source => (
              <li key={source.sourceId} className="truncate text-[12px] leading-5 text-slate-500" title={source.title}>
                {source.title}
                {(source.firstAuthor || source.year) && (
                  <span className="text-slate-400"> · {[source.firstAuthor, source.year].filter(Boolean).join(', ')}</span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-1 min-h-[16px] text-[11px] text-slate-400">{more > 0 ? `+${more} more` : ''}</p>
        </div>
      )}

      <p className="text-[12px] text-slate-500 text-center">You can close this window; writing continues in the editor.</p>
    </div>
  )
}
