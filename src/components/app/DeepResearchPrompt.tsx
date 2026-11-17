import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ArrowUpRight, Clock, Lightbulb, Loader2, Scale, ShieldCheck, Sparkles, Telescope, Wand2, X } from 'lucide-react'
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

  // Ctrl/Cmd + Enter starts the run, like every other composer people use daily.
  const onBoxKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canStart && !busy) { e.preventDefault(); onStart() }
  }

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
    'px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40',
    selected ? 'border-purple-accent/60 bg-purple-tint text-purple-deep shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900',
  )

  return (
    <div className="space-y-10">
      <header className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-purple-deep shadow-sm backdrop-blur">
          <Telescope size={12} aria-hidden="true" /> Deep Research
        </span>
        <h2 className="mt-5 text-[40px] sm:text-[46px] leading-[1.08] font-semibold tracking-[-0.025em] text-slate-900">
          What do you want to <span className="bg-gradient-to-r from-purple-accent to-fuchsia-500 bg-clip-text text-transparent">find out?</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[16px] leading-relaxed text-slate-700">
          Get a cited answer. Every claim checked against its source.
        </p>
        <p className="mx-auto mt-1 max-w-xl text-[13px] text-slate-500">Sources that disagree with you are shown too.</p>
        <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12px] text-slate-600" aria-label="What you get">
          <li className="inline-flex items-center gap-1.5"><ShieldCheck size={14} className="text-emerald-600" aria-hidden="true" /> Claims verified against sources</li>
          <li className="inline-flex items-center gap-1.5"><Scale size={14} className="text-purple-accent" aria-hidden="true" /> Disagreeing evidence included</li>
          <li className="inline-flex items-center gap-1.5"><Clock size={14} className="text-slate-500" aria-hidden="true" /> Refunds unused credits</li>
        </ul>
      </header>

      <section className="rounded-3xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_40px_-12px_rgba(76,29,149,0.18)] transition-shadow focus-within:border-purple-300 focus-within:shadow-[0_1px_2px_rgba(16,24,40,0.04),0_16px_48px_-12px_rgba(124,58,237,0.28)]">
        <div className="p-5 sm:p-6">
          <label htmlFor="deep-research-question" className="sr-only">Your research question</label>
          <textarea
            ref={box}
            id="deep-research-question"
            value={question}
            onChange={e => onQuestion(e.target.value)}
            onKeyDown={onBoxKey}
            rows={3}
            maxLength={MAX_QUESTION_CHARS}
            autoFocus={autoFocus}
            placeholder={info?.placeholder}
            className="w-full resize-none bg-transparent text-[17px] leading-relaxed text-slate-900 placeholder:text-slate-400 outline-none"
          />
          {trimmed > 0 && trimmed < MIN_QUESTION_CHARS && (
            <p className="text-[11px] text-slate-500">Add a little more detail so the search knows what to look for.</p>
          )}

          {isTitle && !titleDismissed && (
            <div role="note" className="mt-3 flex items-start gap-2.5 rounded-xl border border-purple-200 bg-purple-tint/50 px-3.5 py-2.5 text-[12px] text-slate-800">
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
            <div role="note" className="mt-3 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12px] text-amber-900">
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
            <div className="mt-4" aria-label="Suggested questions">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                <Wand2 size={12} aria-hidden="true" /> Suggested for this project
              </p>
              <ul className="flex flex-col gap-1.5">
                {suggestions.map(s => (
                  <li key={s}>
                    <button type="button" onClick={() => { onQuestion(s); box.current?.focus() }}
                      className="group flex w-full items-start gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2 text-left text-[12.5px] leading-snug text-slate-700 transition-colors hover:border-purple-300 hover:bg-purple-tint/50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40">
                      <span className="min-w-0 flex-1">{s}</span>
                      <ArrowUpRight size={14} className="mt-0.5 shrink-0 text-slate-400 transition-colors group-hover:text-purple-accent" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Kind of research: Auto by default, the eight modes one click away */}
          <div className="mt-5 flex flex-wrap items-center gap-2" aria-live="polite">
            {/* The label is itself the way to change it: one click opens the modes. It shows a kind only when the question is clear. */}
            <button type="button" aria-expanded={showModes} aria-controls="deep-research-modes" onClick={() => setShowModes(v => !v)}
              title="Change the kind of research"
              className="inline-flex items-center gap-1.5 rounded-full border border-purple-accent/40 bg-purple-tint px-3.5 py-1.5 text-[12px] font-medium text-purple-deep transition-colors hover:bg-purple-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40">
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
        </div>

        {/* Depth */}
        <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-5 sm:px-6">
          <p id="deep-research-depth" className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-slate-600">How deep?</p>
          <div role="radiogroup" aria-labelledby="deep-research-depth" className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {DEPTH_ORDER.map((id, idx) => {
              const t = DEPTH_TIERS[id]
              const selected = id === depth
              return (
                <button key={id} type="button" role="radio" aria-checked={selected} tabIndex={selected ? 0 : -1}
                  onClick={() => onDepth(id)} onKeyDown={e => onDepthKey(e, id)}
                  className={cn('group relative rounded-2xl border px-4 py-3 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40',
                    selected ? 'border-purple-accent bg-white shadow-[0_0_0_3px_rgba(124,58,237,0.12)]' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm')}>
                  <span className="flex items-center justify-between">
                    <span className={cn('text-[14px] font-semibold', selected ? 'text-purple-deep' : 'text-slate-800')}>{t.label}</span>
                    <span aria-hidden="true" className="flex gap-0.5">
                      {DEPTH_ORDER.map((_, i) => (
                        <span key={i} className={cn('h-1.5 w-3 rounded-full', i <= idx ? (selected ? 'bg-purple-accent' : 'bg-slate-400') : 'bg-slate-200')} />
                      ))}
                    </span>
                  </span>
                  <span className="mt-1 block text-[12px] text-slate-600 tabular-nums">{t.credits} credits · ~{depthCost(id, estimates).minutes} min</span>
                </button>
              )
            })}
          </div>
          <p className="mt-2.5 text-[12px] text-slate-500">{DEPTH_TIERS[depth].blurb}</p>
        </div>

        {options && <div className="border-t border-slate-100 px-5 py-5 sm:px-6">{options}</div>}

        <div className="flex flex-col gap-3 rounded-b-3xl border-t border-slate-100 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-[12px] leading-snug text-slate-500 sm:max-w-[22rem]">Up to {cost.credits} credits held · at least {cost.minCharged} charged · the rest is returned.</p>
          <div className="flex items-center gap-3 sm:justify-end">
            <kbd className="hidden rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-[11px] text-slate-500 sm:inline" aria-hidden="true">Ctrl ↵</kbd>
            <button
              type="button"
              onClick={onStart}
              disabled={!canStart || busy}
              aria-busy={busy}
              title={`Up to ${cost.credits} credits are held. At least ${cost.minCharged} are charged; the rest is returned.`}
              className={cn(
                'inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-[14px] font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/50 focus-visible:ring-offset-2',
                canStart && !busy ? 'bg-gradient-to-b from-purple-500 to-purple-accent text-white shadow-[0_6px_16px_-4px_rgba(124,58,237,0.55)] hover:-translate-y-px hover:shadow-[0_10px_22px_-6px_rgba(124,58,237,0.6)]' : 'bg-slate-200 text-slate-600 cursor-not-allowed',
              )}
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Telescope size={15} />}
              {busy ? 'Starting…' : startLabel(depth, estimates)}
            </button>
          </div>
        </div>
      </section>

      <section aria-label="Example questions">
        <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-slate-500">Try one of these</h3>
        <ul className="grid gap-2.5 sm:grid-cols-1">
          {DEEP_RESEARCH_EXAMPLES.map(ex => (
            <li key={ex.question}>
              <button
                type="button"
                onClick={() => onExample(ex.question, ex.mode)}
                className="group flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-[13px] leading-snug text-slate-800 transition-all hover:border-purple-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40"
              >
                <span className="min-w-0 flex-1">{ex.question}</span>
                <ArrowUpRight size={15} className="shrink-0 text-slate-300 transition-colors group-hover:text-purple-accent" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
