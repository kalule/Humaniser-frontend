import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RefreshCw, Sparkles, Briefcase, GraduationCap, AlignLeft,
  Maximize2, Minimize2, Copy, RotateCcw, ChevronDown,
  FileText, Wand2, Upload,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useParaphraseStore } from '../../store/paraphraseStore'
import { useParaphrase } from '../../hooks/useParaphrase'
import { useDragDrop } from '../../hooks/useDragDrop'
import { DropOverlay } from '../../components/ui/DropOverlay'
import { PARAPHRASE_MODE_DESCRIPTIONS } from '../../types/paraphrase'
import type { ParaphraseMode, ParaphraseStrength } from '../../types/paraphrase'
import { cn } from '../../lib/utils'

// ── Mode config ───────────────────────────────────────────────────────────────

const MODES: { id: ParaphraseMode; label: string; Icon: React.ElementType; color: string }[] = [
  { id: 'Standard', label: 'Standard', Icon: RefreshCw,      color: 'indigo'   },
  { id: 'Fluency',  label: 'Fluency',  Icon: Sparkles,       color: 'purple'   },
  { id: 'Formal',   label: 'Formal',   Icon: Briefcase,      color: 'blue'     },
  { id: 'Academic', label: 'Academic', Icon: GraduationCap,  color: 'cyan'     },
  { id: 'Simple',   label: 'Simple',   Icon: AlignLeft,      color: 'emerald'  },
  { id: 'Expand',   label: 'Expand',   Icon: Maximize2,      color: 'amber'    },
  { id: 'Shorten',  label: 'Shorten',  Icon: Minimize2,      color: 'rose'     },
]

const MODE_COLORS: Record<string, string> = {
  indigo:  'bg-indigo-500/20 text-indigo-400 border-indigo-500/40',
  purple:  'bg-purple-500/20 text-purple-400 border-purple-500/40',
  blue:    'bg-blue-500/20   text-blue-400   border-blue-500/40',
  cyan:    'bg-cyan-500/20   text-cyan-400   border-cyan-500/40',
  emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  amber:   'bg-amber-500/20  text-amber-400  border-amber-500/40',
  rose:    'bg-rose-500/20   text-rose-400   border-rose-500/40',
}

const STRENGTHS: { id: ParaphraseStrength; label: string; desc: string }[] = [
  { id: 'light',  label: 'Light',  desc: 'Word swaps only' },
  { id: 'medium', label: 'Medium', desc: 'Phrase & structure' },
  { id: 'heavy',  label: 'Heavy',  desc: 'Full rewrite' },
]

const SAMPLE_TEXT =
  `Artificial intelligence has transformed the way organisations approach problem-solving. Furthermore, the utilisation of machine learning algorithms enables companies to process vast amounts of data with unprecedented efficiency. It is important to note that these technological advancements present both opportunities and challenges for contemporary society.`

// ── WordCountBadge ────────────────────────────────────────────────────────────

function WordCountBadge({ count, min = 0 }: { count: number; min?: number }) {
  const tooFew = count > 0 && count < min
  return (
    <span className={cn(
      'text-[13px] font-medium px-2.5 py-1 rounded-full',
      count === 0   ? 'bg-slate-700 text-slate-400'
      : tooFew      ? 'bg-red-500/15 text-red-400'
      : 'bg-slate-700 text-slate-300',
    )}>
      {count > 0
        ? `${count} words${tooFew ? ` (${min - count} more needed)` : ''}`
        : '0 words'}
    </span>
  )
}

// ── DeltaBadge — shows +/- word count change ──────────────────────────────────

function DeltaBadge({ original, current }: { original: number; current: number }) {
  const delta = current - original
  if (Math.abs(delta) < 2) return null
  return (
    <span className={cn(
      'text-[12px] font-semibold px-2 py-0.5 rounded-full',
      delta > 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
    )}>
      {delta > 0 ? `+${delta}` : delta} words
    </span>
  )
}

// ── ManifestCard ──────────────────────────────────────────────────────────────

function ManifestCard({ manifest }: {
  manifest: { syntacticChange: string; lexicalUpgrades: string[]; wordCountDelta: number }
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-800 border border-slate-700 rounded-2xl p-5 space-y-3"
    >
      <p className="text-slate-300 font-semibold text-[14px]">Transformation Summary</p>
      <div className="space-y-2">
        <div>
          <p className="text-[12px] text-slate-500 uppercase tracking-wider font-semibold mb-1">Syntactic change</p>
          <p className="text-slate-300 text-[14px]">{manifest.syntacticChange}</p>
        </div>
        {manifest.lexicalUpgrades.length > 0 && (
          <div>
            <p className="text-[12px] text-slate-500 uppercase tracking-wider font-semibold mb-1">New vocabulary</p>
            <div className="flex flex-wrap gap-2">
              {manifest.lexicalUpgrades.map(w => (
                <span key={w} className="text-[13px] px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                  {w}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
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
  const [showManifest, setShowManifest] = useState(false)
  const outputRef = useRef<HTMLDivElement>(null)

  const { isDragging, isProcessing: isFileProcessing, dragHandlers, openFilePicker, fileInputElement } = useDragDrop({
    onText: (t) => setInputText(t),
    disabled: isLoading,
  })

  const wordCount = inputText.trim()
    .split(/\s+/).filter(Boolean).length

  const canParaphrase = wordCount >= 10 && !isLoading

  const activeModeConfig = MODES.find(m => m.id === selectedMode)!

  const handleParaphrase = async () => {
    if (!canParaphrase) return
    const result = await paraphrase(inputText, selectedMode, selectedStrength, true)
    if (result) {
      setTimeout(() => outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100)
    }
  }

  const handleCopy = async () => {
    if (!outputText) return
    await navigator.clipboard.writeText(outputText)
    toast.success('Copied to clipboard!')
  }

  const handleClear = () => {
    reset()
    setShowManifest(false)
  }

  return (
    <div className="min-h-0 bg-transparent w-full">
      <main className="w-full px-4 py-6 space-y-5">

        {/* Mode selector */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 space-y-3">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {MODES.map(({ id, label, Icon, color }) => {
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
                      ? MODE_COLORS[color]
                      : 'bg-transparent text-slate-400 border-slate-700 hover:text-slate-200 hover:border-slate-600',
                  )}
                >
                  <Icon size={14} />
                  {label}
                </button>
              )
            })}
          </div>
          <p className="text-slate-400 text-[13px] pl-1">
            <span className="text-slate-200 font-medium">{selectedMode}:</span>{' '}
            {PARAPHRASE_MODE_DESCRIPTIONS[selectedMode]}
          </p>
        </div>

        {/* Strength + action row */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1">
            {STRENGTHS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setStrength(id)}
                className={cn(
                  'px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150',
                  selectedStrength === id
                    ? 'bg-slate-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-slate-500 text-[13px]">
            {STRENGTHS.find(s => s.id === selectedStrength)?.desc}
          </p>
        </div>

        {/* Editor panels + contextual sidebar */}
        <div className="flex gap-5 items-start">

        {/* Input / Output grid — fills available width */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-5 items-start min-w-0">

          {/* Input panel — sticky so it stays visible while output scrolls */}
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
                    className="text-[13px] text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition-colors"
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
                <WordCountBadge count={wordCount} min={10} />
              </div>
            </div>

            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste or type your text here. Minimum 10 words..."
              className="flex-1 min-h-0 w-full bg-transparent text-slate-200 placeholder:text-slate-500 resize-none focus:outline-none px-5 py-4 text-[15px] leading-[1.75]"
            />

            <div className="px-5 py-3 border-t border-slate-700/50 flex items-center justify-between shrink-0">
              <span className="text-[13px] text-slate-400">Min. 10 words</span>
              <div className="flex items-center gap-3">
                {(inputText || outputText) && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="flex items-center gap-1.5 text-[13px] text-slate-300 hover:text-white transition-colors"
                  >
                    <RotateCcw size={12} />
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleParaphrase}
                  disabled={!canParaphrase}
                  className={cn(
                    'flex items-center gap-2 px-5 py-2.5 rounded-xl text-[15px] font-semibold transition-all',
                    'bg-gradient-to-r from-indigo-600 to-purple-600 text-white',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    canParaphrase && 'hover:opacity-90 shadow shadow-indigo-500/20',
                  )}
                >
                  {isLoading ? (
                    <>
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                        <RefreshCw size={14} />
                      </motion.div>
                      Paraphrasing…
                    </>
                  ) : (
                    <>
                      <Wand2 size={14} />
                      Paraphrase
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
          </div>{/* end sticky wrapper */}

          {/* Output panel */}
          <div
            ref={outputRef}
            className="bg-slate-800 border border-slate-700/80 rounded-2xl overflow-hidden flex flex-col shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
            style={{ minHeight: 480 }}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700 shrink-0">
              <div className="flex items-center gap-2 text-slate-300 font-medium text-[14px]">
                <activeModeConfig.Icon size={14} className="text-slate-400" />
                {selectedMode} Output
              </div>
              <div className="flex items-center gap-2">
                {lastResponse && (
                  <DeltaBadge
                    original={lastResponse.originalWordCount}
                    current={lastResponse.paraphrasedWordCount}
                  />
                )}
                <WordCountBadge count={outputText.trim().split(/\s+/).filter(Boolean).length} />
              </div>
            </div>

            <AnimatePresence mode="wait">
              {!outputText && !isLoading ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex-1 flex flex-col items-center justify-center text-center px-8 py-12 gap-4"
                >
                  <div className={cn(
                    'w-14 h-14 rounded-2xl flex items-center justify-center',
                    `bg-${activeModeConfig.color}-500/10 border border-${activeModeConfig.color}-500/20`
                  )}>
                    <activeModeConfig.Icon size={22} className={`text-${activeModeConfig.color}-400`} />
                  </div>
                  <div>
                    <p className="text-slate-300 font-semibold text-[15px]">Your paraphrased text will appear here</p>
                    <p className="text-slate-500 text-[13px] mt-1">{PARAPHRASE_MODE_DESCRIPTIONS[selectedMode]}</p>
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
                      className="w-2 h-2 rounded-full bg-indigo-500"
                      animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key="output"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex-1 overflow-y-auto px-5 py-4 text-[15px] leading-[1.75] text-slate-200 whitespace-pre-wrap"
                >
                  {outputText}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="px-5 py-3 border-t border-slate-700/50 flex items-center justify-end gap-3 shrink-0">
              {outputText && (
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
        {/* end input/output grid */}

        {/* Contextual sidebar — Mode Info (desktop only) */}
        <AnimatePresence>
          {(outputText || isLoading) && (
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.25 }}
              className="hidden lg:flex w-[208px] shrink-0 flex-col bg-slate-800 border border-slate-700/80 rounded-2xl overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_4px_32px_rgba(0,0,0,0.35)]"
            >
              <div className="px-5 py-3 border-b border-slate-700">
                <span className="text-[14px] font-semibold text-slate-200">Mode Info</span>
              </div>
              <div className="flex-1 flex flex-col items-center gap-3 p-4">
                <div className="mt-2 w-12 h-12 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
                  <activeModeConfig.Icon size={20} className="text-indigo-400" />
                </div>
                <p className="text-[13px] font-semibold text-slate-200 text-center">{selectedMode}</p>
                <p className="text-[12px] text-slate-400 text-center leading-relaxed">
                  {PARAPHRASE_MODE_DESCRIPTIONS[selectedMode]}
                </p>
                {lastResponse && (
                  <div className="mt-auto w-full pt-3 border-t border-slate-700/50 space-y-2.5">
                    <div className="flex justify-between text-[12px]">
                      <span className="text-slate-500">Original</span>
                      <span className="text-slate-300 font-medium tabular-nums">{lastResponse.originalWordCount}w</span>
                    </div>
                    <div className="flex justify-between text-[12px]">
                      <span className="text-slate-500">Result</span>
                      <span className="text-slate-300 font-medium tabular-nums">{lastResponse.paraphrasedWordCount}w</span>
                    </div>
                    {Math.abs(lastResponse.paraphrasedWordCount - lastResponse.originalWordCount) >= 2 && (
                      <div className="flex justify-between text-[12px]">
                        <span className="text-slate-500">Change</span>
                        <span className={cn(
                          'font-semibold tabular-nums',
                          lastResponse.paraphrasedWordCount > lastResponse.originalWordCount
                            ? 'text-emerald-400'
                            : 'text-amber-400',
                        )}>
                          {lastResponse.paraphrasedWordCount > lastResponse.originalWordCount ? '+' : ''}
                          {lastResponse.paraphrasedWordCount - lastResponse.originalWordCount}w
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        </div>
        {/* end flex+sidebar wrapper */}

        {/* Transformation manifest — collapsible */}
        {lastResponse?.manifest && (
          <div>
            <button
              type="button"
              onClick={() => setShowManifest(v => !v)}
              className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700/50 transition-colors text-[14px]"
            >
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-indigo-400" />
                <span className="font-medium">Transformation Summary</span>
              </div>
              <ChevronDown size={16} className={cn('text-slate-400 transition-transform duration-200', showManifest && 'rotate-180')} />
            </button>
            <AnimatePresence>
              {showManifest && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden mt-3"
                >
                  <ManifestCard manifest={lastResponse.manifest} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

      </main>
    </div>
  )
}
