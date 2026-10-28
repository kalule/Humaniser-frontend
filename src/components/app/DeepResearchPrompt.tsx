import type { ReactNode } from 'react'
import { Loader2, Telescope } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { DeepResearchMode } from '../../api/deepResearch'
import {
  DEEP_RESEARCH_CREDITS, DEEP_RESEARCH_EXAMPLES, DEEP_RESEARCH_MODES, MAX_QUESTION_CHARS, MIN_QUESTION_CHARS,
} from '../../lib/deepResearch'

interface DeepResearchPromptProps {
  question: string
  onQuestion: (value: string) => void
  mode: DeepResearchMode
  onMode: (mode: DeepResearchMode) => void
  onExample: (question: string, mode: DeepResearchMode) => void
  canStart: boolean
  busy: boolean
  onStart: () => void
  autoFocus?: boolean
  /** Project, region and peer-review options. Rendered inside the card, under the mode chips. */
  options?: ReactNode
}

/**
 * The "New research" screen: one question, the kind of research, what it costs, and a start button. Presentational
 * only; the page owns the state and the start call.
 */
export function DeepResearchPrompt({
  question, onQuestion, mode, onMode, onExample, canStart, busy, onStart, autoFocus, options,
}: DeepResearchPromptProps) {
  const hint = DEEP_RESEARCH_MODES.find(m => m.value === mode)?.hint
  const trimmed = question.trim().length

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-serif text-[34px] leading-tight font-semibold text-slate-900">What do you want to find out?</h2>
        <p className="mt-3 text-[14px] leading-relaxed text-slate-600 max-w-xl">
          Each source is matched to its DOI record, and shown with a passage from the paper where one was found.
          Sources that disagree with you are shown too.
        </p>
      </header>

      <section className="rounded-2xl border border-purple-200 bg-white p-4 sm:p-5">
        <label htmlFor="deep-research-question" className="sr-only">Your research question</label>
        <textarea
          id="deep-research-question"
          value={question}
          onChange={e => onQuestion(e.target.value)}
          rows={3}
          maxLength={MAX_QUESTION_CHARS}
          autoFocus={autoFocus}
          placeholder="e.g. Does learning management system usability influence student satisfaction in South African universities?"
          className="w-full resize-none bg-transparent text-[15px] text-slate-900 placeholder:text-slate-400 outline-none"
        />
        {trimmed > 0 && trimmed < MIN_QUESTION_CHARS && (
          <p className="text-[11px] text-slate-500">Add a little more detail so the search knows what to look for.</p>
        )}

        <div role="radiogroup" aria-label="Kind of research" className="mt-4 flex flex-wrap gap-2">
          {DEEP_RESEARCH_MODES.map(m => {
            const selected = m.value === mode
            return (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onMode(m.value)}
                className={cn(
                  'px-3.5 py-1.5 rounded-full border text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40',
                  selected
                    ? 'border-purple-accent bg-purple-tint text-purple-accent'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-purple-200 hover:text-slate-800',
                )}
              >
                {m.label}
              </button>
            )
          })}
        </div>
        {hint && <p className="mt-2 text-[12px] text-slate-500">{hint}</p>}

        {options && <div className="mt-4 pt-4 border-t border-slate-100">{options}</div>}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onStart}
            disabled={!canStart}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-accent text-white text-[13px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Telescope size={14} />}
            Start research
          </button>
        </div>
      </section>

      <section className="rounded-xl bg-purple-tint/60 px-4 py-3" aria-label="Cost of this run">
        <p className="text-[12px] text-slate-500">Cost of this run</p>
        <p className="text-[15px] font-semibold text-slate-900">{DEEP_RESEARCH_CREDITS.reserved} credits reserved</p>
        <p className="text-[12px] text-slate-500">At least {DEEP_RESEARCH_CREDITS.minCharged} are charged. The rest is returned.</p>
      </section>

      <section aria-label="Example questions">
        <h3 className="text-[13px] font-semibold text-slate-800 mb-2">Try one of these</h3>
        <ul className="space-y-2">
          {DEEP_RESEARCH_EXAMPLES.map(ex => (
            <li key={ex.question}>
              <button
                type="button"
                onClick={() => onExample(ex.question, ex.mode)}
                className="w-full text-left rounded-lg border border-slate-200 bg-white px-4 py-3 text-[13px] text-slate-800 hover:border-purple-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40"
              >
                {ex.question}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
