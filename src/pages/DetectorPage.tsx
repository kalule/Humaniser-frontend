import { useRef, useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield, Brain, CheckCircle, AlertTriangle,
  Zap, Copy, RotateCcw, Wand2,
  FileText, TrendingUp, BookOpen, Hash, Flag,
  Layers, ChevronDown, Info, Upload,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useDetectorStore } from '../store/detectorStore'
import { useDetector } from '../hooks/useDetector'
import { useDragDrop } from '../hooks/useDragDrop'
import { DropOverlay } from '../components/ui/DropOverlay'
import type { DetectResponse, SentenceScore, DetectionMetrics, DetectionFlag, LayerScores } from '../types/detector'
import { cn } from '../lib/utils'

// ── Score colour helpers ──────────────────────────────────────────────────────

function getScoreColor(humanScore: number): string {
  if (humanScore >= 80) return '#10B981'
  if (humanScore >= 60) return '#84CC16'
  if (humanScore >= 40) return '#F59E0B'
  if (humanScore >= 20) return '#F97316'
  return '#EF4444'
}

function getVerdictLabel(humanScore: number): string {
  if (humanScore >= 86) return 'Human Written'
  if (humanScore >= 71) return 'Likely Human'
  if (humanScore >= 51) return 'Mixed'
  if (humanScore >= 31) return 'Likely AI'
  return 'AI Generated'
}

function getVerdictColors(humanScore: number) {
  if (humanScore >= 71) return { text: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30', icon: CheckCircle }
  if (humanScore >= 51) return { text: 'text-amber-400', bg: 'bg-amber-500/15 border-amber-500/30', icon: AlertTriangle }
  return { text: 'text-red-400', bg: 'bg-red-500/15 border-red-500/30', icon: AlertTriangle }
}

function getFlagColor(weight: number) {
  if (weight >= 75) return { bar: 'bg-red-500', badge: 'bg-red-500/15 text-red-300 border-red-500/25' }
  if (weight >= 50) return { bar: 'bg-amber-500', badge: 'bg-amber-500/15 text-amber-300 border-amber-500/25' }
  return { bar: 'bg-yellow-500', badge: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25' }
}

function getSentenceHint(aiProbability: number): { label: string; color: string } {
  if (aiProbability < 40) return { label: 'Looks good', color: 'text-emerald-400' }
  if (aiProbability < 60) return { label: 'Consider revising', color: 'text-amber-400' }
  return { label: 'Rewrite recommended', color: 'text-red-400' }
}

function buildAnnotatedParts(text: string, sentences: SentenceScore[]) {
  const parts: { text: string; sentenceIdx: number | null }[] = []
  let remaining = text

  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i].sentence.trim()
    if (!s) continue

    // Exact match first
    let idx = remaining.indexOf(s)

    // Fallback: case-insensitive (backend may normalize casing)
    if (idx === -1) idx = remaining.toLowerCase().indexOf(s.toLowerCase())

    // Fallback: normalize smart quotes / dashes then search
    if (idx === -1) {
      const norm = (str: string) =>
        str.replace(/[‘’‚‛]/g, "'")
           .replace(/[“”„‟]/g, '"')
           .replace(/[–—]/g, '-')
           .replace(/ /g, ' ')
      idx = norm(remaining).indexOf(norm(s))
    }

    if (idx === -1) continue
    if (idx > 0) parts.push({ text: remaining.slice(0, idx), sentenceIdx: null })
    parts.push({ text: remaining.slice(idx, idx + s.length), sentenceIdx: i })
    remaining = remaining.slice(idx + s.length)
  }

  if (remaining) parts.push({ text: remaining, sentenceIdx: null })
  return parts
}

// ── LowConfidenceBanner ───────────────────────────────────────────────────────

function LowConfidenceBanner() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/25"
    >
      <Info size={16} className="text-amber-400 mt-0.5 shrink-0" />
      <p className="text-amber-300 text-[15px] leading-[1.75]">
        <span className="font-semibold">Low confidence result.</span>{' '}
        Text under 200 words limits accuracy. For best results, paste at least 200 words.
      </p>
    </motion.div>
  )
}

// ── InputPanel ────────────────────────────────────────────────────────────────
// Single unified input panel — plain textarea before analysis, annotated after

const SAMPLE_TEXT = `Artificial intelligence has transformed the way we approach problem-solving across industries. The utilisation of machine learning algorithms enables organisations to process vast datasets with unprecedented efficiency. Furthermore, the integration of natural language processing capabilities has facilitated more sophisticated human-computer interaction paradigms. It is important to note that these technological advancements present both opportunities and challenges for contemporary society. The systematic implementation of AI-driven solutions requires careful consideration of ethical implications and potential societal impacts.`

function InputPanel({
  text,
  sentences,
  activeSentenceIdx,
  onSentenceClick,
  onTextChange,
  onAnalyse,
  onClear,
  isLoading,
  wordCount,
  hasResult,
  sentenceRefs,
  result,
}: {
  text: string
  sentences: SentenceScore[]
  activeSentenceIdx: number | null
  onSentenceClick: (idx: number) => void
  onTextChange: (t: string) => void
  onAnalyse: () => void
  onClear: () => void
  isLoading: boolean
  wordCount: number
  hasResult: boolean
  sentenceRefs: React.MutableRefObject<(HTMLSpanElement | null)[]>
  result: DetectResponse | null
}) {
  const [isEditing, setIsEditing] = useState(false)
  const { isDragging, isProcessing, dragHandlers, openFilePicker, fileInputElement } = useDragDrop({
    onText: (t) => onTextChange(t),
    disabled: isLoading,
  })

  useEffect(() => { setIsEditing(false) }, [result])

  const parts = useMemo(() => buildAnnotatedParts(text, sentences), [text, sentences])
  const showAnnotated = hasResult && !isEditing

  const sentenceStyles: Record<string, string> = {
    human: 'bg-emerald-500/15 border-b border-emerald-500/40 hover:bg-emerald-500/25',
    mixed: 'bg-amber-500/15 border-b border-amber-500/40 hover:bg-amber-500/25',
    ai: 'bg-red-500/15 border-b border-red-500/40 hover:bg-red-500/25',
  }
  const activeSentenceStyles: Record<string, string> = {
    human: 'bg-emerald-500/30 border-b-2 border-emerald-500 ring-1 ring-emerald-500/30',
    mixed: 'bg-amber-500/30 border-b-2 border-amber-500 ring-1 ring-amber-500/30',
    ai: 'bg-red-500/30 border-b-2 border-red-500 ring-1 ring-red-500/30',
  }

  return (
    <div
      className="bg-slate-800 border border-slate-700/80 rounded-2xl overflow-hidden flex flex-col relative shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_4px_32px_rgba(0,0,0,0.35)]"
      style={{ height: 'calc(100vh - 7rem)' }}
      {...dragHandlers}
    >
      {fileInputElement}
      <DropOverlay isDragging={isDragging} isProcessing={isProcessing} />

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-2 text-slate-300 font-medium text-[14px]">
          <FileText size={15} className="text-slate-400" />
          Your Text
        </div>
        <div className="flex items-center gap-2">
          {!text && (
            <button
              type="button"
              onClick={() => onTextChange(SAMPLE_TEXT)}
              className="text-[13px] text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition-colors"
            >
              Try sample
            </button>
          )}
          <button
            type="button"
            onClick={openFilePicker}
            disabled={isLoading || isProcessing}
            className="flex items-center gap-1.5 text-[13px] text-slate-300 hover:text-white transition-colors disabled:opacity-40"
          >
            <Upload size={12} />
            Upload
          </button>
          <span className={cn(
            'text-[13px] font-medium px-2.5 py-1 rounded-full',
            wordCount === 0 ? 'bg-slate-700 text-slate-400'
              : wordCount < 50 ? 'bg-red-500/15 text-red-400'
              : wordCount < 200 ? 'bg-amber-500/15 text-amber-400'
              : 'bg-slate-700 text-slate-300',
          )}>
            {wordCount > 0
              ? `${wordCount} words${wordCount < 50 ? ` (${50 - wordCount} needed)` : ''}`
              : '0 words'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col min-h-0">
        {showAnnotated ? (
          <div
            className="flex-1 overflow-y-auto px-5 py-4 text-[15px] leading-[1.75] text-slate-200 whitespace-pre-wrap cursor-text"
            onClick={() => setIsEditing(true)}
            title="Click to edit"
          >
            {parts.map((part, i) => {
              if (part.sentenceIdx === null) return <span key={i}>{part.text}</span>
              const s = sentences[part.sentenceIdx]
              const isActive = activeSentenceIdx === part.sentenceIdx
              return (
                <span
                  key={i}
                  ref={(el) => { sentenceRefs.current[part.sentenceIdx!] = el }}
                  className={cn(
                    'cursor-pointer transition-all duration-150 rounded-sm px-0.5',
                    isActive ? activeSentenceStyles[s.classification] : sentenceStyles[s.classification],
                  )}
                  onClick={(e) => { e.stopPropagation(); onSentenceClick(part.sentenceIdx!) }}
                  title={`${s.aiProbability}% AI — click for details`}
                >
                  {part.text}
                </span>
              )
            })}
          </div>
        ) : (
          <textarea
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            onBlur={() => hasResult && setIsEditing(false)}
            autoFocus={isEditing}
            placeholder="Paste the text you want to analyse here. Minimum 50 words, 200+ for accurate detection..."
            className="flex-1 w-full bg-transparent text-slate-200 placeholder:text-slate-500 resize-none focus:outline-none px-5 py-4 text-[15px] leading-[1.75]"
          />
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-slate-700/50 flex items-center justify-between gap-3 shrink-0 flex-wrap">
        {hasResult ? (
          <div className="flex items-center gap-3 text-[13px] text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/30 border border-emerald-500/50 inline-block" />
              Human
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500/30 border border-amber-500/50 inline-block" />
              Mixed
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-500/30 border border-red-500/50 inline-block" />
              AI
            </span>
          </div>
        ) : (
          <span className="text-[13px] text-slate-400">Min. 50 words · 200+ for best accuracy</span>
        )}
        <div className="flex items-center gap-3">
          {isLoading && (
            <button
              type="button"
              onClick={onClear}
              className="text-[13px] text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={onAnalyse}
            disabled={wordCount < 50 || isLoading}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-xl text-[15px] font-semibold transition-all',
              'bg-gradient-to-r from-indigo-600 to-purple-600 text-white',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              wordCount >= 50 && !isLoading && 'hover:opacity-90 shadow shadow-indigo-500/20',
            )}
          >
            {isLoading ? (
              <>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                  <Brain size={15} />
                </motion.div>
                Analysing…
              </>
            ) : (
              <>
                <Shield size={15} />
                {hasResult ? 'Re-check' : 'Analyse Text'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── EmptyState ────────────────────────────────────────────────────────────────

function EmptyState() {
  const features = [
    { icon: Shield, label: 'High Accuracy', desc: 'Statistical + stylometric + semantic analysis' },
    { icon: FileText, label: 'Sentence Level', desc: 'See exactly which sentences are AI-written' },
    { icon: Zap, label: 'Instant Results', desc: 'Detection results in seconds' },
  ]
  return (
    <div
      className="bg-slate-800/40 border border-slate-700/50 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center"
      style={{ minHeight: 400 }}
    >
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border border-indigo-500/30 flex items-center justify-center mb-4">
        <Shield size={24} className="text-indigo-400" />
      </div>
      <h3 className="text-slate-200 font-semibold text-base mb-2">Your results will appear here</h3>
      <p className="text-slate-500 text-[15px] leading-[1.75] mb-8 max-w-xs">
        Paste text on the left and click Analyse — you'll get a sentence-level breakdown and full score
      </p>
      <div className="space-y-2 w-full max-w-xs">
        {features.map(({ icon: Icon, label, desc }) => (
          <div key={label} className="flex items-center gap-3 px-4 py-3 bg-slate-700/30 rounded-xl text-left">
            <Icon size={15} className="text-indigo-400 shrink-0" />
            <div>
              <p className="text-slate-300 text-[13px] font-medium">{label}</p>
              <p className="text-slate-500 text-[13px]">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── CompactScoreCard ──────────────────────────────────────────────────────────

function CompactScoreCard({ result, onHumanise }: { result: DetectResponse; onHumanise: () => void }) {
  const circumference = 2 * Math.PI * 52
  const scoreOffset = circumference * (1 - result.humanScore / 100)
  const scoreColor = getScoreColor(result.humanScore)
  const verdictLabel = getVerdictLabel(result.humanScore)
  const { text: verdictText, bg: verdictBg, icon: VerdictIcon } = getVerdictColors(result.humanScore)
  const showHumaniseCta = result.aiScore > 25
  const showSoftNudge = result.aiScore >= 15 && result.aiScore <= 25

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-800 border border-slate-700 rounded-2xl p-5"
    >
      <div className="flex items-center gap-6">
        <div className="shrink-0">
          <svg width="128" height="128" viewBox="0 0 128 128">
            <circle cx="64" cy="64" r="52" fill="none" stroke="#334155" strokeWidth="9" />
            <motion.circle
              cx="64" cy="64" r="52"
              fill="none" stroke={scoreColor} strokeWidth="9" strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: scoreOffset }}
              transition={{ duration: 1.5, ease: 'easeOut' }}
              style={{ transformOrigin: '64px 64px', transform: 'rotate(-90deg)' }}
            />
            <text x="64" y="57" textAnchor="middle" fill="#F8FAFC" fontSize="24" fontWeight="700">
              {result.humanScore}%
            </text>
            <text x="64" y="76" textAnchor="middle" fill="#94A3B8" fontSize="12">
              Human
            </text>
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-slate-400 text-[13px] font-medium mb-1">Detection Result</p>
          <h2 className={cn('text-2xl font-bold mb-2', verdictText)}>{verdictLabel}</h2>
          <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[13px] font-medium', verdictBg, verdictText)}>
            <VerdictIcon size={11} />
            {result.humanScore}% Human · {result.aiScore}% AI
          </span>
          <p className="text-slate-500 text-[13px] mt-2">{result.wordCount} words analysed</p>
          {result.likelySources?.length > 0 && result.aiScore > 30 && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-slate-500 text-[13px]">Possible source:</span>
              {result.likelySources.map(src => (
                <span
                  key={src}
                  className="text-[12px] font-medium px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 border border-slate-600"
                >
                  {src}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4">
        <div className="flex justify-between text-[13px] text-slate-400 mb-1.5">
          <span>Definitely AI</span>
          <span>Definitely Human</span>
        </div>
        <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(to right, #EF4444, #F59E0B, #10B981)' }}
            initial={{ width: '0%' }}
            animate={{ width: `${result.humanScore}%` }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
          />
        </div>
        <div className="flex justify-between text-[13px] font-medium mt-1">
          <span className="text-red-400">AI: {result.aiScore}%</span>
          <span className="text-emerald-400">Human: {result.humanScore}%</span>
        </div>
      </div>

      {showHumaniseCta ? (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          type="button"
          onClick={onHumanise}
          className="mt-4 w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl
                     bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold text-[15px]
                     hover:opacity-90 transition-opacity shadow-lg shadow-indigo-500/20"
        >
          <Wand2 size={15} />
          Humanise This Text
        </motion.button>
      ) : showSoftNudge ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-4 flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-slate-700/50 border border-slate-600/50"
        >
          <p className="text-slate-400 text-[14px]">Want to score even lower?</p>
          <button
            type="button"
            onClick={onHumanise}
            className="flex items-center gap-1.5 text-[14px] font-medium text-indigo-400 hover:text-indigo-300 transition-colors shrink-0"
          >
            <Wand2 size={13} />
            Humanise →
          </button>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-4 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20"
        >
          <CheckCircle size={14} className="text-emerald-400" />
          <p className="text-emerald-300 text-[14px] font-medium">This text reads as human-written</p>
        </motion.div>
      )}
    </motion.div>
  )
}

// ── SentenceAnalysis ──────────────────────────────────────────────────────────

function SentenceAnalysis({
  sentences,
  activeSentenceIdx,
  onSentenceClick,
}: {
  sentences: SentenceScore[]
  activeSentenceIdx: number | null
  onSentenceClick: (idx: number) => void
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const [scrolledToBottom, setScrolledToBottom] = useState(false)

  const handleScroll = () => {
    const el = listRef.current
    if (!el) return
    setScrolledToBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 8)
  }

  if (sentences.length === 0) return null

  const classStyles: Record<string, string> = {
    human: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-100',
    mixed: 'bg-amber-500/10 border-amber-500/20 text-amber-100',
    ai: 'bg-red-500/10 border-red-500/20 text-red-100',
  }
  const activeClassStyles: Record<string, string> = {
    human: 'bg-emerald-500/25 border-emerald-500/50 text-emerald-100 ring-1 ring-emerald-500/30',
    mixed: 'bg-amber-500/25 border-amber-500/50 text-amber-100 ring-1 ring-amber-500/30',
    ai: 'bg-red-500/25 border-red-500/50 text-red-100 ring-1 ring-red-500/30',
  }
  const badgeStyles: Record<string, string> = {
    human: 'bg-emerald-500/20 text-emerald-300',
    mixed: 'bg-amber-500/20 text-amber-300',
    ai: 'bg-red-500/20 text-red-300',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="bg-slate-800 border border-slate-700 rounded-2xl p-5"
    >
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h3 className="text-slate-100 font-semibold">Sentence Breakdown</h3>
          <p className="text-slate-400 text-[13px] mt-0.5">Click a sentence to highlight it in your text</p>
        </div>
        <div className="flex gap-2">
          {(['human', 'mixed', 'ai'] as const).map((cls) => (
            <span key={cls} className={cn('text-[13px] px-2 py-0.5 rounded-full font-medium', badgeStyles[cls])}>
              {cls === 'human' ? '✓ Human' : cls === 'mixed' ? '~ Mixed' : '✗ AI'}
            </span>
          ))}
        </div>
      </div>

      <div className="relative">
        <div
          ref={listRef}
          onScroll={handleScroll}
          className="space-y-2 max-h-[380px] overflow-y-auto pr-0.5"
        >
          {sentences.map((s, i) => {
            const isActive = activeSentenceIdx === i
            const hint = getSentenceHint(s.aiProbability)
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.3 }}
                className={cn(
                  'rounded-lg border text-[15px] leading-[1.75] cursor-pointer transition-all duration-150 hover:brightness-110',
                  isActive ? activeClassStyles[s.classification] : classStyles[s.classification],
                )}
                onClick={() => onSentenceClick(i)}
              >
                <div className="flex items-start justify-between gap-3 px-4 py-3">
                  <p className="flex-1">{s.sentence}</p>
                  <div className="flex flex-col items-end gap-1 shrink-0 mt-0.5">
                    <span className={cn('text-[13px] px-2 py-0.5 rounded-full font-semibold', badgeStyles[s.classification])}>
                      {s.aiProbability}% AI
                    </span>
                    <span className={cn('text-[10px] font-medium', hint.color)}>{hint.label}</span>
                  </div>
                </div>
                <AnimatePresence>
                  {isActive && s.reason && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-3 text-[13px] opacity-75 border-t border-current/10 pt-2">
                        {s.reason}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
        {!scrolledToBottom && sentences.length > 4 && (
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-slate-800 to-transparent pointer-events-none rounded-b-lg" />
        )}
      </div>
    </motion.div>
  )
}

// ── FlagsCard ─────────────────────────────────────────────────────────────────

function FlagsCard({ flags }: { flags: DetectionFlag[] }) {
  if (!flags || flags.length === 0) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-800 border border-slate-700 rounded-2xl p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <Flag size={15} className="text-red-400" />
        <h3 className="text-slate-100 font-semibold">Detection Flags</h3>
        <span className="ml-auto text-[13px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">
          {flags.length} signal{flags.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="space-y-3">
        {flags.map((flag, i) => {
          const { bar, badge } = getFlagColor(flag.weightPercent)
          return (
            <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={cn('shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full border', badge)}>{flag.category}</span>
                  <p className="text-slate-300 text-[14px] truncate">{flag.signal}</p>
                </div>
                <span className="shrink-0 text-[13px] font-semibold text-slate-400 tabular-nums">{flag.weightPercent}%</span>
              </div>
              <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                <motion.div
                  className={cn('h-full rounded-full', bar)}
                  initial={{ width: '0%' }}
                  animate={{ width: `${flag.weightPercent}%` }}
                  transition={{ delay: i * 0.04 + 0.1, duration: 0.6, ease: 'easeOut' }}
                />
              </div>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}

// ── LayerScoresCard ───────────────────────────────────────────────────────────

function LayerScoresCard({ scores }: { scores: LayerScores }) {
  if (!scores) return null
  const layers = [
    { label: 'Statistical', description: 'Vocabulary, burstiness, sentence variance', score: scores.statistical, color: 'bg-purple-500' },
    { label: 'Stylometric', description: 'Transitions, passive voice, personal voice', score: scores.stylometric, color: 'bg-indigo-500' },
    { label: 'Semantic', description: 'Bigrams, Zipf deviation, topic coherence', score: scores.semantic, color: 'bg-cyan-500', skipped: scores.semantic === -1 },
  ]
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Layers size={15} className="text-indigo-400" />
        <h3 className="text-slate-100 font-semibold">Layer Breakdown</h3>
        <span className="ml-auto text-[13px] text-slate-500">human score per layer</span>
      </div>
      <div className="space-y-4">
        {layers.map(({ label, description, score, color, skipped }) => (
          <div key={label}>
            <div className="flex items-center justify-between mb-1.5">
              <div>
                <span className="text-slate-200 text-[14px] font-medium">{label}</span>
                <span className="text-slate-500 text-[13px] ml-2">{description}</span>
              </div>
              <span className={cn('text-[14px] font-semibold tabular-nums', skipped ? 'text-slate-500' : score >= 60 ? 'text-emerald-400' : score >= 40 ? 'text-amber-400' : 'text-red-400')}>
                {skipped ? 'Skipped' : `${score}%`}
              </span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              {!skipped && (
                <motion.div className={cn('h-full rounded-full', color)} initial={{ width: '0%' }} animate={{ width: `${score}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
              )}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

// ── MetricsRow ────────────────────────────────────────────────────────────────

function MetricsRow({ metrics, wordCount }: { metrics: DetectionMetrics; wordCount: number }) {
  const cards = [
    { icon: TrendingUp, label: 'AI Vocabulary', value: metrics.perplexityLabel, description: 'AI word density', color: 'text-purple-400' },
    { icon: Zap, label: 'Burstiness', value: metrics.burstinessLabel, description: 'Sentence rhythm variation', color: 'text-indigo-400' },
    { icon: BookOpen, label: 'Vocabulary', value: `${Math.round(metrics.vocabularyDiversity * 100)}% unique`, description: 'Word diversity ratio', color: 'text-cyan-400' },
    { icon: Hash, label: 'Word Count', value: wordCount.toLocaleString(), description: 'Words analysed', color: 'text-emerald-400' },
  ]
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 gap-3">
      {cards.map(({ icon: Icon, label, value, description, color }) => (
        <div key={label} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <Icon size={16} className={cn('mb-2', color)} />
          <p className="text-slate-400 text-[13px] mb-1">{label}</p>
          <p className="text-slate-100 font-semibold text-[14px]">{value}</p>
          <p className="text-slate-500 text-[13px] mt-1">{description}</p>
        </div>
      ))}
    </motion.div>
  )
}

// ── IndicatorsCard ────────────────────────────────────────────────────────────

function IndicatorsCard({ aiIndicators, humanIndicators, analysis }: { aiIndicators: string[]; humanIndicators: string[]; analysis: string }) {
  const copy = async () => {
    await navigator.clipboard.writeText(analysis)
    toast.success('Copied to clipboard!')
  }
  const hasIndicators = (aiIndicators?.length ?? 0) > 0 || (humanIndicators?.length ?? 0) > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-slate-800 border border-slate-700 rounded-2xl p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-slate-100 font-semibold">Detailed Analysis</h3>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1.5 text-[13px] text-slate-300 hover:text-white transition-colors px-2 py-1 rounded hover:bg-slate-700"
        >
          <Copy size={13} />
          Copy
        </button>
      </div>
      <p className="text-slate-300 text-[15px] leading-[1.75]">{analysis}</p>
      {hasIndicators && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-700/50">
          {aiIndicators.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">AI Signals Detected</p>
              <ul className="space-y-1.5">
                {aiIndicators.map((ind, i) => (
                  <li key={i} className="flex items-start gap-2 text-[14px] text-slate-300">
                    <span className="text-red-400 mt-0.5 shrink-0">✗</span>{ind}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {humanIndicators.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">Human Signals Detected</p>
              <ul className="space-y-1.5">
                {humanIndicators.map((ind, i) => (
                  <li key={i} className="flex items-start gap-2 text-[14px] text-slate-300">
                    <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>{ind}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}

// ── Main DetectorPage ─────────────────────────────────────────────────────────

export default function DetectorPage() {
  const { inputText, result, wordCount, setInputText, reset } = useDetectorStore()
  const { detect, isLoading } = useDetector()
  const navigate = useNavigate()
  const sentenceRefs = useRef<(HTMLSpanElement | null)[]>([])
  const [activeSentenceIdx, setActiveSentenceIdx] = useState<number | null>(null)
  const [showTechnical, setShowTechnical] = useState(false)

  useEffect(() => {
    if (activeSentenceIdx !== null && sentenceRefs.current[activeSentenceIdx]) {
      sentenceRefs.current[activeSentenceIdx]!.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [activeSentenceIdx])

  const handleAnalyse = async () => {
    if (wordCount < 50 || isLoading) return
    await detect(inputText)
    setActiveSentenceIdx(null)
  }

  const handleClear = () => {
    reset()
    setActiveSentenceIdx(null)
    setShowTechnical(false)
  }

  const handleHumanise = () => {
    sessionStorage.setItem('humanise_input', inputText)
    navigate('/app/humaniser')
  }

  const handleSentenceClick = (idx: number) => {
    setActiveSentenceIdx(prev => prev === idx ? null : idx)
  }

  return (
    <div className="min-h-0 bg-transparent w-full">
      <main className="w-full px-4 py-6 space-y-4">

        {result?.isLowConfidence && <LowConfidenceBanner />}

        {/* Single persistent layout — never changes shape */}
        <div className="grid grid-cols-1 lg:grid-cols-[13fr_8fr] gap-5 items-start">

          {/* Left: input — always visible, always in same position */}
          <div className="lg:sticky lg:top-4" style={{ height: 'calc(100vh - 7rem)' }}>
            <InputPanel
              text={inputText}
              sentences={result?.sentenceScores ?? []}
              activeSentenceIdx={activeSentenceIdx}
              onSentenceClick={handleSentenceClick}
              onTextChange={setInputText}
              onAnalyse={handleAnalyse}
              onClear={handleClear}
              isLoading={isLoading}
              wordCount={wordCount}
              hasResult={!!result}
              sentenceRefs={sentenceRefs}
              result={result ?? null}
            />
          </div>

          {/* Right: empty state → results, layout stays the same */}
          <div className="space-y-4">
            <AnimatePresence mode="wait">
              {!result ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="hidden lg:block"
                >
                  <EmptyState />
                </motion.div>
              ) : (
                <motion.div
                  key="results"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-4"
                >
                  <CompactScoreCard result={result} onHumanise={handleHumanise} />

                  {result.sentenceScores.length > 0 && (
                    <SentenceAnalysis
                      sentences={result.sentenceScores}
                      activeSentenceIdx={activeSentenceIdx}
                      onSentenceClick={handleSentenceClick}
                    />
                  )}

                  <IndicatorsCard
                    aiIndicators={result.aiIndicators ?? []}
                    humanIndicators={result.humanIndicators ?? []}
                    analysis={result.detailedAnalysis ?? ''}
                  />

                  {/* Technical details — collapsed by default */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowTechnical(prev => !prev)}
                      className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700/50 transition-colors text-[14px]"
                    >
                      <div className="flex items-center gap-2">
                        <Layers size={14} className="text-slate-400" />
                        <span className="font-medium">Technical Details</span>
                        <span className="text-[13px] text-slate-500 hidden sm:inline">Flags · Layer scores · Metrics</span>
                      </div>
                      <ChevronDown
                        size={16}
                        className={cn('text-slate-400 transition-transform duration-200', showTechnical && 'rotate-180')}
                      />
                    </button>
                    <AnimatePresence>
                      {showTechnical && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-4 mt-4">
                            <FlagsCard flags={result.flags ?? []} />
                            <LayerScoresCard scores={result.layerScores} />
                            <MetricsRow metrics={result.metrics} wordCount={result.wordCount} />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Bottom actions */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      onClick={handleClear}
                      className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-800 border border-slate-700/80 text-slate-200 font-medium hover:bg-slate-700 hover:text-white transition-colors text-[15px]"
                    >
                      <RotateCcw size={15} />
                      Clear &amp; Start Over
                    </button>
                    {result.aiScore >= 30 && (
                      <button
                        type="button"
                        onClick={handleHumanise}
                        className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-indigo-500/20 text-[15px]"
                      >
                        <Wand2 size={15} />
                        Humanise This Text
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  )
}
