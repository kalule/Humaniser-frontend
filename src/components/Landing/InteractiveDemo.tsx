import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, Shield, RefreshCw, CheckSquare, Search,
  Loader2, ArrowRight,
} from 'lucide-react'
import { cn } from '../../lib/utils'

const prefersReduced =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ── Types ─────────────────────────────────────────────────────────────────────
type ToolId = 'humaniser' | 'detector' | 'paraphrase' | 'grammar' | 'plagiarism'
type DemoTone = 'Casual' | 'Professional' | 'Academic'

// ── Tool registry ─────────────────────────────────────────────────────────────
const TOOLS = [
  {
    id: 'humaniser' as ToolId,
    label: 'Humaniser',
    icon: Sparkles,
    iconCls: 'text-indigo-400',
    activeCls: 'bg-indigo-500/12 border-indigo-500/35 text-white',
    spotlightColor: 'rgba(99,102,241,0.09)',
    accentBar: 'from-indigo-500/0 via-indigo-500/55 to-indigo-500/0',
  },
  {
    id: 'detector' as ToolId,
    label: 'Detector',
    icon: Shield,
    iconCls: 'text-emerald-400',
    activeCls: 'bg-emerald-500/12 border-emerald-500/35 text-white',
    spotlightColor: 'rgba(16,185,129,0.09)',
    accentBar: 'from-emerald-500/0 via-emerald-500/55 to-emerald-500/0',
  },
  {
    id: 'paraphrase' as ToolId,
    label: 'Paraphrase',
    icon: RefreshCw,
    iconCls: 'text-violet-400',
    activeCls: 'bg-violet-500/12 border-violet-500/35 text-white',
    spotlightColor: 'rgba(139,92,246,0.09)',
    accentBar: 'from-violet-500/0 via-violet-500/55 to-violet-500/0',
  },
  {
    id: 'grammar' as ToolId,
    label: 'Grammar',
    icon: CheckSquare,
    iconCls: 'text-amber-400',
    activeCls: 'bg-amber-500/12 border-amber-500/35 text-white',
    spotlightColor: 'rgba(245,158,11,0.09)',
    accentBar: 'from-amber-500/0 via-amber-500/55 to-amber-500/0',
  },
  {
    id: 'plagiarism' as ToolId,
    label: 'Plagiarism',
    icon: Search,
    iconCls: 'text-rose-400',
    activeCls: 'bg-rose-500/12 border-rose-500/35 text-white',
    spotlightColor: 'rgba(244,63,94,0.09)',
    accentBar: 'from-rose-500/0 via-rose-500/55 to-rose-500/0',
  },
] as const

// ── Demo data ─────────────────────────────────────────────────────────────────
const HUMANISER_EXAMPLES = [
  {
    label: 'Academic',
    aiText:
      'Furthermore, it is important to note that the comprehensive implementation of robust strategies can significantly enhance the overall efficacy of educational outcomes. Moreover, leveraging innovative pedagogical paradigms is crucial for student success.',
    humanText:
      "Here's what the research actually shows — strong teaching strategies work. Simple as that. When schools invest in evidence-based methods, students learn more effectively.",
    beforeScore: 12,
    afterScore: 94,
  },
  {
    label: 'Professional',
    aiText:
      'I am writing to express my interest in leveraging synergistic opportunities for collaboration. Our innovative solutions are designed to streamline your workflows and optimize operational efficiency across all touchpoints.',
    humanText:
      "I'd love to explore working together. We built a tool that cuts the time your team spends on repetitive tasks — some clients save 6+ hours a week. Worth a quick chat?",
    beforeScore: 8,
    afterScore: 91,
  },
  {
    label: 'Blog',
    aiText:
      'In conclusion, it is worth noting that artificial intelligence has multifaceted implications for content creation. Consequently, content creators must consider these nuanced factors when developing their comprehensive strategies.',
    humanText:
      "AI is changing how content gets made — fast. If you write for a living, you've probably felt it. The question isn't whether to use AI, it's how to make it actually sound like you.",
    beforeScore: 15,
    afterScore: 89,
  },
]

const DETECTOR_SENTENCES = [
  { text: 'Furthermore, it is important to note that the findings are significant.', ai: 0.94 },
  { text: 'This matters a lot for how we teach students going forward.', ai: 0.14 },
  { text: 'The comprehensive analysis reveals multifaceted implications.', ai: 0.89 },
  { text: 'We need better tools to help teachers in the classroom.', ai: 0.11 },
]

const PARAPHRASE_MODES = [
  {
    id: 'formal' as const,
    label: 'Formal',
    accentCls: 'text-blue-400',
    activeCls: 'bg-blue-500/12 border-blue-500/35 text-white',
    result:
      'The scheduled meeting will commence at 14:00. All attendees are requested to review the preparatory documentation prior to their attendance.',
  },
  {
    id: 'creative' as const,
    label: 'Creative',
    accentCls: 'text-violet-400',
    activeCls: 'bg-violet-500/12 border-violet-500/35 text-white',
    result:
      "Mark your calendars — the meeting kicks off at 2 PM sharp. Flip through those prep docs before you walk in the door!",
  },
  {
    id: 'casual' as const,
    label: 'Casual',
    accentCls: 'text-emerald-400',
    activeCls: 'bg-emerald-500/12 border-emerald-500/35 text-white',
    result:
      "Hey, the meeting's at 2 PM. Make sure to check out the prep stuff beforehand!",
  },
]

const GRAMMAR_SEGMENTS = [
  { text: 'Their', error: { type: 'grammar' as const, correction: "They're", note: 'Wrong pronoun form' } },
  { text: ' going to the store ' },
  { text: 'tommorrow', error: { type: 'spelling' as const, correction: 'tomorrow', note: 'Spelling error' } },
  { text: ' to buy supplies ' },
  { text: 'in terms of the', error: { type: 'style' as const, correction: 'for', note: 'Wordy phrase' } },
  { text: ' party.' },
]

const PLAGIARISM_DATA = {
  similarity: 82,
  your: [
    { text: 'Climate change is one of the most pressing challenges facing humanity today.', match: true },
    { text: ' Rising temperatures and ', match: false },
    { text: 'extreme weather events', match: true },
    { text: ' are becoming increasingly common around the world.', match: false },
  ],
  source: [
    { text: 'Climate change is one of the most pressing challenges facing humanity today.', match: true },
    { text: ' Rising global temperatures and ', match: false },
    { text: 'extreme weather events', match: true },
    { text: ' have become increasingly common across the world.', match: false },
  ],
  sourceUrl: 'en.wikipedia.org/wiki/Climate_change',
}

// ── API helpers ───────────────────────────────────────────────────────────────
const API_BASE = (import.meta.env.VITE_API_URL as string) ?? ''

interface PreviewHumaniseResult { output: string; wordCount: number; isPreview: boolean }
interface PreviewDetectResult { humanScore: number; aiScore: number; verdict: string }

async function previewHumanise(text: string, tone: string): Promise<PreviewHumaniseResult> {
  const res = await fetch(`${API_BASE}/api/humanise/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, tone, strength: 'medium' }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? 'Preview failed')
  }
  const body = await res.json() as { data?: PreviewHumaniseResult } & PreviewHumaniseResult
  return body.data ?? body
}

async function previewDetect(text: string): Promise<PreviewDetectResult> {
  const res = await fetch(`${API_BASE}/api/detector/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? 'Detection failed')
  }
  const body = await res.json() as { data?: PreviewDetectResult } & PreviewDetectResult
  const result = body.data ?? body
  return { humanScore: result.humanScore, aiScore: result.aiScore, verdict: result.verdict }
}

// ── Score ring ────────────────────────────────────────────────────────────────
function ScoreRing({
  score,
  size = 80,
  label = 'Human',
  colorOverride,
  animate: shouldAnimate = true,
}: {
  score: number
  size?: number
  label?: string
  colorOverride?: string
  animate?: boolean
}) {
  const r = size / 2 - 7
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ

  const defaultColor =
    score >= 80 ? '#10B981' :
    score >= 60 ? '#84CC16' :
    score >= 40 ? '#F59E0B' :
    '#EF4444'

  const color = colorOverride ?? defaultColor

  const [displayCount, setDisplayCount] = useState(shouldAnimate ? 0 : score)

  useEffect(() => {
    if (!shouldAnimate || prefersReduced) { setDisplayCount(score); return }
    const duration = 1000
    const startTime = Date.now()
    let rafId: number
    const tick = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayCount(Math.round(score * eased))
      if (progress < 1) rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [score, shouldAnimate])

  return (
    <div className="relative inline-flex items-center justify-center shrink-0">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="5.5" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color}
          strokeWidth="5.5" strokeLinecap="round"
          strokeDasharray={circ}
          animate={{ strokeDashoffset: offset, stroke: color }}
          transition={{ duration: shouldAnimate && !prefersReduced ? 1.0 : 0, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 5px ${color}55)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold text-white tabular-nums leading-none font-mono">{displayCount}%</span>
        <span className="text-slate-600 text-[9px] mt-0.5 uppercase tracking-wider font-mono">{label}</span>
      </div>
    </div>
  )
}

// ── Comparison panel ──────────────────────────────────────────────────────────
interface PanelProps {
  label: string
  labelColor?: string
  text: string
  score: number
  verdict: string
  direction: 'left' | 'right'
  isLoading?: boolean
  exampleKey: number
  borderColor?: string
}

function ComparisonPanel({
  label,
  labelColor = 'text-slate-600',
  text,
  score,
  verdict,
  direction,
  isLoading,
  exampleKey,
  borderColor = 'border-slate-800/50',
}: PanelProps) {
  const [displayed, setDisplayed] = useState(direction === 'right' ? '' : text)
  const indexRef = useRef(0)

  useEffect(() => {
    if (direction === 'left') { setDisplayed(text); return }
    setDisplayed('')
    indexRef.current = 0
    if (!text || isLoading) return
    const interval = setInterval(() => {
      if (indexRef.current < text.length) {
        setDisplayed(text.slice(0, indexRef.current + 1))
        indexRef.current += 1
      } else {
        clearInterval(interval)
      }
    }, 11)
    return () => clearInterval(interval)
  }, [text, direction, isLoading, exampleKey])

  const badgeCls =
    score >= 80 ? 'bg-emerald-500/12 text-emerald-300 border-emerald-500/25' :
    score >= 60 ? 'bg-lime-500/12 text-lime-300 border-lime-500/25' :
    score >= 40 ? 'bg-amber-500/12 text-amber-300 border-amber-500/25' :
    'bg-red-500/12 text-red-300 border-red-500/25'

  return (
    <div className="flex flex-col gap-2.5 min-w-0">
      <p className={cn('text-[10px] font-mono uppercase tracking-[0.18em]', labelColor)}>{label}</p>

      <div className={cn(
        'relative rounded-xl p-4 min-h-[116px] overflow-hidden bg-slate-950/70 border',
        borderColor,
      )}>
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

        {isLoading ? (
          <div className="space-y-2">
            {[1, 0.85, 1, 0.65].map((w, i) => (
              <div key={i} className="h-2.5 rounded bg-white/[0.05] animate-pulse" style={{ width: `${w * 100}%` }} />
            ))}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.p
              key={`${exampleKey}-${label}`}
              initial={prefersReduced ? {} : { opacity: 0, x: direction === 'left' ? -8 : 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={prefersReduced ? {} : { opacity: 0, x: direction === 'left' ? -8 : 8 }}
              transition={{ duration: 0.25, delay: direction === 'right' ? 0.12 : 0 }}
              className="text-sm text-slate-200 leading-relaxed"
            >
              {direction === 'right' ? displayed : text}
              {direction === 'right' && displayed.length < text.length && !isLoading && (
                <span className="inline-block w-0.5 h-3.5 bg-indigo-400 ml-0.5 animate-pulse" />
              )}
            </motion.p>
          </AnimatePresence>
        )}
      </div>

      <div className="flex items-center gap-2.5">
        <ScoreRing score={score} size={76} animate={!prefersReduced} />
        <span className={cn('text-xs px-2.5 py-1 rounded-full border font-semibold', badgeCls)}>
          {verdict}
        </span>
      </div>
    </div>
  )
}

// ── Humaniser: Watch Demo ─────────────────────────────────────────────────────
function HumaniserWatchDemo() {
  const [exIdx, setExIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const example = HUMANISER_EXAMPLES[exIdx]
  const delta = example.afterScore - example.beforeScore

  useEffect(() => {
    if (paused) return
    const t = setInterval(() => setExIdx((p) => (p + 1) % HUMANISER_EXAMPLES.length), 5000)
    return () => clearInterval(t)
  }, [paused])

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="space-y-4"
    >
      {/* Spotlight + comparison panels */}
      <div className="relative">
        <div
          className="absolute -inset-3 pointer-events-none rounded-2xl"
          style={{ background: 'radial-gradient(ellipse 85% 70% at 50% 50%, rgba(99,102,241,0.07), transparent 70%)' }}
        />

        <div className="relative grid grid-cols-1 md:grid-cols-2 gap-3">
          <ComparisonPanel
            label="AI TEXT"
            labelColor="text-slate-600"
            text={example.aiText}
            score={example.beforeScore}
            verdict="Likely AI"
            direction="left"
            exampleKey={exIdx}
          />

          {/* Divider arrow */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 hidden md:flex items-center justify-center w-7 h-7 rounded-full bg-[#060a12] border border-slate-800/60">
            <ArrowRight size={11} className="text-indigo-400" />
          </div>

          <ComparisonPanel
            label="HUMANISED"
            labelColor="text-emerald-600"
            text={example.humanText}
            score={example.afterScore}
            verdict="Likely Human ✓"
            direction="right"
            exampleKey={exIdx}
            borderColor="border-emerald-500/15"
          />
        </div>
      </div>

      {/* Delta chip */}
      <motion.div
        key={exIdx}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.25 }}
        className="relative flex items-center justify-center gap-2 border rounded-xl p-2.5 text-sm font-semibold overflow-hidden bg-emerald-500/8 border-emerald-500/18 text-emerald-300"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
        <span className="tabular-nums">▲ +{delta} pts</span>
        <span className="w-px h-4 bg-white/[0.1]" />
        <span className="font-normal text-emerald-400/70 text-xs font-mono">
          {example.beforeScore}% → {example.afterScore}% Human
        </span>
      </motion.div>

      {/* Dot nav */}
      <div className="flex items-center justify-center gap-1.5">
        {HUMANISER_EXAMPLES.map((ex, i) => (
          <button
            key={ex.label}
            type="button"
            onClick={() => { setExIdx(i); setPaused(true) }}
            aria-label={`Example: ${ex.label}`}
            className={cn(
              'rounded-full transition-all duration-300',
              i === exIdx ? 'w-5 h-2 bg-indigo-500' : 'w-2 h-2 bg-white/[0.12] hover:bg-white/[0.22]',
            )}
          />
        ))}
        <span className="text-[10px] font-mono text-slate-600 ml-2 uppercase tracking-wider">
          {HUMANISER_EXAMPLES[exIdx].label}
          {!paused && ' · auto'}
        </span>
      </div>
    </div>
  )
}

// ── Humaniser: Try Your Text ──────────────────────────────────────────────────
const TONES: DemoTone[] = ['Casual', 'Professional', 'Academic']

function HumaniserTryDemo() {
  const [inputText, setInputText] = useState('')
  const [tone, setTone] = useState<DemoTone>('Professional')
  const [humanisedText, setHumanisedText] = useState('')
  const [inputScore, setInputScore] = useState<number | null>(null)
  const [outputScore, setOutputScore] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [improvement, setImprovement] = useState(0)

  const wordCount = inputText.trim() ? inputText.trim().split(/\s+/).length : 0
  const canSubmit = wordCount >= 10 && wordCount <= 100 && !isLoading

  const wordCountColor =
    wordCount > 100 ? 'text-red-400' :
    wordCount >= 80 ? 'text-amber-400' :
    'text-slate-600'

  const getScoreLabel = (score: number) =>
    score >= 80 ? 'Likely Human' :
    score >= 60 ? 'Mostly Human' :
    score >= 40 ? 'Mixed' :
    'Likely AI'

  const handleHumanise = useCallback(async () => {
    if (!canSubmit) return
    setError(null)
    setIsLoading(true)
    setHumanisedText('')
    setInputScore(null)
    setOutputScore(null)
    setShowBanner(false)

    try {
      const [humaniseRes, detectInputRes] = await Promise.allSettled([
        previewHumanise(inputText, tone.toLowerCase()),
        previewDetect(inputText),
      ])

      let outputText = ''
      if (humaniseRes.status === 'fulfilled') {
        outputText = humaniseRes.value.output
        setHumanisedText(outputText)
      } else {
        setError((humaniseRes.reason as Error).message ?? 'Humanise failed')
        return
      }

      if (detectInputRes.status === 'fulfilled') setInputScore(detectInputRes.value.humanScore)

      if (outputText) {
        try {
          const outDetect = await previewDetect(outputText)
          setOutputScore(outDetect.humanScore)
          const before = detectInputRes.status === 'fulfilled' ? detectInputRes.value.humanScore : 0
          const delta = outDetect.humanScore - before
          if (delta > 0) { setImprovement(delta); setShowBanner(true) }
        } catch { /* silent */ }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Preview failed')
    } finally {
      setIsLoading(false)
    }
  }, [canSubmit, inputText, tone])

  return (
    <div className="space-y-4">
      {/* Spotlight */}
      <div className="relative">
        <div
          className="absolute -inset-2 pointer-events-none rounded-2xl"
          style={{ background: 'radial-gradient(ellipse 80% 65% at 50% 50%, rgba(99,102,241,0.06), transparent 70%)' }}
        />

        <div className="relative grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Input */}
          <div className="flex flex-col gap-2.5">
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-600">Your AI Text</p>
            <div className="relative">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste your AI-generated text here (10–100 words)..."
                rows={6}
                className={cn(
                  'w-full bg-slate-950/70 border border-slate-800/60',
                  'focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20',
                  'rounded-xl p-3.5 text-sm text-slate-100 placeholder:text-slate-700',
                  'resize-none outline-none transition-all leading-relaxed',
                )}
                aria-label="AI text input for preview"
              />
              <span className={cn('absolute bottom-2 right-3 text-[10px] font-mono tabular-nums', wordCountColor)}>
                {wordCount}/100
              </span>
            </div>

            {wordCount > 100 && (
              <p className="text-xs text-red-400">
                {wordCount} words — preview limit is 100.{' '}
                <a href="/register" className="underline hover:opacity-80">Sign up free →</a>
              </p>
            )}

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-slate-600">Tone:</span>
              <div className="flex gap-1">
                {TONES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTone(t)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-150 border',
                      tone === t
                        ? 'bg-indigo-500/15 border-indigo-500/40 text-white shadow-sm shadow-indigo-900/40'
                        : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-800',
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {inputScore !== null && (
              <div className="flex items-center gap-2">
                <ScoreRing score={inputScore} size={72} />
                <span className="text-xs text-slate-500">Before: {getScoreLabel(inputScore)}</span>
              </div>
            )}
          </div>

          {/* Output */}
          <div className="flex flex-col gap-2.5">
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-600">Humanised Text</p>
            <div className={cn(
              'relative rounded-xl p-3.5 min-h-[152px] overflow-hidden',
              'bg-slate-950/70 border border-emerald-500/15',
            )}>
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
              {isLoading && !humanisedText ? (
                <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                  <Loader2 size={13} className="animate-spin" />
                  Humanising...
                </div>
              ) : humanisedText ? (
                <p className="text-sm text-slate-100 leading-relaxed">{humanisedText}</p>
              ) : (
                <p className="text-sm text-slate-700 italic">Your humanised text appears here...</p>
              )}
            </div>

            {outputScore !== null && (
              <div className="flex items-center gap-2">
                <ScoreRing score={outputScore} size={72} />
                <span className="text-xs text-slate-500">After: {getScoreLabel(outputScore)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-red-400 text-center font-mono">{error}</p>}

      <button
        type="button"
        onClick={handleHumanise}
        disabled={!canSubmit}
        className={cn(
          'w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-200',
          canSubmit
            ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/50 hover:shadow-indigo-900/70'
            : 'bg-white/[0.03] text-slate-700 cursor-not-allowed border border-white/[0.04]',
        )}
        aria-label="Humanise free preview"
      >
        {isLoading
          ? <><Loader2 size={14} className="animate-spin" /> Processing...</>
          : <>Humanise Free <ArrowRight size={13} /></>}
      </button>

      <AnimatePresence>
        {showBanner && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
            className="relative bg-indigo-950/50 border border-indigo-500/20 rounded-xl p-4 text-center overflow-hidden"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />
            <p className="text-sm font-semibold text-indigo-300 mb-1">
              Your text improved by +{improvement} points
            </p>
            <p className="text-xs text-slate-500 mb-3">Sign up free to humanise unlimited text</p>
            <a
              href="/register"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors shadow-lg shadow-indigo-900/50"
            >
              Create Free Account <ArrowRight size={12} />
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Detector showcase ─────────────────────────────────────────────────────────
function DetectorDemo() {
  return (
    <div className="space-y-4">
      {/* Dual metric dials */}
      <div className="grid grid-cols-2 gap-3">
        <div className="relative flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-950/60 border border-red-500/15 overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/25 to-transparent" />
          <ScoreRing score={71} size={80} colorOverride="#EF4444" label="AI Score" />
          <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-red-500/50">AI Probability</p>
        </div>
        <div className="relative flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-950/60 border border-emerald-500/15 overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/25 to-transparent" />
          <ScoreRing score={29} size={80} label="Human" />
          <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-emerald-500/50">Human Score</p>
        </div>
      </div>

      {/* Sentence breakdown */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-slate-600">Sentence Analysis</p>
        {DETECTOR_SENTENCES.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/40"
          >
            <div className={cn(
              'mt-1 w-1.5 h-1.5 rounded-full shrink-0',
              s.ai > 0.7 ? 'bg-red-500' : s.ai > 0.4 ? 'bg-amber-500' : 'bg-emerald-500',
            )} />
            <p className="text-xs text-slate-400 leading-snug flex-1 min-w-0">{s.text}</p>
            <span className={cn(
              'text-[9px] font-mono uppercase tracking-wide shrink-0 tabular-nums',
              s.ai > 0.7 ? 'text-red-500/60' : 'text-emerald-500/60',
            )}>
              {Math.round(s.ai * 100)}% AI
            </span>
          </motion.div>
        ))}
      </div>

      {/* Verdict */}
      <div className="relative flex items-center justify-between p-3 rounded-xl bg-red-500/7 border border-red-500/18 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/25 to-transparent" />
        <span className="text-xs font-semibold text-red-400">⚠ Verdict: Likely AI-Generated</span>
        <span className="text-[10px] font-mono text-slate-600">71% detected</span>
      </div>
    </div>
  )
}

// ── Paraphrase showcase ───────────────────────────────────────────────────────
function ParaphraseDemo() {
  const [mode, setMode] = useState<'formal' | 'creative' | 'casual'>('formal')
  const current = PARAPHRASE_MODES.find((m) => m.id === mode)!

  return (
    <div className="space-y-4">
      {/* Mode selector */}
      <div className="space-y-2">
        <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-slate-600">Output Mode</p>
        <div className="flex gap-1.5">
          {PARAPHRASE_MODES.map((pm) => (
            <button
              key={pm.id}
              type="button"
              onClick={() => setMode(pm.id)}
              className={cn(
                'flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all duration-150 border',
                mode === pm.id
                  ? pm.activeCls
                  : 'bg-transparent border-slate-800/50 text-slate-500 hover:text-slate-300 hover:border-slate-700',
              )}
            >
              {pm.label}
            </button>
          ))}
        </div>
      </div>

      {/* Comparison panels with spotlight */}
      <div className="relative">
        <div
          className="absolute -inset-2 pointer-events-none rounded-2xl"
          style={{ background: 'radial-gradient(ellipse 80% 65% at 50% 50%, rgba(139,92,246,0.07), transparent 70%)' }}
        />
        <div className="relative grid grid-cols-2 gap-3">
          {/* Original */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/50 space-y-2">
            <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-slate-600">ORIGINAL</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              The meeting is at 2 PM. Please read the prep documents before you come.
            </p>
          </div>

          {/* Paraphrased */}
          <div className="relative p-3.5 rounded-xl bg-slate-950/60 border border-violet-500/20 overflow-hidden space-y-2">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/35 to-transparent" />
            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
              >
                <p className={cn('text-[9px] font-mono uppercase tracking-[0.18em] mb-2', current.accentCls)}>
                  {current.label.toUpperCase()}
                </p>
                <p className="text-xs text-slate-200 leading-relaxed">{current.result}</p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <p className="text-[10px] font-mono text-slate-700 text-center">
        Same text · 3 different voices · instant switch
      </p>
    </div>
  )
}

// ── Grammar showcase ──────────────────────────────────────────────────────────
const ERROR_STYLES = {
  grammar: { bg: 'bg-red-500/20', text: 'text-red-300', dot: 'bg-red-500', rowBg: 'bg-red-500/5 border-red-500/15' },
  spelling: { bg: 'bg-amber-500/20', text: 'text-amber-300', dot: 'bg-amber-500', rowBg: 'bg-amber-500/5 border-amber-500/15' },
  style: { bg: 'bg-blue-500/20', text: 'text-blue-300', dot: 'bg-blue-500', rowBg: 'bg-blue-500/5 border-blue-500/15' },
}

function GrammarDemo() {
  const [hovered, setHovered] = useState<number | null>(null)

  const errors = GRAMMAR_SEGMENTS.filter((s) => !!s.error) as Array<{
    text: string
    error: { type: 'grammar' | 'spelling' | 'style'; correction: string; note: string }
  }>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-slate-600">Grammar Analysis</p>
        <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
          {errors.length} ISSUES FOUND
        </span>
      </div>

      {/* Text with highlights */}
      <div className="relative p-4 rounded-xl bg-slate-950/60 border border-slate-800/50 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/15 to-transparent" />
        <p className="text-sm leading-relaxed text-slate-200">
          {GRAMMAR_SEGMENTS.map((seg, i) => {
            if (!seg.error) return <span key={i}>{seg.text}</span>
            const style = ERROR_STYLES[seg.error.type]
            return (
              <span
                key={i}
                className={cn(
                  'px-0.5 rounded cursor-pointer transition-all duration-150',
                  style.bg, style.text,
                  hovered === i && 'ring-1 ring-white/20',
                )}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              >
                {seg.text}
              </span>
            )
          })}
        </p>
      </div>

      {/* Error list */}
      <div className="space-y-1.5">
        {errors.map((seg, i) => {
          const style = ERROR_STYLES[seg.error.type]
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className={cn('flex items-center gap-2 p-2.5 rounded-lg border', style.rowBg)}
            >
              <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', style.dot)} />
              <span className={cn('text-xs font-mono line-through opacity-50', style.text)}>{seg.text}</span>
              <ArrowRight size={9} className="text-slate-600 shrink-0" />
              <span className="text-xs font-semibold text-slate-200">{seg.error.correction}</span>
              <span className="ml-auto text-[9px] font-mono text-slate-600 capitalize">{seg.error.note}</span>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

// ── Plagiarism showcase ───────────────────────────────────────────────────────
function PlagiarismDemo() {
  return (
    <div className="space-y-4">
      {/* Similarity bar */}
      <div className="relative flex items-center gap-4 p-3.5 rounded-xl bg-rose-500/7 border border-rose-500/18 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rose-500/25 to-transparent" />
        <div className="flex-1 space-y-1.5">
          <div className="flex justify-between items-center">
            <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-rose-500/60">Similarity Score</p>
            <span className="text-base font-bold font-mono text-rose-400 tabular-nums">
              {PLAGIARISM_DATA.similarity}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-800/80 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${PLAGIARISM_DATA.similarity}%` }}
              transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-rose-500"
            />
          </div>
        </div>
        <span className="text-[10px] font-mono font-semibold text-rose-400 border border-rose-500/25 bg-rose-500/10 px-2 py-1 rounded-lg shrink-0">
          HIGH
        </span>
      </div>

      {/* Split-view with spotlight */}
      <div className="relative">
        <div
          className="absolute -inset-2 pointer-events-none rounded-2xl"
          style={{ background: 'radial-gradient(ellipse 80% 65% at 50% 50%, rgba(244,63,94,0.05), transparent 70%)' }}
        />
        <div className="relative border border-slate-800/50 rounded-xl overflow-hidden">
          <div className="grid grid-cols-2 divide-x divide-slate-800/50">
            {/* Your text */}
            <div className="p-3.5 space-y-2 bg-slate-950/60">
              <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-slate-600">YOUR TEXT</p>
              <p className="text-xs leading-relaxed text-slate-300">
                {PLAGIARISM_DATA.your.map((seg, i) =>
                  seg.match ? (
                    <mark key={i} className="bg-rose-500/22 text-rose-300 rounded-sm not-italic">{seg.text}</mark>
                  ) : (
                    <span key={i}>{seg.text}</span>
                  )
                )}
              </p>
            </div>

            {/* Source */}
            <div className="p-3.5 space-y-2 bg-rose-500/[0.025]">
              <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-rose-500/50">SOURCE MATCH</p>
              <p className="text-xs leading-relaxed text-slate-400">
                {PLAGIARISM_DATA.source.map((seg, i) =>
                  seg.match ? (
                    <mark key={i} className="bg-rose-500/22 text-rose-300 rounded-sm not-italic">{seg.text}</mark>
                  ) : (
                    <span key={i}>{seg.text}</span>
                  )
                )}
              </p>
              <p className="text-[9px] font-mono text-rose-500/40 truncate">{PLAGIARISM_DATA.sourceUrl}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── HeroDemo (main container) ─────────────────────────────────────────────────
export function HeroDemo() {
  const [activeTool, setActiveTool] = useState<ToolId>('humaniser')
  const [demoMode, setDemoMode] = useState<'watch' | 'try'>('watch')

  const currentTool = TOOLS.find((t) => t.id === activeTool)!

  return (
    <div
      className="border border-slate-800/50 rounded-2xl shadow-2xl shadow-black/70 overflow-hidden"
      style={{
        background: [
          `radial-gradient(ellipse 130% 55% at 50% 0%, ${currentTool.spotlightColor} 0%, transparent 60%)`,
          '#060a12',
        ].join(', '),
        transition: 'background 0.4s ease',
      }}
    >
      {/* Reactive top accent bar */}
      <div className={cn('h-px bg-gradient-to-r', currentTool.accentBar)} />

      {/* Tool tab bar */}
      <div className="flex items-center gap-0.5 px-3 py-2.5 border-b border-slate-800/50 overflow-x-auto">
        {TOOLS.map((tool) => {
          const isActive = tool.id === activeTool
          const Icon = tool.icon
          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => setActiveTool(tool.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold',
                'transition-all duration-150 whitespace-nowrap border shrink-0',
                isActive ? tool.activeCls : 'text-slate-600 hover:text-slate-300 border-transparent hover:border-slate-800/60',
              )}
              aria-pressed={isActive}
            >
              <Icon size={11} className={isActive ? tool.iconCls : 'opacity-40'} />
              {tool.label}
            </button>
          )
        })}
      </div>

      {/* Humaniser sub-mode toggle */}
      <AnimatePresence>
        {activeTool === 'humaniser' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden border-b border-slate-800/40"
          >
            <div className="flex items-center gap-2 px-4 py-2">
              <div className="flex items-center gap-0.5 bg-slate-950/70 border border-slate-800/60 rounded-lg p-0.5">
                {(['watch', 'try'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDemoMode(m)}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-150',
                      demoMode === m
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/50'
                        : 'text-slate-500 hover:text-slate-300',
                    )}
                    aria-pressed={demoMode === m}
                  >
                    {m === 'watch' ? '▶ Watch Demo' : '✏ Try It Free'}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content pane */}
      <div className="p-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${activeTool}-${activeTool === 'humaniser' ? demoMode : ''}`}
            initial={{ opacity: 0, y: 7 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -7 }}
            transition={{ duration: 0.18 }}
          >
            {activeTool === 'humaniser' && demoMode === 'watch' && <HumaniserWatchDemo />}
            {activeTool === 'humaniser' && demoMode === 'try'   && <HumaniserTryDemo />}
            {activeTool === 'detector'   && <DetectorDemo />}
            {activeTool === 'paraphrase' && <ParaphraseDemo />}
            {activeTool === 'grammar'    && <GrammarDemo />}
            {activeTool === 'plagiarism' && <PlagiarismDemo />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

// ── Standalone section (backwards compat) ─────────────────────────────────────
export function InteractiveDemo() {
  return (
    <section className="py-20 px-4" aria-label="Interactive demo">
      <div className="max-w-4xl mx-auto">
        <HeroDemo />
      </div>
    </section>
  )
}
