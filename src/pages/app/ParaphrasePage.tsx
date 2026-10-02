import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RefreshCw, ArrowLeftRight, Copy, Check,
  Upload, Clipboard, Pencil, Sparkles, Briefcase, GraduationCap,
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
import { cn, primaryButtonClass } from '../../lib/utils'

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
    inputText, outputText, selectedMode, selectedStrength, selectedLength,
    isLoading, lastResponse, error,
    setInputText, setMode, setStrength, setLength, reset,
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

  const sentenceMap     = lastResponse?.manifest?.sentenceMap ?? null
  const wordCount       = inputText.trim().split(/\s+/).filter(Boolean).length
  const canParaphrase   = wordCount >= 10 && !isLoading
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

  const activeMode      = TONE_MODES.find(m => m.id === selectedMode) ?? TONE_MODES[0]

  // Word diff — prefer backend tokens if available, fall back to client-side LCS
  const wordDiffTokens = outputText && !sentenceMap
    ? (lastResponse?.wordDiff?.length
        ? lastResponse.wordDiff
        : computeWordDiff(lastResponse?.originalText ?? inputText, outputText))
    : null

  const handleParaphrase = async () => {
    if (!canParaphrase) return
    const result = await paraphrase(inputText, selectedMode, selectedStrength, true, selectedLength)
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

  // One compact row, matching the Humaniser toolbar: Tone is the only control
  // with enough options to warrant a dropdown (its descriptions live in the menu);
  // Length and Intensity have three options each, so they stay visible as pills
  // with their descriptions in tooltips. Tone and Length are independent backend
  // parameters (composed server-side by ParaphrasePromptBuilder), so picking one
  // never deselects the other.
  const pillClass = (active: boolean) => cn(
    'px-4 h-9 flex items-center rounded-lg text-[14px] font-medium transition-all duration-150 border whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed',
    active
      ? 'bg-neutral-900 text-white border-neutral-900 shadow-sm'
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
            className={cn(pillClass(false), 'gap-1.5 min-w-[7.5rem] justify-between')}
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
        <span className={groupLabelClass}>Intensity</span>
        <div role="radiogroup" aria-label="Intensity" className="flex items-center gap-1.5 flex-wrap">
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

  const leftPanel = {
    header: (
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#e0e0da] shrink-0">
        <PanelLabel label="Your text" />
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
    ),
    body: (
      <div className="flex-1 min-h-0 flex flex-col relative" {...dragHandlers}>
        {fileInputElement}
        <DropOverlay isDragging={isDragging} isProcessing={isFileProcessing} />
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
      </div>
    ),
    // Single shared bottom row for the whole editing surface (Humaniser/Detector
    // pattern): Clear + hint on the left, Send to / Use as input / primary
    // Paraphrase action on the right, rather than a second bar under the output panel.
    footer: (
      <>
        <PanelFooterBar
          metadata={<span className="text-xs font-normal tabular-nums text-gray-400">{wordCount} words</span>}
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
          clearButton={<ClearButton onClick={handleClear} disabled={!(inputText || outputText)} />}
          hint={wordCount > 0 && wordCount < 10
            ? `${10 - wordCount} more word${10 - wordCount !== 1 ? 's' : ''} needed`
            : undefined}
          primaryButton={
            <div className="flex items-center gap-3">
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
          }
        />
      </>
    ),
  }

  const rightPanel = {
    header: (
      <ResultsPanelHeader
        title={<PanelLabel label="Paraphrased Output" />}
      />
    ),
    footer: outputText && (
      <PanelFooterBar
        actions={
          <>
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
          </>
        }
      />
    ),
    body: (
      <div ref={outputRef} className="flex-1 min-h-0 flex flex-col">
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
      </div>
    ),
  }

  return (
    <div className="min-h-0 bg-transparent px-4 py-6 w-full">
      <ToolWorkspaceCard
        className="lg:sticky lg:top-4"
        style={{ height: 'calc(100vh - 7rem)' }}
        toggleBar={toggleBar}
        leftPanel={leftPanel}
        rightPanel={rightPanel}
      />
    </div>
  )
}
