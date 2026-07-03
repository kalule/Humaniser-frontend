import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SpellCheck, Copy, RotateCcw, CheckCheck, Upload, Sparkles, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '../../lib/utils'
import { useGrammarStore } from '../../store/grammarStore'
import { useGrammar } from '../../hooks/useGrammar'
import { useDragDrop } from '../../hooks/useDragDrop'
import { DropOverlay } from '../../components/ui/DropOverlay'
import { SendToMenu } from '../../components/ui/SendToMenu'
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
  Spelling:    'bg-red-50 text-red-500',
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
  onSelect,
}: {
  text: string
  suggestions: ActiveSuggestion[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const pending = [...suggestions]
    .filter((s) => s.status === 'pending')
    .sort((a, b) => a.startOffset - b.startOffset)

  if (pending.length === 0) {
    return <p className="text-[15px] leading-[1.75] text-gray-800 whitespace-pre-wrap">{text}</p>
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
        title={s.shortMessage}
        style={{
          backgroundColor: s.categoryColour + '18',
          borderBottom: `2px solid ${s.categoryColour}`,
          borderRadius: '2px',
          cursor: 'pointer',
          padding: '1px 0',
          outline: selectedId === s.id ? `2px solid ${s.categoryColour}` : 'none',
          outlineOffset: '1px',
          transition: 'outline 0.15s ease',
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
    <p className="text-[15px] leading-[1.75] text-gray-800">
      {segments}
    </p>
  )
}

// ── SuggestionCard ────────────────────────────────────────────────────────────

function SuggestionCard({
  suggestion,
  isSelected,
  onAccept,
  onIgnore,
  onSelect,
}: {
  suggestion: ActiveSuggestion
  isSelected: boolean
  onAccept: () => void
  onIgnore: () => void
  onSelect: () => void
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      onClick={onSelect}
      className={cn(
        'p-3 border-b border-gray-50 cursor-pointer transition-colors',
        isSelected ? 'bg-blue-50/40' : 'hover:bg-gray-50'
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

      {suggestion.correctedSentence.length > suggestion.replacement.length + 10 && (
        <p
          className="text-[11px] text-gray-500 italic leading-snug mb-2 px-2 py-1.5 rounded-lg bg-gray-50"
          style={{ borderLeft: `2px solid ${suggestion.categoryColour}60` }}
        >
          {suggestion.correctedSentence}
        </p>
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
          className="px-3 py-1 bg-gray-900 text-white text-xs rounded-md hover:bg-gray-800 transition-colors"
        >
          Accept
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onIgnore() }}
          className="px-3 py-1 bg-gray-100 text-gray-500 text-xs rounded-md hover:bg-gray-200 transition-colors"
        >
          Ignore
        </button>
      </div>
    </motion.div>
  )
}

// ── ResultsEmptyState ─────────────────────────────────────────────────────────

function ResultsEmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 py-10 text-center gap-4">
      <Sparkles className="w-8 h-8 text-gray-300" />
      <div>
        <p className="text-sm font-medium text-gray-600">Your corrected text</p>
        <p className="text-xs text-gray-400 mt-1 leading-relaxed max-w-[220px]">
          Paste text on the left and click "Check grammar". Errors are highlighted inline — accept or ignore each one.
        </p>
      </div>
      {/* Suggestion skeleton */}
      <div className="w-full max-w-xs mt-1 opacity-40 flex flex-col gap-2">
        <div className="p-3 rounded-lg border border-gray-100 bg-gray-50 text-left">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex flex-col gap-1 flex-1">
              <div className="h-2.5 bg-red-100 rounded w-3/4" />
              <div className="h-2.5 bg-green-100 rounded w-2/3" />
            </div>
            <span className="text-[10px] bg-gray-200 text-gray-400 px-1.5 py-0.5 rounded">Spelling</span>
          </div>
          <div className="flex gap-2">
            <div className="h-5 w-12 bg-gray-900 rounded opacity-20" />
            <div className="h-5 w-12 bg-gray-200 rounded" />
          </div>
        </div>
        <div className="p-3 rounded-lg border border-gray-100 bg-gray-50 flex items-center gap-3">
          <div className="flex-1 flex flex-col gap-1.5">
            <div className="h-2.5 bg-gray-200 rounded w-full" />
            <div className="h-2 bg-gray-200 rounded w-2/3" />
          </div>
          <span className="text-[10px] bg-gray-200 text-gray-400 px-1.5 py-0.5 rounded">Grammar</span>
        </div>
      </div>
    </div>
  )
}

// ── GrammarPage ───────────────────────────────────────────────────────────────

export default function GrammarPage() {
  const {
    inputText, context, enabledCategories, isLoading, result,
    setInputText, setContext, toggleCategory, setEnabledCategories, setResult,
  } = useGrammarStore()
  const { check } = useGrammar()

  const [activeText, setActiveText]               = useState('')
  const [activeSuggestions, setActiveSuggestions] = useState<ActiveSuggestion[]>([])
  const [selectedId, setSelectedId]               = useState<string | null>(null)
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

  const wordCount   = inputText.trim() ? inputText.trim().split(/\s+/).length : 0
  const canCheck    = wordCount >= 2 && !isLoading
  const hasResult   = !!result
  const allResolved = hasResult && sortedPending.length === 0
  const noIssues    = hasResult && result.suggestions.length === 0
  const issueCount  = sortedPending.length
  const allChecksOn = ALL_CHECK_IDS.every(id => enabledCategories.includes(id))

  const handleCheck = async () => {
    if (!canCheck) return
    await check()
  }

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
    setResult(null)
    setActiveText('')
    setActiveSuggestions([])
    setSelectedId(null)
  }, [setResult])

  const handleSelectSuggestion = useCallback((id: string) => {
    setSelectedId(id)
    cardRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [])

  return (
    <div className="min-h-0 bg-transparent px-4 py-6 w-full space-y-4">

      {/* Controls: Mode tabs + Check type row */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">

        {/* Mode tab bar */}
        <div className="border-b border-gray-100">
          <div className="flex gap-0 px-4">
            {MODES.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setContext(m.id)}
                className={cn(
                  'px-4 py-3 text-sm border-b-2 transition-colors whitespace-nowrap',
                  context === m.id
                    ? 'border-blue-600 text-gray-900 font-medium'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="px-5 py-1.5 text-xs text-gray-400">
            {MODES.find(m => m.id === context)?.desc}
          </p>
        </div>

        {/* Check type row */}
        <div className="flex items-center gap-3 px-4 py-2.5 flex-wrap">
          <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Core</span>
          <div className="flex gap-1.5 flex-wrap">
            {CORE_CHECKS.map(cat => {
              const isActive = enabledCategories.includes(cat)
              const count    = hasResult ? (result?.suggestionCountByCategory[cat] ?? 0) : 0
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                    isActive
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
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

          <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Advanced</span>
          <div className="flex gap-1.5 flex-wrap">
            {ADVANCED_CHECKS.map(cat => {
              const isActive = enabledCategories.includes(cat)
              const count    = hasResult ? (result?.suggestionCountByCategory[cat] ?? 0) : 0
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                    isActive
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
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

      {/* Editor panels + contextual sidebar */}
      <div className="flex gap-5 items-start">
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-5 items-start min-w-0">

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
                <span className="text-sm font-medium text-gray-700">
                  Your text
                  {wordCount > 0 && (
                    <span className="ml-2 text-xs font-normal text-gray-400">{wordCount} words</span>
                  )}
                </span>
                <div className="flex items-center gap-3">
                  {!inputText && (
                    <button
                      type="button"
                      onClick={() => setInputText(SAMPLE_TEXT)}
                      className="text-xs text-blue-500 hover:underline transition-colors"
                    >
                      Try sample
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={openFilePicker}
                    disabled={isLoading || isFileProcessing}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40"
                  >
                    <Upload className="w-3 h-3" />
                    Upload
                  </button>
                </div>
              </div>

              {/* Textarea */}
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste or type your text here to check grammar and spelling…"
                className="flex-1 min-h-0 w-full bg-white text-gray-800 placeholder:text-gray-400 resize-none focus:outline-none px-4 py-3 text-sm leading-relaxed"
              />

              {/* Footer */}
              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  {(inputText || hasResult) && (
                    <button
                      type="button"
                      onClick={handleClear}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Clear
                    </button>
                  )}
                  {wordCount > 0 && wordCount < 2 && (
                    <span className="text-xs text-gray-400">Keep typing…</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleCheck}
                  disabled={!canCheck}
                  className={cn(
                    'flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors',
                    !canCheck
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-900 text-white hover:bg-gray-800'
                  )}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Checking…
                    </>
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
            className="bg-white border border-gray-100 rounded-xl overflow-hidden flex flex-col"
            style={{ minHeight: 480 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 shrink-0">
              <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                Results
                {hasResult && issueCount > 0 && (
                  <span className="px-1.5 py-0.5 bg-red-50 text-red-500 text-xs rounded-md">
                    {issueCount} issue{issueCount !== 1 ? 's' : ''}
                  </span>
                )}
                {hasResult && result.qualityScore !== undefined && (
                  <span className={cn(
                    'text-xs px-1.5 py-0.5 rounded-md font-medium',
                    result.qualityScore >= 90 ? 'bg-emerald-50 text-emerald-600'
                      : result.qualityScore >= 70 ? 'bg-amber-50 text-amber-600'
                      : 'bg-red-50 text-red-500'
                  )}>
                    {result.qualityScore}/100
                  </span>
                )}
              </span>
              {hasResult && (
                <div className="flex items-center gap-3">
                  {sortedPending.length > 0 && (
                    <button
                      type="button"
                      onClick={handleAcceptAll}
                      className="text-xs text-blue-500 hover:underline transition-colors"
                    >
                      Accept all
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              )}
            </div>

            <AnimatePresence mode="wait">
              {!hasResult && !isLoading && (
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
                  className="flex-1 flex items-center justify-center gap-3 py-20"
                >
                  {[0, 1, 2].map(i => (
                    <motion.span
                      key={i}
                      className="w-2 h-2 rounded-full bg-blue-400"
                      animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </motion.div>
              )}

              {hasResult && !isLoading && (
                <motion.div
                  key="results"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex-1 overflow-y-auto"
                >
                  {/* Annotated text */}
                  <div className="px-4 py-4 border-b border-gray-50">
                    {noIssues || allResolved ? (
                      <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                        <CheckCheck className="w-5 h-5 text-emerald-500 shrink-0" />
                        <div>
                          <p className="text-sm text-emerald-700 font-semibold">
                            {noIssues ? 'No issues found' : 'All suggestions resolved'}
                          </p>
                          <p className="text-xs text-emerald-600 mt-0.5">
                            {noIssues
                              ? `Your text looks great! Quality score: ${result.qualityScore}/100`
                              : "Copy the corrected text whenever you're ready."}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-[11px] text-gray-400 uppercase tracking-wider font-medium mb-3">
                          Click an underline to jump to its suggestion
                        </p>
                        <AnnotatedText
                          text={activeText}
                          suggestions={activeSuggestions}
                          selectedId={selectedId}
                          onSelect={handleSelectSuggestion}
                        />
                      </>
                    )}
                  </div>

                  {/* Suggestion cards */}
                  {sortedPending.length > 0 && (
                    <AnimatePresence>
                      {sortedPending.map((s) => (
                        <div key={s.id} ref={(el) => { cardRefs.current[s.id] = el }}>
                          <SuggestionCard
                            suggestion={s}
                            isSelected={selectedId === s.id}
                            onAccept={() => handleAccept(s)}
                            onIgnore={() => handleIgnore(s.id)}
                            onSelect={() => setSelectedId(s.id)}
                          />
                        </div>
                      ))}
                    </AnimatePresence>
                  )}
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
              className="hidden lg:flex w-[208px] shrink-0 flex-col bg-white border border-gray-100 rounded-xl overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <SpellCheck className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-sm font-semibold text-gray-700">Grammar Score</span>
                </div>
              </div>
              <div className="flex-1 flex flex-col items-center gap-3 p-4">
                {hasResult && result ? (
                  <>
                    <div className="flex flex-col items-center gap-1 mt-2">
                      <span className={cn(
                        'text-4xl font-bold tabular-nums',
                        result.qualityScore >= 90 ? 'text-emerald-500'
                          : result.qualityScore >= 70 ? 'text-amber-500'
                          : 'text-red-500'
                      )}>
                        {result.qualityScore}
                      </span>
                      <span className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">/100</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        className={cn(
                          'h-full rounded-full',
                          result.qualityScore >= 90 ? 'bg-emerald-500'
                            : result.qualityScore >= 70 ? 'bg-amber-500'
                            : 'bg-red-500'
                        )}
                        initial={{ width: '0%' }}
                        animate={{ width: `${result.qualityScore}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                      />
                    </div>
                    <div className="w-full mt-1 space-y-2">
                      {result.totalErrors > 0 && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-500">Errors</span>
                          <span className="font-semibold text-red-500 tabular-nums">{result.totalErrors}</span>
                        </div>
                      )}
                      {result.totalWarnings > 0 && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-500">Warnings</span>
                          <span className="font-semibold text-amber-500 tabular-nums">{result.totalWarnings}</span>
                        </div>
                      )}
                      {sortedPending.length > 0 && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-500">Pending</span>
                          <span className="font-semibold text-gray-700 tabular-nums">{sortedPending.length}</span>
                        </div>
                      )}
                    </div>
                    {Object.keys(result.suggestionCountByCategory).length > 0 && (
                      <>
                        <div className="w-full h-px bg-gray-100" />
                        <div className="w-full space-y-1.5">
                          {Object.entries(result.suggestionCountByCategory).map(([cat, count]) => (
                            <div key={cat} className="flex justify-between items-center text-[11px]">
                              <span className="text-gray-500 font-medium">{cat}</span>
                              <span className="font-semibold text-gray-700 tabular-nums">{count}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    {sortedPending.length > 0 && (
                      <button
                        type="button"
                        onClick={handleAcceptAll}
                        className="mt-auto w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-gray-900 text-white hover:bg-gray-800 transition-colors"
                      >
                        <CheckCheck className="w-3 h-3" />
                        Accept All
                      </button>
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
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  )
}
