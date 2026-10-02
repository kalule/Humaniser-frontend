import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SpellCheck, Copy, CheckCheck, Upload, Clipboard, Sparkles, Loader2, AlertCircle, ChevronDown, MoreHorizontal } from 'lucide-react'
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
import { ResultsPanelHeader } from '../../components/ui/ResultsPanelHeader'
import { PanelFooterBar } from '../../components/ui/PanelFooterBar'
import { ToolBottomActionRow } from '../../components/ui/ToolBottomActionRow'
import { ToolSidebarShell } from '../../components/ui/ToolSidebarShell'
import { ToolWorkspaceCard } from '../../components/shared/ToolWorkspaceCard'
import { useToolTransferStore } from '../../store/toolTransferStore'
import type { ActiveSuggestion, ErrorCategory, GrammarContext, GrammarLanguage } from '../../types/grammar'

// ── Constants ─────────────────────────────────────────────────────────────────

// Temporary kill switch for the Grammar Score sidebar — flip back to true to restore it.
const SHOW_GRAMMAR_SCORE_SIDEBAR = false

const MODES: { id: GrammarContext; label: string; desc: string }[] = [
  { id: 'General',  label: 'General',  desc: 'Standard grammar rules applied with moderate sensitivity.' },
  { id: 'Academic', label: 'Academic', desc: 'Formal tone, citation-ready, avoids colloquialisms.' },
  { id: 'Business', label: 'Business', desc: 'Professional register, concise phrasing.' },
  { id: 'Creative', label: 'Creative', desc: 'Preserves voice, flags only clear errors.' },
  { id: 'Casual',   label: 'Casual',   desc: 'Relaxed tone, minimal intervention.' },
]

const LANGUAGES: { id: GrammarLanguage; label: string; desc: string }[] = [
  { id: 'BritishEnglish',    label: 'British',    desc: 'colour, organise, analyse' },
  { id: 'AmericanEnglish',   label: 'American',   desc: 'color, organize, analyze' },
  { id: 'AustralianEnglish', label: 'Australian', desc: 'colour, organise (follows British)' },
]

// Output-toolbar buttons on this page: the shared OutputActionButton default (h-6 / 11px)
// is too small a target here.
const OUTPUT_BTN_SIZE = 'h-8 px-3 gap-1.5 text-[13px] rounded-lg'

const CORE_CHECKS: ErrorCategory[]     = ['Spelling', 'Grammar', 'Punctuation']
const ADVANCED_CHECKS: ErrorCategory[] = ['Style', 'Clarity', 'Conciseness', 'Consistency', 'Tone']
const ALL_CHECK_COUNT = CORE_CHECKS.length + ADVANCED_CHECKS.length

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

// Applies a SUBSET of pending suggestions (e.g. Core-only) while leaving the rest pending
// with correct offsets — unlike applyAllSuggestions above, which only works because it
// assumes nothing remains pending afterward. Folds applyOneSuggestion right-to-left: each
// call already re-derives every other suggestion's offsets (and drops any that now overlap),
// and processing the rightmost remaining item first means every subsequent item in `toAccept`
// is still positioned before it, so its offset in `all` is never touched by an earlier step.
function applyManySuggestions(
  text: string,
  toAccept: ActiveSuggestion[],
  all: ActiveSuggestion[],
): { text: string; suggestions: ActiveSuggestion[] } {
  const ordered = [...toAccept].sort((a, b) => b.startOffset - a.startOffset)
  let currentText = text
  let currentSuggestions = all
  for (const s of ordered) {
    const result = applyOneSuggestion(currentText, s, currentSuggestions)
    currentText = result.text
    currentSuggestions = result.suggestions
  }
  return { text: currentText, suggestions: currentSuggestions }
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

// ── useDismiss ────────────────────────────────────────────────────────────────

function useDismiss(ref: React.RefObject<HTMLElement | null>, open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [ref, open, onClose])
}

// ── PillDropdown ──────────────────────────────────────────────────────────────
//
// Toolbar dropdown in the same visual style as the Humaniser/Paraphraser/Summariser
// toolbars. Each option can carry a one-line description shown in the menu.

const TOOLBAR_LABEL = 'text-[12px] font-semibold text-neutral-500 uppercase tracking-wider shrink-0'
const TOOLBAR_PILL =
  'px-4 h-9 flex items-center rounded-lg text-[14px] font-medium transition-all duration-150 border whitespace-nowrap ' +
  'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300 hover:text-neutral-900 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed'

function PillDropdown<T extends string>({
  label, options, value, onChange, disabled, minWidth = '9rem',
}: {
  label: string
  options: { id: T; label: string; desc: string }[]
  value: T
  onChange: (id: T) => void
  disabled?: boolean
  minWidth?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)

  return (
    <div className="flex items-center gap-2">
      <span className={TOOLBAR_LABEL}>{label}</span>
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(TOOLBAR_PILL, 'gap-1.5 justify-between')}
          style={{ minWidth }}
        >
          {options.find(o => o.id === value)?.label}
          <ChevronDown size={14} className={cn('transition-transform duration-150', open && 'rotate-180')} />
        </button>

        {open && (
          <div role="listbox" aria-label={label} className="absolute z-30 top-full mt-1.5 left-0 w-72 bg-white border border-gray-200 rounded-xl shadow-elevated overflow-hidden py-1">
            {options.map(o => (
              <button
                key={o.id}
                type="button"
                role="option"
                aria-selected={value === o.id}
                onClick={() => { onChange(o.id); setOpen(false) }}
                className={cn('flex flex-col items-start w-full px-3 py-2 text-left transition-colors', value === o.id ? 'bg-purple-50' : 'hover:bg-gray-50')}
              >
                <span className="text-[13px] font-medium text-gray-800">{o.label}</span>
                <span className="text-[11px] text-gray-500">{o.desc}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── CategoryRow ───────────────────────────────────────────────────────────────
//
// One row per check type inside the Checks popover. Core and Advanced are genuinely
// identical toggles end to end (same store action, same backend include/exclude
// handling in GrammarPromptBuilder), so one component keeps them from drifting apart.
// A native checkbox keeps the on/off state readable without relying on colour.

function CategoryRow({
  category, isActive, count, onToggle,
}: {
  category: ErrorCategory
  isActive: boolean
  count: number
  onToggle: () => void
}) {
  return (
    <label className="flex items-center justify-between gap-3 px-3 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
      <span className="flex items-center gap-2 text-[13px] text-gray-700">
        <input
          type="checkbox"
          checked={isActive}
          onChange={onToggle}
          className="w-4 h-4 accent-purple-600"
        />
        {category}
      </span>
      {count > 0 && (
        <span className={cn('text-[11px] font-semibold px-1.5 py-0.5 rounded', TYPE_COLOR[category])}>
          {count}
        </span>
      )}
    </label>
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
    language, setInputText, setContext, setLanguage, toggleCategory, setEnabledCategories, setResult,
  } = useGrammarStore()
  const { check } = useGrammar()

  const [activeText, setActiveText]               = useState('')
  const [activeSuggestions, setActiveSuggestions] = useState<ActiveSuggestion[]>([])
  const [selectedId, setSelectedId]               = useState<string | null>(null)
  const [hoveredId, setHoveredId]                 = useState<string | null>(null)
  const [copied, setCopied]                       = useState(false)

  const [checksOpen, setChecksOpen]             = useState(false)
  const [overflowOpen, setOverflowOpen]       = useState(false)
  const checksRef   = useRef<HTMLDivElement>(null)
  const overflowRef = useRef<HTMLDivElement>(null)
  const closeChecks   = useCallback(() => setChecksOpen(false), [])
  const closeOverflow = useCallback(() => setOverflowOpen(false), [])
  useDismiss(checksRef, checksOpen, closeChecks)
  useDismiss(overflowRef, overflowOpen, closeOverflow)

  const cardRefs  = useRef<Record<string, HTMLDivElement | null>>({})
  const outputRef = useRef<HTMLDivElement>(null)

  // react-hot-toast's <Toaster/> is mounted once at the app root (App.tsx), outside the
  // router's route tree — toasts are a global singleton with their own timers, not scoped
  // to whichever page created them. A toast left on its default duration keeps rendering
  // after the user navigates away from this page. Track the bulk-undo toast's id so it can
  // be dismissed explicitly (both when superseded by a new one, and on unmount/navigation).
  const coreUndoToastId = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (coreUndoToastId.current) toast.dismiss(coreUndoToastId.current)
    }
  }, [])

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

  // Drives both the "Accept all Core fixes (N)" button's count and its visibility —
  // single source so the label can't drift from what the button actually acts on.
  const corePendingCount = useMemo(
    () => pendingSuggestions.filter((s) => CORE_CHECKS.includes(s.category)).length,
    [pendingSuggestions]
  )

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
  // "Clear all" is deliberately scoped to Advanced only (see CORE_CHECKS/ADVANCED_CHECKS
  // audit note above) — a single button that can silently turn off Spelling/Grammar/
  // Punctuation is a trap, since those are the baseline reason someone opens a grammar
  // checker. Core stays individually toggleable, just not swept by this one.
  const advancedOn  = ADVANCED_CHECKS.every(id => enabledCategories.includes(id))
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

  // Core (Spelling/Grammar/Punctuation) only — Advanced suggestions are subjective rewrites
  // that stay individual Accept/Ignore. Snapshots pre-batch state so Undo can restore it
  // exactly; the toast's own duration bounds how long that offer stays valid.
  const handleAcceptAllCore = useCallback(() => {
    const toAccept = pendingSuggestions.filter((s) => CORE_CHECKS.includes(s.category))
    if (toAccept.length === 0) return

    const preText = activeText
    const preSuggestions = activeSuggestions

    const { text, suggestions } = applyManySuggestions(activeText, toAccept, activeSuggestions)
    setActiveText(text)
    setActiveSuggestions(suggestions)
    setSelectedId(null)

    // A second bulk-accept before the first toast times out replaces it rather than stacking.
    if (coreUndoToastId.current) toast.dismiss(coreUndoToastId.current)

    const count = toAccept.length
    coreUndoToastId.current = toast((t) => (
      <div className="flex items-center gap-3 text-[13px]">
        <span>{count} core fix{count !== 1 ? 'es' : ''} applied</span>
        <button
          type="button"
          onClick={() => {
            toast.dismiss(t.id)
            coreUndoToastId.current = null
            setActiveText(preText)
            setActiveSuggestions(preSuggestions)
            setSelectedId(null)
          }}
          className="font-semibold text-purple-accent hover:text-purple-deep"
        >
          Undo
        </button>
      </div>
    ), { duration: 8000 })
  }, [activeText, activeSuggestions, pendingSuggestions])

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

  // Config controls only appear once there's something to check — the defaults (General
  // mode, all check categories on) are sensible enough to run with immediately, so the
  // empty state stays quiet instead of front-loading configuration before the user has
  // typed anything. One row, matching Humaniser/Paraphraser/Summariser: Mode and English
  // are dropdowns (five and three options with explanations worth showing), and the eight
  // check types live in one Checks popover instead of eight always-visible chips.
  const enabledCount = enabledCategories.length
  const toggleBar = !inputText ? null : (
    <div className="bg-neutral-100 rounded-xl px-4 py-3 flex items-center flex-wrap gap-x-4 gap-y-2">
      <PillDropdown
        label="Mode"
        options={MODES}
        value={context}
        onChange={setContext}
        disabled={isLoading}
        minWidth="8.5rem"
      />

      <div className="hidden sm:block w-px h-5 bg-neutral-200" />

      <PillDropdown
        label="English"
        options={LANGUAGES}
        value={language}
        onChange={setLanguage}
        disabled={isLoading}
        minWidth="9.5rem"
      />

      <div className="hidden sm:block w-px h-5 bg-neutral-200" />

      {/* Checks popover */}
      <div className="flex items-center gap-2">
        <span className={TOOLBAR_LABEL}>Checks</span>
        <div className="relative" ref={checksRef}>
          <button
            type="button"
            onClick={() => setChecksOpen(v => !v)}
            disabled={isLoading}
            aria-haspopup="dialog"
            aria-expanded={checksOpen}
            className={cn(TOOLBAR_PILL, 'gap-1.5')}
          >
            {enabledCount === ALL_CHECK_COUNT ? 'All' : `${enabledCount} of ${ALL_CHECK_COUNT}`}
            <ChevronDown size={14} className={cn('transition-transform duration-150', checksOpen && 'rotate-180')} />
          </button>

          {checksOpen && (
            <div role="dialog" aria-label="Check types" className="absolute z-30 top-full mt-1.5 left-0 w-72 bg-white border border-gray-200 rounded-xl shadow-elevated py-2 px-1">
              <p className="px-3 pt-1 pb-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Core</p>
              {CORE_CHECKS.map(cat => (
                <CategoryRow
                  key={cat}
                  category={cat}
                  isActive={enabledCategories.includes(cat)}
                  count={hasResult ? (liveCategoryCount[cat] ?? 0) : 0}
                  onToggle={() => toggleCategory(cat)}
                />
              ))}
              <div className="flex items-center justify-between px-3 pt-2 pb-1">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Advanced</p>
                <button
                  type="button"
                  onClick={() => setEnabledCategories(
                    advancedOn
                      ? enabledCategories.filter(id => !ADVANCED_CHECKS.includes(id))
                      : Array.from(new Set([...enabledCategories, ...ADVANCED_CHECKS]))
                  )}
                  className="text-[11px] text-gray-500 hover:text-gray-800 transition-colors"
                >
                  {advancedOn ? 'Clear advanced' : 'Select advanced'}
                </button>
              </div>
              {ADVANCED_CHECKS.map(cat => (
                <CategoryRow
                  key={cat}
                  category={cat}
                  isActive={enabledCategories.includes(cat)}
                  count={hasResult ? (liveCategoryCount[cat] ?? 0) : 0}
                  onToggle={() => toggleCategory(cat)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Description of the selected mode: stays on this row when there's room. */}
      <p className="ml-auto text-xs text-neutral-500">
        {MODES.find(m => m.id === context)?.desc}
      </p>
    </div>
  )

  const leftPanel = {
    header: (
      <div className="flex items-center px-4 py-2.5 border-b border-[#e0e0da] shrink-0">
        <PanelLabel label="Your text" />
      </div>
    ),
    body: (
      <div className="flex-1 min-h-0 flex flex-col relative" {...dragHandlers}>
        {fileInputElement}
        <DropOverlay isDragging={isDragging} isProcessing={isFileProcessing} />
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
                disabled={isLoading}
              />
              <UtilityButton
                icon={<Upload size={14} />}
                label="Upload"
                className="h-8 px-3 text-[13px]"
                onClick={openFilePicker}
                disabled={isLoading || isFileProcessing}
              />
            </>
          }
        />
        <ToolBottomActionRow
          clearButton={<ClearButton onClick={handleClear} disabled={!(inputText || hasResult)} />}
          hint={wordCount > 0 && wordCount < 2 ? 'Keep typing…' : undefined}
          primaryButton={
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
          }
        />
      </>
    ),
  }

  const rightPanel = {
    header: (
      <ResultsPanelHeader
        title={
          <div className="flex items-center gap-2">
            <PanelLabel label="Results" />
            {hasResult && issueCount > 0 && (
              <span className="px-1.5 py-0.5 bg-red-50 text-red-700 text-xs rounded-md">
                {issueCount} issue{issueCount !== 1 ? 's' : ''}
              </span>
            )}
            {hasResult && result.qualityScore !== undefined && (
              <span
                title="Quality score: rises as you accept or ignore suggestions"
                className={cn(
                'text-xs px-1.5 py-0.5 rounded-md font-medium',
                liveScore >= 90 ? 'bg-emerald-50 text-emerald-600'
                  : liveScore >= 70 ? 'bg-amber-50 text-amber-600'
                  : 'bg-red-50 text-red-700'
              )}>
                {liveScore}/100
              </span>
            )}
          </div>
        }
      />
    ),
    footer: hasResult && (
      <PanelFooterBar
        actions={
          <>
            {corePendingCount > 0 && (
              <button
                type="button"
                onClick={handleAcceptAllCore}
                title="Applies the Spelling, Grammar and Punctuation fixes. Advanced suggestions (style, clarity, tone…) stay individual so you can judge each one."
                className={cn(
                  'flex items-center font-semibold bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-gray-300 transition-colors',
                  OUTPUT_BTN_SIZE,
                )}
              >
                <CheckCheck className="w-4 h-4" />
                Accept all fixes ({corePendingCount})
              </button>
            )}
            <OutputActionButton
              icon={<Copy className="w-4 h-4" />}
              className={OUTPUT_BTN_SIZE}
              onClick={handleCopy}
            >
              {copied ? 'Copied' : 'Copy'}
            </OutputActionButton>
            <div className="relative" ref={overflowRef}>
              <OutputActionButton
                icon={<MoreHorizontal className="w-4 h-4" />}
                className={cn(OUTPUT_BTN_SIZE, 'w-8 justify-center px-0')}
                onClick={() => setOverflowOpen(v => !v)}
                aria-haspopup="menu"
                aria-expanded={overflowOpen}
                aria-label="More actions"
                title="More actions"
              >
                <span className="sr-only">More</span>
              </OutputActionButton>
              {overflowOpen && (
                <div role="menu" className="absolute right-0 bottom-full mb-1.5 z-30 w-48 bg-white border border-gray-200 rounded-xl shadow-elevated overflow-hidden py-1">
                  <div className="px-1">
                    <SendToMenu
                      text={activeText}
                      inline
                      className="w-full [&>button]:w-full [&>button]:justify-start [&>button]:h-auto [&>button]:px-2 [&>button]:py-2 [&>button]:border-0 [&>button]:text-[13px]"
                    />
                  </div>
                </div>
              )}
            </div>
          </>
        }
      />
    ),
    body: (
      <div className="flex-1 min-h-0 flex flex-col">
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
                  {/* Annotated text — capped to 45% + its own scroll only while the suggestion
                      card list below still needs room. Once everything's resolved there's
                      nothing left below competing for space, so let this fill the panel instead
                      of trapping the finished, correct text in a small scrolling sliver. */}
                  <div
                    className={cn(
                      'px-4 py-4 overflow-y-auto',
                      noIssues || allResolved
                        ? 'flex-1 min-h-0'
                        : 'border-b border-gray-50 shrink-0'
                    )}
                    style={noIssues || allResolved ? undefined : { maxHeight: '45%' }}
                  >
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

                  {/* Suggestion cards — fills remaining height, scrolls independently. Collapses
                      to nothing (rather than claiming an equal flex-1 share while empty) once
                      everything's resolved, so the corrected text above gets the full panel. */}
                  <div className={cn('overflow-y-auto', sortedPending.length > 0 ? 'flex-1 min-h-0' : 'shrink-0')}>
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
      </div>
    ),
  }

  return (
    <div className="min-h-0 bg-transparent px-4 py-6 w-full">
      <ToolWorkspaceCard
        className="lg:sticky lg:top-4"
        style={{ height: 'calc(100vh - 7rem)' }}
        toggleBar={toggleBar}
        leftPanel={leftPanel}
        rightPanel={rightPanel}
        sidebar={
          <AnimatePresence>
            {SHOW_GRAMMAR_SCORE_SIDEBAR && (hasResult || isLoading) && (
              <motion.div
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.25 }}
              >
                <ToolSidebarShell
                  icon={<SpellCheck className="w-3.5 h-3.5 text-gray-400" />}
                  label="Grammar Score"
                  footer={hasResult && sortedPending.length > 0 && (
                    <button
                      type="button"
                      onClick={handleAcceptAll}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-gray-300 transition-colors"
                    >
                      <CheckCheck className="w-3 h-3" />
                      Accept All
                    </button>
                  )}
                >
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
                </ToolSidebarShell>
              </motion.div>
            )}
          </AnimatePresence>
        }
      />
    </div>
  )
}
