import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Eye, EyeOff, Loader2, Scale, Search, Sparkles } from 'lucide-react'
import { cn, disambiguateLabels } from '../../lib/utils'
import { useSystematicReviewStore } from '../../store/systematicReviewStore'
import { useCreditGate } from '../../hooks/useCreditGate'
import { CREDIT_COSTS } from '../../config/creditCosts'
import { ScreeningVerdictBadge } from '../../components/app/ScreeningVerdictBadge'
import type {
  ScreeningAgreementRunStatus, ScreeningAgreementSummary, ScreeningRecord, ScreeningRunStatus,
  ScreeningSummary, ScreeningVerdict, SystematicReviewDetail,
} from '../../types/systematicReview'

interface TitleAbstractScreeningStepProps {
  reviewId: string
  detail:   SystematicReviewDetail
  onSaved:  () => void
}

const SOURCES = ['PubMed', 'OpenAlex', 'arXiv', 'Semantic Scholar', 'ClinicalTrials.gov', 'Scopus', 'Snowball']

const OVERALL_BORDER: Record<ScreeningRecord['overall'], string> = {
  Pending: 'border-l-slate-200',
  Included: 'border-l-green-accent',
  Excluded: 'border-l-red-400',
  NeedsManualReview: 'border-l-amber-accent',
}

// Standard Landis & Koch (1977) interpretation bands for Cohen's kappa.
function kappaInterpretation(kappa: number): { label: string; tone: string } {
  if (kappa < 0)    return { label: 'Poor agreement',            tone: 'text-red-600' }
  if (kappa < 0.2)  return { label: 'Slight agreement',          tone: 'text-red-600' }
  if (kappa < 0.4)  return { label: 'Fair agreement',            tone: 'text-amber-text' }
  if (kappa < 0.6)  return { label: 'Moderate agreement',        tone: 'text-amber-text' }
  if (kappa < 0.8)  return { label: 'Substantial agreement',     tone: 'text-green-text' }
  return                   { label: 'Almost perfect agreement',  tone: 'text-green-text' }
}

// ── Screening agreement check (dual-reviewer QA overlay) ────────────────────
// A read-only second-opinion pass, run on demand: an independent AI reviewer re-screens every
// already-resolved (paper, criterion) pair and this panel reports how often it agreed with the
// primary pass — Cohen's kappa is the standard inter-rater reliability statistic for exactly
// this two-rater, categorical-verdict setup. Disagreements are listed for manual reconciliation
// via the existing per-cell override in the table below; this panel never changes a verdict itself.
function AgreementCheckPanel({ reviewId }: { reviewId: string }) {
  const runScreeningAgreementCheck = useSystematicReviewStore(s => s.runScreeningAgreementCheck)
  const getScreeningAgreementRunStatus = useSystematicReviewStore(s => s.getScreeningAgreementRunStatus)
  const getScreeningAgreementSummary = useSystematicReviewStore(s => s.getScreeningAgreementSummary)
  const hasEnoughCredits = useCreditGate()

  const [expanded, setExpanded] = useState(false)
  const [summary, setSummary] = useState<ScreeningAgreementSummary | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [runStatus, setRunStatus] = useState<ScreeningAgreementRunStatus | null>(null)
  const [isRunningJob, setIsRunningJob] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const [showDisagreements, setShowDisagreements] = useState(false)

  const loadSummary = async () => {
    setLoadingSummary(true)
    try {
      setSummary(await getScreeningAgreementSummary(reviewId))
    } catch {
      // Non-fatal — the panel just shows no summary yet.
    } finally {
      setLoadingSummary(false)
    }
  }

  useEffect(() => {
    if (expanded && summary === null) loadSummary()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded])

  useEffect(() => {
    if (!isRunningJob) return
    let cancelled = false
    let timer: number | null = null
    const poll = async () => {
      try {
        const status = await getScreeningAgreementRunStatus(reviewId)
        if (cancelled) return
        setRunStatus(status)
        if (status.isRunning) {
          timer = window.setTimeout(poll, 2000)
        } else {
          setIsRunningJob(false)
          loadSummary()
        }
      } catch {
        if (!cancelled) timer = window.setTimeout(poll, 5000)
      }
    }
    poll()
    return () => { cancelled = true; if (timer) clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunningJob, reviewId])

  const handleRun = async () => {
    if (!hasEnoughCredits(CREDIT_COSTS.systematicReviewScreeningAgreementCheck)) return
    setRunError(null)
    try {
      setIsRunningJob(true)
      await runScreeningAgreementCheck(reviewId)
    } catch {
      setIsRunningJob(false)
      setRunError('Could not start the agreement check. Please try again.')
    }
  }

  return (
    <div className="border border-slate-200 rounded-xl mb-6 overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-slate-50/60 transition-colors text-left"
      >
        <Scale size={15} className="text-violet-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-[13px] font-bold text-slate-800">Agreement check</span>
          <span className="text-[11px] text-slate-400 ml-2">Independent second AI pass — measures inter-rater agreement</span>
        </div>
        {summary && (
          <span className="text-[11px] font-semibold text-slate-500 shrink-0 mr-1">
            {summary.percentAgreement}% agreement
            {summary.cohensKappa !== null && ` · κ = ${summary.cohensKappa}`}
          </span>
        )}
        {expanded ? <ChevronUp size={14} className="text-slate-400 shrink-0" /> : <ChevronDown size={14} className="text-slate-400 shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-100">
          <p className="text-[12px] text-slate-500 mb-3 mt-3 leading-relaxed">
            Re-screens every already-resolved paper/criterion pair with a fresh, independent AI reviewer that has
            not seen the first pass's verdicts, then compares the two. This is a QA signal, not a decision — it
            never changes an actual screening verdict.
          </p>

          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={handleRun}
              disabled={isRunningJob}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[12px] font-semibold transition-colors shadow-sm shadow-violet-200 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isRunningJob ? <Loader2 size={13} className="animate-spin" /> : <Scale size={13} />}
              {isRunningJob
                ? `Checking... ${runStatus?.done ?? 0}/${runStatus?.total ?? 0}`
                : summary ? 'Re-run agreement check' : 'Run agreement check'}
            </button>
            {loadingSummary && <Loader2 size={13} className="animate-spin text-slate-300" />}
          </div>

          {runError && (
            <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{runError}</p>
          )}

          {summary && summary.compared > 0 && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  <p className="text-[18px] font-bold text-slate-800 tabular-nums leading-none mb-1">{summary.compared}</p>
                  <p className="text-[10px] font-semibold text-slate-500">Pairs compared</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  <p className="text-[18px] font-bold text-slate-800 tabular-nums leading-none mb-1">{summary.percentAgreement}%</p>
                  <p className="text-[10px] font-semibold text-slate-500">Percent agreement</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  <p className="text-[18px] font-bold text-slate-800 tabular-nums leading-none mb-1">{summary.cohensKappa ?? '—'}</p>
                  <p className="text-[10px] font-semibold text-slate-500">Cohen's kappa</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  <p className="text-[18px] font-bold text-slate-800 tabular-nums leading-none mb-1">{summary.disagreements}</p>
                  <p className="text-[10px] font-semibold text-slate-500">Disagreements</p>
                </div>
              </div>

              {summary.cohensKappa !== null && (
                <p className={cn('text-[12px] font-semibold mb-4', kappaInterpretation(summary.cohensKappa).tone)}>
                  {kappaInterpretation(summary.cohensKappa).label} (Landis &amp; Koch scale)
                </p>
              )}

              {summary.disagreementList.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowDisagreements(v => !v)}
                    className="flex items-center gap-1 text-[12px] font-semibold text-violet-600 hover:text-violet-700 transition-colors mb-2"
                  >
                    {summary.disagreementList.length} disagreement{summary.disagreementList.length === 1 ? '' : 's'} to review
                    {showDisagreements ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                  {showDisagreements && (
                    <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-80 overflow-y-auto">
                      {summary.disagreementList.map(d => (
                        <div key={d.decisionId} className="px-3 py-2.5">
                          <p className="text-[12px] font-semibold text-slate-800 mb-0.5">{d.paperTitle}</p>
                          <p className="text-[11px] text-slate-500 mb-1.5">{d.criterionName}</p>
                          <div className="flex flex-wrap items-center gap-2 text-[11px]">
                            <span className="font-medium text-slate-600">Primary pass:</span>
                            <ScreeningVerdictBadge verdict={d.firstPassVerdict} isManualOverride={false} title={d.firstPassRationale ?? undefined} />
                            <span className="font-medium text-slate-600 ml-2">Second pass:</span>
                            <ScreeningVerdictBadge verdict={d.secondPassVerdict} isManualOverride={false} title={d.secondPassRationale ?? undefined} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {summary && summary.compared === 0 && (
            <p className="text-[12px] text-slate-400">
              No comparable pairs yet — run the agreement check after Title &amp; Abstract screening has resolved some papers.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function TitleAbstractScreeningStep({ reviewId, detail, onSaved }: TitleAbstractScreeningStepProps) {
  const getScreeningRecords = useSystematicReviewStore(s => s.getScreeningRecords)
  const runAiScreeningAction = useSystematicReviewStore(s => s.runAiScreening)
  const hasEnoughCredits = useCreditGate()
  const getScreeningRunStatus = useSystematicReviewStore(s => s.getScreeningRunStatus)
  const updateScreeningDecision = useSystematicReviewStore(s => s.updateScreeningDecision)
  const loadDetail = useSystematicReviewStore(s => s.loadDetail)

  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [sourceFilter, setSourceFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'needs-review'>('all')
  const [hideAbstract, setHideAbstract] = useState(false)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [records, setRecords] = useState<ScreeningRecord[]>([])
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState<ScreeningSummary | null>(detail.screeningSummary)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)

  const [runStatus, setRunStatus] = useState<ScreeningRunStatus | null>(null)
  const [isRunningJob, setIsRunningJob] = useState(false)
  const [statusChecking, setStatusChecking] = useState(true)
  const [runError, setRunError] = useState<string | null>(null)

  const [editingDecisionId, setEditingDecisionId] = useState<string | null>(null)

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => setDebouncedSearch(searchInput), 400)
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current) }
  }, [searchInput])

  const loadRecords = async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const res = await getScreeningRecords(reviewId, {
        search: debouncedSearch || undefined,
        source: sourceFilter === 'all' ? undefined : sourceFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
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
  }, [debouncedSearch, sourceFilter, statusFilter, page, pageSize, reviewId])

  // Poll AI screening run status — same shape as FetchPapersStep's fetch-status poll.
  useEffect(() => {
    let timer: number | null = null
    let cancelled = false
    const poll = async () => {
      try {
        const status = await getScreeningRunStatus(reviewId)
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
        console.error('Failed to poll screening status', err)
        if (!cancelled && isRunningJob) timer = window.setTimeout(poll, 5000)
      }
    }

    if (isRunningJob) {
      poll()
    } else {
      getScreeningRunStatus(reviewId).then(status => {
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

  const handleRunAiScreening = async () => {
    if (!hasEnoughCredits(CREDIT_COSTS.systematicReviewTitleAbstractScreening)) return
    setRunError(null)
    try {
      setIsRunningJob(true)
      await runAiScreeningAction(reviewId)
    } catch (err) {
      console.error('Failed to start AI screening', err)
      setIsRunningJob(false)
      setRunError('Could not start AI screening. Please try again.')
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

  const criteria = detail.criteria
  const criteriaLabels = useMemo(
    () => disambiguateLabels(criteria, c => c.name || c.type),
    [criteria],
  )

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex-1 overflow-y-auto px-6 py-6 pb-20">
        <div className="mb-6">
          <h2 className="text-[20px] font-bold text-slate-900 mb-1">Title &amp; Abstract Screening</h2>
          <p className="text-[13px] text-slate-500">Evaluate papers against eligibility criteria at the title and abstract level.</p>
        </div>

        {criteria.length === 0 ? (
          <div className="py-20 text-center border border-slate-200 border-dashed rounded-xl bg-slate-50/50">
            <p className="text-[14px] font-semibold text-slate-600 mb-1">No eligibility criteria defined yet.</p>
            <p className="text-[13px] text-slate-400">Go back to Eligibility Criteria to add at least one before screening.</p>
          </div>
        ) : (
          <>
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

              <div className="flex p-0.5 bg-slate-100 rounded-lg border border-slate-200">
                <button
                  onClick={() => { setStatusFilter('all'); setPage(1) }}
                  className={cn(
                    'px-3 py-1 text-[12px] font-medium rounded-md transition-all',
                    statusFilter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700',
                  )}
                >
                  All ({summary?.total ?? total})
                </button>
                <button
                  onClick={() => { setStatusFilter('needs-review'); setPage(1) }}
                  className={cn(
                    'px-3 py-1 text-[12px] font-medium rounded-md transition-all',
                    statusFilter === 'needs-review' ? 'bg-white text-amber-text shadow-sm' : 'text-slate-500 hover:text-slate-700',
                  )}
                >
                  Needs review ({summary?.needsManualReview ?? 0})
                </button>
              </div>

              <div className="flex-1" />
              <span className="text-[12px] text-slate-500 font-medium">Showing {records.length} of {total}</span>
            </div>

            {/* Action row */}
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={handleRunAiScreening}
                disabled={isRunningJob || statusChecking}
                className="flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[13px] font-semibold transition-colors shadow-sm shadow-violet-200 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isRunningJob ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {isRunningJob
                  ? `Screening... ${runStatus?.done ?? 0}/${runStatus?.total ?? 0}`
                  : `Run AI Screening (${summary?.pending ?? 0} unresolved)`}
              </button>

              <button
                onClick={() => setHideAbstract(v => !v)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[13px] font-semibold transition-colors"
              >
                {hideAbstract ? <Eye size={14} /> : <EyeOff size={14} />}
                {hideAbstract ? 'Show abstract' : 'Hide abstract'}
              </button>
            </div>

            {runError && (
              <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{runError}</p>
            )}

            <AgreementCheckPanel reviewId={reviewId} />

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
                <p className="text-[13px] text-slate-400">Papers ready for screening will appear here once fetched and deduplicated.</p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 font-semibold min-w-[280px]">Source Information</th>
                        {!hideAbstract && <th className="px-4 py-3 font-semibold border-l border-slate-200 min-w-[280px]">Abstract</th>}
                        {criteria.map(c => (
                          <th
                            key={c.id}
                            title={c.description}
                            className="px-4 py-3 font-semibold border-l border-slate-200 min-w-[160px]"
                          >
                            {criteriaLabels.get(c.id)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {records.map(r => (
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
                          {!hideAbstract && (
                            <td className="px-4 py-4 align-top border-l border-slate-100">
                              <p className="text-[12px] text-slate-600 leading-relaxed line-clamp-4">{r.abstract}</p>
                            </td>
                          )}
                          {criteria.map(c => {
                            const decision = r.decisions.find(d => d.criterionId === c.id)
                            if (!decision) return <td key={c.id} className="px-4 py-4 align-top border-l border-slate-100" />
                            const isEditing = editingDecisionId === decision.id
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
                              </td>
                            )
                          })}
                        </tr>
                      ))}
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
    </div>
  )
}
