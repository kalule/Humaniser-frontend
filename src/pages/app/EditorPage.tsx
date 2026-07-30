import { useEffect, useRef, useCallback, useState, useMemo } from 'react'
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
  AlertCircle,
  CheckCircle,
  ShieldCheck,
  Upload,
  Eye,
  EyeOff,
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
import { ScoreBar } from '../../components/ui/ScoreBar'
import { VerdictBadge } from '../../components/ui/VerdictBadge'
import { SendToMenu } from '../../components/ui/SendToMenu'
import { ClearButton } from '../../components/ui/ClearButton'
import { PanelLabel } from '../../components/ui/PanelLabel'
import { OutputActionButton } from '../../components/ui/OutputActionButton'
import { UtilityButton } from '../../components/ui/UtilityButton'
import { Skeleton } from '../../components/ui/Skeleton'
import { useToolTransferStore } from '../../store/toolTransferStore'
import type { Tone, Strength } from '../../types'
import type { DetectResponse, SentenceScore } from '../../types/detector'

const STORAGE_KEY_INPUT  = 'humanise_draft_input'
const STORAGE_KEY_OUTPUT = 'humanise_draft_output'
const CHUNK_SIZE = 4_900

const SAMPLE_TEXT =
  `In today's fast-paced digital landscape, it is imperative for organizations to leverage cutting-edge technology in order to remain competitive. Furthermore, businesses must prioritize efficiency and streamline their operations to maximize productivity. By implementing innovative solutions, companies can effectively navigate the ever-evolving market and achieve sustainable growth. It is essential to note that collaboration and communication play a pivotal role in driving successful outcomes across all departments.`

function splitIntoChunks(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text]
  const chunks: string[] = []
  const paragraphs = text.split(/\n\n+/)
  let current = ''
  for (const para of paragraphs) {
    const joiner = current ? '\n\n' : ''
    if ((current + joiner + para).length <= maxChars) {
      current += joiner + para
    } else {
      if (current) { chunks.push(current); current = '' }
      if (para.length <= maxChars) {
        current = para
      } else {
        const sentences = para.split(/(?<=[.!?])\s+/)
        for (const sent of sentences) {
          const sep = current ? ' ' : ''
          if ((current + sep + sent).length <= maxChars) {
            current += sep + sent
          } else {
            if (current) { chunks.push(current); current = '' }
            if (sent.length > maxChars) {
              for (let i = 0; i < sent.length; i += maxChars) {
                chunks.push(sent.slice(i, i + maxChars).trim())
              }
            } else {
              current = sent
            }
          }
        }
      }
    }
  }
  if (current.trim()) chunks.push(current)
  return chunks.filter(Boolean)
}

const LEVEL_TIERS = [
  { id: 'light',      label: 'Light',      min: 1, max: 3,  default: 2  },
  { id: 'balanced',   label: 'Balanced',   min: 4, max: 6,  default: 5  },
  { id: 'aggressive', label: 'Aggressive', min: 7, max: 8,  default: 7  },
  { id: 'maximum',    label: 'Maximum',    min: 9, max: 10, default: 10 },
] as const

function tierForLevel(level: number) {
  return LEVEL_TIERS.find((t) => level >= t.min && level <= t.max) ?? LEVEL_TIERS[1]
}

const TONES: { value: Tone; label: string; description: string }[] = [
  { value: 'casual',         label: 'Casual',         description: 'Natural & relaxed'  },
  { value: 'professional',   label: 'Professional',   description: 'Warm & formal'       },
  { value: 'academic',       label: 'Academic',       description: 'Scholarly & precise' },
  { value: 'conversational', label: 'Conversational', description: 'Engaging & lively'  },
]

function levelToStrength(l: number): Strength {
  return tierForLevel(l).id
}

function nextMonthFirstDay() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()
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
    <p className="textarea-body text-text-pri whitespace-pre-wrap">
      {displayed}
      {displayed.length < text.length && (
        <span className="inline-block w-0.5 h-4 bg-purple-accent ml-0.5 animate-pulse" />
      )}
    </p>
  )
}

// ── Sentence-highlighted output ───────────────────────────────────────────────

function HighlightedText({ sentenceScores }: { sentenceScores: SentenceScore[] }) {
  return (
    <p className="textarea-body">
      {sentenceScores.map((s, i) => {
        const color =
          s.aiProbability > 60
            ? 'bg-red-100 text-red-700'
            : s.aiProbability > 30
              ? 'bg-amber-100 text-amber-700'
              : 'bg-emerald-100 text-emerald-700'
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

// ── Word-level diff (client-side LCS, mirrors ParaphrasePage's approach) ─────

interface WordToken {
  word: string
  changed: boolean
}

// Strips leading/trailing punctuation for comparison only (rendering keeps the original
// token) so a word that's unchanged but picked up a different trailing comma/period from
// restructuring isn't flagged as "changed" — internal marks like apostrophes/hyphens stay,
// since those distinguish real words ("don't" vs "dont", "well-known" vs "known").
function normalizeForCompare(word: string): string {
  return word.toLowerCase().replace(/^[^\w']+|[^\w']+$/g, '')
}

function computeWordDiff(original: string, humanised: string): WordToken[] {
  const origWords = original.trim().split(/\s+/).filter(Boolean)
  const newWords  = humanised.trim().split(/\s+/).filter(Boolean)
  const origNorm = origWords.map(normalizeForCompare)
  const newNorm  = newWords.map(normalizeForCompare)
  const m = origWords.length
  const n = newWords.length

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = origNorm[i - 1] === newNorm[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1])

  const inLCS = new Set<number>()
  let i = m, j = n
  while (i > 0 && j > 0) {
    if (origNorm[i - 1] === newNorm[j - 1]) {
      inLCS.add(j - 1); i--; j--
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--
    } else {
      j--
    }
  }

  return newWords.map((word, idx) => ({
    word: idx === 0 ? word : ' ' + word,
    changed: !inLCS.has(idx),
  }))
}

function DiffText({ tokens }: { tokens: WordToken[] }) {
  return (
    <p className="textarea-body text-text-pri whitespace-pre-wrap">
      {tokens.map((token, idx) =>
        token.changed ? (
          <mark key={idx} className="bg-purple-100 text-purple-800 rounded px-0.5 not-italic font-normal">
            {token.word}
          </mark>
        ) : (
          <span key={idx}>{token.word}</span>
        ),
      )}
    </p>
  )
}

// ── Detection score sidebar ───────────────────────────────────────────────────

interface HumaniseScores {
  originalAiScore: number
  finalAiScore: number
  verificationPassesUsed: number
  metTargetThreshold: boolean
}

interface DetectionSidebarProps {
  result: DetectResponse | null
  isChecking: boolean
  isStale: boolean
  canCheck: boolean
  onCheck: () => void
  humaniseScores?: HumaniseScores | null
}

function humanScoreBarColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500'
  if (score >= 60) return 'bg-lime-500'
  if (score >= 40) return 'bg-amber-500'
  if (score >= 20) return 'bg-orange-500'
  return 'bg-red-500'
}

function DetectionSidebar({ result, isChecking, isStale, canCheck, onCheck, humaniseScores }: DetectionSidebarProps) {
  return (
    <div className="hidden lg:flex w-[216px] shrink-0 flex-col bg-white border border-[#e0e0da] rounded-2xl overflow-hidden shadow-card">
      <div className="px-4 py-3 border-b border-[#e0e0da]">
        <div className="flex items-center gap-2">
          <ShieldCheck size={13} className="text-text-mut" />
          <span className="text-[10px] font-semibold text-text-mut uppercase tracking-wider">Detection Score</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center gap-3 p-4">
        {result ? (
          <>
            <span className={cn('text-[11px] font-medium', isStale ? 'text-amber-600' : 'text-text-mut')}>
              {isStale ? 'Score may be outdated' : 'Scanned with V1'}
            </span>
            <ScoreBar score={result.humanScore} label="Human score" size="compact" colorForScore={humanScoreBarColor} className="w-full" />
            <VerdictBadge verdict={result.verdict} humanScore={result.humanScore} size="sm" />
            {result.wordCount > 0 && (
              <span className="text-[11px] text-text-mut">{result.wordCount} words analysed</span>
            )}
          </>
        ) : (
          <>
            <div className="mt-2 w-11 h-11 rounded-full bg-[#f8fafc] border border-dashed border-[#d1d5db] flex items-center justify-center">
              <ShieldCheck size={16} className="text-text-mut" />
            </div>
            <p className="text-[11px] text-text-mut text-center leading-relaxed">
              Run detection to see your score
            </p>
          </>
        )}

        {humaniseScores && humaniseScores.verificationPassesUsed > 0 && (
          <>
            <div className="w-full h-px bg-[#e0e0da]" />
            <div className="w-full space-y-2">
              <div>
                <span className="text-[10px] font-medium text-text-mut uppercase tracking-wider">Internal scan</span>
                <p className="text-[10px] text-text-mut leading-snug mt-0.5">
                  Quick estimate from the rewrite step, not your full detection score — run {result ? '"Rescan"' : '"Check for AI"'} below for that.
                </p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-text-sec">AI signals</span>
                <div className="flex items-center gap-1">
                  <span className="text-[12px] font-semibold tabular-nums text-red-500">
                    {humaniseScores.originalAiScore}%
                  </span>
                  <span className="text-[10px] text-text-mut">→</span>
                  <span className={cn(
                    'text-[12px] font-semibold tabular-nums',
                    humaniseScores.finalAiScore <= 35 ? 'text-emerald-600'
                      : humaniseScores.finalAiScore <= 60 ? 'text-amber-600'
                      : 'text-red-500',
                  )}>
                    {humaniseScores.finalAiScore}%
                  </span>
                </div>
              </div>
              {humaniseScores.verificationPassesUsed > 1 && (
                <div className="flex items-center gap-1.5">
                  <Zap size={10} className="text-purple-accent" />
                  <span className="text-[11px] text-text-sec">{humaniseScores.verificationPassesUsed} passes</span>
                </div>
              )}
              <div className={cn(
                'flex items-center gap-1.5 text-[11px] font-medium',
                humaniseScores.metTargetThreshold ? 'text-emerald-600' : 'text-amber-600',
              )}>
                {humaniseScores.metTargetThreshold
                  ? <><CheckCircle size={11} /> AI check: passed</>
                  : <><AlertCircle size={11} /> AI check: may flag</>
                }
              </div>
            </div>
          </>
        )}

        <button
          type="button"
          onClick={onCheck}
          disabled={!canCheck || isChecking}
          className={cn(
            'mt-auto w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all border',
            canCheck && !isChecking
              ? 'bg-white hover:bg-purple-50 text-purple-accent border-purple-accent'
              : 'bg-white text-text-mut border-[#e0e0da] cursor-not-allowed opacity-50',
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
    inputText, outputText, selectedTone, isLoading, lastResponse, error,
    setInputText, setOutputText, setTone, setStrength,
    setLoading, setLastResponse, setError,
  } = useHumaniserStore()
  const { openWordLimitModal } = useUiStore()

  const [level, setLevel] = useState(5)
  const [lastUsedSettings, setLastUsedSettings] = useState<{ tone: Tone; level: number } | null>(null)
  const [detectionResult, setDetectionResult] = useState<DetectResponse | null>(null)
  const [isCheckingAI, setIsCheckingAI] = useState(false)
  const [detectionCheckedFor, setDetectionCheckedFor] = useState('')
  const [chunkProgress, setChunkProgress] = useState<{ done: number; total: number } | null>(null)
  const [isChunkedResult, setIsChunkedResult] = useState(false)
  const [showDiff, setShowDiff] = useState(() => {
    const saved = sessionStorage.getItem('humanise_show_diff')
    return saved === null ? true : saved === '1'
  })
  const [diffTokens, setDiffTokens] = useState<WordToken[]>([])
  const changedWordPct = useMemo(() => {
    if (diffTokens.length === 0) return 0
    return Math.round((diffTokens.filter((t) => t.changed).length / diffTokens.length) * 100)
  }, [diffTokens])

  const inputScrollRef = useRef<HTMLTextAreaElement>(null)
  const outputScrollRef = useRef<HTMLDivElement>(null)
  const isSyncingScroll = useRef(false)

  const syncScroll = useCallback((source: HTMLElement, target: HTMLElement | null) => {
    if (!target || isSyncingScroll.current) return
    const sourceRange = source.scrollHeight - source.clientHeight
    const targetRange = target.scrollHeight - target.clientHeight
    if (sourceRange <= 0 || targetRange <= 0) return
    isSyncingScroll.current = true
    target.scrollTop = (source.scrollTop / sourceRange) * targetRange
    requestAnimationFrame(() => { isSyncingScroll.current = false })
  }, [])

  const { isDragging, isProcessing: isFileProcessing, dragHandlers, openFilePicker, fileInputElement } = useDragDrop({
    onText: (t) => setInputText(t),
    disabled: isLoading,
  })

  useEffect(() => { setStrength(levelToStrength(level)) }, [level, setStrength])
  useEffect(() => { return () => setLoading(false) }, [setLoading])
  useEffect(() => { sessionStorage.setItem('humanise_show_diff', showDiff ? '1' : '0') }, [showDiff])

  useEffect(() => {
    if (!showDiff || !outputText) { setDiffTokens([]); return }
    const id = requestAnimationFrame(() => setDiffTokens(computeWordDiff(inputText, outputText)))
    return () => cancelAnimationFrame(id)
  }, [showDiff, inputText, outputText])

  useEffect(() => {
    const transferred = useToolTransferStore.getState().text
    if (transferred) {
      setInputText(transferred)
      useToolTransferStore.getState().clearTransfer()
      toast('Text transferred — ready to edit!', { icon: '✏️' })
      return
    }
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
  const wordDeltaPct = outputText && inputWordCount > 0
    ? Math.round(Math.abs(outputWordCount - inputWordCount) / inputWordCount * 100)
    : 0
  const wordDeltaFlagged = !!outputText && wordDeltaPct >= 20
  const inputChunks = useMemo(() => splitIntoChunks(inputText, CHUNK_SIZE), [inputText])
  const needsChunking = inputChunks.length > 1
  const wordsUsed  = user?.wordsUsed  ?? 0
  const wordsLimit = user?.wordsLimit ?? 1500
  const isUnlimited = (user?.plan === 'Unlimited') || wordsLimit >= 2_147_483_647
  const isAtLimit  = !isUnlimited && wordsUsed >= wordsLimit
  const usagePct   = isUnlimited ? 100 : wordsLimit > 0 ? Math.min((wordsUsed / wordsLimit) * 100, 100) : 0
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

  const handleHumanise = useCallback(async () => {
    if (!inputText.trim() || isLoading) return
    if (isAtLimit) { openWordLimitModal({ used: wordsUsed, limit: wordsLimit, resetDate: nextMonthFirstDay() }); return }

    if (!needsChunking) {
      setIsChunkedResult(false)
      mutation.mutate()
      return
    }

    // Multi-chunk path: process each chunk sequentially and join results
    setChunkProgress({ done: 0, total: inputChunks.length })
    setLoading(true)
    setError(null)
    setIsChunkedResult(false)
    const humanisedParts: string[] = []
    try {
      for (let i = 0; i < inputChunks.length; i++) {
        setChunkProgress({ done: i + 1, total: inputChunks.length })
        const res = await humaniseApi.humanise({
          text: inputChunks[i],
          tone: selectedTone,
          strength: levelToStrength(level),
        }).then(r => r.data)
        humanisedParts.push(res.humanisedText)
        if (i === inputChunks.length - 1) {
          updateUser({ wordsUsed: res.usage.wordsUsed, wordsLimit: res.usage.wordsLimit })
          setLastResponse({ ...res, humanisedText: humanisedParts.join('\n\n'), wordCount: humanisedParts.join('\n\n').split(/\s+/).filter(Boolean).length })
        }
      }
      setLastUsedSettings({ tone: selectedTone, level })
      setDetectionResult(null)
      setDetectionCheckedFor('')
      setIsChunkedResult(true)
      toast.success(`Humanised in ${inputChunks.length} parts!`)
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 402) return
      const msg = err && typeof err === 'object' && 'message' in err
        ? (err as { message: string }).message
        : 'Failed to humanise text. Please try again.'
      setError(msg); toast.error(msg)
    } finally {
      setLoading(false)
      setChunkProgress(null)
    }
  }, [inputText, inputChunks, needsChunking, isLoading, isAtLimit, wordsUsed, wordsLimit, openWordLimitModal, selectedTone, level, mutation, setLoading, setError, setLastResponse, updateUser])

  const handleCheckAI = useCallback(async (textToCheck?: string) => {
    const raw = textToCheck ?? outputText
    if (!raw || raw.length < 50 || isCheckingAI) return
    const text = raw.length > 10000 ? raw.slice(0, 10000) : raw
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
    setError(null); setIsChunkedResult(false)
    localStorage.removeItem(STORAGE_KEY_INPUT)
    localStorage.removeItem(STORAGE_KEY_OUTPUT)
  }, [setInputText, setOutputText, setError])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Enter')                 { e.preventDefault(); void handleHumanise(); return }
      if (e.ctrlKey && e.shiftKey && e.key === 'C')       { e.preventDefault(); if (outputText) handleCopy(outputText); return }
      if (e.ctrlKey && e.shiftKey && e.key === 'X')       { e.preventDefault(); handleClearInput() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleHumanise, handleCopy, handleClearInput, outputText])

  const showSentenceHighlights =
    !!detectionResult && !detectionIsStale && detectionResult.sentenceScores.length > 0

  const hasOutput = !!outputText

  return (
    <div className="min-h-0 bg-transparent px-4 py-6 w-full">
      <div className="flex gap-5 items-start">

        {/* ── Main column — sticky, full viewport height ── */}
        <div
          className="flex-1 flex flex-col min-w-0 lg:sticky lg:top-4"
          style={{ height: 'calc(100vh - 7rem)' }}
        >

          {/* ─── SPLIT EDITOR CARD ─────────────────────────────────────────── */}
          <div className="bg-white border border-[#e0e0da] rounded-2xl overflow-hidden flex flex-col h-full shadow-card">

            {/* Controls header */}
            <div className="px-5 py-4 border-b border-[#e0e0da] shrink-0">
              <div className="bg-neutral-100 rounded-xl px-4 py-3 flex items-center flex-wrap gap-x-4 gap-y-2">

                {/* Level group */}
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-neutral-500 uppercase tracking-wider shrink-0">
                    Level
                  </span>
                  <div role="radiogroup" aria-label="Humanisation level" className="flex items-center gap-1.5 flex-wrap">
                    {LEVEL_TIERS.map((t) => {
                      const active = tierForLevel(level).id === t.id
                      return (
                        <button
                          key={t.id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setLevel(t.default)}
                          disabled={isLoading}
                          title={`Levels ${t.min}–${t.max}`}
                          className={cn(
                            'px-4 py-2 rounded-lg text-[15px] font-medium transition-all duration-150 border tabular-nums disabled:opacity-50 disabled:cursor-not-allowed',
                            active
                              ? 'bg-neutral-900 text-white border-neutral-900 shadow-sm'
                              : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300 hover:text-neutral-900',
                          )}
                        >
                          {t.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Divider */}
                <div className="hidden sm:block w-px h-5 bg-neutral-200" />

                {/* Style group */}
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-neutral-500 uppercase tracking-wider shrink-0">
                    Style
                  </span>
                  <div role="radiogroup" aria-label="Writing style" className="flex items-center gap-1.5 flex-wrap">
                    {TONES.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        role="radio"
                        aria-checked={selectedTone === t.value}
                        onClick={() => setTone(t.value)}
                        disabled={isLoading}
                        title={t.description}
                        className={cn(
                          'px-4 py-2 rounded-lg text-[15px] font-medium transition-all duration-150 border disabled:opacity-50 disabled:cursor-not-allowed',
                          selectedTone === t.value
                            ? 'bg-neutral-900 text-white border-neutral-900 shadow-sm'
                            : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300 hover:text-neutral-900',
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            </div>

            {/* Split panels — fill remaining card height */}
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 divide-[#e0e0da] md:gap-4 flex-1 min-h-0">

              {/* ── Left: Input ── */}
              <div className="flex flex-col min-h-0 relative" {...dragHandlers}>
                {fileInputElement}
                <DropOverlay isDragging={isDragging} isProcessing={isFileProcessing} />

                {/* Input panel header */}
                <div className="px-5 py-2.5 border-b border-[#e0e0da] shrink-0 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PanelLabel label="Original" />
                    {needsChunking ? (
                      <span className="text-xs font-normal tabular-nums text-amber-600">
                        {formatNumber(inputWordCount)} words · {inputChunks.length} parts
                      </span>
                    ) : inputWordCount > 0 && (
                      <span className={cn('text-xs font-normal tabular-nums',
                        inputWordCount >= 500 ? 'text-red-500' : inputWordCount >= 400 ? 'text-amber-600' : 'text-gray-400')}>
                        {formatNumber(inputWordCount)} words
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <UtilityButton
                      icon={<Clipboard size={16} />}
                      label="Paste"
                      onClick={handlePasteFromClipboard}
                      disabled={isLoading}
                    />
                    <UtilityButton
                      icon={<Upload size={16} />}
                      label="Upload"
                      onClick={openFilePicker}
                      disabled={isLoading || isFileProcessing}
                    />
                  </div>
                </div>

                <div className="relative flex-1 min-h-0">
                  <textarea
                    ref={inputScrollRef}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onScroll={(e) => syncScroll(e.currentTarget, outputScrollRef.current)}
                    aria-label="Original AI-generated text"
                    disabled={isLoading}
                    className="textarea-body absolute inset-0 w-full h-full bg-transparent text-text-pri px-5 py-3 resize-none outline-none focus:ring-2 focus:ring-inset focus:ring-purple-accent/30 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  {!inputText && (
                    <div className="textarea-body pointer-events-none absolute inset-0 px-5 py-3 text-text-mut select-none">
                      Paste your AI-generated text here, or{' '}
                      <button
                        type="button"
                        onClick={() => setInputText(SAMPLE_TEXT)}
                        disabled={isLoading}
                        className="pointer-events-auto text-purple-accent underline decoration-dotted underline-offset-2 hover:text-purple-deep transition-colors disabled:opacity-40"
                      >
                        try a sample
                      </button>
                      .
                    </div>
                  )}
                </div>

                <div className="px-5 py-3 border-t border-[#e0e0da] space-y-2 shrink-0">
                  {/* Word usage */}
                  {isUnlimited ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-text-mut tabular-nums">
                        {formatNumber(wordsUsed)} words used this month
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className={cn('text-[13px] font-medium shrink-0 tabular-nums', isAtLimit ? 'text-amber-600' : 'text-text-mut')}>
                        {`${formatNumber(wordsUsed)}/${formatNumber(wordsLimit)}`}
                      </span>
                      <div className="flex-1 h-1 bg-[#f1f5f9] rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-500',
                            usagePct >= 95 ? 'bg-red-500' : usagePct >= 75 ? 'bg-amber-500' : 'bg-purple-accent',
                          )}
                          style={{ width: `${usagePct}%` }}
                        />
                      </div>
                      {user?.plan === 'Free' && (
                        <Link to="/app/billing" className="text-[13px] text-purple-accent hover:text-purple-deep transition-colors shrink-0">
                          Upgrade
                        </Link>
                      )}
                    </div>
                  )}
                  {/* Actions row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ClearButton
                        onClick={handleClearInput}
                        disabled={!inputText || isLoading}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleHumanise()}
                        disabled={!inputText.trim() || isLoading}
                        title="Humanise (Ctrl+Enter)"
                        className={cn(
                          'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[15px] font-semibold transition-all',
                          isLoading
                            ? 'bg-purple-accent text-white opacity-90 cursor-wait'
                            : !inputText.trim()
                            ? 'bg-[#c4b5fd] text-white cursor-not-allowed'
                            : isAtLimit
                            ? 'bg-amber-500 hover:bg-amber-600 text-white'
                            : settingsStale
                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:opacity-90'
                            : 'bg-purple-accent hover:bg-purple-deep text-white shadow shadow-purple-400/20',
                        )}
                      >
                        {isLoading ? <Loader2 size={14} className="animate-spin" /> : isAtLimit ? <AlertCircle size={14} /> : <Wand2 size={14} />}
                        {chunkProgress
                          ? `Part ${chunkProgress.done}/${chunkProgress.total}…`
                          : isLoading ? 'Humanising…'
                          : isAtLimit ? 'Limit reached'
                          : settingsStale ? 'Re-Humanise'
                          : needsChunking ? `Humanise (${inputChunks.length} parts)`
                          : 'Humanise'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Right: Output ── */}
              <div className="flex flex-col min-h-0 md:shadow-[inset_1px_0_0_#e4e4e7]" role="region" aria-label="Humanised result">

                {/* Output panel header — purple tint when content present */}
                <div
                  className="px-5 py-2.5 flex items-center gap-2 flex-wrap shrink-0 border-b border-[#e0e0da] transition-colors"
                  style={{ background: hasOutput ? '#faf8ff' : 'transparent' }}
                >
                  <PanelLabel label="Humanised" colorOverride={hasOutput ? 'var(--color-purple)' : undefined} />
                  {outputText && (
                    <span className="text-xs font-normal tabular-nums text-gray-400">
                      {formatNumber(outputWordCount)} words
                      {outputWordCount !== inputWordCount && !wordDeltaFlagged && (
                        <span className="text-gray-400">
                          {' '}· {outputWordCount > inputWordCount ? '+' : '−'}{formatNumber(Math.abs(outputWordCount - inputWordCount))} vs original
                        </span>
                      )}
                    </span>
                  )}
                  {wordDeltaFlagged && (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200"
                      title="This rewrite changed length significantly compared to the original — review before submitting."
                    >
                      <AlertCircle size={10} />
                      {outputWordCount > inputWordCount ? '+' : '−'}{formatNumber(Math.abs(outputWordCount - inputWordCount))} words ({wordDeltaPct}%) vs original
                    </span>
                  )}
                  {settingsStale && outputText && (
                    <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      Settings changed
                    </span>
                  )}
                  {lastResponse && lastResponse.processingTimeMs > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-50 text-purple-700 border border-purple-200">
                      <Zap size={10} />
                      {lastResponse.processingTimeMs}ms
                      {lastResponse.verificationPassesUsed > 1 && ` · ${lastResponse.verificationPassesUsed} passes`}
                    </span>
                  )}
                  {lastResponse && lastResponse.verificationPassesUsed > 0 && (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border',
                        lastResponse.metTargetThreshold
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                          : 'bg-amber-50 text-amber-600 border-amber-200',
                      )}
                      title="Internal AI-detection estimate from the rewrite step"
                    >
                      {lastResponse.metTargetThreshold
                        ? <><CheckCircle size={10} /> AI check: passed</>
                        : <><AlertCircle size={10} /> AI check: may flag</>
                      }
                    </span>
                  )}
                  {/* Action buttons moved from footer to header */}
                  {outputText && (
                    <div className="ml-auto flex items-center gap-1.5">
                      <OutputActionButton
                        icon={showDiff ? <EyeOff size={11} /> : <Eye size={11} />}
                        onClick={() => setShowDiff((v) => !v)}
                        disabled={showSentenceHighlights}
                        title={showSentenceHighlights ? 'Diff view unavailable while AI detection highlights are shown' : 'Toggle change highlighting vs. Original'}
                      >
                        {showDiff ? 'Hide changes' : 'Show changes'}
                      </OutputActionButton>
                      <OutputActionButton icon={<ClipboardCopy size={11} />} onClick={() => handleCopy(outputText)} title="Copy result (Ctrl+Shift+C)">
                        Copy
                      </OutputActionButton>
                      <OutputActionButton icon={<Download size={11} />} onClick={handleDownload}>
                        .txt
                      </OutputActionButton>
                      <SendToMenu text={outputText} />
                    </div>
                  )}
                </div>

                <div
                  ref={outputScrollRef}
                  onScroll={(e) => syncScroll(e.currentTarget, inputScrollRef.current)}
                  className="flex-1 min-h-0 overflow-y-auto px-5 py-3"
                  aria-live="polite"
                  aria-label="Humanised text output"
                >
                  {isLoading ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 pt-1">
                      <div className="flex items-center gap-2 mb-4">
                        <Loader2 size={14} className="animate-spin text-purple-accent" />
                        <span className="text-sm text-purple-accent font-medium">Humanising your text…</span>
                      </div>
                      <Skeleton variant="text" tone="light" lines={8} />
                    </motion.div>
                  ) : error ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col items-center justify-center h-full gap-3 text-center px-8"
                    >
                      <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center">
                        <AlertCircle size={16} className="text-red-500" />
                      </div>
                      <div>
                        <p className="text-[14px] font-medium text-text-sec">Couldn't humanise your text</p>
                        <p className="text-[12px] text-text-mut mt-1 max-w-[240px] leading-relaxed">{error}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleHumanise()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-purple-accent hover:bg-purple-deep text-white transition-colors"
                      >
                        <Wand2 size={12} /> Retry
                      </button>
                    </motion.div>
                  ) : outputText ? (
                    <motion.div
                      key={outputText}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-3"
                    >
                      {showSentenceHighlights ? (
                        <HighlightedText sentenceScores={detectionResult!.sentenceScores} />
                      ) : showDiff && diffTokens.length > 0 ? (
                        <DiffText tokens={diffTokens} />
                      ) : (
                        <TypewriterText text={outputText} animate={mutation.isSuccess || isChunkedResult} />
                      )}
                      {showSentenceHighlights && (
                        <p className="text-[11px] text-text-mut pt-1">
                          <span className="inline-block w-2 h-2 rounded-sm bg-emerald-200 mr-1" />
                          Human-sounding &nbsp;
                          <span className="inline-block w-2 h-2 rounded-sm bg-amber-200 mr-1 ml-2" />
                          Mixed &nbsp;
                          <span className="inline-block w-2 h-2 rounded-sm bg-red-200 mr-1 ml-2" />
                          AI-sounding
                        </p>
                      )}
                      {!showSentenceHighlights && showDiff && diffTokens.length > 0 && (
                        <p className="text-[11px] text-text-mut pt-1">
                          <span className="inline-block w-2 h-2 rounded-sm bg-purple-100 mr-1" />
                          Changed vs. Original — {changedWordPct}% of words rewritten at this level
                        </p>
                      )}
                    </motion.div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
                      <div className="w-9 h-9 rounded-xl bg-purple-50 border border-[#c4b5fd] flex items-center justify-center">
                        <Wand2 size={16} className="text-purple-accent opacity-70" />
                      </div>
                      <div>
                        <p className="text-[14px] font-medium text-text-sec">Humanised text will appear here</p>
                        <p className="text-[12px] text-text-mut mt-1 max-w-[220px] leading-relaxed">
                          Rewrites sentence structure and word choice to sound natural — set intensity and style, then click Humanise.
                        </p>
                      </div>
                      <div className="w-full max-w-xs mt-1 opacity-60 text-left">
                        <div className="p-3 rounded-lg border border-[#e0e0da] bg-[#f8fafc] text-xs leading-6 text-text-mut">
                          The{' '}
                          <span className="bg-purple-50 text-purple-300 px-0.5 rounded line-through">utilization of</span>{' '}
                          <span className="bg-purple-50 text-purple-700 px-0.5 rounded font-medium">use of</span>{' '}
                          renewable energy{' '}
                          <span className="bg-purple-50 text-purple-300 px-0.5 rounded line-through">has become increasingly prevalent</span>{' '}
                          <span className="bg-purple-50 text-purple-700 px-0.5 rounded font-medium">is growing fast</span>{' '}
                          in contemporary society.
                        </div>
                        <p className="text-[10px] text-text-mut mt-1.5 text-center">Changed words highlighted</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Output footer */}
                <div className="px-5 py-3 border-t border-[#e0e0da] shrink-0">
                  <div className="flex items-center justify-end">
                    {outputText && (
                      <button
                        type="button"
                        onClick={() => handleCheckAI(outputText)}
                        disabled={isCheckingAI}
                        className="lg:hidden inline-flex items-center gap-1.5 text-[13px] text-text-sec hover:text-text-pri transition-colors disabled:opacity-50"
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
                className="lg:hidden mt-5 bg-white border border-[#e0e0da] rounded-2xl p-4 flex items-center gap-4 shadow-card"
              >
                <ScoreCircle score={detectionResult.humanScore} size="sm" animated={false} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-pri">{detectionResult.humanScore}% Human</p>
                  <VerdictBadge verdict={detectionResult.verdict} humanScore={detectionResult.humanScore} size="sm" />
                </div>
                {detectionIsStale && (
                  <span className="text-xs text-amber-600 shrink-0">Outdated</span>
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
                humaniseScores={
                  lastResponse && lastResponse.verificationPassesUsed > 0
                    ? {
                        originalAiScore: lastResponse.originalAiScore,
                        finalAiScore: lastResponse.finalAiScore,
                        verificationPassesUsed: lastResponse.verificationPassesUsed,
                        metTargetThreshold: lastResponse.metTargetThreshold,
                      }
                    : null
                }
              />
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  )
}

export default EditorPage
