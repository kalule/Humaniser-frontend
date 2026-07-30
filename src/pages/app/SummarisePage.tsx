import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Copy, Check, Download, FileText, Wand2, TrendingDown, Layers, Upload, Clipboard, AlertCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useSummariseStore } from '../../store/summariseStore'
import { useSummarise } from '../../hooks/useSummarise'
import { useDragDrop } from '../../hooks/useDragDrop'
import { DropOverlay } from '../../components/ui/DropOverlay'
import { SendToMenu } from '../../components/ui/SendToMenu'
import { OutputActionButton } from '../../components/ui/OutputActionButton'
import { ClearButton } from '../../components/ui/ClearButton'
import { PanelLabel } from '../../components/ui/PanelLabel'
import { UtilityButton } from '../../components/ui/UtilityButton'
import { Skeleton } from '../../components/ui/Skeleton'
import { useToolTransferStore } from '../../store/toolTransferStore'
import {
  SUMMARISE_MODE_LABELS,
  SUMMARISE_MODE_DESCRIPTIONS,
} from '../../types/summarise'
import type { SummariseMode, SummariseLength } from '../../types/summarise'
import { cn, primaryButtonClass, formatDuration } from '../../lib/utils'

// ── Constants ─────────────────────────────────────────────────────────────────

const MODES: SummariseMode[] = [
  'KeyPoints', 'ExecutiveSummary', 'Abstract', 'TlDr', 'MeetingNotes',
]

// ratio/floor mirror the backend's own target formula (SummarisePromptBuilder.cs)
// so the displayed target matches what's actually sent to the model.
const LENGTHS: { id: SummariseLength; label: string; pct: string; ratio: number; floor: number }[] = [
  { id: 'short',    label: 'Short',    pct: '~10–15%', ratio: 0.12, floor: 40 },
  { id: 'medium',   label: 'Medium',   pct: '~25–30%', ratio: 0.27, floor: 70 },
  { id: 'detailed', label: 'Detailed', pct: '~50–60%', ratio: 0.45, floor: 120 },
]

// The model doesn't hit its stated target exactly — observed overshoot is up to ~40%.
// Show a realistic range rather than a false-precision point number.
const TARGET_OVERSHOOT = 1.4

const SAMPLE_TEXT =
  `Artificial intelligence is fundamentally transforming healthcare by enabling faster and more accurate diagnoses, personalising treatment plans, and accelerating drug discovery. Machine learning models can now detect cancers from medical imaging with accuracy matching or exceeding human specialists. Predictive analytics allow clinicians to identify high-risk patients before their conditions deteriorate. In drug development, AI reduces the time to identify promising compounds from years to months. However, significant challenges remain: data privacy concerns, algorithmic bias in underrepresented populations, regulatory uncertainty, and the need for clinical validation. Healthcare institutions must invest in AI literacy among clinicians while ensuring that AI augments rather than replaces human judgment. The most successful implementations combine technical capability with clinical expertise and robust governance frameworks.`

// ── CompressionBadge ──────────────────────────────────────────────────────────

function CompressionBadge({ original, summary }: { original: number; summary: number }) {
  if (!original || !summary) return null
  const pct = Math.round(((original - summary) / original) * 100)
  if (pct < 5) return null
  return (
    <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600">
      <TrendingDown size={10} />
      {pct}% shorter
    </span>
  )
}

// ── FormattedOutput ───────────────────────────────────────────────────────────

function FormattedOutput({ text, mode }: { text: string; mode: SummariseMode }) {
  const isListMode = mode === 'KeyPoints' || mode === 'MeetingNotes'

  if (!isListMode) {
    return (
      <p className="textarea-body text-gray-800 whitespace-pre-wrap">{text}</p>
    )
  }

  const lines = text.split('\n')
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        const trimmed = line.trim()
        if (!trimmed) return <div key={i} className="h-2" />

        if (trimmed.startsWith('## ')) {
          return (
            <p key={i} className="text-gray-900 font-semibold text-[14px] mt-3 mb-1 first:mt-0">
              {trimmed.slice(3)}
            </p>
          )
        }

        // Key points aren't sequential/prioritised — render as bullets, not an
        // ordered list, even though the model outputs "1. 2. 3." formatting.
        const numMatch = trimmed.match(/^(\d+)\.\s+(.+)/)
        if (numMatch) {
          return (
            <div key={i} className="flex gap-3 pl-1">
              <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-gray-400 mt-2.5" />
              <p className="textarea-body text-gray-800 flex-1">{numMatch[2]}</p>
            </div>
          )
        }

        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={i} className="flex gap-3 pl-1">
              <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-gray-300 mt-2.5" />
              <p className="textarea-body text-gray-800 flex-1">{trimmed.slice(2)}</p>
            </div>
          )
        }

        return <p key={i} className="textarea-body text-gray-600">{trimmed}</p>
      })}
    </div>
  )
}

// ── Main SummarisePage ────────────────────────────────────────────────────────

export default function SummarisePage() {
  const {
    inputText, selectedMode, selectedLength,
    isLoading, result, error,
    setInputText, setMode, setLength, reset,
  } = useSummariseStore()

  const { summarise } = useSummarise()
  const [copied, setCopied] = useState(false)
  const outputRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const { text, clearTransfer } = useToolTransferStore.getState()
    if (text) {
      setInputText(text)
      clearTransfer()
      toast('Text transferred — ready to summarise!', { icon: '✂️' })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const wordCount    = inputText.trim().split(/\s+/).filter(Boolean).length
  const canSummarise = wordCount >= 50 && !isLoading

  const handleSummarise = async () => {
    if (!canSummarise) return
    const res = await summarise(inputText, selectedMode, selectedLength)
    if (res) setTimeout(() => outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100)
  }

  const handleCopy = async () => {
    if (!result?.summary) return
    await navigator.clipboard.writeText(result.summary)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    if (!result?.summary) return
    const blob = new Blob([result.summary], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `summary-${result.mode.toLowerCase()}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Downloaded!')
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">

      {/* ── Mode + Length — single unified row ───────────────────────────────── */}
      <div className="border-b border-gray-100 shrink-0 px-4 py-3">
        <div className="flex flex-col lg:flex-row lg:items-start gap-3 lg:gap-5">

          {/* Mode group */}
          <div className="flex-1 min-w-0">
            <span className="block text-[12px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Mode
            </span>
            <div className="flex flex-wrap gap-1.5">
              {MODES.map(id => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMode(id)}
                  className={cn(
                    'px-4 h-9 flex items-center rounded-lg text-[15px] font-medium transition-colors whitespace-nowrap',
                    selectedMode === id
                      ? 'bg-neutral-900 text-white'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200',
                  )}
                >
                  {SUMMARISE_MODE_LABELS[id]}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1.5">{SUMMARISE_MODE_DESCRIPTIONS[selectedMode]}</p>
          </div>

          {/* Length group — hidden for TL;DR, which has no length axis */}
          {selectedMode !== 'TlDr' && (
            <>
              <div className="hidden lg:block w-px bg-gray-100 self-stretch" />
              <div className="lg:w-64 shrink-0">
                <span className="block text-[12px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Length
                </span>
                <div className="flex gap-0.5 p-1 bg-gray-100 rounded-lg">
                  {LENGTHS.map(({ id, label, pct }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setLength(id)}
                      className={cn(
                        'flex-1 flex flex-col items-center px-4 py-2 rounded-md text-[15px] transition-colors',
                        selectedLength === id
                          ? 'bg-neutral-900 text-white font-medium shadow-sm'
                          : 'text-gray-400 hover:text-gray-600',
                      )}
                    >
                      <span>{label}</span>
                      <span className={cn(
                        'text-[10px] font-normal leading-none mt-0.5',
                        selectedLength === id ? 'text-white/70' : 'text-gray-400',
                      )}>{pct}</span>
                    </button>
                  ))}
                </div>
                {wordCount >= 50 && (() => {
                  const active = LENGTHS.find(l => l.id === selectedLength)!
                  const low  = Math.max(active.floor, Math.round(wordCount * active.ratio))
                  const high = Math.round(low * TARGET_OVERSHOOT)
                  return (
                    <span className="text-[12px] text-gray-400 mt-1.5 block">
                      Target: ~{low.toLocaleString()}–{high.toLocaleString()} words
                    </span>
                  )
                })()}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Two-column content ────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex overflow-hidden">

        {/* ── Left: Input ──────────────────────────────────────────────────────── */}
        <div
          className="flex-1 min-w-0 flex flex-col border-r border-gray-200 relative"
          {...dragHandlers}
        >
          {fileInputElement}
          <DropOverlay isDragging={isDragging} isProcessing={isFileProcessing} />

          {/* Input header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 shrink-0">
            <PanelLabel label="Your text" count={wordCount} />
            <div className="flex items-center gap-1.5">
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
              {wordCount >= 50 && (
                <button
                  type="button"
                  onClick={handleSummarise}
                  disabled={!canSummarise}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-purple-accent hover:bg-purple-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Wand2 size={11} />
                  {result ? 'Resummarise' : 'Summarise'}
                </button>
              )}
            </div>
          </div>

          {/* Textarea */}
          <div className="relative flex-1 min-h-0">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isLoading}
              className="textarea-body absolute inset-0 w-full h-full bg-white text-gray-800 resize-none outline-none focus:ring-2 focus:ring-inset focus:ring-purple-accent/30 rounded-lg px-4 py-4 disabled:opacity-60 disabled:cursor-not-allowed"
            />
            {!inputText && (
              <div className="textarea-body pointer-events-none absolute inset-0 px-4 py-4 text-gray-300 select-none">
                Paste or type your text here. Minimum 50 words, or{' '}
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

          {/* Footer */}
          <div className="px-4 py-3 border-t border-gray-100 shrink-0 space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <ClearButton onClick={() => reset()} disabled={!(inputText || result)} />
              </div>
              <button
                type="button"
                onClick={handleSummarise}
                disabled={!canSummarise}
                className={primaryButtonClass(canSummarise)}
              >
                {isLoading ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                      <Wand2 size={14} />
                    </motion.div>
                    Summarising…
                  </>
                ) : (
                  result ? 'Resummarise' : 'Summarise'
                )}
              </button>
            </div>
            {wordCount > 0 && wordCount < 50 && (
              <p className="text-xs text-gray-400 text-center">
                Minimum 50 words required ({50 - wordCount} more needed).
              </p>
            )}
          </div>
        </div>

        {/* ── Right: Output ─────────────────────────────────────────────────────── */}
        <div ref={outputRef} className="flex-1 min-w-0 flex flex-col">

          {/* Output header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 shrink-0">
            <PanelLabel label={SUMMARISE_MODE_LABELS[selectedMode]} count={result?.summaryWordCount} />
            <div className="flex items-center gap-2">
              {result && (
                <>
                  {result.isChunked && (
                    <span
                      title={`Processed in ${result.chunksProcessed} parallel chunks then synthesised`}
                      className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-500 cursor-default"
                    >
                      <Layers size={10} />
                      {result.chunksProcessed} chunks
                    </span>
                  )}
                  <CompressionBadge
                    original={result.originalWordCount}
                    summary={result.summaryWordCount}
                  />
                </>
              )}
              {result?.summary && (
                <>
                  <OutputActionButton
                    icon={copied ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
                    onClick={handleCopy}
                  >
                    {copied ? <span className="text-green-500">Copied</span> : 'Copy'}
                  </OutputActionButton>
                  <SendToMenu text={result.summary} />
                  <OutputActionButton icon={<Download size={11} />} onClick={handleDownload}>
                    Download
                  </OutputActionButton>
                </>
              )}
            </div>
          </div>

          {/* Output body */}
          <AnimatePresence mode="wait">
            {!result && !isLoading && !error ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center"
              >
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center">
                  <FileText size={16} className="text-indigo-500 opacity-70" />
                </div>
                <div>
                  <p className="text-[14px] font-medium text-gray-600">Summary will appear here</p>
                  <p className="text-[12px] text-gray-400 mt-1 max-w-[220px] leading-relaxed">
                    Condenses your text to the key points at the length you choose — paste text, then click Summarise.
                  </p>
                </div>
                <div className="w-full max-w-xs mt-1 opacity-60 text-left">
                  <div className="p-3 rounded-lg border border-[#e0e0da] bg-gray-50 text-xs leading-6 text-gray-400">
                    <span className="line-through decoration-gray-300">AI is transforming healthcare by enabling faster, more accurate diagnoses and personalising treatment plans. Predictive analytics let clinicians spot high-risk patients early.</span>
                  </div>
                  <div className="p-3 mt-1.5 rounded-lg border border-purple-100 bg-purple-50 text-xs leading-6 text-purple-700 font-medium">
                    AI speeds up diagnosis, personalises treatment, and flags high-risk patients earlier.
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1.5 text-center">Condensed to the essentials</p>
                </div>
              </motion.div>
            ) : isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex-1 px-5 py-4"
              >
                <Skeleton variant="text" tone="light" lines={6} />
              </motion.div>
            ) : !result && error ? (
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
                  <p className="text-[14px] font-medium text-gray-600">Couldn't summarise your text</p>
                  <p className="text-[12px] text-gray-400 mt-1 max-w-[240px] leading-relaxed">{error}</p>
                </div>
                <button
                  type="button"
                  onClick={handleSummarise}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-purple-accent hover:bg-purple-deep text-white transition-colors"
                >
                  <Wand2 size={12} /> Retry
                </button>
              </motion.div>
            ) : result ? (
              <motion.div
                key="output"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex-1 overflow-y-auto px-5 py-4"
              >
                <FormattedOutput text={result.summary} mode={selectedMode} />
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Output footer */}
          {result?.summary && (
            <div className="px-4 py-2.5 border-t border-gray-100 shrink-0">
              <span className="text-[13px] text-gray-400">
                {result.originalWordCount} → {result.summaryWordCount} words
                {result.processingTimeMs > 0 && (
                  <span className="ml-2 text-gray-300">· Generated in {formatDuration(result.processingTimeMs)}</span>
                )}
              </span>
            </div>
          )}
        </div>

        {/* ── Stats sidebar — slides in when result is available ─────────────────── */}
        <AnimatePresence>
          {(result || isLoading) && (
            <motion.div
              key="stats"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 192, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="shrink-0 overflow-hidden border-l border-gray-100"
            >
              <div className="w-48 h-full flex flex-col bg-white">
                <div className="px-4 py-2.5 border-b border-gray-100 shrink-0">
                  <div className="flex items-center gap-2">
                    <TrendingDown size={13} className="text-gray-400" />
                    <span className="text-[13px] font-semibold text-gray-700">Stats</span>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto flex flex-col items-center gap-3 p-4">
                  {result ? (
                    <>
                      {result.originalWordCount > 0 && (
                        <>
                          <div className="w-full space-y-1.5">
                            <div className="flex justify-between text-[11px] text-gray-400">
                              <span>Compression</span>
                              <span className="text-emerald-500 font-semibold">
                                {Math.round(((result.originalWordCount - result.summaryWordCount) / result.originalWordCount) * 100)}%
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <motion.div
                                className="h-full rounded-full bg-gray-900"
                                initial={{ width: '0%' }}
                                animate={{ width: `${Math.round((result.summaryWordCount / result.originalWordCount) * 100)}%` }}
                                transition={{ duration: 0.8, ease: 'easeOut' }}
                              />
                            </div>
                            <div className="flex justify-between text-[10px] text-gray-400">
                              <span>Summary</span>
                              <span>Original</span>
                            </div>
                          </div>

                          <div className="w-full space-y-2 mt-1">
                            <div className="flex justify-between items-center text-[12px]">
                              <span className="text-gray-400">Original</span>
                              <span className="font-semibold text-gray-700 tabular-nums">{result.originalWordCount}w</span>
                            </div>
                            <div className="flex justify-between items-center text-[12px]">
                              <span className="text-gray-400">Summary</span>
                              <span className="font-semibold text-gray-700 tabular-nums">{result.summaryWordCount}w</span>
                            </div>
                            <div className="flex justify-between items-center text-[12px]">
                              <span className="text-gray-400">Saved</span>
                              <span className="font-semibold text-emerald-500 tabular-nums">
                                {result.originalWordCount - result.summaryWordCount}w
                              </span>
                            </div>
                          </div>
                        </>
                      )}

                      {result.isChunked && (
                        <div className="mt-auto w-full">
                          <div className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-100 text-[11px] text-indigo-500 font-medium">
                            <Layers size={11} />
                            {result.chunksProcessed} chunk{result.chunksProcessed !== 1 ? 's' : ''} processed
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-2 mt-4">
                      <TrendingDown size={20} className="text-gray-200" />
                      <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                        Summarise text to see stats
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  )
}
