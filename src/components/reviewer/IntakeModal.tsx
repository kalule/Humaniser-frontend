import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { X, Upload, Loader2, FolderOpen, FileText as FileIcon, Search, Check } from 'lucide-react'
import { cn, tiptapJsonToText, formatShortDate } from '../../lib/utils'
import { reviewerApi } from '../../api/reviewer'
import { useResearchStore } from '../../store/researchStore'
import { useSystematicReviewStore } from '../../store/systematicReviewStore'
import { useLibraryStore } from '../../store/libraryStore'
import { isEmptyDraftDocument } from '../../types/library'
import { extractTextFromFile, isSupportedFile } from '../../lib/fileExtract'
import type { DocumentReview, ReviewType } from '../../types/reviewer'

type Tab = 'work' | 'upload' | 'paste'

const REVIEW_TYPES: { type: ReviewType; label: string }[] = [
  { type: 'Proposal',         label: 'Proposal' },
  { type: 'Thesis',           label: 'Thesis' },
  { type: 'Manuscript',       label: 'Manuscript' },
  { type: 'LiteratureReview', label: 'Literature review' },
]

// Every review type can draw on a Library document — closes the "uploads
// only" gap (Document Reviewer UX audit, 2026-10-03). Proposal/Thesis also
// get the matching ResearchProject; Literature review also gets matching
// SystematicReview entries. Manuscript has no specialised in-app source.
interface WorkItem {
  id:          string
  kind:        'project' | 'systematicReview' | 'library'
  title:       string
  metaLine:    string
  disabled:    boolean
  disabledReason?: string
  // Only 'library' items need this — project/systematicReview submissions go
  // through reviewerApi.create's own sourceType, not a text extraction.
  getText?:    () => string
}

function toErrorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>
    if (typeof e.message === 'string' && e.message) return e.message
  }
  if (err instanceof Error) return err.message
  return 'Something went wrong generating this review. Please try again.'
}

// Strips a file extension and falls back to the extracted text's own first
// line when it looks like a real title — fixes rows showing raw filenames
// like "research-proposal-2026-09-04.docx" (Document Reviewer UX audit).
function deriveUploadTitle(fileName: string, extractedText: string): string {
  const withoutExt = fileName.replace(/\.[^.]+$/, '')
  const firstLine = extractedText.trim().split('\n')[0]?.trim()
  if (firstLine && firstLine.length >= 8 && firstLine.length <= 120) return firstLine
  return withoutExt || fileName
}

export interface RunDescriptor {
  reviewType:     ReviewType
  documentTitle:  string
  perform:        () => Promise<DocumentReview>
}

interface IntakeModalProps {
  initialReviewType: ReviewType
  onClose:           () => void
  onSubmit:           (descriptor: RunDescriptor) => void
}

export function IntakeModal({ initialReviewType, onClose, onSubmit }: IntakeModalProps) {
  const researchStore = useResearchStore()
  const systematicReviewStore = useSystematicReviewStore()
  const libraryStore = useLibraryStore()

  const [reviewType, setReviewType] = useState<ReviewType>(initialReviewType)
  const [activeTab, setActiveTab] = useState<Tab>('work')
  const [workSearch, setWorkSearch] = useState('')
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null)

  const [uploadPdfFile,       setUploadPdfFile]       = useState<File | null>(null)
  const [uploadExtractedText, setUploadExtractedText] = useState<string | null>(null)
  const [uploadFileName,      setUploadFileName]      = useState<string | null>(null)
  const [uploadProcessing,    setUploadProcessing]    = useState(false)
  const [dragging,            setDragging]            = useState(false)

  const [pastedText, setPastedText] = useState('')
  const [docTitle,   setDocTitle]   = useState('')
  const [highQuality, setHighQuality] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const submittingRef = useRef(false)
  const tabRefs = useRef<(HTMLElement | null)[]>([])

  useEffect(() => {
    researchStore.loadProjects().catch(() => {})
    systematicReviewStore.loadReviews().catch(() => {})
    libraryStore.loadDocuments().catch(() => {})
  }, [])

  const handleEsc = (e: React.KeyboardEvent) => { if (e.key === 'Escape') onClose() }

  // ── "From my work" items ────────────────────────────────────────────────

  const workItems = useMemo<WorkItem[]>(() => {
    const items: WorkItem[] = []

    if (reviewType === 'Proposal' || reviewType === 'Thesis') {
      for (const p of researchStore.projects) {
        const title = p.title || p.selectedTopic?.title || p.fieldInterest || 'Untitled Research Project'
        const notStarted = p.progressPct === 0
        items.push({
          id: `project:${p.id}`,
          kind: 'project',
          title,
          metaLine: `${formatShortDate(p.updatedAt)} · ${p.academicLevel} · ${p.citationStyle.toUpperCase()}`,
          disabled: notStarted,
          disabledReason: notStarted ? 'Nothing to review yet' : undefined,
        })
      }
    }

    if (reviewType === 'LiteratureReview') {
      for (const r of systematicReviewStore.reviews) {
        const notStarted = r.paperCount === 0
        items.push({
          id: `sr:${r.id}`,
          kind: 'systematicReview',
          title: r.researchQuestion || 'Untitled review',
          metaLine: `${formatShortDate(r.updatedAt)} · ${r.paperCount} paper${r.paperCount === 1 ? '' : 's'}`,
          disabled: notStarted,
          disabledReason: notStarted ? 'Nothing to review yet' : undefined,
        })
      }
    }

    for (const doc of libraryStore.documents) {
      if (doc.isPdf || isEmptyDraftDocument(doc)) continue
      const text = doc.content ? tiptapJsonToText(doc.content) : ''
      const empty = text.trim().length < 50
      items.push({
        id: `library:${doc.id}`,
        kind: 'library',
        title: doc.title || 'Untitled document',
        metaLine: `${formatShortDate(doc.updatedAt)} · Document`,
        disabled: empty,
        disabledReason: empty ? 'Nothing to review yet' : undefined,
        getText: () => text,
      })
    }

    return items
  }, [reviewType, researchStore.projects, systematicReviewStore.reviews, libraryStore.documents])

  const filteredWorkItems = useMemo(() => {
    const q = workSearch.trim().toLowerCase()
    if (!q) return workItems
    return workItems.filter(i => i.title.toLowerCase().includes(q))
  }, [workItems, workSearch])

  // Selection doesn't survive a type change — the underlying list changes entirely.
  useEffect(() => { setSelectedWorkId(null) }, [reviewType])

  const selectedWorkItem = workItems.find(i => i.id === selectedWorkId) ?? null

  const handleWorkKeyDown = (e: React.KeyboardEvent) => {
    const selectable = filteredWorkItems.filter(i => !i.disabled)
    if (selectable.length === 0) return
    const currentIndex = selectable.findIndex(i => i.id === selectedWorkId)
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedWorkId(selectable[(currentIndex + 1) % selectable.length].id); return }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelectedWorkId(selectable[(currentIndex - 1 + selectable.length) % selectable.length].id); return }
  }

  // ── Upload tab ───────────────────────────────────────────────────────────

  const handleFile = async (file: File) => {
    if (file.name.toLowerCase().endsWith('.pdf')) {
      setUploadPdfFile(file)
      setUploadExtractedText(null)
      setUploadFileName(file.name)
      return
    }
    if (!isSupportedFile(file)) {
      toast.error('Unsupported format. Accepted: .pdf, .docx, .txt')
      return
    }
    setUploadProcessing(true)
    try {
      const text = await extractTextFromFile(file)
      setUploadExtractedText(text)
      setUploadPdfFile(null)
      setUploadFileName(file.name)
    } catch (err) {
      toast.error(toErrorMessage(err))
    } finally {
      setUploadProcessing(false)
    }
  }

  // ── Submit ───────────────────────────────────────────────────────────────

  const canSubmit = (() => {
    switch (activeTab) {
      case 'work':   return Boolean(selectedWorkItem && !selectedWorkItem.disabled)
      case 'upload': return Boolean(uploadPdfFile || uploadExtractedText)
      case 'paste':  return pastedText.trim().length >= 200
    }
  })()

  const handleSubmit = () => {
    if (!canSubmit || submittingRef.current) return
    submittingRef.current = true

    if (activeTab === 'work' && selectedWorkItem) {
      const item = selectedWorkItem
      if (item.kind === 'project') {
        const projectId = item.id.slice('project:'.length)
        onSubmit({
          reviewType, documentTitle: item.title,
          perform: () => reviewerApi.create({ reviewType, sourceType: 'ResearchProject', researchProjectId: projectId, highQuality }),
        })
      } else if (item.kind === 'systematicReview') {
        const reviewId = item.id.slice('sr:'.length)
        onSubmit({
          reviewType, documentTitle: item.title,
          perform: () => reviewerApi.create({ reviewType, sourceType: 'SystematicReview', systematicReviewId: reviewId, highQuality }),
        })
      } else {
        const text = item.getText?.() ?? ''
        onSubmit({
          reviewType, documentTitle: item.title,
          perform: () => reviewerApi.create({
            reviewType, sourceType: 'PastedText', sourceText: text, documentTitle: item.title, highQuality,
          }),
        })
      }
    } else if (activeTab === 'upload' && uploadPdfFile) {
      const file = uploadPdfFile
      onSubmit({
        reviewType, documentTitle: file.name.replace(/\.[^.]+$/, ''),
        perform: () => reviewerApi.upload(file, reviewType, highQuality),
      })
    } else if (activeTab === 'upload' && uploadExtractedText) {
      const text = uploadExtractedText
      const title = deriveUploadTitle(uploadFileName ?? 'Untitled document', text)
      onSubmit({
        reviewType, documentTitle: title,
        perform: () => reviewerApi.create({ reviewType, sourceType: 'PastedText', sourceText: text, documentTitle: title, highQuality }),
      })
    } else if (activeTab === 'paste') {
      const text = pastedText
      const title = docTitle.trim() || deriveUploadTitle('Untitled document', text)
      onSubmit({
        reviewType, documentTitle: title,
        perform: () => reviewerApi.create({ reviewType, sourceType: 'PastedText', sourceText: text, documentTitle: title, highQuality }),
      })
    }

    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onKeyDown={handleEsc}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.18 }}
        className="relative bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="font-bold text-slate-900 text-[16px]">Run a new review</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 pt-4 shrink-0">
          {/* Type chips */}
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Document type</p>
          <div role="radiogroup" aria-label="Document type" className="flex flex-wrap gap-2 mb-4">
            {REVIEW_TYPES.map(t => (
              <button
                key={t.type}
                type="button"
                role="radio"
                aria-checked={reviewType === t.type}
                onClick={() => setReviewType(t.type)}
                className={cn(
                  'rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors',
                  reviewType === t.type
                    ? 'border-[var(--color-purple)] bg-[var(--color-purple-tint)] text-[var(--color-purple-text)]'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Source tabs */}
          <div role="tablist" aria-label="Review source" className="flex items-center gap-1">
            {([['work', 'From my work'], ['upload', 'Upload a file'], ['paste', 'Paste text']] as const).map(([tab, label], i) => (
              <button
                key={tab}
                ref={el => { tabRefs.current[i] = el }}
                role="tab"
                aria-selected={activeTab === tab}
                tabIndex={activeTab === tab ? 0 : -1}
                onClick={() => setActiveTab(tab)}
                onKeyDown={e => {
                  if (e.key === 'ArrowRight') { e.preventDefault(); const n = (i + 1) % 3; setActiveTab((['work', 'upload', 'paste'] as const)[n]); tabRefs.current[n]?.focus() }
                  if (e.key === 'ArrowLeft')  { e.preventDefault(); const n = (i + 2) % 3; setActiveTab((['work', 'upload', 'paste'] as const)[n]); tabRefs.current[n]?.focus() }
                }}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors',
                  activeTab === tab ? 'bg-[var(--color-purple-tint)] text-[var(--color-purple-text)]' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="px-6 py-4 overflow-y-auto flex-1 min-h-0">
          {activeTab === 'work' && (
            <div>
              <div className="relative mb-2">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={workSearch}
                  onChange={e => setWorkSearch(e.target.value)}
                  placeholder="Search your work..."
                  className="w-full pl-8 pr-3 py-2 text-[13px] text-slate-700 border border-slate-200 rounded-lg outline-none focus:border-[var(--color-purple)] focus:ring-2 focus:ring-[var(--color-purple-tint)] transition placeholder-slate-400"
                />
              </div>
              <div
                role="radiogroup"
                aria-label="Select existing work"
                onKeyDown={handleWorkKeyDown}
                className="space-y-1.5 max-h-64 overflow-y-auto"
              >
                {filteredWorkItems.length === 0 ? (
                  <p className="text-[12px] text-slate-400 py-6 text-center">
                    Nothing here yet — try Upload a file or Paste text instead.
                  </p>
                ) : filteredWorkItems.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={selectedWorkId === item.id}
                    disabled={item.disabled}
                    title={item.disabledReason}
                    onClick={() => setSelectedWorkId(item.id)}
                    className={cn(
                      'w-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-colors',
                      item.disabled
                        ? 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed'
                        : selectedWorkId === item.id
                          ? 'border-[var(--color-purple)] bg-[var(--color-purple-tint)]'
                          : 'border-slate-200 hover:border-slate-300',
                    )}
                  >
                    <FolderOpen size={14} className="text-slate-400 shrink-0 mt-0.5" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] text-slate-700 line-clamp-2">{item.title}</span>
                      <span className="block text-[11px] text-slate-400 mt-0.5">
                        {item.disabledReason ?? item.metaLine}
                      </span>
                    </span>
                    {selectedWorkId === item.id && !item.disabled && (
                      <Check size={14} className="text-[var(--color-purple-text)] shrink-0 mt-0.5" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="space-y-3">
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => {
                  e.preventDefault(); setDragging(false)
                  const file = e.dataTransfer.files[0]
                  if (file) void handleFile(file)
                }}
                onClick={() => inputRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-6 text-center flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-200',
                  dragging ? 'border-[var(--color-purple)] bg-[var(--color-purple-tint)]' : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50',
                )}
              >
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center transition-colors', dragging ? 'bg-[var(--color-purple-tint)]' : 'bg-slate-100')}>
                  {uploadProcessing ? <Loader2 size={18} className="animate-spin text-slate-500" /> : <Upload size={18} className={dragging ? 'text-[var(--color-purple-text)]' : 'text-slate-500'} />}
                </div>
                <p className="text-[13px] font-medium text-slate-700">Drag and drop or click to browse</p>
                <p className="text-[11px] text-slate-400">PDF (up to 50MB), DOCX, or TXT</p>
              </div>
              <input
                ref={inputRef} type="file" accept=".pdf,.docx,.txt" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = '' }}
              />
              {(uploadPdfFile || uploadExtractedText) && (
                <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  <FileIcon size={14} className="text-slate-400 shrink-0" />
                  <span className="flex-1 text-[12px] text-slate-700 truncate">{uploadFileName}</span>
                  <button onClick={() => { setUploadPdfFile(null); setUploadExtractedText(null); setUploadFileName(null) }} className="text-slate-400 hover:text-red-500 transition-colors shrink-0">
                    <X size={13} />
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'paste' && (
            <div className="space-y-2">
              <input
                value={docTitle}
                onChange={e => setDocTitle(e.target.value)}
                placeholder="Optional title"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] text-slate-800 outline-none focus:border-[var(--color-purple)] focus:ring-2 focus:ring-[var(--color-purple-tint)] transition placeholder-slate-400"
              />
              <textarea
                value={pastedText}
                onChange={e => setPastedText(e.target.value)}
                placeholder="Paste proposal, thesis, manuscript, or literature review text (at least 200 characters)"
                rows={8}
                className="textarea-body w-full border border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 outline-none focus:border-[var(--color-purple)] focus:ring-2 focus:ring-[var(--color-purple-tint)] transition placeholder-slate-400 resize-none"
              />
              <p className="text-[11px] text-slate-400 text-right">{pastedText.trim().length.toLocaleString()} characters (200 minimum)</p>
            </div>
          )}

          {/* Quality — real difference only: same prompt/tokens/single pass, just a different model */}
          <div className="mt-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Quality</p>
            <div role="radiogroup" aria-label="Review quality" className="grid grid-cols-2 gap-2">
              {([
                { value: false, label: 'Standard', desc: 'Our standard review model.' },
                { value: true,  label: 'High quality', desc: 'Runs on a more capable model — same review depth.' },
              ] as const).map(opt => (
                <button
                  key={opt.label}
                  type="button"
                  role="radio"
                  aria-checked={highQuality === opt.value}
                  onClick={() => setHighQuality(opt.value)}
                  className={cn(
                    'text-left rounded-lg border px-3 py-2.5 transition-colors',
                    highQuality === opt.value
                      ? 'border-[var(--color-purple)] bg-[var(--color-purple-tint)]'
                      : 'border-slate-200 hover:border-slate-300',
                  )}
                >
                  <span className="block text-[12px] font-semibold text-slate-800">{opt.label}</span>
                  <span className="block text-[11px] text-slate-500 mt-0.5">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
          <span className="text-[11px] text-slate-400">Your review will appear in the list below.</span>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-[13px] text-slate-600 hover:text-slate-800 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={cn(
                'flex items-center gap-2 px-5 py-2 rounded-xl text-[13px] font-semibold transition-colors',
                canSubmit
                  ? 'bg-purple-accent hover:bg-purple-deep text-white'
                  : 'bg-slate-200 text-slate-500 cursor-not-allowed',
              )}
            >
              Run review
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
