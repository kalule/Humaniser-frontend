import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  ChevronRight,
  RotateCcw,
  Sparkles,
  CheckCircle,
  FileText,
  Wand2,
  ArrowRight,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { ScoreCircle } from '../ui/ScoreCircle'
import { VerdictBadge } from '../ui/VerdictBadge'
import type { DetectResponse } from '../../types/detector'

interface DetectionPanelProps {
  isOpen: boolean
  onToggle: () => void
  result: DetectResponse | null
  isLoading: boolean
  scanSource: 'input' | 'output'
  onScanSourceChange: (src: 'input' | 'output') => void
  onScan: () => void
  onHumanise: () => void
  previousScore: number | null
  isMobile: boolean
  hasOutput: boolean
  hasInput: boolean
}

// ── Score improvement banner ───────────────────────────────────────────────
function ImprovementBanner({ before, after }: { before: number; after: number }) {
  const delta = after - before
  if (delta <= 0) return null
  return (
    <div className="flex items-center gap-2 bg-emerald-500/10 rounded-lg px-3 py-2 mb-3 text-xs">
      <span className="text-slate-400">Before:</span>
      <span className="text-red-400 font-semibold">{before}%</span>
      <ArrowRight size={10} className="text-slate-500 shrink-0" />
      <span className="text-slate-400">After:</span>
      <span className="text-emerald-400 font-semibold">{after}%</span>
      <span className="ml-auto bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-semibold">
        +{delta}pts
      </span>
    </div>
  )
}

// ── Mini sentence row ──────────────────────────────────────────────────────
function SentenceRow({ sentence, aiProbability, classification }: {
  sentence: string
  aiProbability: number
  classification: string
}) {
  const borderColor =
    aiProbability > 70 ? 'border-red-500' :
    aiProbability > 40 ? 'border-amber-500' : 'border-emerald-500'
  const badgeColor =
    aiProbability > 70 ? 'bg-red-500/20 text-red-400' :
    aiProbability > 40 ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
  const label = classification === 'ai'
    ? `${aiProbability}% AI`
    : classification === 'mixed'
      ? `${aiProbability}% AI`
      : `${100 - aiProbability}% Human`

  const preview = sentence.length > 60 ? sentence.slice(0, 60) + '…' : sentence

  return (
    <div className={cn('flex items-center gap-2 px-3 py-2 bg-slate-700/50 rounded-lg mb-1.5 border-l-2', borderColor)}>
      <p className="flex-1 text-xs text-slate-300 leading-snug truncate">{preview}</p>
      <span className={cn('shrink-0 text-xs px-1.5 py-0.5 rounded font-semibold', badgeColor)}>
        {label}
      </span>
    </div>
  )
}

// ── Collapsed sidebar strip ────────────────────────────────────────────────
function CollapsedStrip({ onToggle, hasResult, humanScore }: {
  onToggle: () => void
  hasResult: boolean
  humanScore: number
}) {
  const color = hasResult
    ? humanScore >= 80 ? 'text-emerald-400'
      : humanScore >= 60 ? 'text-lime-400'
      : humanScore >= 40 ? 'text-amber-400'
      : 'text-red-400'
    : 'text-slate-500'

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label="Expand detection score panel"
      className="flex flex-col items-center justify-between h-full py-4 px-3
                 hover:bg-slate-700/30 transition-colors cursor-pointer group"
    >
      <Shield size={16} className={cn('shrink-0', color)} />
      <span
        className="text-xs font-medium text-slate-500 group-hover:text-slate-400
                   transition-colors select-none"
        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
      >
        {hasResult ? `${humanScore}% Human` : 'Detection Score'}
      </span>
      <ChevronRight size={14} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
    </button>
  )
}

// ── Scan source toggle ─────────────────────────────────────────────────────
function ScanSourceToggle({
  value, onChange, hasOutput,
}: {
  value: 'input' | 'output'
  onChange: (v: 'input' | 'output') => void
  hasOutput: boolean
}) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-slate-700 mb-3">
      <button
        type="button"
        onClick={() => onChange('input')}
        className={cn(
          'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors',
          value === 'input'
            ? 'bg-slate-700 text-white'
            : 'bg-transparent text-slate-400 hover:text-slate-300',
        )}
      >
        <FileText size={11} />
        Input Text
      </button>
      <button
        type="button"
        onClick={() => hasOutput && onChange('output')}
        title={!hasOutput ? 'Humanise your text first' : undefined}
        className={cn(
          'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors',
          value === 'output'
            ? 'bg-slate-700 text-white'
            : 'bg-transparent text-slate-400',
          !hasOutput ? 'opacity-40 cursor-not-allowed' : 'hover:text-slate-300',
        )}
      >
        <Wand2 size={11} />
        Output Text
      </button>
    </div>
  )
}

// ── Main DetectionPanel ────────────────────────────────────────────────────
export function DetectionPanel({
  isOpen,
  onToggle,
  result,
  isLoading,
  scanSource,
  onScanSourceChange,
  onScan,
  onHumanise,
  previousScore,
  isMobile,
  hasOutput,
  hasInput,
}: DetectionPanelProps) {
  const navigate = useNavigate()

  const handleViewFull = () => {
    if (result) {
      sessionStorage.setItem('detector_prefill', result.detailedAnalysis)
    }
    navigate('/app/detector')
  }

  // ── Determine content state ──────────────────────────────────────────────
  const panelState: 'empty' | 'loading' | 'results' =
    isLoading ? 'loading' : result ? 'results' : 'empty'

  // Sort sentences by AI probability desc, take top 3
  const topSentences = result
    ? [...result.sentenceScores]
        .sort((a, b) => b.aiProbability - a.aiProbability)
        .slice(0, 3)
    : []

  const showHumaniseBtn = result && result.humanScore < 60 && scanSource === 'input'
  const showReHumaniseBtn = result && result.humanScore < 60 && scanSource === 'output'
  const showLooksHuman = result && result.humanScore >= 80

  // ── Panel content (shared between mobile and desktop) ───────────────────
  const panelContent = (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      {!isMobile && (
        <div className="flex items-center justify-between px-4 border-b border-slate-700 h-12 shrink-0">
          <div className="flex items-center gap-2">
            <Shield size={14} className="text-emerald-400" />
            <span className="text-sm font-semibold text-slate-200">Detection Score</span>
          </div>
          <button
            type="button"
            onClick={onToggle}
            aria-label="Collapse panel"
            className="text-slate-500 hover:text-slate-300 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <AnimatePresence mode="wait">
          {/* ── Empty state ─────────────────────────────────────────── */}
          {panelState === 'empty' && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center text-center gap-3"
            >
              <ScoreCircle score={0} size="sm" animated={false} />
              <p className="text-slate-400 font-medium text-sm">No score yet</p>
              <p className="text-slate-500 text-xs leading-relaxed">
                Check your text for AI patterns before or after humanising
              </p>

              <div className="w-full">
                <ScanSourceToggle
                  value={scanSource}
                  onChange={onScanSourceChange}
                  hasOutput={hasOutput}
                />
                <button
                  type="button"
                  onClick={onScan}
                  disabled={scanSource === 'input' ? !hasInput : !hasOutput}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg
                             bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold
                             transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Shield size={14} />
                  Check for AI
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Loading state ────────────────────────────────────────── */}
          {panelState === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="relative">
                <svg width="80" height="80" className="-rotate-90">
                  <circle cx="40" cy="40" r="32" fill="none" stroke="#1e293b" strokeWidth="6" />
                  <motion.circle
                    cx="40" cy="40" r="32"
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 32}
                    strokeDashoffset={2 * Math.PI * 32 * 0.3}
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                    style={{ transformOrigin: '40px 40px' }}
                  />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-slate-300 text-sm font-medium">Analysing text…</p>
                <div className="flex items-center justify-center gap-1 mt-2">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Results state ────────────────────────────────────────── */}
          {panelState === 'results' && result && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-3"
            >
              {/* Improvement banner */}
              {previousScore !== null && (
                <ImprovementBanner before={previousScore} after={result.humanScore} />
              )}

              {/* Score circle + verdict */}
              <div className="flex flex-col items-center gap-2">
                <ScoreCircle score={result.humanScore} size="sm" />
                <VerdictBadge
                  verdict={result.verdict}
                  humanScore={result.humanScore}
                  size="sm"
                />
                <p className="text-slate-500 text-xs">
                  Scanned: {scanSource === 'input' ? 'Input text' : 'Output text'}
                </p>
              </div>

              {/* Scan source toggle (for re-scan) */}
              <ScanSourceToggle
                value={scanSource}
                onChange={onScanSourceChange}
                hasOutput={hasOutput}
              />

              {/* Top sentences */}
              {topSentences.length > 0 && (
                <div>
                  {topSentences.map((s, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06, duration: 0.3 }}
                    >
                      <SentenceRow
                        sentence={s.sentence}
                        aiProbability={s.aiProbability}
                        classification={s.classification}
                      />
                    </motion.div>
                  ))}
                  <button
                    type="button"
                    onClick={handleViewFull}
                    className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300
                               transition-colors mt-1 ml-1"
                  >
                    View full analysis
                    <ArrowRight size={10} />
                  </button>
                </div>
              )}

              {/* Metrics row */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-700/50 rounded-lg p-2 text-xs">
                  <div className="flex items-center gap-1 text-slate-400 mb-0.5">
                    <TrendingUp size={10} />
                    Perplexity
                  </div>
                  <p className="text-white font-medium">{result.metrics.perplexityLabel}</p>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-2 text-xs">
                  <div className="flex items-center gap-1 text-slate-400 mb-0.5">
                    <Zap size={10} />
                    Burstiness
                  </div>
                  <p className="text-white font-medium">{result.metrics.burstinessLabel}</p>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-slate-700" />

              {/* Action buttons */}
              <div className="space-y-2">
                {/* Scan again */}
                <button
                  type="button"
                  onClick={onScan}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm
                             bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-200
                             transition-colors"
                >
                  <RotateCcw size={13} />
                  Scan Again
                </button>

                {/* Conditional action */}
                {showHumaniseBtn && (
                  <button
                    type="button"
                    onClick={onHumanise}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm
                               bg-indigo-600 hover:bg-indigo-500 text-white font-semibold
                               transition-colors"
                  >
                    <Sparkles size={13} />
                    Humanise Now →
                  </button>
                )}

                {showReHumaniseBtn && (
                  <button
                    type="button"
                    onClick={onHumanise}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm
                               bg-indigo-600 hover:bg-indigo-500 text-white font-semibold
                               transition-colors"
                  >
                    <Sparkles size={13} />
                    Re-humanise →
                  </button>
                )}

                {showLooksHuman && (
                  <div className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm
                                  bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <CheckCircle size={13} />
                    ✓ Looks Human
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )

  // ── Mobile layout: full-width panel below output ─────────────────────────
  if (isMobile) {
    return (
      <div className="w-full border-t border-slate-700 bg-slate-800/50 min-h-[200px]">
        <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
          <Shield size={14} className="text-emerald-400" />
          <span className="text-sm font-semibold text-slate-200">Detection Score</span>
        </div>
        {panelContent}
      </div>
    )
  }

  // ── Desktop layout: collapsible sidebar ──────────────────────────────────
  return (
    <motion.div
      animate={{ width: isOpen ? 280 : 48, opacity: isOpen ? 1 : 0.85 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="shrink-0 h-full border-l border-slate-700 bg-slate-800/40 flex flex-col overflow-hidden"
      style={{ minHeight: 0 }}
    >
      {isOpen ? (
        <AnimatePresence mode="wait">
          <motion.div
            key="expanded"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col h-full w-[280px]"
          >
            {panelContent}
          </motion.div>
        </AnimatePresence>
      ) : (
        <CollapsedStrip
          onToggle={onToggle}
          hasResult={!!result}
          humanScore={result?.humanScore ?? 0}
        />
      )}
    </motion.div>
  )
}
