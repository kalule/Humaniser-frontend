import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FileText, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '../../lib/utils'
import { useLibraryStore } from '../../store/libraryStore'
import { useDraftHandoffStore } from '../../store/draftHandoffStore'
import { extractTextFromFile } from '../../lib/fileExtract'
import { FORMAT_LABELS, FORMAT_STYLES } from '../../types/citation'
import type { FormatStyle } from '../../types/citation'
import type { DocumentGenre } from '../../types/library'

// New-document flow prompt #3 — replaces the old "Name your document" modal. Captures document
// type + citation style up front (previously chosen inside the editor after the fact, or never
// at all) and gets the user into a useful editor in one step instead of two.

const LAST_CITATION_STYLE_KEY = 'humanise_last_citation_style'

// Proposal Studio and Systematic Review have their own, separate creation flows
// (ProposalStudioPage.handleCreate, etc.) and are reachable today via the main nav — this flag
// only controls whether the creation card ALSO offers them as document-type shortcuts. Off by
// default: routing from here into those modules needs its own UX decision this prompt doesn't
// make, so the card only offers the four types the mockups show until that's designed.
const ENABLE_STUDIO_DOCUMENT_TYPES_IN_CREATION_CARD = false

const DOCUMENT_TYPES: { value: DocumentGenre; label: string }[] = [
  { value: 'Essay', label: 'Essay' },
  { value: 'LiteratureReview', label: 'Literature review' },
  { value: 'ResearchPaper', label: 'Research paper' },
  { value: 'Other', label: 'Other' },
]

function lastUsedCitationStyle(): FormatStyle {
  try {
    const saved = localStorage.getItem(LAST_CITATION_STYLE_KEY)
    if (saved && (FORMAT_STYLES as string[]).includes(saved)) return saved as FormatStyle
  } catch {
    // localStorage unavailable (private browsing, etc.) — fall through to the default
  }
  return 'apa7'
}

// Exported for testing. Title is derived from the prompt rather than asked for separately — the
// first line (or first ~60 chars of a one-line prompt), falling back to "Untitled document" for
// an empty/whitespace-only prompt.
export function deriveTitleFromPrompt(prompt: string): string {
  const firstLine = prompt.trim().split('\n')[0].trim()
  if (!firstLine) return 'Untitled document'
  return firstLine.length > 60 ? `${firstLine.slice(0, 60).trim()}…` : firstLine
}

interface CreationCardProps {
  onClose: () => void
}

export function CreationCard({ onClose }: CreationCardProps) {
  const navigate = useNavigate()
  const createDocument = useLibraryStore(s => s.createDocument)
  const setPendingDraft = useDraftHandoffStore(s => s.setPending)

  const [documentType, setDocumentType] = useState<DocumentGenre>('Essay')
  const [citationStyle, setCitationStyle] = useState<FormatStyle>(lastUsedCitationStyle)
  const [topic, setTopic] = useState('')
  const [busy, setBusy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const hasPrompt = topic.trim().length > 0

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
      const content = await extractTextFromFile(file)
      const doc = await createDocument({
        title: file.name.replace(/\.[^.]+$/, '') || 'Untitled document',
        content,
        documentType,
        citationStyle,
      })
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
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); void handleCreate(true) }
  }

  return (
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
        className="relative bg-white border border-[#e0e0da] rounded-2xl p-6 w-full max-w-md shadow-2xl"
      >
        <h3 id="creation-card-title" className="text-[#1a1a18] font-semibold text-lg mb-1">
          What are you writing?
        </h3>
        <p className="text-[13px] text-neutral-500 mb-5">
          Tell us the basics. You can rename the document later, right in the editor.
        </p>

        {/* Document type */}
        <div className="mb-4">
          <label className="block text-[13px] font-medium text-[#1a1a18] mb-2">Document type</label>
          <div role="radiogroup" aria-label="Document type" className="flex flex-wrap gap-2">
            {DOCUMENT_TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={documentType === t.value}
                disabled={busy}
                onClick={() => setDocumentType(t.value)}
                className={cn(
                  'rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors disabled:opacity-50',
                  documentType === t.value
                    ? 'border-[#7c3aed] bg-[#f5f3ff] text-[#7c3aed]'
                    : 'border-neutral-200 text-neutral-600 hover:border-neutral-300',
                )}
              >
                {t.label}
              </button>
            ))}
            {ENABLE_STUDIO_DOCUMENT_TYPES_IN_CREATION_CARD && null /* Proposal/Systematic Review routing — needs its own UX decision before wiring in */}
          </div>
        </div>

        {/* Citation style */}
        <div className="mb-4">
          <label htmlFor="creation-card-citation-style" className="block text-[13px] font-medium text-[#1a1a18] mb-2">
            Citation style
          </label>
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
          <p className="text-[11px] text-neutral-400 mt-1">Used for in-text citations and your reference list.</p>
        </div>

        {/* Topic / prompt */}
        <div className="mb-5">
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
            placeholder="e.g. &ldquo;A literature review on social media use and anxiety in adolescents aged 13 to 18&rdquo;"
            className="w-full bg-neutral-100 border-0 rounded-lg px-3.5 py-2.5 text-[#1a1a18] text-sm outline-none focus:ring-2 focus:ring-[#7c3aed]/20 resize-none disabled:opacity-50"
          />
        </div>

        {/* Secondary actions */}
        <div className="flex gap-2 mb-5">
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleCreate(false)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg border border-neutral-200 text-neutral-700 hover:bg-neutral-50 text-[13px] font-medium transition-colors disabled:opacity-50"
          >
            <FileText size={14} /> Start with a blank page
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleImportClick}
            className="flex-1 flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg border border-neutral-200 text-neutral-700 hover:bg-neutral-50 text-[13px] font-medium transition-colors disabled:opacity-50"
          >
            <Upload size={14} /> Import from Word (.docx)
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

        <div className="flex items-center justify-between">
          <span className="text-[11px] text-neutral-400">Ctrl + Enter to create</span>
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
              disabled={busy}
              className="px-5 py-2 rounded-xl bg-[#7c3aed] hover:bg-[#4c1d95] text-white text-[13px] font-medium transition-colors disabled:opacity-50"
            >
              {busy ? 'Creating…' : hasPrompt ? 'Create with draft' : 'Create'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
