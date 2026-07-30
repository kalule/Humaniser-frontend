import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Loader2, Sparkles } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useSystematicReviewStore } from '../../store/systematicReviewStore'
import { useCreditGate } from '../../hooks/useCreditGate'
import { CREDIT_COSTS } from '../../config/creditCosts'
import ConfirmActionModal from '../../components/app/ConfirmActionModal'
import type {
  EvidenceGradeRecord, EvidenceGradingRunStatus, EvidenceGradingSummary, GradeDomain,
  GradeDomainRating, GradeRating, GradeUpgradeFactor, GradeUpgradeRating, GradeUpgradeRatingRecord,
  SystematicReviewDetail,
} from '../../types/systematicReview'

interface EvidenceGradingStepProps {
  reviewId: string
  detail:   SystematicReviewDetail
  onSaved:  () => void
}

const DOMAINS: { domain: GradeDomain; label: string }[] = [
  { domain: 'RiskOfBias',      label: 'Risk of bias' },
  { domain: 'Inconsistency',   label: 'Inconsistency' },
  { domain: 'Indirectness',    label: 'Indirectness' },
  { domain: 'Imprecision',     label: 'Imprecision' },
  { domain: 'PublicationBias', label: 'Publication bias' },
]

// Click-to-cycle order — Pending (not yet assessed) advances straight to NotSerious on first
// click, then cycles through the four real ratings.
const RATING_CYCLE: Record<GradeRating, GradeRating> = {
  Pending: 'NotSerious', NotSerious: 'Serious', Serious: 'VerySerious', VerySerious: 'Unclear', Unclear: 'NotSerious',
}

const RATING_STYLE: Record<GradeRating, string> = {
  Pending:     'bg-slate-100 text-slate-500',
  NotSerious:  'bg-green-100 text-green-700',
  Serious:     'bg-amber-tint text-amber-text',
  VerySerious: 'bg-red-100 text-red-700',
  Unclear:     'bg-slate-100 text-slate-500',
}

const RATING_LABEL: Record<GradeRating, string> = {
  Pending: 'Not assessed', NotSerious: 'Not serious', Serious: 'Serious', VerySerious: 'Very serious', Unclear: 'Unclear',
}

const CERTAINTY_STYLE: Record<EvidenceGradeRecord['overall'], string> = {
  Pending:  'bg-slate-100 text-slate-500',
  VeryLow:  'bg-red-100 text-red-700',
  Low:      'bg-amber-tint text-amber-text',
  Moderate: 'bg-violet-100 text-violet-700',
  High:     'bg-green-100 text-green-700',
}

const CERTAINTY_LABEL: Record<EvidenceGradeRecord['overall'], string> = {
  Pending: 'Pending', VeryLow: 'Very low', Low: 'Low', Moderate: 'Moderate', High: 'High',
}

const CERTAINTY_BORDER: Record<EvidenceGradeRecord['overall'], string> = {
  Pending:  'border-l-slate-200',
  VeryLow:  'border-l-red-400',
  Low:      'border-l-amber-accent',
  Moderate: 'border-l-violet-400',
  High:     'border-l-green-accent',
}

// GRADE's upgrading factors — only shown for reviews using ROBINS-I (see
// SystematicReviewDetail.riskOfBiasTool), since RCT evidence starts at High certainty and has
// nothing to upgrade from.
const UPGRADE_FACTORS: { factor: GradeUpgradeFactor; label: string }[] = [
  { factor: 'LargeEffect',                  label: 'Large effect' },
  { factor: 'DoseResponseGradient',         label: 'Dose-response gradient' },
  { factor: 'OpposingPlausibleConfounding', label: 'Opposing confounding' },
]

// Two-state cycle (unlike the four-state downgrade cycle) — GRADE only recognizes Present/Absent
// for upgrade factors, with Pending advancing straight to Present on first click.
const UPGRADE_RATING_CYCLE: Record<GradeUpgradeRating, GradeUpgradeRating> = {
  Pending: 'Present', Present: 'Absent', Absent: 'Present',
}

const UPGRADE_RATING_STYLE: Record<GradeUpgradeRating, string> = {
  Pending: 'bg-slate-100 text-slate-500',
  Present: 'bg-green-100 text-green-700',
  Absent:  'bg-slate-100 text-slate-500',
}

const UPGRADE_RATING_LABEL: Record<GradeUpgradeRating, string> = {
  Pending: 'Not assessed', Present: 'Present', Absent: 'Absent',
}

export default function EvidenceGradingStep({ reviewId, detail, onSaved }: EvidenceGradingStepProps) {
  const getEvidenceGradingRecords = useSystematicReviewStore(s => s.getEvidenceGradingRecords)
  const runEvidenceGradingAction = useSystematicReviewStore(s => s.runEvidenceGrading)
  const hasEnoughCredits = useCreditGate()
  const getEvidenceGradingRunStatus = useSystematicReviewStore(s => s.getEvidenceGradingRunStatus)
  const updateGradeRatingAction = useSystematicReviewStore(s => s.updateGradeRating)
  const updateGradeUpgradeRatingAction = useSystematicReviewStore(s => s.updateGradeUpgradeRating)
  const skipEvidenceGradingAction = useSystematicReviewStore(s => s.skipEvidenceGrading)
  const loadDetail = useSystematicReviewStore(s => s.loadDetail)

  const [records, setRecords] = useState<EvidenceGradeRecord[]>([])
  const [summary, setSummary] = useState<EvidenceGradingSummary | null>(detail.evidenceGradingSummary)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)

  const [runStatus, setRunStatus] = useState<EvidenceGradingRunStatus | null>(null)
  const [isRunningJob, setIsRunningJob] = useState(false)
  const [statusChecking, setStatusChecking] = useState(true)
  const [runError, setRunError] = useState<string | null>(null)
  const [pendingSkip, setPendingSkip] = useState(false)

  const loadRecords = async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const res = await getEvidenceGradingRecords(reviewId)
      setRecords(res.items)
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
  }, [reviewId])

  // Poll evidence grading run status — same shape as RiskOfBiasStep's poll.
  useEffect(() => {
    let timer: number | null = null
    let cancelled = false
    const poll = async () => {
      try {
        const status = await getEvidenceGradingRunStatus(reviewId)
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
        console.error('Failed to poll evidence grading status', err)
        if (!cancelled && isRunningJob) timer = window.setTimeout(poll, 5000)
      }
    }

    if (isRunningJob) {
      poll()
    } else {
      getEvidenceGradingRunStatus(reviewId).then(status => {
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

  const handleRunGrading = async () => {
    if (!hasEnoughCredits(CREDIT_COSTS.systematicReviewEvidenceGrading)) return
    setRunError(null)
    try {
      setIsRunningJob(true)
      await runEvidenceGradingAction(reviewId)
    } catch (err) {
      console.error('Failed to start evidence grading', err)
      setIsRunningJob(false)
      setRunError('Could not start evidence grading. Please try again.')
    }
  }

  const handleCycleRating = async (outcomeId: string, rating: GradeDomainRating) => {
    const next = RATING_CYCLE[rating.rating]
    try {
      const updated = await updateGradeRatingAction(reviewId, rating.id, next)
      setRecords(prev => prev.map(r =>
        r.outcomeVariableId !== outcomeId ? r : { ...r, ratings: r.ratings.map(x => (x.id === rating.id ? updated : x)) },
      ))
      await loadDetail(reviewId).catch(() => {})
      onSaved()
    } catch (err) {
      console.error('Failed to override grade rating', err)
    }
  }

  const handleCycleUpgradeRating = async (outcomeId: string, rating: GradeUpgradeRatingRecord) => {
    const next = UPGRADE_RATING_CYCLE[rating.rating]
    try {
      const updated = await updateGradeUpgradeRatingAction(reviewId, rating.id, next)
      setRecords(prev => prev.map(r =>
        r.outcomeVariableId !== outcomeId ? r : { ...r, upgradeRatings: r.upgradeRatings.map(x => (x.id === rating.id ? updated : x)) },
      ))
      await loadDetail(reviewId).catch(() => {})
      onSaved()
    } catch (err) {
      console.error('Failed to override grade upgrade rating', err)
    }
  }

  const handleSkip = async () => {
    await skipEvidenceGradingAction(reviewId)
    setPendingSkip(false)
    await loadDetail(reviewId).catch(() => {})
    onSaved()
  }

  const hasRun = summary !== null && summary.totalOutcomes > 0 && summary.pending < summary.totalOutcomes
  const isObservational = detail.riskOfBiasTool === 'RobinsI'

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex-1 overflow-y-auto px-6 py-6 pb-20">
        <div className="mb-6">
          <h2 className="text-[20px] font-bold text-slate-900 mb-1">Evidence Grading</h2>
          <p className="text-[13px] text-slate-500">Assess certainty of evidence per outcome across the included studies.</p>
        </div>

        <div className="border border-slate-200 rounded-xl p-4 mb-4 bg-slate-50/50">
          {records.length > 0 ? (
            <>
              <p className="text-[13px] font-semibold text-slate-700">{records.length} outcome{records.length === 1 ? '' : 's'} ready for grading</p>
              <p className="text-[12px] text-slate-500 mt-0.5">Outcomes render in the comparison table below once grading data is available.</p>
            </>
          ) : (
            <>
              <p className="text-[13px] font-semibold text-slate-700">No outcomes flagged for grading yet</p>
              <p className="text-[12px] text-slate-500 mt-0.5">
                Go to Data Extraction and click the checkmark on a variable to flag it as an outcome — flagged
                variables become the rows graded here.
              </p>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={handleRunGrading}
            disabled={isRunningJob || statusChecking || records.length === 0}
            className="flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[13px] font-semibold transition-colors shadow-sm shadow-violet-200 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isRunningJob ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {isRunningJob
              ? `Grading... ${runStatus?.done ?? 0}/${runStatus?.total ?? 0}`
              : hasRun ? 'Re-run Evidence Grading' : 'Run Evidence Grading'}
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

        {loading ? (
          <div className="py-20 flex justify-center"><Loader2 size={24} className="animate-spin text-slate-300" /></div>
        ) : loadError ? (
          <div className="py-12 text-center border border-red-200 bg-red-50 rounded-xl">
            <p className="text-[13px] text-red-600 font-medium">Error loading outcomes. The backend might not be available.</p>
          </div>
        ) : records.length === 0 ? null : (
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 font-semibold min-w-[240px]">Outcome</th>
                    <th className="px-4 py-3 font-semibold border-l border-slate-200 min-w-[100px]">Studies</th>
                    {DOMAINS.map(d => (
                      <th key={d.domain} className="px-4 py-3 font-semibold border-l border-slate-200 min-w-[180px]">{d.label}</th>
                    ))}
                    {isObservational && UPGRADE_FACTORS.map(f => (
                      <th key={f.factor} className="px-4 py-3 font-semibold border-l border-slate-200 min-w-[180px]">{f.label}</th>
                    ))}
                    <th className="px-4 py-3 font-semibold border-l border-slate-200 min-w-[140px]">Certainty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.map(r => (
                    <tr key={r.outcomeVariableId} className={cn('hover:bg-slate-50/50 transition-colors group border-l-4', CERTAINTY_BORDER[r.overall])}>
                      <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50/50 px-4 py-4 align-top">
                        <p className="text-[13px] font-bold text-slate-900">{r.outcomeName}</p>
                      </td>
                      <td className="px-4 py-4 align-top border-l border-slate-100 text-[13px] text-slate-700 font-semibold">
                        {r.studyCount}
                      </td>
                      {DOMAINS.map(d => {
                        const rating = r.ratings.find(x => x.domain === d.domain)
                        if (!rating) return <td key={d.domain} className="px-4 py-4 align-top border-l border-slate-100" />
                        return (
                          <td key={d.domain} className="px-4 py-4 align-top border-l border-slate-100">
                            <button
                              onClick={() => handleCycleRating(r.outcomeVariableId, rating)}
                              title={rating.aiRationale ?? 'Click to cycle: Not serious → Serious → Very serious → Unclear'}
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
                      {isObservational && UPGRADE_FACTORS.map(f => {
                        const rating = r.upgradeRatings.find(x => x.factor === f.factor)
                        if (!rating) return <td key={f.factor} className="px-4 py-4 align-top border-l border-slate-100" />
                        return (
                          <td key={f.factor} className="px-4 py-4 align-top border-l border-slate-100">
                            <button
                              onClick={() => handleCycleUpgradeRating(r.outcomeVariableId, rating)}
                              title={rating.aiRationale ?? 'Click to toggle: Present ↔ Absent'}
                              className={cn(
                                'inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded transition-opacity hover:opacity-80 cursor-pointer',
                                UPGRADE_RATING_STYLE[rating.rating],
                              )}
                            >
                              {rating.isManualOverride && <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />}
                              {UPGRADE_RATING_LABEL[rating.rating]}
                            </button>
                            {rating.aiRationale && (
                              <p className="text-[11px] text-slate-500 mt-1 leading-snug">{rating.aiRationale}</p>
                            )}
                          </td>
                        )
                      })}
                      <td className="px-4 py-4 align-top border-l border-slate-100">
                        <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded', CERTAINTY_STYLE[r.overall])}>
                          {CERTAINTY_LABEL[r.overall]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {pendingSkip && (
          <ConfirmActionModal
            title="Skip evidence grading?"
            message="You can advance to the next step without grading certainty of evidence for these outcomes."
            confirmLabel="Skip step"
            onClose={() => setPendingSkip(false)}
            onConfirm={handleSkip}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
