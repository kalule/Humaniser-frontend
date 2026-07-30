import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RefreshCw, ArrowLeftRight, Copy, Check,
  Upload, Clipboard, Pencil, Sparkles, Briefcase, GraduationCap,
  AlignLeft, Maximize2, Minimize2, AlertCircle,
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
import { useToolTransferStore } from '../../store/toolTransferStore'
import type { ParaphraseMode, ParaphraseStrength, SentencePair } from '../../types/paraphrase'
import { cn, primaryButtonClass } from '../../lib/utils'

// ── Config ────────────────────────────────────────────────────────────────────

const MODES: { id: ParaphraseMode; label: string; desc: string; Icon: React.ElementType }[] = [
  { id: 'Standard', label: 'Standard', desc: 'Same meaning, different wording.',        Icon: RefreshCw     },
  { id: 'Fluency',  label: 'Fluency',  desc: 'Smoother, more natural phrasing.',        Icon: Sparkles      },
  { id: 'Formal',   label: 'Formal',   desc: 'Professional register and tone.',          Icon: Briefcase     },
  { id: 'Academic', label: 'Academic', desc: 'Scholarly language, precise vocabulary.',  Icon: GraduationCap },
  { id: 'Simple',   label: 'Simple',   desc: 'Shorter sentences, everyday words.',       Icon: AlignLeft     },
  { id: 'Expand',   label: 'Expand',   desc: 'Adds detail and elaboration.',             Icon: Maximize2     },
  { id: 'Shorten',  label: 'Shorten',  desc: 'Reduces length, keeps core meaning.',     Icon: Minimize2     },
]

const STRENGTHS: { id: ParaphraseStrength; label: string; desc: string }[] = [
  { id: 'light',  label: 'Light',  desc: 'Word-level changes only'     },
  { id: 'medium', label: 'Medium', desc: 'Phrase and structure changes' },
  { id: 'heavy',  label: 'Heavy',  desc: 'Full sentence restructure'   },
]

const SAMPLE_TEXT =
  `Artificial intelligence has transformed the way organisations approach problem-solving. Furthermore, the utilisation of machine learning algorithms enables companies to process vast amounts of data with unprecedented efficiency. It is important to note that these technological advancements present both opportunities and challenges for contemporary society.`

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

function DiffOutput({ tokens }: { tokens: WordToken[] }) {
  return (
    <div className="textarea-body flex-1 overflow-y-auto px-5 py-4 text-gray-800">
      <p className="whitespace-pre-wrap">
        {tokens.map((token, idx) =>
          token.changed ? (
            <mark
              key={idx}
              className="bg-blue-50 text-blue-700 rounded px-0.5 not-italic font-normal"
            >
              {token.word}
            </mark>
          ) : (
            <span key={idx}>{token.word}</span>
          )
        )}
      </p>
    </div>
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
    <p className="textarea-body text-gray-800 whitespace-pre-wrap select-text">
      {pairs.map((pair, i) => (
        <span
          key={i}
          onMouseEnter={() => onHover(i)}
          onMouseLeave={() => onHover(null)}
          style={hoveredIdx === i ? {
            backgroundColor: 'rgba(219,234,254,0.7)',
            borderBottom: '2px solid rgba(59,130,246,0.4)',
            borderRadius: '2px',
            paddingBottom: '1px',
            cursor: 'default',
          } : { cursor: 'default' }}
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
    <div className="flex flex-col items-center justify-center h-full px-8 py-10 gap-4 text-center">
      <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center">
        <ArrowLeftRight className="w-4 h-4 text-blue-500 opacity-70" />
      </div>
      <div>
        <p className="text-[14px] font-medium text-gray-600">Paraphrased text will appear here</p>
        <p className="text-[12px] text-gray-400 mt-1 max-w-[220px] leading-relaxed">
          Rewrites your text with different wording while preserving meaning — choose a mode and intensity, then click Paraphrase.
        </p>
      </div>
      {/* Diff skeleton — shows the word-swap mental model */}
      <div className="w-full max-w-xs mt-1 opacity-60 text-left">
        <div className="p-3 rounded-lg border border-[#e0e0da] bg-gray-50 text-xs leading-6 text-gray-400">
          The{' '}
          <span className="bg-blue-50 text-blue-400 px-0.5 rounded line-through">quick</span>{' '}
          <span className="bg-blue-50 text-blue-700 px-0.5 rounded font-medium">rapid</span>{' '}
          brown fox{' '}
          <span className="bg-blue-50 text-blue-400 px-0.5 rounded line-through">jumps</span>{' '}
          <span className="bg-blue-50 text-blue-700 px-0.5 rounded font-medium">leaps</span>{' '}
          over the lazy dog.
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5 text-center">Changed words highlighted</p>
      </div>
    </div>
  )
}

// ── Main ParaphrasePage ───────────────────────────────────────────────────────

export default function ParaphrasePage() {
  const {
    inputText, outputText, selectedMode, selectedStrength,
    isLoading, lastResponse, error,
    setInputText, setMode, setStrength, reset,
  } = useParaphraseStore()

  const { paraphrase } = useParaphrase()
  const [hoveredIdx, setHoveredIdx]       = useState<number | null>(null)
  const [inputEditMode, setInputEditMode] = useState(true)
  const [copied, setCopied]               = useState(false)
  const copyTimer                          = useRef<ReturnType<typeof setTimeout> | null>(null)
  const outputRef                          = useRef<HTMLDivElement>(null)

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
        const normalised = (modeParam.charAt(0).toUpperCase() + modeParam.slice(1).toLowerCase()) as ParaphraseMode
        if (MODES.some(m => m.id === normalised)) setMode(normalised)
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

  const sentenceMap     = lastResponse?.manifest?.sentenceMap ?? null
  const wordCount       = inputText.trim().split(/\s+/).filter(Boolean).length
  const outputWordCount = outputText ? outputText.trim().split(/\s+/).filter(Boolean).length : 0
  const canParaphrase   = wordCount >= 10 && !isLoading
  const activeMode      = MODES.find(m => m.id === selectedMode)!
  const activeStrength  = STRENGTHS.find(s => s.id === selectedStrength)!

  // Word diff — prefer backend tokens if available, fall back to client-side LCS
  const wordDiffTokens = outputText && !sentenceMap
    ? (lastResponse?.wordDiff?.length
        ? lastResponse.wordDiff
        : computeWordDiff(lastResponse?.originalText ?? inputText, outputText))
    : null

  const handleParaphrase = async () => {
    if (!canParaphrase) return
    const result = await paraphrase(inputText, selectedMode, selectedStrength, true)
    if (result) {
      setTimeout(() => outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100)
    }
  }

  const handleUseAsInput = useCallback(() => {
    const text = outputText
    reset()
    setInputText(text)
    setInputEditMode(true)
    setHoveredIdx(null)
  }, [outputText, reset, setInputText])

  const handleCopy = useCallback(async () => {
    if (!outputText) return
    await navigator.clipboard.writeText(outputText)
    setCopied(true)
    if (copyTimer.current) clearTimeout(copyTimer.current)
    copyTimer.current = setTimeout(() => setCopied(false), 2000)
  }, [outputText])

  const handleClear = useCallback(() => {
    reset()
    setInputEditMode(true)
    setHoveredIdx(null)
  }, [reset])

  return (
    <div className="min-h-0 bg-transparent px-4 py-6 w-full lg:h-[calc(100vh-4rem)] flex flex-col gap-4">

      {/* Mode + Intensity — single row, divider communicates intensity modifies mode */}
      <div className="bg-white border border-[#e0e0da] rounded-xl overflow-hidden shrink-0 px-4 py-3">
        <div className="flex flex-col lg:flex-row lg:items-start gap-3 lg:gap-5">

          {/* Mode group */}
          <div className="flex-1 min-w-0">
            <span className="block text-[12px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Mode
            </span>
            <div className="flex flex-wrap gap-1.5 overflow-x-auto scrollbar-none">
              {MODES.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className={cn(
                    'px-4 h-9 flex items-center rounded-lg text-[15px] font-medium transition-colors whitespace-nowrap',
                    selectedMode === m.id
                      ? 'bg-neutral-900 text-white'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1.5">{activeMode.desc}</p>
          </div>

          {/* Divider */}
          <div className="hidden lg:block w-px bg-gray-100 self-stretch" />

          {/* Intensity group — subordinate to Mode */}
          <div className="lg:w-60 shrink-0">
            <span className="block text-[12px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Intensity
            </span>
            <div className="flex gap-0 p-0.5 bg-gray-100 rounded-lg">
              {STRENGTHS.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStrength(s.id)}
                  className={cn(
                    'flex-1 h-9 flex items-center justify-center px-3 rounded-md text-[15px] transition-colors',
                    selectedStrength === s.id
                      ? 'bg-neutral-900 text-white font-medium shadow-sm'
                      : 'text-gray-400 hover:text-gray-600'
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1.5">{activeStrength.desc}</p>
          </div>
        </div>
      </div>

      {/* Editor panels + contextual sidebar */}
      <div className="flex gap-5 items-start lg:flex-1 lg:min-h-0">

        {/* Input / Output grid */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-5 min-w-0 lg:h-full">

          {/* Input panel */}
          <div className="lg:h-full lg:min-h-0">
            <div
              className="bg-white border border-[#e0e0da] rounded-xl overflow-hidden flex flex-col h-full relative"
              {...dragHandlers}
            >
              {fileInputElement}
              <DropOverlay isDragging={isDragging} isProcessing={isFileProcessing} />

              {/* Input header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#e0e0da] shrink-0">
                <PanelLabel label="Your text" count={wordCount} />
                <div className="flex items-center gap-3">
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

              {/* Input body */}
              {!inputEditMode && sentenceMap ? (
                <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
                  <p className="text-[12px] text-gray-400 uppercase tracking-wider font-semibold mb-3">
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
                    className="textarea-body absolute inset-0 w-full h-full bg-white text-gray-800 resize-none outline-none focus:ring-2 focus:ring-inset focus:ring-purple-accent/30 rounded-lg px-5 py-4 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  {!inputText && (
                    <div className="textarea-body pointer-events-none absolute inset-0 px-5 py-4 text-gray-400 select-none">
                      Paste or type your text here. Minimum 10 words, or{' '}
                      <button
                        type="button"
                        onClick={() => setInputText(SAMPLE_TEXT)}
                        className="pointer-events-auto text-purple-accent hover:underline transition-colors"
                      >
                        try a sample
                      </button>
                      .
                    </div>
                  )}
                </div>
              )}

              {/* Input footer */}
              <div className="px-4 py-3 border-t border-[#e0e0da] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <ClearButton onClick={handleClear} disabled={!(inputText || outputText)} />
                  <span className="text-[13px] text-gray-400">
                    {wordCount > 0 && wordCount < 10
                      ? `${10 - wordCount} more word${10 - wordCount !== 1 ? 's' : ''} needed`
                      : ''}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleParaphrase}
                  disabled={!canParaphrase}
                  className={primaryButtonClass(canParaphrase)}
                >
                  {isLoading
                    ? <><RefreshCw size={14} className="animate-spin" /> Paraphrasing…</>
                    : 'Paraphrase'
                  }
                </button>
              </div>
            </div>
          </div>

          {/* Output panel */}
          <div
            ref={outputRef}
            className="bg-white border border-[#e0e0da] rounded-xl overflow-hidden flex flex-col lg:h-full lg:min-h-0"
            style={{ minHeight: 480 }}
          >
            {/* Output header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#e0e0da] shrink-0">
              <div className="flex items-center gap-2">
                <PanelLabel label="Paraphrased Output" />
                {outputText && (
                  <>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 font-medium">
                      {selectedMode} · {activeStrength.label}
                    </span>
                    <span className="text-xs font-normal text-gray-400">{outputWordCount} words</span>
                  </>
                )}
              </div>
              {outputText && (
                <div className="flex items-center gap-2">
                  {/* Regenerate */}
                  <button
                    type="button"
                    onClick={handleParaphrase}
                    title="Generate another version"
                    disabled={isLoading}
                    className="w-7 h-7 flex items-center justify-center rounded-md border border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-400 transition-colors disabled:opacity-40"
                  >
                    <RefreshCw size={13} />
                  </button>
                  {/* Copy */}
                  <OutputActionButton
                    icon={copied ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
                    onClick={handleCopy}
                  >
                    {copied ? <span className="text-green-500">Copied</span> : 'Copy'}
                  </OutputActionButton>
                </div>
              )}
            </div>

            {/* Output body */}
            <AnimatePresence mode="wait">
              {!outputText && !isLoading && !error && (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1"
                >
                  <OutputEmptyState />
                </motion.div>
              )}

              {isLoading && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex-1 px-5 py-4"
                >
                  <Skeleton variant="text" tone="light" lines={8} />
                </motion.div>
              )}

              {!isLoading && error && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex-1 flex flex-col items-center justify-center h-full gap-3 text-center px-8"
                >
                  <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center">
                    <AlertCircle size={16} className="text-red-500" />
                  </div>
                  <div>
                    <p className="text-[14px] font-medium text-gray-600">Couldn't paraphrase your text</p>
                    <p className="text-[12px] text-gray-400 mt-1 max-w-[240px] leading-relaxed">{error}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleParaphrase}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-purple-accent hover:bg-purple-deep text-white transition-colors"
                  >
                    <RefreshCw size={12} /> Retry
                  </button>
                </motion.div>
              )}

              {outputText && !isLoading && !error && (
                <motion.div
                  key="output"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex-1 flex flex-col overflow-hidden"
                >
                  {sentenceMap ? (
                    <>
                      <p className="text-[12px] text-gray-400 uppercase tracking-wider font-semibold px-5 pt-3 pb-1 shrink-0">
                        Hover a sentence to highlight its counterpart
                      </p>
                      <div className="flex-1 overflow-y-auto px-5 py-3">
                        <SentenceSpanView
                          pairs={sentenceMap}
                          field="rewritten"
                          hoveredIdx={hoveredIdx}
                          onHover={setHoveredIdx}
                        />
                      </div>
                    </>
                  ) : wordDiffTokens ? (
                    <DiffOutput tokens={wordDiffTokens} />
                  ) : (
                    <div className="textarea-body flex-1 overflow-y-auto px-5 py-4 text-gray-800 whitespace-pre-wrap">
                      {outputText}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Output footer */}
            <div className="px-4 py-3 border-t border-[#e0e0da] flex items-center justify-end gap-3 shrink-0">
              {outputText && (
                <>
                  <SendToMenu text={outputText} />
                  <button
                    type="button"
                    onClick={handleUseAsInput}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors"
                  >
                    <RefreshCw size={12} />
                    Use as input
                  </button>
                </>
              )}
            </div>
          </div>

        </div>
        {/* end input/output grid */}

        {/* Contextual sidebar — Result stats + manifest (desktop only) */}
        <AnimatePresence>
          {(outputText || isLoading) && (
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.25 }}
              className="hidden lg:flex w-[208px] shrink-0 flex-col bg-white border border-[#e0e0da] rounded-xl overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-[#e0e0da]">
                <span className="text-sm font-semibold text-gray-800">
                  {lastResponse ? 'Result' : 'Mode Info'}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto flex flex-col gap-3 p-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                    <activeMode.Icon size={16} className="text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{selectedMode}</p>
                    <p className="text-xs text-gray-400 capitalize">{selectedStrength}</p>
                  </div>
                </div>

                {lastResponse ? (
                  <>
                    <div className="space-y-1.5 pt-2 border-t border-[#e0e0da]">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Original</span>
                        <span className="text-gray-700 font-medium tabular-nums">{lastResponse.originalWordCount}w</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Result</span>
                        <span className="text-gray-700 font-medium tabular-nums">{lastResponse.paraphrasedWordCount}w</span>
                      </div>
                      {Math.abs(lastResponse.paraphrasedWordCount - lastResponse.originalWordCount) >= 2 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">Change</span>
                          <span className={cn(
                            'font-semibold tabular-nums',
                            lastResponse.paraphrasedWordCount > lastResponse.originalWordCount
                              ? 'text-emerald-500' : 'text-amber-500'
                          )}>
                            {lastResponse.paraphrasedWordCount > lastResponse.originalWordCount ? '+' : ''}
                            {lastResponse.paraphrasedWordCount - lastResponse.originalWordCount}w
                          </span>
                        </div>
                      )}
                    </div>

                    {lastResponse.manifest && (
                      <>
                        <div className="w-full h-px bg-gray-100" />
                        <div>
                          <p className="text-[12px] text-gray-400 uppercase tracking-wider font-semibold mb-1.5">Transform</p>
                          <p className="text-xs text-gray-700 leading-relaxed">{lastResponse.manifest.syntacticChange}</p>
                        </div>
                        {lastResponse.manifest.lexicalUpgrades.length > 0 && (
                          <div>
                            <p className="text-[12px] text-gray-400 uppercase tracking-wider font-semibold mb-1.5">New vocab</p>
                            <div className="flex flex-wrap gap-1.5">
                              {lastResponse.manifest.lexicalUpgrades.map(w => (
                                <span key={w} className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 cursor-default">
                                  {w}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-gray-500 leading-relaxed">{activeMode.desc}</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
      {/* end flex+sidebar wrapper */}

    </div>
  )
}
