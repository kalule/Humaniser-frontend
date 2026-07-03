import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Copy, Check, Download, RotateCcw, FileText, Wand2, TrendingDown, Layers, Upload,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useSummariseStore } from '../../store/summariseStore'
import { useSummarise } from '../../hooks/useSummarise'
import { useDragDrop } from '../../hooks/useDragDrop'
import { DropOverlay } from '../../components/ui/DropOverlay'
import { SendToMenu } from '../../components/ui/SendToMenu'
import { useToolTransferStore } from '../../store/toolTransferStore'
import {
  SUMMARISE_MODE_LABELS,
  SUMMARISE_MODE_DESCRIPTIONS,
} from '../../types/summarise'
import type { SummariseMode, SummariseLength } from '../../types/summarise'
import { cn } from '../../lib/utils'

// ── Constants ─────────────────────────────────────────────────────────────────

const MODES: SummariseMode[] = [
  'KeyPoints', 'ExecutiveSummary', 'Abstract', 'TlDr', 'MeetingNotes',
]

const LENGTHS: { id: SummariseLength; label: string; pct: string; ratio: number }[] = [
  { id: 'short',    label: 'Short',    pct: '~10–15%', ratio: 0.125 },
  { id: 'medium',   label: 'Medium',   pct: '~25–30%', ratio: 0.275 },
  { id: 'detailed', label: 'Detailed', pct: '~50–60%', ratio: 0.425 },
]

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
      <p className="text-gray-800 text-[15px] leading-[1.85] whitespace-pre-wrap">{text}</p>
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

        const numMatch = trimmed.match(/^(\d+)\.\s+(.+)/)
        if (numMatch) {
          return (
            <div key={i} className="flex gap-3">
              <span className="shrink-0 w-5 h-5 rounded-full bg-gray-900 text-white text-[11px] font-bold flex items-center justify-center mt-0.5">
                {numMatch[1]}
              </span>
              <p className="text-gray-800 text-[15px] leading-[1.75] flex-1">{numMatch[2]}</p>
            </div>
          )
        }

        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={i} className="flex gap-3 pl-1">
              <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-gray-300 mt-2.5" />
              <p className="text-gray-800 text-[15px] leading-[1.75] flex-1">{trimmed.slice(2)}</p>
            </div>
          )
        }

        return <p key={i} className="text-gray-600 text-[15px] leading-[1.75]">{trimmed}</p>
      })}
    </div>
  )
}

// ── Main SummarisePage ────────────────────────────────────────────────────────

export default function SummarisePage() {
  const {
    inputText, selectedMode, selectedLength,
    isLoading, result,
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

      {/* ── Mode tabs ─────────────────────────────────────────────────────────── */}
      <div className="border-b border-gray-200 shrink-0">
        <div className="flex overflow-x-auto scrollbar-none px-4">
          {MODES.map(id => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={cn(
                'px-4 py-3 text-sm border-b-2 transition-colors whitespace-nowrap',
                selectedMode === id
                  ? 'border-gray-900 text-gray-900 font-medium'
                  : 'border-transparent text-gray-400 hover:text-gray-600',
              )}
            >
              {SUMMARISE_MODE_LABELS[id]}
            </button>
          ))}
        </div>
        <p className="px-5 py-1.5 text-xs text-gray-400">
          {SUMMARISE_MODE_DESCRIPTIONS[selectedMode]}
        </p>
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

          {/* Length selector — hidden for TL;DR */}
          {selectedMode !== 'TlDr' && (
            <div className="px-4 py-2.5 border-b border-gray-100 shrink-0 flex items-center gap-4 flex-wrap">
              <div className="flex gap-0.5 p-1 bg-gray-100 rounded-lg">
                {LENGTHS.map(({ id, label, pct }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setLength(id)}
                    className={cn(
                      'flex flex-col items-center px-4 py-1.5 rounded-md text-[13px] transition-colors',
                      selectedLength === id
                        ? 'bg-white text-gray-900 font-medium shadow-sm'
                        : 'text-gray-400 hover:text-gray-600',
                    )}
                  >
                    <span>{label}</span>
                    <span className="text-[10px] font-normal text-gray-400 leading-none mt-0.5">{pct}</span>
                  </button>
                ))}
              </div>
              {wordCount >= 50 && (() => {
                const active = LENGTHS.find(l => l.id === selectedLength)!
                return (
                  <span className="text-[12px] text-gray-400">
                    Target: ~{Math.round(wordCount * active.ratio).toLocaleString()} words
                  </span>
                )
              })()}
            </div>
          )}

          {/* Input header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 shrink-0">
            <span className="text-sm font-medium text-gray-700">
              Your text
              {wordCount > 0 && (
                <span className={cn(
                  'ml-2 text-xs font-normal',
                  wordCount < 50 ? 'text-red-400' : 'text-gray-400',
                )}>
                  {wordCount} words
                </span>
              )}
            </span>
            <div className="flex items-center gap-3">
              {!inputText && (
                <button
                  type="button"
                  onClick={() => setInputText(SAMPLE_TEXT)}
                  className="text-xs text-blue-500 hover:underline"
                >
                  Try sample
                </button>
              )}
              <button
                type="button"
                onClick={openFilePicker}
                disabled={isLoading || isFileProcessing}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-40"
              >
                <Upload size={11} />
                Upload
              </button>
              {(inputText || result) && (
                <button
                  type="button"
                  onClick={() => reset()}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <RotateCcw size={11} />
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Textarea */}
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste or type your text here. Minimum 50 words..."
            className="flex-1 min-h-0 w-full bg-white text-gray-800 placeholder:text-gray-300 resize-none focus:outline-none px-4 py-4 text-[15px] leading-[1.75]"
          />

          {/* Summarise button */}
          <div className="px-4 py-3 border-t border-gray-100 shrink-0">
            <button
              type="button"
              onClick={handleSummarise}
              disabled={!canSummarise}
              className="w-full py-2.5 px-4 bg-gray-900 text-white text-sm font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
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
            {wordCount > 0 && wordCount < 50 && (
              <p className="text-xs text-gray-400 text-center mt-1.5">
                Minimum 50 words required ({50 - wordCount} more needed).
              </p>
            )}
          </div>
        </div>

        {/* ── Right: Output ─────────────────────────────────────────────────────── */}
        <div ref={outputRef} className="flex-1 min-w-0 flex flex-col">

          {/* Output header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 shrink-0">
            <span className="text-sm font-medium text-gray-700">
              {SUMMARISE_MODE_LABELS[selectedMode]}
              {result && (
                <span className="ml-2 text-xs font-normal text-gray-400">
                  {result.summaryWordCount} words
                </span>
              )}
            </span>
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
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check size={12} className="text-green-500" />
                      <span className="text-green-500">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      Copy
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Output body */}
          <AnimatePresence mode="wait">
            {!result && !isLoading ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center"
              >
                <FileText size={32} className="text-gray-300" />
                <p className="text-sm text-gray-400 leading-relaxed max-w-[200px]">
                  Paste your text on the left and hit Summarise.
                </p>
              </motion.div>
            ) : isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex-1 flex items-center justify-center gap-3"
              >
                {[0, 1, 2].map(i => (
                  <motion.span
                    key={i}
                    className="w-2 h-2 rounded-full bg-gray-300"
                    animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
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
            <div className="px-4 py-2.5 border-t border-gray-100 shrink-0 flex items-center justify-between">
              <span className="text-xs text-gray-400">
                {result.originalWordCount} → {result.summaryWordCount} words
                {result.processingTimeMs > 0 && (
                  <span className="ml-2 text-gray-300">· {result.processingTimeMs}ms</span>
                )}
              </span>
              <div className="flex items-center gap-3">
                <SendToMenu text={result.summary} />
                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <Download size={11} />
                  Download
                </button>
              </div>
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
