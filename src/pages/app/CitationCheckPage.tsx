import { useCallback, useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, Clipboard, SearchCheck, Trash2, Upload, Wand2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useCitationCheck } from '../../hooks/useCitationCheck'
import type { CitationCard } from '../../types/citationCheck'
import { insertReference, referenceStub } from '../../lib/citationCheckActions'
import { canStart, isCheckableFile, MAX_FILE_BYTES, retentionNote, startHint, wordCount } from '../../lib/citationCheckView'
import { wordCountOf } from '../../lib/citationHighlights'
import { LOST_TOUCH_MESSAGE } from '../../lib/citationCheckPolling'
import { CitationCheckReportView } from '../../components/app/citationCheck/CitationCheckReportView'
import { CitationDocumentPane } from '../../components/app/citationCheck/CitationDocumentPane'
import { CitationDraftHeader } from '../../components/app/citationCheck/CitationDraftHeader'
import { CitationDraftUnavailable } from '../../components/app/citationCheck/CitationDraftUnavailable'
import { CitationEstimateCard } from '../../components/app/citationCheck/CitationEstimateCard'
import { citationCheckApi } from '../../api/citationCheck'
import { saveBlob, type ExportFormat } from '../../lib/documentExport'
import { CitationModeToggle } from '../../components/app/citationCheck/CitationModeToggle'
import { DropOverlay } from '../../components/ui/DropOverlay'
import { PanelLabel } from '../../components/ui/PanelLabel'
import { UtilityButton } from '../../components/ui/UtilityButton'
import { ClearButton } from '../../components/ui/ClearButton'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import { Skeleton } from '../../components/ui/Skeleton'
import { ResultsPanelHeader } from '../../components/ui/ResultsPanelHeader'
import { PanelFooterBar } from '../../components/ui/PanelFooterBar'
import { ToolBottomActionRow } from '../../components/ui/ToolBottomActionRow'
import { ToolWorkspaceCard } from '../../components/shared/ToolWorkspaceCard'
import { primaryButtonClass } from '../../lib/utils'

// The evidence-linked successor to Citation Integrity: it finds each cited source, reads what it can of it, and shows the passage
// it judged against. It never edits the draft. A suggested wording is offered for the writer to copy, and a source it could not
// check is reported as "could not verify", never as a problem with the writer.

export default function CitationCheckPage() {
  const check = useCitationCheck()
  const { confirm, dialog: confirmDialog } = useConfirm()
  const [inputText, setInputText] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const dragDepth = useRef(0)
  const fileInput = useRef<HTMLInputElement>(null)

  // The draft is locked only while a check is actually being sent or run. Once it has finished the writer can edit and check again:
  // fixing a missing reference and re-checking is the whole point.
  const inFlight = check.phase === 'starting' || check.phase === 'running'
  const words = wordCount(inputText)
  const canSubmit = canStart(inputText) && !inFlight

  // A coarse clock, only so "taking longer than usual to start" can appear without a new request.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (check.phase !== 'running') return
    const id = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(id)
  }, [check.phase])
  const queuedForMs = check.queuedSince ? Math.max(0, now - check.queuedSince) : 0

  // A check exists once it has started; its results are what Replace and Clear would throw away.
  const hasRun = check.phase !== 'idle'
  const hasResults = (check.report?.cards.length ?? 0) > 0

  const confirmReplace = useCallback(() => confirm({
    title: 'Replace this document?',
    message: 'The current results will be cleared from the page.',
    confirmLabel: 'Replace document',
    tone: 'warning',
  }), [confirm])

  const pickReplacementFile = async () => {
    if (hasResults && !(await confirmReplace())) return
    fileInput.current?.click()
  }

  const startFromFile = useCallback(async (file: File | undefined) => {
    if (!file) return
    if (!isCheckableFile(file.name)) { toast.error('Upload a Word (.docx) or PDF file, or paste your text.'); return }
    if (file.size > MAX_FILE_BYTES) { toast.error(`That file is too large to check (the limit is ${MAX_FILE_BYTES / 1_000_000} MB).`); return }
    if (hasResults && !(await confirmReplace())) return
    void check.prepareFile(file)
  }, [check, hasResults, confirmReplace])

  const handlePaste = useCallback(async () => {
    try {
      setInputText(await navigator.clipboard.readText())
      toast.success('Pasted from clipboard!')
    } catch {
      toast.error('Clipboard access denied')
    }
  }, [])

  const dragHandlers = {
    onDragEnter: (e: DragEvent) => {
      e.preventDefault()
      if (inFlight || !e.dataTransfer.types.includes('Files')) return
      if (++dragDepth.current === 1) setIsDragging(true)
    },
    onDragLeave: (e: DragEvent) => {
      e.preventDefault()
      if (inFlight) return
      if (--dragDepth.current <= 0) { dragDepth.current = 0; setIsDragging(false) }
    },
    onDragOver: (e: DragEvent) => e.preventDefault(),
    onDrop: (e: DragEvent) => {
      e.preventDefault()
      dragDepth.current = 0; setIsDragging(false)
      if (!inFlight) void startFromFile(e.dataTransfer.files[0])
    },
  }

  /**
   * Add a line for this citation to the writer's reference list. With the draft in the box it is appended there, for them to fill in and
   * check again. After a refresh the draft is not in the browser (the server holds it, encrypted), so the line is copied instead.
   */
  const addReference = useCallback(async (card: CitationCard) => {
    const stub = referenceStub(card)
    if (!stub) return
    if (!hasRun && inputText.trim()) {
      const next = insertReference(inputText, stub)
      if (next === inputText) { toast('That line is already at the end of your references.'); return }
      setInputText(next)
      toast.success('Added a line to fill in at the end of your references. Complete it, then check again.')
      return
    }
    try {
      await navigator.clipboard.writeText(stub)
      toast.success('Copied. Paste it into your reference list and fill it in, then check again.')
    } catch {
      toast.error('Clipboard access denied')
    }
  }, [inputText, hasRun])

  const confirmDelete = async () => {
    const ok = await confirm({
      title: 'Delete your draft and results?',
      message: 'Your draft and every result for this check will be permanently deleted from our servers. This cannot be undone.',
      confirmLabel: 'Delete permanently',
      tone: 'danger',
    })
    if (ok) void check.remove()
  }

  const startNew = () => { check.reset(); setInputText('') }

  // Clear asks first when there is something to lose.
  const clearAll = async () => {
    if (hasResults) {
      const ok = await confirm({
        title: 'Clear this document?',
        message: 'The document and its results will be removed from this page. Your results stay saved on the server until they expire or you delete them.',
        confirmLabel: 'Clear page',
        tone: 'warning',
      })
      if (!ok) return
    }
    startNew()
  }
  const wordsChecked = check.draft ? wordCountOf(check.draft.text) : null

  const [reportBusy, setReportBusy] = useState<ExportFormat | null>(null)
  const downloadReport = async (format: ExportFormat) => {
    const runId = check.report?.runId
    if (!runId || reportBusy) return
    setReportBusy(format)
    try {
      const base = check.fileName?.replace(/\.[^.]+$/, '') ?? undefined
      const blob = await citationCheckApi.downloadReport(runId, format, base)
      const safe = (base ?? '').replace(/[\\/:*?"<>|]/g, '').trim()
      saveBlob(blob, `${safe ? `Citation report ${safe}` : 'Citation report'}.${format}`)
    } catch {
      toast.error("Couldn't download the report. Please try again.")
    } finally {
      setReportBusy(null)
    }
  }

  const citationsInRun = check.report?.citationCount ?? check.report?.cards.length ?? 0

  const leftPanel = {
    header: (
      <>
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-[#e0e0da] shrink-0">
          <PanelLabel label="Your draft" />
          <CitationModeToggle active="document" />
        </div>
        {hasRun && (
          <CitationDraftHeader
            fileName={check.fileName}
            words={wordsChecked}
            citations={citationsInRun}
            warnings={check.extractionWarnings}
            busy={check.phase === 'starting'}
            onReplace={() => void pickReplacementFile()}
            onClear={() => void clearAll()}
          />
        )}
      </>
    ),
    body: (
      <div className="flex-1 min-h-0 flex flex-col relative" {...dragHandlers}>
        <input ref={fileInput} type="file" accept=".docx,.pdf" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { if (!isCheckableFile(f.name)) toast.error('Upload a Word (.docx) or PDF file, or paste your text.'); else if (f.size > MAX_FILE_BYTES) toast.error(`That file is too large to check (the limit is ${MAX_FILE_BYTES / 1_000_000} MB).`); else void check.prepareFile(f) } }} />
        <DropOverlay isDragging={isDragging} isProcessing={check.phase === 'starting'} />
        <div className="relative flex-1 min-h-0">
          {!hasRun && check.pending ? (
            <CitationEstimateCard
              fileName={check.pending.kind === 'file' ? check.pending.file.name : null}
              estimate={check.pending.estimate}
              onStart={() => void check.confirmPending()}
              onCancel={check.cancelPending}
            />
          ) : !hasRun ? (
            <>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                aria-label="Your draft"
                className="textarea-body absolute inset-0 w-full h-full bg-white text-slate-900 resize-none outline-none focus:ring-2 focus:ring-inset focus:ring-purple-accent/30 rounded-lg px-4 py-4"
              />
              {!inputText && (
                <div className="textarea-body pointer-events-none absolute inset-0 px-4 py-4 text-slate-500 select-none">
                  Paste your draft with its in-text citations and a reference list headed "References". Or upload a Word (.docx) or PDF file. Minimum 20 words.
                </div>
              )}
            </>
          ) : check.draftState === 'ready' && check.draft ? (
            <CitationDocumentPane text={check.draft.text} cards={check.report?.cards ?? []} />
          ) : check.draftState === 'gone' || check.draftState === 'error' ? (
            <CitationDraftUnavailable
              state={check.draftState}
              fileName={check.fileName}
              citations={citationsInRun}
              deleteAfter={check.report?.deleteAfter ?? null}
              onRetry={check.retryDraft}
              onReupload={() => fileInput.current?.click()}
            />
          ) : (
            <div className="absolute inset-0 px-5 py-4" aria-busy="true">
              <p className="text-[12px] text-slate-700 mb-3">{check.phase === 'starting' ? 'Sending your draft…' : 'Loading your draft…'}</p>
              <Skeleton variant="text" tone="light" lines={8} />
            </div>
          )}
        </div>
      </div>
    ),
    footer: (
      <>
        <PanelFooterBar
          metadata={<span className="text-xs font-normal tabular-nums text-slate-600">{hasRun ? (wordsChecked === null ? '' : `${wordsChecked.toLocaleString()} words`) : `${words} words`}</span>}
          actions={
            <>
              {!hasRun && <UtilityButton icon={<Clipboard size={14} />} label="Paste" className="h-8 px-3 text-[13px]" onClick={handlePaste} disabled={inFlight} />}
              <UtilityButton icon={<Upload size={14} />} label="Upload .docx or PDF" className="h-8 px-3 text-[13px]" onClick={() => void pickReplacementFile()} disabled={inFlight} />
            </>
          }
        />
        <ToolBottomActionRow
          clearButton={<ClearButton onClick={() => void clearAll()} disabled={!inputText && !hasRun} />}
          hint={hasRun ? undefined : startHint(inputText) ?? undefined}
          primaryButton={
            hasRun ? (
              <button type="button" onClick={startNew} disabled={inFlight} className={primaryButtonClass(!inFlight)}>
                {inFlight ? (
                  <>
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><Wand2 size={14} /></motion.div>
                    {check.phase === 'starting' ? 'Sending…' : 'Checking…'}
                  </>
                ) : 'Start a new check'}
              </button>
            ) : (
              <button type="button" onClick={() => void check.prepareText(inputText)} disabled={!canSubmit || check.preparing} className={primaryButtonClass(canSubmit && !check.preparing)}>
                {check.preparing ? 'Reading…' : 'Check citations'}
              </button>
            )
          }
        />
      </>
    ),
  }

  const report = check.report
  const showReport = report !== null && check.phase !== 'starting'

  const rightPanel = {
    header: (
      <ResultsPanelHeader title={<PanelLabel label="Results" count={report?.cards.length} countLabel="citations" />} />
    ),
    footer: report && (
      <PanelFooterBar
        metadata={<span className="text-[11px] text-slate-600">{retentionNote(report.deleteAfter)}</span>}
        actions={
          <UtilityButton icon={<Trash2 size={14} />} label="Delete my draft and results" className="h-8 px-3 text-[13px]" onClick={() => void confirmDelete()} />
        }
      />
    ),
    body: (
      <div className="flex-1 min-h-0 flex flex-col">
        <AnimatePresence mode="wait">
          {showReport ? (
            <motion.div key="report" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 min-h-0 flex flex-col">
              <CitationCheckReportView
                report={report}
                lostMessage={check.phase === 'lost' ? (check.error ?? LOST_TOUCH_MESSAGE) : null}
                queuedForMs={queuedForMs}
                onRetry={check.retryWatch}
                onAddReference={addReference}
                linkedToDocument={check.draftState === 'ready'}
                draftText={check.draft?.text}
                onRetryFailed={ids => void check.retryFailed(ids)}
                onDownload={format => void downloadReport(format)}
                downloadBusy={reportBusy}
              />
            </motion.div>
          ) : check.phase === 'starting' || check.phase === 'running' ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 px-5 py-4">
              <p className="text-[12px] text-slate-700 mb-3">{check.phase === 'starting' ? 'Sending your draft…' : 'Loading your check…'}</p>
              <Skeleton variant="text" tone="light" lines={6} />
            </motion.div>
          ) : check.error ? (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex-1 flex flex-col items-center justify-center h-full gap-3 text-center px-8">
              <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center">
                <AlertCircle size={16} className="text-red-500" />
              </div>
              <div>
                <p className="text-[14px] font-medium text-slate-700">Couldn't start the check</p>
                <p className="text-[12px] text-slate-700 mt-1 max-w-[280px] leading-relaxed">{check.error}</p>
              </div>
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex-1 min-h-0 overflow-y-auto py-4 flex flex-col items-center justify-center gap-3 px-8 text-center">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center">
                <SearchCheck size={16} className="text-indigo-500 opacity-70" />
              </div>
              <div>
                <p className="text-[14px] font-medium text-slate-700">Your citation report will appear here</p>
                <p className="text-[12px] text-slate-600 mt-1 max-w-[300px] leading-relaxed">
                  Finds each source you cited, reads what it can of it, and shows the passage it checked your claim against. It never changes your draft.
                  A source it cannot check is marked "could not verify", which does not count against you.
                </p>
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
        leftPanel={leftPanel}
        rightPanel={rightPanel}
      />
      {confirmDialog}
    </div>
  )
}
