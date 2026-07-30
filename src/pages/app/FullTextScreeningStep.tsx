import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { AlertTriangle, ChevronDown, ChevronUp, Loader2, Search, Sparkles, Upload } from 'lucide-react'
import { cn, disambiguateLabels } from '../../lib/utils'
import { useSystematicReviewStore } from '../../store/systematicReviewStore'
import { useCreditGate } from '../../hooks/useCreditGate'
import { CREDIT_COSTS } from '../../config/creditCosts'
import ConfirmActionModal from '../../components/app/ConfirmActionModal'
import { ScreeningVerdictBadge } from '../../components/app/ScreeningVerdictBadge'
import type {
  FullTextScreeningFilter, FullTextScreeningRecord, FullTextScreeningRunStatus,
  FullTextScreeningSummary, OverallScreeningDecision, ScreeningVerdict, SystematicReviewDetail,
} from '../../types/systematicReview'

interface FullTextScreeningStepProps {
  reviewId: string
  detail:   SystematicReviewDetail
  onSaved:  () => void
}

const SOURCES = ['PubMed', 'OpenAlex', 'arXiv', 'Semantic Scholar', 'ClinicalTrials.gov', 'Scopus', 'Snowball']

const OVERALL_BADGE: Record<OverallScreeningDecision, string> = {
  Pending:           'bg-slate-100 text-slate-500',
  Included:          'bg-green-100 text-green-700',
  Excluded:          'bg-red-100 text-red-700',
  NeedsManualReview: 'bg-amber-tint text-amber-text',
}

const OVERALL_LABEL: Record<OverallScreeningDecision, string> = {
  Pending: 'Pending', Included: 'Included', Excluded: 'Excluded', NeedsManualReview: 'Manual',
}

const OVERALL_BORDER: Record<OverallScreeningDecision, string> = {
  Pending: 'border-l-slate-200',
  Included: 'border-l-green-accent',
  Excluded: 'border-l-red-400',
  NeedsManualReview: 'border-l-amber-accent',
}

const FILTER_CHIPS: { id: FullTextScreeningFilter; label: (s: FullTextScreeningSummary | null, total: number) => string; activeClass: string }[] = [
  { id: 'all',          label: (s, total) => `All (${s?.total ?? total})`,            activeClass: 'bg-violet-600 border-violet-600 text-white' },
  { id: 'needsPdf',     label: s => `Needs PDF (${s?.needsPdf ?? 0})`,                 activeClass: 'bg-amber-accent border-amber-accent text-white' },
  { id: 'abstractOnly', label: s => `Abstract only (${s?.abstractOnly ?? 0})`,         activeClass: 'bg-slate-600 border-slate-600 text-white' },
  { id: 'included',     label: s => `${s?.included ?? 0} included`,                   activeClass: 'bg-green-accent border-green-accent text-white' },
  { id: 'excluded',     label: s => `${s?.excluded ?? 0} excluded`,                    activeClass: 'bg-red-400 border-red-400 text-white' },
]

export default function FullTextScreeningStep({ reviewId, detail, onSaved }: FullTextScreeningStepProps) {
  const getFullTextScreeningRecords = useSystematicReviewStore(s => s.getFullTextScreeningRecords)
  const uploadPdfAction = useSystematicReviewStore(s => s.uploadPdf)
  const applyAbstractFallback = useSystematicReviewStore(s => s.useAbstractFallback)
  const applyAbstractFallbackForAll = useSystematicReviewStore(s => s.useAbstractFallbackForAll)
  const runFullTextScreeningAction = useSystematicReviewStore(s => s.runFullTextScreening)
  const hasEnoughCredits = useCreditGate()
  const getFullTextScreeningRunStatus = useSystematicReviewStore(s => s.getFullTextScreeningRunStatus)
  const getPaperFullTextAction = useSystematicReviewStore(s => s.getPaperFullText)
  const updateScreeningDecision = useSystematicReviewStore(s => s.updateScreeningDecision)
  const loadDetail = useSystematicReviewStore(s => s.loadDetail)

  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [sourceFilter, setSourceFilter] = useState('all')
  const [filter, setFilter] = useState<FullTextScreeningFilter>('all')

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [records, setRecords] = useState<FullTextScreeningRecord[]>([])
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState<FullTextScreeningSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)

  const [runStatus, setRunStatus] = useState<FullTextScreeningRunStatus | null>(null)
  const [isRunningJob, setIsRunningJob] = useState(false)
  const [statusChecking, setStatusChecking] = useState(true)
  const [runError, setRunError] = useState<string | null>(null)

  const [editingDecisionId, setEditingDecisionId] = useState<string | null>(null)
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set())
  const [expandedDetails, setExpandedDetails] = useState<Set<string>>(new Set())
  const [textView, setTextView] = useState<Record<string, 'abstract' | 'fullText'>>({})
  const [fullTextCache, setFullTextCache] = useState<Record<string, string | null>>({})
  const [fullTextLoading, setFullTextLoading] = useState<Set<string>>(new Set())

  const [uploadingPaperId, setUploadingPaperId] = useState<string | null>(null)
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({})
  const [pendingUploadPaperId, setPendingUploadPaperId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingBulkFallback, setPendingBulkFallback] = useState(false)

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => setDebouncedSearch(searchInput), 400)
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current) }
  }, [searchInput])

  const loadRecords = async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const res = await getFullTextScreeningRecords(reviewId, {
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

  // Poll AI screening run status — same shape as TitleAbstractScreeningStep's poll.
  useEffect(() => {
    let timer: number | null = null
    let cancelled = false
    const poll = async () => {
      try {
        const status = await getFullTextScreeningRunStatus(reviewId)
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
        console.error('Failed to poll full text screening status', err)
        if (!cancelled && isRunningJob) timer = window.setTimeout(poll, 5000)
      }
    }

    if (isRunningJob) {
      poll()
    } else {
      getFullTextScreeningRunStatus(reviewId).then(status => {
        if (cancelled) return
        setRunStatus(status)
        if (status.isRunning) setIsRunningJob(true)
      }).catch(() => {}).finally(() => {
        if (!cancelled) setStatusChecking(false)
      })
    }

    return () => { cancelled = true; if (timer) clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunningJob, reviewId])

  const handleRunFullTextScreening = async () => {
    if (!hasEnoughCredits(CREDIT_COSTS.systematicReviewFullTextScreening)) return
    setRunError(null)
    try {
      setIsRunningJob(true)
      await runFullTextScreeningAction(reviewId)
    } catch (err) {
      console.error('Failed to start full text screening', err)
      setIsRunningJob(false)
      setRunError('Could not start full text screening. Please try again.')
    }
  }

  const handleOverride = async (decisionId: string, verdict: ScreeningVerdict) => {
    setEditingDecisionId(null)
    try {
      await updateScreeningDecision(reviewId, decisionId, verdict)
      await loadRecords()
      await loadDetail(reviewId).catch(() => {})
      onSaved()
    } catch (err) {
      console.error('Failed to override decision', err)
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

  const handleBulkFallback = async () => {
    try {
      await applyAbstractFallbackForAll(reviewId)
      setPendingBulkFallback(false)
      await loadRecords()
      await loadDetail(reviewId).catch(() => {})
      onSaved()
    } catch (err) {
      console.error('Failed to apply bulk abstract fallback', err)
      setPendingBulkFallback(false)
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

  const toggleSourcesExpand = (decisionId: string) => {
    setExpandedSources(prev => {
      const next = new Set(prev)
      if (next.has(decisionId)) next.delete(decisionId); else next.add(decisionId)
      return next
    })
  }

  const toggleDetailsExpand = (paperId: string) => {
    setExpandedDetails(prev => {
      const next = new Set(prev)
      if (next.has(paperId)) next.delete(paperId); else next.add(paperId)
      return next
    })
  }

  const criteria = detail.criteria
  const criteriaLabels = useMemo(
    () => disambiguateLabels(criteria, c => c.name || c.type),
    [criteria],
  )
  const resolvedCount = summary ? summary.included + summary.excluded + summary.needsManualReview : 0
  const accountedFor = summary ? resolvedCount + summary.needsPdf : 0
  const progressPct = summary && summary.total > 0 ? Math.round((accountedFor / summary.total) * 100) : 0
  const unresolvedUsable = runStatus ? Math.max(0, runStatus.total - runStatus.done - runStatus.skipped) : 0

  return (
    <div className="flex flex-col h-full bg-white">
      <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />
      <div className="flex-1 overflow-y-auto px-6 py-6 pb-20">
        <div className="mb-6">
          <h2 className="text-[20px] font-bold text-slate-900 mb-1">Full Text Screening</h2>
          <p className="text-[13px] text-slate-500">
            Resolved {resolvedCount} of {summary?.total ?? total} papers · {summary?.needsPdf ?? 0} need a PDF or abstract decision
          </p>
        </div>

        {criteria.length === 0 ? (
          <div className="py-20 text-center border border-slate-200 border-dashed rounded-xl bg-slate-50/50">
            <p className="text-[14px] font-semibold text-slate-600 mb-1">No eligibility criteria defined yet.</p>
            <p className="text-[13px] text-slate-400">Go back to Eligibility Criteria to add at least one before screening.</p>
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

            {/* PDF-unavailable warning banner */}
            {summary && summary.needsPdf > 0 && (
              <div className="flex items-start justify-between gap-4 bg-amber-tint border border-amber-accent/40 rounded-xl px-4 py-3 mb-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="text-amber-text shrink-0 mt-0.5" />
                  <p className="text-[12px] text-amber-text leading-relaxed">
                    We couldn't access the PDF for {summary.needsPdf} papers during screening. Upload PDFs from the main
                    table below to use their full text, or use abstracts for those papers instead.
                  </p>
                </div>
                <button
                  onClick={() => setPendingBulkFallback(true)}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-white border border-amber-accent/40 text-amber-text text-[12px] font-semibold hover:bg-amber-tint/60 transition-colors whitespace-nowrap"
                >
                  Use abstract for all {summary.needsPdf}
                </button>
              </div>
            )}

            {/* Action row */}
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={handleRunFullTextScreening}
                disabled={isRunningJob || statusChecking}
                className="flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[13px] font-semibold transition-colors shadow-sm shadow-violet-200 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isRunningJob ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {isRunningJob
                  ? `Screening... ${runStatus?.done ?? 0}/${runStatus?.total ?? 0}`
                  : `Run Full Text Screening (${unresolvedUsable} unresolved)`}
              </button>
            </div>

            <p className="text-[12px] text-slate-500 mb-2">
              {resolvedCount} resolved · {summary?.included ?? 0} included · {summary?.excluded ?? 0} excluded · {summary?.needsPdf ?? 0} need PDF decision
            </p>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-6">
              <div className="h-full bg-violet-500 transition-all" style={{ width: `${progressPct}%` }} />
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
                <p className="text-[13px] text-slate-400">Papers included by Title &amp; Abstract screening will appear here.</p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 font-semibold min-w-[280px]">Source Information</th>
                        <th className="px-4 py-3 font-semibold border-l border-slate-200 min-w-[320px]">Evidence</th>
                        {criteria.map(c => (
                          <th
                            key={c.id}
                            title={c.description}
                            className="px-4 py-3 font-semibold border-l border-slate-200 min-w-[200px]"
                          >
                            {criteriaLabels.get(c.id)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {records.map(r => {
                        const hasUsableText = r.fullTextStatus === 'PdfUploaded' || r.useAbstractFallback
                        const matchCount = r.decisions.filter(d => d.verdict === 'Match').length
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
                              {!hasUsableText ? (
                                <>
                                  <div className="flex flex-wrap gap-1.5 mb-2">
                                    <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded">Manual</span>
                                    <span className="text-[10px] font-semibold bg-amber-tint text-amber-text px-2 py-0.5 rounded">needs PDF upload</span>
                                  </div>
                                  <p className="text-[12px] text-slate-600 leading-relaxed mb-3">
                                    Full-text unavailable for '{r.title}': none of the candidate PDF URLs could be
                                    downloaded. Upload a PDF to continue, or use abstract screening for this paper.
                                  </p>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <button disabled className="px-2.5 py-1 rounded-md border border-slate-200 text-slate-300 text-[11px] font-semibold cursor-not-allowed">
                                      Abstract
                                    </button>
                                    <button disabled className="px-2.5 py-1 rounded-md border border-slate-200 text-slate-300 text-[11px] font-semibold cursor-not-allowed">
                                      Full text
                                    </button>
                                    <button
                                      onClick={() => handleUseAbstractFallback(r.paperId)}
                                      className="text-[11px] font-medium text-violet-500 hover:text-violet-700 transition-colors"
                                    >
                                      Use abstract instead
                                    </button>
                                    <button
                                      onClick={() => handleUploadClick(r.paperId)}
                                      disabled={uploadingPaperId === r.paperId}
                                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-semibold transition-colors disabled:opacity-60"
                                    >
                                      {uploadingPaperId === r.paperId ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
                                      Upload PDF
                                    </button>
                                  </div>
                                  {uploadErrors[r.paperId] && (
                                    <p className="text-[11px] text-red-600 mt-1.5">{uploadErrors[r.paperId]}</p>
                                  )}
                                </>
                              ) : (
                                <>
                                  <div className="flex flex-wrap gap-1.5 mb-2">
                                    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded', OVERALL_BADGE[r.overall])}>
                                      {OVERALL_LABEL[r.overall]}
                                    </span>
                                    <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
                                      screened by {r.fullTextStatus === 'PdfUploaded' ? 'full text' : 'abstract'}
                                    </span>
                                    <span className="text-[10px] font-semibold bg-amber-tint text-amber-text px-2 py-0.5 rounded">
                                      {matchCount}/{criteria.length} criteria met
                                    </span>
                                  </div>

                                  <p className="text-[12px] text-slate-600 leading-relaxed line-clamp-4 mb-2">
                                    {view === 'fullText'
                                      ? (fullTextLoading.has(r.paperId) ? 'Loading full text…' : (fullTextCache[r.paperId] ?? 'Full text not available.'))
                                      : r.abstract}
                                  </p>

                                  <div className="flex items-center gap-1.5 mb-1.5">
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

                                  <button
                                    onClick={() => toggleDetailsExpand(r.paperId)}
                                    className="flex items-center gap-1 text-[11px] font-medium text-violet-500 hover:text-violet-700 transition-colors"
                                  >
                                    View criteria details {expandedDetails.has(r.paperId) ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                  </button>

                                  {expandedDetails.has(r.paperId) && (
                                    <div className="mt-2 space-y-2 border-t border-slate-100 pt-2">
                                      {r.decisions.map(d => (
                                        <div key={d.id} className="text-[11px]">
                                          <ScreeningVerdictBadge verdict={d.verdict} isManualOverride={d.isManualOverride} prefix={d.criterionName} />
                                          {d.aiRationale && <p className="text-slate-500 mt-0.5">{d.aiRationale}</p>}
                                          {d.evidenceSpans.length > 0 && (
                                            <ul className="mt-0.5 space-y-0.5 pl-3 list-disc text-slate-400">
                                              {d.evidenceSpans.map(e => (
                                                <li key={e.id}>&ldquo;{e.quote}&rdquo;{e.location ? ` (${e.location})` : ''}</li>
                                              ))}
                                            </ul>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </>
                              )}
                            </td>

                            {criteria.map(c => {
                              const decision = r.decisions.find(d => d.criterionId === c.id)
                              if (!decision) return <td key={c.id} className="px-4 py-4 align-top border-l border-slate-100" />
                              const isEditing = editingDecisionId === decision.id
                              const sourcesExpanded = expandedSources.has(decision.id)
                              return (
                                <td key={c.id} className="px-4 py-4 align-top border-l border-slate-100">
                                  {isEditing ? (
                                    <select
                                      autoFocus
                                      defaultValue={decision.verdict}
                                      onBlur={() => setEditingDecisionId(null)}
                                      onChange={e => handleOverride(decision.id, e.target.value as ScreeningVerdict)}
                                      className="border border-violet-300 rounded-md px-1.5 py-1 text-[11px] font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-violet-100"
                                    >
                                      <option value="Match">Match</option>
                                      <option value="NoMatch">No Match</option>
                                      <option value="Uncertain">Uncertain</option>
                                    </select>
                                  ) : (
                                    <ScreeningVerdictBadge
                                      verdict={decision.verdict}
                                      isManualOverride={decision.isManualOverride}
                                      title={decision.aiRationale ?? undefined}
                                      aiModel={decision.aiModel}
                                      onClick={() => setEditingDecisionId(decision.id)}
                                    />
                                  )}

                                  {decision.aiRationale && (
                                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">{decision.aiRationale}</p>
                                  )}

                                  {decision.evidenceSpans.length > 0 && (
                                    <button
                                      onClick={() => toggleSourcesExpand(decision.id)}
                                      className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-violet-500 hover:text-violet-700 transition-colors"
                                    >
                                      {decision.evidenceSpans.length} sources {sourcesExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                                    </button>
                                  )}

                                  {sourcesExpanded && (
                                    <ul className="mt-1 space-y-1 text-[10px] text-slate-500 border-l-2 border-violet-100 pl-2">
                                      {decision.evidenceSpans.map(e => (
                                        <li key={e.id}>
                                          &ldquo;{e.quote}&rdquo;
                                          {e.location && <span className="text-slate-400"> — {e.location}</span>}
                                        </li>
                                      ))}
                                    </ul>
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
        {pendingBulkFallback && summary && (
          <ConfirmActionModal
            title="Screen the remaining papers by abstract?"
            message={`This will screen ${summary.needsPdf} papers using their abstract instead of full text — continue?`}
            confirmLabel="Use abstract for all"
            onClose={() => setPendingBulkFallback(false)}
            onConfirm={handleBulkFallback}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
