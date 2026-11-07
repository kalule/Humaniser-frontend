import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Lightbulb, Loader2, Sparkles, Telescope, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { DeepResearchMode } from '../../api/deepResearch'
import {
  DEEP_RESEARCH_EXAMPLES, DEEP_RESEARCH_MODES, MAX_QUESTION_CHARS, MIN_QUESTION_CHARS,
} from '../../lib/deepResearch'
import {
  DEPTH_ORDER, DEPTH_TIERS, depthCost, isNormativeQuestion, looksLikeStudyTitle, rewriteNormative, startLabel, titleToQuestion, type DepthEstimates, type DepthId,
} from '../../lib/deepResearchIntake'

export type ModeChoice = DeepResearchMode | 'Auto'

interface DeepResearchPromptProps {
  question: string
  onQuestion: (value: string) => void
  /** 'Auto' follows what the question looks like; anything else is the student's own choice. */
  mode: ModeChoice
  onMode: (mode: ModeChoice) => void
  /** What the (debounced) question looks like, or null. Only used while mode is 'Auto'. */
  detected?: DeepResearchMode | null
  depth: DepthId
  onDepth: (depth: DepthId) => void
  /** The student's typical run times, when the server has enough of their runs to say. */
  estimates?: DepthEstimates
  onExample: (question: string, mode: DeepResearchMode) => void
  /** Questions built from the selected project's title; clicking one fills the box. */
  suggestions?: string[]
  canStart: boolean
  busy: boolean
  onStart: () => void
  autoFocus?: boolean
  /** Project, region and peer-review options. Rendered inside the card as one compact row. */
  options?: ReactNode
}

const modeLabel = (m: DeepResearchMode) => DEEP_RESEARCH_MODES.find(x => x.value === m)?.label ?? m

/**
 * The "New research" screen: one question, how deep to go, and a start button that says what it costs. Presentational
 * only; the page owns the state and the start call.
 */
export function DeepResearchPrompt({
  question, onQuestion, mode, onMode, detected = null, depth, onDepth, estimates, onExample, suggestions = [],
  canStart, busy, onStart, autoFocus, options,
}: DeepResearchPromptProps) {
  const [showModes, setShowModes] = useState(false)
  const [normativeDismissed, setNormativeDismissed] = useState(false)
  const [titleDismissed, setTitleDismissed] = useState(false)
  const box = useRef<HTMLTextAreaElement>(null)
  const trimmed = question.trim().length
  const normative = isNormativeQuestion(question)
  useEffect(() => { if (!normative) setNormativeDismissed(false) }, [normative])
  const isTitle = looksLikeStudyTitle(question)
  useEffect(() => { if (!isTitle) setTitleDismissed(false) }, [isTitle])

  const effective: DeepResearchMode | null = mode === 'Auto' ? detected : mode
  const info = DEEP_RESEARCH_MODES.find(m => m.value === (effective ?? 'RelationshipInvestigation'))
  const cost = depthCost(depth, estimates)

  const useTemplate = () => {
    const t = DEEP_RESEARCH_MODES.find(m => m.value === effective)?.template
    if (!t) return
    onQuestion(t)
    setTimeout(() => {
      const el = box.current
      if (!el) return
      el.focus()
      const at = t.indexOf('___')
      if (at >= 0) el.setSelectionRange(at, at + 3)
    }, 0)
  }

  // Radio-group keyboard behaviour for the depth selector: arrows move and select, Tab leaves.
  const onDepthKey = (e: KeyboardEvent<HTMLButtonElement>, id: DepthId) => {
    const i = DEPTH_ORDER.indexOf(id)
    let next = i
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % DEPTH_ORDER.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + DEPTH_ORDER.length) % DEPTH_ORDER.length
    else return
    e.preventDefault()
    onDepth(DEPTH_ORDER[next])
    const group = e.currentTarget.parentElement
    requestAnimationFrame(() => group?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus())
  }

  const chip = (selected: boolean) => cn(
    'px-3.5 py-1.5 rounded-full border text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40',
    selected ? 'border-purple-accent bg-purple-tint text-purple-accent' : 'border-slate-200 bg-white text-slate-600 hover:border-purple-200 hover:text-slate-800',
  )

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-serif text-[34px] leading-tight font-semibold text-slate-900">What do you want to find out?</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-700 max-w-xl">
          Get a cited answer. Every claim checked against its source.
        </p>
        <p className="mt-1 text-[13px] text-slate-500 max-w-xl">Sources that disagree with you are shown too.</p>
      </header>

      <section className="rounded-2xl border border-purple-200 bg-white p-4 sm:p-5">
        <label htmlFor="deep-research-question" className="sr-only">Your research question</label>
        <textarea
          ref={box}
          id="deep-research-question"
          value={question}
          onChange={e => onQuestion(e.target.value)}
          rows={3}
          maxLength={MAX_QUESTION_CHARS}
          autoFocus={autoFocus}
          placeholder={info?.placeholder}
          className="w-full resize-none bg-transparent text-[15px] text-slate-900 placeholder:text-slate-400 outline-none"
        />
        {trimmed > 0 && trimmed < MIN_QUESTION_CHARS && (
          <p className="text-[11px] text-slate-500">Add a little more detail so the search knows what to look for.</p>
        )}

        {isTitle && !titleDismissed && (
          <div role="note" className="mt-2 flex items-start gap-2 rounded-lg border border-purple-200 bg-purple-tint/50 px-3 py-2 text-[12px] text-slate-800">
            <Lightbulb size={14} className="mt-0.5 shrink-0 text-purple-accent" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p>This looks like the title of a study. Searching works better with the question behind it, without the design or subtitle.</p>
              <button type="button" onClick={() => onQuestion(titleToQuestion(question))}
                className="mt-1 text-left font-semibold text-purple-deep underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40 rounded">
                Ask it as: {titleToQuestion(question)}
              </button>
              <span className="block text-slate-600 mt-0.5">Or keep it as it is.</span>
            </div>
            <button type="button" onClick={() => setTitleDismissed(true)} aria-label="Dismiss this hint"
              className="shrink-0 rounded p-0.5 hover:bg-purple-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40">
              <X size={14} />
            </button>
          </div>
        )}

        {normative && !normativeDismissed && !isTitle && (
          <div role="note" className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
            <Lightbulb size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p>Research can show what is known, not what you should do. A question about evidence gets a stronger answer.</p>
              <button type="button" onClick={() => onQuestion(rewriteNormative(question))}
                className="mt-1 font-semibold underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40 rounded">
                Ask it as: {rewriteNormative(question)}
              </button>
              <span className="block text-amber-800/80 mt-0.5">You can also keep your question as it is.</span>
            </div>
            <button type="button" onClick={() => setNormativeDismissed(true)} aria-label="Dismiss this hint"
              className="shrink-0 rounded p-0.5 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40">
              <X size={14} />
            </button>
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="mt-3" aria-label="Suggested questions">
            <p className="text-[11px] font-medium text-slate-500 mb-1.5">Suggested for this project</p>
            <ul className="flex flex-col gap-1.5">
              {suggestions.map(s => (
                <li key={s}>
                  <button type="button" onClick={() => { onQuestion(s); box.current?.focus() }}
                    className="w-full text-left rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] text-slate-700 hover:border-purple-200 hover:bg-purple-tint/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40">
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Kind of research: Auto by default, the eight modes one click away */}
        <div className="mt-4 flex flex-wrap items-center gap-2" aria-live="polite">
          {/* The label is itself the way to change it: one click opens the modes. It shows a kind only when the question is clear. */}
          <button type="button" aria-expanded={showModes} aria-controls="deep-research-modes" onClick={() => setShowModes(v => !v)}
            title="Change the kind of research"
            className="inline-flex items-center gap-1.5 rounded-full border border-purple-accent bg-purple-tint px-3.5 py-1.5 text-[12px] font-medium text-purple-accent hover:bg-purple-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40">
            <Sparkles size={12} aria-hidden="true" />
            {mode === 'Auto' ? (detected ? `Auto: ${modeLabel(detected)}` : 'Auto') : modeLabel(mode)}
            <span className="font-normal text-slate-600">· Change</span>
          </button>
          {showModes && <span className="text-[12px] text-slate-500">Pick one below, or Auto to let it follow your question.</span>}
          {effective && trimmed === 0 && (
            <button type="button" onClick={useTemplate}
              className="text-[12px] font-medium text-purple-accent hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40">
              Use a template
            </button>
          )}
        </div>
        {showModes && (
          <div id="deep-research-modes" role="radiogroup" aria-label="Kind of research" className="mt-3 flex flex-wrap gap-2">
            <button type="button" role="radio" aria-checked={mode === 'Auto'} onClick={() => onMode('Auto')} className={chip(mode === 'Auto')}>Auto</button>
            {DEEP_RESEARCH_MODES.map(m => (
              <button key={m.value} type="button" role="radio" aria-checked={mode === m.value} onClick={() => onMode(m.value)} className={chip(mode === m.value)}>
                {m.label}
              </button>
            ))}
          </div>
        )}
        {info && effective && <p className="mt-2 text-[12px] text-slate-500">{info.hint}</p>}

        {/* Depth */}
        <div className="mt-5">
          <p id="deep-research-depth" className="text-[12px] font-medium text-slate-700 mb-1.5">How deep?</p>
          <div role="radiogroup" aria-labelledby="deep-research-depth" className="grid grid-cols-3 gap-2">
            {DEPTH_ORDER.map(id => {
              const t = DEPTH_TIERS[id]
              const selected = id === depth
              return (
                <button key={id} type="button" role="radio" aria-checked={selected} tabIndex={selected ? 0 : -1}
                  onClick={() => onDepth(id)} onKeyDown={e => onDepthKey(e, id)}
                  className={cn('rounded-xl border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40',
                    selected ? 'border-purple-accent bg-purple-tint' : 'border-slate-200 bg-white hover:border-purple-200')}>
                  <span className={cn('block text-[13px] font-semibold', selected ? 'text-purple-deep' : 'text-slate-800')}>{t.label}</span>
                  <span className="block text-[11px] text-slate-600 tabular-nums">{t.credits} credits · ~{depthCost(id, estimates).minutes} min</span>
                </button>
              )
            })}
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500">{DEPTH_TIERS[depth].blurb}</p>
        </div>

        {options && <div className="mt-4 pt-4 border-t border-slate-100">{options}</div>}

        <div className="mt-4 flex flex-col items-end gap-1.5">
          <button
            type="button"
            onClick={onStart}
            disabled={!canStart || busy}
            aria-busy={busy}
            title={`Up to ${cost.credits} credits are held. At least ${cost.minCharged} are charged; the rest is returned.`}
            className={cn(
              'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/50 focus-visible:ring-offset-2',
              canStart && !busy ? 'bg-purple-accent text-white hover:bg-purple-deep shadow shadow-purple-400/20' : 'bg-slate-200 text-slate-600 cursor-not-allowed',
            )}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Telescope size={14} />}
            {busy ? 'Starting…' : startLabel(depth, estimates)}
          </button>
          <p className="text-[11px] text-slate-500 text-right">Up to {cost.credits} credits held · at least {cost.minCharged} charged · the rest is returned.</p>
        </div>
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
