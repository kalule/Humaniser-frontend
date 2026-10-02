import { useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  AlertTriangle, ChevronDown, ChevronUp, ClipboardCheck, Loader2, Plus, RefreshCw, Search, Sparkles, Upload, X,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useSystematicReviewStore } from '../../store/systematicReviewStore'
import { useCreditGate } from '../../hooks/useCreditGate'
import { CREDIT_COSTS } from '../../config/creditCosts'
import ConfirmActionModal from '../../components/app/ConfirmActionModal'
import type {
  ExtractedValueItem, ExtractionFilter, ExtractionRecord, ExtractionRunStatus, ExtractionSummary,
  SuggestedExtractionVariable, SystematicReviewDetail } from '../../types/systematicReview'

interface ExtractionStepProps {
  reviewId: string
  detail:   SystematicReviewDetail
  onSaved:  () => void
}

const SOURCES = ['PubMed', 'OpenAlex', 'arXiv', 'Semantic Scholar', 'ClinicalTrials.gov', 'Scopus', 'Snowball']

// Tracks review ids we've already auto-suggested variables for in this browser tab, so
// navigating away from and back to this step doesn't re-trigger the AI call, and so a user who
// deliberately clears all variables isn't immediately overwritten again within the same session —
// mirrors SystematicReviewWorkspacePage's autoPopulateAttempted for Eligibility Criteria.
const autoSuggestAttempted = new Set<string>()

const FILTER_CHIPS: { id: ExtractionFilter; label: (s: ExtractionSummary | null, total: number) => string; activeClass: string }[] = [
  { id: 'all',          label: (s, total) => `All (${s?.total ?? total})`,    activeClass: 'bg-violet-600 border-violet-600 text-white' },
  { id: 'needsPdf',     label: s => `Needs PDF (${s?.needsPdf ?? 0})`,         activeClass: 'bg-amber-accent border-amber-accent text-white' },
  { id: 'abstractOnly', label: s => `Abstract only (${s?.abstractOnly ?? 0})`, activeClass: 'bg-slate-600 border-slate-600 text-white' },
]

export default function ExtractionStep({ reviewId, detail, onSaved }: ExtractionStepProps) {
  const getExtractionRecords = useSystematicReviewStore(s => s.getExtractionRecords)
  const addExtractionVariable = useSystematicReviewStore(s => s.addExtractionVariable)
  const suggestExtractionVariables = useSystematicReviewStore(s => s.suggestExtractionVariables)
  const deleteExtractionVariable = useSystematicReviewStore(s => s.deleteExtractionVariable)
  const setExtractionVariableOutcome = useSystematicReviewStore(s => s.setExtractionVariableOutcome)
  const clearExtractionVariables = useSystematicReviewStore(s => s.clearExtractionVariables)
  const runExtractionAction = useSystematicReviewStore(s => s.runExtraction)
  const hasEnoughCredits = useCreditGate()
  const getExtractionRunStatus = useSystematicReviewStore(s => s.getExtractionRunStatus)
  const rerunExtractionForPaper = useSystematicReviewStore(s => s.rerunExtractionForPaper)
  const updateExtractedValue = useSystematicReviewStore(s => s.updateExtractedValue)
  const skipExtractionAction = useSystematicReviewStore(s => s.skipExtraction)
  const uploadPdfAction = useSystematicReviewStore(s => s.uploadPdf)
  const applyAbstractFallback = useSystematicReviewStore(s => s.useAbstractFallback)
  const applyAbstractFallbackForAll = useSystematicReviewStore(s => s.useAbstractFallbackForAll)
  const getPaperFullTextAction = useSystematicReviewStore(s => s.getPaperFullText)
  const loadDetail = useSystematicReviewStore(s => s.loadDetail)
  const recoverAbstractsAction = useSystematicReviewStore(s => s.recoverAbstracts)

  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [sourceFilter, setSourceFilter] = useState('all')
  const [filter, setFilter] = useState<ExtractionFilter>('all')

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [records, setRecords] = useState<ExtractionRecord[]>([])
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState<ExtractionSummary | null>(detail.extractionSummary)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)

  const [runStatus, setRunStatus] = useState<ExtractionRunStatus | null>(null)
  const [isRunningJob, setIsRunningJob] = useState(false)
  // One reconcile per mount, so the refresh cannot loop.
  const reconciledRef = useRef(false)
  const [statusChecking, setStatusChecking] = useState(true)
  const [runError, setRunError] = useState<string | null>(null)

  const [newVariableName, setNewVariableName] = useState('')
  const [addingVariable, setAddingVariable] = useState(false)
  const [suggestions, setSuggestions] = useState<SuggestedExtractionVariable[]>([])
  const [suggesting, setSuggesting] = useState(false)
  const [suggestError, setSuggestError] = useState<string | null>(null)
  const [addingSuggestionIndex, setAddingSuggestionIndex] = useState<number | null>(null)
  const [addingAllSuggestions, setAddingAllSuggestions] = useState(false)
  const [pendingClearVariables, setPendingClearVariables] = useState(false)
  const [pendingSkip, setPendingSkip] = useState(false)
  const [pendingBulkFallback, setPendingBulkFallback] = useState(false)
  const [bulkFallbackBusy, setBulkFallbackBusy] = useState(false)

  const [editingValueId, setEditingValueId] = useState<string | null>(null)
  const [expandedExcerpts, setExpandedExcerpts] = useState<Set<string>>(new Set())
  const [rerunningPaperId, setRerunningPaperId] = useState<string | null>(null)
  const [recoveringAbstracts, setRecoveringAbstracts] = useState(false)

  const [uploadingPaperId, setUploadingPaperId] = useState<string | null>(null)
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({})
  const [pendingUploadPaperId, setPendingUploadPaperId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [textView, setTextView] = useState<Record<string, 'abstract' | 'fullText'>>({})
  const [fullTextCache, setFullTextCache] = useState<Record<string, string | null>>({})
  const [fullTextLoading, setFullTextLoading] = useState<Set<string>>(new Set())

  const variables = detail.extractionVariables

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => setDebouncedSearch(searchInput), 400)
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current) }
  }, [searchInput])

  const loadRecords = async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const res = await getExtractionRecords(reviewId, {
        search: debouncedSearch || undefined,
        source: sourceFilter === 'all' ? undefined : sourceFilter,
        filter,
        page,
        pageSize,
      })
      setRecords(res.items)
      setTotal(res.total)
      setSummary(res.summary)
    } catch (err) {
      console.error(err)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRecords()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, sourceFilter, filter, page, pageSize, reviewId, variables.length])

  // Auto-suggest and auto-add extraction variables the first time this step is reached with
  // papers ready to extract from and no variables defined yet — mirrors the Eligibility
  // Criteria step's auto-populate behavior so the matrix isn't empty on first visit.
  useEffect(() => {
    if (variables.length > 0 || loading || total === 0) return
    if (detail.extractionSkipped || autoSuggestAttempted.has(reviewId)) return
    autoSuggestAttempted.add(reviewId)

    setSuggesting(true)
    ;(async () => {
      try {
        const result = await suggestExtractionVariables(reviewId)
        // isOutcome carried through: these become the rows Evidence Grading rates, and nothing
        // else ever sets the flag automatically.
        await Promise.all(result.map(v => addExtractionVariable(reviewId, v.name, true, v.isOutcome)))
        await loadDetail(reviewId).catch(() => {})
        onSaved()
      } catch {
        toast.error("Couldn't auto-suggest extraction variables — use Suggest fields with AI below.")
      } finally {
        setSuggesting(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewId, variables.length, loading, total, detail.extractionSkipped])

  // Poll extraction run status — same shape as FullTextScreeningStep's poll.
  useEffect(() => {
    let timer: number | null = null
    let cancelled = false
    const poll = async () => {
      try {
        const status = await getExtractionRunStatus(reviewId)
        if (cancelled) return
        setRunStatus(status)
        if (status.isRunning) {
          setIsRunningJob(true)
          timer = window.setTimeout(poll, 2000)
        } else if (isRunningJob) {
          setIsRunningJob(false)
          setRunError(null)
          loadRecords()
          loadDetail(reviewId).catch(() => {})
          onSaved()
        }
      } catch (err) {
        console.error('Failed to poll extraction status', err)
        if (!cancelled && isRunningJob) timer = window.setTimeout(poll, 5000)
      }
    }

    if (isRunningJob) {
      poll()
    } else {
      getExtractionRunStatus(reviewId).then(status => {
        if (cancelled) return
        setRunStatus(status)
        if (status.isRunning) {
          setIsRunningJob(true)
        } else if (!reconciledRef.current) {
          // Same reconcile-on-mount as RiskOfBiasStep. The completion branch above only fires for
          // a running -> finished transition this component personally witnessed; if the job
          // finished while the user was elsewhere (another step, a reload, another tab), that
          // transition never happens here and the workspace keeps the summary it loaded BEFORE
          // the run. The step's "Next" gate reads that summary, so finished work can still look
          // unfinished and block the step.
          reconciledRef.current = true
          loadDetail(reviewId).catch(() => {})
        }
      }).catch(() => {}).finally(() => {
        if (!cancelled) setStatusChecking(false)
      })
    }

    return () => { cancelled = true; if (timer) clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunningJob, reviewId])

  const handleRunExtraction = async () => {
    if (!hasEnoughCredits(CREDIT_COSTS.systematicReviewExtraction)) return
    setRunError(null)
    try {
      setIsRunningJob(true)
      await runExtractionAction(reviewId)
    } catch (err) {
      console.error('Failed to start data extraction', err)
      setIsRunningJob(false)
      setRunError('Could not start data extraction. Please try again.')
    }
  }

  const handleAddVariable = async () => {
    const name = newVariableName.trim()
    if (!name) return
    setAddingVariable(true)
    try {
      await addExtractionVariable(reviewId, name, false)
      setNewVariableName('')
      await loadDetail(reviewId).catch(() => {})
      onSaved()
    } finally {
      setAddingVariable(false)
    }
  }

  const handleSuggest = async () => {
    setSuggesting(true)
    setSuggestError(null)
    try {
      const result = await suggestExtractionVariables(reviewId)
      setSuggestions(result.filter(s => !variables.some(v => v.name.toLowerCase() === s.name.toLowerCase())))
    } catch {
      setSuggestError('Could not generate suggestions. Please try again.')
    } finally {
      setSuggesting(false)
    }
  }

  const addSuggestion = async (index: number) => {
    const suggestion = suggestions[index]
    setAddingSuggestionIndex(index)
    try {
      await addExtractionVariable(reviewId, suggestion.name, true, suggestion.isOutcome)
      setSuggestions(prev => prev.filter((_, i) => i !== index))
      await loadDetail(reviewId).catch(() => {})
      onSaved()
    } finally {
      setAddingSuggestionIndex(null)
    }
  }

  const addAllSuggestions = async () => {
    setAddingAllSuggestions(true)
    try {
      await Promise.all(suggestions.map(v => addExtractionVariable(reviewId, v.name, true, v.isOutcome)))
      setSuggestions([])
      await loadDetail(reviewId).catch(() => {})
      onSaved()
    } finally {
      setAddingAllSuggestions(false)
    }
  }

  const handleRemoveVariable = async (variableId: string) => {
    await deleteExtractionVariable(reviewId, variableId)
    await loadDetail(reviewId).catch(() => {})
    onSaved()
  }

  const handleToggleOutcome = async (variableId: string, isOutcome: boolean) => {
    await setExtractionVariableOutcome(reviewId, variableId, isOutcome)
    onSaved()
  }

  const handleClearVariables = async () => {
    await clearExtractionVariables(reviewId)
    setPendingClearVariables(false)
    await loadDetail(reviewId).catch(() => {})
    onSaved()
  }

  const handleSkip = async () => {
    await skipExtractionAction(reviewId)
    setPendingSkip(false)
    await loadDetail(reviewId).catch(() => {})
    onSaved()
  }

  // The record's own source did not carry an abstract; another one may. Re-asks PubMed and
  // Crossref by DOI for the included papers that have neither an abstract nor a PDF — the exact
  // set that can otherwise be neither read nor advanced past.
  const handleRecoverAbstracts = async () => {
    setRecoveringAbstracts(true)
    try {
      const result = await recoverAbstractsAction(reviewId)
      if (result.recovered > 0) {
        toast.success(result.recovered === 1
          ? 'Recovered 1 abstract.'
          : `Recovered ${result.recovered} abstracts.`)
        await loadRecords()
        await loadDetail(reviewId).catch(() => {})
        onSaved()
      } else if (result.noDoi > 0 && result.attempted === 0) {
        // Nothing was even lookup-able — say that rather than implying the lookup came back empty.
        toast(`${result.noDoi === 1 ? '1 paper has' : `${result.noDoi} papers have`} no DOI to look up. Upload the PDF instead.`)
      } else {
        toast('No abstracts found in PubMed or Crossref for these DOIs. Upload the PDF instead.')
      }
    } catch (err) {
      console.error('Failed to recover abstracts', err)
      const message = (err as { message?: string })?.message
      toast.error(message && message.trim().length > 0 ? message : "Couldn't reach PubMed or Crossref just now.")
    } finally {
      setRecoveringAbstracts(false)
    }
  }

  const handleRerunRow = async (paperId: string) => {
    setRerunningPaperId(paperId)
    try {
      const updated = await rerunExtractionForPaper(reviewId, paperId)
      setRecords(prev => prev.map(r => (r.paperId === paperId ? updated : r)))
      await loadDetail(reviewId).catch(() => {})
      onSaved()
    } catch (err) {
      console.error('Failed to re-run extraction for paper', err)
      // The common failure here is "this paper has no text to read", which the API now reports
      // with the fix in the message — showing it is the whole point of the change.
      const message = (err as { message?: string })?.message
      toast.error(message && message.trim().length > 0
        ? message
        : "Couldn't re-run extraction for this paper.")
    } finally {
      setRerunningPaperId(null)
    }
  }

  const handleValueEdit = async (paperId: string, value: ExtractedValueItem, draft: string) => {
    setEditingValueId(null)
    try {
      const updated = await updateExtractedValue(reviewId, value.id, draft.trim().length > 0 ? draft.trim() : null)
      setRecords(prev => prev.map(r =>
        r.paperId !== paperId ? r : { ...r, values: r.values.map(v => (v.id === value.id ? updated : v)) },
      ))
      await loadDetail(reviewId).catch(() => {})
      onSaved()
    } catch (err) {
      console.error('Failed to update extracted value', err)
    }
  }

  const handleUploadClick = (paperId: string) => {
    setPendingUploadPaperId(paperId)
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !pendingUploadPaperId) return
    const paperId = pendingUploadPaperId
    setPendingUploadPaperId(null)
    setUploadingPaperId(paperId)
    setUploadErrors(prev => { const next = { ...prev }; delete next[paperId]; return next })
    try {
      await uploadPdfAction(reviewId, paperId, file)
      await loadRecords()
      await loadDetail(reviewId).catch(() => {})
      onSaved()
    } catch (err) {
      console.error('Failed to upload PDF', err)
      setUploadErrors(prev => ({ ...prev, [paperId]: 'Could not upload this PDF. Please try again.' }))
    } finally {
      setUploadingPaperId(null)
    }
  }

  const handleUseAbstractFallback = async (paperId: string) => {
    try {
      await applyAbstractFallback(reviewId, paperId)
      await loadRecords()
      await loadDetail(reviewId).catch(() => {})
      onSaved()
    } catch (err) {
      console.error('Failed to set abstract fallback', err)
    }
  }

  // Same escape hatch Full Text Screening offers on its identical "needs a PDF" banner. Without
  // it these papers can only be resolved one row at a time, and until they are the extraction job
  // skips them entirely (it only reads PdfUploaded or UseAbstractFallback papers), so the step's
  // "everything extracted" gate can never be satisfied.
  const handleBulkFallback = async () => {
    setBulkFallbackBusy(true)
    try {
      const { affectedCount } = await applyAbstractFallbackForAll(reviewId)
      setPendingBulkFallback(false)
      await loadRecords()
      await loadDetail(reviewId).catch(() => {})
      onSaved()
      toast.success(
        `${affectedCount} paper${affectedCount === 1 ? '' : 's'} set to use their abstract — run extraction to fill them in.`)
    } catch (err) {
      console.error('Failed to apply bulk abstract fallback', err)
      setPendingBulkFallback(false)
      toast.error("Couldn't switch those papers to their abstracts. Please try again.")
    } finally {
      setBulkFallbackBusy(false)
    }
  }

  const setTextViewFor = (paperId: string, view: 'abstract' | 'fullText') => {
    setTextView(prev => ({ ...prev, [paperId]: view }))
    if (view === 'fullText' && !(paperId in fullTextCache) && !fullTextLoading.has(paperId)) {
      setFullTextLoading(prev => new Set(prev).add(paperId))
      getPaperFullTextAction(reviewId, paperId)
        .then(res => setFullTextCache(prev => ({ ...prev, [paperId]: res.fullTextContent })))
        .catch(() => setFullTextCache(prev => ({ ...prev, [paperId]: null })))
        .finally(() => setFullTextLoading(prev => { const next = new Set(prev); next.delete(paperId); return next }))
    }
  }

  const toggleExcerpt = (valueId: string) => {
    setExpandedExcerpts(prev => {
      const next = new Set(prev)
      if (next.has(valueId)) next.delete(valueId); else next.add(valueId)
      return next
    })
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />
      <div className="flex-1 overflow-y-auto px-6 py-6 pb-20">
        <div className="mb-6">
          <h2 className="text-[20px] font-bold text-slate-900 mb-1">Data Extraction</h2>
          <p className="text-[13px] text-slate-500">Extract structured data from included papers</p>
        </div>

        {/* Extraction variables builder */}
        <div className="border border-slate-200 rounded-xl p-4 mb-6">
          <h3 className="text-[13px] font-bold text-slate-800 mb-1">Extraction variables</h3>
          <p className="text-[12px] text-slate-500 mb-3">
            Each variable becomes a column that AI reads out of every included paper — e.g. sample size, dosage,
            primary outcome. Purple chips are AI-suggested; add your own via the input below or clear and restart anytime.
            Click the checkmark on a variable to mark it as an outcome — outcomes become the rows graded in Evidence Grading.
          </p>

          {variables.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {variables.map(v => (
                <span
                  key={v.id}
                  className={cn(
                    'flex items-center gap-1 text-[11px] font-medium pl-2.5 pr-1.5 py-1 rounded-full',
                    v.isOutcome ? 'bg-green-100 text-green-700' : v.isAiSuggested ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-700',
                  )}
                >
                  {v.name}
                  <button
                    onClick={() => handleToggleOutcome(v.id, !v.isOutcome)}
                    className={cn('transition-colors', v.isOutcome ? 'text-green-500 hover:text-green-700' : 'text-slate-400 hover:text-violet-600')}
                    title={v.isOutcome ? `Unmark "${v.name}" as an outcome` : `Mark "${v.name}" as an outcome to grade in Evidence Grading`}
                  >
                    <ClipboardCheck size={11} />
                  </button>
                  <button
                    onClick={() => handleRemoveVariable(v.id)}
                    className={cn('transition-colors', v.isAiSuggested ? 'text-violet-400 hover:text-violet-700' : 'text-slate-400 hover:text-slate-700')}
                    title={`Remove "${v.name}"`}
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 mb-3">
            <input
              value={newVariableName}
              onChange={e => setNewVariableName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddVariable() }}
              placeholder="Add variable (e.g. Sample size, dosage, primary outcome)"
              className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-[13px] text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition placeholder-slate-400"
            />
            <button
              onClick={handleAddVariable}
              disabled={!newVariableName.trim() || addingVariable}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[12px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {addingVariable ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              Add
            </button>
          </div>

          {suggestions.length > 0 && (
            <div className="border border-violet-200 bg-violet-50/40 rounded-xl p-3 mb-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Suggested variables</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={addAllSuggestions}
                    disabled={addingAllSuggestions}
                    className="text-[11px] font-semibold text-violet-600 hover:text-violet-700 transition-colors disabled:opacity-50"
                  >
                    {addingAllSuggestions ? 'Adding…' : 'Add all'}
                  </button>
                  <button
                    onClick={() => setSuggestions([])}
                    className="text-[11px] font-medium text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    Dismiss all
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((suggestion, i) => (
                  <span key={`${suggestion.name}-${i}`} className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg pl-2.5 pr-1.5 py-1">
                    <span className="text-[12px] font-medium text-slate-800">{suggestion.name}</span>
                    {/* Outcomes are the rows Evidence Grading rates, so show which ones they are
                        before they're added rather than making it a hidden property. */}
                    {suggestion.isOutcome && (
                      <span className="text-[9.5px] font-semibold uppercase tracking-wide text-violet-600 bg-violet-50 border border-violet-200 rounded px-1 py-0.5">
                        Outcome
                      </span>
                    )}
                    <button
                      onClick={() => addSuggestion(i)}
                      disabled={addingSuggestionIndex === i}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-violet-200 text-violet-600 hover:bg-violet-50 text-[10px] font-semibold transition-colors disabled:opacity-50"
                    >
                      {addingSuggestionIndex === i ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
                      Add
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {suggestError && (
            <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{suggestError}</p>
          )}

          <p className="text-[11px] text-slate-400 mb-3">Click Suggest fields to let AI propose what to extract, or add your own above.</p>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSuggest}
              disabled={suggesting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[12px] font-semibold transition-colors shadow-sm shadow-violet-200 disabled:opacity-60"
            >
              {suggesting ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              Suggest fields with AI
            </button>
            <button
              onClick={() => setPendingSkip(true)}
              className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[12px] font-semibold transition-colors"
            >
              Skip this step
            </button>
            {variables.length > 0 && (
              <button
                onClick={() => setPendingClearVariables(true)}
                className="ml-auto text-[11px] font-medium text-slate-400 hover:text-red-500 transition-colors"
              >
                Clear all variables
              </button>
            )}
          </div>
        </div>

        {variables.length === 0 ? (
          <div className="py-16 text-center border border-slate-200 border-dashed rounded-xl bg-slate-50/50">
            <p className="text-[14px] font-semibold text-slate-600 mb-1">No extraction variables defined yet.</p>
            <p className="text-[13px] text-slate-400">Add or suggest variables above, or skip this step if this review doesn't need structured extraction.</p>
          </div>
        ) : (
          <>
            {/* Filter chips */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {FILTER_CHIPS.map(chip => (
                <button
                  key={chip.id}
                  onClick={() => { setFilter(chip.id); setPage(1) }}
                  className={cn(
                    'px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-colors',
                    filter === chip.id ? chip.activeClass : 'bg-white border-slate-200 text-slate-600 hover:border-violet-300',
                  )}
                >
                  {chip.label(summary, total)}
                </button>
              ))}
            </div>

            {/* Filter/search bar */}
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <div className="relative w-72">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchInput}
                  onChange={e => { setSearchInput(e.target.value); setPage(1) }}
                  placeholder="Filter papers by title, author, journal, DOI, abstract, or source"
                  className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-[13px] outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Source</span>
                <div className="relative">
                  <select
                    value={sourceFilter}
                    onChange={e => { setSourceFilter(e.target.value); setPage(1) }}
                    className="appearance-none pl-3 pr-8 py-1.5 bg-white border border-slate-200 rounded-lg text-[12px] font-medium text-slate-700 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition"
                  >
                    <option value="all">All sources</option>
                    {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="flex-1" />
              <span className="text-[12px] text-slate-500 font-medium">Showing {records.length} of {total}</span>
            </div>

            {summary && summary.noUsableText > 0 && (
              <div className="flex items-start gap-2.5 bg-amber-tint border border-amber-accent/40 rounded-xl px-4 py-3 mb-4">
                <AlertTriangle size={16} className="text-amber-text shrink-0 mt-0.5" />
                <p className="text-[12px] text-amber-text leading-relaxed">
                  {summary.noUsableText === 1 ? '1 paper has' : `${summary.noUsableText} papers have`} no
                  abstract and no uploaded PDF, so there is nothing to extract from &mdash; the source that supplied
                  the record did not carry an abstract. Upload the PDF to extract{' '}
                  {summary.noUsableText === 1 ? 'it' : 'them'}, or continue: the review will report{' '}
                  {summary.noUsableText === 1 ? 'it' : 'them'} as not extracted.
                </p>
                <button
                  onClick={handleRecoverAbstracts}
                  disabled={recoveringAbstracts}
                  title="Some sources return a record without its abstract. This re-asks PubMed and Crossref by DOI."
                  className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-amber-accent/60 text-amber-text text-[11px] font-semibold hover:bg-amber-accent/10 transition-colors disabled:opacity-60"
                >
                  {recoveringAbstracts ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                  Try to recover
                </button>
              </div>
            )}

            {summary && summary.needsPdf > 0 && (
              <div className="flex items-start justify-between gap-4 bg-amber-tint border border-amber-accent/40 rounded-xl px-4 py-3 mb-4">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle size={16} className="text-amber-text shrink-0 mt-0.5" />
                  <p className="text-[12px] text-amber-text leading-relaxed">
                    {summary.needsPdf} papers still need a PDF or abstract decision before they can be extracted — upload a
                    PDF or use their abstract from the table below, or switch all of them to their abstracts at once.
                  </p>
                </div>
                <button
                  onClick={() => setPendingBulkFallback(true)}
                  disabled={bulkFallbackBusy}
                  className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-amber-accent/60 text-amber-text text-[11px] font-semibold hover:bg-amber-accent/10 transition-colors disabled:opacity-60"
                >
                  {bulkFallbackBusy ? <Loader2 size={11} className="animate-spin" /> : <ClipboardCheck size={11} />}
                  Use abstract for all
                </button>
              </div>
            )}

            {/* Action row */}
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={handleRunExtraction}
                disabled={isRunningJob || statusChecking}
                className="flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[13px] font-semibold transition-colors shadow-sm shadow-violet-200 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isRunningJob ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {isRunningJob
                  ? `Extracting... ${runStatus?.done ?? 0}/${runStatus?.total ?? 0}`
                  : 'Run extraction'}
              </button>
            </div>

            {runError && (
              <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{runError}</p>
            )}

            {/* Matrix table */}
            {loading ? (
              <div className="py-20 flex justify-center"><Loader2 size={24} className="animate-spin text-slate-300" /></div>
            ) : loadError ? (
              <div className="py-12 text-center border border-red-200 bg-red-50 rounded-xl">
                <p className="text-[13px] text-red-600 font-medium">Error loading papers. The backend might not be available.</p>
              </div>
            ) : records.length === 0 ? (
              <div className="py-20 text-center border border-slate-200 border-dashed rounded-xl bg-slate-50/50">
                <p className="text-[14px] font-semibold text-slate-600 mb-1">No papers match this filter.</p>
                <p className="text-[13px] text-slate-400">Papers included by Full Text Screening will appear here.</p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 font-semibold min-w-[280px]">Source Information</th>
                        <th className="px-4 py-3 font-semibold border-l border-slate-200 min-w-[240px]">Content &amp; Actions</th>
                        <th className="px-4 py-3 font-semibold border-l border-slate-200 min-w-[280px]">Abstract</th>
                        {variables.map(v => (
                          <th key={v.id} className="px-4 py-3 font-semibold border-l border-slate-200 min-w-[200px]">{v.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {records.map(r => {
                        const hasUsableText = r.fullTextStatus === 'PdfUploaded' || r.useAbstractFallback
                        // A source decision is not the same as source text: a paper can be opted
                        // into the abstract fallback and carry no abstract at all. Nothing can
                        // extract from it, so it gets its own state rather than a Re-run button
                        // that spins and changes nothing.
                        const hasNoText = r.fullTextStatus !== 'PdfUploaded' && r.abstract.trim().length === 0
                        const view = textView[r.paperId] ?? 'abstract'
                        return (
                          <tr key={r.paperId} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50/50 px-4 py-4 align-top">
                              <div className="flex flex-wrap gap-1.5 mb-2">
                                <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{r.source}</span>
                                <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{r.typeBadge}</span>
                              </div>
                              <p className="text-[14px] font-bold text-slate-900 leading-tight mb-2">{r.title}</p>
                              <p className="text-[12px] text-slate-600 leading-snug">{r.authors}</p>
                              <p className="text-[12px] text-slate-500">{r.publicationDate} · {r.journal}</p>
                            </td>

                            <td className="px-4 py-4 align-top border-l border-slate-100">
                              <div className="flex flex-wrap gap-1.5 mb-2">
                                {hasNoText ? (
                                  <span className="text-[10px] font-semibold bg-amber-tint text-amber-text px-2 py-0.5 rounded">no abstract available &mdash; upload the PDF</span>
                                ) : !hasUsableText ? (
                                  <span className="text-[10px] font-semibold bg-amber-tint text-amber-text px-2 py-0.5 rounded">needs PDF upload</span>
                                ) : r.useAbstractFallback ? (
                                  <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded">Manually confirmed from the abstract</span>
                                ) : (
                                  <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded">Screened on full text</span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 mb-2">
                                <button
                                  onClick={() => setTextViewFor(r.paperId, 'abstract')}
                                  className={cn('px-2 py-0.5 rounded text-[10px] font-semibold transition-colors', view !== 'fullText' ? 'bg-violet-100 text-violet-700' : 'text-slate-400 hover:text-slate-600')}
                                >
                                  Abstract
                                </button>
                                <button
                                  onClick={() => r.fullTextStatus === 'PdfUploaded' && setTextViewFor(r.paperId, 'fullText')}
                                  disabled={r.fullTextStatus !== 'PdfUploaded'}
                                  title={r.fullTextStatus !== 'PdfUploaded' ? 'No uploaded PDF for this paper' : undefined}
                                  className={cn(
                                    'px-2 py-0.5 rounded text-[10px] font-semibold transition-colors',
                                    view === 'fullText' ? 'bg-violet-100 text-violet-700' : 'text-slate-400 hover:text-slate-600',
                                    r.fullTextStatus !== 'PdfUploaded' && 'opacity-40 cursor-not-allowed',
                                  )}
                                >
                                  Full text
                                </button>
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                {!hasUsableText && (
                                  <button
                                    onClick={() => handleUseAbstractFallback(r.paperId)}
                                    className="text-[11px] font-medium text-violet-500 hover:text-violet-700 transition-colors"
                                  >
                                    Use abstract instead
                                  </button>
                                )}
                                {r.fullTextStatus !== 'PdfUploaded' && (
                                  <button
                                    onClick={() => handleUploadClick(r.paperId)}
                                    disabled={uploadingPaperId === r.paperId}
                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-semibold transition-colors disabled:opacity-60"
                                  >
                                    {uploadingPaperId === r.paperId ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
                                    Upload PDF
                                  </button>
                                )}
                                {hasUsableText && !hasNoText && (
                                  <button
                                    onClick={() => handleRerunRow(r.paperId)}
                                    disabled={rerunningPaperId === r.paperId}
                                    className="flex items-center gap-1 text-[11px] font-medium text-violet-500 hover:text-violet-700 transition-colors disabled:opacity-50"
                                  >
                                    {rerunningPaperId === r.paperId ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                                    Re-run Extraction
                                  </button>
                                )}
                              </div>
                              {uploadErrors[r.paperId] && (
                                <p className="text-[11px] text-red-600 mt-1.5">{uploadErrors[r.paperId]}</p>
                              )}
                            </td>

                            <td className="px-4 py-4 align-top border-l border-slate-100">
                              <p className="text-[12px] text-slate-600 leading-relaxed line-clamp-4">
                                {view === 'fullText'
                                  ? (fullTextLoading.has(r.paperId) ? 'Loading full text…' : (fullTextCache[r.paperId] ?? 'Full text not available.'))
                                  : r.abstract.trim().length > 0
                                  ? r.abstract
                                  : <span className="italic text-slate-400">No abstract was returned for this record by the source that supplied it.</span>}
                              </p>
                            </td>

                            {variables.map(v => {
                              const value = r.values.find(x => x.variableId === v.id)
                              if (!value) return <td key={v.id} className="px-4 py-4 align-top border-l border-slate-100" />
                              const isEditing = editingValueId === value.id
                              const excerptExpanded = expandedExcerpts.has(value.id)
                              return (
                                <td key={v.id} className="px-4 py-4 align-top border-l border-slate-100">
                                  {isEditing ? (
                                    <input
                                      autoFocus
                                      defaultValue={value.value ?? ''}
                                      onBlur={e => handleValueEdit(r.paperId, value, e.target.value)}
                                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                                      className="w-full border border-violet-300 rounded-md px-1.5 py-1 text-[12px] text-slate-800 outline-none focus:ring-2 focus:ring-violet-100"
                                    />
                                  ) : (
                                    <button
                                      onClick={() => setEditingValueId(value.id)}
                                      className="flex items-center gap-1 text-left text-[12px] text-slate-800 hover:text-violet-700 transition-colors"
                                    >
                                      {value.isManualOverride && <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />}
                                      {value.value ?? (
                                        <span className="text-slate-400 italic">
                                          {value.attempted ? 'Not reported' : 'Not extracted yet'}
                                        </span>
                                      )}
                                    </button>
                                  )}

                                  {value.sourceExcerpt && (
                                    <button
                                      onClick={() => toggleExcerpt(value.id)}
                                      className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-violet-500 hover:text-violet-700 transition-colors"
                                    >
                                      source {excerptExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                                    </button>
                                  )}

                                  {excerptExpanded && value.sourceExcerpt && (
                                    <p className="mt-1 text-[10px] text-slate-500 border-l-2 border-violet-100 pl-2">
                                      &ldquo;{value.sourceExcerpt}&rdquo;
                                    </p>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {total > 0 && (
                  <div className="border-t border-slate-200 px-4 py-3 flex items-center justify-between bg-slate-50">
                    <span className="text-[12px] text-slate-500 font-medium">
                      Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} papers
                    </span>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] text-slate-500">Show:</span>
                        <select
                          value={pageSize}
                          onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
                          className="border border-slate-200 rounded px-2 py-1 text-[12px] text-slate-700 bg-white outline-none"
                        >
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          disabled={page === 1}
                          className="px-3 py-1 border border-slate-200 rounded text-[12px] font-medium text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Previous
                        </button>
                        <span className="text-[12px] text-slate-500 font-medium min-w-[3rem] text-center">
                          {page} / {Math.max(1, Math.ceil(total / pageSize))}
                        </span>
                        <button
                          onClick={() => setPage(p => p + 1)}
                          disabled={page >= Math.ceil(total / pageSize)}
                          className="px-3 py-1 border border-slate-200 rounded text-[12px] font-medium text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        {pendingClearVariables && (
          <ConfirmActionModal
            title="Clear all extraction variables?"
            message="This removes every variable and any values already extracted for them. This can't be undone."
            confirmLabel="Clear all"
            onClose={() => setPendingClearVariables(false)}
            onConfirm={handleClearVariables}
          />
        )}
        {pendingBulkFallback && summary && (
          <ConfirmActionModal
            title="Extract the remaining papers from their abstracts?"
            message={`This will extract ${summary.needsPdf} papers from their abstract instead of full text — continue?`}
            confirmLabel="Use abstract for all"
            onClose={() => setPendingBulkFallback(false)}
            onConfirm={handleBulkFallback}
          />
        )}
        {pendingSkip && (
          <ConfirmActionModal
            title="Skip data extraction?"
            message="You can advance to the next step without extracting any structured data from these papers."
            confirmLabel="Skip step"
            onClose={() => setPendingSkip(false)}
            onConfirm={handleSkip}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
