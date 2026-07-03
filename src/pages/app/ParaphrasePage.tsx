import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RefreshCw, ArrowLeftRight, Copy, RotateCcw, Check,
  Upload, Pencil, Sparkles, Briefcase, GraduationCap,
  AlignLeft, Maximize2, Minimize2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useParaphraseStore } from '../../store/paraphraseStore'
import { useParaphrase } from '../../hooks/useParaphrase'
import { useDragDrop } from '../../hooks/useDragDrop'
import { DropOverlay } from '../../components/ui/DropOverlay'
import { SendToMenu } from '../../components/ui/SendToMenu'
import { useToolTransferStore } from '../../store/toolTransferStore'
import type { ParaphraseMode, ParaphraseStrength, SentencePair } from '../../types/paraphrase'
import { cn } from '../../lib/utils'

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
    <div className="flex-1 overflow-y-auto px-5 py-4 text-sm text-gray-800 leading-relaxed">
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
    <p className="text-sm leading-relaxed text-gray-800 whitespace-pre-wrap select-text">
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
      <ArrowLeftRight className="w-8 h-8 text-gray-300" />
      <div>
        <p className="text-sm font-medium text-gray-600">Paraphrased output</p>
        <p className="text-xs text-gray-400 mt-1 leading-relaxed max-w-[200px]">
          Paste your text on the left and hit Paraphrase.
        </p>
      </div>
      {/* Diff skeleton — shows the word-swap mental model */}
      <div className="w-full max-w-xs mt-1 opacity-35 text-left">
        <div className="p-3 rounded-lg border border-gray-100 bg-gray-50 text-xs leading-6 text-gray-400">
          The{' '}
          <span className="bg-blue-50 text-blue-400 px-0.5 rounded line-through">quick</span>{' '}
          <span className="bg-blue-50 text-blue-500 px-0.5 rounded font-medium">rapid</span>{' '}
          brown fox{' '}
          <span className="bg-blue-50 text-blue-400 px-0.5 rounded line-through">jumps</span>{' '}
          <span className="bg-blue-50 text-blue-500 px-0.5 rounded font-medium">leaps</span>{' '}
          over the lazy dog.
        </div>
        <p className="text-[10px] text-gray-300 mt-1.5 text-center">Changed words highlighted</p>
      </div>
    </div>
  )
}

// ── Main ParaphrasePage ───────────────────────────────────────────────────────

export default function ParaphrasePage() {
  const {
    inputText, outputText, selectedMode, selectedStrength,
    isLoading, lastResponse,
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
    <div className="min-h-0 bg-transparent px-4 py-6 w-full space-y-4">

      {/* Mode tab bar + strength selector */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">

        {/* Mode tabs — text only, underline active */}
        <div className="border-b border-gray-100">
          <div className="flex gap-0 px-4 overflow-x-auto scrollbar-none">
            {MODES.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={cn(
                  'px-4 py-3 text-sm border-b-2 transition-colors whitespace-nowrap',
                  selectedMode === m.id
                    ? 'border-blue-600 text-gray-900 font-medium'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="px-5 py-1.5 text-xs text-gray-400">{activeMode.desc}</p>
        </div>

        {/* Strength selector */}
        <div className="flex items-center gap-3 px-4 py-2.5">
          <div className="flex gap-0 p-0.5 bg-gray-100 rounded-lg">
            {STRENGTHS.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStrength(s.id)}
                className={cn(
                  'px-4 py-1.5 rounded-md text-sm transition-colors',
                  selectedStrength === s.id
                    ? 'bg-white text-gray-900 font-medium shadow-sm'
                    : 'text-gray-400 hover:text-gray-600'
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-400">{activeStrength.desc}</span>
        </div>
      </div>

      {/* Editor panels + contextual sidebar */}
      <div className="flex gap-5 items-start">

        {/* Input / Output grid */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-5 items-start min-w-0">

          {/* Input panel — sticky */}
          <div className="lg:sticky lg:top-4" style={{ height: 'calc(100vh - 7rem)' }}>
            <div
              className="bg-white border border-gray-100 rounded-xl overflow-hidden flex flex-col h-full relative"
              {...dragHandlers}
            >
              {fileInputElement}
              <DropOverlay isDragging={isDragging} isProcessing={isFileProcessing} />

              {/* Input header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 shrink-0">
                <span className="text-sm font-medium text-gray-700">
                  Your text
                  {wordCount > 0 && (
                    <span className="ml-2 text-xs font-normal text-gray-400">{wordCount} words</span>
                  )}
                </span>
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
                  {!inputText && inputEditMode && (
                    <button
                      type="button"
                      onClick={() => setInputText(SAMPLE_TEXT)}
                      className="text-xs text-blue-500 hover:underline transition-colors"
                    >
                      Try sample
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={openFilePicker}
                    disabled={isLoading || isFileProcessing}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40"
                  >
                    <Upload size={11} />
                    Upload
                  </button>
                </div>
              </div>

              {/* Input body */}
              {!inputEditMode && sentenceMap ? (
                <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
                  <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold mb-3">
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
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Paste or type your text here. Minimum 10 words…"
                  className="flex-1 min-h-0 w-full bg-white text-gray-800 placeholder:text-gray-400 resize-none focus:outline-none px-5 py-4 text-sm leading-relaxed"
                />
              )}

              {/* Input footer */}
              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between shrink-0">
                <span className="text-xs text-gray-400">
                  {wordCount > 0 && wordCount < 10
                    ? `${10 - wordCount} more word${10 - wordCount !== 1 ? 's' : ''} needed`
                    : ''}
                </span>
                <div className="flex items-center gap-3">
                  {(inputText || outputText) && (
                    <button
                      type="button"
                      onClick={handleClear}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <RotateCcw size={11} />
                      Clear
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleParaphrase}
                    disabled={!canParaphrase}
                    className={cn(
                      'flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors',
                      !canParaphrase
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                    )}
                  >
                    {isLoading
                      ? <><RefreshCw size={14} className="animate-spin" /> Paraphrasing…</>
                      : 'Paraphrase'
                    }
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Output panel */}
          <div
            ref={outputRef}
            className="bg-white border border-gray-100 rounded-xl overflow-hidden flex flex-col"
            style={{ minHeight: 480 }}
          >
            {/* Output header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 shrink-0">
              <span className="text-sm font-medium text-gray-700">
                {selectedMode} output
                {outputText && (
                  <span className="ml-2 text-xs font-normal text-gray-400">{outputWordCount} words</span>
                )}
              </span>
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
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors"
                  >
                    {copied ? (
                      <><Check size={13} className="text-green-500" /><span className="text-green-500">Copied</span></>
                    ) : (
                      <><Copy size={13} /> Copy</>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Output body */}
            <AnimatePresence mode="wait">
              {!outputText && !isLoading && (
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
                  className="flex-1 flex items-center justify-center gap-3 py-16"
                >
                  {[0, 1, 2].map(i => (
                    <motion.span
                      key={i}
                      className="w-2 h-2 rounded-full bg-blue-400"
                      animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </motion.div>
              )}

              {outputText && !isLoading && (
                <motion.div
                  key="output"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex-1 flex flex-col overflow-hidden"
                >
                  {sentenceMap ? (
                    <>
                      <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold px-5 pt-3 pb-1 shrink-0">
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
                    <div className="flex-1 overflow-y-auto px-5 py-4 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                      {outputText}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Output footer */}
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-end gap-3 shrink-0">
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
              className="hidden lg:flex w-[208px] shrink-0 flex-col bg-white border border-gray-100 rounded-xl overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-gray-100">
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
                    <div className="space-y-1.5 pt-2 border-t border-gray-100">
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
                          <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold mb-1.5">Transform</p>
                          <p className="text-xs text-gray-700 leading-relaxed">{lastResponse.manifest.syntacticChange}</p>
                        </div>
                        {lastResponse.manifest.lexicalUpgrades.length > 0 && (
                          <div>
                            <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold mb-1.5">New vocab</p>
                            <div className="flex flex-wrap gap-1.5">
                              {lastResponse.manifest.lexicalUpgrades.map(w => (
                                <span key={w} className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
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
