import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RefreshCw, ArrowLeftRight, Copy, Check, Download, Eye, EyeOff, MoreHorizontal, Loader2,
  Upload, Clipboard, Pencil, Sparkles, Briefcase, GraduationCap, Wand2,
  AlignLeft, Maximize2, Minimize2, Minus, AlertCircle, ChevronDown,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useParaphraseStore } from '../../store/paraphraseStore'
import { useParaphrase } from '../../hooks/useParaphrase'
import { useDragDrop } from '../../hooks/useDragDrop'
import { DropOverlay } from '../../components/ui/DropOverlay'
import { SendToMenu } from '../../components/ui/SendToMenu'
import { OutputActionButton } from '../../components/ui/OutputActionButton'
import { ClearButton } from '../../components/ui/ClearButton'
import { PanelLabel } from '../../components/ui/PanelLabel'
import { UtilityButton } from '../../components/ui/UtilityButton'
import { Skeleton } from '../../components/ui/Skeleton'
import { ResultsPanelHeader } from '../../components/ui/ResultsPanelHeader'
import { PanelFooterBar } from '../../components/ui/PanelFooterBar'
import { ToolBottomActionRow } from '../../components/ui/ToolBottomActionRow'
import { ToolWorkspaceCard } from '../../components/shared/ToolWorkspaceCard'
import { useToolTransferStore } from '../../store/toolTransferStore'
import type { ParaphraseMode, ParaphraseStrength, ParaphraseLength, SentencePair } from '../../types/paraphrase'
import { cn, formatNumber } from '../../lib/utils'

// ── Config ────────────────────────────────────────────────────────────────────

// Tone — the 5 register/voice modes. Length (below) is now a genuinely independent
// backend parameter (ParaphrasePromptBuilder composes a tone system prompt with a
// length instruction block), so any tone can be paired with any length.
const TONE_MODES: { id: ParaphraseMode; label: string; desc: string; Icon: React.ElementType }[] = [
  { id: 'Standard', label: 'Standard', desc: 'Same meaning, different wording.',        Icon: RefreshCw     },
  { id: 'Fluency',  label: 'Fluency',  desc: 'Smoother, more natural phrasing.',        Icon: Sparkles      },
  { id: 'Formal',   label: 'Formal',   desc: 'Professional register and tone.',          Icon: Briefcase     },
  { id: 'Academic', label: 'Academic', desc: 'Scholarly language, precise vocabulary.',  Icon: GraduationCap },
  { id: 'Simple',   label: 'Simple',   desc: 'Shorter sentences, everyday words.',       Icon: AlignLeft     },
]

// Length — independent of Tone. "No change" is the default so length isn't a decision
// the user has to make unless they want one.
const LENGTH_OPTIONS: { id: ParaphraseLength; label: string; desc: string; Icon: React.ElementType }[] = [
  { id: 'None',    label: 'No change', desc: 'Keeps the original length.',           Icon: Minus     },
  { id: 'Expand',  label: 'Expand',    desc: 'Adds detail and elaboration.',         Icon: Maximize2 },
  { id: 'Shorten', label: 'Shorten',   desc: 'Reduces length, keeps core meaning.',  Icon: Minimize2 },
]

const STRENGTHS: { id: ParaphraseStrength; label: string; desc: string }[] = [
  { id: 'light',  label: 'Light',   desc: 'Word-level changes only'     },
  { id: 'medium', label: 'Natural', desc: 'Phrase and structure changes' },
  { id: 'heavy',  label: 'Full',    desc: 'Full sentence restructure'   },
]

const SAMPLE_TEXT =
  `Artificial intelligence has transformed the way organisations approach problem-solving. Furthermore, the utilisation of machine learning algorithms enables companies to process vast amounts of data with unprecedented efficiency. It is important to note that these technological advancements present both opportunities and challenges for contemporary society.`

// Same size as the Humaniser's output-toolbar buttons, so the two pages share one set of targets.
const OUTPUT_BTN_SIZE = 'h-8 px-3 gap-1.5 text-[13px] rounded-lg'

// ── Types ─────────────────────────────────────────────────────────────────────

interface WordToken {
  word: string
  changed: boolean
}

// ── Word diff (client-side LCS) ───────────────────────────────────────────────

function computeWordDiff(original: string, paraphrased: string): WordToken[] {
  const origWords = original.trim().split(/\s+/).filter(Boolean)
  const paraWords = paraphrased.trim().split(/\s+/).filter(Boolean)
  const m = origWords.length
  const n = paraWords.length

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = origWords[i - 1].toLowerCase() === paraWords[j - 1].toLowerCase()
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1])

  const inLCS = new Set<number>()
  let i = m, j = n
  while (i > 0 && j > 0) {
    if (origWords[i - 1].toLowerCase() === paraWords[j - 1].toLowerCase()) {
      inLCS.add(j - 1); i--; j--
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--
    } else {
      j--
    }
  }

  return paraWords.map((word, idx) => ({
    word: idx === 0 ? word : ' ' + word,
    changed: !inLCS.has(idx),
  }))
}

// ── DiffOutput ────────────────────────────────────────────────────────────────

// Changed words use the same green as the Humaniser's "added" highlight, so a changed word
// looks the same on both pages.
function DiffOutput({ tokens }: { tokens: WordToken[] }) {
  return (
    <p className="textarea-body text-text-pri whitespace-pre-wrap">
      {tokens.map((token, idx) =>
        token.changed ? (
          <mark key={idx} className="bg-emerald-100 text-emerald-800 rounded px-0.5 not-italic font-normal">
            {token.word}
          </mark>
        ) : (
          <span key={idx}>{token.word}</span>
        )
      )}
    </p>
  )
}

// ── SentenceSpanView ──────────────────────────────────────────────────────────

function SentenceSpanView({
  pairs, field, hoveredIdx, onHover,
}: {
  pairs: SentencePair[]
  field: 'original' | 'rewritten'
  hoveredIdx: number | null
  onHover: (idx: number | null) => void
}) {
  return (
    <p className="textarea-body text-text-pri whitespace-pre-wrap select-text">
      {pairs.map((pair, i) => (
        <span
          key={i}
          onMouseEnter={() => onHover(i)}
          onMouseLeave={() => onHover(null)}
          className={cn('cursor-default rounded-sm transition-colors', hoveredIdx === i && 'bg-purple-tint border-b-2 border-purple-accent/40 pb-px')}
        >
          {pair[field]}{' '}
        </span>
      ))}
    </p>
  )
}

// ── OutputEmptyState ──────────────────────────────────────────────────────────

function OutputEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
      <div className="w-9 h-9 rounded-xl bg-purple-50 border border-[#c4b5fd] flex items-center justify-center">
        <ArrowLeftRight size={16} className="text-purple-accent opacity-70" />
      </div>
      <div>
        <p className="text-[14px] font-medium text-text-sec">Paraphrased text will appear here</p>
        <p className="text-[12px] text-text-mut mt-1 max-w-[220px] leading-relaxed">
          Rewrites your text with different wording while preserving meaning — paste your writing and click Paraphrase.
        </p>
      </div>
      {/* Diff skeleton — shows the word-swap mental model */}
      <div className="w-full max-w-xs mt-1 opacity-60 text-left">
        <div className="p-3 rounded-lg border border-[#e0e0da] bg-[#f8fafc] text-xs leading-6 text-text-mut">
          The{' '}
          <span className="bg-purple-50 text-purple-300 px-0.5 rounded line-through">quick</span>{' '}
          <span className="bg-purple-50 text-purple-700 px-0.5 rounded font-medium">rapid</span>{' '}
          brown fox{' '}
          <span className="bg-purple-50 text-purple-300 px-0.5 rounded line-through">jumps</span>{' '}
          <span className="bg-purple-50 text-purple-700 px-0.5 rounded font-medium">leaps</span>{' '}
          over the lazy dog.
        </div>
        <p className="text-[10px] text-text-mut mt-1.5 text-center">Changed words highlighted</p>
      </div>
    </div>
  )
}

// ── Main ParaphrasePage ───────────────────────────────────────────────────────

export default function ParaphrasePage() {
  const {
    inputText, outputText, selectedMode, selectedStrength, selectedLength,
    isLoading, lastResponse, error,
    setInputText, setMode, setStrength, setLength, reset,
  } = useParaphraseStore()

  const { paraphrase } = useParaphrase()
  const [hoveredIdx, setHoveredIdx]       = useState<number | null>(null)
  const [inputEditMode, setInputEditMode] = useState(true)
  const [copied, setCopied]               = useState(false)
  const [overflowOpen, setOverflowOpen]   = useState(false)
  const [mobileView, setMobileView]       = useState<'original' | 'paraphrased'>('original')
  const [showDiff, setShowDiff]           = useState(() => {
    try { const saved = sessionStorage.getItem('paraphrase_show_diff'); return saved === null ? true : saved === '1' }
    catch { return true }
  })
  const copyTimer                          = useRef<ReturnType<typeof setTimeout> | null>(null)
  const outputRef                          = useRef<HTMLDivElement>(null)
  const overflowRef                        = useRef<HTMLDivElement>(null)

  const { isDragging, isProcessing: isFileProcessing, dragHandlers, openFilePicker, fileInputElement } = useDragDrop({
    onText: (t) => setInputText(t),
    disabled: isLoading,
  })

  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      setInputText(text)
      toast.success('Pasted from clipboard!')
    } catch {
      toast.error('Clipboard access denied')
    }
  }, [setInputText])

  useEffect(() => {
    // Query param pre-fill (from AI Detector "Humanise this sentence" CTA)
    const params = new URLSearchParams(window.location.search)
    const prefill = params.get('text')
    if (prefill) {
      setInputText(prefill)
      const modeParam = params.get('mode')
      if (modeParam) {
        const key = modeParam.toLowerCase()
        if (key === 'expand' || key === 'shorten') {
          // Legacy deep links used mode=expand/shorten as a standalone mode — map onto the
          // independent Length field instead so the Tone row still shows something selected.
          setLength(key === 'expand' ? 'Expand' : 'Shorten')
        } else {
          const normalised = (modeParam.charAt(0).toUpperCase() + modeParam.slice(1).toLowerCase()) as ParaphraseMode
          if (TONE_MODES.some(m => m.id === normalised)) setMode(normalised)
        }
      }
      window.history.replaceState({}, '', '/app/paraphrase')
      return
    }

    // Tool transfer store (SendToMenu / other in-app transfers)
    const { text, clearTransfer } = useToolTransferStore.getState()
    if (text) {
      setInputText(text)
      clearTransfer()
      toast('Text transferred — ready to paraphrase!', { icon: '🔄' })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (lastResponse?.manifest?.sentenceMap?.length) {
      setInputEditMode(false)
      setHoveredIdx(null)
    }
  }, [lastResponse])

  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current) }, [])

  useEffect(() => {
    try { sessionStorage.setItem('paraphrase_show_diff', showDiff ? '1' : '0') } catch { /* storage unavailable — preference just won't persist */ }
  }, [showDiff])

  const sentenceMap     = lastResponse?.manifest?.sentenceMap ?? null
  const inputWordCount  = inputText.trim().split(/\s+/).filter(Boolean).length
  const outputWordCount = outputText.trim().split(/\s+/).filter(Boolean).length
  const canParaphrase   = inputWordCount >= 10 && !isLoading
  const hasOutput       = !!outputText && !isLoading && !error
  const [toneMenuOpen, setToneMenuOpen] = useState(false)
  const toneMenuRef     = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!toneMenuOpen) return
    const onDown = (e: MouseEvent) => {
      if (!toneMenuRef.current?.contains(e.target as Node)) setToneMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [toneMenuOpen])
  useEffect(() => {
    if (!overflowOpen) return
    const onDown = (e: MouseEvent) => {
      if (!overflowRef.current?.contains(e.target as Node)) setOverflowOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [overflowOpen])

  const activeMode      = TONE_MODES.find(m => m.id === selectedMode) ?? TONE_MODES[0]

  // Word diff — prefer backend tokens if available, fall back to client-side LCS
  const wordDiffTokens = outputText && !sentenceMap
    ? (lastResponse?.wordDiff?.length
        ? lastResponse.wordDiff
        : computeWordDiff(lastResponse?.originalText ?? inputText, outputText))
    : null
  const changedWordPct = useMemo(() => {
    if (!wordDiffTokens || wordDiffTokens.length === 0) return 0
    return Math.round((wordDiffTokens.filter(t => t.changed).length / wordDiffTokens.length) * 100)
  }, [wordDiffTokens])

  const handleParaphrase = useCallback(async () => {
    if (!canParaphrase) return
    const result = await paraphrase(inputText, selectedMode, selectedStrength, true, selectedLength)
    if (result) {
      setMobileView('paraphrased')
    }
  }, [canParaphrase, paraphrase, inputText, selectedMode, selectedStrength, selectedLength])

  const handleUseAsInput = useCallback(() => {
    const text = outputText
    reset()
    setInputText(text)
    setInputEditMode(true)
    setHoveredIdx(null)
    setMobileView('original')
  }, [outputText, reset, setInputText])

  const handleCopy = useCallback(async () => {
    if (!outputText) return
    try {
      await navigator.clipboard.writeText(outputText)
    } catch {
      toast.error('Failed to copy to clipboard')
      return
    }
    setCopied(true)
    if (copyTimer.current) clearTimeout(copyTimer.current)
    copyTimer.current = setTimeout(() => setCopied(false), 2000)
  }, [outputText])

  const handleDownload = useCallback(() => {
    if (!outputText) return
    const blob = new Blob([outputText], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'paraphrased-text.txt'; a.click()
    URL.revokeObjectURL(url)
    toast.success('Downloaded successfully!')
  }, [outputText])

  const handleClear = useCallback(() => {
    reset()
    setInputEditMode(true)
    setHoveredIdx(null)
    setMobileView('original')
  }, [reset])

  // Same shortcuts as the Humaniser: Ctrl/Cmd+Enter runs, Ctrl+Shift+C copies, Ctrl+Shift+X clears.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); void handleParaphrase(); return }
      if (e.ctrlKey && e.shiftKey && e.key === 'C')      { e.preventDefault(); void handleCopy(); return }
      if (e.ctrlKey && e.shiftKey && e.key === 'X')      { e.preventDefault(); handleClear() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleParaphrase, handleCopy, handleClear])

  // Same compact controls strip as the Humaniser: shown only once there is text to rewrite
  // (so the empty page stays quiet), purple-filled selected state, 13px labels. Tone is the one
  // control with enough options for a dropdown; Length and Intensity have three options each, so
  // they stay visible as pills with their descriptions in tooltips. Tone and Length are independent
  // backend parameters (composed server-side by ParaphrasePromptBuilder), so picking one never
  // deselects the other.
  const pillClass = (active: boolean) => cn(
    'px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150 border whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed',
    active
      ? 'bg-purple-accent text-white border-purple-accent shadow-sm'
      : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300 hover:text-neutral-900',
  )
  const groupLabelClass = 'text-[12px] font-semibold text-neutral-500 uppercase tracking-wider shrink-0'

  const toggleBar = (
    <div className="bg-neutral-100 rounded-xl px-4 py-3 flex items-center flex-wrap gap-x-4 gap-y-2">

      {/* Tone — dropdown */}
      <div className="flex items-center gap-2">
        <span className={groupLabelClass}>Tone</span>
        <div className="relative" ref={toneMenuRef}>
          <button
            type="button"
            onClick={() => setToneMenuOpen(v => !v)}
            disabled={isLoading}
            aria-haspopup="listbox"
            aria-expanded={toneMenuOpen}
            title={activeMode.desc}
            className={cn(pillClass(selectedMode !== 'Standard'), 'inline-flex items-center gap-1.5')}
          >
            {activeMode.label}
            <ChevronDown size={14} className={cn('transition-transform duration-150', toneMenuOpen && 'rotate-180')} />
          </button>

          {toneMenuOpen && (
            <div role="listbox" aria-label="Tone" className="absolute z-30 top-full mt-1.5 left-0 w-64 bg-white border border-gray-200 rounded-xl shadow-elevated overflow-hidden py-1">
              {TONE_MODES.map(m => (
                <button
                  key={m.id}
                  type="button"
                  role="option"
                  aria-selected={selectedMode === m.id}
                  onClick={() => { setMode(m.id); setToneMenuOpen(false) }}
                  className={cn('flex flex-col items-start w-full px-3 py-2 text-left transition-colors', selectedMode === m.id ? 'bg-purple-50' : 'hover:bg-gray-50')}
                >
                  <span className="text-[13px] font-medium text-gray-800">{m.label}</span>
                  <span className="text-[11px] text-gray-500">{m.desc}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="hidden sm:block w-px h-5 bg-neutral-200" />

      {/* Length — pills */}
      <div className="flex items-center gap-2">
        <span className={groupLabelClass}>Length</span>
        <div role="radiogroup" aria-label="Length" className="flex items-center gap-1.5 flex-wrap">
          {LENGTH_OPTIONS.map(l => (
            <button
              key={l.id}
              type="button"
              role="radio"
              aria-checked={selectedLength === l.id}
              onClick={() => setLength(l.id)}
              disabled={isLoading}
              title={l.desc}
              className={pillClass(selectedLength === l.id)}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div className="hidden sm:block w-px h-5 bg-neutral-200" />

      {/* Intensity — pills */}
      <div className="flex items-center gap-2">
        <span className={groupLabelClass}>Rewrite</span>
        <div role="radiogroup" aria-label="Rewrite strength" className="flex items-center gap-1.5 flex-wrap">
          {STRENGTHS.map(s => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={selectedStrength === s.id}
              onClick={() => setStrength(s.id)}
              disabled={isLoading}
              title={s.desc}
              className={pillClass(selectedStrength === s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  // Mobile Original / Paraphrased switch — only once there is a result to switch to.
  const mobileTabs = hasOutput ? (
    <div role="tablist" aria-label="View" className="flex items-center gap-1.5">
      {([['paraphrased', 'Paraphrased'], ['original', 'Original']] as const).map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={mobileView === id}
          onClick={() => setMobileView(id)}
          className={cn('px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors',
            mobileView === id ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600')}
        >
          {label}
        </button>
      ))}
    </div>
  ) : null

  const leftPanel = {
    header: (
      <ResultsPanelHeader
        title={
          <div className="flex items-center justify-between w-full">
            <PanelLabel label="Original" />
            {!inputEditMode && sentenceMap && (
              <button
                type="button"
                onClick={() => setInputEditMode(true)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors"
              >
                <Pencil size={11} />
                Edit
              </button>
            )}
          </div>
        }
      />
    ),
    body: (
      <div className="flex-1 min-h-0 flex flex-col relative" {...dragHandlers}>
        {fileInputElement}
        <DropOverlay isDragging={isDragging} isProcessing={isFileProcessing} />
        {!inputEditMode && sentenceMap ? (
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3">
            <p className="text-[12px] text-text-mut uppercase tracking-wider font-semibold mb-3">
              Hover to highlight counterpart
            </p>
            <SentenceSpanView
              pairs={sentenceMap}
              field="original"
              hoveredIdx={hoveredIdx}
              onHover={setHoveredIdx}
            />
          </div>
        ) : (
          <div className="relative flex-1 min-h-0">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isLoading}
              aria-label="Original text"
              className="textarea-body absolute inset-0 w-full h-full bg-transparent text-text-pri px-5 py-3 resize-none outline-none focus:ring-2 focus:ring-inset focus:ring-purple-accent/30 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
            />
            {!inputText && (
              <div className="textarea-body pointer-events-none absolute inset-0 px-5 py-3 text-text-mut select-none">
                Paste your writing here (minimum 10 words), or{' '}
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
        )}
      </div>
    ),
    // Same bottom rows as the Humaniser: word count + Paste/Upload, then Clear opposite the primary
    // action. Send to / Use as input moved into the output panel's "More" menu.
    footer: (
      <>
        <PanelFooterBar
          metadata={
            <span className={cn('text-xs font-normal tabular-nums',
              inputWordCount > 0 && inputWordCount < 10 ? 'text-amber-600' : 'text-gray-400')}>
              {formatNumber(inputWordCount)} words
              {inputWordCount > 0 && inputWordCount < 10 && ` · ${10 - inputWordCount} more needed`}
            </span>
          }
          actions={
            <>
              <UtilityButton
                icon={<Clipboard size={14} />}
                label="Paste"
                className="h-8 px-3 text-[13px]"
                onClick={handlePasteFromClipboard}
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
        <ToolBottomActionRow
          clearButton={<ClearButton onClick={handleClear} disabled={!(inputText || outputText) || isLoading} />}
          primaryButton={
            <button
              type="button"
              onClick={() => void handleParaphrase()}
              disabled={!canParaphrase}
              title="Paraphrase (Ctrl+Enter / Cmd+Enter)"
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all shrink-0',
                isLoading
                  ? 'bg-purple-accent text-white opacity-90 cursor-wait'
                  : !canParaphrase
                  ? 'bg-[#c4b5fd] text-white cursor-not-allowed'
                  : 'bg-purple-accent hover:bg-purple-deep text-white shadow shadow-purple-400/20',
              )}
            >
              {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              {isLoading ? 'Paraphrasing your writing…' : 'Paraphrase'}
            </button>
          }
        />
      </>
    ),
  }

  const rightPanel = {
    header: (
      <ResultsPanelHeader
        tinted={hasOutput}
        title={<PanelLabel label="Paraphrased" colorOverride={hasOutput ? 'var(--color-purple)' : undefined} />}
      />
    ),
    footer: hasOutput && (
      <PanelFooterBar
        metadata={
          <span className="text-xs font-normal tabular-nums text-gray-400">
            {formatNumber(outputWordCount)} words
            {outputWordCount !== inputWordCount && (
              <span> · {outputWordCount > inputWordCount ? '+' : '−'}{formatNumber(Math.abs(outputWordCount - inputWordCount))} vs original</span>
            )}
          </span>
        }
        actions={
          <>
            {!sentenceMap && wordDiffTokens && (
              <OutputActionButton
                icon={showDiff ? <EyeOff size={14} /> : <Eye size={14} />}
                onClick={() => setShowDiff(v => !v)}
                aria-pressed={showDiff}
                className={cn(OUTPUT_BTN_SIZE, showDiff && 'bg-emerald-50 border-emerald-300 text-emerald-700')}
                title="Highlights the words that changed"
              >
                {showDiff ? 'Hide changes' : 'Show changes'}
              </OutputActionButton>
            )}
            <OutputActionButton
              icon={<RefreshCw size={14} />}
              onClick={() => void handleParaphrase()}
              disabled={isLoading}
              className={OUTPUT_BTN_SIZE}
              title="Generate another version"
            >
              Retry
            </OutputActionButton>
            <OutputActionButton
              icon={copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              onClick={() => void handleCopy()}
              className={OUTPUT_BTN_SIZE}
              title="Copy result (Ctrl+Shift+C)"
            >
              {copied ? <span className="text-emerald-600">Copied</span> : 'Copy'}
            </OutputActionButton>
            <div className="relative" ref={overflowRef}>
              <OutputActionButton
                icon={<MoreHorizontal size={16} />}
                className={cn(OUTPUT_BTN_SIZE, 'w-8 justify-center px-0')}
                onClick={() => setOverflowOpen(v => !v)}
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
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { handleUseAsInput(); setOverflowOpen(false) }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                  >
                    <RefreshCw size={12} className="text-gray-400 shrink-0" /> Use as input
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
    ),
    body: (
      <div
        ref={outputRef}
        className="flex-1 min-h-0 overflow-y-auto px-5 py-3"
        aria-live="polite"
        aria-label="Paraphrased text output"
      >
        <AnimatePresence mode="wait">
          {!outputText && !isLoading && !error && (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <OutputEmptyState />
            </motion.div>
          )}

          {isLoading && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 pt-1">
              <div className="flex items-center gap-2 mb-4">
                <Loader2 size={14} className="animate-spin text-purple-accent" />
                <span className="text-sm text-purple-accent font-medium">Paraphrasing your writing…</span>
              </div>
              <Skeleton variant="text" tone="light" lines={8} />
            </motion.div>
          )}

          {!isLoading && error && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-full gap-3 text-center px-8"
            >
              <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center">
                <AlertCircle size={16} className="text-red-500" />
              </div>
              <div>
                <p className="text-[14px] font-medium text-text-sec">Couldn't paraphrase your text</p>
                <p className="text-[12px] text-text-mut mt-1 max-w-[240px] leading-relaxed">{error}</p>
              </div>
              <button
                type="button"
                onClick={() => void handleParaphrase()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-purple-accent hover:bg-purple-deep text-white transition-colors"
              >
                <Wand2 size={12} /> Retry
              </button>
            </motion.div>
          )}

          {hasOutput && (
            <motion.div key="output" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="space-y-3">
              {sentenceMap ? (
                <>
                  <p className="text-[12px] text-text-mut uppercase tracking-wider font-semibold">
                    Hover a sentence to highlight its counterpart
                  </p>
                  <SentenceSpanView
                    pairs={sentenceMap}
                    field="rewritten"
                    hoveredIdx={hoveredIdx}
                    onHover={setHoveredIdx}
                  />
                </>
              ) : wordDiffTokens && showDiff ? (
                <>
                  <DiffOutput tokens={wordDiffTokens} />
                  <p className="text-[11px] text-text-mut pt-1">
                    <span className="inline-block w-2 h-2 rounded-sm bg-emerald-100 mr-1" />
                    Changed words &nbsp;·&nbsp; {changedWordPct}% of words reworded
                  </p>
                </>
              ) : (
                <p className="textarea-body text-text-pri whitespace-pre-wrap">{outputText}</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    ),
  }

  return (
    <div className="min-h-0 bg-transparent px-4 py-6 w-full">
      <ToolWorkspaceCard
        className="lg:sticky lg:top-4"
        style={{ height: 'calc(100vh - 7rem)' }}
        toggleBar={inputText ? toggleBar : undefined}
        mobileTabs={mobileTabs}
        mobilePanel={hasOutput ? (mobileView === 'original' ? 'left' : 'right') : undefined}
        leftPanel={leftPanel}
        rightPanel={rightPanel}
      />
    </div>
  )
}
