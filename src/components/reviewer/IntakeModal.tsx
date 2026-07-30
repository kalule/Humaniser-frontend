import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { X, Upload, Loader2, FolderOpen, ClipboardPaste, File as FileIcon } from 'lucide-react'
import { cn } from '../../lib/utils'
import { reviewerApi } from '../../api/reviewer'
import { useResearchStore } from '../../store/researchStore'
import { useSystematicReviewStore } from '../../store/systematicReviewStore'
import { extractTextFromFile, isSupportedFile } from '../../lib/fileExtract'
import { classifyApiError } from '../../lib/classifyApiError'
import type { DocumentReview, ReviewType } from '../../types/reviewer'

type Tab = 'project' | 'systematicReview' | 'upload' | 'paste'

const TABS_BY_TYPE: Record<ReviewType, { tab: Tab; label: string }[]> = {
  Proposal: [
    { tab: 'project', label: 'Select existing project' },
    { tab: 'upload',  label: 'Upload a file' },
    { tab: 'paste',   label: 'Paste text' },
  ],
  Thesis: [
    { tab: 'project', label: 'Select existing project' },
    { tab: 'upload',  label: 'Upload a file' },
    { tab: 'paste',   label: 'Paste text' },
  ],
  Manuscript: [
    { tab: 'upload', label: 'Upload a file' },
    { tab: 'paste',  label: 'Paste text' },
  ],
  LiteratureReview: [
    { tab: 'systematicReview', label: 'Select existing review' },
    { tab: 'upload',           label: 'Upload a file' },
    { tab: 'paste',            label: 'Paste text' },
  ],
}

function toErrorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>
    if (typeof e.message === 'string' && e.message) return e.message
  }
  if (err instanceof Error) return err.message
  return 'Something went wrong generating this review. Please try again.'
}

interface IntakeModalProps {
  reviewType: ReviewType
  onClose:    () => void
  onCreated:  (review: DocumentReview) => void
}

export function IntakeModal({ reviewType, onClose, onCreated }: IntakeModalProps) {
  const tabs = TABS_BY_TYPE[reviewType]
  const researchStore = useResearchStore()
  const systematicReviewStore = useSystematicReviewStore()

  const [activeTab, setActiveTab] = useState<Tab>(tabs[0].tab)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedReviewId,  setSelectedReviewId]  = useState<string | null>(null)

  const [uploadPdfFile,      setUploadPdfFile]      = useState<File | null>(null)
  const [uploadExtractedText, setUploadExtractedText] = useState<string | null>(null)
  const [uploadFileName,     setUploadFileName]     = useState<string | null>(null)
  const [uploadProcessing,   setUploadProcessing]   = useState(false)
  const [dragging,           setDragging]           = useState(false)

  const [pastedText, setPastedText] = useState('')
  const [docTitle,   setDocTitle]   = useState('')
  const [highQuality, setHighQuality] = useState(false)
  const [submitting,  setSubmitting]  = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (activeTab === 'project') researchStore.loadProjects().catch(() => {})
    if (activeTab === 'systematicReview') systematicReviewStore.loadReviews().catch(() => {})
  }, [activeTab])

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

  const canSubmit = (() => {
    if (submitting) return false
    switch (activeTab) {
      case 'project':          return Boolean(selectedProjectId)
      case 'systematicReview': return Boolean(selectedReviewId)
      case 'upload':            return Boolean(uploadPdfFile || uploadExtractedText)
      case 'paste':             return pastedText.trim().length >= 200
    }
  })()

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      let review: DocumentReview

      if (activeTab === 'project') {
        review = await reviewerApi.create({
          reviewType, sourceType: 'ResearchProject', researchProjectId: selectedProjectId, highQuality,
        })
      } else if (activeTab === 'systematicReview') {
        review = await reviewerApi.create({
          reviewType, sourceType: 'SystematicReview', systematicReviewId: selectedReviewId, highQuality,
        })
      } else if (activeTab === 'upload' && uploadPdfFile) {
        review = await reviewerApi.upload(uploadPdfFile, reviewType, highQuality)
      } else if (activeTab === 'upload' && uploadExtractedText) {
        review = await reviewerApi.create({
          reviewType, sourceType: 'PastedText', sourceText: uploadExtractedText,
          documentTitle: uploadFileName ?? undefined, highQuality,
        })
      } else {
        review = await reviewerApi.create({
          reviewType, sourceType: 'PastedText', sourceText: pastedText,
          documentTitle: docTitle || undefined, highQuality,
        })
      }

      toast.success('Review generated.')
      onCreated(review)
    } catch (err) {
      toast.error(classifyApiError(toErrorMessage(err)).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={submitting ? undefined : onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.18 }}
        className="relative bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-orange-500 mb-0.5">{reviewType} Reviewer</p>
            <h2 className="font-bold text-slate-900 text-[16px]">Run a new review</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
              {(['Standard', 'High Quality'] as const).map((label, i) => (
                <button
                  key={label}
                  onClick={() => setHighQuality(i === 1)}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-[11px] font-medium transition-all',
                    (i === 1) === highQuality ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <button onClick={onClose} disabled={submitting} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Source tabs */}
        <div className="flex items-center gap-1 px-6 pt-4 shrink-0">
          {tabs.map(t => (
            <button
              key={t.tab}
              onClick={() => setActiveTab(t.tab)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors',
                activeTab === t.tab ? 'bg-violet-50 text-[#7c3aed]' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="px-6 py-4 overflow-y-auto flex-1 min-h-0">
          {activeTab === 'project' && (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {researchStore.projects.length === 0 ? (
                <p className="text-[12px] text-slate-400 py-6 text-center">No research projects yet — create one in Proposal Studio first.</p>
              ) : researchStore.projects.map(p => {
                const label = p.title || p.selectedTopic?.title || p.fieldInterest || 'Untitled Research Project'
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProjectId(p.id)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-colors',
                      selectedProjectId === p.id ? 'border-[#7c3aed] bg-violet-50' : 'border-slate-200 hover:border-slate-300',
                    )}
                  >
                    <FolderOpen size={14} className="text-slate-400 shrink-0" />
                    <span className="text-[13px] text-slate-700 truncate">{label}</span>
                  </button>
                )
              })}
            </div>
          )}

          {activeTab === 'systematicReview' && (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {systematicReviewStore.reviews.length === 0 ? (
                <p className="text-[12px] text-slate-400 py-6 text-center">No systematic reviews yet — start one in Systematic Review first.</p>
              ) : systematicReviewStore.reviews.map(r => (
                <button
                  key={r.id}
                  onClick={() => setSelectedReviewId(r.id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-colors',
                    selectedReviewId === r.id ? 'border-[#7c3aed] bg-violet-50' : 'border-slate-200 hover:border-slate-300',
                  )}
                >
                  <FolderOpen size={14} className="text-slate-400 shrink-0" />
                  <span className="text-[13px] text-slate-700 truncate">{r.researchQuestion || 'Untitled review'}</span>
                </button>
              ))}
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
                  if (file) handleFile(file)
                }}
                onClick={() => inputRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-6 text-center flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-200',
                  dragging ? 'border-orange-400 bg-orange-50' : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50',
                )}
              >
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center transition-colors', dragging ? 'bg-orange-100' : 'bg-slate-100')}>
                  {uploadProcessing ? <Loader2 size={18} className="animate-spin text-slate-500" /> : <Upload size={18} className={dragging ? 'text-orange-500' : 'text-slate-500'} />}
                </div>
                <p className="text-[13px] font-medium text-slate-700">Drag and drop or click to browse</p>
                <p className="text-[11px] text-slate-400">Supports PDF, DOCX, and TXT</p>
              </div>
              <input
                ref={inputRef} type="file" accept=".pdf,.docx,.txt" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
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
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] text-slate-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition placeholder-slate-400"
              />
              <textarea
                value={pastedText}
                onChange={e => setPastedText(e.target.value)}
                placeholder="Paste proposal, thesis, manuscript, or literature review text (at least 200 characters)"
                rows={8}
                className="textarea-body w-full border border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition placeholder-slate-400 resize-none"
              />
              <p className="text-[11px] text-slate-400 text-right">{pastedText.trim().length.toLocaleString()} characters</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
          <button onClick={onClose} disabled={submitting} className="px-4 py-2 text-[13px] text-slate-600 hover:text-slate-800 transition-colors disabled:opacity-40">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#7c3aed] hover:bg-[#4c1d95] disabled:opacity-40 disabled:cursor-not-allowed text-white text-[13px] font-semibold transition-colors"
          >
            {submitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Analyzing your document…
              </>
            ) : (
              <>
                <ClipboardPaste size={14} />
                Run Review
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

