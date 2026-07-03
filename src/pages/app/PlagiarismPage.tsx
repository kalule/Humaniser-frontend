import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen, AlertTriangle, CheckCircle,
  ExternalLink, ChevronDown, RotateCcw, FileText, Info, Upload, Pencil,
  FileSearch, Download, RotateCw,
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

const VERDICT_HEX: Record<string, string> = {
  green: '#10B981',
  lime:  '#84CC16',
  amber: '#F59E0B',
  red:   '#EF4444',
}

function getVerdictStyle(color: string) {
  switch (color) {
    case 'green': return { text: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', Icon: CheckCircle }
    case 'lime':  return { text: 'text-lime-600',    bg: 'bg-lime-50 border-lime-200',       Icon: CheckCircle }
    case 'amber': return { text: 'text-amber-600',   bg: 'bg-amber-50 border-amber-200',     Icon: AlertTriangle }
    default:      return { text: 'text-red-600',     bg: 'bg-red-50 border-red-200',         Icon: AlertTriangle }
  }
}

function getSimilarityColor(pct: number) {
  if (pct < 20) return 'bg-emerald-500'
  if (pct < 40) return 'bg-lime-500'
  if (pct < 50) return 'bg-amber-500'
  return 'bg-red-500'
}

function getMatchTypeBadge(type: string) {
  switch (type.toLowerCase()) {
    case 'exact':       return 'bg-red-50 text-red-700 border-red-200'
    case 'paraphrased': return 'bg-amber-50 text-amber-700 border-amber-200'
    default:            return 'bg-purple-50 text-purple-700 border-purple-200'
  }
}

// ── Inline highlight helpers ──────────────────────────────────────────────────

interface TextPart {
  text: string
  highlighted: boolean
  matchType: string
}

interface HighlightRange {
  start: number
  end: number
  matchType: string
}

const MATCH_TYPE_SEVERITY: Record<string, number> = { exact: 3, paraphrased: 2, structural: 1 }

function buildHighlightedParts(text: string, sourceMatches: SourceMatch[]): TextPart[] {
  const ranges: HighlightRange[] = []

  for (const match of sourceMatches) {
    for (const seg of match.segments) {
      const snippet = seg.suspectSnippet?.trim()
      if (!snippet || snippet.length < 10) continue

      let idx = text.indexOf(snippet)
      if (idx === -1) idx = text.toLowerCase().indexOf(snippet.toLowerCase())
      if (idx === -1) continue

      ranges.push({ start: idx, end: idx + snippet.length, matchType: seg.matchType })
    }
  }

  if (ranges.length === 0) return [{ text, highlighted: false, matchType: '' }]

  ranges.sort((a, b) => a.start - b.start)
  const merged: HighlightRange[] = []
  for (const r of ranges) {
    const last = merged.at(-1)
    if (last && r.start <= last.end) {
      last.end = Math.max(last.end, r.end)
      if ((MATCH_TYPE_SEVERITY[r.matchType] ?? 0) > (MATCH_TYPE_SEVERITY[last.matchType] ?? 0)) {
        last.matchType = r.matchType
      }
    } else {
      merged.push({ ...r })
    }
  }

  const parts: TextPart[] = []
  let pos = 0
  for (const range of merged) {
    if (range.start > pos) parts.push({ text: text.slice(pos, range.start), highlighted: false, matchType: '' })
    parts.push({ text: text.slice(range.start, range.end), highlighted: true, matchType: range.matchType })
    pos = range.end
  }
  if (pos < text.length) parts.push({ text: text.slice(pos), highlighted: false, matchType: '' })

  return parts
}

function getHighlightClass(matchType: string): string {
  switch (matchType.toLowerCase()) {
    case 'exact':
      return 'bg-rose-100 border-b-2 border-rose-400 rounded-[2px] text-rose-900'
    case 'paraphrased':
      return 'bg-amber-100 border-b-2 border-amber-400 rounded-[2px] text-amber-900'
    default:
      return 'bg-violet-100 border-b-2 border-violet-400 rounded-[2px] text-violet-900'
  }
}

// ── HighlightedTextView ───────────────────────────────────────────────────────

const LEGEND = [
  { label: 'Exact copy',   cls: 'bg-rose-100   border-rose-400'   },
  { label: 'Paraphrased',  cls: 'bg-amber-100  border-amber-400'  },
  { label: 'Structural',   cls: 'bg-violet-100 border-violet-400' },
] as const

function HighlightedTextView({ text, sourceMatches }: { text: string; sourceMatches: SourceMatch[] }) {
  const parts = buildHighlightedParts(text, sourceMatches)
  const hasHighlights = parts.some(p => p.highlighted)

  return (
    <div className="flex-1 overflow-auto flex flex-col min-h-0">
      {hasHighlights && (
        <div className="shrink-0 flex items-center gap-5 px-5 py-2.5 border-b border-gray-100 bg-gray-50">
          {LEGEND.map(({ label, cls }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className={cn('w-3 h-3 rounded-sm border-b-2 shrink-0', cls)} />
              <span className="text-[11px] text-gray-500">{label}</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex-1 overflow-auto px-5 py-4 text-[15px] leading-[1.75] text-gray-800 whitespace-pre-wrap break-words select-text">
        {parts.map((part, i) =>
          part.highlighted ? (
            <mark key={i} className={cn('bg-transparent', getHighlightClass(part.matchType))}>
              {part.text}
            </mark>
          ) : (
            <span key={i}>{part.text}</span>
          )
        )}
      </div>
    </div>
  )
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
      className="bg-white border border-gray-100 rounded-xl overflow-hidden"
    >
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0 flex-1">
            <p className="text-gray-800 text-[14px] font-medium truncate">{match.title || match.domain}</p>
            <a
              href={match.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[12px] text-blue-600 hover:text-blue-700 transition-colors mt-0.5"
            >
              <ExternalLink size={10} />
              {match.domain}
            </a>
          </div>
          <span className={cn(
            'shrink-0 text-[13px] font-semibold px-2.5 py-0.5 rounded-full',
            match.similarityPercent >= 50 ? 'bg-red-50 text-red-700'
              : match.similarityPercent >= 40 ? 'bg-amber-50 text-amber-700'
              : 'bg-emerald-50 text-emerald-700'
          )}>
            {match.similarityPercent}% similar
          </span>
        </div>

        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
          <motion.div
            className={cn('h-full rounded-full', barColor)}
            initial={{ width: '0%' }}
            animate={{ width: `${match.similarityPercent}%` }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: index * 0.06 + 0.1 }}
          />
        </div>

        {match.snippet && (
          <p className="text-gray-500 text-[13px] leading-snug line-clamp-2">{match.snippet}</p>
        )}
      </div>

      {match.segments.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="w-full flex items-center justify-between gap-2 px-4 py-2 text-[13px] text-gray-600 hover:text-gray-900 border-t border-gray-100 transition-colors"
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
                <div className="px-4 pb-3 space-y-3 border-t border-gray-100 pt-3">
                  {match.segments.map((seg, i) => (
                    <div key={i} className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full border capitalize', getMatchTypeBadge(seg.matchType))}>
                          {seg.matchType}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                          <p className="text-[11px] text-red-600 font-semibold mb-1">Your text</p>
                          <p className="text-[13px] text-gray-700 leading-snug">{seg.suspectSnippet}</p>
                        </div>
                        <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                          <p className="text-[11px] text-gray-500 font-semibold mb-1">Source text</p>
                          <p className="text-[13px] text-gray-700 leading-snug">{seg.sourceSnippet}</p>
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

// ── LoadingCard ───────────────────────────────────────────────────────────────

function LoadingCard({ stage }: { stage: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-8 flex flex-col items-center gap-5">
      <div className="relative">
        <svg width="80" height="80" className="-rotate-90">
          <circle cx="40" cy="40" r="32" fill="none" stroke="#e5e7eb" strokeWidth="6" />
          <motion.circle
            cx="40" cy="40" r="32" fill="none" stroke="#111827"
            strokeWidth="6" strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 32}
            strokeDashoffset={2 * Math.PI * 32 * 0.35}
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
            style={{ transformOrigin: '40px 40px' }}
          />
        </svg>
        <BookOpen size={20} className="absolute inset-0 m-auto text-gray-500" />
      </div>
      <div className="text-center">
        <p className="text-gray-800 font-semibold text-[15px]">Checking source integrity</p>
        <motion.p
          key={stage}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-gray-500 text-[13px] mt-1"
        >
          {stage}
        </motion.p>
      </div>
    </div>
  )
}

// ── ResultsEmptyState ─────────────────────────────────────────────────────────

function ResultsEmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 text-center gap-4">
      <FileSearch className="w-8 h-8 text-gray-300" />
      <div>
        <p className="text-sm font-medium text-gray-600">Your source report</p>
        <p className="text-xs text-gray-400 mt-1 leading-relaxed max-w-[220px]">
          Paste text and run a check to see matched sources, similarity scores, and attribution flags.
        </p>
      </div>
      <div className="w-full max-w-xs mt-2 flex flex-col gap-2 opacity-40">
        <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50">
          <div className="w-8 h-8 rounded bg-gray-200 flex-shrink-0" />
          <div className="flex-1 flex flex-col gap-1.5">
            <div className="h-2.5 bg-gray-200 rounded w-3/4" />
            <div className="h-2 bg-gray-200 rounded w-1/2" />
          </div>
          <div className="text-xs font-medium text-gray-400">—%</div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50">
          <div className="w-8 h-8 rounded bg-gray-200 flex-shrink-0" />
          <div className="flex-1 flex flex-col gap-1.5">
            <div className="h-2.5 bg-gray-200 rounded w-2/3" />
            <div className="h-2 bg-gray-200 rounded w-2/5" />
          </div>
          <div className="text-xs font-medium text-gray-400">—%</div>
        </div>
      </div>
    </div>
  )
}

// ── SimilarityBadge ───────────────────────────────────────────────────────────

function SimilarityBadge({ overallPct }: { overallPct: number }) {
  const { bg, text, label } =
    overallPct >= 30 ? { bg: 'bg-red-50',    text: 'text-red-600',    label: 'High similarity' } :
    overallPct >= 15 ? { bg: 'bg-amber-50',  text: 'text-amber-600',  label: 'Some similarity' } :
                       { bg: 'bg-green-50',  text: 'text-green-600',  label: 'Low similarity'  }

  return (
    <div className={cn('flex items-center justify-between px-4 py-3 border-b border-gray-100', bg)}>
      <div>
        <p className={cn('text-sm font-medium', text)}>{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">Overall text similarity score</p>
      </div>
      <span className={cn('text-2xl font-medium', text)}>{overallPct}%</span>
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

  const [editMode, setEditMode] = useState(false)

  useEffect(() => {
    if (result) setEditMode(false)
  }, [result])

  const highlightParts = useMemo(() => {
    if (!result || result.sourceMatches.length === 0) return null
    const hasSegments = result.sourceMatches.some(m => m.segments.length > 0)
    if (!hasSegments) return null
    const parts = buildHighlightedParts(inputText, result.sourceMatches)
    return parts.some(p => p.highlighted) ? parts : null
  }, [result, inputText])

  const showHighlights = !!highlightParts && !editMode

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

  const handleExport = () => {
    if (!result) return
    const lines = [
      'Source Check Report',
      '==================',
      `Originality Score: ${result.originalityScore}%`,
      `Similarity Score: ${result.similarityScore}%`,
      `Verdict: ${result.verdict}`,
      `Words Checked: ${result.wordCount}`,
      `Sources Searched: ${result.sourcesSearched}`,
      '',
      'Analysis:',
      result.analysis,
      '',
      `Matched Sources (${result.sourceMatches.length}):`,
      ...result.sourceMatches.map((m, i) =>
        `${i + 1}. ${m.title || m.domain} — ${m.similarityPercent}% similar\n   ${m.url}`
      ),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'source-check-report.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  const verdictStyle     = result ? getVerdictStyle(result.verdictColor) : null
  const VerdictIcon      = verdictStyle?.Icon ?? CheckCircle
  const isHighSimilarity = result ? result.similarityScore > 50 : false
  const hasResults       = !!result && !isLoading

  return (
    <div className="min-h-0 bg-transparent px-4 py-6 w-full space-y-5">

      {/* Page heading */}
      <div>
        <h1 className="text-xl font-medium text-gray-900">Source Check</h1>
        <p className="text-sm text-gray-400 mt-1">
          Checks against web sources and academic databases for unacknowledged similarity.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[13fr_8fr] gap-5 items-start">

        {/* Left — input / highlighted view */}
        <div className="lg:sticky lg:top-4" style={{ height: 'calc(100vh - 11rem)' }}>
          <div
            className="bg-white border border-gray-100 rounded-xl overflow-hidden flex flex-col h-full relative"
            {...(showHighlights ? {} : dragHandlers)}
          >
            {fileInputElement}
            {!showHighlights && <DropOverlay isDragging={isDragging} isProcessing={isFileProcessing} />}

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2 text-gray-700 font-medium text-[14px]">
                <FileText size={14} className="text-gray-400" />
                Your text
                {wordCount > 0 && (
                  <span className="ml-1 text-xs font-normal text-gray-400">{wordCount} words</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {showHighlights && (
                  <button
                    type="button"
                    onClick={() => setEditMode(true)}
                    className="flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-gray-800 transition-colors"
                  >
                    <Pencil size={12} />
                    Edit text
                  </button>
                )}

                {!showHighlights && !inputText && (
                  <button
                    type="button"
                    onClick={() => setInputText(SAMPLE_TEXT)}
                    className="text-[13px] text-blue-500 hover:underline transition-colors"
                  >
                    Try sample
                  </button>
                )}

                {!showHighlights && (
                  <button
                    type="button"
                    onClick={openFilePicker}
                    disabled={isLoading || isFileProcessing}
                    className="flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40"
                  >
                    <Upload size={12} />
                    Upload
                  </button>
                )}
              </div>
            </div>

            {/* Body — highlighted view OR editable textarea */}
            <AnimatePresence mode="wait">
              {showHighlights ? (
                <motion.div
                  key="highlights"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex-1 min-h-0 flex flex-col"
                >
                  <HighlightedTextView text={inputText} sourceMatches={result!.sourceMatches} />
                </motion.div>
              ) : (
                <motion.textarea
                  key="textarea"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Paste the text you want to check. Minimum 50 words for accurate detection."
                  className="flex-1 w-full bg-white text-gray-800 placeholder:text-gray-400 resize-none focus:outline-none px-5 py-4 text-[15px] leading-[1.75]"
                />
              )}
            </AnimatePresence>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-3 shrink-0">
              <span className="text-[13px] text-gray-400">
                {wordCount > 0 && wordCount < 50
                  ? `${50 - wordCount} more words needed`
                  : 'Min. 50 words'}
              </span>
              <div className="flex items-center gap-3">
                {(inputText || result) && (
                  <button
                    type="button"
                    onClick={() => { reset(); setEditMode(false) }}
                    className="flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-gray-700 transition-colors"
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
                    'flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors',
                    !canCheck
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-900 text-white hover:bg-gray-800',
                  )}
                >
                  {isLoading ? (
                    <>
                      <RotateCw size={14} className="animate-spin" />
                      Checking…
                    </>
                  ) : (
                    'Check sources'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right — results panel */}
        <div className="lg:sticky lg:top-4" style={{ height: 'calc(100vh - 11rem)' }}>
          <div className="flex flex-col bg-white border border-gray-100 rounded-xl overflow-hidden h-full">

            {/* Persistent panel header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 shrink-0">
              <span className="text-sm font-medium text-gray-700">Source report</span>
              {hasResults && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">
                    {result!.sourceMatches.length} source{result!.sourceMatches.length !== 1 ? 's' : ''} found
                  </span>
                  <button
                    onClick={handleExport}
                    className="flex items-center gap-1 text-xs text-blue-500 hover:underline"
                  >
                    <Download size={12} />
                    Export
                  </button>
                </div>
              )}
            </div>

            <AnimatePresence mode="wait">
              {!result && !isLoading ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 flex flex-col min-h-0"
                >
                  <ResultsEmptyState />
                </motion.div>
              ) : isLoading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 p-5"
                >
                  <LoadingCard stage={loadingStage} />
                </motion.div>
              ) : result && (
                <motion.div
                  key="results"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex-1 overflow-y-auto min-h-0"
                >
                  {/* Similarity badge — pinned at top of results body */}
                  <SimilarityBadge overallPct={result.similarityScore} />

                  <div className="space-y-4 p-4 pb-6">
                    {/* Score card */}
                    <div className="bg-white border border-gray-100 rounded-xl p-5">
                      <div className="flex items-center gap-5">
                        <div className="shrink-0">
                          <ScoreCircle
                            score={result.originalityScore}
                            size="md"
                            showLabel={false}
                            colorOverride={isHighSimilarity ? '#EF4444' : VERDICT_HEX[result.verdictColor]}
                          />
                          <div className="text-center mt-1">
                            <p className="text-gray-900 font-bold text-xl">{result.originalityScore}%</p>
                            <p className="text-gray-500 text-[12px]">Original</p>
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-gray-500 text-[13px] mb-1">Source Integrity Result</p>
                          <h2 className={cn('text-2xl font-bold mb-2', isHighSimilarity ? 'text-red-600' : verdictStyle!.text)}>
                            {result.verdict}
                          </h2>
                          <span className={cn(
                            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[13px] font-medium',
                            isHighSimilarity
                              ? 'bg-red-50 border-red-200 text-red-700'
                              : cn(verdictStyle!.bg, verdictStyle!.text),
                          )}>
                            <VerdictIcon size={11} />
                            {result.similarityScore}% similarity detected
                          </span>
                          <p className="text-gray-400 text-[13px] mt-2">
                            {result.sourcesSearched} sources searched · {result.wordCount} words checked
                          </p>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="flex justify-between text-[13px] text-gray-500 mb-1.5">
                          <span>High similarity</span>
                          <span>Fully original</span>
                        </div>
                        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
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

                    {/* Warnings */}
                    {(result.isNoSourcesFound || result.sourcesSearched === 0) ? (
                      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
                        <AlertTriangle size={15} className="text-amber-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-amber-700 text-[13px] font-semibold mb-0.5">
                            Cannot determine plagiarism — no sources retrieved
                          </p>
                          <p className="text-amber-600 text-[12px]">
                            The web search returned no results. This is usually a missing or invalid SerpAPI key. This result does <strong>not</strong> mean the text is original — manual verification is required.
                          </p>
                        </div>
                      </div>
                    ) : result.isLowConfidence && (
                      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
                        <Info size={15} className="text-amber-500 mt-0.5 shrink-0" />
                        <p className="text-amber-700 text-[13px]">
                          Short text (under 100 words) limits detection accuracy. For best results paste at least 200 words.
                        </p>
                      </div>
                    )}

                    {/* Analysis */}
                    <div className="bg-white border border-gray-100 rounded-xl p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-gray-900 font-semibold">Analysis</h3>
                        <button
                          type="button"
                          onClick={handleCopy}
                          className="text-[13px] text-gray-500 hover:text-gray-900 transition-colors px-2 py-1 rounded hover:bg-gray-100"
                        >
                          Copy summary
                        </button>
                      </div>
                      <p className="text-gray-700 text-[15px] leading-[1.75]">{result.analysis}</p>
                    </div>

                    {/* Source matches */}
                    {result.sourceMatches.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-gray-900 font-semibold">
                          Matched Sources
                          <span className="ml-2 text-[13px] font-normal text-gray-500">
                            {result.sourceMatches.length} found
                          </span>
                        </h3>
                        {result.sourceMatches.map((match, i) => (
                          <SourceMatchCard key={match.url} match={match} index={i} />
                        ))}
                      </div>
                    )}

                    {result.sourceMatches.length === 0 && result.similarityScore < 20 && !result.isNoSourcesFound && result.sourcesSearched > 0 && (
                      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200">
                        <CheckCircle size={15} className="text-emerald-500 shrink-0" />
                        <p className="text-emerald-700 text-[14px]">No matching web sources found. This text appears to be original.</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </div>

      </div>
    </div>
  )
}
