import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import { Shield, FileText, Sparkles, Check, ArrowRight } from 'lucide-react'
import { cn } from '../../lib/utils'

// ── Reduced-motion detection ───────────────────────────────────────────────
const prefersReduced =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ── Static demo data ───────────────────────────────────────────────────────
const AI_SENTENCES = [
  { text: 'Furthermore, it is important to note that…', badge: '94% AI', cls: 'ai' as const },
  { text: 'The comprehensive implementation of robust…', badge: '88% AI', cls: 'ai' as const },
  { text: 'Additionally, leveraging innovative paradigms…', badge: '91% AI', cls: 'ai' as const },
  { text: 'Consequently, these multifaceted approaches…', badge: '85% AI', cls: 'ai' as const },
]

const HUMAN_SENTENCES = [
  { text: "Here's the thing — exercise genuinely changes how your brain works.", badge: '96% Human', cls: 'human' as const },
  { text: 'Studies back this up consistently, and the numbers are hard to ignore.', badge: '89% Human', cls: 'human' as const },
  { text: 'Even 20 minutes a day makes a measurable difference (yes, really).', badge: '94% Human', cls: 'human' as const },
  { text: 'The research points to at least 150 minutes of moderate activity weekly.', badge: '71% Human', cls: 'mixed' as const },
]

const SENTENCE_STYLES = {
  ai: {
    row: 'bg-red-500/10 border-red-500/20 text-red-200',
    badge: 'bg-red-500/20 text-red-400',
  },
  human: {
    row: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200',
    badge: 'bg-emerald-500/20 text-emerald-400',
  },
  mixed: {
    row: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-200',
    badge: 'bg-yellow-500/20 text-yellow-400',
  },
}

// ── ScoreRing ──────────────────────────────────────────────────────────────
function ScoreRing({ score, color }: { score: number; color: string }) {
  const radius = 45
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  return (
    <svg width="120" height="120" className="-rotate-90" aria-hidden="true">
      <circle cx="60" cy="60" r={radius} fill="none" stroke="#1e293b" strokeWidth="8" />
      <motion.circle
        cx="60" cy="60"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={circumference}
        animate={{ strokeDashoffset: offset, stroke: color }}
        transition={{ duration: prefersReduced ? 0 : 1.2, ease: 'easeOut' }}
      />
    </svg>
  )
}

// ── DemoCard ───────────────────────────────────────────────────────────────
function DemoCard({
  isHuman,
  count,
  onToggle,
}: {
  isHuman: boolean
  count: number
  onToggle: () => void
}) {
  const navigate = useNavigate()
  const sentences = isHuman ? HUMAN_SENTENCES : AI_SENTENCES
  const scoreColor = isHuman ? '#10B981' : '#EF4444'

  return (
    <motion.div
      animate={{
        boxShadow: isHuman
          ? '0 25px 50px -12px rgba(0,0,0,0.5), 0 0 60px rgba(16,185,129,0.08)'
          : '0 25px 50px -12px rgba(0,0,0,0.5)',
      }}
      transition={{ duration: 0.8 }}
      className="bg-slate-800 rounded-2xl border border-slate-700 p-6 w-full max-w-md mx-auto"
      role="img"
      aria-label="Animated demonstration of AI detector showing before and after humanising"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500" />
          <span className="w-3 h-3 rounded-full bg-yellow-500" />
          <span className="w-3 h-3 rounded-full bg-green-500" />
        </div>

        <div className="flex items-center gap-2">
          <Shield size={14} className="text-slate-400" />
          <span className="text-slate-300 text-sm font-medium">AI Detector</span>
        </div>

        <AnimatePresence mode="wait">
          {isHuman ? (
            <motion.span
              key="complete"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Complete
            </motion.span>
          ) : (
            <motion.span
              key="scanning"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded-full border border-amber-500/20"
            >
              <motion.span
                className="w-1.5 h-1.5 rounded-full bg-amber-400"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
              Scanning…
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Score display */}
      <div className="flex flex-col items-center mb-5">
        <div className="relative">
          <ScoreRing score={count} color={scoreColor} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span
              key={count}
              className="text-2xl font-bold text-slate-100 tabular-nums"
            >
              {count}%
            </motion.span>
            <span className="text-slate-500 text-xs mt-0.5">Human</span>
          </div>
        </div>

        {/* Verdict badge */}
        <AnimatePresence mode="wait">
          {isHuman ? (
            <motion.span
              key="likely-human"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              className="mt-3 px-4 py-1.5 rounded-full border text-sm font-semibold
                         bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
            >
              Likely Human
            </motion.span>
          ) : (
            <motion.span
              key="definitely-ai"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              className="mt-3 px-4 py-1.5 rounded-full border text-sm font-semibold
                         bg-red-500/20 text-red-400 border-red-500/30"
            >
              Definitely AI
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Sentence highlights */}
      <div className="space-y-2 mb-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={isHuman ? 'human-sentences' : 'ai-sentences'}
            initial={prefersReduced ? {} : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={prefersReduced ? {} : { opacity: 0 }}
            className="space-y-2"
          >
            {sentences.map((s, i) => (
              <motion.div
                key={s.text}
                initial={prefersReduced ? {} : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: prefersReduced ? 0 : i * 0.08, duration: 0.3 }}
                className={cn(
                  'flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs',
                  SENTENCE_STYLES[s.cls].row,
                )}
              >
                <span className="flex-1 truncate">{s.text}</span>
                <span className={cn('shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold', SENTENCE_STYLES[s.cls].badge)}>
                  {s.badge}
                </span>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom action */}
      <AnimatePresence mode="wait">
        {isHuman ? (
          <motion.div
            key="pass"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-center justify-center gap-2 py-2.5 rounded-lg
                       bg-emerald-500/10 text-emerald-400 text-sm"
          >
            <Check size={14} />
            Text passes AI detection ✓
          </motion.div>
        ) : (
          <motion.button
            key="humanise-btn"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            onClick={() => navigate('/app')}
            aria-label="Go to humaniser to fix this AI-detected text"
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg
                       bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold
                       transition-colors duration-200"
          >
            Humanise This Text
            <ArrowRight size={14} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* State toggle indicator */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={isHuman ? 'Switch to before humanising view' : 'Switch to after humanising view'}
        className="flex flex-col items-center gap-2 mt-4 w-full group"
      >
        <div className="flex items-center gap-1.5">
          <motion.div
            animate={{ width: isHuman ? '8px' : '24px' }}
            transition={{ duration: 0.3 }}
            className="h-2 rounded-full bg-emerald-500"
          />
          <motion.div
            animate={{ width: isHuman ? '24px' : '8px' }}
            transition={{ duration: 0.3 }}
            className="h-2 rounded-full bg-emerald-500"
          />
        </div>
        <span className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors">
          {isHuman ? 'After Humanising' : 'Before Humanising'} — click to toggle
        </span>
      </button>
    </motion.div>
  )
}

// ── Flow Diagram ───────────────────────────────────────────────────────────
function FlowDiagram({ isInView }: { isInView: boolean }) {
  const steps = [
    {
      icon: FileText,
      title: 'Paste Your Text',
      desc: 'Drop in any AI-generated content',
      style: 'bg-slate-800 border-slate-700',
      iconStyle: 'text-slate-400',
      arrow: 'Detect',
    },
    {
      icon: Shield,
      title: 'Check the Score',
      desc: 'See your human score instantly',
      style: 'bg-emerald-500/10 border-emerald-500/20',
      iconStyle: 'text-emerald-400',
      arrow: 'If AI detected',
    },
    {
      icon: Sparkles,
      title: 'Humanise It',
      desc: 'One click to transform your text',
      style: 'bg-indigo-500/10 border-indigo-500/20',
      iconStyle: 'text-indigo-400',
      arrow: null,
    },
  ]

  return (
    <div className="mt-16">
      <div className="flex flex-col sm:flex-row items-center justify-center gap-0 sm:gap-0">
        {steps.map((step, i) => {
          const Icon = step.icon
          return (
            <div key={step.title} className="flex flex-col sm:flex-row items-center w-full sm:w-auto">
              <motion.div
                initial={prefersReduced ? {} : { opacity: 0, y: 16 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: prefersReduced ? 0 : i * 0.15 }}
                className={cn(
                  'border rounded-xl p-5 text-center w-full sm:w-44',
                  step.style,
                )}
              >
                <Icon size={22} className={cn('mx-auto mb-2', step.iconStyle)} />
                <p className="text-slate-200 font-semibold text-sm">{step.title}</p>
                <p className="text-slate-500 text-xs mt-1">{step.desc}</p>
              </motion.div>

              {step.arrow && (
                <motion.div
                  initial={prefersReduced ? {} : { opacity: 0 }}
                  animate={isInView ? { opacity: 1 } : {}}
                  transition={{ duration: 0.4, delay: prefersReduced ? 0 : i * 0.15 + 0.2 }}
                  className="flex flex-col items-center mx-3 my-2 sm:my-0 shrink-0"
                >
                  <span className="text-slate-500 text-xs mb-1">{step.arrow}</span>
                  <ArrowRight size={16} className="text-slate-600 hidden sm:block" />
                  <div className="w-px h-4 bg-slate-700 sm:hidden" />
                </motion.div>
              )}
            </div>
          )
        })}
      </div>
      <p className="text-slate-500 text-sm text-center mt-5">
        The complete workflow — in under 60 seconds
      </p>
    </div>
  )
}

// ── DetectorShowcase (main export) ─────────────────────────────────────────
export default function DetectorShowcase() {
  const navigate = useNavigate()
  const [isHuman, setIsHuman] = useState(false)
  const [count, setCount] = useState(18)
  const [paused, setPaused] = useState(false)

  const ref = useRef<HTMLElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  // Auto-toggle every 4 seconds (pauses on hover)
  useEffect(() => {
    if (paused) return
    const timer = setInterval(() => setIsHuman((prev) => !prev), 4000)
    return () => clearInterval(timer)
  }, [paused])

  // Animate count when state changes
  const animateCount = useCallback((target: number, start: number) => {
    if (prefersReduced) {
      setCount(target)
      return
    }
    const duration = 1200
    const startTime = Date.now()
    let rafId: number

    const tick = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(start + (target - start) * eased))
      if (progress < 1) rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])

  useEffect(() => {
    const target = isHuman ? 91 : 18
    const start = isHuman ? 18 : 91
    const cancel = animateCount(target, start)
    return cancel
  }, [isHuman, animateCount])

  const featurePoints = [
    'Sentence-by-sentence breakdown',
    'Human score from 0 to 100',
    'Detailed analysis of AI patterns found',
  ]

  return (
    <section
      ref={ref}
      aria-label="AI Detector Demo"
      className="relative bg-dark overflow-hidden py-24 px-6"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Dot grid background */}
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage: 'radial-gradient(circle, #334155 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-6xl mx-auto">
        {/* Two-column layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center">

          {/* ── Left column ─────────────────────────────────────────────── */}
          <motion.div
            initial={prefersReduced ? {} : { opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6 }}
          >
            {/* Section label */}
            <span className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full px-4 py-1.5 text-sm font-medium mb-5">
              🔍 AI Detector
            </span>

            {/* Heading */}
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight mb-4">
              Know exactly how human{' '}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-400">
                your text sounds
              </span>
            </h2>

            {/* Subtext */}
            <p className="text-slate-400 text-lg leading-relaxed mb-6">
              Paste any text and get an instant human score. Our detector analyses sentence by
              sentence — showing you exactly what reads as AI and what reads as human. Use it before
              humanising to see the problem. Use it after to verify the fix.
            </p>

            {/* Feature points */}
            <ul className="space-y-3 mb-8">
              {featurePoints.map((point) => (
                <li key={point} className="flex items-center gap-3 text-slate-300">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20 shrink-0">
                    <Check size={11} className="text-emerald-400" />
                  </span>
                  {point}
                </li>
              ))}
            </ul>

            {/* CTA */}
            <button
              type="button"
              onClick={() => navigate('/app/detector')}
              aria-label="Try the AI Detector for free"
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500
                         text-white px-6 py-3 rounded-xl font-semibold text-base
                         transition-colors duration-200 shadow-lg shadow-emerald-900/40"
            >
              Try the Detector Free
              <ArrowRight size={16} />
            </button>
            <p className="text-slate-500 text-sm mt-2">No account needed for first scan</p>
          </motion.div>

          {/* ── Right column — Demo card ─────────────────────────────────── */}
          <motion.div
            initial={prefersReduced ? {} : { opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: prefersReduced ? 0 : 0.2 }}
            className="flex justify-center"
          >
            <DemoCard
              isHuman={isHuman}
              count={count}
              onToggle={() => setIsHuman((p) => !p)}
            />
          </motion.div>
        </div>

        {/* ── Flow diagram ──────────────────────────────────────────────── */}
        <FlowDiagram isInView={isInView} />
      </div>
    </section>
  )
}
