import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight, Check, ChevronDown, ChevronUp, ClipboardList, Download, GitCompare, Loader2, Pill,
  Plus, RefreshCw, Sparkles, Target, Trash2, Users, X,
} from 'lucide-react'
import { cn, downloadBlob, formatDate } from '../../lib/utils'
import { useSystematicReviewStore } from '../../store/systematicReviewStore'
import type {
  CriterionType, EligibilityCriterion, ReviewProtocol, SearchStringItem, SearchStringUse,
  SuggestedCriterion, SystematicReviewDetail,
} from '../../types/systematicReview'
import ConfirmActionModal from '../../components/app/ConfirmActionModal'
import PrismaFlowDiagram from '../../components/app/PrismaFlowDiagram'
import FetchPapersStep from './FetchPapersStep'
import DedupeFilterStep from './DedupeFilterStep'
import TitleAbstractScreeningStep from './TitleAbstractScreeningStep'
import FullTextScreeningStep from './FullTextScreeningStep'
import ExtractionStep from './ExtractionStep'
import SnowballStep from './SnowballStep'
import RiskOfBiasStep from './RiskOfBiasStep'
import RobinsIStep from './RobinsIStep'
import EvidenceGradingStep from './EvidenceGradingStep'
import WriteSlrStep from './WriteSlrStep'
import ReviewSummaryBar from './ReviewSummaryBar'

// ── Pipeline steps (shared shell across all future workspace steps) ───────────

type StepId =
  | 'eligibility' | 'search-strings' | 'fetch-papers' | 'dedup'
  | 'screening-ta' | 'screening-ft' | 'snowball' | 'extraction'
  | 'risk-of-bias' | 'evidence-grading' | 'write-slr'

const PIPELINE_STEPS: { id: StepId; label: string; countLabel: (d: SystematicReviewDetail) => string }[] = [
  { id: 'eligibility',      label: 'Eligibility Criteria',         countLabel: d => `${d.criteria.length} criteria` },
  { id: 'search-strings',   label: 'Form Search Strings',          countLabel: d => `${d.searchStrings.length} string${d.searchStrings.length === 1 ? '' : 's'}` },
  { id: 'fetch-papers',     label: 'Fetch Papers',                 countLabel: d => `${d.paperCount ?? 0} fetched` },
  { id: 'dedup',            label: 'Deduplication & filters',      countLabel: d => d.latestDedupeRun
      ? `${d.latestDedupeRun.readyForScreeningCount} ready · ${
          d.latestDedupeRun.duplicatesRemovedByDoi + d.latestDedupeRun.duplicatesRemovedByTitle +
          d.latestDedupeRun.excludedWithoutAbstract + d.latestDedupeRun.excludedByPublicationDate +
          d.latestDedupeRun.excludedByCitationThreshold
        } removed`
      : 'Ready to run' },
  { id: 'screening-ta',     label: 'Title and abstract screening', countLabel: d => d.screeningSummary
      ? `${d.screeningSummary.included} included · ${d.screeningSummary.manual} manual`
      : 'Not started' },
  { id: 'screening-ft',     label: 'Full text screening',          countLabel: d => d.fullTextScreeningSummary
      ? `${d.fullTextScreeningSummary.included} confirmed`
      : 'Not started' },
  { id: 'snowball',         label: 'Citation Chaining',            countLabel: d => d.fullTextScreeningSummary
      ? `${d.fullTextScreeningSummary.included} paper${d.fullTextScreeningSummary.included === 1 ? '' : 's'} to seed`
      : 'Optional' },
  { id: 'extraction',       label: 'Data Extraction',              countLabel: d => d.extractionSummary
      ? `${d.extractionSummary.extracted} extracted`
      : d.extractionSkipped ? 'Skipped' : '0 extracted' },
  { id: 'risk-of-bias',     label: 'Risk of bias assessment',      countLabel: d => d.riskOfBiasSummary
      ? `${d.riskOfBiasSummary.total - d.riskOfBiasSummary.pending} assessed`
      : d.riskOfBiasSkipped ? 'Skipped' : '0 assessed' },
  { id: 'evidence-grading', label: 'Evidence Grading',             countLabel: d => d.evidenceGradingSummary
      ? `${d.evidenceGradingSummary.totalOutcomes} outcome${d.evidenceGradingSummary.totalOutcomes === 1 ? '' : 's'}`
      : d.evidenceGradingSkipped ? 'Skipped' : '0 outcomes' },
  { id: 'write-slr',        label: 'Write SLR',                    countLabel: d => d.manuscript
      ? `${d.manuscript.sections.length} section${d.manuscript.sections.length === 1 ? '' : 's'} drafted`
      : 'Draft pending' },
]

const CRITERION_ICONS: Record<CriterionType, React.ElementType> = {
  Population: Users, Intervention: Pill, Comparator: GitCompare, Outcome: Target,
  StudyDesign: ClipboardList, Custom: Sparkles,
}

const SEARCH_STRING_USE_LABELS: Record<SearchStringUse, string> = {
  DatabaseFilter: 'Use in search strings', ScreeningOnly: 'Screening only',
}

const SEARCH_STRING_USE_HELP: Record<SearchStringUse, string> = {
  DatabaseFilter: 'This criterion should be translated into boolean query terms during retrieval.',
  ScreeningOnly: 'This criterion should be enforced during screening or via native database filters, not literal keywords — "Regenerate with AI" on Form Search Strings ignores it.',
}

// Population/Intervention/Comparator/Outcome are the terms that "Regenerate with AI" (Form
// Search Strings step) actually turns into boolean query blocks, so they default to
// DatabaseFilter. Study Design and free-form Custom criteria are usually enforced during
// screening instead, so they default to ScreeningOnly.
const defaultSearchStringUse = (type: CriterionType): SearchStringUse =>
  type === 'StudyDesign' || type === 'Custom' ? 'ScreeningOnly' : 'DatabaseFilter'

// Tracks review ids we've already tried to auto-populate in this browser tab, so navigating
// away from and back to the Eligibility step (which remounts EligibilityCriteriaStep) doesn't
// re-trigger the AI call, and so a user who deliberately clears all criteria isn't immediately
// overwritten again within the same session.
const autoPopulateAttempted = new Set<string>()

const SOURCES = ['PubMed', 'OpenAlex', 'arXiv', 'Semantic Scholar', 'ClinicalTrials.gov', 'Scopus']

const QUICK_ADD_TYPES: { type: CriterionType; label: string }[] = [
  { type: 'Population',   label: 'Population' },
  { type: 'Intervention', label: 'Intervention' },
  { type: 'Comparator',   label: 'Comparator' },
  { type: 'Outcome',      label: 'Outcome' },
]

function formatRelativeTime(date: Date): string {
  const diffSec = Math.round((Date.now() - date.getTime()) / 1000)
  if (diffSec < 10) return 'just now'
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `${diffMin} min ago`
  return `${Math.round(diffMin / 60)}h ago`
}

function formatDateRange(protocol: ReviewProtocol): string {
  if (!protocol.dateRangeStart && !protocol.dateRangeEnd) return 'Any'
  return `${protocol.dateRangeStart ?? '…'} – ${protocol.dateRangeEnd ?? '…'}`
}

// ── Export dropdown ─────────────────────────────────────────────────────────

function ExportMenuItem({ label, onClick, downloading, disabled }: {
  label:       string
  onClick:     () => void
  downloading: boolean
  disabled?:   boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={downloading || disabled}
      title={disabled ? 'Nothing to export yet' : undefined}
      className="w-full flex items-center justify-between gap-3 px-3 py-1.5 text-[12px] text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left"
    >
      {label}
      {downloading ? <Loader2 size={12} className="animate-spin text-slate-400 shrink-0" /> : <Download size={12} className="text-slate-400 shrink-0" />}
    </button>
  )
}

function ExportMenu({ reviewId, hasManuscript }: { reviewId: string; hasManuscript: boolean }) {
  const store = useSystematicReviewStore()
  const [open, setOpen] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const runExport = async (key: string, action: () => Promise<void>) => {
    setDownloading(key)
    try {
      await action()
    } catch {
      toast.error('Export failed. Please try again.')
    } finally {
      setDownloading(null)
      setOpen(false)
    }
  }

  const downloadCsv = (key: string, fetcher: (id: string) => Promise<Blob>, filename: string) =>
    runExport(key, async () => downloadBlob(await fetcher(reviewId), filename))

  const downloadPrisma = () =>
    runExport('prisma', async () => {
      const data = await store.getPrismaFlow(reviewId)
      downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), 'prisma.json')
    })

  const downloadManuscript = () =>
    runExport('manuscript', async () => downloadBlob(await store.exportManuscript(reviewId), 'systematic-review.docx'))

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 text-[12px] font-medium transition-colors"
      >
        Export <ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-30 py-1.5">
          <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Data</p>
          <ExportMenuItem label="Papers (CSV)" downloading={downloading === 'papers'} onClick={() => downloadCsv('papers', store.exportPapersCsv, 'papers.csv')} />
          <ExportMenuItem label="Papers (RIS)" downloading={downloading === 'papers-ris'} onClick={() => downloadCsv('papers-ris', store.exportPapersRis, 'papers.ris')} />
          <ExportMenuItem label="Screening (CSV)" downloading={downloading === 'screening'} onClick={() => downloadCsv('screening', store.exportScreeningCsv, 'screening.csv')} />
          <ExportMenuItem label="Extraction (CSV)" downloading={downloading === 'extraction'} onClick={() => downloadCsv('extraction', store.exportExtractionCsv, 'extraction.csv')} />
          <ExportMenuItem label="Risk of Bias (CSV)" downloading={downloading === 'risk-of-bias'} onClick={() => downloadCsv('risk-of-bias', store.exportRiskOfBiasCsv, 'risk-of-bias.csv')} />
          <ExportMenuItem label="GRADE Evidence (CSV)" downloading={downloading === 'grade'} onClick={() => downloadCsv('grade', store.exportEvidenceGradingCsv, 'grade-evidence.csv')} />
          <ExportMenuItem label="Excluded Studies (CSV)" downloading={downloading === 'excluded-studies'} onClick={() => downloadCsv('excluded-studies', store.exportExcludedStudiesCsv, 'excluded-studies.csv')} />
          <ExportMenuItem label="PRISMA (JSON)" downloading={downloading === 'prisma'} onClick={downloadPrisma} />
          <div className="my-1 border-t border-slate-100" />
          <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">SLR Paper</p>
          <ExportMenuItem label="Manuscript (Word)" downloading={downloading === 'manuscript'} disabled={!hasManuscript} onClick={downloadManuscript} />
        </div>
      )}
    </div>
  )
}

// ── Header ──────────────────────────────────────────────────────────────────

function MarkReviewedButton({ reviewedAt, onMark }: { reviewedAt: string | undefined; onMark: () => void }) {
  const [marking, setMarking] = useState(false)
  const handleClick = async () => {
    setMarking(true)
    try { await onMark() } finally { setMarking(false) }
  }
  return (
    <button
      onClick={handleClick}
      disabled={marking}
      title={reviewedAt ? `Confirmed reviewed ${formatDate(reviewedAt)} — click to re-confirm` : 'Confirm you have reviewed this step — informational only, does not gate progress'}
      className={cn(
        'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[12px] font-medium transition-colors',
        reviewedAt
          ? 'border-green-accent/40 bg-green-50 text-green-text hover:bg-green-100'
          : 'border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300',
      )}
    >
      {marking ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
      {reviewedAt ? 'Reviewed' : 'Mark reviewed'}
    </button>
  )
}

function WorkspaceHeader({ detail, lastSavedAt, nextStepLabel, nextDisabled, currentStepId, onNext, onAutoRun, onOpenPrismaDiagram, onMarkReviewed }: {
  detail:               SystematicReviewDetail
  lastSavedAt:          Date | null
  nextStepLabel:        string
  nextDisabled?:        boolean
  currentStepId:        string
  onNext:               () => void
  onAutoRun:            () => void
  onOpenPrismaDiagram:  () => void
  onMarkReviewed:       () => void
}) {
  return (
    <div className="shrink-0 border-b border-slate-200 px-6 py-4 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-violet-500 mb-1">Systematic Review</p>
        <h1
          title={detail.researchQuestion ?? undefined}
          className="text-[19px] font-bold text-slate-900 truncate max-w-xl"
        >
          {detail.researchQuestion || 'Untitled systematic review'}
        </h1>
        <p className="text-[11px] text-slate-400 mt-1">
          {lastSavedAt ? `Autosaved ${formatRelativeTime(lastSavedAt)}` : 'Not saved yet'}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <MarkReviewedButton reviewedAt={detail.checkpoints[currentStepId]} onMark={onMarkReviewed} />
        <button
          onClick={onOpenPrismaDiagram}
          className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 text-[12px] font-medium transition-colors"
        >
          PRISMA Diagram
        </button>
        <button
          disabled
          title="Not available yet"
          className="px-3 py-2 rounded-lg border border-slate-200 text-slate-400 text-[12px] font-medium cursor-not-allowed"
        >
          📖 Save to Library
        </button>
        <ExportMenu reviewId={detail.id} hasManuscript={detail.manuscript !== null} />
        <button
          onClick={onAutoRun}
          className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 text-[12px] font-medium transition-colors"
        >
          Auto-run all steps
        </button>
        <button
          onClick={onNext}
          disabled={nextDisabled}
          title={nextDisabled ? 'Finish this step before continuing' : undefined}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[12px] font-semibold transition-colors shadow-sm shadow-violet-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-violet-600"
        >
          Next: {nextStepLabel} <ArrowRight size={13} />
        </button>
      </div>
    </div>
  )
}

// ── Right rail ──────────────────────────────────────────────────────────────

function StepDot({ status, num }: { status: 'active' | 'done' | 'todo'; num: number }) {
  const base = 'w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold'
  if (status === 'done') return <span className={cn(base, 'bg-green-accent text-white')}><Check size={10} strokeWidth={3} /></span>
  if (status === 'active') return <span className={cn(base, 'bg-purple-accent text-white')}>{num}</span>
  return <span className={cn(base, 'bg-white border border-slate-300 text-slate-400')}>{num}</span>
}

function RightRail({ detail, currentStepId, onSelectStep }: {
  detail:        SystematicReviewDetail
  currentStepId: StepId
  onSelectStep:  (id: StepId) => void
}) {
  const currentIdx = PIPELINE_STEPS.findIndex(s => s.id === currentStepId)

  return (
    <aside className="w-80 shrink-0 overflow-y-auto border-l border-slate-200 bg-slate-50/50 p-4">
      <div className="mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">Research question</p>
        <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-[12px] text-slate-700 leading-relaxed">
          {detail.researchQuestion || '—'}
        </div>
      </div>

      <div className="mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">Sources</p>
        <div className="flex flex-wrap gap-1.5">
          {detail.protocol.databasesSearched.length === 0
            ? <span className="text-[11px] text-slate-400">None selected</span>
            : detail.protocol.databasesSearched.map(s => (
                <span key={s} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-100 text-violet-600">{s}</span>
              ))}
        </div>
      </div>

      <div className="mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">Selection filters</p>
        <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-[11px] text-slate-600 space-y-1">
          <div className="flex justify-between"><span>Date</span><span className="text-slate-800 font-medium">{formatDateRange(detail.protocol)}</span></div>
          <div className="flex justify-between"><span>Min citations</span><span className="text-slate-800 font-medium">{detail.protocol.minCitations}</span></div>
          <div className="flex justify-between"><span>Abstract required</span><span className="text-slate-800 font-medium">{detail.protocol.abstractRequired ? 'Yes' : 'No'}</span></div>
        </div>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">Progress</p>
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          {PIPELINE_STEPS.map((step, idx) => {
            const status = idx === currentIdx ? 'active' : idx < currentIdx ? 'done' : 'todo'
            return (
              <button
                key={step.id}
                onClick={() => onSelectStep(step.id)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 text-left border-b border-slate-100 last:border-0 transition-colors',
                  status === 'active' ? 'bg-violet-50' : 'hover:bg-slate-50',
                )}
              >
                <StepDot status={status} num={idx + 1} />
                <div className="min-w-0 flex-1">
                  <p className={cn('text-[12px] truncate', status === 'active' ? 'font-semibold text-violet-700' : 'text-slate-600')}>
                    {step.label}
                  </p>
                  <p className="text-[10px] text-slate-400">{step.countLabel(detail)}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </aside>
  )
}

// ── Delete criterion confirmation ───────────────────────────────────────────

function DeleteCriterionModal({ criterion, onClose, onConfirm }: {
  criterion: EligibilityCriterion
  onClose:   () => void
  onConfirm: () => Promise<void>
}) {
  const [loading, setLoading] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="relative bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm p-6"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors">
          <X size={16} />
        </button>
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-50 mb-4">
          <Trash2 size={20} className="text-red-500" />
        </div>
        <h3 className="text-[17px] font-bold text-slate-900 mb-1">Remove this criterion?</h3>
        <p className="text-[13px] font-semibold text-slate-800 truncate mb-5">"{criterion.name}"</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-[13px] text-slate-500 hover:text-slate-800 border border-slate-200 rounded-xl transition-colors">
            Cancel
          </button>
          <button
            onClick={async () => { setLoading(true); await onConfirm() }}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[13px] font-semibold transition-colors disabled:opacity-60"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : null}
            Remove
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Criterion card ──────────────────────────────────────────────────────────

function CriterionCard({ reviewId, criterion, onSaved, autoFocus }: {
  reviewId:  string
  criterion: EligibilityCriterion
  onSaved:   () => void
  autoFocus?: boolean
}) {
  const store = useSystematicReviewStore()
  const [expanded, setExpanded] = useState(true)
  const [name, setName] = useState(criterion.name)
  const [description, setDescription] = useState(criterion.description)
  const [include, setInclude] = useState(criterion.include ?? '')
  const [exclude, setExclude] = useState(criterion.exclude ?? '')
  const [searchStringUse, setSearchStringUse] = useState<SearchStringUse>(criterion.searchStringUse)
  const [pendingDelete, setPendingDelete] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const labelInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus) labelInputRef.current?.focus()
  }, [autoFocus])

  const save = async (patch: Partial<{
    name: string; description: string; include: string; exclude: string; searchStringUse: SearchStringUse
  }>) => {
    await store.updateCriterion(reviewId, criterion.id, {
      name, description, include: include || null, exclude: exclude || null, searchStringUse, ...patch,
    })
    onSaved()
    setJustSaved(true)
    setTimeout(() => setJustSaved(false), 1500)
  }

  const handleDelete = async () => {
    await store.deleteCriterion(reviewId, criterion.id)
    onSaved()
    setPendingDelete(false)
  }

  const Icon = CRITERION_ICONS[criterion.type]

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-2.5 px-4 py-3 cursor-pointer hover:bg-slate-50/60 transition-colors"
      >
        <Icon size={15} className="text-violet-500 shrink-0" />
        <span className="text-[13px] font-bold text-slate-800 truncate">{name || criterion.type}</span>
        <span className="text-[10px] font-medium text-slate-400 truncate">{SEARCH_STRING_USE_LABELS[searchStringUse]}</span>
        {justSaved && <span className="text-[10px] font-medium text-green-text shrink-0">Saved</span>}
        <div className="flex-1" />
        <button
          onClick={e => { e.stopPropagation(); setPendingDelete(true) }}
          className="text-[11px] text-slate-400 hover:text-red-500 transition-colors shrink-0"
        >
          trash
        </button>
        {expanded ? <ChevronUp size={14} className="text-slate-400 shrink-0" /> : <ChevronDown size={14} className="text-slate-400 shrink-0" />}
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-100">
          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1 mt-3">Label</label>
          <input
            ref={labelInputRef}
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={() => save({ name })}
            className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-[13px] text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition mb-3"
          />

          <p className="text-[11px] text-slate-400 mb-1.5">Describe how reviewers should interpret this criterion.</p>

          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Search String Use</label>
          <select
            value={searchStringUse}
            onChange={e => { const v = e.target.value as SearchStringUse; setSearchStringUse(v); save({ searchStringUse: v }) }}
            className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-[13px] text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition bg-white"
          >
            <option value="DatabaseFilter">{SEARCH_STRING_USE_LABELS.DatabaseFilter}</option>
            <option value="ScreeningOnly">{SEARCH_STRING_USE_LABELS.ScreeningOnly}</option>
          </select>
          <p className="text-[11px] text-slate-400 mt-1 mb-3">{SEARCH_STRING_USE_HELP[searchStringUse]}</p>

          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Description</label>
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            onBlur={() => save({ description })}
            placeholder="Describe how reviewers should interpret this criterion"
            className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-[13px] text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition placeholder-slate-400 mb-3"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-amber-text uppercase tracking-widest mb-1">Include</label>
              <input
                value={include}
                onChange={e => setInclude(e.target.value)}
                onBlur={() => save({ include })}
                placeholder="What qualifies for inclusion?"
                className="w-full border border-amber-accent/40 rounded-lg px-3 py-1.5 text-[13px] text-slate-800 outline-none focus:border-amber-accent focus:ring-2 focus:ring-amber-tint transition placeholder-slate-400"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-amber-text uppercase tracking-widest mb-1">Exclude</label>
              <input
                value={exclude}
                onChange={e => setExclude(e.target.value)}
                onBlur={() => save({ exclude })}
                placeholder="What should be excluded?"
                className="w-full border border-amber-accent/40 rounded-lg px-3 py-1.5 text-[13px] text-slate-800 outline-none focus:border-amber-accent focus:ring-2 focus:ring-amber-tint transition placeholder-slate-400"
              />
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {pendingDelete && (
          <DeleteCriterionModal criterion={criterion} onClose={() => setPendingDelete(false)} onConfirm={handleDelete} />
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Custom criterion builder ────────────────────────────────────────────────

function CustomCriterionBuilder({ reviewId, onSaved }: { reviewId: string; onSaved: () => void }) {
  const store = useSystematicReviewStore()
  const [open, setOpen] = useState(true)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [searchStringUse, setSearchStringUse] = useState<SearchStringUse>('ScreeningOnly')
  const [adding, setAdding] = useState(false)

  const handleAdd = async () => {
    if (!name.trim()) return
    setAdding(true)
    try {
      await store.addCriterion(reviewId, { type: 'Custom', name: name.trim(), description: description.trim(), searchStringUse })
      setName('')
      setDescription('')
      setSearchStringUse('ScreeningOnly')
      onSaved()
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="border border-slate-200 rounded-xl p-4 mb-6">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between text-[13px] font-bold text-slate-800">
        Custom
        {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
      </button>
      {open && (
        <div className="mt-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Criterion name"
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-[13px] text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition placeholder-slate-400"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Description</label>
              <input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="How should reviewers interpret this rule?"
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-[13px] text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition placeholder-slate-400"
              />
            </div>
          </div>
          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Search String Use</label>
          <select
            value={searchStringUse}
            onChange={e => setSearchStringUse(e.target.value as SearchStringUse)}
            className="w-full sm:w-64 border border-slate-200 rounded-lg px-3 py-1.5 text-[13px] text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition bg-white"
          >
            <option value="DatabaseFilter">{SEARCH_STRING_USE_LABELS.DatabaseFilter}</option>
            <option value="ScreeningOnly">{SEARCH_STRING_USE_LABELS.ScreeningOnly}</option>
          </select>
          <p className="text-[11px] text-slate-400 mt-1 mb-3 max-w-md">{SEARCH_STRING_USE_HELP[searchStringUse]}</p>
          <button
            onClick={handleAdd}
            disabled={!name.trim() || adding}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[12px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Add custom criterion
          </button>
        </div>
      )}
    </div>
  )
}

// ── AI-assist panel ─────────────────────────────────────────────────────────

function AiAssistPanel({ reviewId, initialDescription, criteria, onSaved }: {
  reviewId:           string
  initialDescription: string
  criteria:           EligibilityCriterion[]
  onSaved:            () => void
}) {
  const store = useSystematicReviewStore()
  const [description, setDescription] = useState(initialDescription)
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<SuggestedCriterion[]>([])
  const [addingAll, setAddingAll] = useState(false)
  const [addingIndex, setAddingIndex] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const hasCriteria = criteria.length > 0

  const handleSuggest = async () => {
    if (!description.trim()) return
    setLoading(true)
    setError(null)
    try {
      const result = await store.suggestCriteria(reviewId, description.trim())
      setSuggestions(result)
    } catch {
      setError('Could not generate suggestions. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // A quick-added card (from "Add Population" etc.) that hasn't been filled in yet — prefer
  // filling that in over creating a duplicate criterion of the same type. `consumed` tracks
  // slots already claimed within the current batch so two same-type suggestions don't both
  // land on the same blank card.
  const findBlankSlot = (type: CriterionType, consumed: Set<string>) =>
    criteria.find(c => c.type === type && !consumed.has(c.id) && !c.description.trim() && !c.include?.trim() && !c.exclude?.trim())

  // A review only ever has one criterion per PICO category — if there's no blank card but a
  // filled one of this type already exists (e.g. "Suggest Criteria" was run a second time),
  // overwrite it instead of appending a second criterion of the same type. Without this,
  // re-running suggestions silently doubles up criteria, and since a paper must Match every
  // criterion to be Included, doubled criteria can make screening exclude everything.
  const findExistingSlot = (type: CriterionType, consumed: Set<string>) =>
    criteria.find(c => c.type === type && !consumed.has(c.id))

  const applySuggestion = async (s: SuggestedCriterion, consumed: Set<string>) => {
    const slot = findBlankSlot(s.type, consumed) ?? findExistingSlot(s.type, consumed)
    if (slot) {
      consumed.add(slot.id)
      await store.updateCriterion(reviewId, slot.id, {
        name: s.name, description: s.description, include: s.include, exclude: s.exclude, searchStringUse: slot.searchStringUse,
      })
    } else {
      await store.addCriterion(reviewId, {
        type: s.type, name: s.name, description: s.description, include: s.include, exclude: s.exclude, searchStringUse: defaultSearchStringUse(s.type),
      })
    }
  }

  const addSuggestion = async (index: number) => {
    const s = suggestions[index]
    setAddingIndex(index)
    try {
      await applySuggestion(s, new Set())
      setSuggestions(prev => prev.filter((_, i) => i !== index))
      onSaved()
    } finally {
      setAddingIndex(null)
    }
  }

  const addAll = async () => {
    setAddingAll(true)
    try {
      const consumed = new Set<string>()
      for (const s of suggestions) {
        await applySuggestion(s, consumed)
      }
      setSuggestions([])
      onSaved()
    } finally {
      setAddingAll(false)
    }
  }

  return (
    <div className="mb-6">
      {suggestions.length > 0 && (
        <div className="border border-violet-200 bg-violet-50/40 rounded-xl p-4 mb-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Suggested criteria</p>
            <div className="flex items-center gap-3">
              <button
                onClick={addAll}
                disabled={addingAll}
                className="text-[11px] font-semibold text-violet-600 hover:text-violet-700 transition-colors disabled:opacity-50"
              >
                {addingAll ? 'Adding…' : 'Add all'}
              </button>
              <button
                onClick={() => setSuggestions([])}
                className="text-[11px] font-medium text-slate-400 hover:text-slate-600 transition-colors"
              >
                Dismiss all
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {suggestions.map((s, i) => (
              <div key={`${s.type}-${i}`} className="flex items-start justify-between gap-3 bg-white border border-slate-200 rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-violet-600 uppercase tracking-wide">{s.type}</p>
                  <p className="text-[12px] font-medium text-slate-800">{s.name}</p>
                  <p className="text-[12px] text-slate-500">{s.description}</p>
                  {(s.include || s.exclude) && (
                    <div className="mt-1 space-y-0.5">
                      {s.include && <p className="text-[11px] text-amber-text"><span className="font-semibold">Include:</span> {s.include}</p>}
                      {s.exclude && <p className="text-[11px] text-amber-text"><span className="font-semibold">Exclude:</span> {s.exclude}</p>}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => addSuggestion(i)}
                  disabled={addingIndex === i}
                  className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-md border border-violet-200 text-violet-600 hover:bg-violet-50 text-[11px] font-semibold transition-colors disabled:opacity-50"
                >
                  {addingIndex === i ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                  Add
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border border-slate-200 rounded-xl p-4">
        <h3 className="text-[13px] font-bold text-slate-800 mb-1">Describe your systematic review</h3>
        <p className="text-[11px] text-slate-500 mb-3">
          Enter your research question and we will suggest eligibility criteria using the configured AI model.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <textarea
            rows={3}
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="sm:w-[70%] resize-y border border-slate-200 rounded-lg px-3 py-2 text-[13px] text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition"
          />
          <button
            onClick={handleSuggest}
            disabled={!description.trim() || loading}
            className="sm:w-[30%] shrink-0 flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[12px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : null}
            Suggest Criteria
          </button>
        </div>

        {error && (
          <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">{error}</p>
        )}

        {hasCriteria && (
          <button
            onClick={handleSuggest}
            disabled={!description.trim() || loading}
            className="text-[11px] font-medium text-violet-400 hover:text-violet-600 transition-colors mt-3 disabled:opacity-50"
          >
            Re-suggest criteria with AI
          </button>
        )}
      </div>
    </div>
  )
}

// ── Sources & selection filters panel ──────────────────────────────────────

function ProtocolFiltersPanel({ reviewId, protocol, onSaved }: {
  reviewId: string
  protocol: ReviewProtocol
  onSaved:  () => void
}) {
  const store = useSystematicReviewStore()
  const [sources, setSources] = useState<string[]>(protocol.databasesSearched)
  const [dateStart, setDateStart] = useState(protocol.dateRangeStart ?? '')
  const [dateEnd, setDateEnd] = useState(protocol.dateRangeEnd ?? '')
  const [minCitations, setMinCitations] = useState(protocol.minCitations)
  const [abstractRequired, setAbstractRequired] = useState(protocol.abstractRequired)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  const scheduleSave = (patch: Partial<{
    sources: string[]; dateStart: string; dateEnd: string; minCitations: number; abstractRequired: boolean
  }>) => {
    const next = {
      sources: patch.sources ?? sources,
      dateStart: patch.dateStart ?? dateStart,
      dateEnd: patch.dateEnd ?? dateEnd,
      minCitations: patch.minCitations ?? minCitations,
      abstractRequired: patch.abstractRequired ?? abstractRequired,
    }
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      store.updateProtocol(reviewId, {
        databasesSearched: next.sources,
        dateRangeStart: next.dateStart || null,
        dateRangeEnd: next.dateEnd || null,
        minCitations: next.minCitations,
        abstractRequired: next.abstractRequired,
      }).then(onSaved)
    }, 500)
  }

  const toggleSource = (name: string) => {
    const next = sources.includes(name) ? sources.filter(s => s !== name) : [...sources, name]
    setSources(next)
    scheduleSave({ sources: next })
  }

  return (
    <div className="border border-slate-200 rounded-xl p-4">
      <h3 className="text-[13px] font-bold text-slate-800 mb-3">Sources &amp; selection filters</h3>

      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Sources</p>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {SOURCES.map(name => {
          const active = sources.includes(name)
          return (
            <button
              key={name}
              onClick={() => toggleSource(name)}
              className={cn(
                'text-[11px] font-medium px-3 py-1.5 rounded-full border transition-colors',
                active ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-violet-300',
              )}
            >
              {name}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">From</label>
          <input
            type="date"
            value={dateStart}
            onChange={e => { setDateStart(e.target.value); scheduleSave({ dateStart: e.target.value }) }}
            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-[12px] text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">To</label>
          <input
            type="date"
            value={dateEnd}
            onChange={e => { setDateEnd(e.target.value); scheduleSave({ dateEnd: e.target.value }) }}
            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-[12px] text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Min citations</label>
          <input
            type="number"
            min={0}
            value={minCitations}
            onChange={e => { const v = Math.max(0, Number(e.target.value) || 0); setMinCitations(v); scheduleSave({ minCitations: v }) }}
            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-[12px] text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition"
          />
        </div>
        <div className="flex flex-col justify-end pb-1.5">
          <label className="flex items-center gap-1.5 text-[12px] text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={abstractRequired}
              onChange={e => { setAbstractRequired(e.target.checked); scheduleSave({ abstractRequired: e.target.checked }) }}
              className="rounded border-slate-300 text-violet-600 focus:ring-violet-400"
            />
            Abstract required
          </label>
        </div>
      </div>
    </div>
  )
}

// ── Eligibility Criteria step ───────────────────────────────────────────────

// ── Protocol amendment log ──────────────────────────────────────────────────
// Read-only, informational — never blocks an edit. Populated only once a search has already
// been executed (see SystematicReviewService.RecordAmendmentAsync), so it's empty (and hidden)
// for reviews still in initial setup.

function ProtocolAmendmentsPanel({ reviewId }: { reviewId: string }) {
  const getProtocolAmendments = useSystematicReviewStore(s => s.getProtocolAmendments)
  const [open, setOpen] = useState(false)
  const [amendments, setAmendments] = useState<import('../../types/systematicReview').ProtocolAmendment[]>([])

  useEffect(() => {
    let cancelled = false
    getProtocolAmendments(reviewId).then(result => { if (!cancelled) setAmendments(result) }).catch(() => {})
    return () => { cancelled = true }
  }, [reviewId, getProtocolAmendments])

  if (amendments.length === 0) return null

  return (
    <div className="border border-amber-accent/40 bg-amber-tint/30 rounded-xl p-4 mb-6">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between text-[13px] font-bold text-slate-800">
        Changes since search ran ({amendments.length})
        {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] text-slate-500 mb-2">
            These fields were edited after papers had already been fetched — kept here for reproducibility, same as a PROSPERO protocol amendment.
          </p>
          {amendments.map(a => (
            <div key={a.id} className="text-[12px] bg-white border border-slate-200 rounded-lg px-3 py-2">
              <span className="font-semibold text-slate-700">{a.field}</span>
              <span className="text-slate-400"> · {formatDate(a.changedAt)}</span>
              <p className="text-slate-500 mt-0.5">
                <span className="line-through">{a.oldValue || '—'}</span> → <span className="text-slate-800">{a.newValue || '—'}</span>
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EligibilityCriteriaStep({ reviewId, detail, onSaved }: {
  reviewId: string
  detail:   SystematicReviewDetail
  onSaved:  () => void
}) {
  const store = useSystematicReviewStore()
  const [addingType, setAddingType] = useState<CriterionType | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [autoPopulating, setAutoPopulating] = useState(false)

  useEffect(() => {
    const researchQuestion = detail.researchQuestion?.trim()
    if (detail.criteria.length > 0 || !researchQuestion || autoPopulateAttempted.has(reviewId)) return
    autoPopulateAttempted.add(reviewId)

    setAutoPopulating(true)
    ;(async () => {
      try {
        const suggestions = await store.suggestCriteria(reviewId, researchQuestion)
        for (const s of suggestions) {
          await store.addCriterion(reviewId, {
            type: s.type, name: s.name, description: s.description, include: s.include, exclude: s.exclude,
            searchStringUse: defaultSearchStringUse(s.type),
          })
        }
        onSaved()
      } catch {
        toast.error("Couldn't auto-generate starter criteria — use Suggest Criteria below.")
      } finally {
        setAutoPopulating(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewId, detail.researchQuestion, detail.criteria.length])

  const handleQuickAdd = async (type: CriterionType, label: string) => {
    setAddingType(type)
    try {
      const criterion = await store.addCriterion(reviewId, { type, name: label, description: '', searchStringUse: defaultSearchStringUse(type) })
      onSaved()
      setFocusId(criterion.id)
    } finally {
      setAddingType(null)
    }
  }

  return (
    <div className="max-w-3xl px-6 py-6">
      <h2 className="text-[18px] font-bold text-slate-900 mb-1">Eligibility Criteria</h2>
      <p className="text-[13px] text-slate-500 mb-5">Define the eligibility criteria for your systematic review.</p>

      <ProtocolAmendmentsPanel reviewId={reviewId} />

      {autoPopulating && (
        <div className="flex items-center gap-2 text-[12px] font-medium text-violet-600 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2 mb-4">
          <Loader2 size={13} className="animate-spin" />
          Generating starter eligibility criteria from your research question…
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-2">
        {QUICK_ADD_TYPES.map(t => (
          <button
            key={t.type}
            onClick={() => handleQuickAdd(t.type, t.label)}
            disabled={addingType !== null || autoPopulating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:border-violet-300 hover:text-violet-700 text-[12px] font-medium transition-colors disabled:opacity-50"
          >
            {addingType === t.type ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            Add {t.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => handleQuickAdd('StudyDesign', 'Study Design')}
          disabled={addingType !== null || autoPopulating}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:border-violet-300 hover:text-violet-700 text-[12px] font-medium transition-colors disabled:opacity-50"
        >
          {addingType === 'StudyDesign' ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          Add Study Design
        </button>
      </div>

      {detail.criteria.length > 0 && (
        <div className="space-y-3 mb-6">
          {detail.criteria.map(c => (
            <CriterionCard key={c.id} reviewId={reviewId} criterion={c} onSaved={onSaved} autoFocus={c.id === focusId} />
          ))}
        </div>
      )}

      <CustomCriterionBuilder reviewId={reviewId} onSaved={onSaved} />

      <AiAssistPanel
        reviewId={reviewId}
        initialDescription={detail.researchQuestion ?? ''}
        criteria={detail.criteria}
        onSaved={onSaved}
      />

      <div className="pt-5 mt-2 border-t border-slate-100">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Additional</p>
        <ProtocolFiltersPanel reviewId={reviewId} protocol={detail.protocol} onSaved={onSaved} />
      </div>
    </div>
  )
}

// ── Form Search Strings step ────────────────────────────────────────────────

function CriteriaReferencePanel({ criteria }: { criteria: EligibilityCriterion[] }) {
  const [open, setOpen] = useState(true)
  const usable = criteria.filter(c => c.searchStringUse === 'DatabaseFilter')
  const screeningOnly = criteria.filter(c => c.searchStringUse === 'ScreeningOnly')

  return (
    <div className="border border-slate-200 rounded-xl p-4 mb-6">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between text-[13px] font-bold text-slate-800">
        Eligibility criteria used in search strings
        {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          {usable.length === 0 ? (
            <p className="text-[12px] text-slate-400">
              No criteria are flagged "Use in search strings" yet — go back to Eligibility Criteria to flag some, or
              generation will fall back to the research question alone.
            </p>
          ) : (
            usable.map(c => (
              <div key={c.id} className="text-[12px]">
                <span className="font-semibold text-violet-600">{c.type}</span>{' '}
                <span className="font-medium text-slate-800">{c.name}</span>
                {c.description && <span className="text-slate-500"> — {c.description}</span>}
              </div>
            ))
          )}
          {screeningOnly.length > 0 && (
            <div className="pt-2 mt-2 border-t border-slate-100">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Not used in search (screening only)</p>
              {screeningOnly.map(c => (
                <p key={c.id} className="text-[12px] text-slate-400">{c.type}: {c.name}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Search string card ───────────────────────────────────────────────────────

function SearchStringCard({ reviewId, item, index, onSaved, onDeleted }: {
  reviewId:  string
  item:      SearchStringItem
  index:     number
  onSaved:   () => void
  onDeleted: () => void
}) {
  const store = useSystematicReviewStore()
  const [expanded, setExpanded] = useState(true)
  const [text, setText] = useState(item.queryText)
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [addingTerm, setAddingTerm] = useState(false)
  const [termDraft, setTermDraft] = useState('')
  const [submittingTerm, setSubmittingTerm] = useState(false)
  const [pendingClear, setPendingClear] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(false)
  const termInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setText(item.queryText) }, [item.queryText])
  useEffect(() => { if (addingTerm) termInputRef.current?.focus() }, [addingTerm])

  const handleBlur = async () => {
    if (text === item.queryText) return
    const validation = await store.validateSearchString(reviewId, item.id, text)
    setErrors(validation.errors)
    setSaving(true)
    try {
      await store.updateSearchString(reviewId, item.id, text)
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const handleAddTerm = async () => {
    const term = termDraft.trim()
    if (!term) { setAddingTerm(false); return }
    setSubmittingTerm(true)
    try {
      await store.addSearchTerm(reviewId, item.id, term)
      setTermDraft('')
      setAddingTerm(false)
      setErrors([])
      onSaved()
    } finally {
      setSubmittingTerm(false)
    }
  }

  const handleRemoveTerm = async (termIndex: number) => {
    await store.removeSearchTerm(reviewId, item.id, termIndex)
    onSaved()
  }

  const handleClear = async () => {
    await store.clearSearchString(reviewId, item.id)
    setErrors([])
    setPendingClear(false)
    onSaved()
  }

  const handleDelete = async () => {
    await store.deleteSearchString(reviewId, item.id)
    setPendingDelete(false)
    onDeleted()
  }

  const statusMessage = item.isUserEdited
    ? 'Hand-edited — this query was typed directly and may no longer match its structured terms.'
    : item.terms.length > 0
    ? `Built from ${item.terms.length} structured term${item.terms.length === 1 ? '' : 's'}.`
    : 'No structured terms yet. Add terms below or edit the generated query directly.'

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-2.5 px-4 py-3 cursor-pointer hover:bg-slate-50/60 transition-colors"
      >
        <span className="text-[13px] font-bold text-slate-800">Search string {index + 1}</span>
        <div className="flex-1" />
        <button
          onClick={e => { e.stopPropagation(); setPendingDelete(true) }}
          className="text-[11px] text-slate-400 hover:text-red-500 transition-colors shrink-0"
        >
          trash
        </button>
        {expanded ? <ChevronUp size={14} className="text-slate-400 shrink-0" /> : <ChevronDown size={14} className="text-slate-400 shrink-0" />}
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-100">
          <p className="text-[11px] text-slate-400 mb-2 mt-3">{statusMessage}</p>

          {item.terms.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {item.terms.map((term, i) => (
                <span
                  key={`${term}-${i}`}
                  className="flex items-center gap-1 text-[11px] font-medium pl-2.5 pr-1.5 py-1 rounded-full bg-violet-100 text-violet-700"
                >
                  {term}
                  <button
                    onClick={() => handleRemoveTerm(i)}
                    className="text-violet-400 hover:text-violet-700 transition-colors"
                    title={`Remove "${term}"`}
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Query used for retrieval</label>
          <textarea
            rows={3}
            value={text}
            onChange={e => setText(e.target.value)}
            onBlur={handleBlur}
            placeholder="No structured terms yet. Add terms below or edit the generated query directly."
            className="w-full resize-y border border-slate-200 rounded-lg px-3 py-2 text-[12px] font-mono text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition placeholder-slate-400"
          />
          <p className="text-[11px] text-slate-400 mt-1.5">
            Structured terms control the executable query. Switch to raw editing if you want to paste a full boolean string.
          </p>
          {saving && <p className="text-[10px] text-slate-400 mt-1">Saving…</p>}
          {errors.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {errors.map(e => <li key={e} className="text-[11px] text-red-600">{e}</li>)}
            </ul>
          )}

          <div className="flex items-center gap-3 mt-2.5">
            {addingTerm ? (
              <div className="flex items-center gap-1.5">
                <input
                  ref={termInputRef}
                  value={termDraft}
                  onChange={e => setTermDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddTerm(); if (e.key === 'Escape') setAddingTerm(false) }}
                  placeholder="e.g. bronchial asthma"
                  className="border border-slate-200 rounded-lg px-2.5 py-1 text-[12px] text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition placeholder-slate-400 w-44"
                />
                <button
                  onClick={handleAddTerm}
                  disabled={submittingTerm || !termDraft.trim()}
                  className="text-[11px] font-semibold text-violet-600 hover:text-violet-700 transition-colors disabled:opacity-50"
                >
                  {submittingTerm ? <Loader2 size={11} className="animate-spin" /> : 'Add'}
                </button>
                <button onClick={() => setAddingTerm(false)} className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors">
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setAddingTerm(true)} className="text-[11px] font-medium text-violet-400 hover:text-violet-600 transition-colors">
                Add search term
              </button>
            )}
            <button
              onClick={() => (text.trim().length > 0 ? setPendingClear(true) : handleClear())}
              className="text-[11px] font-medium text-slate-400 hover:text-red-500 transition-colors"
            >
              Clear query
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {pendingClear && (
          <ConfirmActionModal
            title="Clear this search string?"
            message="This removes its structured terms and empties the query text. This can't be undone."
            confirmLabel="Clear"
            onClose={() => setPendingClear(false)}
            onConfirm={handleClear}
          />
        )}
        {pendingDelete && (
          <ConfirmActionModal
            title="Remove this search string?"
            message={`"Search string ${index + 1}" will be deleted.`}
            confirmLabel="Remove"
            onClose={() => setPendingDelete(false)}
            onConfirm={handleDelete}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// Archived whenever "Regenerate with AI" replaces the live search strings — read-only, informational.
function SearchStringHistoryPanel({ reviewId, refreshKey }: { reviewId: string; refreshKey: number }) {
  const getSearchStringHistory = useSystematicReviewStore(s => s.getSearchStringHistory)
  const [open, setOpen] = useState(false)
  const [history, setHistory] = useState<import('../../types/systematicReview').SearchStringHistoryItem[]>([])

  useEffect(() => {
    let cancelled = false
    getSearchStringHistory(reviewId).then(result => { if (!cancelled) setHistory(result) }).catch(() => {})
    return () => { cancelled = true }
  }, [reviewId, refreshKey, getSearchStringHistory])

  if (history.length === 0) return null

  return (
    <div className="border border-slate-200 rounded-xl p-4 mb-6">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between text-[13px] font-bold text-slate-800">
        Prior search strings ({history.length})
        {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] text-slate-500 mb-2">
            Replaced by a previous "Regenerate with AI" run — kept here so the exact query that produced earlier results stays reproducible.
          </p>
          {history.map(h => (
            <div key={h.id} className="text-[12px] bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-400">{formatDate(h.archivedAt)}</span>
                <span className="font-semibold text-slate-600">{h.fetchedPaperCount} paper{h.fetchedPaperCount === 1 ? '' : 's'} fetched</span>
              </div>
              <p className="font-mono text-slate-700 break-words">{h.queryText}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FormSearchStringsStep({ reviewId, detail, onSaved }: {
  reviewId: string
  detail:   SystematicReviewDetail
  onSaved:  () => void
}) {
  const store = useSystematicReviewStore()
  const [generating, setGenerating] = useState(false)
  const [addingBlank, setAddingBlank] = useState(false)
  const [pendingRegenerate, setPendingRegenerate] = useState(false)
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)
  const hasStrings = detail.searchStrings.length > 0

  const runGenerate = async () => {
    setGenerating(true)
    try {
      await store.generateSearchStrings(reviewId)
      onSaved()
    } finally {
      setGenerating(false)
      setPendingRegenerate(false)
      setHistoryRefreshKey(k => k + 1)
    }
  }

  const handleAddBlank = async () => {
    setAddingBlank(true)
    try {
      await store.createSearchString(reviewId)
      onSaved()
    } finally {
      setAddingBlank(false)
    }
  }

  return (
    <div className="max-w-3xl px-6 py-6">
      <h2 className="text-[18px] font-bold text-slate-900 mb-1">Form Search Strings</h2>
      <p className="text-[13px] text-slate-500 mb-5">
        Build boolean query blocks from structured terms. Each block is independent — add or remove as many as you need.
      </p>

      <CriteriaReferencePanel criteria={detail.criteria} />
      <SearchStringHistoryPanel reviewId={reviewId} refreshKey={historyRefreshKey} />

      {hasStrings && (
        <div className="space-y-3 mb-4">
          {detail.searchStrings.map((item, i) => (
            <SearchStringCard key={item.id} reviewId={reviewId} item={item} index={i} onSaved={onSaved} onDeleted={onSaved} />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          onClick={handleAddBlank}
          disabled={addingBlank}
          className="flex items-center gap-1.5 text-[12px] font-medium text-violet-400 hover:text-violet-600 transition-colors disabled:opacity-50"
        >
          {addingBlank ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          Add another search string
        </button>

        <button
          onClick={() => (hasStrings ? setPendingRegenerate(true) : runGenerate())}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[12px] font-semibold transition-colors shadow-sm shadow-violet-200 disabled:opacity-60"
        >
          {generating ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          {hasStrings ? 'Regenerate with AI' : 'Generate Search Strings'}
        </button>
      </div>

      <AnimatePresence>
        {pendingRegenerate && (
          <ConfirmActionModal
            title="Regenerate all search strings?"
            message="This replaces every search string with a fresh AI-generated set, including any you've hand-edited. This can't be undone."
            confirmLabel="Regenerate"
            onClose={() => setPendingRegenerate(false)}
            onConfirm={runGenerate}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Risk of Bias tool selector + step switch ───────────────────────────────
// RoB 2 is the default for every review (unchanged behavior). ROBINS-I is an opt-in alternative
// for non-randomized/observational studies — see RiskOfBiasTool's backend doc comment. Switching
// is blocked server-side once any assessment has started, so this UI doesn't need to precompute
// that itself; it just surfaces whatever error the API returns.

function RiskOfBiasSection({ reviewId, detail, onSaved }: {
  reviewId: string
  detail:   SystematicReviewDetail
  onSaved:  () => void
}) {
  const setRiskOfBiasTool = useSystematicReviewStore(s => s.setRiskOfBiasTool)
  const [switching, setSwitching] = useState(false)

  const handleSwitch = async (tool: 'RobTwo' | 'RobinsI') => {
    if (tool === detail.riskOfBiasTool) return
    setSwitching(true)
    try {
      await setRiskOfBiasTool(reviewId, tool)
    } catch {
      toast.error("Can't switch tools once assessment has started for this review.")
    } finally {
      setSwitching(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-6 pt-4 flex items-center gap-2">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Quality appraisal tool</span>
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
          <button
            onClick={() => handleSwitch('RobTwo')}
            disabled={switching}
            className={cn(
              'px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors',
              detail.riskOfBiasTool === 'RobTwo' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700',
            )}
          >
            Cochrane RoB 2 (RCTs)
          </button>
          <button
            onClick={() => handleSwitch('RobinsI')}
            disabled={switching}
            className={cn(
              'px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors',
              detail.riskOfBiasTool === 'RobinsI' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700',
            )}
          >
            ROBINS-I (non-randomized)
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        {detail.riskOfBiasTool === 'RobinsI'
          ? <RobinsIStep reviewId={reviewId} detail={detail} onSaved={onSaved} />
          : <RiskOfBiasStep reviewId={reviewId} detail={detail} onSaved={onSaved} />}
      </div>
    </div>
  )
}

// ── Coming soon (stub for later pipeline steps) ────────────────────────────

function ComingSoonStep({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6 py-16">
      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-4">
        <ClipboardList size={22} className="text-slate-400" />
      </div>
      <p className="text-[14px] font-semibold text-slate-700 mb-1">{label} is coming soon</p>
      <p className="text-[12px] text-slate-400 max-w-sm">
        This step isn't built yet — check back after eligibility criteria are in place.
      </p>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function SystematicReviewWorkspacePage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const store = useSystematicReviewStore()

  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [showPrismaDiagram, setShowPrismaDiagram] = useState(false)

  useEffect(() => {
    if (!id) return
    store.loadDetail(id).catch(() => setLoadError(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const detail = id ? store.details[id] : undefined

  const urlStep = searchParams.get('step')
  const currentStepId: StepId = PIPELINE_STEPS.some(s => s.id === urlStep) ? (urlStep as StepId) : 'eligibility'
  const currentIdx = PIPELINE_STEPS.findIndex(s => s.id === currentStepId)
  const nextStep = currentIdx < PIPELINE_STEPS.length - 1 ? PIPELINE_STEPS[currentIdx + 1] : null

  const goToStep = (stepId: StepId) => setSearchParams({ step: stepId }, { replace: false })
  const handleSaved = () => setLastSavedAt(new Date())
  const handleAutoRun = () => toast("Auto-run isn't available yet — complete each step manually for now.")

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <p className="text-[14px] font-semibold text-slate-700 mb-2">Couldn't load this review</p>
        <button onClick={() => navigate('/app/systematic-review')} className="text-[13px] text-violet-600 hover:text-violet-700 font-medium">
          Back to Systematic Reviews
        </button>
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={20} className="animate-spin text-violet-500" />
      </div>
    )
  }

  const nextDisabled = currentStepId === 'eligibility'
    ? detail.criteria.length === 0
    : currentStepId === 'search-strings'
    ? !detail.searchStrings.some(s => s.queryText.trim().length > 0)
    : currentStepId === 'fetch-papers'
    ? (detail.paperCount || 0) === 0
    : currentStepId === 'dedup'
    ? !detail.latestDedupeRun
    : currentStepId === 'screening-ta'
    ? !detail.screeningSummary || detail.screeningSummary.pending > 0
    : currentStepId === 'screening-ft'
    ? detail.fullTextScreeningSummary
      ? detail.fullTextScreeningSummary.pending > 0
      // No full-text summary can mean two very different things: Title & Abstract screening
      // hasn't resolved yet (keep Next disabled), or it resolved with zero papers Included —
      // there's genuinely nothing to full-text-screen, so don't trap the user here forever.
      : !detail.screeningSummary || detail.screeningSummary.pending > 0 || detail.screeningSummary.included > 0
    : currentStepId === 'extraction'
    ? detail.extractionVariables.length > 0 && !detail.extractionSkipped
      && (!detail.extractionSummary || detail.extractionSummary.extracted < detail.extractionSummary.total)
    : currentStepId === 'risk-of-bias'
    ? !detail.riskOfBiasSkipped && !!detail.riskOfBiasSummary && detail.riskOfBiasSummary.pending > 0
    : currentStepId === 'evidence-grading'
    ? !detail.evidenceGradingSkipped && !!detail.evidenceGradingSummary && detail.evidenceGradingSummary.pending > 0
    : false

  return (
    <div className="flex h-full overflow-hidden bg-white">
      <div className="flex-1 flex flex-col overflow-hidden">
        <WorkspaceHeader
          detail={detail}
          lastSavedAt={lastSavedAt}
          nextStepLabel={nextStep?.label ?? PIPELINE_STEPS[0].label}
          nextDisabled={nextDisabled}
          currentStepId={currentStepId}
          onNext={() => goToStep(nextStep ? nextStep.id : PIPELINE_STEPS[0].id)}
          onAutoRun={handleAutoRun}
          onOpenPrismaDiagram={() => setShowPrismaDiagram(true)}
          onMarkReviewed={() => store.markCheckpointReviewed(detail.id, currentStepId)}
        />
        <div className="flex-1 overflow-y-auto">
          {currentIdx >= PIPELINE_STEPS.findIndex(s => s.id === 'screening-ft') && <ReviewSummaryBar reviewId={detail.id} />}
          {currentStepId === 'eligibility' && <EligibilityCriteriaStep reviewId={detail.id} detail={detail} onSaved={handleSaved} />}
          {currentStepId === 'search-strings' && <FormSearchStringsStep reviewId={detail.id} detail={detail} onSaved={handleSaved} />}
          {currentStepId === 'fetch-papers' && <FetchPapersStep reviewId={detail.id} detail={detail} onSaved={handleSaved} />}
          {currentStepId === 'dedup' && <DedupeFilterStep reviewId={detail.id} detail={detail} onSaved={handleSaved} />}
          {currentStepId === 'screening-ta' && <TitleAbstractScreeningStep reviewId={detail.id} detail={detail} onSaved={handleSaved} />}
          {currentStepId === 'screening-ft' && <FullTextScreeningStep reviewId={detail.id} detail={detail} onSaved={handleSaved} />}
          {currentStepId === 'snowball' && <SnowballStep reviewId={detail.id} detail={detail} onSaved={handleSaved} />}
          {currentStepId === 'extraction' && <ExtractionStep reviewId={detail.id} detail={detail} onSaved={handleSaved} />}
          {currentStepId === 'risk-of-bias' && <RiskOfBiasSection reviewId={detail.id} detail={detail} onSaved={handleSaved} />}
          {currentStepId === 'evidence-grading' && <EvidenceGradingStep reviewId={detail.id} detail={detail} onSaved={handleSaved} />}
          {currentStepId === 'write-slr' && <WriteSlrStep reviewId={detail.id} detail={detail} onSaved={handleSaved} />}
          {currentStepId !== 'eligibility' && currentStepId !== 'search-strings' && currentStepId !== 'fetch-papers' && currentStepId !== 'dedup' && currentStepId !== 'screening-ta' && currentStepId !== 'screening-ft' && currentStepId !== 'snowball' && currentStepId !== 'extraction' && currentStepId !== 'risk-of-bias' && currentStepId !== 'evidence-grading' && currentStepId !== 'write-slr' && <ComingSoonStep label={PIPELINE_STEPS[currentIdx].label} />}
        </div>
      </div>
      <RightRail detail={detail} currentStepId={currentStepId} onSelectStep={goToStep} />
      <AnimatePresence>
        {showPrismaDiagram && (
          <PrismaFlowDiagram reviewId={detail.id} onClose={() => setShowPrismaDiagram(false)} />
        )}
      </AnimatePresence>
    </div>
  )
}
