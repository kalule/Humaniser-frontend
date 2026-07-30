import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SpellCheck, Copy, CheckCheck, Upload, Clipboard, Sparkles, Loader2, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn, primaryButtonClass } from '../../lib/utils'
import { useGrammarStore } from '../../store/grammarStore'
import { useGrammar } from '../../hooks/useGrammar'
import { useDragDrop } from '../../hooks/useDragDrop'
import { DropOverlay } from '../../components/ui/DropOverlay'
import { SendToMenu } from '../../components/ui/SendToMenu'
import { OutputActionButton } from '../../components/ui/OutputActionButton'
import { ClearButton } from '../../components/ui/ClearButton'
import { PanelLabel } from '../../components/ui/PanelLabel'
import { UtilityButton } from '../../components/ui/UtilityButton'
import { Skeleton } from '../../components/ui/Skeleton'
import { useToolTransferStore } from '../../store/toolTransferStore'
import type { ActiveSuggestion, ErrorCategory, GrammarContext } from '../../types/grammar'

// ── Constants ─────────────────────────────────────────────────────────────────

const MODES: { id: GrammarContext; label: string; desc: string }[] = [
  { id: 'General',  label: 'General',  desc: 'Standard grammar rules applied with moderate sensitivity.' },
  { id: 'Academic', label: 'Academic', desc: 'Formal tone, citation-ready, avoids colloquialisms.' },
  { id: 'Business', label: 'Business', desc: 'Professional register, concise phrasing.' },
  { id: 'Creative', label: 'Creative', desc: 'Preserves voice, flags only clear errors.' },
  { id: 'Casual',   label: 'Casual',   desc: 'Relaxed tone, minimal intervention.' },
]

const CORE_CHECKS: ErrorCategory[]     = ['Spelling', 'Grammar', 'Punctuation']
const ADVANCED_CHECKS: ErrorCategory[] = ['Style', 'Clarity', 'Conciseness', 'Consistency', 'Tone']
const ALL_CHECK_IDS: ErrorCategory[]   = [...CORE_CHECKS, ...ADVANCED_CHECKS]

const SAMPLE_TEXT =
  `She recieved the report on monday and immediately forwarded it to the team. The data suggests that there is alot of room for improvment in there processes. Each of the managers have submitted there quarterly review's on time, which is a good sign. Going foward, we should leverage every oppurtunity to optimise our workflows and facilitate better collaboration accross departments.`

const TYPE_COLOR: Record<ErrorCategory, string> = {
  Spelling:    'bg-red-50 text-red-700',
  Grammar:     'bg-orange-50 text-orange-500',
  Punctuation: 'bg-amber-50 text-amber-600',
  Style:       'bg-blue-50 text-blue-500',
  Clarity:     'bg-purple-50 text-purple-500',
  Conciseness: 'bg-teal-50 text-teal-600',
  Consistency: 'bg-indigo-50 text-indigo-500',
  Tone:        'bg-pink-50 text-pink-500',
}

const SEVERITY_ORDER: Record<string, number> = { Error: 0, Warning: 1, Suggestion: 2 }

// ── Client-side suggestion applier ────────────────────────────────────────────

function applyOneSuggestion(
  text: string,
  accepted: ActiveSuggestion,
  all: ActiveSuggestion[]
): { text: string; suggestions: ActiveSuggestion[] } {
  const updatedText =
    text.slice(0, accepted.startOffset) +
    accepted.replacement +
    text.slice(accepted.endOffset)

  const delta = accepted.replacement.length - accepted.originalText.length

  const updated = all
    .filter((s) => s.id !== accepted.id)
    .map((s) => {
      if (s.endOffset <= accepted.startOffset) return s
      if (s.startOffset >= accepted.endOffset)
        return { ...s, startOffset: s.startOffset + delta, endOffset: s.endOffset + delta }
      return null
    })
    .filter(Boolean) as ActiveSuggestion[]

  return { text: updatedText, suggestions: updated }
}

function applyAllSuggestions(text: string, suggestions: ActiveSuggestion[]): string {
  const sorted = [...suggestions]
    .filter((s) => s.status === 'pending')
    .sort((a, b) => b.startOffset - a.startOffset)

  let result = text
  for (const s of sorted) {
    result = result.slice(0, s.startOffset) + s.replacement + result.slice(s.endOffset)
  }
  return result
}

// ── AnnotatedText ─────────────────────────────────────────────────────────────

function AnnotatedText({
  text,
  suggestions,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
}: {
  text: string
  suggestions: ActiveSuggestion[]
  selectedId: string | null
  hoveredId: string | null
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
}) {
  const pending = [...suggestions]
    .filter((s) => s.status === 'pending')
    .sort((a, b) => a.startOffset - b.startOffset)

  if (pending.length === 0) {
    return <p className="textarea-body text-gray-800 whitespace-pre-wrap">{text}</p>
  }

  const segments: React.ReactNode[] = []
  let offset = 0

  for (const s of pending) {
    if (s.startOffset > offset) {
      segments.push(
        <span key={`t-${offset}`} style={{ whiteSpace: 'pre-wrap' }}>
          {text.slice(offset, s.startOffset)}
        </span>
      )
    }
    segments.push(
      <mark
        key={s.id}
        onClick={() => onSelect(s.id)}
        onMouseEnter={() => onHover(s.id)}
        onMouseLeave={() => onHover(null)}
        title={s.shortMessage}
        style={{
          backgroundColor: s.categoryColour + (hoveredId === s.id ? '30' : '18'),
          borderBottom: `2px solid ${s.categoryColour}`,
          borderRadius: '2px',
          cursor: 'pointer',
          padding: '1px 0',
          outline: selectedId === s.id || hoveredId === s.id ? `2px solid ${s.categoryColour}` : 'none',
          outlineOffset: '1px',
          transition: 'outline 0.15s ease, background-color 0.15s ease',
        }}
      >
        {text.slice(s.startOffset, s.endOffset)}
      </mark>
    )
    offset = s.endOffset
  }

  if (offset < text.length) {
    segments.push(
      <span key="t-end" style={{ whiteSpace: 'pre-wrap' }}>{text.slice(offset)}</span>
    )
  }

  return (
    <p className="textarea-body text-gray-800">
      {segments}
    </p>
  )
}

// ── SuggestionCard ────────────────────────────────────────────────────────────

function SuggestionCard({
  suggestion,
  index,
  isSelected,
  isHovered,
  onAccept,
  onIgnore,
  onSelect,
  onHover,
}: {
  suggestion: ActiveSuggestion
  index: number
  isSelected: boolean
  isHovered: boolean
  onAccept: () => void
  onIgnore: () => void
  onSelect: () => void
  onHover: (hovering: boolean) => void
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ delay: Math.min(index, 6) * 0.04 }}
      onClick={onSelect}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className={cn(
        'p-3 border-b border-gray-50 cursor-pointer transition-colors',
        isSelected || isHovered ? 'bg-blue-50/40' : 'hover:bg-gray-50'
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex flex-col gap-0.5">
          {suggestion.shortMessage && (
            <span className="text-[12px] font-medium text-gray-700">{suggestion.shortMessage}</span>
          )}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-red-500 line-through font-mono">{suggestion.originalText}</span>
            <span className="text-gray-400 text-xs">→</span>
            <span className="text-xs text-green-600 font-medium font-mono">{suggestion.replacement}</span>
          </div>
        </div>
        <span className={cn(
          'text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0',
          TYPE_COLOR[suggestion.category]
        )}>
          {suggestion.category}
        </span>
      </div>

      {suggestion.explanation && (
        <p className="text-[11px] text-gray-400 leading-relaxed mb-2">{suggestion.explanation}</p>
      )}

      {suggestion.alternatives.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          <span className="text-[10px] text-gray-400">Also:</span>
          {suggestion.alternatives.map((alt) => (
            <span key={alt} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
              {alt}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onAccept() }}
          className="px-3 py-1 bg-purple-accent text-white text-xs rounded-lg hover:bg-purple-deep transition-colors"
        >
          Accept
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onIgnore() }}
          className="px-3 py-1 bg-gray-100 text-gray-500 text-xs rounded-lg hover:bg-gray-200 transition-colors"
        >
          Ignore
        </button>
      </div>
    </motion.div>
  )
}

// ── ScoreRing ─────────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const size        = 96
  const strokeWidth = 8
  const radius       = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset        = circumference * (1 - score / 100)
  const colour =
    score >= 90 ? '#10b981'   // emerald-500
    : score >= 70 ? '#f59e0b' // amber-500
    : '#dc2626'               // red-600

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f3f4f6" strokeWidth={strokeWidth} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colour}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn(
          'text-2xl font-bold tabular-nums',
          score >= 90 ? 'text-emerald-600' : score >= 70 ? 'text-amber-600' : 'text-red-600'
        )}>
          {score}
        </span>
        <span className="text-[9px] text-gray-400 font-medium uppercase tracking-wider">/100</span>
      </div>
    </div>
  )
}

// ── ResultsEmptyState ─────────────────────────────────────────────────────────

function ResultsEmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 py-10 text-center gap-4">
      <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
        <Sparkles className="w-4 h-4 text-emerald-600 opacity-70" />
      </div>
      <div>
        <p className="text-[14px] font-medium text-gray-600">Corrected text will appear here</p>
        <p className="text-[12px] text-gray-400 mt-1 max-w-[220px] leading-relaxed">
          Fixes grammar, spelling, and punctuation with inline corrections you can accept or ignore — paste text, then click "Check grammar".
        </p>
      </div>
      {/* Ghosted correction example */}
      <div className="w-full max-w-xs mt-1 opacity-60 text-left">
        <div className="p-3 rounded-lg border border-[#e0e0da] bg-gray-50 text-xs leading-6 text-gray-400">
          The company{' '}
          <span className="bg-red-50 text-red-300 px-0.5 rounded line-through">have</span>{' '}
          <span className="bg-emerald-50 text-emerald-600 px-0.5 rounded font-medium">has</span>{' '}
          grown{' '}
          <span className="bg-red-50 text-red-300 px-0.5 rounded line-through">significant</span>{' '}
          <span className="bg-emerald-50 text-emerald-600 px-0.5 rounded font-medium">significantly</span>{' '}
          this year.
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5 text-center">Corrections highlighted</p>
      </div>
    </div>
  )
}

// ── GrammarPage ───────────────────────────────────────────────────────────────

export default function GrammarPage() {
  const {
    inputText, context, enabledCategories, isLoading, result, error,
    setInputText, setContext, toggleCategory, setEnabledCategories, setResult,
  } = useGrammarStore()
  const { check } = useGrammar()

  const [activeText, setActiveText]               = useState('')
  const [activeSuggestions, setActiveSuggestions] = useState<ActiveSuggestion[]>([])
  const [selectedId, setSelectedId]               = useState<string | null>(null)
  const [hoveredId, setHoveredId]                 = useState<string | null>(null)
  const [copied, setCopied]                       = useState(false)

  const cardRefs  = useRef<Record<string, HTMLDivElement | null>>({})
  const outputRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const { text, clearTransfer } = useToolTransferStore.getState()
    if (text) {
      setInputText(text)
      clearTransfer()
      toast('Text transferred — ready to check!', { icon: '✅' })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  useEffect(() => {
    if (!result) return
    setActiveText(result.originalText)
    setActiveSuggestions(result.suggestions.map((s) => ({ ...s, status: 'pending' as const })))
    setSelectedId(null)
    setTimeout(() => outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100)
  }, [result])

  const pendingSuggestions = useMemo(
    () => activeSuggestions.filter((s) => s.status === 'pending'),
    [activeSuggestions]
  )

  const sortedPending = useMemo(
    () => [...pendingSuggestions].sort(
      (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.startOffset - b.startOffset
    ),
    [pendingSuggestions]
  )

  // Accepted and ignored suggestions both count as "resolved" for scoring purposes —
  // only suggestions still pending should drag the score/counts down.
  const totalOriginalCount = result?.suggestions.length ?? 0
  const resolvedCount      = totalOriginalCount - pendingSuggestions.length

  const liveErrors = useMemo(
    () => pendingSuggestions.filter((s) => s.severity === 'Error').length,
    [pendingSuggestions]
  )
  const liveWarnings = useMemo(
    () => pendingSuggestions.filter((s) => s.severity === 'Warning').length,
    [pendingSuggestions]
  )
  const liveCategoryCount = useMemo(() => {
    const map: Partial<Record<ErrorCategory, number>> = {}
    for (const s of pendingSuggestions) map[s.category] = (map[s.category] ?? 0) + 1
    return map
  }, [pendingSuggestions])

  const liveScore = useMemo(() => {
    if (!result) return 0
    if (totalOriginalCount === 0) return result.qualityScore
    const base = result.qualityScore
    return Math.round(base + (100 - base) * (resolvedCount / totalOriginalCount))
  }, [result, resolvedCount, totalOriginalCount])

  const wordCount   = inputText.trim() ? inputText.trim().split(/\s+/).length : 0
  const canCheck    = wordCount >= 2 && !isLoading
  const hasResult   = !!result
  const allResolved = hasResult && sortedPending.length === 0
  const noIssues    = hasResult && result.suggestions.length === 0
  const issueCount  = sortedPending.length
  const allChecksOn = ALL_CHECK_IDS.every(id => enabledCategories.includes(id))
  // Results were computed for a snapshot of the input text — if the user keeps typing
  // afterwards, the highlighted offsets and suggestions no longer apply to what's on screen.
  const isStale     = hasResult && result.originalText !== inputText

  const handleCheck = async () => {
    if (!canCheck) return
    await check()
  }

  const handleTrySample = useCallback(async () => {
    setInputText(SAMPLE_TEXT)
    await check()
  }, [setInputText, check])

  const handleAccept = useCallback((suggestion: ActiveSuggestion) => {
    const { text, suggestions } = applyOneSuggestion(activeText, suggestion, activeSuggestions)
    setActiveText(text)
    setActiveSuggestions(suggestions)
    setSelectedId(null)
  }, [activeText, activeSuggestions])

  const handleIgnore = useCallback((id: string) => {
    setActiveSuggestions((prev) => prev.map((s) => s.id === id ? { ...s, status: 'ignored' as const } : s))
    setSelectedId(null)
  }, [])

  const handleAcceptAll = useCallback(() => {
    const corrected = applyAllSuggestions(activeText, activeSuggestions)
    setActiveText(corrected)
    setActiveSuggestions((prev) => prev.map((s) => s.status === 'pending' ? { ...s, status: 'accepted' as const } : s))
    setSelectedId(null)
    toast.success('All suggestions accepted')
  }, [activeText, activeSuggestions])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(activeText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Copied to clipboard!')
  }, [activeText])

  const handleClear = useCallback(() => {
    setInputText('')
    setResult(null)
    setActiveText('')
    setActiveSuggestions([])
    setSelectedId(null)
  }, [setInputText, setResult])

  const handleSelectSuggestion = useCallback((id: string) => {
    setSelectedId(id)
    cardRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [])

  return (
    <div className="min-h-0 bg-transparent px-4 py-6 w-full space-y-4">

      {/* Controls: Mode tabs + Check type row */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">

        {/* Mode selector */}
        <div className="border-b border-gray-100 px-4 py-3">
          <span className="block text-[12px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
            Mode
          </span>
          <div className="flex flex-wrap gap-1.5">
            {MODES.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setContext(m.id)}
                className={cn(
                  'px-4 h-9 flex items-center rounded-lg text-[15px] font-medium transition-colors whitespace-nowrap',
                  context === m.id
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            {MODES.find(m => m.id === context)?.desc}
          </p>
        </div>

        {/* Check type row */}
        <div className="flex items-center gap-3 px-4 py-2.5 flex-wrap">
          <span className="text-[12px] font-semibold text-gray-400 uppercase tracking-wide">Core</span>
          <div className="flex gap-1.5 flex-wrap">
            {CORE_CHECKS.map(cat => {
              const isActive = enabledCategories.includes(cat)
              const count    = hasResult ? (liveCategoryCount[cat] ?? 0) : 0
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                    isActive
                      ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-accent hover:text-white hover:border-purple-accent'
                      : 'bg-white text-gray-400 border-transparent hover:border-gray-200 hover:text-gray-600'
                  )}
                >
                  {cat}
                  {hasResult && count > 0 && (
                    <span className="ml-1.5 text-[10px] font-bold">{count}</span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="w-px h-4 bg-gray-200 flex-shrink-0" />

          <span className="text-[12px] font-semibold text-gray-400 uppercase tracking-wide">Advanced</span>
          <div className="flex gap-1.5 flex-wrap">
            {ADVANCED_CHECKS.map(cat => {
              const isActive = enabledCategories.includes(cat)
              const count    = hasResult ? (liveCategoryCount[cat] ?? 0) : 0
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                    isActive
                      ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-accent hover:text-white hover:border-purple-accent'
                      : 'bg-white text-gray-400 border-transparent hover:border-gray-200 hover:text-gray-600'
                  )}
                >
                  {cat}
                  {hasResult && count > 0 && (
                    <span className="ml-1.5 text-[10px] font-bold">{count}</span>
                  )}
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => setEnabledCategories(allChecksOn ? [] : ALL_CHECK_IDS)}
            className="ml-auto text-xs text-gray-400 hover:text-gray-700 transition-colors"
          >
            {allChecksOn ? 'Clear all' : 'Select all'}
          </button>
        </div>
      </div>

      {/* Editor panels + contextual sidebar — on lg+ all three columns share one
          viewport-bound height so each can scroll internally; primary actions
          (Check grammar, Accept All) live in shrink-0 header/footer rows and are
          never pushed off screen by long content. Mobile keeps natural stacking. */}
      <div className="flex flex-col lg:flex-row gap-5 lg:items-stretch lg:h-[calc(100vh-15rem)]">
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-5 lg:h-full min-w-0">

          {/* Input panel — sticky */}
          <div className="lg:sticky lg:top-4" style={{ height: 'calc(100vh - 15rem)' }}>
            <div
              className="bg-white border border-gray-100 rounded-xl overflow-hidden flex flex-col h-full relative"
              {...dragHandlers}
            >
              {fileInputElement}
              <DropOverlay isDragging={isDragging} isProcessing={isFileProcessing} />

              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 shrink-0">
                <PanelLabel label="Your text" count={wordCount} />
                <div className="flex items-center gap-3">
                  <UtilityButton
                    icon={<Clipboard size={16} />}
                    label="Paste"
                    onClick={handlePasteFromClipboard}
                    disabled={isLoading}
                  />
                  <UtilityButton
                    icon={<Upload size={16} />}
                    label="Upload"
                    onClick={openFilePicker}
                    disabled={isLoading || isFileProcessing}
                  />
                </div>
              </div>

              {/* Textarea */}
              <div className="relative flex-1 min-h-0">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={isLoading}
                  className="textarea-body absolute inset-0 w-full h-full bg-white text-gray-800 resize-none outline-none focus:ring-2 focus:ring-inset focus:ring-purple-accent/30 rounded-lg px-4 py-3 disabled:opacity-60 disabled:cursor-not-allowed"
                />
                {!inputText && (
                  <div className="textarea-body pointer-events-none absolute inset-0 px-4 py-3 text-gray-400 select-none">
                    Paste or type your text here to check grammar and spelling, or{' '}
                    <button
                      type="button"
                      onClick={handleTrySample}
                      disabled={isLoading}
                      className="pointer-events-auto underline decoration-dotted underline-offset-2 hover:text-gray-600 transition-colors disabled:opacity-40"
                    >
                      try a sample
                    </button>
                    .
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <ClearButton onClick={handleClear} disabled={!(inputText || hasResult)} />
                  {wordCount > 0 && wordCount < 2 && (
                    <span className="text-xs text-gray-400">Keep typing…</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleCheck}
                  disabled={!canCheck}
                  className={cn(
                    primaryButtonClass(canCheck),
                    isStale && !isLoading && 'ring-2 ring-purple-accent ring-offset-2'
                  )}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Checking…
                    </>
                  ) : isStale ? (
                    'Re-check grammar'
                  ) : (
                    'Check grammar'
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Output panel */}
          <div
            ref={outputRef}
            className="bg-white border border-gray-100 rounded-xl overflow-hidden flex flex-col lg:h-full"
            style={{ minHeight: 480 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                <PanelLabel label="Results" />
                {hasResult && issueCount > 0 && (
                  <span className="px-1.5 py-0.5 bg-red-50 text-red-700 text-xs rounded-md">
                    {issueCount} issue{issueCount !== 1 ? 's' : ''}
                  </span>
                )}
                {hasResult && result.qualityScore !== undefined && (
                  <span className={cn(
                    'text-xs px-1.5 py-0.5 rounded-md font-medium',
                    liveScore >= 90 ? 'bg-emerald-50 text-emerald-600'
                      : liveScore >= 70 ? 'bg-amber-50 text-amber-600'
                      : 'bg-red-50 text-red-700'
                  )}>
                    {liveScore}/100
                  </span>
                )}
              </div>
              {hasResult && (
                <div className="flex items-center gap-3">
                  {sortedPending.length > 0 && (
                    <button
                      type="button"
                      onClick={handleAcceptAll}
                      className="lg:hidden flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-gray-300 transition-colors"
                    >
                      <CheckCheck className="w-3 h-3" />
                      Accept all
                    </button>
                  )}
                  <OutputActionButton icon={<Copy className="w-3 h-3" />} onClick={handleCopy}>
                    {copied ? 'Copied' : 'Copy'}
                  </OutputActionButton>
                </div>
              )}
            </div>

            {isStale && !isLoading && (
              <div className="mx-4 mt-3 shrink-0 flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-100">
                <span className="text-xs text-amber-700">Text changed — results may be out of date.</span>
                <button
                  type="button"
                  onClick={handleCheck}
                  className="text-xs font-semibold text-amber-700 hover:text-amber-900 underline underline-offset-2 shrink-0"
                >
                  Re-run check
                </button>
              </div>
            )}

            <AnimatePresence mode="wait">
              {!hasResult && !isLoading && !error && (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <ResultsEmptyState />
                </motion.div>
              )}

              {isLoading && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex-1 px-4 py-4"
                >
                  <Skeleton variant="text" tone="light" lines={6} />
                </motion.div>
              )}

              {!isLoading && !hasResult && error && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex-1 flex flex-col items-center justify-center h-full gap-3 text-center px-8 py-10"
                >
                  <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center">
                    <AlertCircle size={16} className="text-red-500" />
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
                    <SpellCheck size={12} /> Retry
                  </button>
                </motion.div>
              )}

              {hasResult && !isLoading && (
                <motion.div
                  key="results"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex-1 min-h-0 flex flex-col"
                >
                  {/* Annotated text — capped height, own scroll, independent of the card list below */}
                  <div className="px-4 py-4 border-b border-gray-50 shrink-0 overflow-y-auto" style={{ maxHeight: '38%' }}>
                    {(noIssues || allResolved) && (
                      <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-100 mb-4">
                        <CheckCheck className="w-5 h-5 text-emerald-500 shrink-0" />
                        <div>
                          <p className="text-sm text-emerald-700 font-semibold">
                            {noIssues ? 'No issues found' : 'All suggestions resolved'}
                          </p>
                          <p className="text-xs text-emerald-600 mt-0.5">
                            {noIssues
                              ? `Your text looks great! Quality score: ${liveScore}/100`
                              : "Your corrected text is shown below — copy it whenever you're ready."}
                          </p>
                        </div>
                      </div>
                    )}
                    {!noIssues && !allResolved && (
                      <p className="text-[12px] text-gray-400 uppercase tracking-wider font-semibold mb-3">
                        Click an underline to jump to its suggestion
                      </p>
                    )}
                    {!noIssues && (
                      <AnnotatedText
                        text={activeText}
                        suggestions={activeSuggestions}
                        selectedId={selectedId}
                        hoveredId={hoveredId}
                        onSelect={handleSelectSuggestion}
                        onHover={setHoveredId}
                      />
                    )}
                  </div>

                  {/* Suggestion cards — fills remaining height, scrolls independently */}
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    {sortedPending.length > 0 && (
                      <AnimatePresence>
                        {sortedPending.map((s, i) => (
                          <div key={s.id} ref={(el) => { cardRefs.current[s.id] = el }}>
                            <SuggestionCard
                              suggestion={s}
                              index={i}
                              isSelected={selectedId === s.id}
                              isHovered={hoveredId === s.id}
                              onAccept={() => handleAccept(s)}
                              onIgnore={() => handleIgnore(s.id)}
                              onSelect={() => setSelectedId(s.id)}
                              onHover={(hovering) => setHoveredId(hovering ? s.id : null)}
                            />
                          </div>
                        ))}
                      </AnimatePresence>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {hasResult && (
              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-end shrink-0">
                <SendToMenu text={activeText} />
              </div>
            )}
          </div>

        </div>

        {/* Grammar Score sidebar */}
        <AnimatePresence>
          {(hasResult || isLoading) && (
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.25 }}
              className="hidden lg:flex w-[208px] shrink-0 flex-col bg-white border border-gray-100 rounded-xl overflow-hidden lg:h-full"
            >
              <div className="px-4 py-3 border-b border-gray-100 shrink-0">
                <div className="flex items-center gap-2">
                  <SpellCheck className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-sm font-semibold text-gray-700">Grammar Score</span>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center gap-3 p-4">
                {hasResult && result ? (
                  <>
                    <div className="mt-2">
                      <ScoreRing score={liveScore} />
                    </div>
                    <div className="w-full mt-1 space-y-2">
                      {liveErrors > 0 && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-500">Errors</span>
                          <span className="font-semibold text-red-600 tabular-nums">{liveErrors}</span>
                        </div>
                      )}
                      {liveWarnings > 0 && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-500">Warnings</span>
                          <span className="font-semibold text-amber-500 tabular-nums">{liveWarnings}</span>
                        </div>
                      )}
                    </div>
                    {Object.keys(liveCategoryCount).length > 0 && (
                      <>
                        <div className="w-full h-px bg-gray-100" />
                        <div className="w-full space-y-1.5">
                          {Object.entries(liveCategoryCount).map(([cat, count]) => (
                            <div key={cat} className="flex justify-between items-center text-[11px]">
                              <span className="text-gray-500 font-medium">{cat}</span>
                              <span className="font-semibold text-gray-700 tabular-nums">{count}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <div className="mt-4 w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center">
                      <SpellCheck className="w-5 h-5 text-gray-300" />
                    </div>
                    <p className="text-xs text-gray-400 text-center leading-relaxed">
                      Run a check to see your grammar score
                    </p>
                  </>
                )}
              </div>
              {hasResult && sortedPending.length > 0 && (
                <div className="px-4 py-3 border-t border-gray-100 shrink-0">
                  <button
                    type="button"
                    onClick={handleAcceptAll}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-gray-300 transition-colors"
                  >
                    <CheckCheck className="w-3 h-3" />
                    Accept All
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  )
}
