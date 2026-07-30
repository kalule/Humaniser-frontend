import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  FileText, BookOpen, Settings2, ShieldCheck, Database, BarChart2, PenLine,
  CheckCircle2, GraduationCap, Loader2, ArrowRight, AlertCircle, Download,
  ExternalLink, ListChecks, RefreshCw, Sparkles, MessageSquare, Play, Check, X,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useResearchStore } from '../../store/researchStore'
import { researchApi } from '../../api/research'
import { ToolSidebar } from '../../components/layout/ToolSidebar'
import { Modal } from '../../components/ui/Modal'
import { CHAPTER_STEPS } from '../../data/proposalOutline'
import { ExternalFactsReviewPanel } from '../../components/research-agent/ExternalFactsReviewPanel'
import type { ApiError } from '../../types'
import type {
  FetchedLiterature, FactConflict, ProjectSection, RubricScores, HypothesisOutcome,
  ResearchRoadmap, MilestoneStatus, ReadinessEvaluation, CheckStatus, GraphGap,
  ResearchProject, ValidationSummary, ExternalFact, GenerationPhase,
  MethodologyAnchorCandidate,
} from '../../types/research'

// Flat per-section word-count default for a dashboard-triggered "resume" run — this screen has
// no word-count configurator (unlike the Proposal Studio creation modal), so Start Process just
// writes a reasonable default length per remaining chapter.
const RESUME_SECTION_WORD_COUNT = 400
// Poll interval for generation-status while a resumed run is in flight — matches
// useAutonomousProposalFlow's polling cadence in AutonomousProposalTools.tsx.
const GENERATION_POLL_MS = 2500

// ── Research Dashboard ───────────────────────────────────────────────────────
// The landing page for a Thesis Studio project ("Research Project") — replaces
// jumping straight into the chapter wizard with a proper project home: named
// sections for every part of the research lifecycle, each reusing data that
// already exists elsewhere in the app (sections, literature, hypotheses,
// analysis plan, thesis audit, fact conflicts, defence prep). Ethics and Data
// Collection have no backing entity yet, so those two tabs say so honestly
// instead of faking content.

type TabKey = 'proposal' | 'literature' | 'methodology' | 'ethics' | 'data-collection' | 'analysis' | 'writing' | 'roadmap' | 'validation' | 'submission'

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'proposal',        label: 'Proposal',        icon: FileText },
  { key: 'literature',      label: 'Literature',      icon: BookOpen },
  { key: 'methodology',     label: 'Methodology',     icon: Settings2 },
  { key: 'ethics',          label: 'Ethics',          icon: ShieldCheck },
  { key: 'data-collection', label: 'Data Collection', icon: Database },
  { key: 'analysis',        label: 'Analysis',        icon: BarChart2 },
  { key: 'writing',         label: 'Writing',         icon: PenLine },
  { key: 'roadmap',         label: 'Roadmap',         icon: ListChecks },
  { key: 'validation',      label: 'Validation',      icon: CheckCircle2 },
  { key: 'submission',      label: 'Submission',      icon: GraduationCap },
]

const MILESTONE_STATUS_STYLES: Record<MilestoneStatus, string> = {
  NotStarted: 'bg-slate-100 text-slate-500',
  InProgress: 'bg-amber-tint text-amber-text',
  Complete:   'bg-green-tint text-green-text',
  Skipped:    'bg-slate-100 text-slate-400',
}

const CHECK_STATUS_STYLES: Record<CheckStatus, string> = {
  Pass:          'bg-green-tint text-green-text',
  Warning:       'bg-amber-tint text-amber-text',
  Fail:          'bg-red-100 text-red-700',
  NotApplicable: 'bg-slate-100 text-slate-400',
}

const SECTION_STATUS_STYLES: Record<ProjectSection['status'], string> = {
  NotStarted: 'bg-slate-100 text-slate-500',
  Generating: 'bg-amber-tint text-amber-text',
  Draft:      'bg-amber-tint text-amber-text',
  Edited:     'bg-sky-100 text-sky-700',
  Approved:   'bg-green-tint text-green-text',
}

const RUBRIC_PILLAR_LABELS: Record<keyof RubricScores, string> = {
  scope:                   'Scope',
  methodologicalAlignment: 'Methodological Alignment',
  writingClarity:          'Writing Clarity',
  citationRigor:           'Citation Rigor',
  limitationsMaturity:     'Limitations Maturity',
}

const RUBRIC_SCORE_STYLES: Record<string, string> = {
  weak:       'bg-red-100 text-red-700',
  developing: 'bg-amber-100 text-amber-700',
  strong:     'bg-emerald-100 text-emerald-700',
}

const HYPOTHESIS_OUTCOME_STYLES: Record<HypothesisOutcome, string> = {
  Pending:      'bg-slate-100 text-slate-500',
  Supported:    'bg-green-tint text-green-text',
  Refuted:      'bg-red-100 text-red-700',
  Inconclusive: 'bg-amber-tint text-amber-text',
}

function EmptyPlaceholder({ icon: Icon, title, subtitle, note }: {
  icon: React.ElementType
  title: string
  subtitle: string
  note?: string
}) {
  return (
    <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-xl">
      <Icon size={28} className="text-slate-300 mx-auto mb-3" />
      <p className="text-[13px] font-semibold text-slate-700 mb-1">{title}</p>
      <p className="text-[12px] text-slate-500 max-w-md mx-auto">{subtitle}</p>
      {note && <p className="text-[11px] text-slate-400 mt-3 max-w-md mx-auto">{note}</p>}
    </div>
  )
}

// ── Proposal tab ─────────────────────────────────────────────────────────────

function ProposalTab({ projectId, isExternallySourced, onOpenWriting }: {
  projectId: string
  isExternallySourced: boolean
  onOpenWriting: () => void
}) {
  const { sections: allSections, loadSections } = useResearchStore()
  const sections = allSections[projectId]
  const [loading, setLoading] = useState(!sections)
  const [externalFacts, setExternalFacts] = useState<ExternalFact[]>([])

  useEffect(() => {
    if (sections) return
    setLoading(true)
    loadSections(projectId).finally(() => setLoading(false))
  }, [projectId])

  useEffect(() => {
    if (!isExternallySourced) return
    researchApi.getExternalFacts(projectId).then(setExternalFacts).catch(() => setExternalFacts([]))
  }, [projectId, isExternallySourced])

  const handleConfirmFact = (factKey: string) => {
    researchApi.confirmExternalFact(projectId, factKey)
      .then(() => setExternalFacts(facts => facts.map(f => f.factKey === factKey ? { ...f, locked: true } : f)))
      .catch(console.error)
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin text-slate-400" /></div>
  }

  const hasUnconfirmedFacts = externalFacts.some(f => !f.locked)

  return (
    <div className="space-y-2">
      {isExternallySourced && hasUnconfirmedFacts && (
        <div className="rounded-xl border border-amber-200 mb-3 overflow-hidden">
          <div className="px-4 py-3 bg-white">
            <p className="text-[12px] font-semibold text-amber-800 mb-1">Unverified — extracted from uploaded document</p>
            <p className="text-[11px] text-slate-500">
              This project was created from an uploaded PDF. Review the facts below and confirm each one is correct.
            </p>
          </div>
          <ExternalFactsReviewPanel facts={externalFacts} onConfirm={handleConfirmFact} />
        </div>
      )}
      <p className="text-[12px] text-slate-500 mb-3">
        The five founding chapters this project was approved on. Content lives in the chapter editor — this is a read-only summary.
      </p>
      {CHAPTER_STEPS.map(step => {
        const sec = sections?.find(s => s.code === step.sectionKey)
        return (
          <div key={step.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-2.5">
            <p className="text-[13px] font-medium text-slate-700">{step.label}</p>
            <div className="flex items-center gap-3 shrink-0">
              {sec && <span className="text-[11px] text-slate-400">{sec.wordCount.toLocaleString()} words</span>}
              <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full', SECTION_STATUS_STYLES[sec?.status ?? 'NotStarted'])}>
                {sec?.status ?? 'NotStarted'}
              </span>
            </div>
          </div>
        )
      })}
      <button
        onClick={onOpenWriting}
        className="flex items-center gap-1.5 text-[12px] font-medium text-violet-600 hover:text-violet-800 transition-colors mt-3"
      >
        Open chapter editor <ArrowRight size={12} />
      </button>
    </div>
  )
}

// ── Literature tab ───────────────────────────────────────────────────────────

function LiteratureTab({ projectId }: { projectId: string }) {
  const [literature, setLiterature] = useState<FetchedLiterature[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    researchApi.getLiterature(projectId)
      .then(setLiterature)
      .catch(() => setLiterature([]))
      .finally(() => setLoading(false))
  }, [projectId])

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin text-slate-400" /></div>
  }

  if (!literature || literature.length === 0) {
    return (
      <EmptyPlaceholder
        icon={BookOpen}
        title="No literature gathered yet"
        subtitle="Sources are collected during the Literature Gathering step of the chapter editor, or drawn from your Web Library."
      />
    )
  }

  return (
    <div className="space-y-3">
      {literature.map((lit, i) => (
        <div key={i} className="rounded-xl border border-slate-200 p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[13px] font-semibold text-slate-800 leading-snug">{lit.title}</p>
            <span className={cn(
              'shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full',
              lit.includedByStudent ? 'bg-green-tint text-green-text' : 'bg-slate-100 text-slate-500',
            )}>
              {lit.includedByStudent ? 'Included' : 'Not included'}
            </span>
          </div>
          <p className="text-[12px] text-slate-500 mt-1">{lit.authors}{lit.year ? ` (${lit.year})` : ''}</p>
          {lit.abstract && <p className="text-[12px] text-slate-600 mt-2 line-clamp-2">{lit.abstract}</p>}
          <p className="text-[11px] text-slate-400 mt-2">Source: {lit.source}</p>
        </div>
      ))}
    </div>
  )
}

// ── Methodology tab ──────────────────────────────────────────────────────────

function MethodologyCoverage({ projectId }: { projectId: string }) {
  const [gaps, setGaps] = useState<GraphGap[] | null>(null)

  useEffect(() => {
    researchApi.getGraphGaps(projectId, 'ProjectSection', 'anchors')
      .then(setGaps)
      // No graph data yet for this project (or the call fails) — this is a bonus signal,
      // not a blocking one, so stay silent rather than show an error.
      .catch(() => setGaps(null))
  }, [projectId])

  if (!gaps || gaps.length === 0) return null

  return (
    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <p className="text-[12px] font-semibold text-amber-800 mb-1">
        {gaps.length} section{gaps.length === 1 ? '' : 's'} still need{gaps.length === 1 ? 's' : ''} a foundational citation
      </p>
      <p className="text-[11px] text-amber-700">
        {gaps.map(g => g.node.labelSnapshot).join(', ')}
      </p>
    </div>
  )
}

function MethodologyTab({ projectId, methodologyType, methodologySubType, onOpenWriting }: {
  projectId: string
  methodologyType?: string
  methodologySubType?: string
  onOpenWriting: () => void
}) {
  if (!methodologyType) {
    return (
      <EmptyPlaceholder
        icon={Settings2}
        title="Methodology not set yet"
        subtitle="Choose a methodology type (Qualitative / Quantitative / Mixed Methods) in the chapter editor's Methodology Type step — every later chapter reads from that choice."
      />
    )
  }
  return (
    <div className="rounded-xl border border-slate-200 p-5">
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Methodology Type</p>
      <p className="text-[16px] font-bold text-slate-800">{methodologyType}</p>
      {methodologySubType && (
        <p className="text-[13px] text-slate-500 mt-1">Refinement: {methodologySubType}</p>
      )}
      <p className="text-[12px] text-slate-500 mt-4">
        Full design details (study design, population, sampling, instruments) are written out in Chapter 5 of the proposal.
      </p>
      <button
        onClick={onOpenWriting}
        className="flex items-center gap-1.5 text-[12px] font-medium text-violet-600 hover:text-violet-800 transition-colors mt-3"
      >
        Open chapter editor <ArrowRight size={12} />
      </button>
      <MethodologyCoverage projectId={projectId} />
    </div>
  )
}

// ── Ethics / Data Collection placeholders ────────────────────────────────────
// No backing entity exists for either today — honest placeholders, not faked
// tracking, pointing at where the closest real content actually lives.

function EthicsTab({ onOpenWriting }: { onOpenWriting: () => void }) {
  return (
    <div>
      <EmptyPlaceholder
        icon={ShieldCheck}
        title="Ethics isn't tracked as its own record yet"
        subtitle="Today, ethics is covered as prose in Section 5.11 (Ethical Considerations) of the chapter editor — informed consent, confidentiality, and IRB/ethics-board approval are described there."
        note="A structured, trackable ethics-approval record (status, approval date, board name, attached certificate) is a planned future addition, not built yet."
      />
      <button
        onClick={onOpenWriting}
        className="flex items-center gap-1.5 text-[12px] font-medium text-violet-600 hover:text-violet-800 transition-colors mt-3 mx-auto w-fit"
      >
        Open Section 5.11 in the chapter editor <ArrowRight size={12} />
      </button>
    </div>
  )
}

function DataCollectionTab({ onOpenWriting }: { onOpenWriting: () => void }) {
  return (
    <div>
      <EmptyPlaceholder
        icon={Database}
        title="Datasets aren't linked to this project yet"
        subtitle="Your planned data-collection instruments and procedures are described as prose in Section 5.8 of the chapter editor. The Data Analyst tool's datasets exist independently and aren't yet connected to a specific research project."
        note="Linking an uploaded dataset directly to this project is a planned future addition, not built yet."
      />
      <button
        onClick={onOpenWriting}
        className="flex items-center gap-1.5 text-[12px] font-medium text-violet-600 hover:text-violet-800 transition-colors mt-3 mx-auto w-fit"
      >
        Open Section 5.8 in the chapter editor <ArrowRight size={12} />
      </button>
    </div>
  )
}

// ── Analysis tab ──────────────────────────────────────────────────────────────

function AnalysisTab({ projectId }: { projectId: string }) {
  const { hypotheses: allHypotheses, analysisPlan: allPlans, loadHypotheses, loadAnalysisPlan } = useResearchStore()
  const hypotheses = allHypotheses[projectId]
  const plan       = allPlans[projectId]
  const [loading, setLoading] = useState(!hypotheses || !plan)

  useEffect(() => {
    if (hypotheses && plan) return
    setLoading(true)
    Promise.all([
      hypotheses ? Promise.resolve() : loadHypotheses(projectId),
      plan ? Promise.resolve() : loadAnalysisPlan(projectId),
    ]).finally(() => setLoading(false))
  }, [projectId])

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin text-slate-400" /></div>
  }

  const noHypotheses = !hypotheses || hypotheses.length === 0
  const noPlan        = !plan || plan.length === 0

  if (noHypotheses && noPlan) {
    return (
      <EmptyPlaceholder
        icon={BarChart2}
        title="No hypotheses or analysis plan yet"
        subtitle="These are generated from your research questions and objectives inside the chapter editor's Chapter 4 workflow."
      />
    )
  }

  return (
    <div className="space-y-6">
      {!noHypotheses && (
        <div>
          <p className="text-[12px] font-semibold text-slate-700 mb-2">Hypotheses</p>
          <div className="space-y-2">
            {hypotheses!.map(h => (
              <div key={h.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[13px] font-medium text-slate-700">H{h.number}: {h.alternativeHypothesis}</p>
                  <span className={cn('shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full', HYPOTHESIS_OUTCOME_STYLES[h.outcome])}>
                    {h.outcome}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {h.independentVariable} → {h.dependentVariable} · {h.plannedStatisticalTest}
                </p>
                {h.outcomeNarrative && <p className="text-[12px] text-slate-600 mt-2">{h.outcomeNarrative}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
      {!noPlan && (
        <div>
          <p className="text-[12px] font-semibold text-slate-700 mb-2">Analysis Plan</p>
          <div className="space-y-2">
            {plan!.map(p => (
              <div key={p.id} className="rounded-xl border border-slate-200 p-4">
                <p className="text-[13px] font-medium text-slate-700">{p.objectiveText}</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {p.descriptiveApproach} · {p.inferentialTest} · {p.softwarePackage}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Writing tab ───────────────────────────────────────────────────────────────

function WritingTab({ projectId, onOpenWriting }: { projectId: string; onOpenWriting: () => void }) {
  const { sections: allSections, loadSections } = useResearchStore()
  const sections = allSections[projectId]
  const [loading, setLoading] = useState(!sections)

  useEffect(() => {
    if (sections) return
    setLoading(true)
    loadSections(projectId).finally(() => setLoading(false))
  }, [projectId])

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin text-slate-400" /></div>
  }

  const sorted    = [...(sections ?? [])].sort((a, b) => a.order - b.order)
  const approved  = sorted.filter(s => s.status === 'Approved').length
  const total     = sorted.length

  return (
    <div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 mb-5 flex items-center justify-between">
        <div>
          <p className="text-[13px] font-semibold text-slate-800">{approved} of {total} sections approved</p>
          <p className="text-[12px] text-slate-500 mt-0.5">Every chapter — proposal and thesis — lives in one continuous editor.</p>
        </div>
        <button
          onClick={onOpenWriting}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-[12px] font-semibold transition-colors shrink-0"
        >
          Open Chapter Editor <ArrowRight size={13} />
        </button>
      </div>
      <div className="space-y-1.5">
        {sorted.map(sec => (
          <div key={sec.code} className="flex items-center justify-between gap-3 px-4 py-2 rounded-lg hover:bg-slate-50">
            <p className="text-[12px] text-slate-600">{sec.code} {sec.title}</p>
            <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0', SECTION_STATUS_STYLES[sec.status])}>
              {sec.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Roadmap tab ───────────────────────────────────────────────────────────────

const MILESTONE_STATUS_OPTIONS: MilestoneStatus[] = ['NotStarted', 'InProgress', 'Complete', 'Skipped']

function RoadmapTab({ projectId }: { projectId: string }) {
  const [roadmap, setRoadmap] = useState<ResearchRoadmap | null>(null)
  const [loading, setLoading] = useState(true)
  const [updatingKey, setUpdatingKey] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    researchApi.getRoadmap(projectId)
      .then(setRoadmap)
      .catch(() => setRoadmap(null))
      .finally(() => setLoading(false))
  }

  useEffect(load, [projectId])

  const handleManualUpdate = async (key: string, status: MilestoneStatus) => {
    setUpdatingKey(key)
    try {
      const updated = await researchApi.updateMilestone(projectId, key, status)
      setRoadmap(updated)
    } catch {
      // Auto-tracked milestones reject manual updates server-side — reload to show the
      // real (unchanged) status rather than leaving the dropdown in a stale state.
      load()
    } finally {
      setUpdatingKey(null)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin text-slate-400" /></div>
  }

  if (!roadmap) {
    return (
      <EmptyPlaceholder
        icon={ListChecks}
        title="Roadmap not available yet"
        subtitle="The milestone checklist is generated once a project transitions to thesis."
      />
    )
  }

  // The page's answer to "what should I do next" — the first required milestone that isn't
  // already Complete/Skipped, in display order. Not just another row in the list below.
  const nextMilestone = [...roadmap.milestones]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .find(m => m.isRequired && (m.status === 'NotStarted' || m.status === 'InProgress'))

  return (
    <div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 mb-4">
        <p className="text-[13px] font-semibold text-slate-800">
          {roadmap.completedCount} of {roadmap.requiredCount} required milestones complete
        </p>
        <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
          <div
            className="h-full rounded-full bg-violet-600 transition-all"
            style={{ width: `${roadmap.progressPercent}%` }}
          />
        </div>
      </div>

      {nextMilestone && (
        <div className="flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 mb-5">
          <Sparkles size={16} className="text-violet-600 shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-violet-600 uppercase tracking-wider">Up next</p>
            <p className="text-[13px] font-semibold text-slate-800 truncate">{nextMilestone.label}</p>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        {roadmap.milestones.map(m => (
          <div key={m.key} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-2.5">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-slate-700">{m.label}</p>
              {m.isAutoTracked && (
                <p className="text-[11px] text-slate-400 mt-0.5">Auto-tracked from the chapter editor</p>
              )}
              {m.notes && <p className="text-[11px] text-slate-500 mt-0.5">{m.notes}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {m.isAutoTracked ? (
                <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full', MILESTONE_STATUS_STYLES[m.status])}>
                  {m.status}
                </span>
              ) : (
                <select
                  value={m.status}
                  disabled={updatingKey === m.key}
                  onChange={e => handleManualUpdate(m.key, e.target.value as MilestoneStatus)}
                  className={cn(
                    'text-[11px] font-medium px-2 py-1 rounded-full border-0 outline-none cursor-pointer disabled:opacity-50',
                    MILESTONE_STATUS_STYLES[m.status],
                  )}
                >
                  {MILESTONE_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Validation tab ────────────────────────────────────────────────────────────

function ValidationTab({ projectId }: { projectId: string }) {
  const { thesisAudit, isLoadingThesisAudit, loadThesisAudit } = useResearchStore()
  const audit = thesisAudit[projectId]
  const [conflicts, setConflicts] = useState<FactConflict[] | null>(null)
  const [readiness, setReadiness] = useState<ReadinessEvaluation | null>(null)
  const [loadingReadiness, setLoadingReadiness] = useState(true)
  const [refreshingReadiness, setRefreshingReadiness] = useState(false)

  const loadReadiness = () => {
    setLoadingReadiness(true)
    researchApi.getReadiness('Proposal', projectId)
      .then(setReadiness)
      .catch(() => setReadiness(null))
      .finally(() => setLoadingReadiness(false))
  }

  useEffect(() => {
    if (!audit) loadThesisAudit(projectId)
    researchApi.getFactConflicts(projectId).then(setConflicts).catch(() => setConflicts([]))
    loadReadiness()
  }, [projectId])

  const handleRefreshReadiness = async () => {
    setRefreshingReadiness(true)
    try {
      const result = await researchApi.refreshReadiness('Proposal', projectId)
      setReadiness(result)
    } finally {
      setRefreshingReadiness(false)
    }
  }

  const openConflicts = conflicts?.filter(c => c.status === 'Open') ?? []

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[12px] font-semibold text-slate-700">Readiness Score</p>
          <button
            onClick={handleRefreshReadiness}
            disabled={refreshingReadiness || loadingReadiness}
            className="flex items-center gap-1.5 text-[11px] font-medium text-violet-600 hover:text-violet-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={11} className={cn(refreshingReadiness && 'animate-spin')} /> Re-check Readiness
          </button>
        </div>
        {loadingReadiness ? (
          <div className="flex justify-center py-6"><Loader2 size={16} className="animate-spin text-slate-400" /></div>
        ) : readiness ? (
          <div className="rounded-xl border border-slate-200 p-4 mb-3">
            <div className="flex items-center gap-3 mb-3">
              <p className="text-[24px] font-bold text-slate-800">{readiness.score}%</p>
              <span className={cn(
                'text-[11px] font-semibold px-2.5 py-1 rounded-full',
                readiness.isReady ? 'bg-green-tint text-green-text' : 'bg-amber-tint text-amber-text',
              )}>
                {readiness.isReady ? 'Ready for Thesis' : 'Not Ready'}
              </span>
            </div>
            <div className="space-y-1.5">
              {readiness.criteria.map(c => (
                <div key={c.key} className="flex items-start gap-2 text-[11px]">
                  <span className={cn('shrink-0 px-1.5 py-0.5 rounded font-semibold', CHECK_STATUS_STYLES[c.status])}>
                    {c.status}
                  </span>
                  <span className="shrink-0 font-semibold text-slate-700">{c.label}:</span>
                  {c.message && <span className="text-slate-600">{c.message}</span>}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-[12px] text-slate-400 mb-3">Readiness not available yet.</p>
        )}
      </div>

      <div>
        <p className="text-[12px] font-semibold text-slate-700 mb-2">Readiness Audit</p>
        {isLoadingThesisAudit && !audit ? (
          <div className="flex items-center gap-2 text-[12px] text-slate-500 py-4">
            <Loader2 size={14} className="animate-spin" /> Running audit…
          </div>
        ) : audit ? (
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-[12px] text-slate-700 whitespace-pre-wrap mb-3">{audit.narrative}</p>
            <div className="space-y-1.5">
              {(Object.keys(RUBRIC_PILLAR_LABELS) as (keyof RubricScores)[]).map(key => {
                const pillar = audit.rubricScores[key]
                if (!pillar) return null
                return (
                  <div key={key} className="flex items-start gap-2 text-[11px]">
                    <span className={cn('shrink-0 px-1.5 py-0.5 rounded font-semibold', RUBRIC_SCORE_STYLES[pillar.score])}>
                      {pillar.score}
                    </span>
                    <span className="shrink-0 font-semibold text-slate-700">{RUBRIC_PILLAR_LABELS[key]}:</span>
                    <span className="text-slate-600">{pillar.evidence}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <p className="text-[12px] text-slate-400">No audit yet.</p>
        )}
      </div>

      <div>
        <p className="text-[12px] font-semibold text-slate-700 mb-2">
          Fact Conflicts {conflicts && `(${openConflicts.length} open)`}
        </p>
        {conflicts === null ? (
          <div className="flex justify-center py-6"><Loader2 size={16} className="animate-spin text-slate-400" /></div>
        ) : openConflicts.length === 0 ? (
          <p className="text-[12px] text-slate-400">No unresolved fact conflicts across your chapters.</p>
        ) : (
          <div className="space-y-2">
            {openConflicts.map(c => (
              <div key={c.id} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                <AlertCircle size={13} className="shrink-0 mt-0.5" />
                <span>
                  <strong>{c.factKey}</strong> — Section {c.conflictingSectionCode} says "{c.conflictingValue}", but Section {c.canonicalSourceSectionCode} says "{c.canonicalValue}".
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Submission tab ────────────────────────────────────────────────────────────

function SubmissionTab({ projectId, onOpenWriting }: { projectId: string; onOpenWriting: () => void }) {
  const { defence: allDefence, loadDefence, isGeneratingDefence, exportThesisDocx } = useResearchStore()
  const defence = allDefence[projectId]
  const [loading, setLoading]     = useState(!defence)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (defence) return
    setLoading(true)
    loadDefence(projectId).finally(() => setLoading(false))
  }, [projectId])

  const handleExport = async () => {
    setExporting(true)
    try { await exportThesisDocx(projectId) } finally { setExporting(false) }
  }

  if (loading || isGeneratingDefence) {
    return <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin text-slate-400" /></div>
  }

  const checkedCount = defence?.checklist.filter(i => i.checked).length ?? 0

  return (
    <div className="space-y-4">
      {defence ? (
        <div className="rounded-xl border border-slate-200 p-5">
          <div className="grid grid-cols-3 gap-4 text-center mb-4">
            <div>
              <p className="text-[20px] font-bold text-slate-800">{defence.examinerQuestions.length}</p>
              <p className="text-[11px] text-slate-500">Examiner questions</p>
            </div>
            <div>
              <p className="text-[20px] font-bold text-slate-800">{defence.checklist.length ? `${checkedCount}/${defence.checklist.length}` : '—'}</p>
              <p className="text-[11px] text-slate-500">Checklist done</p>
            </div>
            <div>
              <p className="text-[20px] font-bold text-slate-800">{defence.vivaOpeningStatement ? 'Ready' : '—'}</p>
              <p className="text-[11px] text-slate-500">Viva statement</p>
            </div>
          </div>
          <button
            onClick={onOpenWriting}
            className="flex items-center gap-1.5 text-[12px] font-medium text-violet-600 hover:text-violet-800 transition-colors"
          >
            Open Defence Prep <ArrowRight size={12} />
          </button>
        </div>
      ) : (
        <EmptyPlaceholder
          icon={GraduationCap}
          title="No defence preparation yet"
          subtitle="Generate examiner questions, a viva opening statement, and a pre-viva checklist once your Results and Discussion chapters are drafted."
        />
      )}

      <button
        onClick={handleExport}
        disabled={exporting}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-[13px] font-semibold transition-colors disabled:opacity-50"
      >
        {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        Export Thesis (.docx)
      </button>
    </div>
  )
}

// ── Right panel: Validation ───────────────────────────────────────────────────
// Wired to the real, already-shipped Validation Engine (GET/POST .../validation/projects/{id})
// — distinct from ValidationTab above, which surfaces Readiness + Thesis Audit + Fact Conflicts.

const METHODOLOGY_ANCHOR_CHECK_KEY = 'methodology_anchor_present'

function ValidationPanel({ projectId }: { projectId: string }) {
  const [summary, setSummary] = useState<ValidationSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [revalidating, setRevalidating] = useState(false)
  const [showAnchorModal, setShowAnchorModal] = useState(false)

  const load = () => {
    setLoading(true)
    researchApi.getValidationSummary(projectId)
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setLoading(false))
  }

  useEffect(load, [projectId])

  const handleRevalidate = async () => {
    setRevalidating(true)
    try {
      setSummary(await researchApi.revalidate(projectId))
    } finally {
      setRevalidating(false)
    }
  }

  const topItems = summary ? [...summary.fails, ...summary.warnings].slice(0, 5) : []
  const anchorFailCount = summary?.fails.filter(f => f.checkKey === METHODOLOGY_ANCHOR_CHECK_KEY).length ?? 0

  return (
    <div className="p-4 border-b border-slate-200">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">Validation</p>
        <button
          onClick={handleRevalidate}
          disabled={revalidating || loading}
          aria-label="Re-run validation"
          className="text-slate-400 hover:text-violet-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={cn(revalidating && 'animate-spin')} />
        </button>
      </div>
      {loading ? (
        <div className="flex justify-center py-4"><Loader2 size={14} className="animate-spin text-slate-400" /></div>
      ) : !summary ? (
        <p className="text-[11px] text-slate-400">Not yet checked.</p>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-[11px] font-medium text-red-700">{summary.fails.length} fail{summary.fails.length === 1 ? '' : 's'}</span>
            <span className="text-[11px] font-medium text-amber-700">{summary.warnings.length} warning{summary.warnings.length === 1 ? '' : 's'}</span>
            <span className="text-[11px] font-medium text-green-700">{summary.passes.length} pass{summary.passes.length === 1 ? '' : 'es'}</span>
          </div>
          {anchorFailCount > 0 && (
            <button
              onClick={() => setShowAnchorModal(true)}
              className="w-full mb-3 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-violet-50 text-violet-700 text-[11px] font-semibold hover:bg-violet-100 transition-colors"
            >
              <BookOpen size={12} /> Review anchor citations ({anchorFailCount})
            </button>
          )}
          {topItems.length === 0 ? (
            <p className="text-[11px] text-slate-400">No issues found.</p>
          ) : (
            <div className="space-y-2">
              {topItems.map((item, i) => (
                <div key={i} className="rounded-lg border border-slate-200 px-2.5 py-2">
                  <p className={cn(
                    'text-[10px] font-semibold uppercase tracking-wide mb-0.5',
                    item.status === 'Fail' ? 'text-red-600' : 'text-amber-600',
                  )}>
                    {item.status}
                  </p>
                  <p className="text-[11px] text-slate-600">{item.message}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      <MethodologyAnchorCandidatesModal
        projectId={projectId}
        isOpen={showAnchorModal}
        onClose={() => setShowAnchorModal(false)}
        onResolved={handleRevalidate}
      />
    </div>
  )
}

// ── Methodology-anchor candidate review modal ───────────────────────────────────
// Surfaces MethodologyAnchorCandidate rows (ambiguous OpenAlex matches the backend couldn't
// auto-resolve) so the student can accept or reject them — the only way to clear a
// methodology_anchor_present validation fail short of regenerating the section outright.

function MethodologyAnchorCandidatesModal({
  projectId, isOpen, onClose, onResolved,
}: { projectId: string; isOpen: boolean; onClose: () => void; onResolved: () => void }) {
  const [candidates, setCandidates] = useState<MethodologyAnchorCandidate[] | null>(null)
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  const load = () => {
    setCandidates(null)
    researchApi.getMethodologyAnchorCandidates(projectId)
      .then(setCandidates)
      .catch(() => setCandidates([]))
  }

  useEffect(() => {
    if (isOpen) load()
  }, [isOpen, projectId])

  const handleResolve = async (candidateId: string, accept: boolean) => {
    setResolvingId(candidateId)
    try {
      await researchApi.resolveMethodologyAnchorCandidate(projectId, candidateId, accept)
      toast.success(accept ? 'Citation added as methodology anchor.' : 'Candidate rejected.')
      load()
      onResolved()
    } catch {
      toast.error('Could not resolve this candidate. Try again.')
    } finally {
      setResolvingId(null)
    }
  }

  const grouped = (candidates ?? []).reduce<Record<string, MethodologyAnchorCandidate[]>>((acc, c) => {
    (acc[c.sectionCode] ??= []).push(c)
    return acc
  }, {})

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Methodology-Anchor Citations" size="lg">
      <p className="text-[13px] text-slate-600 mb-4">
        Each failing section needs a foundational citation grounding its methodology. The
        automated search found more than one plausible match for some sections — pick the
        correct source below. If a section isn't listed here, it hasn't found any candidate yet;
        regenerate that section from its chapter editor to trigger a fresh search.
      </p>
      {candidates === null ? (
        <div className="flex justify-center py-10"><Loader2 size={18} className="animate-spin text-slate-400" /></div>
      ) : candidates.length === 0 ? (
        <p className="text-[13px] text-slate-500">
          No candidates awaiting review right now. Regenerate a failing section from its chapter
          editor to trigger a fresh methodology-anchor search.
        </p>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([sectionCode, items]) => (
            <div key={sectionCode}>
              <p className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Section {sectionCode}
              </p>
              <div className="space-y-2.5">
                {items.map(c => (
                  <div key={c.id} className="rounded-xl border border-slate-200 p-3.5">
                    <p className="text-[13px] font-semibold text-slate-800">{c.title}</p>
                    <p className="text-[12px] text-slate-500 mt-0.5">
                      {c.authors} ({c.year}){c.journal ? ` — ${c.journal}` : ''}
                    </p>
                    {c.abstract && (
                      <p className="text-[12px] text-slate-600 mt-2 line-clamp-3">{c.abstract}</p>
                    )}
                    {c.llmReasoning && (
                      <p className="text-[11px] text-slate-400 mt-2 italic">{c.llmReasoning}</p>
                    )}
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-[10px] font-medium text-slate-400">Confidence: {c.confidence}%</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleResolve(c.id, false)}
                          disabled={resolvingId === c.id}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-[12px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <X size={12} /> Reject
                        </button>
                        <button
                          onClick={() => handleResolve(c.id, true)}
                          disabled={resolvingId === c.id}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-violet-600 text-white text-[12px] font-medium hover:bg-violet-700 disabled:opacity-50"
                        >
                          {resolvingId === c.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Use this citation
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

// ── Right panel: Notes ────────────────────────────────────────────────────────
// Free-text scratchpad, persisted via the existing full-object sync pattern
// (updateProject for an instant local merge, syncProject debounced to the server).

function NotesPanel({ project }: { project: ResearchProject }) {
  const { updateProject, syncProject } = useResearchStore()
  const [value, setValue] = useState(project.notes ?? '')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setValue(project.notes ?? '')
  }, [project.id])

  const handleChange = (next: string) => {
    setValue(next)
    updateProject(project.id, { notes: next })
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => { syncProject(project.id) }, 800)
  }

  return (
    <div className="p-4 border-b border-slate-200">
      <p className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-2">Notes</p>
      <textarea
        value={value}
        onChange={e => handleChange(e.target.value)}
        placeholder="Jot down anything for yourself — never read by any AI feature."
        rows={6}
        className="w-full resize-none rounded-lg border border-slate-200 px-2.5 py-2 text-[12px] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-400"
      />
    </div>
  )
}

// ── Right panel: AI Assistant ─────────────────────────────────────────────────
// No chat/comment UI pattern exists anywhere in the app yet (Supervisor has no frontend
// integration) — an honest placeholder rather than a faked interaction.

function AiAssistantPanel() {
  return (
    <div className="p-4">
      <p className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-2">AI Assistant</p>
      <div className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center">
        <MessageSquare size={18} className="text-slate-300 mx-auto mb-2" />
        <p className="text-[11px] text-slate-400">Coming soon</p>
      </div>
    </div>
  )
}

// ── Start Process control ────────────────────────────────────────────────────
// Resumes an existing project's autonomous generation run (ProposalGenerationJob, driven by
// POST .../generate-autonomous) — the same server-side job the Proposal Studio creation modal
// starts, but triggered here for a project that already exists and has some NotStarted sections
// left. The job itself already skips sections that are Draft+, so re-entry is safe. Unlike
// AutonomousProposalTools' GenerationPanel, this stays compact: ProposalTab (a sibling reading
// the same researchStore.sections slice) already renders per-section status/word-count live, so
// this control only needs a button, a compact status line, and Cancel.

function StartProcessControl({ projectId, hasRemainingSections }: {
  projectId: string
  hasRemainingSections: boolean
}) {
  const researchStore = useResearchStore()
  const [phase, setPhase] = useState<GenerationPhase>('NotStarted')
  const [currentSection, setCurrentSection] = useState<string | null>(null)
  const [words, setWords] = useState(0)
  const pollTimer = useRef<number | null>(null)

  const isActive = phase === 'Starting' || phase === 'Generating'

  const stopPolling = () => {
    if (pollTimer.current) window.clearTimeout(pollTimer.current)
    pollTimer.current = null
  }

  const poll = () => {
    researchStore.getGenerationStatus(projectId).then(status => {
      setPhase(status.status)
      setCurrentSection(status.currentSection)
      setWords(status.wordsWritten)
      if (status.status === 'Starting' || status.status === 'Generating') {
        pollTimer.current = window.setTimeout(poll, GENERATION_POLL_MS)
        // Refresh sections mid-run so ProposalTab's per-chapter status/word count updates live.
        researchStore.loadSections(projectId).catch(() => {})
      } else {
        researchStore.loadSections(projectId).catch(() => {})
      }
    }).catch(() => {
      pollTimer.current = window.setTimeout(poll, GENERATION_POLL_MS)
    })
  }

  // Reattach to an already-running job on mount (tab refresh, navigated back, etc.) — the job
  // survives independently since it's server-side (Hangfire), so only this panel needs to catch up.
  useEffect(() => {
    researchStore.getGenerationStatus(projectId).then(status => {
      setPhase(status.status)
      setCurrentSection(status.currentSection)
      setWords(status.wordsWritten)
      if (status.status === 'Starting' || status.status === 'Generating') {
        pollTimer.current = window.setTimeout(poll, GENERATION_POLL_MS)
      }
    }).catch(() => {})
    return stopPolling
  }, [projectId])

  const handleStart = async () => {
    setPhase('Starting')
    try {
      const status = await researchStore.generateAutonomous(projectId, RESUME_SECTION_WORD_COUNT)
      setPhase(status.status)
      pollTimer.current = window.setTimeout(poll, GENERATION_POLL_MS)
    } catch (err) {
      setPhase('NotStarted')
      const apiErr = err as ApiError | undefined
      if (apiErr?.code === 'VALIDATION_GATE_FAILED') {
        const fails = (apiErr.details as { fails?: { message: string }[] } | undefined)?.fails ?? []
        toast.error(
          fails.length > 0
            ? `Resolve ${fails.length} validation issue${fails.length === 1 ? '' : 's'} before starting generation.`
            : 'Resolve validation issues before starting generation.',
        )
      } else {
        toast.error(apiErr?.message ?? 'Could not start generation — check the server is running.')
      }
    }
  }

  const handleCancel = () => {
    researchStore.cancelGeneration(projectId).catch(() => {})
  }

  if (!isActive && !hasRemainingSections) return null

  return (
    <div className="flex items-center gap-2 shrink-0">
      {isActive ? (
        <>
          <span className="text-[11px] text-slate-500 truncate max-w-[220px]">
            {phase === 'Starting' ? 'Starting…' : `Writing ${currentSection ?? '…'} · ${words.toLocaleString()} words`}
          </span>
          <button
            onClick={handleCancel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-[12px] font-medium transition-colors"
          >
            <Loader2 size={13} className="animate-spin" /> Cancel
          </button>
        </>
      ) : (
        <button
          onClick={handleStart}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-[12px] font-semibold transition-colors shrink-0"
        >
          <Play size={13} /> Start Process
        </button>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ResearchDashboardPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate      = useNavigate()
  const researchStore = useResearchStore()
  const [activeTab, setActiveTab] = useState<TabKey>('proposal')

  const project  = researchStore.projects.find(p => p.id === projectId)
  const sections = useResearchStore(s => s.sections[projectId ?? ''])

  useEffect(() => {
    if (!projectId) return
    researchStore.loadProject(projectId).catch(() => {})
    if (!sections) researchStore.loadSections(projectId).catch(() => {})
  }, [projectId])

  if (!projectId) return null

  // Unknown (sections not loaded yet) fails open — the resume job is idempotent and simply
  // completes immediately if there's nothing left to write, so there's no harm in showing the
  // button before sections have loaded.
  const hasRemainingSections = !sections || CHAPTER_STEPS.some(
    step => (sections.find(s => s.code === step.sectionKey)?.status ?? 'NotStarted') === 'NotStarted',
  )

  const openWriting = () => navigate(`/app/research-agent/${projectId}`)

  if (!project) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
        <Loader2 size={24} className="animate-spin text-[#7c3aed]" />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex bg-white">

      {/* ── 1. Tool Sidebar — 52px, shared with Research Agent ─────────────── */}
      <ToolSidebar />

      {/* ── 2. Project Nav — 220px: project header band + vertical tab list ─ */}
      <aside
        className="shrink-0 flex flex-col overflow-hidden"
        style={{ width: 220, background: '#f1f5f9', borderRight: '1px solid #e2e8f0' }}
      >
        <div className="shrink-0 px-4 pt-4 pb-3" style={{ borderBottom: '1px solid #e2e8f0' }}>
          <div className="flex items-center gap-1.5">
            <GraduationCap size={14} className="text-[#7c3aed] shrink-0" />
            <h1 className="text-[13px] font-bold text-slate-900 leading-tight truncate" title={project.title}>
              {project.title || 'Untitled research project'}
            </h1>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 truncate">
            {project.academicLevel} · {project.methodologyType || 'No methodology'}
          </p>
          {(project.institution || project.supervisorName) && (
            <p className="text-[10px] text-slate-400 mt-0.5 truncate">
              {[project.institution, project.supervisorName && `Supervisor: ${project.supervisorName}`]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto py-2 px-2">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-[12px] font-medium transition-colors mb-0.5',
                activeTab === tab.key
                  ? 'bg-[#ede9fe] text-[#7c3aed]'
                  : 'text-slate-500 hover:bg-white hover:text-slate-700',
              )}
            >
              <tab.icon size={14} className="shrink-0" /> {tab.label}
            </button>
          ))}
        </div>
      </aside>

      {/* ── 3. Main Panel ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="shrink-0 border-b border-slate-200 px-6 py-3 flex items-center justify-end gap-2">
          <StartProcessControl projectId={projectId} hasRemainingSections={hasRemainingSections} />
          <button
            onClick={() => navigate(`/app/research-agent/${projectId}/document`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-[12px] font-medium transition-colors shrink-0"
          >
            <ExternalLink size={13} /> View Document
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {activeTab === 'proposal'        && <ProposalTab projectId={projectId} isExternallySourced={!!project.isExternallySourced} onOpenWriting={openWriting} />}
          {activeTab === 'literature'      && <LiteratureTab projectId={projectId} />}
          {activeTab === 'methodology'     && <MethodologyTab projectId={projectId} methodologyType={project.methodologyType} methodologySubType={project.methodologySubType} onOpenWriting={openWriting} />}
          {activeTab === 'ethics'          && <EthicsTab onOpenWriting={openWriting} />}
          {activeTab === 'data-collection' && <DataCollectionTab onOpenWriting={openWriting} />}
          {activeTab === 'analysis'        && <AnalysisTab projectId={projectId} />}
          {activeTab === 'writing'         && <WritingTab projectId={projectId} onOpenWriting={openWriting} />}
          {activeTab === 'roadmap'         && <RoadmapTab projectId={projectId} />}
          {activeTab === 'validation'      && <ValidationTab projectId={projectId} />}
          {activeTab === 'submission'      && <SubmissionTab projectId={projectId} onOpenWriting={openWriting} />}
        </div>
      </div>

      {/* ── 4. Right panel — 300px: Validation / Notes / AI Assistant ───────── */}
      <aside
        className="shrink-0 overflow-y-auto"
        style={{ width: 300, borderLeft: '1px solid #e2e8f0' }}
      >
        <ValidationPanel projectId={projectId} />
        <NotesPanel project={project} />
        <AiAssistantPanel />
      </aside>
    </div>
  )
}
