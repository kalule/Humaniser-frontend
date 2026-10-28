import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Copy, Check, Download, FileText, Wand2, TrendingDown, Layers, Upload, Clipboard, AlertCircle, ChevronDown,
  Loader2, MoreHorizontal,
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
import { ResultsPanelHeader } from '../../components/ui/ResultsPanelHeader'
import { PanelFooterBar } from '../../components/ui/PanelFooterBar'
import { ToolBottomActionRow } from '../../components/ui/ToolBottomActionRow'
import { ToolSidebarShell } from '../../components/ui/ToolSidebarShell'
import { ToolWorkspaceCard } from '../../components/shared/ToolWorkspaceCard'
import { useToolTransferStore } from '../../store/toolTransferStore'
import {
  SUMMARISE_MODE_LABELS,
  SUMMARISE_MODE_DESCRIPTIONS,
} from '../../types/summarise'
import type { SummariseMode, SummariseLength } from '../../types/summarise'
import { cn, formatNumber } from '../../lib/utils'

// ── Constants ─────────────────────────────────────────────────────────────────

// Temporary kill switch for the Stats sidebar — flip back to true to restore it.
const SHOW_STATS_SIDEBAR = false

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

const MIN_WORDS = 50

// Same size as the Humaniser's output-toolbar buttons, so the two pages share one set of targets.
const OUTPUT_BTN_SIZE = 'h-8 px-3 gap-1.5 text-[13px] rounded-lg'

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
      <p className="textarea-body text-text-pri whitespace-pre-wrap">{text}</p>
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
              <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-purple-accent/50 mt-2.5" />
              <p className="textarea-body text-text-pri flex-1">{numMatch[2]}</p>
            </div>
          )
        }

        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={i} className="flex gap-3 pl-1">
              <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-purple-accent/30 mt-2.5" />
              <p className="textarea-body text-text-pri flex-1">{trimmed.slice(2)}</p>
            </div>
          )
        }

        return <p key={i} className="textarea-body text-text-sec">{trimmed}</p>
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
  const [overflowOpen, setOverflowOpen] = useState(false)
  const [mobileView, setMobileView] = useState<'original' | 'summary'>('original')
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const outputRef = useRef<HTMLDivElement>(null)
  const overflowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const { text, clearTransfer } = useToolTransferStore.getState()
    if (text) {
      setInputText(text)
      clearTransfer()
      toast('Text transferred — ready to summarise!', { icon: '✂️' })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current) }, [])

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
  const canSummarise = wordCount >= MIN_WORDS && !isLoading
  const hasOutput    = !!result && !isLoading

  const handleSummarise = useCallback(async () => {
    if (!canSummarise) return
    const res = await summarise(inputText, selectedMode, selectedLength)
    if (res) {
      setMobileView('summary')
    }
  }, [canSummarise, summarise, inputText, selectedMode, selectedLength])

  const handleCopy = useCallback(async () => {
    if (!result?.summary) return
    try {
      await navigator.clipboard.writeText(result.summary)
    } catch {
      toast.error('Failed to copy to clipboard')
      return
    }
    setCopied(true)
    if (copyTimer.current) clearTimeout(copyTimer.current)
    copyTimer.current = setTimeout(() => setCopied(false), 2000)
  }, [result])

  const handleDownload = useCallback(() => {
    if (!result?.summary) return
    const blob = new Blob([result.summary], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `summary-${result.mode.toLowerCase()}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Downloaded successfully!')
  }, [result])

  const handleClear = useCallback(() => {
    reset()
    setMobileView('original')
  }, [reset])

  // Same shortcuts as the Humaniser: Ctrl/Cmd+Enter runs, Ctrl+Shift+C copies, Ctrl+Shift+X clears.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); void handleSummarise(); return }
      if (e.ctrlKey && e.shiftKey && e.key === 'C')      { e.preventDefault(); void handleCopy(); return }
      if (e.ctrlKey && e.shiftKey && e.key === 'X')      { e.preventDefault(); handleClear() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSummarise, handleCopy, handleClear])

  const [modeMenuOpen, setModeMenuOpen] = useState(false)
  const modeMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!modeMenuOpen) return
    const onDown = (e: MouseEvent) => {
      if (!modeMenuRef.current?.contains(e.target as Node)) setModeMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [modeMenuOpen])

  useEffect(() => {
    if (!overflowOpen) return
    const onDown = (e: MouseEvent) => {
      if (!overflowRef.current?.contains(e.target as Node)) setOverflowOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [overflowOpen])

  // Same compact controls strip as the Humaniser: shown only once there is text to work on (so the
  // empty page stays quiet), purple-filled selected state, 13px labels. Mode is a dropdown because the
  // five names (Executive Summary / Abstract / TL;DR ...) aren't self-explanatory, so each menu row
  // carries its description. Length has three options, so it stays visible as pills.
  const pillClass = (active: boolean) => cn(
    'px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150 border whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed',
    active
      ? 'bg-purple-accent text-white border-purple-accent shadow-sm'
      : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300 hover:text-neutral-900',
  )
  const groupLabelClass = 'text-[12px] font-semibold text-neutral-500 uppercase tracking-wider shrink-0'

  const toggleBar = (
    <div className="bg-neutral-100 rounded-xl px-4 py-3 flex items-center flex-wrap gap-x-4 gap-y-2">

      {/* Mode: dropdown */}
      <div className="flex items-center gap-2">
        <span className={groupLabelClass}>Mode</span>
        <div className="relative" ref={modeMenuRef}>
          <button
            type="button"
            onClick={() => setModeMenuOpen(v => !v)}
            disabled={isLoading}
            aria-haspopup="listbox"
            aria-expanded={modeMenuOpen}
            title={SUMMARISE_MODE_DESCRIPTIONS[selectedMode]}
            className={cn(pillClass(selectedMode !== 'KeyPoints'), 'inline-flex items-center gap-1.5')}
          >
            {SUMMARISE_MODE_LABELS[selectedMode]}
            <ChevronDown size={14} className={cn('transition-transform duration-150', modeMenuOpen && 'rotate-180')} />
          </button>

          {modeMenuOpen && (
            <div role="listbox" aria-label="Mode" className="absolute z-30 top-full mt-1.5 left-0 w-72 bg-white border border-gray-200 rounded-xl shadow-elevated overflow-hidden py-1">
              {MODES.map(id => (
                <button
                  key={id}
                  type="button"
                  role="option"
                  aria-selected={selectedMode === id}
                  onClick={() => { setMode(id); setModeMenuOpen(false) }}
                  className={cn('flex flex-col items-start w-full px-3 py-2 text-left transition-colors', selectedMode === id ? 'bg-purple-50' : 'hover:bg-gray-50')}
                >
                  <span className="text-[13px] font-medium text-gray-800">{SUMMARISE_MODE_LABELS[id]}</span>
                  <span className="text-[11px] text-gray-500">{SUMMARISE_MODE_DESCRIPTIONS[id]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Length: pills; hidden for TL;DR, which has no length axis */}
      {selectedMode !== 'TlDr' && (
        <>
          <div className="hidden sm:block w-px h-5 bg-neutral-200" />
          <div className="flex items-center gap-2">
            <span className={groupLabelClass}>Length</span>
            <div role="radiogroup" aria-label="Length" className="flex items-center gap-1.5 flex-wrap">
              {LENGTHS.map(({ id, label, pct }) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={selectedLength === id}
                  onClick={() => setLength(id)}
                  disabled={isLoading}
                  title={`About ${pct} of the original`}
                  className={pillClass(selectedLength === id)}
                >
                  {label}
                </button>
              ))}
            </div>
            {wordCount >= MIN_WORDS && (() => {
              const active = LENGTHS.find(l => l.id === selectedLength)!
              const low  = Math.max(active.floor, Math.round(wordCount * active.ratio))
              const high = Math.round(low * TARGET_OVERSHOOT)
              return (
                <span className="text-[12px] text-neutral-500 whitespace-nowrap tabular-nums">
                  ≈ {low.toLocaleString()}–{high.toLocaleString()} words
                </span>
              )
            })()}
          </div>
        </>
      )}
    </div>
  )

  // Mobile Original / Summary switch — only once there is a result to switch to.
  const mobileTabs = hasOutput ? (
    <div role="tablist" aria-label="View" className="flex items-center gap-1.5">
      {([['summary', 'Summary'], ['original', 'Original']] as const).map(([id, label]) => (
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
    header: <ResultsPanelHeader title={<PanelLabel label="Original" />} />,
    body: (
      <div className="flex-1 min-h-0 flex flex-col relative" {...dragHandlers}>
        {fileInputElement}
        <DropOverlay isDragging={isDragging} isProcessing={isFileProcessing} />
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
              Paste your text here (minimum {MIN_WORDS} words), or{' '}
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
      </div>
    ),
    // Same bottom rows as the Humaniser: word count + Paste/Upload, then Clear opposite the primary action.
    footer: (
      <>
        <PanelFooterBar
          metadata={
            <span className={cn('text-xs font-normal tabular-nums',
              wordCount > 0 && wordCount < MIN_WORDS ? 'text-amber-600' : 'text-gray-400')}>
              {formatNumber(wordCount)} words
              {wordCount > 0 && wordCount < MIN_WORDS && ` · ${MIN_WORDS - wordCount} more needed`}
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
          clearButton={<ClearButton onClick={handleClear} disabled={!(inputText || result) || isLoading} />}
          primaryButton={
            <button
              type="button"
              onClick={() => void handleSummarise()}
              disabled={!canSummarise}
              title="Summarise (Ctrl+Enter / Cmd+Enter)"
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all shrink-0',
                isLoading
                  ? 'bg-purple-accent text-white opacity-90 cursor-wait'
                  : !canSummarise
                  ? 'bg-[#c4b5fd] text-white cursor-not-allowed'
                  : 'bg-purple-accent hover:bg-purple-deep text-white shadow shadow-purple-400/20',
              )}
            >
              {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              {isLoading ? 'Summarising your writing…' : result ? 'Resummarise' : 'Summarise'}
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
        title={<PanelLabel label={SUMMARISE_MODE_LABELS[selectedMode]} colorOverride={hasOutput ? 'var(--color-purple)' : undefined} />}
      />
    ),
    footer: hasOutput && result && (
      <PanelFooterBar
        metadata={
          <>
            <span className="text-xs font-normal tabular-nums text-gray-400">
              {formatNumber(result.originalWordCount)} → {formatNumber(result.summaryWordCount)} words
            </span>
            {result.isChunked && (
              <span
                title={`Processed in ${result.chunksProcessed} parallel chunks then synthesised`}
                className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-purple-50 border border-purple-100 text-purple-600 cursor-default"
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
        }
        actions={result.summary && (
          <>
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
                  <div className="px-1">
                    <SendToMenu text={result.summary} inline className="w-full [&>button]:w-full [&>button]:justify-start [&>button]:h-auto [&>button]:px-2 [&>button]:py-2 [&>button]:border-0 [&>button]:text-[13px]" />
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      />
    ),
    body: (
      <div
        ref={outputRef}
        className="flex-1 min-h-0 overflow-y-auto px-5 py-3"
        aria-live="polite"
        aria-label="Summary output"
      >
        <AnimatePresence mode="wait">
          {!result && !isLoading && !error ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-full gap-3 text-center px-8"
            >
              <div className="w-9 h-9 rounded-xl bg-purple-50 border border-[#c4b5fd] flex items-center justify-center">
                <FileText size={16} className="text-purple-accent opacity-70" />
              </div>
              <div>
                <p className="text-[14px] font-medium text-text-sec">Summary will appear here</p>
                <p className="text-[12px] text-text-mut mt-1 max-w-[220px] leading-relaxed">
                  Condenses your text to the key points at the length you choose — paste your writing and click Summarise.
                </p>
              </div>
              {/* Demo only when the panel is tall enough to show it without touching the edges */}
              <div className="hidden [@media(min-height:760px)]:block w-full max-w-xs mt-1 opacity-60 text-left">
                <div className="p-3 rounded-lg border border-[#e0e0da] bg-[#f8fafc] text-xs leading-6 text-text-mut">
                  <span className="line-through decoration-gray-300">AI is transforming healthcare by enabling faster, more accurate diagnoses and personalising treatment plans. Predictive analytics let clinicians spot high-risk patients early.</span>
                </div>
                <div className="p-3 mt-1.5 rounded-lg border border-purple-100 bg-purple-50 text-xs leading-6 text-purple-700 font-medium">
                  AI speeds up diagnosis, personalises treatment, and flags high-risk patients earlier.
                </div>
                <p className="text-[10px] text-text-mut mt-1.5 text-center">Condensed to the essentials</p>
              </div>
            </motion.div>
          ) : isLoading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 pt-1">
              <div className="flex items-center gap-2 mb-4">
                <Loader2 size={14} className="animate-spin text-purple-accent" />
                <span className="text-sm text-purple-accent font-medium">Summarising your writing…</span>
              </div>
              <Skeleton variant="text" tone="light" lines={6} />
            </motion.div>
          ) : !result && error ? (
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
                <p className="text-[14px] font-medium text-text-sec">Couldn't summarise your text</p>
                <p className="text-[12px] text-text-mut mt-1 max-w-[240px] leading-relaxed">{error}</p>
              </div>
              <button
                type="button"
                onClick={() => void handleSummarise()}
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
              transition={{ duration: 0.2 }}
            >
              <FormattedOutput text={result.summary} mode={selectedMode} />
            </motion.div>
          ) : null}
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
        sidebar={
          <AnimatePresence>
            {SHOW_STATS_SIDEBAR && (result || isLoading) && (
              <motion.div
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.25 }}
              >
                <ToolSidebarShell icon={<TrendingDown size={13} className="text-gray-400" />} label="Stats">
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
                                className="h-full rounded-full bg-purple-accent"
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
                          <div className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-purple-50 border border-purple-100 text-[11px] text-purple-600 font-medium">
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
                </ToolSidebarShell>
              </motion.div>
            )}
          </AnimatePresence>
        }
      />
    </div>
  )
}
