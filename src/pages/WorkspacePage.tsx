import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, Shield, Copy, Download, RotateCcw,
  FileText, ArrowRight, Loader2, CheckCircle,
  TrendingUp, Wand2, Brain,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'
import { humaniseApi } from '../api/humanise'
import { detectorApi } from '../api/detector'
import type { DetectResponse } from '../types/detector'
import type { Tone, Strength } from '../types'
import { ToneSelector } from '../components/ui/ToneSelector'
import { cn } from '../lib/utils'

// ── Word-diff highlighter ─────────────────────────────────────────────────────

// ── Typewriter ────────────────────────────────────────────────────────────────

function TypewriterText({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState('')
  const indexRef = useRef(0)

  useEffect(() => {
    setDisplayed('')
    indexRef.current = 0
    if (!text) return
    const interval = setInterval(() => {
      if (indexRef.current < text.length) {
        setDisplayed(text.slice(0, indexRef.current + 1))
        indexRef.current += 1
      } else {
        clearInterval(interval)
      }
    }, 8)
    return () => clearInterval(interval)
  }, [text])

  return (
    <p className="text-slate-100 text-sm leading-relaxed whitespace-pre-wrap">
      {displayed}
      {displayed.length < text.length && (
        <span className="inline-block w-0.5 h-4 bg-indigo-500 ml-0.5 animate-pulse" />
      )}
    </p>
  )
}

// ── StrengthControl ───────────────────────────────────────────────────────────

const STRENGTH_OPTIONS: { value: Strength; label: string; desc: string }[] = [
  { value: 'light', label: 'Light', desc: 'Subtle changes' },
  { value: 'medium', label: 'Medium', desc: 'Balanced rewrite' },
  { value: 'heavy', label: 'Heavy', desc: 'Aggressive rewrite' },
]

function StrengthControl({
  value,
  onChange,
}: {
  value: Strength
  onChange: (v: Strength) => void
}) {
  return (
    <div className="flex rounded-xl overflow-hidden border border-slate-700 shrink-0">
      {STRENGTH_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          title={opt.desc}
          className={cn(
            'px-3.5 py-1.5 text-xs font-medium transition-colors',
            value === opt.value
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ── AI score badge ────────────────────────────────────────────────────────────

function AiScoreBadge({
  result,
  isLoading,
  label,
}: {
  result: DetectResponse | null
  isLoading: boolean
  label: string
}) {
  if (isLoading) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-slate-700/60 text-slate-400">
        <Loader2 size={10} className="animate-spin" />
        {label}
      </span>
    )
  }
  if (!result) return null

  const score = result.aiScore
  const badgeClass =
    score <= 15
      ? 'bg-emerald-500/20 text-emerald-400'
      : score <= 30
        ? 'bg-lime-500/20 text-lime-400'
        : score <= 50
          ? 'bg-amber-500/20 text-amber-400'
          : 'bg-red-500/20 text-red-400'

  return (
    <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium', badgeClass)}>
      {score}% AI
    </span>
  )
}

// ── ImprovementBanner ─────────────────────────────────────────────────────────

function ImprovementBanner({
  inputScore,
  outputScore,
  onRerunStronger,
}: {
  inputScore: number
  outputScore: number
  onRerunStronger: () => void
}) {
  const delta = outputScore - inputScore // positive = better (more human)

  if (delta >= 20 && outputScore >= 70) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
        <CheckCircle size={14} className="shrink-0" />
        <span className="font-medium">
          +{delta} pts improvement · {inputScore}% → {outputScore}% Human
        </span>
      </div>
    )
  }

  if (outputScore < 60) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
        <span>Still reading as AI — try a stronger rewrite</span>
        <button
          type="button"
          onClick={onRerunStronger}
          className="shrink-0 text-red-300 hover:text-red-200 font-medium underline underline-offset-2 transition-colors"
        >
          Try Stronger →
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
      <span>Moderate improvement · consider re-running at higher strength</span>
      <button
        type="button"
        onClick={onRerunStronger}
        className="shrink-0 text-amber-300 hover:text-amber-200 font-medium underline underline-offset-2 transition-colors"
      >
        Re-run Stronger →
      </button>
    </div>
  )
}

// ── OutputEmptyState ──────────────────────────────────────────────────────────

function OutputEmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border border-indigo-500/30 flex items-center justify-center mb-4">
        <Sparkles size={22} className="text-indigo-400" />
      </div>
      <h3 className="text-slate-200 font-semibold text-base mb-2">Humanised text will appear here</h3>
      <p className="text-slate-500 text-sm max-w-xs leading-relaxed">
        Select your tone and strength, paste text on the left, and click Humanise
      </p>
      <div className="mt-6 space-y-2 w-full max-w-xs">
        {[
          { icon: Wand2, text: 'Rewrites to sound naturally human' },
          { icon: TrendingUp, text: 'Shows AI score before and after' },
          { icon: Shield, text: 'Bypasses most AI detectors' },
        ].map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center gap-3 px-3 py-2.5 bg-slate-700/30 rounded-xl text-left">
            <Icon size={14} className="text-indigo-400 shrink-0" />
            <p className="text-slate-400 text-xs">{text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main WorkspacePage ────────────────────────────────────────────────────────

export function WorkspacePage() {
  const navigate = useNavigate()
  const updateUser = useAuthStore((s) => s.updateUser)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [inputText, setInputText] = useState('')
  const [outputText, setOutputText] = useState('')
  const [tone, setTone] = useState<Tone>('professional')
  const [strength, setStrength] = useState<Strength>('medium')
  const [isHumanising, setIsHumanising] = useState(false)
  const [isDetectingInput, setIsDetectingInput] = useState(false)
  const [isDetectingOutput, setIsDetectingOutput] = useState(false)
  const [inputDetection, setInputDetection] = useState<DetectResponse | null>(null)
  const [outputDetection, setOutputDetection] = useState<DetectResponse | null>(null)
  const [typewriterDone, setTypewriterDone] = useState(false)

  const inputWordCount = inputText.trim() ? inputText.trim().split(/\s+/).length : 0
  const outputWordCount = outputText.trim() ? outputText.trim().split(/\s+/).length : 0
  const hasOutput = !!outputText
  const bothScores = inputDetection !== null && outputDetection !== null

  // Mark typewriter done when output is set
  useEffect(() => {
    if (outputText) {
      setTypewriterDone(false)
      const timeout = setTimeout(() => setTypewriterDone(true), outputText.length * 8 + 200)
      return () => clearTimeout(timeout)
    }
  }, [outputText])

  const handleHumanise = useCallback(async () => {
    if (!inputText.trim() || isHumanising) return

    setIsHumanising(true)
    setIsDetectingInput(true)
    setOutputText('')
    setOutputDetection(null)
    setInputDetection(null)
    const [humaniseRes, detectInputRes] = await Promise.allSettled([
      humaniseApi.humanise({ text: inputText, tone, strength }).then((r) => r.data),
      inputText.length >= 50 ? detectorApi.detect({ text: inputText.slice(0, 10000) }) : Promise.resolve(null),
    ])

    if (humaniseRes.status === 'fulfilled') {
      const data = humaniseRes.value
      setOutputText(data.humanisedText)
      updateUser({ wordsUsed: data.usage.wordsUsed, wordsLimit: data.usage.wordsLimit })

      setTimeout(async () => {
        if (data.humanisedText.length < 50) return
        setIsDetectingOutput(true)
        try {
          const outputDetect = await detectorApi.detect({ text: data.humanisedText })
          setOutputDetection(outputDetect)
        } catch {
          // silent fail
        } finally {
          setIsDetectingOutput(false)
        }
      }, 600)
    } else {
      const err = humaniseRes.reason
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? (err as { message: string }).message
          : 'Failed to humanise. Please try again.'
      toast.error(msg)
    }

    if (detectInputRes.status === 'fulfilled') setInputDetection(detectInputRes.value)
    setIsDetectingInput(false)
    setIsHumanising(false)
  }, [inputText, tone, strength, updateUser])

  const handleRerunStronger = useCallback(() => {
    const order: Strength[] = ['light', 'medium', 'heavy']
    const idx = order.indexOf(strength)
    if (idx < order.length - 1) setStrength(order[idx + 1])
    setTimeout(handleHumanise, 50)
  }, [strength, handleHumanise])

  const handleClear = () => {
    setInputText('')
    setOutputText('')
    setInputDetection(null)
    setOutputDetection(null)
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(outputText)
      toast.success('Copied to clipboard!')
    } catch {
      toast.error('Failed to copy')
    }
  }

  const handleDownload = () => {
    const blob = new Blob([outputText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'humanised.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    if (file.name.endsWith('.txt')) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const content = ev.target?.result
        if (typeof content === 'string') {
          setInputText(content)
          toast.success('File uploaded')
        }
      }
      reader.readAsText(file)
    } else {
      toast('Only .txt files are supported right now', { icon: '📄' })
    }
  }

  const panelHeight = { height: 'calc(100vh - 7rem)' }

  return (
    <div className="min-h-0 bg-slate-900 w-full">
      <main className="w-full px-4 py-6 space-y-4">

        {/* Controls bar — always at top */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Sparkles size={15} className="text-indigo-400" />
            <span className="font-medium text-slate-200">Humaniser</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap ml-2">
            <ToneSelector value={tone} onChange={setTone} compact />
            <StrengthControl value={strength} onChange={setStrength} />
          </div>
        </div>

        {/* Split panel — always visible */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

          {/* Left: input */}
          <div className="lg:sticky lg:top-4 bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden flex flex-col" style={panelHeight}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700 shrink-0">
              <div className="flex items-center gap-2 text-slate-300 font-medium text-sm">
                <FileText size={15} className="text-slate-400" />
                Your Text
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Upload file
                </button>
                <span className={cn(
                  'text-xs font-semibold px-2.5 py-1 rounded-full',
                  inputWordCount === 0 ? 'bg-slate-700 text-slate-400'
                    : inputWordCount < 50 ? 'bg-red-500/15 text-red-400'
                    : inputWordCount < 200 ? 'bg-amber-500/15 text-amber-400'
                    : 'bg-slate-700 text-slate-300',
                )}>
                  {inputWordCount} words
                </span>
              </div>
            </div>

            {/* Textarea */}
            <div className="flex-1 flex flex-col min-h-0">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste your AI-generated text here to humanise it..."
                className="flex-1 w-full bg-transparent text-slate-200 placeholder:text-slate-500 resize-none focus:outline-none px-5 py-4 text-sm leading-relaxed"
              />
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-700/50 flex items-center justify-between gap-3 shrink-0">
              {hasOutput ? (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1.5"
                >
                  <RotateCcw size={12} />
                  Clear
                </button>
              ) : (
                <span className="text-xs text-slate-500">Min. 50 words</span>
              )}
              <div className="flex items-center gap-3">
                {isHumanising && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleHumanise}
                  disabled={inputWordCount < 10 || isHumanising}
                  className={cn(
                    'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all',
                    'bg-gradient-to-r from-indigo-600 to-purple-600 text-white',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    inputWordCount >= 10 && !isHumanising && 'hover:opacity-90 shadow shadow-indigo-500/20',
                  )}
                >
                  {isHumanising ? (
                    <>
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                        <Brain size={15} />
                      </motion.div>
                      Humanising…
                    </>
                  ) : (
                    <>
                      <Sparkles size={15} />
                      {hasOutput ? 'Re-humanise' : 'Humanise'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Right: output */}
          <div className="space-y-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden flex flex-col" style={panelHeight}>
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700 shrink-0">
                <div className="flex items-center gap-3">
                  <span className="text-slate-300 font-medium text-sm">Humanised</span>
                  {outputWordCount > 0 && (
                    <span className="text-xs text-slate-500 font-mono">
                      {outputWordCount} words
                      {inputWordCount > 0 && (
                        <span className={cn(
                          'ml-1',
                          outputWordCount > inputWordCount ? 'text-amber-500/70' : 'text-slate-600'
                        )}>
                          ({outputWordCount > inputWordCount ? '+' : ''}{outputWordCount - inputWordCount})
                        </span>
                      )}
                    </span>
                  )}
                </div>

                {/* Detection scores: before → after */}
                <div className="flex items-center gap-2">
                  {(inputDetection || isDetectingInput) && (
                    <>
                      <AiScoreBadge result={inputDetection} isLoading={isDetectingInput} label="Checking…" />
                      {(outputDetection || isDetectingOutput) && (
                        <ArrowRight size={12} className="text-slate-600" />
                      )}
                    </>
                  )}
                  {(outputDetection || isDetectingOutput) && (
                    <AiScoreBadge result={outputDetection} isLoading={isDetectingOutput} label="Checking…" />
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 flex flex-col min-h-0">
                <AnimatePresence mode="wait">
                  {!hasOutput && !isHumanising ? (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex-1"
                    >
                      <OutputEmptyState />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="output"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex-1 overflow-y-auto px-5 py-4"
                    >
                      {isHumanising ? (
                        <div className="space-y-2.5 pt-1">
                          {[1, 0.85, 1, 0.75, 0.9, 0.95, 0.8].map((w, i) => (
                            <div
                              key={i}
                              className="h-4 rounded bg-gradient-to-r from-white/5 via-white/10 to-white/5 animate-pulse"
                              style={{ width: `${w * 100}%`, animationDelay: `${i * 0.1}s` }}
                            />
                          ))}
                        </div>
                      ) : (
                        <TypewriterText text={outputText} />
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer */}
              {hasOutput && !isHumanising && (
                <div className="px-5 py-3 border-t border-slate-700/50 flex items-center justify-end gap-3 shrink-0 flex-wrap">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => navigate('/app/detector')}
                      className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-slate-700/50"
                    >
                      <Shield size={12} />
                      Check for AI
                    </button>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-slate-700/50"
                    >
                      <Copy size={12} />
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-slate-700/50"
                    >
                      <Download size={12} />
                      Download
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Improvement banner */}
            {bothScores && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <ImprovementBanner
                  inputScore={inputDetection!.humanScore}
                  outputScore={outputDetection!.humanScore}
                  onRerunStronger={handleRerunStronger}
                />
              </motion.div>
            )}

            {/* Cross-tool CTA: detect output for AI */}
            {outputDetection && outputDetection.aiScore >= 20 && (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                type="button"
                onClick={() => {
                  sessionStorage.setItem('detector_input', outputText)
                  navigate('/app/detector')
                }}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl
                           bg-slate-800 border border-slate-700 text-slate-200 font-medium
                           hover:bg-slate-700 hover:border-slate-600 transition-colors text-sm"
              >
                <Shield size={15} className="text-emerald-400" />
                Run Full AI Detection on Output
                <ArrowRight size={14} className="text-slate-500" />
              </motion.button>
            )}
          </div>
        </div>
      </main>

      <input
        ref={fileInputRef}
        type="file"
        accept=".txt"
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />
    </div>
  )
}

export default WorkspacePage
