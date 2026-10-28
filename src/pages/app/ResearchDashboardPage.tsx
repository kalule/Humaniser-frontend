import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  FileText, BookOpen, Settings2, ShieldCheck, Database, BarChart2, PenLine,
  CheckCircle2, GraduationCap, Loader2, ArrowRight, AlertCircle, Download,
  ExternalLink, ListChecks, RefreshCw, Sparkles, MessageSquare, Play, Check, X,
  Lock, Compass, ClipboardList, AlertTriangle,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { applyInclusionChange } from '../../lib/literatureInclusion'
import { useResearchStore } from '../../store/researchStore'
import { useAuthStore } from '../../store/authStore'
import { ProposalDesignReadinessPanel } from '../../components/research-design/ProposalDesignReadinessPanel'
import { researchApi } from '../../api/research'
import { ToolSidebar } from '../../components/layout/ToolSidebar'
import { Modal } from '../../components/ui/Modal'
import { CHAPTER_STEPS, STEPS } from '../../data/proposalOutline'
import { ExternalFactsReviewPanel } from '../../components/research-agent/ExternalFactsReviewPanel'
import { EthicsManager } from '../../components/research-agent/EthicsManager'
import { InstrumentsManager } from '../../components/research-agent/InstrumentsManager'
import type { ApiError } from '../../types'
import type {
  DashboardLiteratureFilter, DashboardLiteraturePage, FetchedLiterature, FactConflict, ProjectSection, RubricScores, HypothesisOutcome,
  ResearchRoadmap, MilestoneStatus, ReadinessEvaluation, CheckStatus, GraphGap,
  ResearchProject, ValidationSummary, ValidationResult, ExternalFact, GenerationPhase, LiteratureCitationSummary,
  MethodologyAnchorCandidate, ProjectDataset, ResearchState, UniversityTemplateDetail,
} from '../../types/research'
import { RESEARCH_STATE_OPTIONS } from '../../types/research'
import { DEFAULT_DASHBOARD_LITERATURE_FILTER } from './researchDashboardLiterature'

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

type TabKey = 'proposal' | 'literature' | 'methodology' | 'ethics' | 'instruments' | 'data-collection' | 'analysis' | 'writing' | 'structure' | 'roadmap' | 'validation' | 'submission'

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'proposal',        label: 'Proposal',        icon: FileText },
  { key: 'literature',      label: 'Literature',      icon: BookOpen },
  { key: 'methodology',     label: 'Methodology',     icon: Settings2 },
  { key: 'ethics',          label: 'Ethics',          icon: ShieldCheck },
  { key: 'instruments',     label: 'Instruments',     icon: ClipboardList },
  { key: 'data-collection', label: 'Data Collection', icon: Database },
  { key: 'analysis',        label: 'Analysis',        icon: BarChart2 },
  { key: 'writing',         label: 'Writing',         icon: PenLine },
  { key: 'structure',       label: 'Thesis Structure', icon: Compass },
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
  onOpenWriting: (sectionCode?: string) => void
}) {
  const { sections: allSections, loadSections } = useResearchStore()
  const sections = allSections[projectId]
  const [loading, setLoading] = useState(!sections)
  const [externalFacts, setExternalFacts] = useState<ExternalFact[]>([])
  // OPEN_ITEMS.md #50, Finding 1/4 — "Approved" is a one-time write, never re-evaluated against the
  // Validation Engine (see ApproveSectionAsync's own doc note in that item). This does NOT change
  // what Approved means or re-open/revert it; it only surfaces, per chapter row, that a currently
  // open Fail/Warning exists for that section — the same soft-signal posture as
  // ProjectSection.RequiresReReview (item #49 Part C), not a new gate.
  const [openIssuesBySection, setOpenIssuesBySection] = useState<Map<string, ValidationResult[]>>(new Map())

  useEffect(() => {
    if (sections) return
    setLoading(true)
    loadSections(projectId).finally(() => setLoading(false))
  }, [projectId])

  useEffect(() => {
    researchApi.getValidationSummary(projectId)
      .then(summary => {
        const bySection = new Map<string, ValidationResult[]>()
        for (const item of [...summary.fails, ...summary.warnings]) {
          if (!item.sectionCode) continue
          const existing = bySection.get(item.sectionCode) ?? []
          existing.push(item)
          bySection.set(item.sectionCode, existing)
        }
        setOpenIssuesBySection(bySection)
      })
      .catch(() => setOpenIssuesBySection(new Map()))
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
        const openIssues = step.sectionKey ? openIssuesBySection.get(step.sectionKey) : undefined
        return (
          <div key={step.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-2.5">
            {/* OPEN_ITEMS.md #50, Finding 5 — resolve the label the same way WritingTab already
                does (sec.displayCode + sec.title, both backend-computed) rather than this file's
                own hand-typed proposalOutline.ts string, so a PresentationLabel relabel (e.g. "1.2"
                now displaying as "1.1") actually renders here. Falls back to the static label only
                if the section row somehow hasn't loaded — every canonical code has a real row from
                project creation, so this is a defensive no-op in the normal case, not the common path. */}
            <p className="text-[13px] font-medium text-slate-700">{sec ? `${sec.displayCode} ${sec.title}` : step.label}</p>
            <div className="flex items-center gap-3 shrink-0">
              {openIssues && openIssues.length > 0 && (
                <button
                  onClick={() => onOpenWriting(step.sectionKey)}
                  title={openIssues.map(i => `${i.status}: ${i.message}`).join('\n')}
                  className="flex items-center gap-1 text-amber-600 hover:text-amber-700 transition-colors"
                >
                  <AlertTriangle size={13} />
                </button>
              )}
              {sec && <span className="text-[11px] text-slate-400">{sec.wordCount.toLocaleString()} words</span>}
              <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full', SECTION_STATUS_STYLES[sec?.status ?? 'NotStarted'])}>
                {sec?.status ?? 'NotStarted'}
              </span>
            </div>
          </div>
        )
      })}
      <button
        onClick={() => onOpenWriting()}
        className="flex items-center gap-1.5 text-[12px] font-medium text-violet-600 hover:text-violet-800 transition-colors mt-3"
      >
        Open chapter editor <ArrowRight size={12} />
      </button>
    </div>
  )
}

// ── Literature tab ───────────────────────────────────────────────────────────

type LiteratureFilter = 'all' | 'cited' | 'unresolved' | 'prioritised' | 'available' | 'excluded'

const LITERATURE_FILTERS: Array<{ key: LiteratureFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'cited', label: 'Cited' },
  { key: 'unresolved', label: 'Unresolved' },
  { key: 'prioritised', label: 'Prioritised' },
  { key: 'available', label: 'Available' },
  { key: 'excluded', label: 'Excluded' },
]

const LITERATURE_CACHE_TTL_MS = 5 * 60 * 1000
type LiteratureTabCacheEntry = {
  literature: FetchedLiterature[]
  literatureFetchedAt: number
  citationSummary: LiteratureCitationSummary | null
  summaryFetchedAt: number
}
const literatureTabCache = new Map<string, LiteratureTabCacheEntry>()

function LegacyLiteratureTab({ projectId }: { projectId: string }) {
  const pageSize = 25
  const cached = literatureTabCache.get(projectId)
  const [literature, setLiterature] = useState<FetchedLiterature[] | null>(() => cached?.literature ?? null)
  const [citationSummary, setCitationSummary] = useState<LiteratureCitationSummary | null>(() => cached?.citationSummary ?? null)
  const [loading, setLoading] = useState(() => !cached)
  const [filter, setFilter] = useState<LiteratureFilter>('all')
  const [page, setPage] = useState(1)

  useEffect(() => {
    let cancelled = false
    const existing = literatureTabCache.get(projectId)
    const now = Date.now()
    const literatureIsFresh = existing && now - existing.literatureFetchedAt < LITERATURE_CACHE_TTL_MS
    const summaryIsFresh = existing?.citationSummary && now - existing.summaryFetchedAt < LITERATURE_CACHE_TTL_MS

    if (existing) {
      setLiterature(existing.literature)
      setCitationSummary(existing.citationSummary)
      setLoading(false)
    } else {
      setLiterature(null)
      setCitationSummary(null)
      setLoading(true)
    }
    setPage(1)

    const loadSummary = () => {
      if (summaryIsFresh) return
      researchApi.getLiteratureCitationSummary(projectId)
        .then(summary => {
          const current = literatureTabCache.get(projectId)
          if (current) {
            literatureTabCache.set(projectId, {
              ...current,
              citationSummary: summary,
              summaryFetchedAt: Date.now(),
            })
          }
          if (!cancelled) setCitationSummary(summary)
        })
        .catch(() => {})
    }

    if (literatureIsFresh) {
      loadSummary()
      return () => { cancelled = true }
    }

    researchApi.getLiterature(projectId)
      .then(sources => {
        const current = literatureTabCache.get(projectId)
        literatureTabCache.set(projectId, {
          literature: sources,
          literatureFetchedAt: Date.now(),
          citationSummary: current?.citationSummary ?? null,
          summaryFetchedAt: current?.summaryFetchedAt ?? 0,
        })
        if (!cancelled) {
          setLiterature(sources)
          setLoading(false)
        }

        // Citation-summary resolution walks every drafted section and the complete literature
        // pool. It is useful for the Unresolved filter, but it must not block first paint or
        // compete with the primary literature request for CPU/database time.
        loadSummary()
      })
      .catch(() => {
        if (!cancelled && !existing) {
          setLiterature([])
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [projectId])

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin text-slate-400" /></div>
  }

  if (!literature || literature.length === 0) {
    return (
      <EmptyPlaceholder
        icon={BookOpen}
        title="No literature gathered yet"
        subtitle="Sources are collected during the Literature Gathering step of the chapter editor, or drawn from your Research Library."
      />
    )
  }

  const counts: Record<LiteratureFilter, number> = {
    all: literature.length,
    cited: literature.filter(lit => lit.citationCount > 0).length,
    unresolved: citationSummary?.unresolvedCitations.length ?? 0,
    prioritised: literature.filter(lit => lit.includedByStudent).length,
    available: literature.filter(lit => !lit.includedByStudent).length,
    // ProjectLiterature currently has no explicit exclusion state. Keep this at zero rather than
    // misrepresenting ordinary available sources as excluded.
    excluded: 0,
  }
  const visibleLiterature = literature.filter(lit => {
    if (filter === 'prioritised') return lit.includedByStudent
    if (filter === 'cited') return lit.citationCount > 0
    if (filter === 'available') return !lit.includedByStudent
    if (filter === 'excluded' || filter === 'unresolved') return false
    return true
  })
  const pageCount = Math.max(1, Math.ceil(visibleLiterature.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pagedLiterature = visibleLiterature.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Filter literature sources">
        {LITERATURE_FILTERS.map(option => (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={filter === option.key}
            onClick={() => { setFilter(option.key); setPage(1) }}
            className={cn(
              'rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors',
              filter === option.key
                ? 'border-violet-300 bg-violet-50 text-violet-700'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
            )}
          >
            {option.label} <span className="ml-1 text-[11px] opacity-70">{counts[option.key]}</span>
          </button>
        ))}
      </div>

      {filter === 'unresolved' && citationSummary?.unresolvedCitations.length ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-800">
            {citationSummary.unresolvedCitations.length} distinct citation {citationSummary.unresolvedCitations.length === 1 ? 'marker could' : 'markers could'} not be matched to project literature
            {' '}({citationSummary.unresolvedOccurrenceCount} total {citationSummary.unresolvedOccurrenceCount === 1 ? 'occurrence' : 'occurrences'}). Review or replace them before export.
          </div>
          {citationSummary.unresolvedCitations.map(citation => (
            <div key={citation.rawText} className="rounded-xl border border-amber-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[13px] font-semibold text-slate-800">{citation.rawText}</p>
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                  Unresolved
                </span>
              </div>
              <p className="mt-2 text-[11px] font-medium text-amber-700">
                {citation.occurrenceCount} {citation.occurrenceCount === 1 ? 'occurrence' : 'occurrences'}
                {citation.sections.length > 0 ? ` · Sections ${citation.sections.join(', ')}` : ''}
              </p>
            </div>
          ))}
        </div>
      ) : visibleLiterature.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 px-5 py-10 text-center">
          <BookOpen size={22} className="mx-auto text-slate-300" />
          <p className="mt-2 text-[13px] font-semibold text-slate-700">No {LITERATURE_FILTERS.find(x => x.key === filter)?.label.toLowerCase()} sources</p>
          <p className="mt-1 text-[12px] text-slate-500">
            {filter === 'excluded'
              ? 'No sources have been explicitly excluded from this project.'
              : filter === 'unresolved'
                ? 'All detected in-text citations currently resolve to project literature.'
              : 'Try another filter to view the rest of the literature pool.'}
          </p>
        </div>
      ) : (
      <div className="space-y-3">
      {pagedLiterature.map(lit => (
        <div key={lit.id} className="rounded-xl border border-slate-200 p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[13px] font-semibold text-slate-800 leading-snug">{lit.title}</p>
            <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
              {lit.citationCount > 0 && (
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700">
                  Cited
                </span>
              )}
              <span className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-medium',
                lit.includedByStudent ? 'bg-green-tint text-green-text' : 'bg-slate-100 text-slate-500',
              )}>
                {lit.includedByStudent ? 'Prioritised' : 'Available'}
              </span>
            </div>
          </div>
          <p className="text-[12px] text-slate-500 mt-1">{lit.authors}{lit.year ? ` (${lit.year})` : ''}</p>
          {lit.abstract && <p className="text-[12px] text-slate-600 mt-2 line-clamp-2">{lit.abstract}</p>}
          {lit.citationCount > 0 && (
            <p className="mt-2 text-[11px] font-medium text-violet-600">
              Cited {lit.citationCount} {lit.citationCount === 1 ? 'time' : 'times'}
              {lit.citedInSections.length > 0 ? ` · Sections ${lit.citedInSections.join(', ')}` : ''}
            </p>
          )}
          <p className="text-[11px] text-slate-400 mt-2">Source: {lit.source}</p>
        </div>
      ))}
      {pageCount > 1 && (
        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          <p className="text-[11px] text-slate-500">
            Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, visibleLiterature.length)} of {visibleLiterature.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setPage(value => Math.max(1, value - 1))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-[11px] text-slate-500">Page {currentPage} of {pageCount}</span>
            <button
              type="button"
              disabled={currentPage === pageCount}
              onClick={() => setPage(value => Math.min(pageCount, value + 1))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
      </div>
      )}
    </div>
  )
}

// Keep the legacy renderer available in this dirty working tree while the dedicated dashboard
// contract is rolled out; the active component below never invokes its full-collection requests.
void LegacyLiteratureTab

function LiteratureTab({ projectId }: { projectId: string }) {
  const userId = useAuthStore(s => s.user?.id ?? 'anonymous')
  const [result, setResult] = useState<DashboardLiteraturePage | null>(null)
  const [filter, setFilter] = useState<DashboardLiteratureFilter>(DEFAULT_DASHBOARD_LITERATURE_FILTER)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Optimistic: the badge, the filter counts and (under the prioritised/available filters) the row's
  // membership all move immediately, and the whole page snaps back if the request fails. Refetching
  // instead would re-run the citation-index join behind this endpoint for a one-boolean change.
  const toggleInclusion = async (literatureId: string, included: boolean) => {
    const previous = result
    if (!previous) return
    setTogglingId(literatureId)
    setResult(applyInclusionChange(previous, literatureId, included, filter))
    try {
      await researchApi.setLiteratureInclusion(projectId, literatureId, included)
    } catch {
      setResult(previous)
      toast.error(included ? 'Could not prioritise this source.' : 'Could not remove this source from the approved set.')
    } finally {
      setTogglingId(null)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => { setPage(1) }, [filter, debouncedSearch])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    researchApi.getDashboardLiterature(projectId, {
      filter, search: debouncedSearch || undefined, page, pageSize: 25,
    }, controller.signal)
      .then(setResult)
      .catch(err => {
        if (!controller.signal.aborted)
          setError((err as ApiError)?.message ?? 'Literature could not be loaded.')
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [userId, projectId, filter, debouncedSearch, page])

  if (loading && !result)
    return <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin text-slate-400" /></div>
  if (!result && error)
    return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><p className="font-semibold">Literature could not be loaded</p><p className="mt-1">{error}</p></div>
  if (!result) return null

  const filters: Array<{ key: DashboardLiteratureFilter; label: string }> = [
    { key: 'cited', label: 'Cited' }, { key: 'all', label: 'All articles' },
    { key: 'unresolved', label: 'Unresolved' }, { key: 'prioritised', label: 'Prioritised' },
    { key: 'available', label: 'Available' }, { key: 'excluded', label: 'Excluded' },
  ]
  const pageCount = Math.max(1, Math.ceil(result.matchingCount / result.pageSize))

  return <div>
    <div className="mb-4 flex items-center gap-3">
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title, author, or DOI"
        className="w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-[12px] outline-none focus:border-violet-400" />
      {loading && <Loader2 size={15} className="animate-spin text-slate-400" />}
    </div>
    {result.citationIndexStatus !== 'Ready' && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-800">{result.citationIndexMessage ?? 'Citation usage is not current yet.'}</div>}
    {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</div>}
    <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Filter literature sources">
      {filters.map(option => <button key={option.key} type="button" role="tab" aria-selected={filter === option.key}
        onClick={() => setFilter(option.key)} className={cn('rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors', filter === option.key ? 'border-violet-300 bg-violet-50 text-violet-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}>
        {option.label} <span className="ml-1 text-[11px] opacity-70">{result.counts[option.key]}</span>
      </button>)}
    </div>
    {filter === 'unresolved' && result.unresolvedCitations.length > 0 ? <div className="space-y-3">
      {result.unresolvedCitations.map(citation => <div key={citation.rawText} className="rounded-xl border border-amber-200 p-4">
        <p className="text-[13px] font-semibold text-slate-800">{citation.rawText}</p>
        <p className="mt-2 text-[11px] font-medium text-amber-700">{citation.occurrenceCount} {citation.occurrenceCount === 1 ? 'occurrence' : 'occurrences'}{citation.sections.length ? ` · Sections ${citation.sections.join(', ')}` : ''}</p>
      </div>)}
    </div> : result.items.length === 0 ? <div className="rounded-xl border border-dashed border-slate-200 px-5 py-10 text-center">
      <BookOpen size={22} className="mx-auto text-slate-300" />
      <p className="mt-2 text-[13px] font-semibold text-slate-700">No {filters.find(x => x.key === filter)?.label.toLowerCase()}</p>
      <p className="mt-1 text-[12px] text-slate-500">{filter === 'cited' && result.citationIndexStatus === 'Ready' ? 'No sources are cited in the current document.' : 'Try another filter or search.'}</p>
      {filter === 'cited' && <button type="button" onClick={() => setFilter('all')} className="mt-3 text-[12px] font-semibold text-violet-600">Browse all articles</button>}
    </div> : <div className="space-y-3">
      {result.items.map(lit => <div key={lit.id} className="rounded-xl border border-slate-200 p-4">
        <div className="flex items-start justify-between gap-3"><p className="text-[13px] font-semibold text-slate-800 leading-snug">{lit.title}</p>
          <div className="flex shrink-0 gap-1.5">{lit.citationCount > 0 && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700">Cited</span>}
            <button
              type="button"
              disabled={togglingId === lit.id}
              onClick={() => toggleInclusion(lit.id, !lit.includedByStudent)}
              title={lit.includedByStudent
                ? 'Approved for this project — click to move back to Available'
                : 'Click to approve this source so it can be cited and offered as a replacement'}
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors disabled:opacity-50',
                lit.includedByStudent
                  ? 'bg-green-tint text-green-text hover:bg-green-200'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
              )}
            >
              {lit.includedByStudent ? 'Prioritised' : 'Available'}
            </button>
          </div>
        </div>
        <p className="mt-1 text-[12px] text-slate-500">{lit.authors}{lit.year ? ` (${lit.year})` : ''}</p>
        {lit.citationCount > 0 && <p className="mt-2 text-[11px] font-medium text-violet-600">Cited {lit.citationCount} {lit.citationCount === 1 ? 'time' : 'times'}{lit.citedInSections.length ? ` · Sections ${lit.citedInSections.join(', ')}` : ''}</p>}
        <p className="mt-2 text-[11px] text-slate-400">Source: {lit.source}</p>
      </div>)}
      {pageCount > 1 && <div className="flex items-center justify-between border-t border-slate-100 pt-3"><p className="text-[11px] text-slate-500">Showing {(result.page - 1) * result.pageSize + 1}–{Math.min(result.page * result.pageSize, result.matchingCount)} of {result.matchingCount}</p><div className="flex gap-2"><button disabled={result.page === 1 || loading} onClick={() => setPage(p => p - 1)} className="rounded-lg border px-3 py-1.5 text-[12px] disabled:opacity-40">Previous</button><button disabled={result.page === pageCount || loading} onClick={() => setPage(p => p + 1)} className="rounded-lg border px-3 py-1.5 text-[12px] disabled:opacity-40">Next</button></div></div>}
    </div>}
  </div>
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
  onOpenWriting: (sectionCode?: string) => void
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
        onClick={() => onOpenWriting('5.2')}
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

function EthicsTab({ projectId, onOpenWriting }: { projectId: string; onOpenWriting: (sectionCode?: string) => void }) {
  return <EthicsManager projectId={projectId} onOpenWriting={onOpenWriting} />
}

function InstrumentsTab({ projectId }: { projectId: string }) {
  return <InstrumentsManager projectId={projectId} />
}

type ConsolidatedProjectDataset = ProjectDataset & { duplicateCount: number }

function consolidateProjectDatasets(datasets: ProjectDataset[]): ConsolidatedProjectDataset[] {
  const statusRank: Record<ProjectDataset['analysisStatus'], number> = {
    'not-started': 0,
    'in-progress': 1,
    complete: 2,
  }
  const groups = new Map<string, ProjectDataset[]>()

  for (const dataset of datasets) {
    // File size plus shape avoids collapsing files which merely share a name.
    const key = [dataset.fileName.trim().toLocaleLowerCase(), dataset.fileSizeBytes, dataset.rowCount, dataset.columnCount].join('|')
    const group = groups.get(key)
    if (group) group.push(dataset)
    else groups.set(key, [dataset])
  }

  return [...groups.values()].map(group => {
    const linked = group.filter(dataset => dataset.isLinked)
    const candidates = linked.length > 0 ? linked : group
    const representative = [...candidates].sort((a, b) =>
      statusRank[b.analysisStatus] - statusRank[a.analysisStatus] ||
      Date.parse(b.uploadedAt) - Date.parse(a.uploadedAt),
    )[0]
    // Status must come from the same candidate set as the representative. Previously an
    // unlinked duplicate with a completed session could lend "complete" to a different linked
    // upload, producing a false "Verified analysis complete" banner and a subsequent 409 when
    // the authoritative research-state endpoint performed its stricter verification.
    const analysisStatus = candidates.reduce<ProjectDataset['analysisStatus']>(
      (best, dataset) => statusRank[dataset.analysisStatus] > statusRank[best] ? dataset.analysisStatus : best,
      'not-started',
    )

    return {
      ...representative,
      isLinked: linked.length > 0,
      analysisStatus,
      duplicateCount: group.length,
    }
  })
}

function DataCollectionTab({ projectId, onOpenWriting }: { projectId: string; onOpenWriting: (sectionCode?: string) => void }) {
  const [datasets, setDatasets] = useState<ProjectDataset[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [linking, setLinking] = useState(false)

  const load = () => {
    setLoading(true)
    researchApi.getProjectDatasets(projectId)
      .then(setDatasets)
      .catch(() => toast.error('Could not load Data Analyst datasets.'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [projectId])

  const consolidatedDatasets = useMemo(() => consolidateProjectDatasets(datasets), [datasets])
  const linked = consolidatedDatasets.filter(d => d.isLinked)
  const available = consolidatedDatasets.filter(d => !d.isLinked)
  const linkSelected = async () => {
    if (!selectedId) return
    setLinking(true)
    try {
      await researchApi.linkDataset(projectId, selectedId)
      toast.success('Dataset linked to this project.')
      setSelectedId('')
      load()
    } catch {
      toast.error('Could not link that dataset.')
    } finally { setLinking(false) }
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-violet-600" /></div>
  return (
    <div className="space-y-4">
      {linked.length === 0 ? (
        <EmptyPlaceholder icon={Database} title="No datasets linked yet"
          subtitle="Select one of your Data Analyst datasets below, or upload a dataset in Data Analyst first."
          note="Linking a dataset records its project association. Analysis Completed still requires a separately linked, completed analysis session." />
      ) : (
        <div className="space-y-2">
          {linked.map(d => <div key={d.datasetId} className="rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-between">
            <div><p className="text-sm font-semibold text-slate-800">{d.fileName}</p><p className="text-xs text-slate-500">{d.rowCount.toLocaleString()} rows · {d.columnCount} columns{d.duplicateCount > 1 ? ` · ${d.duplicateCount} identical uploads consolidated` : ''}</p></div>
            <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-medium', d.analysisStatus === 'complete' ? 'bg-emerald-50 text-emerald-700' : d.analysisStatus === 'in-progress' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600')}>{d.analysisStatus.replace('-', ' ')}</span>
          </div>)}
        </div>
      )}
      {available.length > 0 && <div className="flex gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
          <option value="">Select an uploaded dataset…</option>
          {available.map(d => <option key={d.datasetId} value={d.datasetId}>{d.fileName} ({d.rowCount.toLocaleString()} rows)</option>)}
        </select>
        <button disabled={!selectedId || linking} onClick={() => void linkSelected()} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{linking ? 'Linking…' : 'Link dataset'}</button>
      </div>}
      <button
        onClick={() => onOpenWriting('5.8')}
        className="flex items-center gap-1.5 text-[12px] font-medium text-violet-600 hover:text-violet-800 transition-colors mt-3 mx-auto w-fit"
      >
        Open Section 5.8 in the chapter editor <ArrowRight size={12} />
      </button>
    </div>
  )
}

// ── Analysis tab ──────────────────────────────────────────────────────────────

function AnalysisTab({ project, onOpenWriting }: { project: ResearchProject; onOpenWriting: () => void }) {
  const projectId = project.id
  const navigate = useNavigate()
  const { hypotheses: allHypotheses, analysisPlan: allPlans, loadHypotheses, loadAnalysisPlan, setResearchState } = useResearchStore()
  const hypotheses = allHypotheses[projectId]
  const plan       = allPlans[projectId]
  const [loading, setLoading] = useState(!hypotheses || !plan)
  const [projectDatasets, setProjectDatasets] = useState<ProjectDataset[]>([])
  const [datasetsLoading, setDatasetsLoading] = useState(true)
  const [declaringComplete, setDeclaringComplete] = useState(false)

  useEffect(() => {
    if (hypotheses && plan) return
    setLoading(true)
    Promise.all([
      hypotheses ? Promise.resolve() : loadHypotheses(projectId),
      plan ? Promise.resolve() : loadAnalysisPlan(projectId),
    ]).finally(() => setLoading(false))
  }, [projectId])

  useEffect(() => {
    setDatasetsLoading(true)
    researchApi.getProjectDatasets(projectId)
      .then(setProjectDatasets)
      .catch(() => setProjectDatasets([]))
      .finally(() => setDatasetsLoading(false))
  }, [projectId])

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin text-slate-400" /></div>
  }

  const noHypotheses = !hypotheses || hypotheses.length === 0
  const noPlan        = !plan || plan.length === 0
  const linkedDatasets = consolidateProjectDatasets(projectDatasets).filter(dataset => dataset.isLinked)
  const completedDatasets = linkedDatasets.filter(dataset => dataset.analysisStatus === 'complete')
  const analysisDeclared = project.researchState === 'AnalysisCompleted' || project.researchState === 'CompletedResearch'

  const declareAnalysisCompleted = async () => {
    setDeclaringComplete(true)
    try {
      await setResearchState(projectId, 'AnalysisCompleted')
      toast.success('Analysis marked as completed. Results and Discussion are now unlocked.')
    } catch (err) {
      const apiErr = err as ApiError | undefined
      toast.error(apiErr?.code === 'ANALYSIS_NOT_VERIFIED'
        ? 'The linked dataset does not have a completed Data Analyst session. Open Data Analyst, complete the analysis, and link that completed session to this project.'
        : apiErr?.message ?? 'Could not declare the analysis complete.')
    } finally {
      setDeclaringComplete(false)
    }
  }

  // A project with no hypotheses/plan but a genuinely linked dataset (e.g. an externally-imported
  // thesis that skipped Chapter 4's wizard-driven hypothesis generation entirely — the same import
  // gap behind several other fixes this session) must still reach the dataset/"Declare Analysis
  // Completed" section below: that section doesn't depend on hypotheses or an analysis plan at
  // all, so gating it behind an empty-state early-return here made "Declare Analysis Completed"
  // unreachable for exactly the projects that most needed it.
  if (noHypotheses && noPlan && linkedDatasets.length === 0) {
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
      <div className={cn(
        'rounded-xl border p-5',
        completedDatasets.length > 0 ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-amber-50/60',
      )}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              {datasetsLoading ? <Loader2 size={16} className="animate-spin text-slate-400" /> :
                completedDatasets.length > 0 ? <CheckCircle2 size={17} className="text-emerald-600" /> : <AlertCircle size={17} className="text-amber-600" />}
              <p className="text-[13px] font-semibold text-slate-800">
                {datasetsLoading ? 'Checking linked analysis…' : completedDatasets.length > 0 ? 'Verified analysis complete' : 'No completed analysis linked'}
              </p>
            </div>
            {!datasetsLoading && completedDatasets.length > 0 && (
              <p className="mt-1 text-[12px] text-slate-600">
                {completedDatasets.map(dataset => dataset.fileName).join(', ')} · Results are ready for thesis writing.
              </p>
            )}
            {!datasetsLoading && completedDatasets.length === 0 && (
              <p className="mt-1 text-[12px] text-slate-600">Complete and link a Data Analyst session before writing empirical results.</p>
            )}
          </div>
          {!datasetsLoading && (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => {
                const completed = completedDatasets[0]
                navigate(completed?.completedSessionId
                  ? `/app/analyst?sessionId=${encodeURIComponent(completed.completedSessionId)}&projectId=${encodeURIComponent(projectId)}&datasetId=${encodeURIComponent(completed.datasetId)}`
                  : '/app/analyst')
              }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-700 hover:bg-slate-50">
                {completedDatasets.length > 0 ? 'Open completed analysis' : 'Open Data Analyst'}
              </button>
              {completedDatasets.length > 0 && !analysisDeclared && (
                <button
                  onClick={declareAnalysisCompleted}
                  disabled={declaringComplete}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-[12px] font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {declaringComplete && <Loader2 size={12} className="animate-spin" />}
                  {declaringComplete ? 'Updating state…' : 'Declare Analysis Completed'}
                </button>
              )}
              {completedDatasets.length > 0 && analysisDeclared && (
                <button onClick={() => onOpenWriting()} className="rounded-lg bg-violet-600 px-3 py-2 text-[12px] font-semibold text-white hover:bg-violet-700">
                  Continue to Results
                </button>
              )}
            </div>
          )}
        </div>
      </div>
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

function WritingTab({ project, onOpenWriting }: { project: ResearchProject; onOpenWriting: (sectionCode?: string) => void }) {
  const projectId = project.id
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

  const sorted = [...(sections ?? [])].sort((a, b) => a.order - b.order)
  const hypothesesNotApplicable = project.methodologyType?.trim().toLowerCase() === 'qualitative'
  const applicable = sorted.filter(s => !(hypothesesNotApplicable && s.code === '4.4'))
  const approved = applicable.filter(s => s.status === 'Approved').length
  const total = applicable.length

  // docs/OPEN_ITEMS.md #39 Q6 — Abstract (0.0) summarizes the completed thesis, so it stays
  // locked here until Conclusion (8.0) and Recommendations (8.1) are both Approved. This is the
  // real, generic per-section navigator for every ProjectSection a project actually has
  // (including thesis-only chapters like 6.0-8.1, reached via onOpenWriting's ?section= fallback)
  // — ResearchAgentPage's StepRail/getStepStatus operates on a fixed Proposal-only array
  // that structurally never contains these codes, so the lock belongs here, not there. A narrow,
  // Abstract-specific check, not a general sibling-prerequisite gate — no other row here is locked.
  const conclusionApproved = sorted.find(s => s.code === '8.0')?.status === 'Approved'
  const recommendationsApproved = sorted.find(s => s.code === '8.1')?.status === 'Approved'
  const abstractLocked = (sec: ProjectSection) =>
    sec.code === '0.0' && !(conclusionApproved && recommendationsApproved)

  return (
    <div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 mb-5 flex items-center justify-between">
        <div>
          <p className="text-[13px] font-semibold text-slate-800">{approved} of {total} sections approved</p>
          <p className="text-[12px] text-slate-500 mt-0.5">Every chapter — proposal and thesis — lives in one continuous editor.</p>
        </div>
        <button
          onClick={() => onOpenWriting()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-[12px] font-semibold transition-colors shrink-0"
        >
          Open Chapter Editor <ArrowRight size={13} />
        </button>
      </div>
      <div className="space-y-1.5">
        {sorted.map(sec => {
          const locked = abstractLocked(sec)
          return (
            <button
              key={sec.code}
              type="button"
              disabled={locked}
              onClick={() => !locked && onOpenWriting(sec.code)}
              aria-disabled={locked ? true : undefined}
              title={locked ? 'Approve Conclusion (8.0) and Recommendations (8.1) first' : undefined}
              className={cn(
                'flex w-full items-center justify-between gap-3 px-4 py-2 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
                locked ? 'cursor-default opacity-60' : 'hover:bg-slate-50',
              )}
              aria-label={locked
                ? `${sec.displayCode} ${sec.title} — locked until Conclusion and Recommendations are approved`
                : `Open section ${sec.displayCode} ${sec.title}`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                {locked && <Lock size={12} className="text-slate-400 shrink-0" />}
                {sec.requiresReReview && (
                  <span
                    title={sec.reReviewReason ?? 'This chapter needs re-review — the Research State it was approved under has since changed.'}
                    className="shrink-0"
                  >
                    <AlertTriangle size={12} className="text-amber-500" />
                  </span>
                )}
                <p className="text-[12px] text-slate-600 truncate">{sec.displayCode} {sec.title}</p>
              </div>
              <span className={cn(
                'text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0',
                locked
                  ? 'bg-slate-100 text-slate-500'
                  : hypothesesNotApplicable && sec.code === '4.4'
                    ? 'bg-violet-100 text-violet-700'
                    : SECTION_STATUS_STYLES[sec.status],
              )}>
                {locked ? 'Locked' : hypothesesNotApplicable && sec.code === '4.4' ? 'Not applicable' : sec.status}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Thesis Structure tab ─────────────────────────────────────────────────────
// Thesis Foundation (Phase 1): declared research state (gates empirical Results/Discussion),
// optional university template selection, and the computed chapter plan (status/word-count/
// locked-with-reason per chapter) — the first surface for the new backend built in this phase.

function ResearchStateControl({ project }: { project: ResearchProject }) {
  const { setResearchState } = useResearchStore()
  const [updating, setUpdating] = useState(false)
  const current = (project.researchState ?? 'Proposal') as ResearchState
  const currentOption = RESEARCH_STATE_OPTIONS.find(o => o.value === current)

  const handleChange = async (next: ResearchState) => {
    setUpdating(true)
    try {
      await setResearchState(project.id, next)
      toast.success(`Research state updated to "${RESEARCH_STATE_OPTIONS.find(o => o.value === next)?.label ?? next}".`)
    } catch (err) {
      const apiErr = err as ApiError | undefined
      toast.error(apiErr?.code === 'ANALYSIS_NOT_VERIFIED'
        ? 'Analysis Completed requires a linked, completed Data Analyst session first.'
        : apiErr?.message ?? 'Could not update research state.')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 p-5">
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Research State</p>
      <p className="text-[13px] text-slate-600 mb-3">
        Declares how far along your empirical study is. Governs whether the Results and Discussion
        chapters can be written — Analysis Completed requires a linked, completed Data Analyst session.
      </p>
      <select
        value={current}
        disabled={updating}
        onChange={e => handleChange(e.target.value as ResearchState)}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-700 disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-violet-400"
      >
        {RESEARCH_STATE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {currentOption && <p className="text-[11px] text-slate-400 mt-2">{currentOption.description}</p>}
    </div>
  )
}

function UniversityTemplateControl({ project }: { project: ResearchProject }) {
  const { universityTemplates, loadUniversityTemplates, setUniversityTemplate } = useResearchStore()
  const [detail, setDetail] = useState<UniversityTemplateDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [showStructurePreview, setShowStructurePreview] = useState(false)

  useEffect(() => {
    if (universityTemplates.length === 0) loadUniversityTemplates().catch(() => {})
  }, [])

  useEffect(() => {
    if (!project.universityTemplateId) { setDetail(null); return }
    setLoadingDetail(true)
    researchApi.getUniversityTemplate(project.universityTemplateId)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoadingDetail(false))
  }, [project.universityTemplateId])

  const handleChange = async (id: string) => {
    setUpdating(true)
    try {
      await setUniversityTemplate(project.id, id || null)
    } catch {
      toast.error('Could not update the university template.')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 p-5">
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">University Template</p>
      <p className="text-[13px] text-slate-600 mb-3">
        Optional — associates this project with an institution-specific template. Informational
        only for now; nothing in generation reads this yet.
      </p>
      <select
        value={project.universityTemplateId ?? ''}
        disabled={updating}
        onChange={e => handleChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-700 disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-violet-400"
      >
        <option value="">No template selected</option>
        {universityTemplates.map(t => (
          <option key={t.id} value={t.id}>{t.name}{t.isIllustrative ? ' (illustrative example)' : ''}</option>
        ))}
      </select>
      {loadingDetail ? (
        <div className="flex justify-center py-4"><Loader2 size={14} className="animate-spin text-slate-400" /></div>
      ) : detail && (
        <>
          {detail.notes && (
            <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5">
              <p className="text-[11px] text-slate-500 leading-relaxed">{detail.notes}</p>
            </div>
          )}
          {detail.sections.length > 0 ? (
            <div className="mt-3">
              <button
                onClick={() => setShowStructurePreview(v => !v)}
                className="text-[11px] font-medium text-violet-600 hover:text-violet-800 transition-colors"
              >
                {showStructurePreview ? 'Hide' : 'Preview'} chapter structure ({detail.sections.length} sections)
              </button>
              {showStructurePreview && (
                <div className="mt-2 space-y-1">
                  {[...detail.sections].sort((a, b) => a.displayOrder - b.displayOrder).map(s => (
                    <div key={s.sectionCode} className="flex items-center justify-between gap-2 text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-50">
                      <span className="text-slate-600 truncate">{s.sectionCode} {s.title}</span>
                      <span className="text-slate-400 shrink-0">
                        {s.targetWordCount.toLocaleString()} words{!s.isRequired && ' · optional'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 mt-3">
              No chapter structure published for this institution yet — see the notes above for
              what is and isn't confirmed.
            </p>
          )}
        </>
      )}
    </div>
  )
}

function ChapterPlanList({ projectId }: { projectId: string }) {
  const { thesisChapterPlan, loadThesisChapterPlan, isLoadingChapterPlan } = useResearchStore()
  const plan = thesisChapterPlan[projectId]

  useEffect(() => { loadThesisChapterPlan(projectId).catch(() => {}) }, [projectId])

  if (isLoadingChapterPlan && !plan) {
    return <div className="flex justify-center py-10"><Loader2 size={18} className="animate-spin text-slate-400" /></div>
  }
  if (!plan || plan.chapters.length === 0) {
    return (
      <EmptyPlaceholder
        icon={ListChecks}
        title="No chapter plan yet"
        subtitle="Chapters appear here once sections have been created for this project."
      />
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[12px] font-semibold text-slate-700">Chapter Plan</p>
        <button
          onClick={() => loadThesisChapterPlan(projectId)}
          aria-label="Refresh chapter plan"
          className="text-slate-400 hover:text-violet-600 transition-colors"
        >
          <RefreshCw size={12} />
        </button>
      </div>
      <div className="space-y-1.5">
        {plan.chapters.map(ch => (
          <div key={ch.sectionCode} className="rounded-xl border border-slate-200 px-4 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                {ch.locked && <Lock size={12} className="text-slate-400 shrink-0" />}
                <p className="text-[12px] text-slate-600 truncate">{ch.sectionCode} {ch.title}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-slate-400">
                  {ch.currentWordCount.toLocaleString()}{ch.targetWordCount ? ` / ${ch.targetWordCount.toLocaleString()}` : ''} words
                </span>
                <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full', SECTION_STATUS_STYLES[ch.status])}>
                  {ch.status}
                </span>
              </div>
            </div>
            {ch.locked && ch.lockedReason && (
              <p className="text-[11px] text-amber-700 mt-1.5 pl-[18px]">{ch.lockedReason}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// Thesis Foundation (Phase 2), Step 2 — proposal-to-thesis content mapping review. Preview is
// fetched automatically; Apply persists it as a durable "the student reviewed this" record (see
// IProposalToThesisContentMapper's doc comment) — it never copies or mutates section content.
const CLASSIFICATION_STYLES: Record<string, string> = {
  ReusableUnchanged:      'bg-green-tint text-green-text',
  ReusableWithExpansion:  'bg-sky-100 text-sky-700',
  RequiresUpdating:       'bg-amber-tint text-amber-text',
  Contradictory:          'bg-red-100 text-red-700',
  Obsolete:               'bg-red-100 text-red-700',
  Missing:                'bg-slate-100 text-slate-500',
}
const CLASSIFICATION_LABELS: Record<string, string> = {
  ReusableUnchanged:     'Reusable',
  ReusableWithExpansion: 'Expand',
  RequiresUpdating:      'Needs update',
  Contradictory:         'Contradictory',
  Obsolete:              'Obsolete',
  Missing:               'Missing',
}

function ContentMappingReview({ projectId }: { projectId: string }) {
  const { contentMapping, isLoadingContentMapping, loadContentMappingPreview, applyContentMapping } = useResearchStore()
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    loadContentMappingPreview(projectId).catch(() => toast.error('Could not load the thesis readiness review.'))
  }, [projectId])

  const handleApply = async () => {
    setApplying(true)
    try {
      await applyContentMapping(projectId)
      toast.success('Thesis readiness review recorded.')
    } catch {
      toast.error('Could not record this review — please try again.')
    } finally {
      setApplying(false)
    }
  }

  if (isLoadingContentMapping && !contentMapping) {
    return <div className="flex justify-center py-10"><Loader2 size={18} className="animate-spin text-slate-400" /></div>
  }
  if (!contentMapping) return null

  const chapters = [...new Set(contentMapping.sections.map(s => s.chapterLabel))]

  return (
    <div className="rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Thesis Readiness Review</p>
        <button
          onClick={handleApply}
          disabled={applying}
          className="flex items-center gap-1.5 text-[11px] font-medium text-violet-600 hover:text-violet-800 transition-colors disabled:opacity-50"
        >
          {applying ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
          Mark reviewed
        </button>
      </div>
      <p className="text-[13px] text-slate-600 mb-4">
        A per-chapter assessment of your Chapter 1-3 sections' readiness for the thesis workspace —
        computed live, never changes your content.
      </p>
      <div className="space-y-4">
        {chapters.map(chapter => (
          <div key={chapter}>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{chapter}</p>
            <div className="space-y-1.5">
              {contentMapping.sections.filter(s => s.chapterLabel === chapter).map(s => (
                <div key={s.sectionCode} className="rounded-lg border border-slate-100 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12px] text-slate-700 truncate">{s.sectionCode} {s.title}</p>
                    <span className={cn('shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full', CLASSIFICATION_STYLES[s.classification] ?? 'bg-slate-100 text-slate-500')}>
                      {CLASSIFICATION_LABELS[s.classification] ?? s.classification}
                    </span>
                  </div>
                  {s.reason && <p className="text-[11px] text-slate-400 mt-1">{s.reason}</p>}
                  {s.detectedConflicts.map((c, i) => (
                    <p key={i} className="text-[11px] text-red-600 mt-1">{c}</p>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StructureTab({ project }: { project: ResearchProject }) {
  return (
    <div className="space-y-5">
      <ResearchStateControl project={project} />
      <UniversityTemplateControl project={project} />
      <ChapterPlanList projectId={project.id} />
      <ContentMappingReview projectId={project.id} />
    </div>
  )
}

// ── Roadmap tab ───────────────────────────────────────────────────────────────

const MILESTONE_STATUS_OPTIONS: MilestoneStatus[] = ['NotStarted', 'InProgress', 'Complete', 'Skipped']

// What actually drives each auto-tracked milestone — replaces the old one-size-fits-all "Auto-
// tracked from the chapter editor" caption, which was shown verbatim for milestones driven by
// completely different real signals (the Ethics & Compliance Manager, the Data Analyst module,
// approved research instruments — none of which are "the chapter editor").
const AUTO_TRACKED_SOURCE_LABEL: Record<string, string> = {
  ethics:      'Auto-tracked from the Ethics & Compliance Manager',
  instruments: 'Auto-tracked from approved research instruments',
  literature:  'Auto-tracked from the Literature Review chapter',
  analysis:    'Auto-tracked from the Data Analyst module',
  results:     'Auto-tracked from the chapter editor',
  discussion:  'Auto-tracked from the chapter editor',
  conclusion:  'Auto-tracked from the chapter editor',
}

// Which tab a milestone's row should jump to — only milestones with a real destination get a link.
const MILESTONE_TAB_LINK: Partial<Record<string, TabKey>> = {
  ethics:      'ethics',
  instruments: 'instruments',
  literature:  'literature',
  analysis:    'analysis',
  results:     'writing',
  discussion:  'writing',
  conclusion:  'writing',
}

function RoadmapTab({ projectId, onNavigateToTab }: { projectId: string; onNavigateToTab: (tab: TabKey) => void }) {
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
              {MILESTONE_TAB_LINK[m.key] ? (
                <button
                  onClick={() => onNavigateToTab(MILESTONE_TAB_LINK[m.key]!)}
                  className="text-[13px] font-medium text-violet-700 hover:underline text-left"
                >
                  {m.label}
                </button>
              ) : (
                <p className="text-[13px] font-medium text-slate-700">{m.label}</p>
              )}
              {m.isAutoTracked && (
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {AUTO_TRACKED_SOURCE_LABEL[m.key] ?? 'Auto-tracked from the chapter editor'}
                </p>
              )}
              {m.notes && <p className="text-[11px] text-amber-700 mt-0.5">{m.notes}</p>}
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
    try {
      await exportThesisDocx(projectId)
    } catch (err) {
      toast.error((err as ApiError | undefined)?.message ?? 'Thesis export was blocked.')
    } finally {
      setExporting(false)
    }
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
            onClick={() => onOpenWriting()}
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

function ValidationPanel({ projectId, onOpenSection }: { projectId: string; onOpenSection: (sectionCode: string) => void }) {
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
      {summary?.freshness === 'NotValidated' && <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">Not yet validated.</p>}
      {summary?.freshness === 'OutOfDate' && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700">Validation out of date. Revalidate to refresh these results.</p>}
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
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <p className={cn(
                      'text-[10px] font-semibold uppercase tracking-wide',
                      item.status === 'Fail' ? 'text-red-600' : 'text-amber-600',
                    )}>
                      {item.status}
                    </p>
                    {item.sectionCode && (
                      <button
                        onClick={() => onOpenSection(item.sectionCode!)}
                        className="shrink-0 text-[10px] font-medium text-violet-600 hover:text-violet-800 transition-colors"
                      >
                        Section {item.sectionCode} →
                      </button>
                    )}
                  </div>
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
  const navigate = useNavigate()
  const researchStore = useResearchStore()
  const [phase, setPhase] = useState<GenerationPhase>('NotStarted')
  const [currentSection, setCurrentSection] = useState<string | null>(null)
  const [words, setWords] = useState(0)
  const [repairFailures, setRepairFailures] = useState<{ message: string; checkKey?: string }[]>([])
  const [repairing, setRepairing] = useState(false)
  const [repairCandidates, setRepairCandidates] = useState<MethodologyAnchorCandidate[]>([])
  const [showRepairCandidateReview, setShowRepairCandidateReview] = useState(false)
  const [repairAttempted, setRepairAttempted] = useState(false)
  const [candidateLookupComplete, setCandidateLookupComplete] = useState(false)
  const pollTimer = useRef<number | null>(null)

  const isActive = phase === 'Starting' || phase === 'Generating'
  const unresolvedSectionCode = repairFailures
    .map(f => /(?:Section\s+)?(\d+(?:\.\d+)?)/i.exec(f.message)?.[1])
    .find((code): code is string => Boolean(code))
  const unresolvedStepIndex = unresolvedSectionCode
    ? STEPS.findIndex(step => step.id === unresolvedSectionCode)
    : -1
  const hasAutoRepairableFailure = repairFailures.some(f =>
    f.checkKey === 'methodology_anchor_present' || /methodology-anchor citation/i.test(f.message),
  )

  const openUnresolvedSection = () => {
    const suffix = unresolvedStepIndex >= 0
      ? `?step=${unresolvedStepIndex}`
      : unresolvedSectionCode
        ? `?section=${encodeURIComponent(unresolvedSectionCode)}`
        : ''
    navigate(`/app/research-agent/${projectId}${suffix}`)
  }

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
    const previousPhase = phase
    setPhase('Starting')
    try {
      const savedWordCount = Number(useResearchStore.getState().projects.find(p => p.id === projectId)?.sectionContent.targetSectionWordCount)
      const targetWordCount = Number.isFinite(savedWordCount) && savedWordCount >= 150
        ? Math.round(savedWordCount) : RESUME_SECTION_WORD_COUNT
      const status = await researchStore.generateAutonomous(projectId, targetWordCount)
      setPhase(status.status)
      setCurrentSection(status.currentSection)
      setWords(status.wordsWritten)
      pollTimer.current = window.setTimeout(poll, GENERATION_POLL_MS)
    } catch (err) {
      setPhase(previousPhase)
      const apiErr = err as ApiError | undefined
      if (apiErr?.code === 'VALIDATION_GATE_FAILED') {
        const fails = (apiErr.details as { fails?: { message: string }[] } | undefined)?.fails ?? []
        setRepairFailures(fails.length > 0 ? fails : [{ message: 'A blocking validation issue must be resolved.' }])
        setRepairCandidates([])
        setRepairAttempted(false)
        setCandidateLookupComplete(false)
      } else {
        toast.error(apiErr?.message ?? 'Could not start generation — check the server is running.')
      }
    }
  }

  const fixAndContinue = async () => {
    if (!hasAutoRepairableFailure) {
      setRepairAttempted(true)
      setCandidateLookupComplete(true)
      return
    }
    setRepairing(true)
    setRepairAttempted(true)
    try {
      const status = await researchStore.generateAutonomous(projectId, RESUME_SECTION_WORD_COUNT, true)
      setRepairFailures([])
      setPhase(status.status)
      toast.success(`AI repaired the safe validation issues. Generation has started.`)
      pollTimer.current = window.setTimeout(poll, GENERATION_POLL_MS)
    } catch (err) {
      const apiErr = err as ApiError | undefined
      const remaining = (apiErr?.details as { fails?: { message: string }[] } | undefined)?.fails
      if (remaining?.length) setRepairFailures(remaining)
      if (remaining?.length) {
        setCandidateLookupComplete(false)
        researchApi.getMethodologyAnchorCandidates(projectId)
          .then(setRepairCandidates)
          .catch(() => setRepairCandidates([]))
          .finally(() => setCandidateLookupComplete(true))
      }
      toast.error(remaining?.length
        ? 'Safe repairs were applied. Remaining issues need source review or section revision.'
        : (apiErr?.message ?? 'Some issues could not be repaired safely.'))
    } finally { setRepairing(false) }
  }

  const handleCancel = () => {
    researchStore.cancelGeneration(projectId).catch(() => {})
  }

  if (!isActive && !hasRemainingSections) return null

  return (
    <>
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
        <>
        {phase === 'NeedsReview' && (
          <button onClick={() => navigate(`/app/research-agent/${projectId}?section=${encodeURIComponent(currentSection ?? '1.0')}`)}
            className="text-[12px] font-medium text-amber-700">
            Review section {currentSection}
          </button>
        )}
        <button
          onClick={handleStart}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-[12px] font-semibold transition-colors shrink-0"
        >
          <Play size={13} /> {phase === 'NeedsReview' ? 'Resume Process' : 'Start Process'}
        </button>
        </>
      )}
    </div>
    <Modal isOpen={repairFailures.length > 0 && !showRepairCandidateReview} onClose={() => !repairing && setRepairFailures([])} title="AI validation repair" size="md">
      <p className="text-sm text-slate-700 mb-3">
        {repairCandidates.length > 0
          ? `${repairFailures.length} issue${repairFailures.length === 1 ? '' : 's'} remain after safe repair.`
          : `AI found ${repairFailures.length} issue${repairFailures.length === 1 ? '' : 's'} that must be resolved.`}
      </p>
      <div className="space-y-2 mb-4">{repairFailures.map((f, i) => <div key={i} className="rounded-lg border border-slate-200 p-2.5 text-xs text-slate-600">{f.message}</div>)}</div>
      {repairing && <div className="rounded-lg bg-violet-50 p-3 mb-4 text-xs text-violet-700 flex gap-2"><Loader2 size={14} className="animate-spin shrink-0" /><span>Finding verified methodology evidence and revalidating… This attempt stops automatically after 45 seconds.</span></div>}
      {!repairing && !hasAutoRepairableFailure && (
        <p className="text-xs text-slate-500 mb-4">
          This issue cannot be repaired by changing a citation. Draft the missing section, then start the process again.
        </p>
      )}
      {!repairing && repairCandidates.length > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mb-4 text-xs text-amber-800">
          The search found {repairCandidates.length} plausible source{repairCandidates.length === 1 ? '' : 's'}, but choosing between them requires your confirmation.
        </div>
      )}
      {!repairing && hasAutoRepairableFailure && repairAttempted && candidateLookupComplete && repairCandidates.length === 0 && (
        <p className="text-xs text-slate-500 mb-4">
          No unambiguous verified source was found. Open section {unresolvedSectionCode ?? ''} and revise or regenerate it before retrying generation.
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button disabled={repairing} onClick={() => setRepairFailures([])} className="px-3 py-2 text-sm text-slate-600">Cancel</button>
        {repairCandidates.length > 0 ? (
          <button disabled={repairing} onClick={() => setShowRepairCandidateReview(true)} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            Review source candidates
          </button>
        ) : !hasAutoRepairableFailure || (repairAttempted && candidateLookupComplete) ? (
          <button disabled={repairing} onClick={openUnresolvedSection} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            Open section {unresolvedSectionCode ?? ''}
          </button>
        ) : (
          <button disabled={repairing} onClick={() => void fixAndContinue()} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{repairing ? 'Fixing…' : `Fix ${repairFailures.length} issue${repairFailures.length === 1 ? '' : 's'} and continue`}</button>
        )}
      </div>
    </Modal>
    <MethodologyAnchorCandidatesModal
      projectId={projectId}
      isOpen={showRepairCandidateReview}
      onClose={() => setShowRepairCandidateReview(false)}
      onResolved={() => {
        researchApi.getMethodologyAnchorCandidates(projectId)
          .then(setRepairCandidates)
          .catch(() => {})
      }}
    />
    </>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ResearchDashboardPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate      = useNavigate()
  const researchStore = useResearchStore()
  const [dashboardParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<TabKey>(() => TABS.some(tab => tab.key === dashboardParams.get('tab')) ? dashboardParams.get('tab') as TabKey : 'proposal')

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
  const hypothesesNotApplicable = project?.methodologyType?.trim().toLowerCase() === 'qualitative'
  const hasRemainingSections = !sections || CHAPTER_STEPS.some(
    step => !(hypothesesNotApplicable && step.sectionKey === '4.4') &&
      (sections.find(s => s.code === step.sectionKey)?.status ?? 'NotStarted') !== 'Approved',
  )

  // Deep-links into the wizard's own ?step=N when a specific section is named, instead of always
  // falling back to project.currentStep. ?step=N is a raw 0-indexed position into STEPS — see
  // ResearchAgentPage's "const currentStep = ... urlStepNum ... : (project?.currentStep ?? 0)"
  // and "STEPS[currentStep]" — NOT the 1-indexed "Step N of 32" label that's derived from it by
  // adding 1 for display. Every "Open Section X.X" CTA below previously navigated here with no
  // step at all, so every tab landed wherever the project's stored currentStep happened to be
  // (often the Methodology Type setup question) regardless of which section the button promised.
  const openWriting = (sectionCode?: string) => {
    // React supplies a MouseEvent to a bare onClick callback. Keep this boundary defensive so
    // an accidentally forwarded event can never be serialized as ?section=[object Object].
    const safeSectionCode = typeof sectionCode === 'string' ? sectionCode.trim() : '';
    const stepIndex = safeSectionCode ? STEPS.findIndex(s => s.id === safeSectionCode) : -1;
    if (stepIndex >= 0) {
      navigate(`/app/research-agent/${projectId}?step=${stepIndex}`);
      return;
    }
    navigate(safeSectionCode
      ? `/app/research-agent/${projectId}?section=${encodeURIComponent(safeSectionCode)}`
      : `/app/research-agent/${projectId}`);
  }
  const openResultsWriting = () => navigate(`/app/research-agent/${projectId}?section=6.0`)

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
        <div className="shrink-0 border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-end gap-2">
          <StartProcessControl projectId={projectId} hasRemainingSections={hasRemainingSections} />
          <button className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-[12px] font-medium text-violet-700" onClick={() => navigate(`/app/research-agent/${projectId}/proposal-workflow`)}>Research & Submission Review</button>
          <button
            onClick={() => navigate(`/app/research-agent/${projectId}/document`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-[12px] font-medium transition-colors shrink-0"
          >
            <ExternalLink size={13} /> View Document
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {activeTab === 'proposal' && project.documentType === 'Proposal' && <div className="mb-5"><ProposalDesignReadinessPanel projectId={projectId} /></div>}
          {activeTab === 'proposal'        && <ProposalTab projectId={projectId} isExternallySourced={!!project.isExternallySourced} onOpenWriting={openWriting} />}
          {activeTab === 'literature'      && <LiteratureTab projectId={projectId} />}
          {activeTab === 'methodology'     && <MethodologyTab projectId={projectId} methodologyType={project.methodologyType} methodologySubType={project.methodologySubType} onOpenWriting={openWriting} />}
          {activeTab === 'ethics'          && <EthicsTab projectId={projectId} onOpenWriting={openWriting} />}
          {activeTab === 'instruments'     && <InstrumentsTab projectId={projectId} />}
          {activeTab === 'data-collection' && <DataCollectionTab projectId={projectId} onOpenWriting={openWriting} />}
          {activeTab === 'analysis'        && <AnalysisTab project={project} onOpenWriting={openResultsWriting} />}
          {activeTab === 'writing'         && <WritingTab project={project} onOpenWriting={openWriting} />}
          {activeTab === 'structure'       && <StructureTab project={project} />}
          {activeTab === 'roadmap'         && <RoadmapTab projectId={projectId} onNavigateToTab={setActiveTab} />}
          {activeTab === 'validation'      && <ValidationTab projectId={projectId} />}
          {activeTab === 'submission'      && <SubmissionTab projectId={projectId} onOpenWriting={openWriting} />}
        </div>
      </div>

      {/* ── 4. Right panel — 300px: Validation / Notes / AI Assistant ───────── */}
      <aside
        className="shrink-0 overflow-y-auto"
        style={{ width: 300, borderLeft: '1px solid #e2e8f0' }}
      >
        <ValidationPanel projectId={projectId} onOpenSection={openWriting} />
        <NotesPanel project={project} />
        <AiAssistantPanel />
      </aside>
    </div>
  )
}
