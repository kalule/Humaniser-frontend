import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  SpellCheck, Copy, RotateCcw, CheckCheck, Upload, FileText, Wand2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '../../lib/utils'
import { useGrammarStore } from '../../store/grammarStore'
import { useGrammar } from '../../hooks/useGrammar'
import { useDragDrop } from '../../hooks/useDragDrop'
import { DropOverlay } from '../../components/ui/DropOverlay'
import type { ActiveSuggestion, ErrorCategory, GrammarContext, GrammarLanguage } from '../../types/grammar'

// ── Constants ─────────────────────────────────────────────────────────────────

const CONTEXTS: { value: GrammarContext; label: string }[] = [
  { value: 'General',  label: 'General' },
  { value: 'Academic', label: 'Academic' },
  { value: 'Business', label: 'Business' },
  { value: 'Creative', label: 'Creative' },
  { value: 'Casual',   label: 'Casual' },
]

const LANGUAGES: { value: GrammarLanguage; label: string }[] = [
  { value: 'AmericanEnglish',   label: 'American English' },
  { value: 'BritishEnglish',    label: 'British English' },
  { value: 'AustralianEnglish', label: 'Australian English' },
]

const CATEGORIES: { value: ErrorCategory; colour: string }[] = [
  { value: 'Spelling',    colour: '#ef4444' },
  { value: 'Grammar',     colour: '#ef4444' },
  { value: 'Punctuation', colour: '#f59e0b' },
  { value: 'Style',       colour: '#4f6ef7' },
  { value: 'Clarity',     colour: '#4f6ef7' },
  { value: 'Conciseness', colour: '#8b5cf6' },
  { value: 'Consistency', colour: '#f59e0b' },
  { value: 'Tone',        colour: '#8b5cf6' },
]

const SEVERITY_ORDER: Record<string, number> = { Error: 0, Warning: 1, Suggestion: 2 }

const SAMPLE_TEXT =
  `She recieved the report on monday and immediately forwarded it to the team. The data suggests that there is alot of room for improvment in there processes. Each of the managers have submitted there quarterly review's on time, which is a good sign. Going foward, we should leverage every oppurtunity to optimise our workflows and facilitate better collaboration accross departments.`

const CONTEXT_DESCRIPTIONS: Record<GrammarContext, string> = {
  General:  'Standard grammar rules applied with moderate sensitivity.',
  Academic: 'Passive voice is acceptable. Contractions and fragments are flagged.',
  Business: 'Passive voice flagged only when ambiguous. Professional tone assumed.',
  Creative: 'Very conservative — only definite errors flagged. Style is not touched.',
  Casual:   'Only definite spelling and grammar errors. Fragments are intentional.',
}

// ── Client-side suggestion applier (mirrors C# SuggestionApplier) ─────────────

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

// ── Word count badge ──────────────────────────────────────────────────────────

function WordCountBadge({ count, min = 0 }: { count: number; min?: number }) {
  const tooFew = count > 0 && count < min
  return (
    <span className={cn(
      'text-[13px] font-medium px-2.5 py-1 rounded-full',
      count === 0  ? 'bg-slate-700 text-slate-400'
      : tooFew     ? 'bg-red-500/15 text-red-400'
      : 'bg-slate-700 text-slate-300',
    )}>
      {count > 0 ? `${count} words${tooFew ? ` (${min - count} more needed)` : ''}` : '0 words'}
    </span>
  )
}

// ── Quality badge ─────────────────────────────────────────────────────────────

function QualityBadge({ score }: { score: number }) {
  const [colorClass, label] =
    score >= 90 ? ['text-emerald-400 bg-emerald-500/15 border-emerald-500/20', 'Excellent'] :
    score >= 70 ? ['text-amber-400 bg-amber-500/15 border-amber-500/20', 'Good'] :
                  ['text-red-400 bg-red-500/15 border-red-500/20', 'Needs work']

  return (
    <span className={cn('text-[13px] font-semibold px-2.5 py-1 rounded-full border', colorClass)}>
      {score}/100 · {label}
    </span>
  )
}

// ── Annotated text renderer ───────────────────────────────────────────────────

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
    return <p className="text-[15px] leading-[1.75] text-slate-200 whitespace-pre-wrap">{text}</p>
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
    <p className="text-[15px] leading-[1.75] text-slate-200">
      {segments}
    </p>
  )
}

// ── Suggestion card ───────────────────────────────────────────────────────────

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
  const severityBg: Record<string, string> = {
    Error:      'text-red-400 bg-red-500/10',
    Warning:    'text-amber-400 bg-amber-500/10',
    Suggestion: 'text-indigo-400 bg-indigo-500/10',
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      onClick={onSelect}
      className={cn(
        'rounded-2xl border p-4 cursor-pointer transition-all duration-150',
        isSelected
          ? 'border-slate-600 bg-slate-700/60'
          : 'border-slate-700 bg-slate-800/60 hover:border-slate-600 hover:bg-slate-700/40'
      )}
    >
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span
          className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: suggestion.categoryColour + '20', color: suggestion.categoryColour }}
        >
          {suggestion.category}
        </span>
        <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full', severityBg[suggestion.severity])}>
          {suggestion.severity}
        </span>
      </div>

      <p className="text-[14px] font-medium text-slate-200 mb-1.5">{suggestion.shortMessage}</p>

      <div className="flex items-center gap-2 mb-2 text-[13px]">
        <span className="text-red-400 line-through font-mono">{suggestion.originalText}</span>
        <span className="text-slate-500">→</span>
        <span className="text-emerald-400 font-medium font-mono">{suggestion.replacement}</span>
      </div>

      {suggestion.explanation && (
        <p className="text-[13px] text-slate-500 leading-snug mb-3">{suggestion.explanation}</p>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onAccept() }}
          className="flex-1 text-[13px] font-medium py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 transition-colors"
        >
          Accept
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onIgnore() }}
          className="flex-1 text-[13px] font-medium py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-400 transition-colors"
        >
          Ignore
        </button>
      </div>
    </motion.div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GrammarPage() {
  const {
    inputText, context, language, enabledCategories, isLoading, result,
    setInputText, setContext, setLanguage, toggleCategory, setResult,
  } = useGrammarStore()
  const { check } = useGrammar()

  const [activeText, setActiveText] = useState('')
  const [activeSuggestions, setActiveSuggestions] = useState<ActiveSuggestion[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const outputRef = useRef<HTMLDivElement>(null)

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

  const wordCount = inputText.trim() ? inputText.trim().split(/\s+/).length : 0
  const canCheck  = wordCount >= 2 && !isLoading

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

  const hasResult   = !!result
  const allResolved = hasResult && sortedPending.length === 0
  const noIssues    = hasResult && result.suggestions.length === 0

  return (
    <div className="min-h-0 bg-transparent w-full">
      <main className="w-full px-4 py-6 space-y-5">

        {/* Controls card */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 space-y-3">
          {/* Context + Language */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1">
              {CONTEXTS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setContext(c.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150',
                    context === c.value
                      ? 'bg-slate-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1">
              {LANGUAGES.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  onClick={() => setLanguage(l.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150',
                    language === l.value
                      ? 'bg-slate-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  )}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <p className="text-slate-400 text-[13px] pl-1">
            <span className="text-slate-200 font-medium">{context}:</span>{' '}
            {CONTEXT_DESCRIPTIONS[context]}
          </p>
        </div>

        {/* Category chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] text-slate-500 font-medium mr-1">Check:</span>
          {CATEGORIES.map((cat) => {
            const active = enabledCategories.includes(cat.value)
            return (
              <button
                key={cat.value}
                type="button"
                onClick={() => toggleCategory(cat.value)}
                className={cn(
                  'px-3 py-1 rounded-lg text-[13px] font-medium border transition-all duration-150',
                  active
                    ? 'text-white border-transparent'
                    : 'bg-transparent text-slate-400 border-slate-700 hover:text-slate-200 hover:border-slate-600'
                )}
                style={active ? { backgroundColor: cat.colour + '28', color: cat.colour, borderColor: cat.colour + '50' } : {}}
              >
                {cat.value}
              </button>
            )
          })}
        </div>

        {/* Editor panels + contextual sidebar */}
        <div className="flex gap-5 items-start">
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-5 items-start min-w-0">

          {/* Input panel — sticky */}
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
                      className="text-[13px] text-rose-400 hover:text-rose-300 underline underline-offset-2 transition-colors"
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
                  <WordCountBadge count={wordCount} min={2} />
                </div>
              </div>

              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste or type your text here to check grammar and spelling…"
                className="flex-1 min-h-0 w-full bg-transparent text-slate-200 placeholder:text-slate-500 resize-none focus:outline-none px-5 py-4 text-[15px] leading-[1.75]"
              />

              <div className="px-5 py-3 border-t border-slate-700/50 flex items-center justify-between shrink-0">
                <span className="text-[13px] text-slate-400">Min. 2 words · Max. 50,000 chars</span>
                <div className="flex items-center gap-3">
                  {(inputText || hasResult) && (
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
                    onClick={handleCheck}
                    disabled={!canCheck}
                    className={cn(
                      'flex items-center gap-2 px-5 py-2.5 rounded-xl text-[15px] font-semibold transition-all',
                      'bg-gradient-to-r from-rose-600 to-pink-600 text-white',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      canCheck && 'hover:opacity-90 shadow shadow-rose-500/20'
                    )}
                  >
                    {isLoading ? (
                      <>
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                          <SpellCheck size={14} />
                        </motion.div>
                        Checking…
                      </>
                    ) : (
                      <>
                        <Wand2 size={14} />
                        Check Grammar
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Output panel */}
          <div
            ref={outputRef}
            className="bg-slate-800 border border-slate-700/80 rounded-2xl overflow-hidden flex flex-col shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
            style={{ minHeight: 480 }}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700 shrink-0">
              <div className="flex items-center gap-2 text-slate-300 font-medium text-[14px]">
                <SpellCheck size={14} className="text-slate-400" />
                Results
              </div>
              {hasResult && (
                <div className="flex items-center gap-2">
                  <QualityBadge score={result.qualityScore} />
                </div>
              )}
            </div>

            <AnimatePresence mode="wait">
              {!hasResult && !isLoading && (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex-1 flex flex-col items-center justify-center text-center px-8 py-12 gap-4"
                >
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-rose-500/10 border border-rose-500/20">
                    <SpellCheck size={22} className="text-rose-400" />
                  </div>
                  <div>
                    <p className="text-slate-300 font-semibold text-[15px]">Your corrected text will appear here</p>
                    <p className="text-slate-500 text-[13px] mt-1">
                      Paste text on the left and click Check Grammar. Errors are highlighted inline so you can accept or ignore each one.
                    </p>
                  </div>
                </motion.div>
              )}

              {isLoading && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex-1 flex items-center justify-center gap-3"
                >
                  {[0, 1, 2].map(i => (
                    <motion.span
                      key={i}
                      className="w-2 h-2 rounded-full bg-rose-500"
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
                  <div className="px-5 py-4 border-b border-slate-700/50">
                    {noIssues || allResolved ? (
                      <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                        <CheckCheck size={18} className="text-emerald-400 shrink-0" />
                        <div>
                          <p className="text-[14px] text-emerald-300 font-semibold">
                            {noIssues ? 'No issues found' : 'All suggestions resolved'}
                          </p>
                          <p className="text-[13px] text-emerald-500 mt-0.5">
                            {noIssues
                              ? 'Your text looks great! Quality score: ' + result.qualityScore + '/100'
                              : 'Copy the corrected text whenever you\'re ready.'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-[12px] text-slate-500 uppercase tracking-wider font-semibold mb-3">
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
                    <div className="px-5 py-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[13px] text-slate-500">
                          {sortedPending.length} suggestion{sortedPending.length !== 1 ? 's' : ''} · {result.totalErrors} error{result.totalErrors !== 1 ? 's' : ''}, {result.totalWarnings} warning{result.totalWarnings !== 1 ? 's' : ''}
                        </p>
                        <button
                          type="button"
                          onClick={handleAcceptAll}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-[13px] font-medium transition-colors"
                        >
                          <CheckCheck size={12} />
                          Accept All
                        </button>
                      </div>

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
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="px-5 py-3 border-t border-slate-700/50 flex items-center justify-end gap-3 shrink-0">
              {hasResult && (
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-[14px] font-medium transition-colors"
                >
                  <Copy size={13} />
                  Copy Corrected Text
                </button>
              )}
            </div>
          </div>

        </div>
        {/* end input/output grid */}

        {/* Contextual sidebar — Grammar Score (desktop only) */}
        <AnimatePresence>
          {(hasResult || isLoading) && (
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.25 }}
              className="hidden lg:flex w-[208px] shrink-0 flex-col bg-slate-800 border border-slate-700/80 rounded-2xl overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_4px_32px_rgba(0,0,0,0.35)]"
            >
              <div className="px-5 py-3 border-b border-slate-700">
                <div className="flex items-center gap-2">
                  <SpellCheck size={13} className="text-slate-400" />
                  <span className="text-[14px] font-semibold text-slate-200">Grammar Score</span>
                </div>
              </div>
              <div className="flex-1 flex flex-col items-center gap-3 p-4">
                {hasResult && result ? (
                  <>
                    <div className="flex flex-col items-center gap-1 mt-2">
                      <span className={cn(
                        'text-4xl font-bold tabular-nums',
                        result.qualityScore >= 90 ? 'text-emerald-400'
                          : result.qualityScore >= 70 ? 'text-amber-400'
                          : 'text-red-400'
                      )}>
                        {result.qualityScore}
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">/100</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
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
                        <div className="flex justify-between items-center text-[12px]">
                          <span className="text-slate-500">Errors</span>
                          <span className="font-semibold text-red-400 tabular-nums">{result.totalErrors}</span>
                        </div>
                      )}
                      {result.totalWarnings > 0 && (
                        <div className="flex justify-between items-center text-[12px]">
                          <span className="text-slate-500">Warnings</span>
                          <span className="font-semibold text-amber-400 tabular-nums">{result.totalWarnings}</span>
                        </div>
                      )}
                      {sortedPending.length > 0 && (
                        <div className="flex justify-between items-center text-[12px]">
                          <span className="text-slate-500">Pending</span>
                          <span className="font-semibold text-slate-300 tabular-nums">{sortedPending.length}</span>
                        </div>
                      )}
                    </div>
                    {sortedPending.length > 0 && (
                      <button
                        type="button"
                        onClick={handleAcceptAll}
                        className="mt-auto w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[13px] font-semibold bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-600/25 transition-all"
                      >
                        <CheckCheck size={12} />
                        Accept All
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <div className="mt-4 w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                      <SpellCheck size={18} className="text-rose-400/70" />
                    </div>
                    <p className="text-[11px] text-slate-500 text-center leading-relaxed">
                      Run a check to see your grammar score
                    </p>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        </div>
        {/* end flex+sidebar wrapper */}

      </main>
    </div>
  )
}
