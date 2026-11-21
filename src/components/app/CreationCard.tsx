import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertTriangle, Ban, Loader2, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { useLibraryStore } from '../../store/libraryStore'
import { useDraftHandoffStore } from '../../store/draftHandoffStore'
import { importDocumentFromFile } from '../../lib/importWordDocument'
import { FORMAT_LABELS, FORMAT_STYLES } from '../../types/citation'
import type { FormatStyle } from '../../types/citation'
import type { DocumentGenre } from '../../types/library'
import { essayQuestionCheckApi } from '../../api/essayQuestionCheck'
import type { EssayQuestionCheckResult } from '../../api/essayQuestionCheck'
import { DIMENSIONS, applySuggestion, bandTone, flagLabels, questionHintsFrom, shouldShowResult } from '../../lib/essayQuestionCheck'
import { cn } from '../../lib/utils'

// New-document flow prompt #3 — replaces the old "Name your document" modal. Captures document
// type + citation style up front (previously chosen inside the editor after the fact, or never
// at all) and gets the user into a useful editor in one step instead of two.

const LAST_CITATION_STYLE_KEY = 'humanise_last_citation_style'

// This card creates essays only. Literature reviews (user decision 2026-11-17), research papers (2026-11-18),
// proposals, systematic reviews and thesis chapters are written in their own studios, reached from the side
// menu, which screen sources and check citations before export. Documents that already have another type still
// open and export as before (the type is only a label).
const DOCUMENT_TYPE: DocumentGenre = 'Essay'

function lastUsedCitationStyle(): FormatStyle {
  try {
    const saved = localStorage.getItem(LAST_CITATION_STYLE_KEY)
    if (saved && (FORMAT_STYLES as string[]).includes(saved)) return saved as FormatStyle
  } catch {
    // localStorage unavailable (private browsing, etc.) — fall through to the default
  }
  return 'apa7'
}

// Longest title we keep whole. Research questions and essay prompts routinely run past 60
// characters, and clipping there made different documents on the same topic indistinguishable in
// the library (every title ended "…the quali…").
export const MAX_DERIVED_TITLE_LENGTH = 120

// Exported for testing. Title is derived from the prompt rather than asked for separately — the
// first line, kept whole up to MAX_DERIVED_TITLE_LENGTH and otherwise cut at a word boundary
// (never mid-word), falling back to "Untitled document" for an empty/whitespace-only prompt.
export function deriveTitleFromPrompt(prompt: string): string {
  const firstLine = prompt.trim().split('\n')[0].replace(/\s+/g, ' ').trim()
  if (!firstLine) return 'Untitled document'
  if (firstLine.length <= MAX_DERIVED_TITLE_LENGTH) return firstLine
  const window = firstLine.slice(0, MAX_DERIVED_TITLE_LENGTH + 1)
  const lastSpace = window.lastIndexOf(' ')
  // Only back up to a space when that doesn't throw away most of the title (one very long token).
  const cut = lastSpace > MAX_DERIVED_TITLE_LENGTH * 0.6 ? window.slice(0, lastSpace) : window.slice(0, MAX_DERIVED_TITLE_LENGTH)
  return `${cut.replace(/[\s,;:.\-–—]+$/, '')}…`
}

interface CreationCardProps {
  onClose: () => void
}

export function CreationCard({ onClose }: CreationCardProps) {
  const navigate = useNavigate()
  const createDocument = useLibraryStore(s => s.createDocument)
  const setPendingDraft = useDraftHandoffStore(s => s.setPending)

  const documentType = DOCUMENT_TYPE
  const [citationStyle, setCitationStyle] = useState<FormatStyle>(lastUsedCitationStyle)
  const [topic, setTopic] = useState('')
  const [busy, setBusy] = useState(false)
  const [isSetQuestion, setIsSetQuestion] = useState(false)
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<EssayQuestionCheckResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const closedRef = useRef(false)
  // The last check's result and the exact question it checked: its concepts and search terms go on to essay planning only for that question.
  const lastCheckRef = useRef<{ question: string; result: EssayQuestionCheckResult | null } | null>(null)
  // Reset on every mount: StrictMode (dev) mounts, unmounts and remounts, and a flag only ever set to true here left
  // the card thinking it was closed, so a finished check never cleared "Checking question…".
  useEffect(() => {
    closedRef.current = false
    return () => { closedRef.current = true }
  }, [])

  const showResult = shouldShowResult(checkResult)
  const blocked = showResult && checkResult?.canOverride === false

  const hasPrompt = topic.trim().length > 0
  // Nudge short prompts: drafts improve with a topic plus level/scope. Hidden when empty (prompt is optional).
  const weakPrompt = hasPrompt && topic.trim().split(/\s+/).length < 6

  const rememberCitationStyle = (style: FormatStyle) => {
    setCitationStyle(style)
    try { localStorage.setItem(LAST_CITATION_STYLE_KEY, style) } catch { /* ignore */ }
  }

  // "Start with a blank page" and a plain "Create" (empty prompt) are the same thing: create now,
  // no AI draft. Only a non-empty prompt behind the primary button routes through the
  // create-with-draft hand-off.
  const handleCreate = async (withDraft: boolean) => {
    if (busy) return
    setBusy(true)
    try {
      const doc = await createDocument({
        title: deriveTitleFromPrompt(topic),
        documentType,
        citationStyle,
      })
      if (withDraft && hasPrompt) {
        const checked = lastCheckRef.current
        const questionHints = checked?.question === topic.trim() ? questionHintsFrom(checked.result?.assessment) : undefined
        setPendingDraft({ documentId: doc.id, topic: topic.trim(), documentType, citationStyle, questionHints })
      }
      onClose()
      navigate(`/app/editor/${doc.id}`)
    } catch {
      setBusy(false) // createDocument already toasts on failure — stay open so the user can retry
    }
  }

  // The question is checked before writing. A ready question goes straight on; a weak one shows the check and the
  // student can still write anyway, unless the check blocks it (unclear task, clarification needed, gibberish or a
  // harmful request). A failed or unavailable check never stops the student.
  const handleWrite = async () => {
    if (busy || checking || !hasPrompt || blocked) return
    if (showResult) { void handleCreate(true); return } // "Write anyway"
    setChecking(true)
    let result: EssayQuestionCheckResult | null = null
    try {
      result = await essayQuestionCheckApi.check({ question: topic.trim(), isSetQuestion })
    } catch {
      result = null
    } finally {
      if (!closedRef.current) setChecking(false)
    }
    if (closedRef.current) return
    lastCheckRef.current = { question: topic.trim(), result }
    if (shouldShowResult(result)) { setCheckResult(result); return }
    void handleCreate(true)
  }

  const changeTopic = (value: string) => {
    setTopic(value)
    setCheckResult(null)
  }

  const handleImportClick = () => fileInputRef.current?.click()

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || busy) return
    setBusy(true)
    try {
      const doc = await importDocumentFromFile(file, createDocument, { documentType, citationStyle })
      onClose()
      navigate(`/app/editor/${doc.id}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not read that file.'
      toast.error(message)
      setBusy(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !busy) { onClose(); return }
    // Mirrors the primary button, which only acts when there is a topic to write about.
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !busy && hasPrompt) { e.preventDefault(); void handleWrite() }
  }

  // Rendered into document.body (see createPortal below) rather than wherever the caller happens
  // to sit in the tree: AppShell's layout nests this component under an ancestor that creates a
  // CSS containing block (any ancestor with transform/filter/will-change, including framer-motion
  // elements), which scopes `fixed inset-0` to that ancestor's box instead of the real viewport —
  // the reported bug (modal's top edge clipped against the header, header never dims) was exactly
  // that. Same technique Modal.tsx already uses for this reason.
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onKeyDown={handleKeyDown}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !busy && onClose()} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="creation-card-title"
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className={cn('relative bg-white border border-[#e0e0da] rounded-2xl w-full shadow-2xl flex flex-col max-h-[calc(100vh-2rem)]', showResult ? 'max-w-lg' : 'max-w-md')}
      >
        <div className="px-6 pt-5 pb-3">
          <h3 id="creation-card-title" className="text-[#1a1a18] font-semibold text-lg">
            New essay
          </h3>
          <p className="text-[13px] text-neutral-500 mt-0.5">You can rename the document later, in the editor.</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-2">
        {/* Topic / prompt — first: it is the main task, gets focus, and keeps its checkbox and hint beside it. */}
        <div className="mb-4">
          <label htmlFor="creation-card-topic" className="block text-[13px] font-medium text-[#1a1a18] mb-2">
            Your essay question
          </label>
          <textarea
            id="creation-card-topic"
            autoFocus
            rows={3}
            value={topic}
            disabled={busy || checking}
            onChange={e => changeTopic(e.target.value)}
            placeholder="e.g. &ldquo;To what extent does social media use contribute to anxiety in adolescents aged 13 to 18?&rdquo;"
            className={cn(
              'w-full bg-neutral-100 border-0 rounded-lg px-3.5 py-2.5 text-[#1a1a18] text-sm outline-none focus:ring-2 focus:ring-[#7c3aed]/20 resize-none',
              // While checking, the text stays readable (it is what is being checked); only a real disable fades it.
              checking ? 'disabled:opacity-80 disabled:cursor-wait' : 'disabled:opacity-50',
            )}
            aria-describedby="creation-card-topic-hint"
          />
          <p id="creation-card-topic-hint" className={cn('text-[11px] mt-1 min-h-[1rem] flex items-center gap-1.5', checking ? 'text-[#7c3aed]' : 'text-neutral-400')} aria-live="polite">
            {checking && <Loader2 size={11} className="animate-spin shrink-0" aria-hidden="true" />}
            {checking
              ? 'Checking your question before writing. This takes about 5 to 10 seconds.'
              : weakPrompt ? 'Weak prompt: add the topic, level or word count for a stronger draft.' : ''}
          </p>
          <label className="flex items-center gap-2 text-[12px] text-neutral-600 mt-1 select-none">
            <input
              type="checkbox"
              checked={isSetQuestion}
              disabled={busy || checking}
              onChange={e => { setIsSetQuestion(e.target.checked); setCheckResult(null) }}
              className="accent-[#7c3aed]"
            />
            My lecturer set this question (keep its wording)
          </label>
        </div>

        {showResult && checkResult?.assessment && (
          <QuestionCheckPanel
            result={checkResult}
            onUseSuggestion={s => changeTopic(applySuggestion(topic, s, checkResult.assessment!.suggestedPromptMode))}
          />
        )}

        {/* Citation style — a remembered setting, so it sits below the question. */}
        <div className="mb-2">
          <label htmlFor="creation-card-citation-style" className="block text-[13px] font-medium text-[#1a1a18] mb-2">Citation style</label>
          <select
            id="creation-card-citation-style"
            value={citationStyle}
            disabled={busy}
            onChange={e => rememberCitationStyle(e.target.value as FormatStyle)}
            className="w-full bg-neutral-100 border-0 rounded-lg px-3.5 py-2.5 text-[#1a1a18] text-sm outline-none focus:ring-2 focus:ring-[#7c3aed]/20 disabled:opacity-50"
          >
            {FORMAT_STYLES.map(style => (
              <option key={style} value={style}>{FORMAT_LABELS[style]}</option>
            ))}
          </select>
        </div>

        </div>

        <div className="flex items-center justify-between gap-3 border-t border-neutral-100 px-6 py-4">
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={busy}
              onClick={handleImportClick}
              title="Import a Word (.docx) or text file"
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-neutral-600 hover:bg-neutral-100 transition-colors disabled:opacity-50"
            >
              <Upload size={14} /> Import
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.docx"
              onChange={e => void handleFileSelected(e)}
              className="hidden"
              aria-hidden="true"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="px-4 py-2 rounded-lg bg-neutral-100 text-neutral-700 hover:bg-neutral-200 text-[13px] font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleWrite()}
              disabled={busy || checking || !hasPrompt || blocked}
              title={blocked ? 'Edit the question first' : hasPrompt ? 'Ctrl + Enter' : 'Enter a topic to write an essay'}
              aria-busy={busy || checking}
              className={cn(
                'inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-[#7c3aed] hover:bg-[#4c1d95] text-white text-[13px] font-medium transition-colors disabled:cursor-not-allowed',
                // Working is not the same as unavailable: keep full colour and a spinner while checking or creating.
                busy || checking ? 'disabled:cursor-wait disabled:hover:bg-[#7c3aed]' : 'disabled:opacity-50',
              )}
            >
              {(busy || checking) && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              {busy ? 'Creating…' : checking ? 'Checking question…' : showResult && !blocked ? 'Write anyway' : 'Write essay'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body,
  )
}

function QuestionCheckPanel({ result, onUseSuggestion }: { result: EssayQuestionCheckResult; onUseSuggestion: (s: string) => void }) {
  const a = result.assessment!
  const tone = bandTone(result.overallPercent)
  const blocked = !result.canOverride
  const labels = flagLabels(a.criticalFlags)
  const angles = a.suggestedPromptMode === 'InterpretationAngles'
  return (
    <section aria-label="Question check" aria-live="polite" className="mb-3 mt-1 rounded-xl border border-neutral-200 bg-neutral-50 p-3.5 text-[13px] text-[#1a1a18]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-medium">
          {blocked ? <Ban size={14} className="text-red-600" /> : <AlertTriangle size={14} className="text-amber-600" />}
          {blocked ? 'Fix the question before writing' : 'This question could be stronger'}
        </div>
        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
          tone === 'good' && 'bg-emerald-100 text-emerald-800',
          tone === 'mid' && 'bg-amber-100 text-amber-800',
          tone === 'poor' && 'bg-red-100 text-red-800')}>
          {result.overallPercent}% · {result.classification}
        </span>
      </div>

      {a.clarificationQuestion && (
        <p className="mt-2 rounded-lg bg-white border border-[#7c3aed]/30 px-2.5 py-2"><span className="font-medium">Before writing: </span>{a.clarificationQuestion}</p>
      )}
      {labels.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {labels.map(l => <li key={l} className="rounded-md bg-white border border-neutral-200 px-2 py-0.5 text-[11px] text-neutral-700">{l}</li>)}
        </ul>
      )}
      {a.critique && <p className="mt-2 text-neutral-700 leading-snug">{a.critique}</p>}
      {a.missingContext.length > 0 && (
        <p className="mt-1.5 text-[12px] text-neutral-500">Missing: {a.missingContext.join('; ')}</p>
      )}

      {a.suggestedPrompts.length > 0 && (
        <div className="mt-3">
          <p className="text-[12px] font-medium text-neutral-600 mb-1.5">{angles ? 'Angles you could take (added to your question)' : 'Try one of these (replaces your question)'}</p>
          <div className="flex flex-col gap-1.5">
            {a.suggestedPrompts.map(s => (
              <button key={s} type="button" onClick={() => onUseSuggestion(s)}
                className="text-left rounded-lg bg-white border border-neutral-200 hover:border-[#7c3aed]/50 hover:bg-[#7c3aed]/5 px-2.5 py-2 leading-snug transition-colors">
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <details className="mt-3">
        <summary className="cursor-pointer text-[12px] text-neutral-500">Score details</summary>
        <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1">
          {DIMENSIONS.map(d => (
            <div key={d.key} className="flex items-center justify-between text-[12px]">
              <dt className="text-neutral-600">{d.label}</dt>
              <dd className="font-medium tabular-nums">{a[d.key] as number}/5</dd>
            </div>
          ))}
        </dl>
      </details>
      <p className="mt-2 text-[11px] text-neutral-400">{blocked ? 'Edit the question above, then write again.' : 'Edit the question, pick a suggestion, or write anyway.'}</p>
    </section>
  )
}
