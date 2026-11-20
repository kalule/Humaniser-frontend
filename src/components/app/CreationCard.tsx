import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { useLibraryStore } from '../../store/libraryStore'
import { useDraftHandoffStore } from '../../store/draftHandoffStore'
import { importDocumentFromFile } from '../../lib/importWordDocument'
import { FORMAT_LABELS, FORMAT_STYLES } from '../../types/citation'
import type { FormatStyle } from '../../types/citation'
import type { DocumentGenre } from '../../types/library'

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
  const fileInputRef = useRef<HTMLInputElement>(null)

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
        setPendingDraft({ documentId: doc.id, topic: topic.trim(), documentType, citationStyle })
      }
      onClose()
      navigate(`/app/editor/${doc.id}`)
    } catch {
      setBusy(false) // createDocument already toasts on failure — stay open so the user can retry
    }
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
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !busy && hasPrompt) { e.preventDefault(); void handleCreate(true) }
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
        className="relative bg-white border border-[#e0e0da] rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[calc(100vh-2rem)]"
      >
        <div className="px-6 pt-5 pb-3">
          <h3 id="creation-card-title" className="text-[#1a1a18] font-semibold text-lg">
            New essay
          </h3>
          <p className="text-[13px] text-neutral-500 mt-0.5">You can rename the document later, in the editor.</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-2">
        {/* Citation style */}
        <div className="mb-4">
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

        {/* Topic / prompt */}
        <div className="mb-2">
          <label htmlFor="creation-card-topic" className="block text-[13px] font-medium text-[#1a1a18] mb-2">
            Topic or prompt <span className="text-neutral-400 font-normal">(optional)</span>
          </label>
          <textarea
            id="creation-card-topic"
            autoFocus
            rows={3}
            value={topic}
            disabled={busy}
            onChange={e => setTopic(e.target.value)}
            placeholder="e.g. &ldquo;An essay on social media use and anxiety in adolescents aged 13 to 18&rdquo;"
            className="w-full bg-neutral-100 border-0 rounded-lg px-3.5 py-2.5 text-[#1a1a18] text-sm outline-none focus:ring-2 focus:ring-[#7c3aed]/20 resize-none disabled:opacity-50"
            aria-describedby="creation-card-topic-hint"
          />
          <p id="creation-card-topic-hint" className="text-[11px] mt-1 min-h-[1rem] text-neutral-400" aria-live="polite">
            {weakPrompt ? 'Weak prompt: add the topic, level or word count for a stronger draft.' : ''}
          </p>
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
              onClick={() => void handleCreate(true)}
              disabled={busy || !hasPrompt}
              title={hasPrompt ? 'Ctrl + Enter' : 'Enter a topic to write an essay'}
              className="px-5 py-2 rounded-xl bg-[#7c3aed] hover:bg-[#4c1d95] text-white text-[13px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? 'Creating…' : 'Write essay'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body,
  )
}
