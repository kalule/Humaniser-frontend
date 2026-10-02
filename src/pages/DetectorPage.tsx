import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  ShieldCheck, AlertTriangle, HelpCircle, CheckCircle, AlertCircle,
  RefreshCw, Upload, Sparkles, Clipboard, Check, Download, ArrowUpDown,
} from 'lucide-react'
import { useDetectorStore } from '../store/detectorStore'
import { useToolTransferStore } from '../store/toolTransferStore'
import { useDetector } from '../hooks/useDetector'
import { useDragDrop } from '../hooks/useDragDrop'
import { DropOverlay } from '../components/ui/DropOverlay'
import { ScoreBar } from '../components/ui/ScoreBar'
import { PanelLabel } from '../components/ui/PanelLabel'
import { OutputActionButton } from '../components/ui/OutputActionButton'
import { ClearButton } from '../components/ui/ClearButton'
import { UtilityButton } from '../components/ui/UtilityButton'
import { Skeleton } from '../components/ui/Skeleton'
import { ResultsPanelHeader } from '../components/ui/ResultsPanelHeader'
import { PanelFooterBar } from '../components/ui/PanelFooterBar'
import { ToolBottomActionRow } from '../components/ui/ToolBottomActionRow'
import { ToolWorkspaceCard } from '../components/shared/ToolWorkspaceCard'
import { HumanisePopover } from '../components/app/HumanisePopover'
import { primaryButtonClass } from '../lib/utils'
import { humaniseApi } from '../api/humanise'
import type { DetectResponse } from '../types/detector'

// ── Types ─────────────────────────────────────────────────────────────────────

type DetectorState = 'idle' | 'analysing' | 'complete'
type VerdictType = 'likely-ai' | 'mixed' | 'likely-human'
// Backend's DetectionService.IsLowConfidence is exactly `wordCount < 200` (see
// DetectionService.cs) — a binary flag, not a graded scale. There is no real
// "medium" confidence tier; showing one would be inventing a distinction the
// detector doesn't make.
type ConfidenceType = 'high' | 'low'

interface SentenceResult {
  id: string
  text: string
  aiProbability: number
  startOffset: number
  length: number
}

interface DetectorUIResult {
  detectionResultId: string | null
  overallAiPct: number
  verdict: VerdictType
  confidence: ConfidenceType
  sentences: SentenceResult[]
  wordCount: number
  analysedAt: string
}

// ── Score tiers — single source of truth for the Likely AI / Mixed / Likely
// human three-way classification, shared by the highlight legend, the inline
// text highlights, and the flagged-sentence list markers so all three use one
// colour mapping and one threshold instead of three independently-maintained
// copies. ──────────────────────────────────────────────────────────────────

const SCORE_TIERS = [
  { id: 'ai',    min: 70, label: 'Likely AI',    dot: 'bg-red-400',   text: 'text-red-500',   swatch: 'bg-red-100',   softBg: 'bg-red-50 hover:bg-red-100',     selectedBg: 'bg-red-50 border-red-100',   selectedBorder: 'border-l-2 border-red-400' },
  { id: 'mixed', min: 40, label: 'Mixed',        dot: 'bg-amber-400', text: 'text-amber-500', swatch: 'bg-amber-100', softBg: 'bg-amber-50 hover:bg-amber-100', selectedBg: 'bg-amber-50 border-amber-100', selectedBorder: 'border-l-2 border-amber-400' },
  { id: 'human', min: 0,  label: 'Likely human', dot: 'bg-green-500', text: 'text-green-600', swatch: 'bg-green-100', softBg: 'bg-green-50 hover:bg-green-100', selectedBg: 'bg-green-50 border-green-100', selectedBorder: 'border-l-2 border-green-500' },
] as const

function tierFor(pct: number) {
  return SCORE_TIERS.find(t => pct >= t.min) ?? SCORE_TIERS[SCORE_TIERS.length - 1]
}

function aiBarColor(aiPct: number): string {
  return tierFor(aiPct).dot
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Matches DetectionThresholds.HumaniseFlagThreshold on the backend — the real threshold that
// decides which sentences the bulk "Humanise flagged sentences" call will actually rewrite.
// It's intentionally separate from the Likely AI / Mixed / Likely human tiers above (a sentence
// can be "Mixed" and still be worth an eligible flag) — every sentence that meets it is marked
// with a "Flagged" chip in the list below, so the number on the button always matches what's
// visibly marked, not a separately-derived count.
const HUMANISE_FLAG_THRESHOLD = 60

const SAMPLE_TEXT_AI = `Artificial intelligence has transformed the way we approach problem-solving across industries. The utilisation of machine learning algorithms enables organisations to process vast datasets with unprecedented efficiency. Furthermore, the integration of natural language processing capabilities has facilitated more sophisticated human-computer interaction paradigms. It is important to note that these technological advancements present both opportunities and challenges for contemporary society. The systematic implementation of AI-driven solutions requires careful consideration of ethical implications and potential societal impacts.`

const SAMPLE_TEXT_HUMAN = `Honestly, I didn't think the trip would go this well. We missed our connecting flight in Frankfurt, which should've ruined everything, but somehow it turned into the best part of the whole week. We ended up wandering into this tiny café near the station because we had six hours to kill, and the owner overheard us arguing about which train platform we needed. He just laughed, sat down with us, and started telling stories about growing up nearby. I still don't know his name. Funny how the stuff you didn't plan is usually what you remember.`

function adaptResponse(r: DetectResponse): DetectorUIResult {
  const verdict: VerdictType =
    r.aiScore >= 70 ? 'likely-ai' : r.aiScore >= 40 ? 'mixed' : 'likely-human'
  return {
    detectionResultId: r.id ?? null,
    overallAiPct: r.aiScore,
    verdict,
    confidence: r.isLowConfidence ? 'low' : 'high',
    sentences: r.sentenceScores.map((s, i) => ({
      id: `s${i}`,
      text: s.sentence,
      aiProbability: s.aiProbability,
      startOffset: s.startOffset,
      length: s.length,
    })),
    wordCount: r.wordCount,
    analysedAt: new Date().toISOString(),
  }
}

function generateReportText(result: DetectorUIResult): string {
  return `AI Detection Report — ${new Date(result.analysedAt).toLocaleDateString()}

Verdict: ${
  result.verdict === 'likely-ai' ? 'Likely AI-generated'
  : result.verdict === 'mixed' ? 'Mixed — AI and human'
  : 'Likely human-written'
}
Estimated AI probability: ${result.overallAiPct}%
Confidence: ${result.confidence === 'low' ? 'Low' : 'High'}
Words analysed: ${result.wordCount}

Top flagged sentences:
${result.sentences
  .filter(s => s.aiProbability >= 40)
  .sort((a, b) => b.aiProbability - a.aiProbability)
  .slice(0, 3)
  .map(s => `• [${s.aiProbability}%] "${s.text}"`)
  .join('\n')}

Generated by Humaniser AI Detector — humaniseai.co.za`.trim()
}

// ── VerdictBadge ──────────────────────────────────────────────────────────────

const VERDICT_CONFIG = {
  'likely-ai': {
    label: 'Likely AI-generated',
    cls: 'bg-red-50 text-red-600 border-red-200',
    Icon: AlertTriangle,
  },
  'mixed': {
    label: 'Mixed — AI and human',
    cls: 'bg-amber-50 text-amber-600 border-amber-200',
    Icon: HelpCircle,
  },
  'likely-human': {
    label: 'Likely human-written',
    cls: 'bg-green-50 text-green-600 border-green-200',
    Icon: CheckCircle,
  },
}

function VerdictBadge({ verdict }: { verdict: VerdictType }) {
  const { label, cls, Icon } = VERDICT_CONFIG[verdict]
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium ${cls}`}>
      <Icon size={15} />
      {label}
    </div>
  )
}

// ── SentenceResultRow ─────────────────────────────────────────────────────────

function SentenceResultRow({
  sentence,
  selected,
  isRewritten,
  popoverOpen,
  onClick,
  onTogglePopover,
  onAcceptRewrite,
  onOpenInEditor,
}: {
  sentence: SentenceResult
  selected: boolean
  isRewritten: boolean
  popoverOpen: boolean
  onClick: () => void
  onTogglePopover: () => void
  onAcceptRewrite: (newText: string) => void
  onOpenInEditor: (text: string) => void
}) {
  const { aiProbability: pct, text } = sentence
  const tier = tierFor(pct)
  const isFlagged = pct >= HUMANISE_FLAG_THRESHOLD

  return (
    <div
      id={`flagged-anchor-${sentence.id}`}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Sentence, ${pct}% estimated AI probability, ${tier.label}${isFlagged ? ', flagged for humanising' : ''}`}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      className={`relative p-3 rounded-lg border cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-purple-accent/40 ${
        selected ? tier.selectedBg : 'bg-white border-gray-100 hover:bg-gray-50'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${tier.dot}`} aria-hidden="true" />
          <p className="text-xs text-gray-700 leading-relaxed line-clamp-2">{text}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`text-sm font-medium ${tier.text}`}>{pct}%</span>
          {isFlagged && (
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-200 whitespace-nowrap">
              Flagged
            </span>
          )}
        </div>
      </div>

      {pct >= 40 && (
        isRewritten ? (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              onTogglePopover()
            }}
            className="mt-2 flex items-center gap-1 text-[11px] text-green-600 hover:text-green-700 transition-colors"
          >
            <Check size={11} />
            Rewritten — humanise again
          </button>
        ) : (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              onTogglePopover()
            }}
            className="mt-2 flex items-center gap-1 text-[11px] text-blue-500 hover:text-blue-700 hover:underline transition-colors"
          >
            <Sparkles size={11} />
            Humanise this sentence
          </button>
        )
      )}

      <AnimatePresence>
        {popoverOpen && (
          <HumanisePopover
            sentence={text}
            onAccept={onAcceptRewrite}
            onClose={onTogglePopover}
            onOpenInEditor={() => onOpenInEditor(text)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ── SentenceHighlightView ─────────────────────────────────────────────────────

function SentenceHighlightView({
  inputText,
  sentences,
  selectedId,
  onSelect,
}: {
  inputText: string
  sentences: SentenceResult[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  // Keeps the corresponding sentence in view when it's selected from the flagged-sentence
  // list on the right — the two representations (highlighted text / flagged cards) share
  // selectedId, so this is the text-side half of that connection.
  useEffect(() => {
    if (!selectedId) return
    document.getElementById(`sentence-anchor-${selectedId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [selectedId])

  // Renders from inputText + offsets rather than joining sentence.text with a literal space,
  // so whitespace and paragraph breaks between sentences survive exactly as typed instead of
  // collapsing to single spaces.
  let cursor = 0
  const nodes: React.ReactNode[] = []

  sentences.forEach(s => {
    const gap = inputText.slice(cursor, s.startOffset)
    if (gap) nodes.push(<span key={`gap-${s.id}`}>{gap}</span>)

    const isSelected = s.id === selectedId
    const tier = tierFor(s.aiProbability)

    nodes.push(
      <span
        key={s.id}
        id={`sentence-anchor-${s.id}`}
        role="button"
        tabIndex={0}
        aria-pressed={isSelected}
        aria-label={`Sentence, ${s.aiProbability}% estimated AI probability, ${tier.label}`}
        onClick={() => onSelect(isSelected ? null : s.id)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(isSelected ? null : s.id) } }}
        className={`inline cursor-pointer rounded px-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-accent/40 ${tier.softBg} ${
          isSelected ? tier.selectedBorder : 'border-l-2 border-transparent'
        }`}
      >
        {s.text}
      </span>
    )
    cursor = s.startOffset + s.length
  })

  const trailing = inputText.slice(cursor)
  if (trailing) nodes.push(<span key="gap-trailing">{trailing}</span>)

  return (
    <div className="textarea-body flex-1 overflow-y-auto px-4 py-3 text-gray-800 whitespace-pre-wrap">
      {nodes}

      <div className="flex items-center gap-4 mt-6 pt-4 border-t border-gray-100">
        <span className="text-xs text-gray-400">Highlight key:</span>
        {SCORE_TIERS.map(t => (
          <span key={t.id} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className={`w-3 h-3 rounded-sm inline-block ${t.swatch}`} />{t.label}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── useInputPanelSlots ───────────────────────────────────────────────────────

const MAX_CHARS = 10_000

interface WorkspaceSlots {
  header: React.ReactNode
  body: React.ReactNode
  footer?: React.ReactNode
}

// Returns {header, body, footer} for ToolWorkspaceCard's leftPanel rather than
// one JSX root — a hook (not a component) so the useDragDrop/state calls inside
// stay valid despite not rendering a single element themselves.
function useInputPanelSlots({
  text,
  onTextChange,
  detectorState,
  wordCount,
  result,
  selectedId,
  onSelect,
  onAnalyse,
  onReset,
}: {
  text: string
  onTextChange: (t: string) => void
  detectorState: DetectorState
  wordCount: number
  result: DetectorUIResult | null
  selectedId: string | null
  onSelect: (id: string | null) => void
  onAnalyse: () => void
  onReset: () => void
}): WorkspaceSlots {
  const { isDragging, isProcessing, dragHandlers, openFilePicker, fileInputElement } = useDragDrop({
    onText: onTextChange,
    disabled: detectorState === 'analysing',
  })

  const handlePasteFromClipboard = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText()
      onTextChange(clipboardText)
      toast.success('Pasted from clipboard!')
    } catch {
      toast.error('Clipboard access denied')
    }
  }

  const charCount = text.length
  const isOverLimit = charCount > MAX_CHARS
  const belowMinimum = wordCount < 50

  // "200+ words" is the backend's real low-confidence cutoff (DetectionService.IsLowConfidence),
  // so it's honest to reference — but phrased as a reliability note, never as "add N words" to
  // avoid reading like padding advice for a better score.
  const footerHint =
    isOverLimit ? `Too long — ${charCount.toLocaleString()} / ${MAX_CHARS.toLocaleString()} characters`
    : wordCount >= 200 ? 'Optimal length for accurate detection'
    : wordCount >= 50 ? 'Results are more reliable at 200+ words'
    : wordCount > 0 ? `${50 - wordCount} more words needed to analyse`
    : 'Minimum 50 words · most reliable at 200+'

  const footerColor =
    isOverLimit ? 'text-red-500'
    : wordCount >= 50 ? 'text-green-600'
    : 'text-gray-400'

  return {
    header: (
      <div className="flex items-center px-4 py-2.5 border-b border-[#e0e0da] shrink-0">
        <PanelLabel label="Your text" />
      </div>
    ),
    body: (
      <div className="flex-1 min-h-0 flex flex-col relative" {...dragHandlers}>
        {fileInputElement}
        <DropOverlay isDragging={isDragging} isProcessing={isProcessing} />
        {detectorState === 'complete' && result ? (
          <SentenceHighlightView
            inputText={text}
            sentences={result.sentences}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ) : (
          <div className="relative flex-1 min-h-0">
            <textarea
              className="textarea-body absolute inset-0 w-full h-full px-4 py-3 text-gray-800 bg-white resize-none outline-none focus:ring-2 focus:ring-inset focus:ring-purple-accent/30 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
              value={text}
              onChange={e => onTextChange(e.target.value)}
              disabled={detectorState === 'analysing'}
            />
            {!text && (
              <div className="textarea-body pointer-events-none absolute inset-0 px-4 py-3 text-gray-400 select-none">
                Paste the text you want to analyse here. Minimum 50 words, 200+ for accurate detection. Or{' '}
                <button
                  type="button"
                  onClick={() => onTextChange(SAMPLE_TEXT_AI)}
                  className="pointer-events-auto text-purple-accent hover:underline"
                >
                  try an AI sample
                </button>
                {' '}or{' '}
                <button
                  type="button"
                  onClick={() => onTextChange(SAMPLE_TEXT_HUMAN)}
                  className="pointer-events-auto text-purple-accent hover:underline"
                >
                  a human sample
                </button>
                .
              </div>
            )}
          </div>
        )}
      </div>
    ),
    footer: (
      <>
        <PanelFooterBar
          metadata={<span className="text-xs font-normal tabular-nums text-gray-400">{wordCount} words</span>}
          actions={
            <>
              <UtilityButton
                icon={<Clipboard size={14} />}
                label="Paste"
                className="h-8 px-3 text-[13px]"
                onClick={handlePasteFromClipboard}
                disabled={detectorState === 'analysing'}
              />
              <UtilityButton
                icon={<Upload size={14} />}
                label="Upload"
                className="h-8 px-3 text-[13px]"
                onClick={openFilePicker}
                disabled={detectorState === 'analysing' || isProcessing}
              />
            </>
          }
        />
        <ToolBottomActionRow
          clearButton={<ClearButton onClick={onReset} disabled={!text || detectorState === 'analysing'} />}
          hint={<span className={footerColor}>{footerHint}</span>}
          primaryButton={
            <button
              type="button"
              onClick={onAnalyse}
              disabled={belowMinimum || isOverLimit || detectorState === 'analysing'}
              title={
                belowMinimum ? 'Please enter at least 50 words to begin analysis.'
                : detectorState === 'complete' ? 'Re-run analysis on the current text'
                : undefined
              }
              className={primaryButtonClass(!(belowMinimum || isOverLimit || detectorState === 'analysing'))}
            >
              {detectorState === 'analysing' ? (
                <><RefreshCw size={14} className="animate-spin" /> Analysing…</>
              ) : detectorState === 'complete' ? (
                'Reanalyse'
              ) : (
                'Analyse text'
              )}
            </button>
          }
        />
      </>
    ),
  }
}

// ── ResultsEmptyState ─────────────────────────────────────────────────────────

function ResultsEmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 gap-4 text-center">
      <ShieldCheck size={32} className="text-gray-300" />
      <div>
        <p className="text-sm font-medium text-gray-600">Your analysis report</p>
        <p className="text-xs text-gray-400 mt-1 leading-relaxed max-w-[200px]">
          Paste text on the left and run an analysis to see the AI probability score and sentence breakdown.
        </p>
      </div>
      <div className="w-full max-w-xs mt-2 opacity-60 text-left">
        <div className="p-3 rounded-lg border border-gray-100 bg-gray-50 text-xs leading-6 text-gray-400">
          <span className="bg-red-50 text-red-400 px-0.5 rounded">Furthermore, it is important to note that</span>{' '}
          this approach{' '}
          <span className="bg-red-50 text-red-400 px-0.5 rounded">plays a crucial role in</span>{' '}
          improving outcomes.
        </div>
        <p className="text-[10px] text-gray-300 mt-1.5 text-center">AI-sounding phrases flagged</p>
      </div>
    </div>
  )
}

// ── useResultsPanelSlots ─────────────────────────────────────────────────────

const SENTENCES_INITIAL_VISIBLE = 10

// Returns {header, body} for ToolWorkspaceCard's rightPanel — see
// useInputPanelSlots above for why this is a hook rather than a component.
function useResultsPanelSlots({
  result,
  isLoading,
  error,
  onRetry,
  selectedId,
  onSelect,
  rewrittenIds,
  onAcceptRewrite,
  onOpenInEditor,
}: {
  result: DetectorUIResult | null
  isLoading: boolean
  error: string | null
  onRetry: () => void
  selectedId: string | null
  onSelect: (id: string | null) => void
  rewrittenIds: Set<string>
  onAcceptRewrite: (sentenceId: string, originalText: string, newText: string) => void
  onOpenInEditor: (text: string) => void
}): WorkspaceSlots {
  const [copied, setCopied] = useState(false)
  const [downloaded, setDownloaded] = useState(false)
  const [sortMode, setSortMode] = useState<'severity' | 'order'>(() => {
    const saved = sessionStorage.getItem('detector_sentence_sort')
    return saved === 'order' ? 'order' : 'severity'
  })
  const [showAllSentences, setShowAllSentences] = useState(false)
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null)

  // Collapse back to the capped list whenever a fresh analysis comes in.
  useEffect(() => { setShowAllSentences(false); setOpenPopoverId(null) }, [result?.analysedAt])

  // If a sentence is selected from the highlighted text and it's beyond the initial cap,
  // expand the list and bring its card into view — the text-side half of this lives in
  // SentenceHighlightView's own effect.
  useEffect(() => {
    if (!selectedId) return
    setShowAllSentences(true)
    const id = requestAnimationFrame(() => {
      document.getElementById(`flagged-anchor-${selectedId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
    return () => cancelAnimationFrame(id)
  }, [selectedId])

  const handleCopyReport = async () => {
    if (!result) return
    await navigator.clipboard.writeText(generateReportText(result))
    setCopied(true)
    toast.success('Report copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadReport = () => {
    if (!result) return
    const blob = new Blob([generateReportText(result)], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'ai-detection-report.txt'
    a.click()
    URL.revokeObjectURL(url)
    setDownloaded(true)
    setTimeout(() => setDownloaded(false), 2000)
  }

  const handleSortChange = (mode: 'severity' | 'order') => {
    setSortMode(mode)
    sessionStorage.setItem('detector_sentence_sort', mode)
  }

  const header = (
    <ResultsPanelHeader
      title={<PanelLabel label="Analysis report" />}
    />
  )

  const footer = result && (
    <PanelFooterBar
      metadata={
        <span className="text-xs font-normal tabular-nums text-gray-400">
          {result.wordCount} words analysed · {result.confidence === 'low' ? 'Low' : 'High'} confidence
        </span>
      }
      actions={
        <>
          <OutputActionButton icon={copied ? <Check size={11} className="text-green-500" /> : <Clipboard size={11} />} onClick={handleCopyReport}>
            {copied ? 'Copied' : 'Copy report'}
          </OutputActionButton>
          <OutputActionButton
            icon={downloaded ? <Check size={11} className="text-green-500" /> : <Download size={11} />}
            onClick={handleDownloadReport}
            title="Download report as .txt"
          >
            {downloaded ? 'Saved' : 'Download .txt'}
          </OutputActionButton>
        </>
      }
    />
  )

  const body = (
    <>
      {isLoading ? (
        <div className="flex-1 px-5 py-4">
          <div className="flex items-center gap-2 mb-4">
            <RefreshCw size={14} className="animate-spin text-purple-accent" />
            <span className="text-sm text-purple-accent font-medium">Analysing your text…</span>
          </div>
          <Skeleton variant="text" tone="light" lines={6} />
        </div>
      ) : !result && error ? (
        <div className="flex-1 flex flex-col items-center justify-center h-full gap-3 text-center px-8">
          <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center">
            <AlertCircle size={16} className="text-red-500" />
          </div>
          <div>
            <p className="text-[14px] font-medium text-gray-600">Couldn't analyse your text</p>
            <p className="text-[12px] text-gray-400 mt-1 max-w-[240px] leading-relaxed">{error}</p>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-purple-accent hover:bg-purple-deep text-white transition-colors"
          >
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      ) : !result ? (
        <ResultsEmptyState />
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">
          {/* Result — pinned, stays visible while the sentence list scrolls. This is the
              single place the overall score is shown; nothing repeats it in a sidebar. */}
          <div className="px-5 py-5 border-b border-gray-100 shrink-0">
            <VerdictBadge verdict={result.verdict} />
            <ScoreBar score={result.overallAiPct} label="Estimated AI probability" colorForScore={aiBarColor} className="mt-4" />
            {result.confidence === 'low' && (
              <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
                Low confidence — texts under 200 words can produce less reliable results.
              </p>
            )}
          </div>

          {/* Sentence breakdown — scrolls independently of the score above */}
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Sentence breakdown
              </p>
              <div className="flex items-center gap-1 p-0.5 bg-gray-100 rounded-md">
                {(['severity', 'order'] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => handleSortChange(mode)}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors ${
                      sortMode === mode
                        ? 'bg-white text-gray-800 font-medium shadow-sm'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                    title={mode === 'severity' ? 'Highest AI% first' : 'Document order'}
                  >
                    <ArrowUpDown size={10} />
                    {mode === 'severity' ? 'By severity' : 'By order'}
                  </button>
                ))}
              </div>
            </div>
            {(() => {
              const sorted = [...result.sentences]
                .sort((a, b) => sortMode === 'severity' ? b.aiProbability - a.aiProbability : 0)
              const visible = showAllSentences ? sorted : sorted.slice(0, SENTENCES_INITIAL_VISIBLE)
              const hiddenCount = sorted.length - visible.length
              return (
                <>
                  <div className="flex flex-col gap-2">
                    {visible.map(s => (
                      <SentenceResultRow
                        key={s.id}
                        sentence={s}
                        selected={s.id === selectedId}
                        isRewritten={rewrittenIds.has(s.id)}
                        popoverOpen={s.id === openPopoverId}
                        onClick={() => onSelect(s.id === selectedId ? null : s.id)}
                        onTogglePopover={() => setOpenPopoverId(prev => prev === s.id ? null : s.id)}
                        onAcceptRewrite={newText => {
                          onAcceptRewrite(s.id, s.text, newText)
                          setOpenPopoverId(null)
                        }}
                        onOpenInEditor={onOpenInEditor}
                      />
                    ))}
                  </div>
                  {hiddenCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAllSentences(true)}
                      className="mt-2 w-full text-center text-xs text-gray-500 hover:text-gray-800 py-2 rounded-lg border border-dashed border-gray-200 hover:border-gray-300 transition-colors"
                    >
                      Show {hiddenCount} more sentence{hiddenCount !== 1 ? 's' : ''}
                    </button>
                  )}
                </>
              )
            })()}
          </div>
        </div>
      )}
    </>
  )

  return { header, body, footer }
}

// ── DetectorPage ──────────────────────────────────────────────────────────────

export default function DetectorPage() {
  const { inputText, result, wordCount, error, setInputText, setResult, reset } = useDetectorStore()
  const { detect, isLoading } = useDetector()
  const navigate = useNavigate()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [rewrittenIds, setRewrittenIds] = useState<Set<string>>(new Set())
  const [isBulkHumanising, setIsBulkHumanising] = useState(false)

  // Receive text sent from another tool via SendToMenu. Clear any previous
  // result so the report never describes text that's no longer in the input.
  useEffect(() => {
    const { text, clearTransfer } = useToolTransferStore.getState()
    if (text) {
      setInputText(text)
      setResult(null)
      clearTransfer()
      toast('Text transferred — ready to scan!', { icon: '🛡️' })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const detectorState: DetectorState =
    isLoading ? 'analysing' : result ? 'complete' : 'idle'

  // Memoized so `analysedAt` (used as a "fresh analysis arrived" effect
  // dependency downstream) stays stable across re-renders that don't change
  // `result` itself — e.g. opening a sentence's rewrite popover, which
  // otherwise re-triggered adaptResponse's `new Date().toISOString()` on
  // every render and immediately reset the just-opened popover closed again.
  const uiResult = useMemo(() => (result ? adaptResponse(result) : null), [result])

  // Single source of truth for "how many sentences the bulk action will touch" — used for
  // both the button's label and (via HUMANISE_FLAG_THRESHOLD in SentenceResultRow) the
  // "Flagged" chips in the list, so the two numbers can't drift apart.
  const flaggedSentenceCount = uiResult
    ? uiResult.sentences.filter(s => s.aiProbability >= HUMANISE_FLAG_THRESHOLD).length
    : 0

  const handleAnalyse = async () => {
    if (wordCount < 50 || isLoading || inputText.length > MAX_CHARS) return
    setSelectedId(null)
    setRewrittenIds(new Set())
    await detect(inputText)
  }

  const handleReset = () => {
    reset()
    setSelectedId(null)
    setRewrittenIds(new Set())
  }

  // Splices an accepted rewrite back into the raw input and the cached sentence
  // scores. Sentence text is a verbatim substring of inputText (it comes straight
  // from the detector API's per-sentence split), so a plain string replace keeps
  // everything in sync without re-tracking offsets.
  const handleAcceptRewrite = (sentenceId: string, originalText: string, newText: string) => {
    if (!result) return
    setInputText(inputText.replace(originalText, newText))
    setResult({
      ...result,
      sentenceScores: result.sentenceScores.map((s, i) =>
        `s${i}` === sentenceId ? { ...s, sentence: newText } : s
      ),
    })
    setRewrittenIds(prev => new Set(prev).add(sentenceId))
    toast.success('Sentence updated')
  }

  const handleOpenInEditor = (text: string) => {
    navigate(`/app/paraphrase?text=${encodeURIComponent(text)}&mode=fluency`)
  }

  // One call replaces both the editor text and the full analysis report — no follow-up
  // "analyse text" call. The individual "Humanise this sentence" flow (HumanisePopover, via
  // handleAcceptRewrite above) is completely independent of this and keeps working unchanged.
  const handleBulkHumanise = async () => {
    if (!uiResult?.detectionResultId || isBulkHumanising) return
    setIsBulkHumanising(true)
    try {
      const response = await humaniseApi.bulkHumaniseSentences({
        detectionResultId: uiResult.detectionResultId,
      })
      setInputText(response.text)
      setResult(response.analysis)
      setSelectedId(null)
      setRewrittenIds(new Set())
      if (response.sentencesFailed > 0) {
        toast.error(
          `Humanised ${response.sentencesHumanised} sentence${response.sentencesHumanised !== 1 ? 's' : ''}, ` +
          `${response.sentencesFailed} failed and were left unchanged`,
          { duration: 5000 },
        )
      } else {
        toast.success(`Humanised ${response.sentencesHumanised} sentence${response.sentencesHumanised !== 1 ? 's' : ''}`)
      }
    } catch (err: unknown) {
      const apiErr = err as { message?: string; upgradeRequired?: boolean }
      if (apiErr?.upgradeRequired) {
        toast.error('Word limit reached. Upgrade your plan to continue.', { duration: 5000 })
      } else {
        toast.error(apiErr?.message ?? 'Bulk humanise failed. Please try again.')
      }
    } finally {
      setIsBulkHumanising(false)
    }
  }

  const inputSlots = useInputPanelSlots({
    text: inputText,
    onTextChange: setInputText,
    detectorState,
    wordCount,
    result: uiResult,
    selectedId,
    onSelect: setSelectedId,
    onAnalyse: handleAnalyse,
    onReset: handleReset,
  })

  const resultsSlots = useResultsPanelSlots({
    result: uiResult,
    isLoading,
    error,
    onRetry: handleAnalyse,
    selectedId,
    onSelect: setSelectedId,
    rewrittenIds,
    onAcceptRewrite: handleAcceptRewrite,
    onOpenInEditor: handleOpenInEditor,
  })

  return (
    <div className="min-h-0 bg-transparent px-4 py-6 w-full">
      <ToolWorkspaceCard
        className="lg:sticky lg:top-4"
        style={{ height: 'calc(100vh - 7rem)' }}
        leftPanel={inputSlots}
        rightPanel={resultsSlots}
        // Result → evidence (sentence breakdown, above) → action (here). Kept as a distinct
        // full-width row so it reads as "what you can do next," not the page's main CTA —
        // "Analyse text" in the left footer stays the only primary action.
        bottomActionBar={uiResult && flaggedSentenceCount > 0 && uiResult.detectionResultId && (
          <button
            type="button"
            onClick={handleBulkHumanise}
            disabled={isBulkHumanising}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-[13px] font-semibold bg-purple-accent hover:bg-purple-deep text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isBulkHumanising ? (
              <><RefreshCw size={13} className="animate-spin" /> Humanising {flaggedSentenceCount} sentence{flaggedSentenceCount !== 1 ? 's' : ''}…</>
            ) : (
              <><Sparkles size={13} /> Humanise {flaggedSentenceCount} flagged sentence{flaggedSentenceCount !== 1 ? 's' : ''}</>
            )}
          </button>
        )}
      />
    </div>
  )
}
