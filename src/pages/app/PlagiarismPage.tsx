import { useState, useMemo, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen, AlertTriangle, CheckCircle,
  ExternalLink, ChevronDown, FileText, Upload, Clipboard, Pencil,
  FileSearch, Download, RotateCw, Copy,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { usePlagiarismStore } from '../../store/plagiarismStore'
import { usePlagiarism } from '../../hooks/usePlagiarism'
import { useDragDrop } from '../../hooks/useDragDrop'
import { DropOverlay } from '../../components/ui/DropOverlay'
import { ScoreCircle } from '../../components/ui/ScoreCircle'
import { OutputActionButton } from '../../components/ui/OutputActionButton'
import { ConfidenceCaveat } from '../../components/ui/ConfidenceCaveat'
import { ClearButton } from '../../components/ui/ClearButton'
import { UtilityButton } from '../../components/ui/UtilityButton'
import { PanelLabel } from '../../components/ui/PanelLabel'
import { Skeleton } from '../../components/ui/Skeleton'
import type { SourceMatch } from '../../types/plagiarism'
import { cn, primaryButtonClass } from '../../lib/utils'

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

// Single similarity band scale — mirrors the backend's verdict thresholds
// (originalityScore >= 80/60/40 in PlagiarismService.cs) so any element reading
// a raw similarity percentage (e.g. per-source cards) lands in the same band
// as the backend-computed overall verdict would for that percentage.
const SIMILARITY_BANDS = [
  { max: 20,  bar: 'bg-emerald-500', pillBg: 'bg-emerald-50', pillText: 'text-emerald-700' },
  { max: 40,  bar: 'bg-lime-500',    pillBg: 'bg-lime-50',    pillText: 'text-lime-700'    },
  { max: 60,  bar: 'bg-amber-500',   pillBg: 'bg-amber-50',   pillText: 'text-amber-700'   },
  { max: 101, bar: 'bg-red-500',     pillBg: 'bg-red-50',     pillText: 'text-red-700'     },
] as const

function getSimilarityBand(pct: number) {
  return SIMILARITY_BANDS.find(b => pct <= b.max) ?? SIMILARITY_BANDS[SIMILARITY_BANDS.length - 1]
}

function getMatchTypeBadge(type: string) {
  switch (type.toLowerCase()) {
    case 'exact':       return 'bg-red-50 text-red-700 border-red-200'
    case 'paraphrased': return 'bg-amber-50 text-amber-700 border-amber-200'
    default:            return 'bg-slate-50 text-slate-700 border-slate-200'
  }
}

// ── Inline highlight helpers ──────────────────────────────────────────────────

interface TextPart {
  text: string
  highlighted: boolean
  matchType: string
  sourceNumbers: number[]
}

interface HighlightRange {
  start: number
  end: number
  matchType: string
  sourceNumbers: Set<number>
}

const MATCH_TYPE_SEVERITY: Record<string, number> = { exact: 3, paraphrased: 2, structural: 1 }

function buildHighlightedParts(text: string, sourceMatches: SourceMatch[]): TextPart[] {
  const ranges: HighlightRange[] = []

  sourceMatches.forEach((match, sourceIdx) => {
    for (const seg of match.segments) {
      const snippet = seg.suspectSnippet?.trim()
      if (!snippet || snippet.length < 10) continue

      let idx = text.indexOf(snippet)
      if (idx === -1) idx = text.toLowerCase().indexOf(snippet.toLowerCase())
      if (idx === -1) continue

      ranges.push({ start: idx, end: idx + snippet.length, matchType: seg.matchType, sourceNumbers: new Set([sourceIdx + 1]) })
    }
  })

  if (ranges.length === 0) return [{ text, highlighted: false, matchType: '', sourceNumbers: [] }]

  ranges.sort((a, b) => a.start - b.start)
  const merged: HighlightRange[] = []
  for (const r of ranges) {
    const last = merged.at(-1)
    if (last && r.start <= last.end) {
      last.end = Math.max(last.end, r.end)
      if ((MATCH_TYPE_SEVERITY[r.matchType] ?? 0) > (MATCH_TYPE_SEVERITY[last.matchType] ?? 0)) {
        last.matchType = r.matchType
      }
      for (const n of r.sourceNumbers) last.sourceNumbers.add(n)
    } else {
      merged.push({ ...r, sourceNumbers: new Set(r.sourceNumbers) })
    }
  }

  const parts: TextPart[] = []
  let pos = 0
  for (const range of merged) {
    if (range.start > pos) parts.push({ text: text.slice(pos, range.start), highlighted: false, matchType: '', sourceNumbers: [] })
    parts.push({
      text: text.slice(range.start, range.end),
      highlighted: true,
      matchType: range.matchType,
      sourceNumbers: [...range.sourceNumbers].sort((a, b) => a - b),
    })
    pos = range.end
  }
  if (pos < text.length) parts.push({ text: text.slice(pos), highlighted: false, matchType: '', sourceNumbers: [] })

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

// Legend chips are styled via getHighlightClass — the same function that renders the
// real in-text <mark> — so the legend can never visually drift from the actual highlights.
const LEGEND = [
  { label: 'Exact copy',  matchType: 'exact'       },
  { label: 'Paraphrased', matchType: 'paraphrased' },
  { label: 'Structural',  matchType: 'structural'  },
] as const

function HighlightedTextView({ text, sourceMatches }: { text: string; sourceMatches: SourceMatch[] }) {
  const parts = buildHighlightedParts(text, sourceMatches)
  const hasHighlights = parts.some(p => p.highlighted)

  return (
    <div className="flex-1 overflow-auto flex flex-col min-h-0">
      {hasHighlights && (
        <div className="shrink-0 flex items-center gap-2 px-5 py-2.5 border-b border-gray-100 bg-gray-50">
          {LEGEND.map(({ label, matchType }) => (
            <span
              key={label}
              className={cn('bg-transparent px-1.5 py-0.5 text-[11px] font-medium leading-none', getHighlightClass(matchType))}
            >
              {label}
            </span>
          ))}
        </div>
      )}
      <div className="textarea-body flex-1 overflow-auto px-5 py-4 text-gray-800 whitespace-pre-wrap break-words select-text">
        {parts.map((part, i) =>
          part.highlighted ? (
            <mark key={i} className={cn('bg-transparent', getHighlightClass(part.matchType))}>
              {part.text}
              {part.sourceNumbers.length > 1 && (
                <sup
                  className="ml-0.5 text-[10px] font-semibold text-gray-500 not-italic"
                  title={`Matches sources ${part.sourceNumbers.join(', ')}`}
                >
                  {part.sourceNumbers.join(',')}
                </sup>
              )}
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
  const band = getSimilarityBand(match.similarityPercent)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="bg-white border border-gray-100 rounded-xl overflow-hidden"
    >
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0 flex-1 flex items-start gap-2">
            <span className="shrink-0 w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-[11px] font-semibold flex items-center justify-center mt-0.5">
              {index + 1}
            </span>
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
          </div>
          <span className={cn('shrink-0 text-[13px] font-semibold px-2.5 py-0.5 rounded-full', band.pillBg, band.pillText)}>
            {match.similarityPercent}% similar
          </span>
        </div>

        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
          <motion.div
            className={cn('h-full rounded-full', band.bar)}
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
      <Skeleton variant="text" tone="light" lines={3} className="w-full" />
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
      <div className="w-full max-w-xs mt-2 opacity-60 text-left">
        <div className="p-3 rounded-lg border border-gray-100 bg-gray-50 text-xs leading-6 text-gray-400">
          Faith-based organizations have{' '}
          <span className="bg-red-50 text-red-500 px-0.5 rounded">played a significant role in providing care and support</span>{' '}
          during the epidemic.
        </div>
        <p className="text-[10px] text-gray-300 mt-1.5 text-center">Matched passages highlighted</p>
      </div>
    </div>
  )
}

// ── Main PlagiarismPage ───────────────────────────────────────────────────────

export default function PlagiarismPage() {
  const { inputText, result, lastCheckedText, error, setInputText, reset } = usePlagiarismStore()
  const { check, isLoading, loadingStage } = usePlagiarism()

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
  // A report already covers this exact text — re-running would burn credits on an identical result.
  const isUnchangedSinceCheck = !!result && inputText === lastCheckedText
  const canCheck = wordCount >= 50 && !isLoading && !isUnchangedSinceCheck

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

  const verdictStyle = result ? getVerdictStyle(result.verdictColor) : null
  const hasResults    = !!result && !isLoading

  return (
    <div className="min-h-0 bg-transparent px-4 py-6 w-full space-y-5">

      {/* Page heading */}
      <div>
        <h1 className="text-[22px] font-semibold text-gray-900">Source Check</h1>
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
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-gray-400" />
                <PanelLabel label="Your text" count={wordCount} />
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

                {!showHighlights && (
                  <UtilityButton
                    icon={<Clipboard size={16} />}
                    label="Paste"
                    onClick={handlePasteFromClipboard}
                    disabled={isLoading}
                  />
                )}

                {!showHighlights && (
                  <UtilityButton
                    icon={<Upload size={16} />}
                    label="Upload"
                    onClick={openFilePicker}
                    disabled={isLoading || isFileProcessing}
                  />
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
                <motion.div
                  key="textarea"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="relative flex-1 min-h-0"
                >
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    disabled={isLoading}
                    className="textarea-body absolute inset-0 w-full h-full bg-white text-gray-800 resize-none outline-none focus:ring-2 focus:ring-inset focus:ring-purple-accent/30 rounded-lg px-5 py-4 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  {!inputText && (
                    <div className="textarea-body pointer-events-none absolute inset-0 px-5 py-4 text-gray-400 select-none">
                      Paste the text you want to check. Minimum 50 words for accurate detection. Or{' '}
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
                </motion.div>
              )}
            </AnimatePresence>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <ClearButton onClick={() => { reset(); setEditMode(false) }} disabled={!(inputText || result)} />
                <span className="text-[13px] text-gray-400">
                  {isUnchangedSinceCheck
                    ? 'Edit text to run a new check'
                    : wordCount > 0 && wordCount < 50
                      ? `${50 - wordCount} more words needed`
                      : 'Min. 50 words'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCheck}
                disabled={!canCheck}
                className={primaryButtonClass(canCheck)}
              >
                {isLoading ? (
                  <>
                    <RotateCw size={14} className="animate-spin" />
                    Checking…
                  </>
                ) : isUnchangedSinceCheck ? (
                  <>
                    <CheckCircle size={14} />
                    Checked
                  </>
                ) : (
                  'Check sources'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right — results panel */}
        <div className="lg:sticky lg:top-4" style={{ height: 'calc(100vh - 11rem)' }}>
          <div className="flex flex-col bg-white border border-gray-100 rounded-xl overflow-hidden h-full">

            {/* Persistent panel header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 shrink-0">
              <PanelLabel label="Source report" />
              {hasResults && (
                <div className="flex items-center gap-3">
                  <span className="text-[13px] text-gray-400">
                    {result!.sourceMatches.length} significant source{result!.sourceMatches.length !== 1 ? 's' : ''} found
                    {result!.sourcesSearched > result!.sourceMatches.length && (
                      <> ({result!.sourcesSearched} checked)</>
                    )}
                  </span>
                  <button
                    onClick={handleExport}
                    className="flex items-center gap-1 text-xs text-purple-accent hover:underline"
                  >
                    <Download size={12} />
                    Export
                  </button>
                </div>
              )}
            </div>

            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 p-5"
                >
                  <LoadingCard stage={loadingStage} />
                </motion.div>
              ) : !result && error ? (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 flex flex-col items-center justify-center h-full gap-3 text-center px-8"
                >
                  <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center">
                    <AlertTriangle size={16} className="text-red-500" />
                  </div>
                  <div>
                    <p className="text-[14px] font-medium text-gray-600">Couldn't check your text</p>
                    <p className="text-[12px] text-gray-400 mt-1 max-w-[240px] leading-relaxed">{error}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCheck}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-purple-accent hover:bg-purple-deep text-white transition-colors"
                  >
                    <RotateCw size={12} /> Retry
                  </button>
                </motion.div>
              ) : !result ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 flex flex-col min-h-0"
                >
                  <ResultsEmptyState />
                </motion.div>
              ) : result && (
                <motion.div
                  key="results"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex-1 overflow-y-auto min-h-0"
                >
                  {/* No-sources warning — a data-integrity issue, so it stays prominent and pinned above the score */}
                  {(result.isNoSourcesFound || result.sourcesSearched === 0) && (
                    <div className="p-4 pb-0">
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
                    </div>
                  )}

                  <div className="space-y-4 p-4 pb-6">
                    {/* Score card */}
                    <div className="bg-white border border-gray-100 rounded-xl p-5">
                      <div className="flex items-center gap-5">
                        <div className="shrink-0">
                          <ScoreCircle
                            score={result.originalityScore}
                            size="md"
                            showLabel={false}
                            colorOverride={VERDICT_HEX[result.verdictColor]}
                          />
                          <div className="text-center mt-1">
                            <p className="text-gray-900 font-bold text-xl">{result.originalityScore}% Original</p>
                            <p className="text-gray-400 text-[12px]">{result.similarityScore}% similarity detected</p>
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-gray-500 text-[13px] mb-1">Source Integrity Result</p>
                          <h2 className={cn('text-2xl font-bold mb-2', verdictStyle!.text)}>
                            {result.verdict}
                          </h2>
                          <p className="text-gray-400 text-[13px]">
                            {result.sourcesSearched} sources searched · {result.wordCount} words checked
                          </p>
                          {!result.isNoSourcesFound && result.sourcesSearched > 0 && result.isLowConfidence && (
                            <ConfidenceCaveat className="mt-1.5">
                              Short text (under 100 words) limits detection accuracy — for best results, paste at least 200 words.
                            </ConfidenceCaveat>
                          )}
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="flex justify-between text-[13px] text-gray-500 mb-1.5">
                          <span>High similarity</span>
                          <span>Fully original</span>
                        </div>
                        {/* Gradient stops align exactly with the backend's originalityScore verdict
                            bands (40/60/80 — see PlagiarismService.cs) so the marker's color always
                            matches the band it's sitting in. */}
                        <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="absolute inset-0"
                            style={{ background: 'linear-gradient(to right, #EF4444 0%, #EF4444 40%, #F59E0B 40%, #F59E0B 60%, #84CC16 60%, #84CC16 80%, #10B981 80%, #10B981 100%)' }}
                          />
                          <motion.div
                            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow"
                            style={{ background: VERDICT_HEX[result.verdictColor] }}
                            initial={{ left: '0%' }}
                            animate={{ left: `calc(${result.originalityScore}% - 6px)` }}
                            transition={{ duration: 1.2, ease: 'easeOut' }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Analysis */}
                    <div className="bg-white border border-gray-100 rounded-xl p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-gray-900 font-semibold">Analysis</h3>
                        <OutputActionButton icon={<Copy className="w-3 h-3" />} onClick={handleCopy}>
                          Copy summary
                        </OutputActionButton>
                      </div>
                      <p className="textarea-body text-gray-700">{result.analysis}</p>
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
