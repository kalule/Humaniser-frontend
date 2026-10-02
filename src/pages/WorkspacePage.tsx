import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, Shield, Copy, Upload, Check,
  FileText, ArrowRight, Loader2,
  TrendingUp, Wand2,
} from 'lucide-react'
import toast from 'react-hot-toast'

import { useAuthStore } from '../store/authStore'
import { humaniseApi } from '../api/humanise'
import { detectorApi } from '../api/detector'
import type { DetectResponse } from '../types/detector'
import type { Tone, Strength } from '../types'
import { ToneSelector } from '../components/ui/ToneSelector'
import { Toggle } from '../components/ui/Toggle'
import { DetectionScoreGauge, DETECTION_SCORE_THRESHOLDS } from '../components/workspace/DetectionScoreGauge'
import { DiffText } from '../components/workspace/DiffText'
import { cn } from '../lib/utils'

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

// ── RewriteIntensityControl ───────────────────────────────────────────────────

const INTENSITY_OPTIONS: { value: Strength; label: string; desc: string }[] = [
  { value: 'light', label: 'Light', desc: 'Subtle changes' },
  { value: 'medium', label: 'Natural', desc: 'Balanced rewrite' },
  { value: 'heavy', label: 'Full', desc: 'Aggressive rewrite' },
]

function RewriteIntensityControl({
  value,
  onChange,
}: {
  value: Strength
  onChange: (v: Strength) => void
}) {
  return (
    <div role="tablist" aria-label="Rewrite intensity" className="flex rounded-xl overflow-hidden border border-slate-700 shrink-0">
      {INTENSITY_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={value === opt.value}
          onClick={() => onChange(opt.value)}
          title={opt.desc}
          className={cn(
            'px-3.5 py-1.5 text-xs font-medium transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:ring-inset',
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

// ── AI score badge (before/after pill in the output header) ──────────────────

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

// ── OutputEmptyState ──────────────────────────────────────────────────────────

function OutputEmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border border-indigo-500/30 flex items-center justify-center mb-4">
        <Sparkles size={22} className="text-indigo-400" />
      </div>
      <h3 className="text-slate-200 font-semibold text-base mb-2">Humanised text will appear here</h3>
      <p className="text-slate-500 text-sm max-w-xs leading-relaxed">
        Select your tone and intensity, paste text on the left, and click Humanise Text
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
  const [showChanges, setShowChanges] = useState(false)
  const [copied, setCopied] = useState(false)

  const inputWordCount = inputText.trim() ? inputText.trim().split(/\s+/).length : 0
  const outputWordCount = outputText.trim() ? outputText.trim().split(/\s+/).length : 0
  const hasOutput = !!outputText

  const handleHumanise = useCallback(async () => {
    if (!inputText.trim() || isHumanising) return

    setIsHumanising(true)
    setIsDetectingInput(true)
    setOutputText('')
    setOutputDetection(null)
    setInputDetection(null)
    setShowChanges(false)
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

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(outputText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy')
    }
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

  const humanPct = outputDetection ? Math.round(outputDetection.humanScore) : null
  const signalCount = outputDetection ? outputDetection.flags.length : null
  const humanPctClass =
    humanPct === null
      ? ''
      : humanPct >= DETECTION_SCORE_THRESHOLDS.human
        ? 'bg-emerald-500/15 text-emerald-400'
        : humanPct >= DETECTION_SCORE_THRESHOLDS.mixed
          ? 'bg-amber-500/15 text-amber-400'
          : 'bg-red-500/15 text-red-400'

  return (
    <div className="min-h-0 bg-slate-900 w-full">
      <main className="w-full px-4 py-6 space-y-4">

        {/* Controls bar — single strip above the editors */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Sparkles size={15} className="text-indigo-400" />
            <span className="font-medium text-slate-200">Humaniser</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap ml-2">
            <ToneSelector value={tone} onChange={setTone} compact />
            <RewriteIntensityControl value={strength} onChange={setStrength} />
          </div>
        </div>

        {/* Split panel — always visible */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

          {/* Left: input */}
          <div className="lg:sticky lg:top-4 bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden flex flex-col shadow-sm" style={panelHeight}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700 shrink-0">
              <div className="flex items-center gap-2 text-slate-300 font-medium text-sm">
                <FileText size={15} className="text-slate-400" />
                Your Text
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 rounded px-1.5 py-0.5 -mr-1.5',
                )}
              >
                <Upload size={12} />
                Upload file
              </button>
            </div>

            {/* Textarea */}
            <div className="flex-1 flex flex-col min-h-0">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste your AI-generated text here to humanise it..."
                className={cn(
                  'flex-1 w-full bg-transparent text-slate-200 placeholder:text-slate-500 resize-none px-5 py-4 text-sm leading-relaxed',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/40',
                )}
              />
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-700/50 flex items-center justify-between gap-3 shrink-0">
              <span className={cn(
                'text-xs font-medium',
                inputWordCount === 0 ? 'text-slate-500' : inputWordCount < 50 ? 'text-red-400' : 'text-slate-400',
              )}>
                {inputWordCount > 0 ? `${inputWordCount}w` : 'Min. 50 words'}
              </span>
              <button
                type="button"
                onClick={handleHumanise}
                disabled={inputWordCount < 10 || isHumanising}
                className={cn(
                  'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all',
                  'bg-gradient-to-r from-indigo-600 to-purple-600 text-white',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800',
                  inputWordCount >= 10 && !isHumanising && 'hover:opacity-90 shadow shadow-indigo-500/20',
                )}
              >
                {isHumanising ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Humanising…
                  </>
                ) : (
                  <>
                    <Wand2 size={15} />
                    Humanise Text
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right: output */}
          <div className="space-y-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden flex flex-col shadow-sm" style={panelHeight}>
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
                    <DetectionScoreGauge
                      humanScore={outputDetection?.humanScore ?? 0}
                      isLoading={isDetectingOutput}
                    />
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
                      ) : showChanges ? (
                        <DiffText original={inputText} revised={outputText} />
                      ) : (
                        <TypewriterText text={outputText} />
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer */}
              {hasOutput && !isHumanising && (
                <div className="px-5 py-3 border-t border-slate-700/50 flex items-center justify-between gap-3 shrink-0 flex-wrap">
                  {/* Quality badges */}
                  <div className="flex items-center gap-2">
                    {outputDetection ? (
                      <>
                        <span className={cn('px-2.5 py-1 rounded-full text-xs font-semibold', humanPctClass)}>
                          {humanPct}% Human
                        </span>
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-700/60 text-slate-300">
                          {signalCount} AI signal{signalCount === 1 ? '' : 's'}
                        </span>
                      </>
                    ) : isDetectingOutput ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-slate-700/60 text-slate-400">
                        <Loader2 size={10} className="animate-spin" />
                        Scoring…
                      </span>
                    ) : null}
                  </div>

                  {/* Utility actions */}
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={handleCopy}
                      className={cn(
                        'flex items-center gap-1.5 text-xs transition-colors px-2.5 py-1.5 rounded-lg hover:bg-slate-700/50',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60',
                        copied ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200',
                      )}
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                    <label className="flex items-center gap-2 text-xs text-slate-400 select-none">
                      Show changes
                      <Toggle checked={showChanges} onChange={setShowChanges} label="Show changes" />
                    </label>
                  </div>
                </div>
              )}
            </div>
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
