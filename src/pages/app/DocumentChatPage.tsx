import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import {
  Upload, Loader2, ChevronLeft, ChevronRight, Grid3x3, Search,
  ZoomIn, ZoomOut, Maximize2, Mic, RotateCcw, Send, Globe,
  ChevronDown, AlertCircle, BookOpen, MessageSquare, X, Lock,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { usePdfChat } from '../../hooks/usePdfChat'
import { AnalystErrorCard } from '../../components/ui/AnalystErrorCard'
import type { DocChatMessage } from '../../types/pdfChat'
import toast from 'react-hot-toast'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).href

// ── Constants ──────────────────────────────────────────────────────────────────

const CHIPS = [
  'Summarise introduction', 'Contributions',
  'Methods used',           'Limitations',
  'Results',                'Related Papers',
  'Practical Implications',
]

const QUICK_QUESTIONS = [
  'Generate summary of this paper',
  'What are the main findings?',
  'Explain the methodology',
  'What are the limitations of this study?',
  'What is the research question?',
  'Who are the key authors cited?',
  'What data was collected?',
  'Describe the theoretical framework',
]

const ZOOM_STEPS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0]

// ── Small shared sub-components ────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-0.5">
      {[0, 0.15, 0.3].map((d, i) => (
        <span key={i} className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${d}s` }} />
      ))}
    </div>
  )
}

function PageChip({ page }: { page: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-orange-500/15 border border-orange-500/20 text-orange-400 font-medium">
      <BookOpen size={9} /> p.{page}
    </span>
  )
}

function MessageBubble({ msg }: { msg: DocChatMessage }) {
  const isUser = msg.role === 'user'
  return (
    <div className={cn('flex gap-2', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="w-6 h-6 rounded-md bg-orange-500/20 border border-orange-500/25 flex items-center justify-center shrink-0 mt-0.5">
          <MessageSquare size={11} className="text-orange-400" />
        </div>
      )}
      <div className={cn('max-w-[84%] space-y-1.5', isUser && 'items-end flex flex-col')}>
        <div className={cn(
          'px-3 py-2.5 rounded-xl text-[13px] leading-relaxed',
          isUser
            ? 'bg-sky-50 border border-sky-200 text-sky-900 rounded-br-sm'
            : 'bg-gray-50 border border-gray-100 text-gray-800 rounded-bl-sm',
        )}>
          {msg.isLoading ? (
            <TypingDots />
          ) : msg.error ? (
            <AnalystErrorCard message={msg.error} kind={msg.errorKind} />
          ) : (
            <p className="whitespace-pre-wrap">{msg.content}</p>
          )}
        </div>
        {!msg.isLoading && !msg.error && msg.sourcePages && msg.sourcePages.length > 0 && (
          <div className="flex flex-wrap gap-1 px-0.5">
            {msg.sourcePages.map(p => <PageChip key={p} page={p} />)}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Upload drop zone (shown inside the PDF canvas when no doc is loaded) ───────

function CanvasUploadZone({ onUpload, disabled }: { onUpload: (f: File) => void; disabled?: boolean }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (disabled) return
    const file = e.dataTransfer.files[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Only PDF files are supported.')
      return
    }
    onUpload(file)
  }

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div
        onDragOver={e => { e.preventDefault(); if (!disabled) setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          'w-full max-w-md flex flex-col items-center gap-5 p-10 rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer',
          dragging
            ? 'border-sky-400 bg-sky-50'
            : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50',
        )}
      >
        <div className={cn(
          'w-16 h-16 rounded-2xl flex items-center justify-center transition-colors',
          dragging ? 'bg-sky-100 border border-sky-300' : 'bg-slate-100 border border-slate-200',
        )}>
          <Upload size={28} className={dragging ? 'text-sky-500' : 'text-slate-500'} />
        </div>
        <div className="text-center space-y-1.5">
          <p className="font-semibold text-slate-700 text-[15px]">Upload a paper, slide deck, or textbook</p>
          <p className="text-slate-400 text-[13px] leading-relaxed">
            PDF format · up to 50 MB
          </p>
        </div>
        <button
          disabled={disabled}
          onClick={e => { e.stopPropagation(); inputRef.current?.click() }}
          className="mt-1 px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          Choose file
        </button>
        <p className="flex items-center gap-1 text-[11px] text-slate-400 select-none">
          <Lock size={10} className="shrink-0" />
          Files are not stored after your session ends.
        </p>
        <input ref={inputRef} type="file" accept=".pdf" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) { onUpload(f); e.target.value = '' } }} />
      </div>
    </div>
  )
}

// ── Processing overlay (shown inside canvas while ingesting) ───────────────────

function CanvasIngestingView({ fileName }: { fileName: string }) {
  const [step, setStep] = useState(0)
  const steps = [
    'Reading document structure',
    'Extracting text content',
    'Generating semantic embeddings',
    'Building search index',
  ]
  useEffect(() => {
    const t = setInterval(() => setStep(s => Math.min(s + 1, steps.length - 1)), 5_000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
      <div className="space-y-3 text-center">
        <div className="w-14 h-14 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-center mx-auto">
          <Loader2 size={24} className="text-sky-500 animate-spin" />
        </div>
        <div>
          <p className="text-slate-700 font-semibold text-[15px]">Processing document</p>
          <p className="text-slate-400 text-[13px] mt-1 max-w-xs truncate">{fileName}</p>
        </div>
      </div>
      <div className="w-full max-w-xs space-y-2.5">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-3">
            <div className={cn(
              'w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-all duration-500',
              i < step   ? 'bg-sky-500'
              : i === step ? 'border-2 border-sky-400 animate-pulse bg-sky-50'
              : 'border border-slate-300',
            )}>
              {i < step && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>
            <span className={cn(
              'text-[13px] transition-colors duration-300',
              i < step    ? 'text-sky-400 line-through'
              : i === step  ? 'text-slate-700 font-medium'
              : 'text-slate-400',
            )}>{s}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

type ActiveTab = 'pdf' | 'summary' | 'notes'

export default function DocumentChatPage() {
  const {
    document: pdfDoc,
    pdfFileUrl,
    messages,
    isIngesting,
    isQuerying,
    uploadDocument,
    queryDocument,
    clearDocument,
  } = usePdfChat()

  // ── PDF viewer state ─────────────────────────────────────────────────────────
  const [activeTab, setActiveTab]       = useState<ActiveTab>('pdf')
  const [numPages, setNumPages]         = useState(0)
  const [currentPage, setCurrentPage]   = useState(1)
  const [pageInput, setPageInput]       = useState('1')
  const [zoomIdx, setZoomIdx]           = useState(3)         // default = 1.25
  const [canvasWidth, setCanvasWidth]   = useState(700)
  const [selectedText, setSelectedText] = useState<string | null>(null)
  const [notes, setNotes]               = useState('')
  const [summary, setSummary]           = useState<string | null>(null)
  const [genSummary, setGenSummary]     = useState(false)

  // ── Chat state ───────────────────────────────────────────────────────────────
  const [inputText, setInputText]       = useState('')
  const [highQuality, setHighQuality]   = useState(false)
  const [showMore, setShowMore]         = useState(false)

  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const pdfScrollRef       = useRef<HTMLDivElement>(null)
  const chatEndRef         = useRef<HTMLDivElement>(null)
  const textareaRef        = useRef<HTMLTextAreaElement>(null)

  const isReady       = pdfDoc?.status === 'ready'
  const isError       = pdfDoc?.status === 'error'
  const isProcessing  = isIngesting || pdfDoc?.status === 'ingesting'
  const hasDoc        = !!pdfDoc || isIngesting
  const zoom          = ZOOM_STEPS[zoomIdx]

  // ── Measure canvas container for PDF width ───────────────────────────────────
  useEffect(() => {
    const el = canvasContainerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setCanvasWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── Text selection detection on PDF canvas ───────────────────────────────────
  useEffect(() => {
    if (!isReady) return
    const handleMouseUp = () => {
      const sel = window.getSelection()
      const text = sel?.toString().trim()
      if (text && pdfScrollRef.current?.contains(sel?.anchorNode ?? null)) {
        setSelectedText(text)
      } else if (!text) {
        setSelectedText(null)
      }
    }
    window.addEventListener('mouseup', handleMouseUp)
    return () => window.removeEventListener('mouseup', handleMouseUp)
  }, [isReady])

  // ── Auto-scroll chat ─────────────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Page input sync ──────────────────────────────────────────────────────────
  useEffect(() => {
    setPageInput(String(currentPage))
  }, [currentPage])

  // ── Handle send ──────────────────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    const text = inputText.trim()
    if (!text || isQuerying || !isReady) return
    setInputText('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    void queryDocument(text, highQuality)
  }, [inputText, isQuerying, isReady, queryDocument, highQuality])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
  }

  // ── Chip / quick question click ───────────────────────────────────────────────
  const handleChipClick = (chip: string) => {
    if (!isReady) return
    void queryDocument(chip, highQuality)
  }

  const handleQuickQuestion = (q: string) => {
    setInputText(q)
    textareaRef.current?.focus()
  }

  // ── Selection toast → pre-fill input ────────────────────────────────────────
  const handleSelectionAnalyze = () => {
    if (!selectedText) return
    setInputText(`Regarding this passage: "${selectedText.slice(0, 120)}${selectedText.length > 120 ? '…' : ''}" — `)
    setSelectedText(null)
    textareaRef.current?.focus()
  }

  // ── Page nav helpers ─────────────────────────────────────────────────────────
  const goPrev = () => setCurrentPage(p => Math.max(1, p - 1))
  const goNext = () => setCurrentPage(p => Math.min(numPages, p + 1))
  const commitPage = () => {
    const n = parseInt(pageInput, 10)
    if (!isNaN(n) && n >= 1 && n <= numPages) setCurrentPage(n)
    else setPageInput(String(currentPage))
  }

  const pageWidth = Math.max(300, Math.floor((canvasWidth - 80) * zoom))

  // ── Summary generation ────────────────────────────────────────────────────────
  const handleGenerateSummary = async () => {
    setGenSummary(true)
    setActiveTab('summary')
    await queryDocument('Generate a comprehensive summary of this document, covering the main argument, methodology, key findings, and conclusions.', highQuality)
    setGenSummary(false)
  }

  // Track the latest assistant message as the summary when genSummary was active
  const latestAssistantMsg = messages.filter(m => m.role === 'assistant' && !m.isLoading && !m.error).at(-1)
  useEffect(() => {
    if (genSummary && latestAssistantMsg) {
      setSummary(latestAssistantMsg.content)
    }
  }, [latestAssistantMsg, genSummary])

  // ── Visible quick questions ───────────────────────────────────────────────────
  const visibleQs = showMore ? QUICK_QUESTIONS : QUICK_QUESTIONS.slice(0, 4)
  const extraCount = QUICK_QUESTIONS.length - 4

  return (
    <div className="flex h-full overflow-hidden">

      {/* ════════════════════════════════════════════════════════════════════════
          LEFT: PDF WORKSPACE
          ════════════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
        <div className="h-11 bg-white border-b border-slate-200 flex items-center px-4 gap-1 shrink-0 select-none">
          {/* Tabs */}
          {(['pdf', 'summary', 'notes'] as ActiveTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-3.5 h-full text-[13px] font-medium transition-colors border-b-2 capitalize',
                activeTab === tab
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700',
              )}
            >
              {tab === 'pdf' ? 'PDF file' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}

          {/* System Default */}
          <button className="ml-3 flex items-center gap-1 px-3 py-1 rounded-md border border-slate-200 text-[12px] text-slate-600 hover:bg-slate-50 transition-colors">
            System Default <ChevronDown size={12} />
          </button>

          <div className="flex-1" />

          {/* Podcast button — only shown when a document is loaded */}
          {isReady && (
            <button
              onClick={() => toast('Podcast feature coming soon', { icon: '🎙' })}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-[12px] font-medium transition-colors"
            >
              <Mic size={13} /> Podcast
            </button>
          )}

          {/* Clear doc */}
          {hasDoc && (
            <button
              onClick={clearDocument}
              title="Load new document"
              className="ml-2 w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <RotateCcw size={13} />
            </button>
          )}
        </div>

        {/* ── Toolbar (PDF tab only) ──────────────────────────────────────────── */}
        {activeTab === 'pdf' && (
          <div className="h-10 bg-white border-b border-slate-200 flex items-center px-4 gap-3 shrink-0 select-none">
            {/* Page navigation */}
            <div className="flex items-center gap-1">
              <button onClick={goPrev} disabled={currentPage <= 1 || !isReady}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 transition-colors">
                <ChevronLeft size={14} />
              </button>
              <span className="text-[12px] text-slate-500">Page</span>
              <input
                value={pageInput}
                onChange={e => setPageInput(e.target.value)}
                onBlur={commitPage}
                onKeyDown={e => e.key === 'Enter' && commitPage()}
                disabled={!isReady}
                className="w-8 h-6 text-center text-[12px] text-slate-700 border border-slate-200 rounded outline-none focus:border-orange-400 disabled:opacity-40 bg-white"
              />
              <span className="text-[12px] text-slate-400">/ {numPages || '—'}</span>
              <button onClick={goNext} disabled={currentPage >= numPages || !isReady}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 transition-colors">
                <ChevronRight size={14} />
              </button>
            </div>

            <div className="w-px h-5 bg-slate-200" />

            {/* Grid view toggle */}
            <button className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
              <Grid3x3 size={13} />
            </button>

            {/* Search */}
            <button className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
              <Search size={13} />
            </button>

            <div className="flex-1" />

            {/* Zoom controls */}
            <div className="flex items-center gap-1">
              <button onClick={() => setZoomIdx(i => Math.max(0, i - 1))} disabled={zoomIdx === 0}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 transition-colors">
                <ZoomOut size={13} />
              </button>
              <span className="w-12 text-center text-[12px] text-slate-600 font-medium tabular-nums">
                {Math.round(zoom * 100)}%
              </span>
              <button onClick={() => setZoomIdx(i => Math.min(ZOOM_STEPS.length - 1, i + 1))} disabled={zoomIdx === ZOOM_STEPS.length - 1}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 transition-colors">
                <ZoomIn size={13} />
              </button>
            </div>

            {/* Fullscreen */}
            <button
              onClick={() => pdfScrollRef.current?.requestFullscreen?.()}
              className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <Maximize2 size={13} />
            </button>
          </div>
        )}

        {/* ── Canvas area ─────────────────────────────────────────────────────── */}
        <div ref={canvasContainerRef} className="flex-1 min-h-0 relative">
          <div
            ref={pdfScrollRef}
            className={cn(
              'absolute inset-0 overflow-auto flex flex-col',
              activeTab === 'pdf' ? 'bg-[#e8ecf0]' : 'bg-white',
            )}
          >

            {/* PDF tab content */}
            {activeTab === 'pdf' && (
              <>
                {!hasDoc && !isError && (
                  <CanvasUploadZone onUpload={uploadDocument} />
                )}

                {isError && pdfDoc?.errorMessage && (
                  <div className="p-6">
                    <AnalystErrorCard message={pdfDoc.errorMessage} kind="generic" />
                    <CanvasUploadZone onUpload={uploadDocument} />
                  </div>
                )}

                {isProcessing && (
                  <CanvasIngestingView fileName={pdfDoc?.fileName ?? 'document'} />
                )}

                {isReady && pdfFileUrl && (
                  <div className="flex justify-center py-6 px-4">
                    <Document
                      file={pdfFileUrl}
                      onLoadSuccess={({ numPages: n }) => { setNumPages(n); setCurrentPage(1) }}
                      onLoadError={() => toast.error('Failed to render PDF')}
                      loading={
                        <div className="flex items-center justify-center py-20">
                          <Loader2 size={24} className="animate-spin text-slate-400" />
                        </div>
                      }
                    >
                      <Page
                        pageNumber={currentPage}
                        width={pageWidth}
                        renderTextLayer
                        renderAnnotationLayer
                        className="shadow-xl rounded-sm"
                      />
                    </Document>
                  </div>
                )}

                {/* Floating text-selection toast */}
                <AnimatePresence>
                  {selectedText && isReady && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 pointer-events-auto"
                    >
                      <div className="flex items-center gap-2 bg-amber-400 text-slate-900 px-4 py-2 rounded-full shadow-lg text-[13px] font-medium">
                        <span className="text-base">✏️</span>
                        <button onClick={handleSelectionAnalyze} className="hover:underline">
                          Select text to highlight, analyze, or add notes
                        </button>
                        <button
                          onClick={() => setSelectedText(null)}
                          className="ml-1 w-5 h-5 rounded-full bg-amber-500/30 hover:bg-amber-500/50 flex items-center justify-center transition-colors"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}

            {/* Summary tab */}
            {activeTab === 'summary' && (
              <div className="flex-1 p-8 max-w-3xl mx-auto w-full">
                {!isReady ? (
                  <p className="text-slate-400 text-sm">Upload a document to generate a summary.</p>
                ) : summary ? (
                  <div className="prose prose-slate max-w-none">
                    <h2 className="text-slate-800 font-semibold text-lg mb-4">Document Summary</h2>
                    <div className="text-slate-700 text-[14px] leading-relaxed whitespace-pre-wrap bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                      {summary}
                    </div>
                    <button
                      onClick={handleGenerateSummary}
                      disabled={genSummary}
                      className="mt-4 text-[13px] text-orange-500 hover:text-orange-600 flex items-center gap-1 disabled:opacity-50"
                    >
                      {genSummary ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                      Regenerate summary
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-5 py-16 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-center">
                      <BookOpen size={22} className="text-orange-500" />
                    </div>
                    <div>
                      <p className="text-slate-700 font-semibold text-[15px]">No summary yet</p>
                      <p className="text-slate-400 text-[13px] mt-1">Generate an AI-powered summary of the entire document</p>
                    </div>
                    <button
                      onClick={handleGenerateSummary}
                      disabled={genSummary || !isReady}
                      className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium transition-colors flex items-center gap-2"
                    >
                      {genSummary && <Loader2 size={14} className="animate-spin" />}
                      Generate Summary
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Notes tab */}
            {activeTab === 'notes' && (
              <div className="flex-1 flex flex-col p-6 gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-slate-600 text-[13px] font-medium">Your notes</p>
                  <span className="text-[11px] text-slate-400">{notes.length} characters</span>
                </div>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Write your notes here… (auto-saved locally)"
                  className="flex-1 resize-none bg-white border border-slate-200 rounded-xl p-4 text-[14px] text-slate-700 placeholder-slate-300 outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/20 min-h-[300px] shadow-sm transition-colors"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          RIGHT: CHAT PANEL
          ════════════════════════════════════════════════════════════════════════ */}
      <div className="w-[360px] shrink-0 flex flex-col border-l border-gray-100 bg-white overflow-hidden">

        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div className="h-11 border-b border-gray-100 bg-white flex items-center px-4 gap-2.5 shrink-0">
          <div className="w-6 h-6 rounded-md bg-orange-500/20 border border-orange-500/25 flex items-center justify-center">
            <MessageSquare size={12} className="text-orange-400" />
          </div>
          <span className="text-gray-700 text-[14px] font-semibold flex-1">Chat</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-gray-500">HQ</span>
            <button
              title="High quality — uses more tokens for deeper, more detailed answers"
              onClick={() => setHighQuality(v => !v)}
              className={cn(
                'relative w-8 h-4 rounded-full transition-colors duration-200',
                highQuality ? 'bg-orange-500' : 'bg-gray-200',
              )}
            >
              <span className={cn(
                'absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-all duration-200',
                highQuality ? 'left-[18px]' : 'left-0.5',
              )} />
            </button>
          </div>
          <button className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-[12px] transition-colors">
            <Globe size={12} /> en <ChevronDown size={11} />
          </button>
        </div>

        {/* ── Pinned suggestion chips — only when document is loaded ──────────── */}
        <AnimatePresence>
          {isReady && (
            <motion.div
              key="chips"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="px-3 pt-3 pb-2.5 border-b border-gray-100 shrink-0"
            >
              <div className="flex flex-wrap gap-1.5">
                {CHIPS.map(chip => (
                  <button
                    key={chip}
                    onClick={() => handleChipClick(chip)}
                    disabled={isQuerying}
                    className="px-2.5 py-1 rounded-full text-[11.5px] font-medium border border-orange-500/40 text-orange-400 hover:bg-orange-500/10 hover:border-orange-500/60 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Scrollable area: empty / processing / questions / messages ────────── */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-200">
          <AnimatePresence mode="wait" initial={false}>
            {messages.length > 0 ? (
              /* Messages */
              <motion.div
                key="messages"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="px-4 py-4 space-y-4"
              >
                <AnimatePresence initial={false}>
                  {messages.map(msg => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18 }}
                    >
                      <MessageBubble msg={msg} />
                    </motion.div>
                  ))}
                </AnimatePresence>
                <div ref={chatEndRef} />
              </motion.div>
            ) : isReady ? (
              /* Quick questions — doc loaded, no messages yet */
              <motion.div
                key="questions"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="py-2"
              >
                <p className="text-[11px] text-gray-500 uppercase tracking-wide px-4 py-2">Suggested</p>
                <div className="space-y-px px-2">
                  {visibleQs.map(q => (
                    <button
                      key={q}
                      disabled={isQuerying}
                      onClick={() => handleQuickQuestion(q)}
                      className="w-full text-left px-3 py-2.5 rounded-lg text-[13px] text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed leading-snug"
                    >
                      {q}
                    </button>
                  ))}
                  {showMore && (
                    <button
                      onClick={() => setShowMore(false)}
                      className="w-full text-center py-1.5 text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      Show less
                    </button>
                  )}
                </div>
                {!showMore && extraCount > 0 && (
                  <button
                    onClick={() => setShowMore(true)}
                    className="w-full text-center py-1.5 text-[11px] text-orange-400 hover:text-orange-300 transition-colors font-medium"
                  >
                    +{extraCount} more
                  </button>
                )}
              </motion.div>
            ) : isProcessing ? (
              /* Processing — document is being ingested */
              <motion.div
                key="processing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex flex-col items-center justify-center gap-2 p-6 text-center"
              >
                <Loader2 size={20} className="animate-spin text-gray-400" />
                <p className="text-[12px] text-gray-400">Indexing your document…</p>
              </motion.div>
            ) : (
              /* Empty state — no document loaded */
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center"
              >
                <MessageSquare size={32} className="text-gray-300" />
                <p className="text-[13px] text-gray-400 leading-relaxed max-w-[200px]">
                  Upload a document and ask anything — summarise it, quiz yourself, or pull out key findings.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Fixed input deck ─────────────────────────────────────────────────── */}
        <div className="border-t border-gray-100 p-3 space-y-2 shrink-0">
          {/* Textarea row */}
          <div className={cn(
            'flex items-end gap-2 border rounded-xl px-3 py-2.5 transition-colors',
            isReady
              ? 'bg-gray-50 border-gray-200 focus-within:border-orange-400'
              : 'bg-gray-50 border-gray-200',
          )}>
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              disabled={!isReady || isQuerying}
              placeholder={isReady ? 'Ask anything about this document…' : 'Upload a document to start asking questions…'}
              rows={1}
              className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 resize-none outline-none leading-relaxed min-h-[22px] disabled:cursor-not-allowed"
              style={{ maxHeight: '120px' }}
            />
            {!isReady && (
              <AlertCircle size={15} className="text-amber-500/60 shrink-0 mb-0.5" />
            )}
            {isReady && (
              <button
                onClick={handleSend}
                disabled={!inputText.trim() || isQuerying}
                className={cn(
                  'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all duration-150',
                  inputText.trim() && !isQuerying
                    ? 'bg-orange-500 hover:bg-orange-600 text-white'
                    : 'bg-gray-100 text-gray-300 cursor-not-allowed',
                )}
              >
                {isQuerying ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              </button>
            )}
          </div>

          {messages.length > 0 && (
            <div className="flex justify-end px-1">
              <button
                onClick={clearDocument}
                className="text-[11px] text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors"
              >
                <RotateCcw size={10} /> New chat
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
