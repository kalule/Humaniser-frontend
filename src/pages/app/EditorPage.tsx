import { ProductionHumaniser } from '../../components/app/ProductionHumaniser'
import { humaniseJobs } from '../../api/humaniseJobs'
import { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Wand2,
  ClipboardCopy,
  Download,
  Loader2,
  Zap,
  AlertCircle,
  ShieldCheck,
  Upload,
  Eye,
  EyeOff,
  ChevronDown,
  MoreHorizontal,
  Lock,
  Clipboard,
  Check,
} from 'lucide-react'
import { cn, countWords, formatNumber } from '../../lib/utils'
import { renderInlineMarkdown, consumeBoldMarker } from '../../lib/inlineMarkdown'
import { useAuthStore } from '../../store/authStore'
import { useHumaniserStore } from '../../store/humaniserStore'
import { useUiStore } from '../../store/uiStore'
import { humaniseApi } from '../../api/humanise'
import { detectorApi } from '../../api/detector'
import { useDragDrop } from '../../hooks/useDragDrop'
import { DropOverlay } from '../../components/ui/DropOverlay'
import { ScoreBar } from '../../components/ui/ScoreBar'
import { VerdictBadge } from '../../components/ui/VerdictBadge'
import { SendToMenu } from '../../components/ui/SendToMenu'
import { ClearButton } from '../../components/ui/ClearButton'
import { PanelLabel } from '../../components/ui/PanelLabel'
import { OutputActionButton } from '../../components/ui/OutputActionButton'
import { UtilityButton } from '../../components/ui/UtilityButton'
import { Skeleton } from '../../components/ui/Skeleton'
import { ResultsPanelHeader } from '../../components/ui/ResultsPanelHeader'
import { PanelFooterBar } from '../../components/ui/PanelFooterBar'
import { DetectionScoreGauge } from '../../components/workspace/DetectionScoreGauge'
import { ToolBottomActionRow } from '../../components/ui/ToolBottomActionRow'
import { useToolTransferStore } from '../../store/toolTransferStore'
import type { Tone, Strength } from '../../types'
import type { DetectResponse, SentenceScore, LayerScores } from '../../types/detector'

const STORAGE_KEY_INPUT  = 'humanise_draft_input'
const STORAGE_KEY_OUTPUT = 'humanise_draft_output'
const CHUNK_SIZE = 4_900

// Output-toolbar buttons on this page only: the shared OutputActionButton
// default (h-6 / 11px) is too small a target here, and Detector uses it too.
// The collapsible AI-detection panel under the editor is hidden for now; the
// header gauge and Check AI button cover the same ground. Flip to bring it back.
const SHOW_DETECTION_PANEL = false

const OUTPUT_BTN_SIZE = 'h-8 px-3 gap-1.5 text-[13px] rounded-lg'

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

// Product UX exposes 3 rewrite levels (Light / Natural / Full). The backend's prompt
// builder (ClaudeService.BuildStrengthInstruction) and word-count budget
// (LengthBudget.BandFor) still branch on 4 distinct tiers — light / balanced / aggressive
// / maximum — each with real, different rewrite behaviour; "aggressive" is not dropped
// server-side, it's simply never surfaced as a UI choice. "Full" maps to "maximum" (the
// strongest existing tier — "complete reconstruction" is the closest server-side match to
// a UI label promising a full rewrite), and "Natural" maps to "balanced", the previous
// default. This mapping is deliberate and documented here so it isn't left implicit.
const REWRITE_LEVELS: { id: 'light' | 'natural' | 'full'; label: string; strength: Strength; hint: string }[] = [
  { id: 'light',   label: 'Light',   strength: 'light',    hint: 'Minimal changes — keeps your voice and structure' },
  { id: 'natural', label: 'Natural', strength: 'balanced', hint: 'Balanced rewrite — recommended for most text' },
  { id: 'full',    label: 'Full',    strength: 'maximum',  hint: 'Thorough rewrite of structure and wording' },
]
type RewriteLevelId = typeof REWRITE_LEVELS[number]['id']

const TONES: { value: Tone; label: string; description: string }[] = [
  { value: 'casual',         label: 'Casual',         description: 'Natural & relaxed'  },
  { value: 'professional',   label: 'Professional',   description: 'Warm & formal'       },
  { value: 'academic',       label: 'Academic',       description: 'Preserve citations, technical terms, and claim meaning.' },
  { value: 'conversational', label: 'Conversational', description: 'Engaging & lively'  },
]

// Optional academic-quality passes, off by default. Each maps 1:1 to a HumaniseRequest boolean
// field (see types/index.ts) and an additive instruction block in ClaudeService — none of them
// permit new facts/sources/claims, which stays enforced unconditionally regardless of selection.
type EnhanceKey =
  | 'reduceRepetition' | 'improveCriticalAnalysis' | 'improveArgumentFlow'
  | 'calibrateCausalClaims' | 'improveParagraphCoherence'
const ENHANCE_OPTIONS: { key: EnhanceKey; label: string; description: string }[] = [
  { key: 'reduceRepetition', label: 'Reduce repetition', description: 'Combine or rewrite repeated ideas, claims, and phrasing' },
  { key: 'improveCriticalAnalysis', label: 'Improve critical analysis', description: 'Sharpen reasoning and the link between evidence and claims' },
  { key: 'improveArgumentFlow', label: 'Improve argument flow', description: 'Strengthen transitions and paragraph-to-thesis connections' },
  { key: 'calibrateCausalClaims', label: 'Calibrate causal claims', description: 'Soften causal language the evidence doesn’t fully support' },
  { key: 'improveParagraphCoherence', label: 'Improve paragraph coherence', description: 'Tighten claim → evidence → analysis structure per paragraph' },
]

// "Auto" does not run any real tone-inference — there is no such system today — so rather
// than imply detection is happening, it resolves to one clearly-chosen default tone that's
// safe for most writing, and the UI never claims the tone was "detected". If real style
// inference is built later, this is the single place to wire it in.
const DEFAULT_AUTO_TONE: Tone = 'academic'

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
      {renderInlineMarkdown(displayed)}
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
            {renderInlineMarkdown(s.sentence, `s${i}`)}{' '}
          </span>
        )
      })}
    </p>
  )
}

// ── Word-level diff (client-side LCS, mirrors ParaphrasePage's approach) ─────

interface DiffOp {
  word: string
  type: 'same' | 'added' | 'removed'
}

// Strips leading/trailing punctuation for comparison only (rendering keeps the original
// token) so a word that's unchanged but picked up a different trailing comma/period from
// restructuring isn't flagged as "changed" — internal marks like apostrophes/hyphens stay,
// since those distinguish real words ("don't" vs "dont", "well-known" vs "known").
function normalizeForCompare(word: string): string {
  return word.toLowerCase().replace(/^[^\w']+|[^\w']+$/g, '')
}

// Word-level diff (client-side LCS) that emits a single interleaved sequence of
// same/added/removed tokens — Diff View renders removed AI jargon inline (red,
// struck through) next to the human rewrite that replaced it (green).
function computeDiffOps(original: string, humanised: string): DiffOp[] {
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

  const ops: DiffOp[] = []
  let i = m, j = n
  while (i > 0 && j > 0) {
    if (origNorm[i - 1] === newNorm[j - 1]) {
      ops.push({ word: newWords[j - 1], type: 'same' }); i--; j--
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      ops.push({ word: origWords[i - 1], type: 'removed' }); i--
    } else {
      ops.push({ word: newWords[j - 1], type: 'added' }); j--
    }
  }
  while (i > 0) { ops.push({ word: origWords[i - 1], type: 'removed' }); i-- }
  while (j > 0) { ops.push({ word: newWords[j - 1], type: 'added' }); j-- }

  ops.reverse()
  return ops
}

function DiffText({ ops }: { ops: DiffOp[] }) {
  let boldActive = false
  return (
    <p className="textarea-body text-text-pri whitespace-pre-wrap">
      {ops.map((op, idx) => {
        const raw = idx === 0 ? op.word : ' ' + op.word
        const { clean: text, isBold, nextBoldActive } = consumeBoldMarker(raw, boldActive)
        boldActive = nextBoldActive
        if (op.type === 'added') {
          return (
            <mark key={idx} className={cn('bg-emerald-100 text-emerald-800 rounded px-0.5 not-italic', isBold ? 'font-bold' : 'font-normal')}>
              {text}
            </mark>
          )
        }
        if (op.type === 'removed') {
          return (
            <span key={idx} className={cn('bg-red-50 text-red-700 line-through decoration-red-400 rounded px-0.5', isBold && 'font-bold')}>
              {text}
            </span>
          )
        }
        return <span key={idx} className={cn(isBold && 'font-bold')}>{text}</span>
      })}
    </p>
  )
}

// ── Detection estimate wording ────────────────────────────────────────────────
//
// Two distinct signals exist and must not be conflated:
//  - a full scan (detectorApi.detect) returns a verified DetectResponse
//  - the rewrite step's own verification loop produces a quick internal estimate
// Neither is displayed as a pass/fail claim ("AI check: passed") — only as an honestly
// labelled likelihood, since that's what the underlying data actually supports.

function humanScoreBarColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500'
  if (score >= 60) return 'bg-lime-500'
  if (score >= 40) return 'bg-amber-500'
  if (score >= 20) return 'bg-orange-500'
  return 'bg-red-500'
}

function detectionEstimateLabel(aiScore: number): { text: 'Low' | 'Medium' | 'High'; color: string } {
  if (aiScore <= 35) return { text: 'Low', color: 'text-emerald-600' }
  if (aiScore <= 60) return { text: 'Medium', color: 'text-amber-600' }
  return { text: 'High', color: 'text-red-600' }
}

// Explicit per-layer status badges — named after the detection layers we actually
// run internally (statistical / stylometric / semantic), rather than implying
// integration with named third-party scanners we don't call.
const ENGINE_LAYERS: { key: keyof LayerScores; label: string }[] = [
  { key: 'statistical', label: 'Statistical Engine' },
  { key: 'stylometric', label: 'Stylometric Engine' },
  { key: 'semantic',    label: 'Semantic Engine' },
]

function engineBadge(humanLikeScore: number): { text: string; classes: string } {
  if (humanLikeScore < 0) return { text: 'Skipped', classes: 'text-text-mut bg-neutral-100 border-[#e0e0da]' }
  const aiLikelihood = Math.round(100 - humanLikeScore)
  if (aiLikelihood <= 3) return { text: 'Clean', classes: 'text-emerald-700 bg-emerald-50 border-emerald-200' }
  if (aiLikelihood <= 30) return { text: `${aiLikelihood}%`, classes: 'text-amber-700 bg-amber-50 border-amber-200' }
  return { text: `${aiLikelihood}%`, classes: 'text-red-700 bg-red-50 border-red-200' }
}

function EngineBadges({ layerScores }: { layerScores: LayerScores }) {
  return (
    <div className="w-full space-y-1.5">
      <span className="text-[10px] font-medium text-text-mut uppercase tracking-wider">Engine breakdown</span>
      {ENGINE_LAYERS.map(({ key, label }) => {
        const badge = engineBadge(layerScores[key])
        return (
          <div key={key} className="flex items-center justify-between">
            <span className="text-[11px] text-text-sec">{label}</span>
            <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full border tabular-nums', badge.classes)}>
              {badge.text}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Main EditorPage ───────────────────────────────────────────────────────────

export function EditorPage() {
  const [validatedHumaniser, setValidatedHumaniser] = useState(false)
  useEffect(() => {
    let active = true
    void humaniseJobs.capabilities().then(c => { if (active) setValidatedHumaniser(c.enabled) }).catch(() => {})
    return () => { active = false }
  }, [])

  const user = useAuthStore((s) => s.user)
  const updateUser = useAuthStore((s) => s.updateUser)
  const {
    inputText, outputText, isLoading, lastResponse, error,
    setInputText, setOutputText, setTone, setStrength,
    setLoading, setLastResponse, setError,
  } = useHumaniserStore()
  const { openWordLimitModal } = useUiStore()

  const [rewriteLevel, setRewriteLevel] = useState<RewriteLevelId>('natural')
  const [toneMode, setToneMode] = useState<'auto' | Tone>('academic')
  const [toneMenuOpen, setToneMenuOpen] = useState(false)
  // Keep original length maps 1:1 to HumaniseRequest.preserveLength (already fully implemented
  // server-side — LengthBudget clamps to ±5% and a mechanical correction pass enforces it — this
  // was just never exposed in the UI). Default true to match the backend default.
  const [keepLength, setKeepLength] = useState(true)
  const [enhance, setEnhance] = useState({
    reduceRepetition: false,
    improveCriticalAnalysis: false,
    improveArgumentFlow: false,
    calibrateCausalClaims: false,
    improveParagraphCoherence: false,
  })
  const [enhanceMenuOpen, setEnhanceMenuOpen] = useState(false)
  const enhanceCount = Object.values(enhance).filter(Boolean).length
  const [overflowOpen, setOverflowOpen] = useState(false)
  const [mobileView, setMobileView] = useState<'original' | 'humanised'>('original')
  const [lastUsedSettings, setLastUsedSettings] = useState<{ tone: Tone; rewriteLevel: RewriteLevelId } | null>(null)
  const [detectionResult, setDetectionResult] = useState<DetectResponse | null>(null)
  const [isCheckingAI, setIsCheckingAI] = useState(false)
  const [detectionCheckedFor, setDetectionCheckedFor] = useState('')
  const [detectionExpanded, setDetectionExpanded] = useState(false)
  const [chunkProgress, setChunkProgress] = useState<{ done: number; total: number } | null>(null)
  const [isChunkedResult, setIsChunkedResult] = useState(false)
  const [showDiff, setShowDiff] = useState(() => {
    const saved = sessionStorage.getItem('humanise_show_diff')
    return saved === null ? true : saved === '1'
  })
  const [diffOps, setDiffOps] = useState<DiffOp[]>([])
  const changedWordPct = useMemo(() => {
    if (diffOps.length === 0) return 0
    return Math.round((diffOps.filter((o) => o.type !== 'same').length / diffOps.length) * 100)
  }, [diffOps])

  const effectiveTone: Tone = toneMode === 'auto' ? DEFAULT_AUTO_TONE : toneMode
  // Sent to the backend as-is — 'auto' is a real wire value now (RegisterDetector resolves it
  // server-side against the actual input), not just a client-side placeholder for DEFAULT_AUTO_TONE.
  const wireTone: Tone | 'auto' = toneMode
  const activeLevel = REWRITE_LEVELS.find((t) => t.id === rewriteLevel)!

  const inputScrollRef = useRef<HTMLTextAreaElement>(null)
  const outputScrollRef = useRef<HTMLDivElement>(null)
  const isSyncingScroll = useRef(false)
  const toneMenuRef = useRef<HTMLDivElement>(null)
  const overflowRef = useRef<HTMLDivElement>(null)
  const enhanceMenuRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => { setStrength(activeLevel.strength) }, [activeLevel, setStrength])
  useEffect(() => { setTone(effectiveTone) }, [effectiveTone, setTone])
  useEffect(() => { return () => setLoading(false) }, [setLoading])
  useEffect(() => { sessionStorage.setItem('humanise_show_diff', showDiff ? '1' : '0') }, [showDiff])

  useEffect(() => {
    if (!showDiff || !outputText) { setDiffOps([]); return }
    const id = requestAnimationFrame(() => setDiffOps(computeDiffOps(inputText, outputText)))
    return () => cancelAnimationFrame(id)
  }, [showDiff, inputText, outputText])

  useEffect(() => {
    if (!toneMenuOpen) return
    const handler = (e: MouseEvent) => { if (!toneMenuRef.current?.contains(e.target as Node)) setToneMenuOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [toneMenuOpen])

  useEffect(() => {
    if (!overflowOpen) return
    const handler = (e: MouseEvent) => { if (!overflowRef.current?.contains(e.target as Node)) setOverflowOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [overflowOpen])

  useEffect(() => {
    if (!enhanceMenuOpen) return
    const handler = (e: MouseEvent) => { if (!enhanceMenuRef.current?.contains(e.target as Node)) setEnhanceMenuOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [enhanceMenuOpen])

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
  // Full rewrite mode is gated server-side (TIER_FEATURE_LOCKED on Free) — mirrored here only to
  // disable the button with an upsell hint before the request round-trip, not as the real gate.
  const canUseFullMode = user?.plan === 'Pro' || user?.plan === 'Unlimited'
  const settingsStale =
    !!outputText &&
    lastUsedSettings !== null &&
    (lastUsedSettings.tone !== effectiveTone || lastUsedSettings.rewriteLevel !== rewriteLevel)
  const detectionIsStale = detectionResult !== null && detectionCheckedFor !== outputText

  const mutation = useMutation({
    mutationFn: () =>
      humaniseApi.humanise({
        text: inputText, tone: wireTone, strength: activeLevel.strength,
        preserveLength: keepLength, ...enhance,
      }).then((r) => r.data),
    onMutate:  () => { setLoading(true); setError(null) },
    onSuccess: (data) => {
      setLastResponse(data)
      setLastUsedSettings({ tone: effectiveTone, rewriteLevel })
      updateUser({
        wordsUsed: data.usage.wordsUsed,
        wordsLimit: data.usage.wordsLimit,
        creditsUsed: data.usage.creditsUsed,
        creditsLimit: data.usage.creditsLimit,
      })
      setDetectionResult(null)
      setDetectionCheckedFor('')
      setMobileView('humanised')
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
          tone: wireTone,
          strength: activeLevel.strength,
          preserveLength: keepLength,
          ...enhance,
        }).then(r => r.data)
        humanisedParts.push(res.humanisedText)
        if (i === inputChunks.length - 1) {
          updateUser({ wordsUsed: res.usage.wordsUsed, wordsLimit: res.usage.wordsLimit })
          setLastResponse({ ...res, humanisedText: humanisedParts.join('\n\n'), wordCount: humanisedParts.join('\n\n').split(/\s+/).filter(Boolean).length })
        }
      }
      setLastUsedSettings({ tone: effectiveTone, rewriteLevel })
      setDetectionResult(null)
      setDetectionCheckedFor('')
      setIsChunkedResult(true)
      setMobileView('humanised')
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
  }, [inputText, inputChunks, needsChunking, isLoading, isAtLimit, wordsUsed, wordsLimit, openWordLimitModal, effectiveTone, wireTone, activeLevel, rewriteLevel, mutation, setLoading, setError, setLastResponse, updateUser])

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

  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const clipboardText = await navigator.clipboard.readText()
      setInputText(clipboardText)
      toast.success('Pasted from clipboard!')
    } catch { toast.error('Clipboard access denied') }
  }, [setInputText])

  const handleCopy = useCallback(async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast.success('Copied to clipboard!') }
    catch { toast.error('Failed to copy to clipboard') }
  }, [])

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
    setDetectionExpanded(false); setMobileView('original')
    localStorage.removeItem(STORAGE_KEY_INPUT)
    localStorage.removeItem(STORAGE_KEY_OUTPUT)
  }, [setInputText, setOutputText, setError])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter')  { e.preventDefault(); void handleHumanise(); return }
      if (e.ctrlKey && e.shiftKey && e.key === 'C')       { e.preventDefault(); if (outputText) handleCopy(outputText); return }
      if (e.ctrlKey && e.shiftKey && e.key === 'X')       { e.preventDefault(); handleClearInput() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleHumanise, handleCopy, handleClearInput, outputText])

  const showSentenceHighlights =
    !!detectionResult && !detectionIsStale && detectionResult.sentenceScores.length > 0

  const hasOutput = !!outputText

  // Detection summary appears only after the user explicitly runs the separate AI Detector
  // ("Check AI"). The humaniser no longer produces any detection estimate of its own — it
  // used to grade its own output against a statistical mock detector, which was neither an
  // independent judgment nor what the humaniser should be optimising for.
  const detectionSummary = useMemo(() => {
    if (detectionResult && !detectionIsStale) {
      const aiScore = Math.round(100 - detectionResult.humanScore)
      return { source: 'scan' as const, ...detectionEstimateLabel(aiScore) }
    }
    return null
  }, [detectionResult, detectionIsStale])

  const gaugeVerified = !!(detectionResult && !detectionIsStale)
  const gaugeScore = gaugeVerified ? detectionResult!.humanScore : null

  // What the header shows by default instead: whether the mechanical faithfulness checks
  // (claims + citations) passed. These are verifiable facts about this rewrite, not a guess.
  const revisionIssueCount = lastResponse
    ? (lastResponse.preservation?.issueCount ?? 0)
      + (lastResponse.citationIntegrity?.droppedCitations.length ?? 0)
      + (lastResponse.citationIntegrity?.addedCitations.length ?? 0)
    : 0

  const mobileTabsActive = hasOutput

  if (validatedHumaniser) return <ProductionHumaniser />

  return (
    <div className="min-h-0 bg-transparent px-4 py-6 w-full">
      <div
        className="flex flex-col min-w-0 lg:sticky lg:top-4"
        style={{ minHeight: 'calc(100vh - 7rem)' }}
      >

        {/* ─── SPLIT EDITOR CARD ─────────────────────────────────────────── */}
        <div className="bg-white border border-[#e0e0da] rounded-2xl overflow-hidden flex flex-col shadow-card" style={{ height: 'calc(100vh - 7rem)' }}>

          {/* Controls header — only shown once there's something to rewrite, so the
              empty state stays quiet instead of front-loading configuration. */}
          {inputText && (
            <div className="px-5 py-4 border-b border-[#e0e0da] shrink-0">
              <div className="bg-neutral-100 rounded-xl px-4 py-3 flex items-center flex-wrap gap-x-4 gap-y-2">

                {/* Rewrite level group */}
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-neutral-500 uppercase tracking-wider shrink-0">
                    Rewrite
                  </span>
                  <div role="radiogroup" aria-label="Rewrite strength" className="flex items-center gap-1.5 flex-wrap">
                    {REWRITE_LEVELS.map((t) => {
                      const active = rewriteLevel === t.id
                      const locked = t.id === 'full' && !canUseFullMode
                      return (
                        <button
                          key={t.id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => { if (!locked) setRewriteLevel(t.id) }}
                          disabled={isLoading || locked}
                          title={locked ? 'Upgrade to Starter to unlock Full rewrites' : t.hint}
                          className={cn(
                            'px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150 border disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5',
                            active
                              ? 'bg-purple-accent text-white border-purple-accent shadow-sm'
                              : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300 hover:text-neutral-900',
                          )}
                        >
                          {locked && <Lock size={12} />}
                          {t.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Divider */}
                <div className="hidden sm:block w-px h-5 bg-neutral-200" />

                {/* Tone — defaults to Auto; opens to reveal explicit overrides */}
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-neutral-500 uppercase tracking-wider shrink-0">
                    Tone
                  </span>
                  <div className="relative" ref={toneMenuRef}>
                    <button
                      type="button"
                      onClick={() => setToneMenuOpen((v) => !v)}
                      disabled={isLoading}
                      aria-haspopup="listbox"
                      aria-expanded={toneMenuOpen}
                      title={toneMode === 'auto' ? 'A sensible default tone is applied — click to override' : undefined}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150 border disabled:opacity-50 disabled:cursor-not-allowed',
                        toneMode !== 'auto'
                          ? 'bg-purple-accent text-white border-purple-accent shadow-sm'
                          : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300 hover:text-neutral-900',
                      )}
                    >
                      {toneMode === 'auto'
                        ? (lastResponse?.resolvedTone ? `Auto · ${TONES.find((t) => t.value === lastResponse.resolvedTone)?.label ?? lastResponse.resolvedTone}` : 'Auto')
                        : TONES.find((t) => t.value === toneMode)?.label}
                      <ChevronDown size={14} className={cn('transition-transform duration-150', toneMenuOpen && 'rotate-180')} />
                    </button>

                    {toneMenuOpen && (
                      <div role="listbox" aria-label="Tone" className="absolute z-30 top-full mt-1.5 left-0 w-64 bg-white border border-gray-200 rounded-xl shadow-elevated overflow-hidden py-1">
                        <button
                          type="button"
                          role="option"
                          aria-selected={toneMode === 'auto'}
                          onClick={() => { setToneMode('auto'); setToneMenuOpen(false) }}
                          className={cn('flex flex-col items-start w-full px-3 py-2 text-left transition-colors', toneMode === 'auto' ? 'bg-purple-50' : 'hover:bg-gray-50')}
                        >
                          <span className="text-[13px] font-medium text-gray-800">Auto</span>
                          <span className="text-[11px] text-gray-500">
                            {toneMode === 'auto' && lastResponse?.resolvedTone
                              ? `Detected ${TONES.find((t) => t.value === lastResponse.resolvedTone)?.label ?? lastResponse.resolvedTone} from your text — override anytime`
                              : 'Detects your writing\'s register from the text itself — override anytime'}
                          </span>
                        </button>
                        <div className="h-px bg-gray-100 my-1" />
                        {TONES.map((t) => (
                          <button
                            key={t.value}
                            type="button"
                            role="option"
                            aria-selected={toneMode === t.value}
                            onClick={() => { setToneMode(t.value); setToneMenuOpen(false) }}
                            className={cn('flex flex-col items-start w-full px-3 py-2 text-left transition-colors', toneMode === t.value ? 'bg-purple-50' : 'hover:bg-gray-50')}
                          >
                            <span className="text-[13px] font-medium text-gray-800">{t.label}</span>
                            <span className="text-[11px] text-gray-500">{t.description}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div className="hidden sm:block w-px h-5 bg-neutral-200" />

                {/* Keep original length — maps to HumaniseRequest.preserveLength */}
                <button
                  type="button"
                  onClick={() => setKeepLength((v) => !v)}
                  disabled={isLoading}
                  aria-pressed={keepLength}
                  title="Keep the rewrite within ~5% of the original word count"
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150 border disabled:opacity-50 disabled:cursor-not-allowed',
                    keepLength
                      ? 'bg-purple-accent text-white border-purple-accent shadow-sm'
                      : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300 hover:text-neutral-900',
                  )}
                >
                  Keep length
                </button>

                {/* Enhance — opt-in academic-quality passes, off by default */}
                <div className="relative" ref={enhanceMenuRef}>
                  <button
                    type="button"
                    onClick={() => setEnhanceMenuOpen((v) => !v)}
                    disabled={isLoading}
                    aria-haspopup="listbox"
                    aria-expanded={enhanceMenuOpen}
                    title="Optional academic-quality passes — none of these add new content, sources, or claims"
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150 border disabled:opacity-50 disabled:cursor-not-allowed',
                      enhanceCount > 0
                        ? 'bg-purple-accent text-white border-purple-accent shadow-sm'
                        : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300 hover:text-neutral-900',
                    )}
                  >
                    Enhance{enhanceCount > 0 ? ` (${enhanceCount})` : ''}
                    <ChevronDown size={14} className={cn('transition-transform duration-150', enhanceMenuOpen && 'rotate-180')} />
                  </button>

                  {enhanceMenuOpen && (
                    <div role="listbox" aria-label="Enhance" aria-multiselectable="true" className="absolute z-30 top-full mt-1.5 left-0 w-72 bg-white border border-gray-200 rounded-xl shadow-elevated overflow-hidden py-1">
                      {ENHANCE_OPTIONS.map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          role="option"
                          aria-selected={enhance[opt.key]}
                          onClick={() => setEnhance((v) => ({ ...v, [opt.key]: !v[opt.key] }))}
                          className="flex items-start gap-2 w-full px-3 py-2 text-left transition-colors hover:bg-gray-50"
                        >
                          <span className={cn(
                            'mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center',
                            enhance[opt.key] ? 'bg-purple-accent border-purple-accent' : 'border-gray-300',
                          )}>
                            {enhance[opt.key] && <Check size={11} className="text-white" />}
                          </span>
                          <span className="flex flex-col items-start">
                            <span className="text-[13px] font-medium text-gray-800">{opt.label}</span>
                            <span className="text-[11px] text-gray-500">{opt.description}</span>
                          </span>
                        </button>
                      ))}
                      <div className="h-px bg-gray-100 my-1" />
                      <p className="px-3 py-1.5 text-[10px] text-gray-400 leading-snug">
                        Never adds new facts, sources, or claims — only changes how the existing content is expressed.
                      </p>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* Mobile result/original toggle — only once there's a result to switch to */}
          {mobileTabsActive && (
            <div role="tablist" aria-label="View" className="lg:hidden flex items-center gap-1.5 px-5 py-2 border-b border-[#e0e0da] shrink-0">
              <button
                type="button"
                role="tab"
                aria-selected={mobileView === 'humanised'}
                onClick={() => setMobileView('humanised')}
                className={cn('px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors',
                  mobileView === 'humanised' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600')}
              >
                Humanised
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mobileView === 'original'}
                onClick={() => setMobileView('original')}
                className={cn('px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors',
                  mobileView === 'original' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600')}
              >
                Original
              </button>
            </div>
          )}

          {/* Split panels — fill remaining card height */}
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 divide-[#e0e0da] lg:gap-4 flex-1 min-h-0">

            {/* ── Left: Input ── */}
            <div
              className={cn('flex-col min-h-0 relative lg:flex', mobileTabsActive && mobileView !== 'original' ? 'hidden' : 'flex')}
              {...dragHandlers}
            >
              {fileInputElement}
              <DropOverlay isDragging={isDragging} isProcessing={isFileProcessing} />

              {/* Input panel header — title only; word count and Paste/Upload now live
                  in the PanelFooterBar below the textarea, not up here. */}
              <ResultsPanelHeader
                title={<PanelLabel label="Original" />}
              />

              <div className="relative flex-1 min-h-0">
                <textarea
                  ref={inputScrollRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onScroll={(e) => syncScroll(e.currentTarget, outputScrollRef.current)}
                  aria-label="Original text"
                  disabled={isLoading}
                  className="textarea-body absolute inset-0 w-full h-full bg-transparent text-text-pri px-5 py-3 resize-none outline-none focus:ring-2 focus:ring-inset focus:ring-purple-accent/30 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
                />
                {!inputText && (
                  <div className="textarea-body pointer-events-none absolute inset-0 px-5 py-3 text-text-mut select-none">
                    Paste your writing here, or{' '}
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

              {/* Word count + Paste/Upload — moved out of the header into the footer,
                  right above the Clear/Humanise row. */}
              <PanelFooterBar
                metadata={
                  needsChunking ? (
                    <span className="text-xs font-normal tabular-nums text-amber-600">
                      {formatNumber(inputWordCount)} words · {inputChunks.length} parts
                    </span>
                  ) : (
                    <span className={cn('text-xs font-normal tabular-nums',
                      inputWordCount >= 500 ? 'text-red-500' : inputWordCount >= 400 ? 'text-amber-600' : 'text-gray-400')}>
                      {formatNumber(inputWordCount)} words
                    </span>
                  )
                }
                actions={
                  <>
                    <UtilityButton
                      icon={<Clipboard size={14} />}
                      label="Paste"
                      className="h-8 px-3 text-[13px]"
                      onClick={() => void handlePasteFromClipboard()}
                      disabled={isLoading}
                    />
                    <UtilityButton
                      icon={<Upload size={14} />}
                      label="Upload"
                      className="h-8 px-3 text-[13px]"
                      onClick={openFilePicker}
                      disabled={isLoading || isFileProcessing}
                    />
                  </>
                }
              />

              {/* Bottom action footer — Clear (secondary, left) opposite Humanise
                  (primary, right); regeneration itself still happens exclusively
                  through the primary button, no separate "Try again". */}
              <ToolBottomActionRow
                clearButton={<ClearButton onClick={handleClearInput} disabled={!inputText || isLoading} />}
                primaryButton={
                  <button
                    type="button"
                    onClick={() => void handleHumanise()}
                    disabled={!inputText.trim() || isLoading}
                    title="Humanise (Ctrl+Enter / Cmd+Enter)"
                    className={cn(
                      'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all shrink-0',
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
                      : isLoading ? 'Humanising your writing…'
                      : isAtLimit ? 'Limit reached'
                      : settingsStale ? 'Re-Humanise'
                      : needsChunking ? `Humanise (${inputChunks.length} parts)`
                      : 'Humanise'}
                  </button>
                }
              />
            </div>

            {/* ── Right: Output ── */}
            <div
              className={cn('flex-col min-h-0 lg:shadow-[inset_1px_0_0_#e4e4e7] lg:flex', mobileTabsActive && mobileView !== 'humanised' ? 'hidden' : 'flex')}
              role="region"
              aria-label="Humanised result"
            >

              {/* Output panel header — title + detection gauge only; word count,
                  delta, and actions (Show changes/Check AI/Copy/More) live in the
                  PanelFooterBar below the content, same as the input panel. */}
              <ResultsPanelHeader
                tinted={hasOutput}
                title={
                  <div className="flex items-center gap-2.5">
                    <PanelLabel label="Humanised" colorOverride={hasOutput ? 'var(--color-purple)' : undefined} />
                    {hasOutput && (gaugeScore !== null || isCheckingAI) ? (
                      <DetectionScoreGauge
                        humanScore={gaugeScore ?? 0}
                        isLoading={gaugeScore === null && isCheckingAI}
                        verified={gaugeVerified}
                        variant="light"
                        size={30}
                        strokeWidth={3.5}
                        showLabel
                      />
                    ) : hasOutput && lastResponse && revisionIssueCount > 0 ? (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-amber-50 border-amber-200 text-amber-700"
                        title="Mechanical checks found hedges, numbers, quotations, or citations from your original that changed or went missing"
                      >
                        <AlertCircle size={12} />
                        {`Review ${revisionIssueCount} change${revisionIssueCount === 1 ? '' : 's'}`}
                      </span>
                    ) : null}
                  </div>
                }
              />

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
                      <span className="text-sm text-purple-accent font-medium">Humanising your writing…</span>
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
                    ) : showDiff && diffOps.length > 0 ? (
                      <DiffText ops={diffOps} />
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
                    {!showSentenceHighlights && showDiff && diffOps.length > 0 && (
                      <p className="text-[11px] text-text-mut pt-1">
                        <span className="inline-block w-2 h-2 rounded-sm bg-emerald-100 mr-1" />
                        Added &nbsp;
                        <span className="inline-block w-2 h-2 rounded-sm bg-red-50 border border-red-200 mr-1 ml-2" />
                        Removed AI jargon &nbsp;·&nbsp; {changedWordPct}% of words rewritten at this level
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
                        Rewrites sentence structure and word choice to sound natural — paste your writing and click Humanise.
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

              {/* Word count/delta + Show changes/Check AI/Copy/More — moved out of the
                  header into the footer, mirroring the input panel's PanelFooterBar. */}
              {outputText && (
                <PanelFooterBar
                  metadata={
                    <>
                      <span className="text-xs font-normal tabular-nums text-gray-400">
                        {formatNumber(outputWordCount)} words
                        {outputWordCount !== inputWordCount && !wordDeltaFlagged && (
                          <span className="text-gray-400">
                            {' '}· {outputWordCount > inputWordCount ? '+' : '−'}{formatNumber(Math.abs(outputWordCount - inputWordCount))} vs original
                          </span>
                        )}
                      </span>
                      {detectionResult && !detectionIsStale && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-600 border border-neutral-200">
                          {detectionResult.flags.length} AI signal{detectionResult.flags.length === 1 ? '' : 's'}
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
                      {settingsStale && (
                        <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                          Settings changed
                        </span>
                      )}
                    </>
                  }
                  actions={
                    <>
                      <OutputActionButton
                        icon={showDiff ? <EyeOff size={14} /> : <Eye size={14} />}
                        onClick={() => setShowDiff((v) => !v)}
                        disabled={showSentenceHighlights}
                        aria-pressed={showDiff}
                        className={cn(OUTPUT_BTN_SIZE, showDiff && 'bg-emerald-50 border-emerald-300 text-emerald-700')}
                        title={showSentenceHighlights ? 'Change highlighting unavailable while AI detection highlights are shown' : 'Highlights what changed — additions in green, removed AI jargon in red'}
                      >
                        {showDiff ? 'Hide changes' : 'Show changes'}
                      </OutputActionButton>
                      <OutputActionButton
                        icon={isCheckingAI ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                        onClick={() => handleCheckAI(outputText)}
                        disabled={isCheckingAI}
                        className={cn(
                          OUTPUT_BTN_SIZE,
                          detectionResult && !detectionIsStale
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                            : 'border-purple-accent text-purple-accent bg-purple-tint hover:text-purple-deep',
                        )}
                        title={
                          detectionResult && !detectionIsStale
                            ? 'Re-run the verified AI-detection scan'
                            : 'Run a verified AI-detection scan (the gauge above is an estimate until you do)'
                        }
                      >
                        {isCheckingAI ? 'Scanning…' : detectionResult && !detectionIsStale ? 'Rescan' : 'Check AI'}
                      </OutputActionButton>
                      <OutputActionButton icon={<ClipboardCopy size={14} />} className={OUTPUT_BTN_SIZE} onClick={() => handleCopy(outputText)} title="Copy result (Ctrl+Shift+C)">
                        Copy
                      </OutputActionButton>
                      <div className="relative" ref={overflowRef}>
                        <OutputActionButton
                          icon={<MoreHorizontal size={16} />}
                          className={cn(OUTPUT_BTN_SIZE, 'w-8 justify-center px-0')}
                          onClick={() => setOverflowOpen((v) => !v)}
                          aria-haspopup="menu"
                          aria-expanded={overflowOpen}
                          aria-label="More actions"
                          title="More actions"
                        >
                          <span className="sr-only">More</span>
                        </OutputActionButton>
                        {overflowOpen && (
                          <div role="menu" className="absolute right-0 bottom-full mb-1.5 z-30 w-48 bg-white border border-gray-200 rounded-xl shadow-elevated overflow-hidden py-1">
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => { handleDownload(); setOverflowOpen(false) }}
                              className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                            >
                              <Download size={12} className="text-gray-400 shrink-0" /> Download .txt
                            </button>
                            <div className="px-1">
                              <SendToMenu text={outputText} inline className="w-full [&>button]:w-full [&>button]:justify-start [&>button]:h-auto [&>button]:px-2 [&>button]:py-2 [&>button]:border-0 [&>button]:text-[13px]" />
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  }
                />
              )}
            </div>
          </div>
        </div>

        {/* ─── CITATION INTEGRITY — a dropped or fabricated citation is a correctness
             problem, not a style one, so unlike the AI-detection estimate this is never
             tucked behind a collapsed panel: it's shown as soon as it's known. */}
        <AnimatePresence>
          {lastResponse?.citationIntegrity?.hasMismatch && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              className="mt-4 bg-red-50 border border-red-200 rounded-2xl px-5 py-3.5 shrink-0"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-red-700">
                    Citation check: the rewrite may have changed your citations — review before submitting
                  </p>
                  <p className="text-[12px] text-red-600/90 mt-0.5">
                    {lastResponse.citationIntegrity.preservedCount} of {lastResponse.citationIntegrity.originalCitationCount} original citation
                    {lastResponse.citationIntegrity.originalCitationCount === 1 ? '' : 's'} preserved.
                    {lastResponse.citationIntegrity.droppedCitations.length > 0 && (
                      <> Missing: {lastResponse.citationIntegrity.droppedCitations.join(', ')}.</>
                    )}
                    {lastResponse.citationIntegrity.addedCitations.length > 0 && (
                      <> New (not in your original text): {lastResponse.citationIntegrity.addedCitations.join(', ')}.</>
                    )}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── CLAIM PRESERVATION — same rationale as the citation panel: a dropped hedge
             ("may"), degree word ("significantly"), number, or altered quotation changes what
             the text claims, so it's shown immediately rather than tucked away. */}
        <AnimatePresence>
          {lastResponse?.preservation?.hasIssues && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3.5 shrink-0"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="min-w-0 space-y-1">
                  <p className="text-[13px] font-semibold text-amber-800">
                    Claim check: the rewrite may have changed what your text claims — review before using it
                  </p>
                  <ul className="text-[12px] text-amber-800/90 space-y-0.5">
                    {lastResponse.preservation.droppedQualifiers.map((q) => (
                      <li key={`q-${q}`}>Qualifier removed or weakened: {q}</li>
                    ))}
                    {lastResponse.preservation.droppedNumbers.length > 0 && (
                      <li>Number(s) missing: {lastResponse.preservation.droppedNumbers.join(', ')}</li>
                    )}
                    {lastResponse.preservation.addedNumbers.length > 0 && (
                      <li>Number(s) not in your original: {lastResponse.preservation.addedNumbers.join(', ')}</li>
                    )}
                    {lastResponse.preservation.alteredQuotations.map((q) => (
                      <li key={`quote-${q}`}>Quotation changed: “{q}”</li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── DETECTION — collapsed by default, secondary to the writing result ── */}
        <AnimatePresence>
          {SHOW_DETECTION_PANEL && outputText && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              className="mt-4 bg-white border border-[#e0e0da] rounded-2xl shadow-card overflow-hidden shrink-0"
            >
              <button
                type="button"
                onClick={() => setDetectionExpanded((v) => !v)}
                aria-expanded={detectionExpanded}
                aria-controls="detection-panel"
                className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-neutral-50 transition-colors"
              >
                <span className="inline-flex items-center gap-2 text-[13px] font-medium text-text-sec">
                  <ShieldCheck size={14} className="text-text-mut" />
                  {detectionSummary ? (
                    <>
                      {detectionSummary.source === 'scan' ? 'AI-detection score' : 'AI-detection estimate'}:{' '}
                      <span className={cn('font-semibold', detectionSummary.color)}>{detectionSummary.text}</span>
                    </>
                  ) : (
                    'AI detection'
                  )}
                </span>
                <ChevronDown size={14} className={cn('transition-transform text-text-mut', detectionExpanded && 'rotate-180')} />
              </button>

              {detectionExpanded && (
                <div id="detection-panel" className="border-t border-[#e0e0da] px-5 py-4 grid sm:grid-cols-2 gap-x-6 gap-y-4">

                  {/* Full scan */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-text-mut uppercase tracking-wider">Detection scan</span>
                      {detectionResult && (
                        <span className={cn('text-[11px] font-medium', detectionIsStale ? 'text-amber-600' : 'text-text-mut')}>
                          {detectionIsStale ? 'Score may be outdated' : 'Scanned with V1'}
                        </span>
                      )}
                    </div>
                    {detectionResult ? (
                      <>
                        <ScoreBar score={detectionResult.humanScore} label="Human score" size="compact" colorForScore={humanScoreBarColor} />
                        <VerdictBadge verdict={detectionResult.verdict} humanScore={detectionResult.humanScore} size="sm" />
                        {detectionResult.wordCount > 0 && (
                          <span className="block text-[11px] text-text-mut">{detectionResult.wordCount} words analysed</span>
                        )}
                        <div className="h-px bg-[#e0e0da]" />
                        <EngineBadges layerScores={detectionResult.layerScores} />
                      </>
                    ) : (
                      <p className="text-[12px] text-text-mut leading-relaxed">
                        Run a full scan for a verified score across the statistical, stylometric, and semantic engines.
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCheckAI(outputText)}
                      disabled={isCheckingAI}
                      className={cn(
                        'inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all border',
                        !isCheckingAI
                          ? 'bg-white hover:bg-purple-50 text-purple-accent border-purple-accent'
                          : 'bg-white text-text-mut border-[#e0e0da] cursor-wait opacity-70',
                      )}
                    >
                      {isCheckingAI ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
                      {isCheckingAI ? 'Scanning…' : detectionResult ? 'Rescan' : 'Run full scan'}
                    </button>
                  </div>

                  {/* Revision summary — verifiable facts about the rewrite, not an estimate */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-semibold text-text-mut uppercase tracking-wider">Revision summary</span>
                    {lastResponse?.revision ? (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-text-sec">Length</span>
                          <span className="text-[12px] font-semibold tabular-nums text-text-pri">
                            {lastResponse.revision.originalWordCount} → {lastResponse.revision.outputWordCount} words ({lastResponse.revision.lengthRatioPercent}%)
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-text-sec">Sentences with stock phrasing</span>
                          <span className="text-[12px] font-semibold tabular-nums text-text-pri">
                            {lastResponse.revision.fillerSentencesBefore} → {lastResponse.revision.fillerSentencesAfter}
                          </span>
                        </div>
                        {lastResponse.revision.passesUsed > 1 && (
                          <div className="flex items-center gap-1.5">
                            <Zap size={10} className="text-purple-accent" />
                            <span className="text-[11px] text-text-sec">
                              {lastResponse.revision.passesUsed} passes
                              {lastResponse.revision.restorationPassApplied && ' (incl. restoring dropped content)'}
                            </span>
                          </div>
                        )}
                        {lastResponse.processingTimeMs > 0 && (
                          <div className="text-[11px] text-text-mut">{lastResponse.processingTimeMs}ms generation time</div>
                        )}
                      </>
                    ) : (
                      <p className="text-[12px] text-text-mut leading-relaxed">No revision summary for this result.</p>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  )
}

export default EditorPage
