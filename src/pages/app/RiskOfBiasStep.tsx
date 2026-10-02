import { useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { AlertTriangle, ChevronDown, Loader2, RefreshCw, Search, Sparkles, Upload } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useSystematicReviewStore } from '../../store/systematicReviewStore'
import { useCreditGate } from '../../hooks/useCreditGate'
import { CREDIT_COSTS } from '../../config/creditCosts'
import ConfirmActionModal from '../../components/app/ConfirmActionModal'
import type {
  RiskOfBiasDomain, RiskOfBiasDomainRating, RiskOfBiasFilter, RiskOfBiasRating, RiskOfBiasRecord,
  RiskOfBiasRunStatus, RiskOfBiasSummary, SystematicReviewDetail,
} from '../../types/systematicReview'

interface RiskOfBiasStepProps {
  reviewId: string
  detail:   SystematicReviewDetail
  onSaved:  () => void
}

const SOURCES = ['PubMed', 'OpenAlex', 'arXiv', 'Semantic Scholar', 'ClinicalTrials.gov', 'Scopus', 'Snowball']

// Fixed Cochrane RoB 2 domain set — unlike Extraction variables, these are not user-defined or
// per-review, so there is no add/remove/suggest UI for them.
const DOMAINS: { domain: RiskOfBiasDomain; label: string }[] = [
  { domain: 'RandomizationProcess',                 label: 'Randomization process' },
  { domain: 'DeviationsFromIntendedInterventions',  label: 'Deviations from intended interventions' },
  { domain: 'MissingOutcomeData',                   label: 'Missing outcome data' },
  { domain: 'MeasurementOfTheOutcome',               label: 'Measurement of the outcome' },
  { domain: 'SelectionOfReportedResult',             label: 'Selection of the reported result' },
]

// Click-to-cycle order — Pending (not yet assessed) advances straight to Low on first click,
// then cycles through the three real ratings.
const RATING_CYCLE: Record<RiskOfBiasRating, RiskOfBiasRating> = {
  Pending: 'Low', Low: 'SomeConcerns', SomeConcerns: 'High', High: 'Low',
}

const RATING_STYLE: Record<RiskOfBiasRating, string> = {
  Pending:      'bg-slate-100 text-slate-500',
  Low:          'bg-green-100 text-green-700',
  SomeConcerns: 'bg-amber-tint text-amber-text',
  High:         'bg-red-100 text-red-700',
}

const RATING_LABEL: Record<RiskOfBiasRating, string> = {
  Pending: 'Not assessed', Low: 'Low', SomeConcerns: 'Some concerns', High: 'High',
}

const OVERALL_BORDER: Record<RiskOfBiasRating, string> = {
  Pending:      'border-l-slate-200',
  Low:          'border-l-green-accent',
  SomeConcerns: 'border-l-amber-accent',
  High:         'border-l-red-400',
}

const FILTER_CHIPS: { id: RiskOfBiasFilter; label: (s: RiskOfBiasSummary | null, total: number) => string; activeClass: string }[] = [
  { id: 'all',          label: (s, total) => `All (${s?.total ?? total})`,            activeClass: 'bg-violet-600 border-violet-600 text-white' },
  { id: 'needsPdf',     label: s => `Needs PDF (${s?.needsPdf ?? 0})`,                  activeClass: 'bg-amber-accent border-amber-accent text-white' },
  { id: 'abstractOnly', label: s => `Abstract only (${s?.abstractOnly ?? 0})`,          activeClass: 'bg-slate-600 border-slate-600 text-white' },
]

export default function RiskOfBiasStep({ reviewId, detail, onSaved }: RiskOfBiasStepProps) {
  const getRiskOfBiasRecords = useSystematicReviewStore(s => s.getRiskOfBiasRecords)
  const runRiskOfBiasAssessmentAction = useSystematicReviewStore(s => s.runRiskOfBiasAssessment)
  const hasEnoughCredits = useCreditGate()
  const getRiskOfBiasRunStatus = useSystematicReviewStore(s => s.getRiskOfBiasRunStatus)
  const rerunRiskOfBiasForPaper = useSystematicReviewStore(s => s.rerunRiskOfBiasForPaper)
  const updateRiskOfBiasRatingAction = useSystematicReviewStore(s => s.updateRiskOfBiasRating)
  const skipRiskOfBiasAction = useSystematicReviewStore(s => s.skipRiskOfBias)
  const uploadPdfAction = useSystematicReviewStore(s => s.uploadPdf)
  const applyAbstractFallback = useSystematicReviewStore(s => s.useAbstractFallback)
  const getPaperFullTextAction = useSystematicReviewStore(s => s.getPaperFullText)
  const loadDetail = useSystematicReviewStore(s => s.loadDetail)
  const recoverAbstractsAction = useSystematicReviewStore(s => s.recoverAbstracts)

  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // One reconcile per mount, so the refresh below cannot loop.
  const reconciledRef = useRef(false)
  const [sourceFilter, setSourceFilter] = useState('all')
  const [filter, setFilter] = useState<RiskOfBiasFilter>('all')

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [records, setRecords] = useState<RiskOfBiasRecord[]>([])
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState<RiskOfBiasSummary | null>(detail.riskOfBiasSummary)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)

  const [runStatus, setRunStatus] = useState<RiskOfBiasRunStatus | null>(null)
  const [isRunningJob, setIsRunningJob] = useState(false)
  const [statusChecking, setStatusChecking] = useState(true)
  const [runError, setRunError] = useState<string | null>(null)

  const [rerunningPaperId, setRerunningPaperId] = useState<string | null>(null)
  const [recoveringAbstracts, setRecoveringAbstracts] = useState(false)
  const [pendingSkip, setPendingSkip] = useState(false)

  const [uploadingPaperId, setUploadingPaperId] = useState<string | null>(null)
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({})
  const [pendingUploadPaperId, setPendingUploadPaperId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [textView, setTextView] = useState<Record<string, 'abstract' | 'fullText'>>({})
  const [fullTextCache, setFullTextCache] = useState<Record<string, string | null>>({})
  const [fullTextLoading, setFullTextLoading] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => setDebouncedSearch(searchInput), 400)
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current) }
  }, [searchInput])

  const loadRecords = async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const res = await getRiskOfBiasRecords(reviewId, {
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
  }, [debouncedSearch, sourceFilter, filter, page, pageSize, reviewId])

  // Poll RoB assessment run status — same shape as ExtractionStep's poll.
  useEffect(() => {
    let timer: number | null = null
    let cancelled = false
    const poll = async () => {
      try {
        const status = await getRiskOfBiasRunStatus(reviewId)
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
        console.error('Failed to poll risk of bias status', err)
        if (!cancelled && isRunningJob) timer = window.setTimeout(poll, 5000)
      }
    }

    if (isRunningJob) {
      poll()
    } else {
      getRiskOfBiasRunStatus(reviewId).then(status => {
        if (cancelled) return
        setRunStatus(status)
        if (status.isRunning) {
          setIsRunningJob(true)
        } else if (!reconciledRef.current) {
          // Reconcile with the server on mount when nothing is running. The completion branch
          // above only fires for a running -> finished transition this component personally
          // witnessed; if the job finished while the user was on another step (or across a
          // reload, or in another tab) that transition never happens here, and the workspace
          // keeps the summary it loaded BEFORE the assessment ran. The "Next" gate reads that
          // summary, so a completed assessment could still show every paper pending and leave
          // the step impossible to advance past — which is exactly how a live review got stuck
          // on 2026-09-05 with 5 of 6 papers already assessed.
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

  const handleRunAssessment = async () => {
    if (!hasEnoughCredits(CREDIT_COSTS.systematicReviewRiskOfBias)) return
    setRunError(null)
    try {
      setIsRunningJob(true)
      await runRiskOfBiasAssessmentAction(reviewId)
    } catch (err) {
      console.error('Failed to start risk of bias assessment', err)
      setIsRunningJob(false)
      setRunError('Could not start risk of bias assessment. Please try again.')
    }
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
      const updated = await rerunRiskOfBiasForPaper(reviewId, paperId)
      setRecords(prev => prev.map(r => (r.paperId === paperId ? updated : r)))
      await loadDetail(reviewId).catch(() => {})
      onSaved()
    } catch (err) {
      console.error('Failed to re-run risk of bias assessment for paper', err)
      // Most often "this paper has no text to read" — the API reports that with the fix in the
      // message, and swallowing it left the button spinning to no visible effect.
      const message = (err as { message?: string })?.message
      toast.error(message && message.trim().length > 0
        ? message
        : "Couldn't re-run this assessment for this paper.")
    } finally {
      setRerunningPaperId(null)
    }
  }

  const handleCycleRating = async (paperId: string, rating: RiskOfBiasDomainRating) => {
    const next = RATING_CYCLE[rating.rating]
    try {
      const updated = await updateRiskOfBiasRatingAction(reviewId, rating.id, next)
      setRecords(prev => prev.map(r =>
        r.paperId !== paperId ? r : { ...r, ratings: r.ratings.map(x => (x.id === rating.id ? updated : x)) },
      ))
      await loadDetail(reviewId).catch(() => {})
      onSaved()
    } catch (err) {
      console.error('Failed to override risk of bias rating', err)
    }
  }

  const handleSkip = async () => {
    await skipRiskOfBiasAction(reviewId)
    setPendingSkip(false)
    await loadDetail(reviewId).catch(() => {})
    onSaved()
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

  return (
    <div className="flex flex-col h-full bg-white">
      <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />
      <div className="flex-1 overflow-y-auto px-6 py-6 pb-20">
        <div className="mb-6">
          <h2 className="text-[20px] font-bold text-slate-900 mb-1">Risk of Bias Assessment</h2>
          <p className="text-[13px] text-slate-500">Evaluate methodological quality across Cochrane RoB 2 bias domains.</p>
        </div>

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
              abstract and no uploaded PDF, so there is nothing to assess against. Upload the PDF, or
              continue: the review will report {summary.noUsableText === 1 ? 'it' : 'them'} as not assessed.
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
          <div className="flex items-start gap-2.5 bg-amber-tint border border-amber-accent/40 rounded-xl px-4 py-3 mb-4">
            <AlertTriangle size={16} className="text-amber-text shrink-0 mt-0.5" />
            <p className="text-[12px] text-amber-text leading-relaxed">
              {summary.needsPdf} papers still need a PDF or abstract decision before they can be assessed — upload a
              PDF or use their abstract from the table below.
            </p>
          </div>
        )}

        {/* Action row */}
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={handleRunAssessment}
            disabled={isRunningJob || statusChecking}
            className="flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[13px] font-semibold transition-colors shadow-sm shadow-violet-200 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isRunningJob ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {isRunningJob
              ? `Assessing... ${runStatus?.done ?? 0}/${runStatus?.total ?? 0}`
              : 'Run RoB Assessment'}
          </button>
          <button
            onClick={() => setPendingSkip(true)}
            className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[12px] font-semibold transition-colors"
          >
            Skip this step
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
                    {DOMAINS.map(d => (
                      <th key={d.domain} className="px-4 py-3 font-semibold border-l border-slate-200 min-w-[200px]">{d.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.map(r => {
                    const hasUsableText = r.fullTextStatus === 'PdfUploaded' || r.useAbstractFallback
                    // A source decision is not source text: a paper opted into the abstract
                    // fallback can still carry no abstract at all, and nothing can assess it.
                    const hasNoText = r.fullTextStatus !== 'PdfUploaded' && r.abstract.trim().length === 0
                    const view = textView[r.paperId] ?? 'abstract'
                    return (
                      <tr key={r.paperId} className={cn('hover:bg-slate-50/50 transition-colors group border-l-4', OVERALL_BORDER[r.overall])}>
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
                            <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded', RATING_STYLE[r.overall])}>
                              {r.overall === 'Pending' ? 'Awaiting RoB assessment' : `${RATING_LABEL[r.overall]} risk`}
                            </span>
                            {hasNoText ? (
                              <span className="text-[10px] font-semibold bg-amber-tint text-amber-text px-2 py-0.5 rounded">
                                no abstract available &mdash; upload the PDF
                              </span>
                            ) : hasUsableText && (
                              <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
                                {r.useAbstractFallback ? 'Manually confirmed from the abstract' : 'Screened on full text'}
                              </span>
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
                                Re-run RoB
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

                        {DOMAINS.map(d => {
                          const rating = r.ratings.find(x => x.domain === d.domain)
                          if (!rating) return <td key={d.domain} className="px-4 py-4 align-top border-l border-slate-100" />
                          return (
                            <td key={d.domain} className="px-4 py-4 align-top border-l border-slate-100">
                              <button
                                onClick={() => handleCycleRating(r.paperId, rating)}
                                title={rating.aiRationale ?? 'Click to cycle: Low → Some concerns → High'}
                                className={cn(
                                  'inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded transition-opacity hover:opacity-80 cursor-pointer',
                                  RATING_STYLE[rating.rating],
                                )}
                              >
                                {rating.isManualOverride && <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />}
                                {RATING_LABEL[rating.rating]}
                              </button>
                              {rating.aiRationale && (
                                <p className="text-[11px] text-slate-500 mt-1 leading-snug">{rating.aiRationale}</p>
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
      </div>

      <AnimatePresence>
        {pendingSkip && (
          <ConfirmActionModal
            title="Skip risk of bias assessment?"
            message="You can advance to the next step without assessing risk of bias for these papers."
            confirmLabel="Skip step"
            onClose={() => setPendingSkip(false)}
            onConfirm={handleSkip}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
