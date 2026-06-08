import { useEffect, useRef, useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Wand2,
  Clipboard,
  ClipboardCopy,
  Download,
  Loader2,
  Zap,
  Trash2,
  AlertCircle,
  ShieldCheck,
  Upload,
} from 'lucide-react'
import { cn, countWords, formatNumber } from '../../lib/utils'
import { useAuthStore } from '../../store/authStore'
import { useHumaniserStore } from '../../store/humaniserStore'
import { useUiStore } from '../../store/uiStore'
import { humaniseApi } from '../../api/humanise'
import { detectorApi } from '../../api/detector'
import { useDragDrop } from '../../hooks/useDragDrop'
import { DropOverlay } from '../../components/ui/DropOverlay'
import { ScoreCircle } from '../../components/ui/ScoreCircle'
import { VerdictBadge } from '../../components/ui/VerdictBadge'
import type { Tone, Strength } from '../../types'
import type { DetectResponse, SentenceScore } from '../../types/detector'

const STORAGE_KEY_INPUT  = 'humanise_draft_input'
const STORAGE_KEY_OUTPUT = 'humanise_draft_output'

const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const

const TONES: { value: Tone; label: string; description: string }[] = [
  { value: 'casual',         label: 'Casual',         description: 'Natural & relaxed'  },
  { value: 'professional',   label: 'Professional',   description: 'Warm & formal'       },
  { value: 'academic',       label: 'Academic',       description: 'Scholarly & precise' },
  { value: 'conversational', label: 'Conversational', description: 'Engaging & lively'  },
]

function levelToStrength(l: number): Strength {
  if (l <= 3) return 'light'
  if (l <= 7) return 'medium'
  return 'heavy'
}

function nextMonthFirstDay() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()
}

// ── Shimmer skeleton ──────────────────────────────────────────────────────────

function ShimmerLine({ width = 'w-full' }: { width?: string }) {
  return (
    <div
      className={cn(
        'h-4 rounded bg-gradient-to-r from-slate-700 via-slate-600/60 to-slate-700 bg-[length:200%_100%] animate-shimmer',
        width,
      )}
    />
  )
}

// ── Typewriter text ───────────────────────────────────────────────────────────

function TypewriterText({ text, animate = true }: { text: string; animate?: boolean }) {
  const [displayed, setDisplayed] = useState(animate ? '' : text)
  const indexRef = useRef(animate ? 0 : text.length)

  useEffect(() => {
    if (!animate) { setDisplayed(text); indexRef.current = text.length; return }
    setDisplayed(''); indexRef.current = 0
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
  }, [text, animate])

  return (
    <p className="text-slate-200 text-[15px] leading-[1.75] whitespace-pre-wrap">
      {displayed}
      {displayed.length < text.length && (
        <span className="inline-block w-0.5 h-4 bg-indigo-500 ml-0.5 animate-pulse" />
      )}
    </p>
  )
}

// ── Sentence-highlighted output ───────────────────────────────────────────────

function HighlightedText({ sentenceScores }: { sentenceScores: SentenceScore[] }) {
  return (
    <p className="text-[15px] leading-[1.75]">
      {sentenceScores.map((s, i) => {
        const color =
          s.aiProbability > 60
            ? 'bg-red-500/20 text-red-200'
            : s.aiProbability > 30
              ? 'bg-amber-400/10 text-amber-100'
              : 'bg-emerald-500/15 text-emerald-100'
        return (
          <span
            key={i}
            className={cn('rounded-sm px-0.5 cursor-default transition-colors', color)}
            title={`${s.aiProbability}% AI probability`}
          >
            {s.sentence}{' '}
          </span>
        )
      })}
    </p>
  )
}

// ── Detection score sidebar ───────────────────────────────────────────────────

interface DetectionSidebarProps {
  result: DetectResponse | null
  isChecking: boolean
  isStale: boolean
  canCheck: boolean
  onCheck: () => void
}

function DetectionSidebar({ result, isChecking, isStale, canCheck, onCheck }: DetectionSidebarProps) {
  return (
    <div className="hidden lg:flex w-[216px] shrink-0 flex-col bg-slate-800 border border-slate-700/80 rounded-2xl overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_4px_32px_rgba(0,0,0,0.35)]">
      <div className="px-5 py-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <ShieldCheck size={13} className="text-slate-400" />
          <span className="text-[14px] font-semibold text-slate-200">Detection Score</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center gap-3 p-4">
        {result ? (
          <>
            <span className={cn('text-[11px] font-medium', isStale ? 'text-amber-400' : 'text-slate-400')}>
              {isStale ? 'Score may be outdated' : 'Scanned with V1'}
            </span>
            <ScoreCircle score={result.humanScore} size="md" />
            <VerdictBadge verdict={result.verdict} humanScore={result.humanScore} size="sm" />
            {result.wordCount > 0 && (
              <span className="text-[11px] text-slate-600">{result.wordCount} words analysed</span>
            )}
          </>
        ) : (
          <>
            <div className="mt-4 w-20 h-20 rounded-full bg-slate-700/40 border-2 border-dashed border-slate-600 flex items-center justify-center">
              <ShieldCheck size={26} className="text-slate-500" />
            </div>
            <p className="text-[11px] text-slate-500 text-center leading-relaxed">
              Humanise your text then run detection to see your score
            </p>
          </>
        )}

        <button
          type="button"
          onClick={onCheck}
          disabled={!canCheck || isChecking}
          className={cn(
            'mt-auto w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all border',
            canCheck && !isChecking
              ? 'bg-slate-700/80 hover:bg-slate-600 text-white border-slate-600 hover:border-slate-500'
              : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-50',
          )}
        >
          {isChecking ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
          {isChecking ? 'Scanning…' : result ? 'Rescan' : 'Check for AI'}
        </button>
      </div>
    </div>
  )
}

// ── Main EditorPage ───────────────────────────────────────────────────────────

export function EditorPage() {
  const user = useAuthStore((s) => s.user)
  const updateUser = useAuthStore((s) => s.updateUser)
  const {
    inputText, outputText, selectedTone, isLoading, lastResponse,
    setInputText, setOutputText, setTone, setStrength,
    setLoading, setLastResponse, setError,
  } = useHumaniserStore()
  const { openWordLimitModal } = useUiStore()

  const [level, setLevel] = useState(5)
  const [lastUsedSettings, setLastUsedSettings] = useState<{ tone: Tone; level: number } | null>(null)
  const [detectionResult, setDetectionResult] = useState<DetectResponse | null>(null)
  const [isCheckingAI, setIsCheckingAI] = useState(false)
  const [detectionCheckedFor, setDetectionCheckedFor] = useState('')

  const { isDragging, isProcessing: isFileProcessing, dragHandlers, openFilePicker, fileInputElement } = useDragDrop({
    onText: (t) => setInputText(t),
    disabled: isLoading,
  })

  useEffect(() => { setStrength(levelToStrength(level)) }, [level, setStrength])
  useEffect(() => { return () => setLoading(false) }, [setLoading])

  useEffect(() => {
    const preloaded = sessionStorage.getItem('humanise_input')
    if (preloaded) {
      setInputText(preloaded)
      sessionStorage.removeItem('humanise_input')
      toast.success('Text loaded from detector — ready to humanise!')
      return
    }
    const savedInput  = localStorage.getItem(STORAGE_KEY_INPUT)
    const savedOutput = localStorage.getItem(STORAGE_KEY_OUTPUT)
    if (savedInput && !inputText) {
      setInputText(savedInput)
      if (savedOutput)
        setLastResponse({ humanisedText: savedOutput, wordCount: 0, processingTimeMs: 0, historyId: '', usage: null } as never)
      toast('Draft restored from your last session.', { icon: '📋' })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (inputText) localStorage.setItem(STORAGE_KEY_INPUT, inputText)
    else localStorage.removeItem(STORAGE_KEY_INPUT)
  }, [inputText])

  useEffect(() => {
    if (outputText) localStorage.setItem(STORAGE_KEY_OUTPUT, outputText)
    else localStorage.removeItem(STORAGE_KEY_OUTPUT)
  }, [outputText])

  const inputWordCount  = countWords(inputText)
  const outputWordCount = countWords(outputText)
  const wordsUsed  = user?.wordsUsed  ?? 0
  const wordsLimit = user?.wordsLimit ?? 1500
  const isAtLimit  = wordsUsed >= wordsLimit
  const usagePct   = wordsLimit > 0 ? Math.min((wordsUsed / wordsLimit) * 100, 100) : 0
  const settingsStale =
    !!outputText &&
    lastUsedSettings !== null &&
    (lastUsedSettings.tone !== selectedTone || lastUsedSettings.level !== level)
  const detectionIsStale = detectionResult !== null && detectionCheckedFor !== outputText

  const mutation = useMutation({
    mutationFn: () =>
      humaniseApi.humanise({ text: inputText, tone: selectedTone, strength: levelToStrength(level) }).then((r) => r.data),
    onMutate:  () => { setLoading(true); setError(null) },
    onSuccess: (data) => {
      setLastResponse(data)
      setLastUsedSettings({ tone: selectedTone, level })
      updateUser({ wordsUsed: data.usage.wordsUsed, wordsLimit: data.usage.wordsLimit })
      setDetectionResult(null)
      setDetectionCheckedFor('')
      toast.success('Text humanised successfully!')
    },
    onError: (err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 402) return
      const msg = err && typeof err === 'object' && 'message' in err
        ? (err as { message: string }).message
        : 'Failed to humanise text. Please try again.'
      setError(msg); toast.error(msg)
    },
    onSettled: () => setLoading(false),
  })

  const handleHumanise = useCallback(() => {
    if (!inputText.trim() || isLoading) return
    if (isAtLimit) { openWordLimitModal({ used: wordsUsed, limit: wordsLimit, resetDate: nextMonthFirstDay() }); return }
    mutation.mutate()
  }, [inputText, isLoading, isAtLimit, wordsUsed, wordsLimit, openWordLimitModal, mutation])

  const handleCheckAI = useCallback(async (textToCheck?: string) => {
    const text = textToCheck ?? outputText
    if (!text || isCheckingAI) return
    setIsCheckingAI(true)
    try {
      const result = await detectorApi.detect({ text })
      setDetectionResult(result)
      setDetectionCheckedFor(text === outputText ? outputText : '')
    } catch { toast.error('Detection failed. Please try again.') }
    finally { setIsCheckingAI(false) }
  }, [outputText, isCheckingAI])

  const handleCopy = useCallback(async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast.success('Copied to clipboard!') }
    catch { toast.error('Failed to copy to clipboard') }
  }, [])

  const handlePasteFromClipboard = useCallback(async () => {
    try { const text = await navigator.clipboard.readText(); setInputText(text); toast.success('Pasted from clipboard!') }
    catch { toast.error('Clipboard access denied') }
  }, [setInputText])

  const handleDownload = useCallback(() => {
    if (!outputText) return
    const blob = new Blob([outputText], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'humanised-text.txt'; a.click()
    URL.revokeObjectURL(url)
    toast.success('Downloaded successfully!')
  }, [outputText])

  const handleClearInput = useCallback(() => {
    setInputText(''); setOutputText(''); setLastUsedSettings(null)
    setDetectionResult(null); setDetectionCheckedFor('')
    localStorage.removeItem(STORAGE_KEY_INPUT)
    localStorage.removeItem(STORAGE_KEY_OUTPUT)
  }, [setInputText, setOutputText])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Enter')                 { e.preventDefault(); handleHumanise(); return }
      if (e.ctrlKey && e.shiftKey && e.key === 'C')       { e.preventDefault(); if (outputText) handleCopy(outputText); return }
      if (e.ctrlKey && e.shiftKey && e.key === 'X')       { e.preventDefault(); handleClearInput() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleHumanise, handleCopy, handleClearInput, outputText])

  const showSentenceHighlights =
    !!detectionResult && !detectionIsStale && detectionResult.sentenceScores.length > 0

  return (
    <div className="min-h-0 bg-transparent px-4 py-6 w-full">
      <div className="flex gap-5 items-start">

        {/* ── Main column — sticky, full viewport height ── */}
        <div
          className="flex-1 flex flex-col min-w-0 lg:sticky lg:top-4"
          style={{ height: 'calc(100vh - 7rem)' }}
        >

          {/* ─── SPLIT EDITOR CARD ─────────────────────────────────────────── */}
          <div className="bg-slate-800 border border-slate-700/80 rounded-2xl overflow-hidden flex flex-col h-full shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_4px_32px_rgba(0,0,0,0.35)]">

            {/* Controls header */}
            <div className="px-5 py-3 border-b border-slate-700 shrink-0">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mr-1 hidden sm:inline">
                    Level
                  </span>
                  {LEVELS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setLevel(n)}
                      className={cn(
                        'w-6 h-6 rounded text-xs font-semibold transition-all duration-150',
                        level === n
                          ? n <= 3
                            ? 'bg-indigo-500 text-white shadow-sm shadow-indigo-900/50'
                            : n <= 7
                              ? 'bg-violet-600 text-white shadow-sm shadow-violet-900/50'
                              : 'bg-purple-700 text-white shadow-sm shadow-purple-900/50'
                          : n < level
                            ? n <= 3
                              ? 'bg-indigo-500/20 text-indigo-300'
                              : n <= 7
                                ? 'bg-violet-500/20 text-violet-300'
                                : 'bg-purple-500/20 text-purple-300'
                            : 'text-slate-400 hover:text-white hover:bg-slate-700',
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mr-1 hidden sm:inline">
                    Style
                  </span>
                  {TONES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setTone(t.value)}
                      title={t.description}
                      className={cn(
                        'px-2.5 py-1 rounded-lg text-[14px] font-medium transition-all duration-150',
                        selectedTone === t.value
                          ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-600/30'
                          : 'text-slate-400 hover:text-white',
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Split panels — fill remaining card height */}
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-700 flex-1 min-h-0">

              {/* ── Left: Input ── */}
              <div className="flex flex-col min-h-0 relative" {...dragHandlers}>
                {fileInputElement}
                <DropOverlay isDragging={isDragging} isProcessing={isFileProcessing} />
                <div className="px-5 pt-3 pb-1 shrink-0">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Original</span>
                </div>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Paste your AI-generated text here…"
                  aria-label="Original AI-generated text"
                  className="flex-1 min-h-0 w-full bg-transparent text-slate-200 text-[15px] leading-[1.75] px-5 py-3 resize-none outline-none placeholder:text-slate-500"
                />
                <div className="px-5 py-3 border-t border-slate-700/50 space-y-2 shrink-0">
                  {/* Word usage bar */}
                  <div className="flex items-center gap-2">
                    <span className={cn('text-[13px] font-medium shrink-0 tabular-nums', isAtLimit ? 'text-amber-400' : 'text-slate-500')}>
                      {formatNumber(wordsUsed)}/{formatNumber(wordsLimit)}
                    </span>
                    <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          usagePct >= 95 ? 'bg-red-500' : usagePct >= 75 ? 'bg-amber-500' : 'bg-indigo-500',
                        )}
                        style={{ width: `${usagePct}%` }}
                      />
                    </div>
                    {user?.plan === 'Free' && (
                      <Link to="/app/billing" className="text-[13px] text-indigo-400 hover:text-indigo-300 transition-colors shrink-0">
                        Upgrade
                      </Link>
                    )}
                  </div>
                  {/* Actions */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleClearInput}
                        disabled={!inputText}
                        title="Clear (Ctrl+Shift+X)"
                        className="inline-flex items-center gap-1.5 text-[13px] text-slate-300 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Trash2 size={12} /> Clear
                      </button>
                      <button
                        type="button"
                        onClick={handlePasteFromClipboard}
                        className="inline-flex items-center gap-1.5 text-[13px] text-slate-300 hover:text-white transition-colors"
                      >
                        <Clipboard size={12} /> Paste
                      </button>
                      <button
                        type="button"
                        onClick={openFilePicker}
                        disabled={isLoading || isFileProcessing}
                        className="inline-flex items-center gap-1.5 text-[13px] text-slate-300 hover:text-white transition-colors disabled:opacity-40"
                      >
                        <Upload size={12} /> Upload
                      </button>
                      {inputWordCount > 0 && (
                        <span className={cn('text-[13px] font-medium tabular-nums', inputWordCount >= 500 ? 'text-red-400' : inputWordCount >= 400 ? 'text-amber-400' : 'text-slate-500')}>
                          {formatNumber(inputWordCount)} words
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleHumanise}
                      disabled={!inputText.trim() || isLoading}
                      title="Humanise (Ctrl+Enter)"
                      className={cn(
                        'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[15px] font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed',
                        isAtLimit
                          ? 'bg-amber-600 hover:bg-amber-500 text-white'
                          : settingsStale
                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:opacity-90'
                            : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:opacity-90 shadow shadow-indigo-500/20',
                      )}
                    >
                      {isLoading ? <Loader2 size={14} className="animate-spin" /> : isAtLimit ? <AlertCircle size={14} /> : <Wand2 size={14} />}
                      {isLoading ? 'Humanising…' : isAtLimit ? 'Limit reached' : settingsStale ? 'Re-Humanise' : 'Humanise'}
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Right: Output ── */}
              <div className="flex flex-col min-h-0" role="region" aria-label="Humanised result" aria-live="polite">
                <div className="px-5 pt-3 pb-1 flex items-center gap-2 flex-wrap shrink-0">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Humanised</span>
                  {settingsStale && outputText && (
                    <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                      Settings changed
                    </span>
                  )}
                  {lastResponse &&
                    'processingTimeMs' in lastResponse &&
                    (lastResponse as { processingTimeMs: number }).processingTimeMs > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-white/5 text-slate-400">
                        <Zap size={10} className="text-indigo-400" />
                        {(lastResponse as { processingTimeMs: number }).processingTimeMs}ms
                      </span>
                    )}
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3">
                  {isLoading ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 pt-1">
                      <div className="flex items-center gap-2 mb-4">
                        <Loader2 size={14} className="animate-spin text-indigo-400" />
                        <span className="text-sm text-indigo-400 font-medium">Humanising your text…</span>
                      </div>
                      <ShimmerLine />
                      <ShimmerLine width="w-5/6" />
                      <ShimmerLine />
                      <ShimmerLine width="w-4/5" />
                      <ShimmerLine />
                      <ShimmerLine width="w-3/4" />
                      <ShimmerLine />
                      <ShimmerLine width="w-5/6" />
                    </motion.div>
                  ) : outputText ? (
                    <motion.div
                      key={outputText}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-3"
                    >
                      {showSentenceHighlights ? (
                        <HighlightedText sentenceScores={detectionResult!.sentenceScores} />
                      ) : (
                        <TypewriterText text={outputText} animate={mutation.isSuccess} />
                      )}
                      {showSentenceHighlights && (
                        <p className="text-[11px] text-slate-400 pt-1">
                          <span className="inline-block w-2 h-2 rounded-sm bg-emerald-500/50 mr-1" />
                          Human-sounding &nbsp;
                          <span className="inline-block w-2 h-2 rounded-sm bg-amber-400/40 mr-1 ml-2" />
                          Mixed &nbsp;
                          <span className="inline-block w-2 h-2 rounded-sm bg-red-500/40 mr-1 ml-2" />
                          AI-sounding
                        </p>
                      )}
                    </motion.div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600/15 to-purple-600/10 border border-indigo-500/20 flex items-center justify-center">
                        <Wand2 size={22} className="text-indigo-400/70" />
                      </div>
                      <div>
                        <p className="text-[14px] font-medium text-slate-400">Humanised text will appear here</p>
                        <p className="text-[12px] text-slate-600 mt-1 max-w-[180px] leading-relaxed">
                          Set intensity and style, then click Humanise
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="px-5 py-3 border-t border-slate-700/50 shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {outputText && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleCopy(outputText)}
                            title="Copy result (Ctrl+Shift+C)"
                            className="inline-flex items-center gap-1.5 text-[13px] text-slate-300 hover:text-white transition-colors"
                          >
                            <ClipboardCopy size={12} /> Copy
                          </button>
                          <button
                            type="button"
                            onClick={handleDownload}
                            className="inline-flex items-center gap-1.5 text-[13px] text-slate-300 hover:text-white transition-colors"
                          >
                            <Download size={12} /> Download .txt
                          </button>
                          {outputWordCount > 0 && (
                            <span className="text-[13px] font-medium tabular-nums text-slate-400">
                              {formatNumber(outputWordCount)} words
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    {outputText && (
                      <button
                        type="button"
                        onClick={() => handleCheckAI(outputText)}
                        disabled={isCheckingAI}
                        className="lg:hidden inline-flex items-center gap-1.5 text-[13px] text-slate-300 hover:text-white transition-colors disabled:opacity-50"
                      >
                        {isCheckingAI ? <Loader2 size={11} className="animate-spin" /> : <ShieldCheck size={11} />}
                        {isCheckingAI ? 'Scanning…' : detectionResult ? 'Rescan' : 'Check for AI'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Mobile detection result card ── */}
          <AnimatePresence>
            {detectionResult && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.25 }}
                className="lg:hidden mt-5 bg-slate-800 border border-slate-700 rounded-2xl p-4 flex items-center gap-4"
              >
                <ScoreCircle score={detectionResult.humanScore} size="sm" animated={false} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-200">{detectionResult.humanScore}% Human</p>
                  <VerdictBadge verdict={detectionResult.verdict} humanScore={detectionResult.humanScore} size="sm" />
                </div>
                {detectionIsStale && (
                  <span className="text-xs text-amber-400 shrink-0">Outdated</span>
                )}
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* ─── DETECTION SCORE PANEL (desktop) ─────────────────────────────── */}
        <AnimatePresence>
          {outputText && (
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.25 }}
            >
              <DetectionSidebar
                result={detectionResult}
                isChecking={isCheckingAI}
                isStale={detectionIsStale}
                canCheck={!!outputText}
                onCheck={() => handleCheckAI(outputText)}
              />
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  )
}

export default EditorPage
