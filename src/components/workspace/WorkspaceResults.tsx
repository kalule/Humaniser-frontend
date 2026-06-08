import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ClipboardCopy, RotateCcw, X, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { ScoreCircle } from '../ui/ScoreCircle'
import { ToneSelector } from '../ui/ToneSelector'
import { LevelSlider } from '../ui/LevelSlider'
import type { DetectResponse } from '../../types/detector'
import type { Tone } from '../../types'
import toast from 'react-hot-toast'

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

// ── Score badge ───────────────────────────────────────────────────────────────
function ScoreBadge({
  result,
  isLoading,
  onCheck,
}: {
  result: DetectResponse | null
  isLoading: boolean
  onCheck?: () => void
}) {
  if (isLoading) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-slate-700 text-slate-400">
        <Loader2 size={11} className="animate-spin" />
        Checking...
      </span>
    )
  }
  if (!result) {
    if (onCheck) {
      return (
        <button
          type="button"
          onClick={onCheck}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-slate-700 text-slate-400 hover:text-white transition-colors"
        >
          Check AI score
        </button>
      )
    }
    return null
  }

  const score = result.humanScore
  const badgeClass =
    score >= 80
      ? 'bg-emerald-500/20 text-emerald-400'
      : score >= 60
        ? 'bg-lime-500/20 text-lime-400'
        : score >= 40
          ? 'bg-amber-500/20 text-amber-400'
          : 'bg-red-500/20 text-red-400'

  return (
    <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium', badgeClass)}>
      {score}% Human — {result.verdict}
      {score >= 80 && ' ✓'}
    </span>
  )
}

// ── Improvement banner ────────────────────────────────────────────────────────
function ImprovementBanner({
  inputScore,
  outputScore,
  onRerunStronger,
}: {
  inputScore: number
  outputScore: number
  onRerunStronger: () => void
}) {
  const delta = outputScore - inputScore

  let bannerClass = 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
  let message = `▲ +${delta} points · ${inputScore}% → ${outputScore}% Human 🎉`

  if (delta < 20) {
    bannerClass = 'bg-amber-500/10 border-amber-500/20 text-amber-400'
    message = `Moderate improvement — try higher strength`
  }
  if (outputScore < 60) {
    bannerClass = 'bg-red-500/10 border-red-500/20 text-red-400'
    message = `Still reading as AI — try stronger rewrite`
  }

  return (
    <div className={cn('border rounded-xl p-3 text-center text-sm font-medium', bannerClass)}>
      <span>{message}</span>
      {outputScore < 60 && (
        <button
          type="button"
          onClick={onRerunStronger}
          className="ml-3 underline underline-offset-2 hover:opacity-80 transition-opacity"
        >
          Try Stronger →
        </button>
      )}
    </div>
  )
}

// ── Humanise results ──────────────────────────────────────────────────────────
interface HumaniseResultsProps {
  inputText: string
  outputText: string
  inputDetection: DetectResponse | null
  outputDetection: DetectResponse | null
  isDetectingInput: boolean
  isDetectingOutput: boolean
  isHumanising: boolean
  tone: Tone
  level: number
  onToneChange: (t: Tone) => void
  onLevelChange: (v: number) => void
  onRerun: () => void
  onReset: () => void
}

function HumaniseResults({
  inputText,
  outputText,
  inputDetection,
  outputDetection,
  isDetectingInput,
  isDetectingOutput,
  isHumanising,
  tone,
  level,
  onToneChange,
  onLevelChange,
  onRerun,
  onReset,
}: HumaniseResultsProps) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(outputText)
      toast.success('Copied to clipboard!')
    } catch {
      toast.error('Failed to copy')
    }
  }

  const bothScores =
    inputDetection !== null && outputDetection !== null

  const showRerunStronger =
    outputDetection !== null && outputDetection.humanScore < 70

  return (
    <div className="space-y-4">
      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500 mb-2">Tone</p>
          <ToneSelector value={tone} onChange={onToneChange} compact />
        </div>
        <div className="w-48 shrink-0">
          <LevelSlider value={level} onChange={onLevelChange} />
        </div>
      </div>

      {/* Two-column panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Original */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-200">Original</span>
              <span className="text-xs text-slate-500">
                {inputText.trim().split(/\s+/).length} words
              </span>
            </div>
            <ScoreBadge result={inputDetection} isLoading={isDetectingInput} />
          </div>
          <div className="p-4 max-h-64 overflow-y-auto">
            <p className="text-slate-400 text-sm leading-relaxed whitespace-pre-wrap">
              {inputText}
            </p>
          </div>
        </div>

        {/* Humanised */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-200">Humanised</span>
              {outputText && (
                <span className="text-xs text-slate-500">
                  {outputText.trim().split(/\s+/).length} words
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <ScoreBadge result={outputDetection} isLoading={isDetectingOutput} />
              {outputText && (
                <button
                  type="button"
                  onClick={handleCopy}
                  className="text-slate-400 hover:text-white transition-colors"
                  aria-label="Copy humanised text"
                >
                  <ClipboardCopy size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="p-4 max-h-64 overflow-y-auto">
            {isHumanising ? (
              <div className="space-y-2.5">
                {[1, 0.85, 1, 0.75, 0.9].map((w, i) => (
                  <div
                    key={i}
                    className="h-4 rounded bg-gradient-to-r from-white/5 via-white/10 to-white/5 animate-pulse"
                    style={{ width: `${w * 100}%` }}
                  />
                ))}
              </div>
            ) : outputText ? (
              <TypewriterText text={outputText} />
            ) : null}
          </div>
        </div>
      </div>

      {/* Improvement banner */}
      {bothScores && inputDetection && outputDetection && (
        <ImprovementBanner
          inputScore={inputDetection.humanScore}
          outputScore={outputDetection.humanScore}
          onRerunStronger={onRerun}
        />
      )}

      {/* Action row */}
      <div className="flex flex-wrap items-center gap-2">
        {outputText && (
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 transition-colors"
          >
            <ClipboardCopy size={14} />
            Copy Output
          </button>
        )}
        {showRerunStronger && (
          <button
            type="button"
            onClick={onRerun}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 transition-colors"
          >
            <RotateCcw size={14} />
            Re-run Stronger
          </button>
        )}
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 transition-colors ml-auto"
        >
          <X size={14} />
          Start Over
        </button>
      </div>
    </div>
  )
}

// ── Detect results ────────────────────────────────────────────────────────────
interface DetectResultsProps {
  result: DetectResponse
  onReset: () => void
  onHumanise: () => void
}

function DetectResults({ result, onReset, onHumanise }: DetectResultsProps) {
  const scoreColor =
    result.humanScore >= 80
      ? 'text-emerald-400'
      : result.humanScore >= 60
        ? 'text-lime-400'
        : result.humanScore >= 40
          ? 'text-amber-400'
          : 'text-red-400'

  return (
    <div className="space-y-4">
      {/* Score card */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 flex flex-col sm:flex-row items-center gap-6">
        <ScoreCircle score={result.humanScore} size="md" />
        <div className="flex-1 text-center sm:text-left">
          <p className={cn('text-2xl font-bold', scoreColor)}>
            {result.humanScore}% Human
          </p>
          <p className="text-slate-400 mt-1">{result.verdict}</p>
          <p className="text-xs text-slate-500 mt-2">{result.wordCount} words analysed</p>
        </div>
      </div>

      {/* Sentence breakdown */}
      {result.sentenceScores.length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <p className="text-sm font-semibold text-slate-200 mb-3">Sentence Analysis</p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {result.sentenceScores.map((s, i) => {
              const borderColor =
                s.aiProbability > 70
                  ? 'border-red-500'
                  : s.aiProbability > 40
                    ? 'border-amber-500'
                    : 'border-emerald-500'
              const badgeColor =
                s.aiProbability > 70
                  ? 'bg-red-500/20 text-red-400'
                  : s.aiProbability > 40
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-emerald-500/20 text-emerald-400'
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 bg-slate-700/50 rounded-lg border-l-2',
                    borderColor,
                  )}
                >
                  <p className="flex-1 text-xs text-slate-300 leading-snug truncate">{s.sentence}</p>
                  <span className={cn('shrink-0 text-xs px-1.5 py-0.5 rounded font-semibold', badgeColor)}>
                    {s.classification === 'human'
                      ? `${100 - s.aiProbability}% Human`
                      : `${s.aiProbability}% AI`}
                  </span>
                </motion.div>
              )
            })}
          </div>
        </div>
      )}

      {/* Detailed analysis */}
      {result.detailedAnalysis && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <p className="text-sm font-semibold text-slate-200 mb-2">Analysis</p>
          <p className="text-sm text-slate-400 leading-relaxed">{result.detailedAnalysis}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        {result.humanScore < 60 && (
          <button
            type="button"
            onClick={onHumanise}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
          >
            Humanise This Text →
          </button>
        )}
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors ml-auto"
        >
          <X size={14} />
          Check Another
        </button>
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
interface WorkspaceResultsProps {
  mode: 'humanise' | 'detect'
  // Humanise props
  inputText: string
  outputText: string
  inputDetection: DetectResponse | null
  outputDetection: DetectResponse | null
  isDetectingInput: boolean
  isDetectingOutput: boolean
  isHumanising: boolean
  tone: Tone
  level: number
  onToneChange: (t: Tone) => void
  onLevelChange: (v: number) => void
  onRerun: () => void
  // Detect props
  detectResult: DetectResponse | null
  // Shared
  onReset: () => void
  onSwitchToHumanise: () => void
}

export function WorkspaceResults({
  mode,
  inputText,
  outputText,
  inputDetection,
  outputDetection,
  isDetectingInput,
  isDetectingOutput,
  isHumanising,
  tone,
  level,
  onToneChange,
  onLevelChange,
  onRerun,
  detectResult,
  onReset,
  onSwitchToHumanise,
}: WorkspaceResultsProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={mode}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
      >
        {mode === 'humanise' ? (
          <HumaniseResults
            inputText={inputText}
            outputText={outputText}
            inputDetection={inputDetection}
            outputDetection={outputDetection}
            isDetectingInput={isDetectingInput}
            isDetectingOutput={isDetectingOutput}
            isHumanising={isHumanising}
            tone={tone}
            level={level}
            onToneChange={onToneChange}
            onLevelChange={onLevelChange}
            onRerun={onRerun}
            onReset={onReset}
          />
        ) : detectResult ? (
          <DetectResults
            result={detectResult}
            onReset={onReset}
            onHumanise={onSwitchToHumanise}
          />
        ) : null}
      </motion.div>
    </AnimatePresence>
  )
}
