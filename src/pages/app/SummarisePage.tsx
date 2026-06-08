import { useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  List, Briefcase, GraduationCap, Zap, ClipboardList,
  Copy, RotateCcw, FileText, Wand2, TrendingDown, Layers, Upload,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useSummariseStore } from '../../store/summariseStore'
import { useSummarise } from '../../hooks/useSummarise'
import { useDragDrop } from '../../hooks/useDragDrop'
import { DropOverlay } from '../../components/ui/DropOverlay'
import {
  SUMMARISE_MODE_LABELS,
  SUMMARISE_MODE_DESCRIPTIONS,
} from '../../types/summarise'
import type { SummariseMode, SummariseLength } from '../../types/summarise'
import { cn } from '../../lib/utils'

// ── Mode config ───────────────────────────────────────────────────────────────

const MODES: { id: SummariseMode; Icon: React.ElementType; color: string }[] = [
  { id: 'KeyPoints',        Icon: List,          color: 'indigo'  },
  { id: 'ExecutiveSummary', Icon: Briefcase,      color: 'blue'    },
  { id: 'Abstract',         Icon: GraduationCap,  color: 'cyan'    },
  { id: 'TlDr',             Icon: Zap,            color: 'amber'   },
  { id: 'MeetingNotes',     Icon: ClipboardList,  color: 'emerald' },
]

const MODE_ACTIVE: Record<string, string> = {
  indigo:  'bg-indigo-500/20 text-indigo-400 border-indigo-500/40',
  blue:    'bg-blue-500/20   text-blue-400   border-blue-500/40',
  cyan:    'bg-cyan-500/20   text-cyan-400   border-cyan-500/40',
  amber:   'bg-amber-500/20  text-amber-400  border-amber-500/40',
  emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
}

const LENGTHS: { id: SummariseLength; label: string; desc: string }[] = [
  { id: 'short',    label: 'Short',    desc: '~10–15% of original' },
  { id: 'medium',   label: 'Medium',   desc: '~25–30% of original' },
  { id: 'detailed', label: 'Detailed', desc: '~40–45% of original' },
]

const SAMPLE_TEXT =
  `Artificial intelligence is fundamentally transforming healthcare by enabling faster and more accurate diagnoses, personalising treatment plans, and accelerating drug discovery. Machine learning models can now detect cancers from medical imaging with accuracy matching or exceeding human specialists. Predictive analytics allow clinicians to identify high-risk patients before their conditions deteriorate. In drug development, AI reduces the time to identify promising compounds from years to months. However, significant challenges remain: data privacy concerns, algorithmic bias in underrepresented populations, regulatory uncertainty, and the need for clinical validation. Healthcare institutions must invest in AI literacy among clinicians while ensuring that AI augments rather than replaces human judgment. The most successful implementations combine technical capability with clinical expertise and robust governance frameworks.`

// ── CompressionBadge ──────────────────────────────────────────────────────────

function CompressionBadge({ original, summary }: { original: number; summary: number }) {
  if (!original || !summary) return null
  const saved = original - summary
  const pct   = Math.round((saved / original) * 100)
  if (pct < 5) return null
  return (
    <span className="flex items-center gap-1 text-[12px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
      <TrendingDown size={11} />
      {pct}% shorter
    </span>
  )
}

// ── FormattedOutput — renders markdown-ish output for list modes ──────────────

function FormattedOutput({ text, mode }: { text: string; mode: SummariseMode }) {
  const isListMode = mode === 'KeyPoints' || mode === 'MeetingNotes'

  if (!isListMode) {
    return (
      <p className="text-slate-200 text-[15px] leading-[1.85] whitespace-pre-wrap">{text}</p>
    )
  }

  // Render line-by-line so headers (##) and bullets look clean
  const lines = text.split('\n')
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        const trimmed = line.trim()
        if (!trimmed) return <div key={i} className="h-2" />

        // ## Heading
        if (trimmed.startsWith('## ')) {
          return (
            <p key={i} className="text-slate-100 font-semibold text-[14px] mt-3 mb-1 first:mt-0">
              {trimmed.slice(3)}
            </p>
          )
        }

        // Numbered list  1. 2. 3.
        const numMatch = trimmed.match(/^(\d+)\.\s+(.+)/)
        if (numMatch) {
          return (
            <div key={i} className="flex gap-3">
              <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 text-[11px] font-bold flex items-center justify-center mt-0.5">
                {numMatch[1]}
              </span>
              <p className="text-slate-200 text-[15px] leading-[1.75] flex-1">{numMatch[2]}</p>
            </div>
          )
        }

        // Bullet  - or *
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={i} className="flex gap-3 pl-1">
              <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-slate-500 mt-2.5" />
              <p className="text-slate-200 text-[15px] leading-[1.75] flex-1">{trimmed.slice(2)}</p>
            </div>
          )
        }

        return <p key={i} className="text-slate-300 text-[15px] leading-[1.75]">{trimmed}</p>
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
  const outputRef = useRef<HTMLDivElement>(null)

  const { isDragging, isProcessing: isFileProcessing, dragHandlers, openFilePicker, fileInputElement } = useDragDrop({
    onText: (t) => setInputText(t),
    disabled: isLoading,
  })

  const wordCount  = inputText.trim().split(/\s+/).filter(Boolean).length
  const canSummarise = wordCount >= 50 && !isLoading

  const activeModeConfig = MODES.find(m => m.id === selectedMode)!

  const handleSummarise = async () => {
    if (!canSummarise) return
    const res = await summarise(inputText, selectedMode, selectedLength)
    if (res) setTimeout(() => outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100)
  }

  const handleCopy = async () => {
    if (!result?.summary) return
    await navigator.clipboard.writeText(result.summary)
    toast.success('Copied to clipboard!')
  }

  return (
    <div className="min-h-0 bg-transparent w-full">
      <main className="w-full px-4 py-6 space-y-5">

        {/* Mode selector */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 space-y-3">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {MODES.map(({ id, Icon, color }) => {
              const active = selectedMode === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMode(id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-xl text-[14px] font-medium whitespace-nowrap',
                    'border transition-all duration-150 shrink-0',
                    active
                      ? MODE_ACTIVE[color]
                      : 'bg-transparent text-slate-400 border-slate-700 hover:text-slate-200 hover:border-slate-600',
                  )}
                >
                  <Icon size={14} />
                  {SUMMARISE_MODE_LABELS[id]}
                </button>
              )
            })}
          </div>
          <p className="text-slate-400 text-[13px] pl-1">
            <span className="text-slate-200 font-medium">{SUMMARISE_MODE_LABELS[selectedMode]}:</span>{' '}
            {SUMMARISE_MODE_DESCRIPTIONS[selectedMode]}
          </p>
        </div>

        {/* Length selector — hidden for TL;DR */}
        {selectedMode !== 'TlDr' && (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1">
              {LENGTHS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setLength(id)}
                  className={cn(
                    'px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150',
                    selectedLength === id
                      ? 'bg-slate-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-slate-500 text-[13px]">
              {LENGTHS.find(l => l.id === selectedLength)?.desc}
            </p>
          </div>
        )}

        {/* Editor panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

          {/* Input — sticky so it stays visible while output scrolls */}
          <div className="lg:sticky lg:top-4" style={{ height: 'calc(100vh - 7rem)' }}>
          <div
            className="bg-slate-800 border border-slate-700/80 rounded-2xl overflow-hidden flex flex-col h-full relative shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_4px_32px_rgba(0,0,0,0.35)]"
            {...dragHandlers}
          >
            {fileInputElement}
            <DropOverlay isDragging={isDragging} isProcessing={isFileProcessing} />

            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700 shrink-0">
              <div className="flex items-center gap-2 text-slate-300 font-medium text-[14px]">
                <FileText size={14} className="text-slate-400" />
                Your Text
              </div>
              <div className="flex items-center gap-3">
                {!inputText && (
                  <button
                    type="button"
                    onClick={() => setInputText(SAMPLE_TEXT)}
                    className="text-[13px] text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
                  >
                    Try sample
                  </button>
                )}
                <button
                  type="button"
                  onClick={openFilePicker}
                  disabled={isLoading || isFileProcessing}
                  className="flex items-center gap-1.5 text-[13px] text-slate-300 hover:text-white transition-colors disabled:opacity-40"
                >
                  <Upload size={12} />
                  Upload
                </button>
                <span className={cn(
                  'text-[13px] font-medium px-2.5 py-1 rounded-full',
                  wordCount === 0   ? 'bg-slate-700 text-slate-400'
                  : wordCount < 50  ? 'bg-red-500/15 text-red-400'
                  : 'bg-slate-700 text-slate-300',
                )}>
                  {wordCount > 0
                    ? `${wordCount} words${wordCount < 50 ? ` (${50 - wordCount} more needed)` : ''}`
                    : '0 words'}
                </span>
              </div>
            </div>

            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste or type your text here. Minimum 50 words..."
              className="flex-1 min-h-0 w-full bg-transparent text-slate-200 placeholder:text-slate-500 resize-none focus:outline-none px-5 py-4 text-[15px] leading-[1.75]"
            />

            <div className="px-5 py-3 border-t border-slate-700/50 flex items-center justify-between shrink-0">
              <span className="text-[13px] text-slate-400">Min. 50 words</span>
              <div className="flex items-center gap-3">
                {(inputText || result) && (
                  <button
                    type="button"
                    onClick={() => reset()}
                    className="flex items-center gap-1.5 text-[13px] text-slate-300 hover:text-white transition-colors"
                  >
                    <RotateCcw size={12} />
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSummarise}
                  disabled={!canSummarise}
                  className={cn(
                    'flex items-center gap-2 px-5 py-2.5 rounded-xl text-[15px] font-semibold transition-all',
                    'bg-gradient-to-r from-amber-500 to-orange-500 text-white',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    canSummarise && 'hover:opacity-90 shadow shadow-amber-500/20',
                  )}
                >
                  {isLoading ? (
                    <>
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                        <Wand2 size={14} />
                      </motion.div>
                      Summarising…
                    </>
                  ) : (
                    <>
                      <activeModeConfig.Icon size={14} />
                      {result ? 'Re-summarise' : 'Summarise'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
          </div>{/* end sticky wrapper */}

          {/* Output */}
          <div
            ref={outputRef}
            className="bg-slate-800 border border-slate-700/80 rounded-2xl overflow-hidden flex flex-col shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
            style={{ minHeight: 480 }}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700 shrink-0">
              <div className="flex items-center gap-2 text-slate-300 font-medium text-[14px]">
                <activeModeConfig.Icon size={14} className="text-slate-400" />
                {SUMMARISE_MODE_LABELS[selectedMode]}
              </div>
              <div className="flex items-center gap-2">
                {result && (
                  <>
                    {result.isChunked && (
                      <span
                        title="Document was too long for a single pass — processed in parallel chunks then synthesised"
                        className="flex items-center gap-1 text-[12px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 cursor-default"
                      >
                        <Layers size={11} />
                        Multi-pass
                      </span>
                    )}
                    <CompressionBadge
                      original={result.originalWordCount}
                      summary={result.summaryWordCount}
                    />
                    <span className="text-[13px] text-slate-400">
                      {result.summaryWordCount} words
                    </span>
                  </>
                )}
              </div>
            </div>

            <AnimatePresence mode="wait">
              {!result && !isLoading ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex-1 flex flex-col items-center justify-center text-center px-8 py-12 gap-4"
                >
                  <div className={cn(
                    'w-14 h-14 rounded-2xl flex items-center justify-center',
                    `bg-amber-500/10 border border-amber-500/20`
                  )}>
                    <activeModeConfig.Icon size={22} className="text-amber-400" />
                  </div>
                  <div>
                    <p className="text-slate-300 font-semibold text-[15px]">Your summary will appear here</p>
                    <p className="text-slate-500 text-[13px] mt-1">{SUMMARISE_MODE_DESCRIPTIONS[selectedMode]}</p>
                  </div>
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
                      className="w-2 h-2 rounded-full bg-amber-500"
                      animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </motion.div>
              ) : result && (
                <motion.div
                  key="output"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex-1 overflow-y-auto px-5 py-4"
                >
                  <FormattedOutput text={result.summary} mode={selectedMode} />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="px-5 py-3 border-t border-slate-700/50 flex items-center justify-between shrink-0">
              {result ? (
                <p className="text-slate-500 text-[13px]">
                  {result.originalWordCount} → {result.summaryWordCount} words
                </p>
              ) : (
                <span />
              )}
              {result?.summary && (
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-[14px] font-medium transition-colors"
                >
                  <Copy size={13} />
                  Copy
                </button>
              )}
            </div>
          </div>
        </div>

      </main>
    </div>
  )
}
