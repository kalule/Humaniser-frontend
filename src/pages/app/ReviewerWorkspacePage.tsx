import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, AlertCircle, AlertTriangle, Info, CheckCircle2, XCircle, RefreshCw, Mail,
  ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, Loader2, FileText, FileDown, Sparkles,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { cn, downloadBlob } from '../../lib/utils'
import { reviewerApi } from '../../api/reviewer'
import { researchApi } from '../../api/research'
import { generateReviewReportText, reviewReportFilename } from '../../lib/reviewerExport'
import { ScoreBar } from '../../components/ui/ScoreBar'
import { OutputActionButton } from '../../components/ui/OutputActionButton'
import { ReadinessGauge } from '../../components/reviewer/ReadinessGauge'
import { SectionFixDiffModal } from '../../components/research-agent/SectionFixDiffModal'
import {
  categoryColor, CATEGORY_DESCRIPTIONS, OVERVIEW_DESCRIPTION, OVERVIEW_LABEL,
  READINESS_LABEL, CRITERIA_LABEL, isOverviewCategory,
} from '../../config/reviewerCategories'
import type { DocumentReview, FindingFixEligibility, ReviewFinding, ReviewVerdict, Severity } from '../../types/reviewer'
import type { SectionFixPreview } from '../../types/research'

const OVERVIEW_VIEW = '__overview__'

const SEVERITY_ORDER: Record<Severity, number> = { Critical: 0, Warning: 1, Info: 2, Positive: 3 }

const SEVERITY_STYLES: Record<Severity, { badge: string; icon: React.ReactNode }> = {
  Critical: { badge: 'bg-red-100 text-red-700', icon: <AlertCircle size={12} /> },
  Warning:  { badge: 'bg-amber-tint text-amber-text', icon: <AlertTriangle size={12} /> },
  Info:     { badge: 'bg-sky-100 text-sky-700', icon: <Info size={12} /> },
  Positive: { badge: 'bg-green-100 text-green-700', icon: <CheckCircle2 size={12} /> },
}

const VERDICT_CONFIG: Record<ReviewVerdict, { label: string; cls: string; Icon: React.ElementType }> = {
  Accept: { label: 'Accept',           cls: 'bg-green-50 text-green-700 border-green-200', Icon: CheckCircle2 },
  Revise: { label: 'Revise & Resubmit', cls: 'bg-amber-50 text-amber-700 border-amber-200', Icon: AlertTriangle },
  Reject: { label: 'Reject',           cls: 'bg-red-50 text-red-700 border-red-200',       Icon: XCircle },
}

function scoreColor(score: number): string {
  return score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-amber-400' : 'bg-red-400'
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function VerdictBadge({ verdict }: { verdict: ReviewVerdict }) {
  const { label, cls, Icon } = VERDICT_CONFIG[verdict]
  return (
    <div className={cn('inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium', cls)}>
      <Icon size={15} />
      {label}
    </div>
  )
}

function CollapsibleSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between mb-2 text-left"
      >
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{title}</p>
        {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
      </button>
      {open && children}
    </div>
  )
}

function FindingCard({ finding, index, color, feedback, onFeedback, eligibility, isApplyingFix, onFixThis }: {
  finding:       ReviewFinding
  index:         number
  color:         string
  feedback:      'up' | 'down' | undefined
  onFeedback:    (value: 'up' | 'down') => void
  eligibility:   FindingFixEligibility | undefined
  isApplyingFix: boolean
  onFixThis:     (sectionCode: string) => void
}) {
  const style = SEVERITY_STYLES[finding.severity]
  const canFix = Boolean(eligibility?.sectionCode) && !eligibility?.resolved
  return (
    <div className={cn('border rounded-xl p-4 transition-colors', eligibility?.resolved ? 'border-slate-100 bg-slate-50' : 'border-slate-200 bg-white')}>
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
          style={{ background: eligibility?.resolved ? '#94a3b8' : color }}
        >
          {index + 1}
        </div>
        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold', style.badge)}>
          {style.icon} {finding.severity}
        </span>
        {eligibility?.resolved && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-200 text-slate-600">
            <CheckCircle2 size={12} /> Fix applied
          </span>
        )}
        {finding.pageReference && (
          <span className="ml-auto text-[11px] font-medium text-orange-600 hover:text-orange-700 transition-colors">
            View on {finding.pageReference}
          </span>
        )}
      </div>
      <p className={cn('text-[13px] leading-relaxed mb-2', eligibility?.resolved ? 'text-slate-500' : 'text-slate-700')}>{finding.text}</p>
      <div className="flex gap-2 text-[12px] mb-3">
        <span className="text-slate-400 shrink-0">→</span>
        <span className={cn('italic', eligibility?.resolved ? 'text-slate-400' : 'text-slate-600')}>{finding.suggestion}</span>
      </div>
      <div className="flex items-center gap-1 justify-end">
        {canFix && (
          <button
            onClick={() => onFixThis(eligibility!.sectionCode!)}
            disabled={isApplyingFix}
            title={`Draft a fix into section ${eligibility!.sectionCode}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold bg-violet-50 text-[#7c3aed] hover:bg-violet-100 transition-colors disabled:opacity-50 mr-auto"
          >
            {isApplyingFix ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Fix this
          </button>
        )}
        <button
          onClick={() => onFeedback('up')}
          title="Useful"
          className={cn('flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition-colors',
            feedback === 'up' ? 'bg-green-50 text-green-600' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600')}
        >
          <ThumbsUp size={12} /> Useful
        </button>
        <button
          onClick={() => onFeedback('down')}
          title="Not useful"
          className={cn('flex items-center justify-center w-7 h-7 rounded-md transition-colors',
            feedback === 'down' ? 'bg-red-50 text-red-600' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600')}
        >
          <ThumbsDown size={12} />
        </button>
      </div>
    </div>
  )
}

export default function ReviewerWorkspacePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [view, setView] = useState<string>(OVERVIEW_VIEW)
  const [feedback, setFeedback] = useState<Record<string, 'up' | 'down'>>({})
  const [exportingPdf, setExportingPdf] = useState(false)
  const [applyingFixIndex, setApplyingFixIndex] = useState<number | null>(null)
  const [fixPreview, setFixPreview] = useState<{ originalIndex: number; sectionCode: string; preview: SectionFixPreview } | null>(null)
  const [isConfirmingFix, setIsConfirmingFix] = useState(false)

  const { data: review, isLoading, isError } = useQuery({
    queryKey: ['reviewer-review', id],
    queryFn: () => reviewerApi.get(id!),
    enabled: Boolean(id),
  })

  const nonOverviewCategories = useMemo(
    () => review?.categoryScores.filter(cs => !isOverviewCategory(cs.category)) ?? [],
    [review],
  )

  const categoryColorMap = useMemo(() => {
    const map: Record<string, string> = {}
    nonOverviewCategories.forEach((cs, i) => { map[cs.category] = categoryColor(i) })
    return map
  }, [nonOverviewCategories])

  const filteredFindings = useMemo(() => {
    if (!review || view === OVERVIEW_VIEW) return []
    return review.findings
      .map((finding, originalIndex) => ({ finding, originalIndex }))
      .filter(x => x.finding.category === view)
      .sort((a, b) => SEVERITY_ORDER[a.finding.severity] - SEVERITY_ORDER[b.finding.severity])
  }, [review, view])

  const handleFixThis = async (originalIndex: number, sectionCode: string) => {
    if (!review?.researchProjectId) return
    const finding = review.findings[originalIndex]
    setApplyingFixIndex(originalIndex)
    try {
      const preview = await researchApi.applySectionFix(review.researchProjectId, sectionCode, [{
        sectionCode,
        issue:      finding.text,
        suggestion: finding.suggestion,
        source:     'ReviewerFinding',
      }])
      setFixPreview({ originalIndex, sectionCode, preview })
    } catch {
      toast.error('Could not draft a fix for this finding. Please try again.')
    } finally {
      setApplyingFixIndex(null)
    }
  }

  const handleAcceptFix = async () => {
    if (!fixPreview || !review?.researchProjectId) return
    setIsConfirmingFix(true)
    try {
      await researchApi.confirmSectionFix(review.researchProjectId, fixPreview.sectionCode, fixPreview.preview.proposedContent)
      const updated = await reviewerApi.resolveFinding(review.id, fixPreview.originalIndex)
      queryClient.setQueryData(['reviewer-review', id], updated)
      toast.success(`Fix applied to section ${fixPreview.sectionCode}.`)
      setFixPreview(null)
    } catch {
      toast.error('Could not apply the fix. Please try again.')
    } finally {
      setIsConfirmingFix(false)
    }
  }

  const handleCancelFix = async () => {
    const projectId = review?.researchProjectId
    setFixPreview(null)
    if (projectId) {
      try { await researchApi.discardSectionFix(projectId) } catch { /* reservation cleans up server-side regardless */ }
    }
  }

  const handleDownloadText = (r: DocumentReview) => {
    const blob = new Blob([generateReviewReportText(r)], { type: 'text/plain' })
    downloadBlob(blob, reviewReportFilename(r.documentTitle, 'txt'))
  }

  const handleDownloadPdf = async (r: DocumentReview) => {
    setExportingPdf(true)
    try {
      await reviewerApi.exportPdf(r.id, r.documentTitle)
    } catch {
      toast.error('Could not export PDF. Please try again.')
    } finally {
      setExportingPdf(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Loader2 size={24} className="animate-spin text-[#7c3aed]" />
        <p className="text-[13px] text-slate-500">Loading review…</p>
      </div>
    )
  }

  if (isError || !review) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
        <p className="text-[14px] text-slate-600 font-medium">Couldn't load this review.</p>
        <button
          onClick={() => navigate('/app/reviewer')}
          className="text-[12px] font-medium text-[#7c3aed] hover:text-[#4c1d95] transition-colors"
        >
          Back to Document Reviewer
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-slate-200 shrink-0">
        <button
          onClick={() => navigate('/app/reviewer')}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors shrink-0"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-orange-500">{review.reviewType}</span>
            <span className="text-[11px] text-slate-400">{formatDate(review.createdAt)}</span>
          </div>
          <h1 className="text-[16px] font-bold text-slate-900 truncate">{review.documentTitle}</h1>
        </div>
        <OutputActionButton icon={<FileText size={12} />} onClick={() => handleDownloadText(review)}>
          Export .txt
        </OutputActionButton>
        <OutputActionButton
          icon={exportingPdf ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />}
          onClick={() => handleDownloadPdf(review)}
          disabled={exportingPdf}
        >
          {exportingPdf ? 'Exporting…' : 'Export PDF'}
        </OutputActionButton>
        <button
          onClick={() => navigate('/app/reviewer')}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 text-[12px] font-medium text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors shrink-0"
        >
          <RefreshCw size={13} /> New review
        </button>
      </div>

      {/* 3-pane body */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Left: category rail */}
        <div className="w-72 shrink-0 border-r border-slate-200 overflow-y-auto p-3 space-y-1">
          <button
            onClick={() => setView(OVERVIEW_VIEW)}
            className={cn(
              'w-full flex items-start gap-2.5 text-left px-3 py-2.5 rounded-lg transition-colors',
              view === OVERVIEW_VIEW ? 'bg-violet-50' : 'hover:bg-slate-50',
            )}
          >
            <Mail size={14} className="text-slate-500 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className={cn('text-[13px] font-semibold truncate', view === OVERVIEW_VIEW ? 'text-[#7c3aed]' : 'text-slate-800')}>
                  {OVERVIEW_LABEL[review.reviewType]}
                </span>
                <CheckCircle2 size={13} className="text-green-500 shrink-0" />
              </div>
              <p className="text-[11px] text-slate-400">{review.findings.length} comments</p>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{OVERVIEW_DESCRIPTION[review.reviewType]}</p>
            </div>
          </button>

          <div className="border-t border-slate-100 my-2" />

          {nonOverviewCategories.map(cs => {
            const count = review.findings.filter(f => f.category === cs.category).length
            return (
              <button
                key={cs.category}
                onClick={() => setView(cs.category)}
                className={cn(
                  'w-full flex items-start gap-2.5 text-left px-3 py-2.5 rounded-lg transition-colors',
                  view === cs.category ? 'bg-violet-50' : 'hover:bg-slate-50',
                )}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5"
                  style={{ background: categoryColorMap[cs.category] }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className={cn('text-[13px] font-semibold truncate', view === cs.category ? 'text-[#7c3aed]' : 'text-slate-800')}>
                      {cs.category}
                    </span>
                    <CheckCircle2 size={13} className="text-green-500 shrink-0" />
                  </div>
                  <p className="text-[11px] text-slate-400">{count} comment{count === 1 ? '' : 's'}</p>
                  {CATEGORY_DESCRIPTIONS[cs.category] && (
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{CATEGORY_DESCRIPTIONS[cs.category]}</p>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Middle: overview narrative or findings */}
        <div className="flex-1 overflow-y-auto p-5">
          {view === OVERVIEW_VIEW ? (
            <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-xl p-6">
              <p className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap">
                {review.overviewNarrative || 'No overview was generated for this review.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFindings.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-center py-16">
                  <CheckCircle2 size={22} className="text-green-400" />
                  <p className="text-[13px] text-slate-500">No issues found in this category.</p>
                </div>
              ) : (
                filteredFindings.map(({ finding, originalIndex }, i) => {
                  const key = `${view}::${i}`
                  return (
                    <FindingCard
                      key={key}
                      finding={finding}
                      index={i}
                      color={categoryColorMap[view] ?? '#64748b'}
                      feedback={feedback[key]}
                      onFeedback={value => setFeedback(prev => ({ ...prev, [key]: value }))}
                      eligibility={review.findingFixEligibility[originalIndex]}
                      isApplyingFix={applyingFixIndex === originalIndex}
                      onFixThis={sectionCode => handleFixThis(originalIndex, sectionCode)}
                    />
                  )
                })
              )}
            </div>
          )}
        </div>

        {/* Right: score sidebar */}
        <div className="w-80 shrink-0 border-l border-slate-200 overflow-y-auto p-5 space-y-6">
          <div className="flex flex-col items-center text-center">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3">
              {READINESS_LABEL[review.reviewType]}
            </p>
            <ReadinessGauge score={review.overallScore} />
            <div className="mt-3"><VerdictBadge verdict={review.verdict} /></div>
            <p className="text-[12px] text-slate-500 mt-2">Confidence: {review.confidencePercent}%</p>
          </div>

          {review.standardsApplied.length > 0 && (
            <CollapsibleSection title="Standards Applied">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {review.standardsApplied.map(s => (
                  <span key={s} className="text-[11px] font-medium px-2 py-1 rounded-md bg-amber-tint text-amber-text">
                    {s}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Standards are inferred by the reviewer from the document's academic level, discipline, and stated methodology.
              </p>
            </CollapsibleSection>
          )}

          <CollapsibleSection title={CRITERIA_LABEL[review.reviewType]}>
            <div className="space-y-3">
              {review.categoryScores.map(cs => (
                <ScoreBar key={cs.category} score={cs.score} label={cs.category} size="compact" colorForScore={scoreColor} />
              ))}
            </div>
          </CollapsibleSection>
        </div>
      </div>

      {fixPreview && (
        <SectionFixDiffModal
          preview={fixPreview.preview}
          isConfirming={isConfirmingFix}
          onAccept={handleAcceptFix}
          onCancel={handleCancelFix}
        />
      )}
    </div>
  )
}
