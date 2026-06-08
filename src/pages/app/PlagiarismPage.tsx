import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen, Shield, AlertTriangle, CheckCircle,
  ExternalLink, ChevronDown, RotateCcw, FileText, Info, Upload,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { usePlagiarismStore } from '../../store/plagiarismStore'
import { usePlagiarism } from '../../hooks/usePlagiarism'
import { useDragDrop } from '../../hooks/useDragDrop'
import { DropOverlay } from '../../components/ui/DropOverlay'
import { ScoreCircle } from '../../components/ui/ScoreCircle'
import type { SourceMatch } from '../../types/plagiarism'
import { cn } from '../../lib/utils'

const SAMPLE_TEXT =
  `The HIV/AIDS epidemic has had a profound impact on Africa, shaping the continent's social, political, and economic landscape. African engagements with HIV/AIDS have been multifaceted, encompassing a range of responses and approaches that have evolved over time. One key aspect of this engagement has been the role of religion, particularly Christianity and Islam, in shaping the social dynamics around health, governance, and development. Religious beliefs and practices have influenced attitudes, beliefs, and behaviors related to HIV/AIDS, and faith-based organizations have played a significant role in providing care, support, and advocacy in the response to the epidemic.`

// ── Score helpers ─────────────────────────────────────────────────────────────

function getVerdictStyle(color: string) {
  switch (color) {
    case 'green': return { text: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30', Icon: CheckCircle }
    case 'lime':  return { text: 'text-lime-400',    bg: 'bg-lime-500/15 border-lime-500/30',       Icon: CheckCircle }
    case 'amber': return { text: 'text-amber-400',   bg: 'bg-amber-500/15 border-amber-500/30',     Icon: AlertTriangle }
    default:      return { text: 'text-red-400',     bg: 'bg-red-500/15 border-red-500/30',         Icon: AlertTriangle }
  }
}

function getSimilarityColor(pct: number) {
  if (pct < 20) return 'bg-emerald-500'
  if (pct < 40) return 'bg-lime-500'
  if (pct < 60) return 'bg-amber-500'
  return 'bg-red-500'
}

function getMatchTypeBadge(type: string) {
  switch (type.toLowerCase()) {
    case 'exact':       return 'bg-red-500/20 text-red-300 border-red-500/30'
    case 'paraphrased': return 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    default:            return 'bg-purple-500/20 text-purple-300 border-purple-500/30'
  }
}

// ── SourceMatchCard ───────────────────────────────────────────────────────────

function SourceMatchCard({ match, index }: { match: SourceMatch; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const barColor = getSimilarityColor(match.similarityPercent)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden"
    >
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0 flex-1">
            <p className="text-slate-200 text-[14px] font-medium truncate">{match.title || match.domain}</p>
            <a
              href={match.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[12px] text-indigo-400 hover:text-indigo-300 transition-colors mt-0.5"
            >
              <ExternalLink size={10} />
              {match.domain}
            </a>
          </div>
          <span className={cn(
            'shrink-0 text-[13px] font-semibold px-2.5 py-0.5 rounded-full',
            match.similarityPercent >= 60 ? 'bg-red-500/20 text-red-300'
              : match.similarityPercent >= 40 ? 'bg-amber-500/20 text-amber-300'
              : 'bg-emerald-500/20 text-emerald-300'
          )}>
            {match.similarityPercent}% similar
          </span>
        </div>

        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden mb-2">
          <motion.div
            className={cn('h-full rounded-full', barColor)}
            initial={{ width: '0%' }}
            animate={{ width: `${match.similarityPercent}%` }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: index * 0.06 + 0.1 }}
          />
        </div>

        {match.snippet && (
          <p className="text-slate-500 text-[13px] leading-snug line-clamp-2">{match.snippet}</p>
        )}
      </div>

      {match.segments.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="w-full flex items-center justify-between gap-2 px-4 py-2 text-[13px] text-slate-300 hover:text-white border-t border-slate-700/50 transition-colors"
          >
            <span>{match.segments.length} matched segment{match.segments.length !== 1 ? 's' : ''}</span>
            <ChevronDown size={14} className={cn('transition-transform duration-200', expanded && 'rotate-180')} />
          </button>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-3 space-y-3 border-t border-slate-700/50 pt-3">
                  {match.segments.map((seg, i) => (
                    <div key={i} className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full border capitalize', getMatchTypeBadge(seg.matchType))}>
                          {seg.matchType}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="bg-red-500/8 border border-red-500/20 rounded-lg px-3 py-2">
                          <p className="text-[11px] text-red-400 font-semibold mb-1">Your text</p>
                          <p className="text-[13px] text-slate-300 leading-snug">{seg.suspectSnippet}</p>
                        </div>
                        <div className="bg-slate-700/40 border border-slate-600 rounded-lg px-3 py-2">
                          <p className="text-[11px] text-slate-500 font-semibold mb-1">Source text</p>
                          <p className="text-[13px] text-slate-300 leading-snug">{seg.sourceSnippet}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </motion.div>
  )
}

// ── LoadingOverlay ────────────────────────────────────────────────────────────

function LoadingCard({ stage }: { stage: string }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 flex flex-col items-center gap-5">
      <div className="relative">
        <svg width="80" height="80" className="-rotate-90">
          <circle cx="40" cy="40" r="32" fill="none" stroke="#1e293b" strokeWidth="6" />
          <motion.circle
            cx="40" cy="40" r="32" fill="none" stroke="#6366f1"
            strokeWidth="6" strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 32}
            strokeDashoffset={2 * Math.PI * 32 * 0.35}
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
            style={{ transformOrigin: '40px 40px' }}
          />
        </svg>
        <BookOpen size={20} className="absolute inset-0 m-auto text-indigo-400" />
      </div>
      <div className="text-center">
        <p className="text-slate-200 font-semibold text-[15px]">Checking for plagiarism</p>
        <motion.p
          key={stage}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-slate-400 text-[13px] mt-1"
        >
          {stage}
        </motion.p>
      </div>
    </div>
  )
}

// ── Main PlagiarismPage ───────────────────────────────────────────────────────

export default function PlagiarismPage() {
  const { inputText, result, setInputText, reset } = usePlagiarismStore()
  const { check, isLoading, loadingStage } = usePlagiarism()

  const { isDragging, isProcessing: isFileProcessing, dragHandlers, openFilePicker, fileInputElement } = useDragDrop({
    onText: (t) => setInputText(t),
    disabled: isLoading,
  })

  const wordCount = inputText.trim().split(/\s+/).filter(Boolean).length
  const canCheck  = wordCount >= 50 && !isLoading

  const handleCheck = () => {
    if (!canCheck) return
    check(inputText)
  }

  const handleCopy = async () => {
    if (!result) return
    const summary = `Originality: ${result.originalityScore}% | Verdict: ${result.verdict}\n\nAnalysis: ${result.analysis}`
    await navigator.clipboard.writeText(summary)
    toast.success('Summary copied!')
  }

  const verdictStyle  = result ? getVerdictStyle(result.verdictColor) : null
  const VerdictIcon   = verdictStyle?.Icon ?? CheckCircle

  return (
    <div className="min-h-0 bg-transparent w-full">
      <main className="w-full px-4 py-6 space-y-5">

        <div className="grid grid-cols-1 lg:grid-cols-[13fr_8fr] gap-5 items-start">

          {/* Left — input (sticky on desktop) */}
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
                  <span className={cn(
                    'text-[13px] font-medium px-2.5 py-1 rounded-full',
                    wordCount === 0     ? 'bg-slate-700 text-slate-400'
                    : wordCount < 50    ? 'bg-red-500/15 text-red-400'
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
                placeholder="Paste the text you want to check. Minimum 50 words for accurate detection..."
                className="flex-1 w-full bg-transparent text-slate-200 placeholder:text-slate-500 resize-none focus:outline-none px-5 py-4 text-[15px] leading-[1.75]"
              />

              <div className="px-5 py-3 border-t border-slate-700/50 flex items-center justify-between gap-3 shrink-0">
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
                    onClick={handleCheck}
                    disabled={!canCheck}
                    className={cn(
                      'flex items-center gap-2 px-5 py-2.5 rounded-xl text-[15px] font-semibold transition-all',
                      'bg-gradient-to-r from-indigo-600 to-purple-600 text-white',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      canCheck && 'hover:opacity-90 shadow shadow-indigo-500/20',
                    )}
                  >
                    {isLoading ? (
                      <>
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}>
                          <BookOpen size={14} />
                        </motion.div>
                        Checking…
                      </>
                    ) : (
                      <>
                        <Shield size={14} />
                        {result ? 'Re-check' : 'Check for Plagiarism'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right — results */}
          <div className="space-y-4">
            <AnimatePresence mode="wait">
              {!result && !isLoading ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="bg-slate-800/40 border border-slate-700/50 border-dashed rounded-2xl p-8 flex flex-col items-center text-center gap-4"
                  style={{ minHeight: 360 }}
                >
                  <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center">
                    <BookOpen size={24} className="text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-slate-200 font-semibold text-[15px]">Results appear here</p>
                    <p className="text-slate-500 text-[13px] mt-1 max-w-xs">
                      Searches the web in real-time and uses AI to detect exact copying, paraphrasing, and structural mirroring
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 w-full max-w-xs text-left">
                    {['Searches live web sources', 'Detects paraphrasing, not just exact matches', 'Sentence-level match breakdown'].map(f => (
                      <div key={f} className="flex items-center gap-2 text-[13px] text-slate-400">
                        <CheckCircle size={13} className="text-indigo-400 shrink-0" />
                        {f}
                      </div>
                    ))}
                  </div>
                </motion.div>
              ) : isLoading ? (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <LoadingCard stage={loadingStage} />
                </motion.div>
              ) : result && (
                <motion.div
                  key="results"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  {/* Score card */}
                  <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
                    <div className="flex items-center gap-5">
                      <div className="shrink-0">
                        <ScoreCircle score={result.originalityScore} size="md" showLabel={false} />
                        <div className="text-center mt-1">
                          <p className="text-white font-bold text-xl">{result.originalityScore}%</p>
                          <p className="text-slate-400 text-[12px]">Original</p>
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-slate-400 text-[13px] mb-1">Plagiarism Check Result</p>
                        <h2 className={cn('text-2xl font-bold mb-2', verdictStyle!.text)}>{result.verdict}</h2>
                        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[13px] font-medium', verdictStyle!.bg, verdictStyle!.text)}>
                          <VerdictIcon size={11} />
                          {result.similarityScore}% similarity detected
                        </span>
                        <p className="text-slate-500 text-[13px] mt-2">
                          {result.sourcesSearched} sources searched · {result.wordCount} words checked
                        </p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="flex justify-between text-[13px] text-slate-400 mb-1.5">
                        <span>High similarity</span>
                        <span>Fully original</span>
                      </div>
                      <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: 'linear-gradient(to right, #EF4444, #F59E0B, #10B981)' }}
                          initial={{ width: '0%' }}
                          animate={{ width: `${result.originalityScore}%` }}
                          transition={{ duration: 1.2, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Low confidence banner */}
                  {result.isLowConfidence && (
                    <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/25">
                      <Info size={15} className="text-amber-400 mt-0.5 shrink-0" />
                      <p className="text-amber-300 text-[13px]">
                        Short text (under 100 words) limits detection accuracy. For best results paste at least 200 words.
                      </p>
                    </div>
                  )}

                  {/* Analysis */}
                  <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-slate-100 font-semibold">Analysis</h3>
                      <button
                        type="button"
                        onClick={handleCopy}
                        className="text-[13px] text-slate-300 hover:text-white transition-colors px-2 py-1 rounded hover:bg-slate-700"
                      >
                        Copy summary
                      </button>
                    </div>
                    <p className="text-slate-300 text-[15px] leading-[1.75]">{result.analysis}</p>
                  </div>

                  {/* Source matches */}
                  {result.sourceMatches.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-slate-100 font-semibold">
                          Matched Sources
                          <span className="ml-2 text-[13px] font-normal text-slate-500">
                            {result.sourceMatches.length} found
                          </span>
                        </h3>
                      </div>
                      {result.sourceMatches.map((match, i) => (
                        <SourceMatchCard key={match.url} match={match} index={i} />
                      ))}
                    </div>
                  )}

                  {result.sourceMatches.length === 0 && result.similarityScore < 20 && (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <CheckCircle size={15} className="text-emerald-400 shrink-0" />
                      <p className="text-emerald-300 text-[14px]">No matching web sources found. This text appears to be original.</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

      </main>
    </div>
  )
}
