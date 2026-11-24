import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ListTree, Bot, X, Lock } from 'lucide-react'
import toast from 'react-hot-toast'
import { CONFIRM_APPROVAL_ISSUES, REQUIRE_CHAPTER_ORDER, REVIEW_EXPORT_GATE, showCitationFlags, showFlagCounts } from '../../../config/features'
import type { ApiError } from '../../../types'
import type { AlignmentIssue, BibliographyEntry, CitationFlag, FetchedLiterature, ProjectSection, ResearchProject } from '../../../types/research'
import type { ParsedReference } from '../../../lib/citationFormat'
import { bibliographyReferences } from '../../../lib/bibliographyState'
import { useResearchStore } from '../../../store/researchStore'
import { useAuthStore } from '../../../store/authStore'
import { useUiStore } from '../../../store/uiStore'
import { CREDIT_COSTS } from '../../../config/creditCosts'
import { researchApi } from '../../../api/research'
import { proposalJourneyApi } from '../../../api/proposalJourney'
import { useConfirm } from '../../ui/ConfirmDialog'
import { canDraft, dedupeSections, documentStatus, DRAFT_AHEAD_KEY, hasSectionBody, isDraftAheadOn, isThesisDocument, needsKeyDecisions, withReviewMarks, type DraftContext } from '../../../lib/sectionWorkflow'
import { buildOutline, documentCounts, sectionFlags, type SectionFlag } from '../../../lib/documentOutline'
import { nextDraftAction } from '../../../lib/draftPlan'
import { followDraft, forgetDraft } from '../../../lib/liveDraftStore'
import { isRunActive, isRunVisible, useProposalRun } from '../../../lib/proposalRun'
import { DocumentOutlineRail, type OutlineRow } from './DocumentOutlineRail'
import { DocumentSectionBlock } from './DocumentSectionBlock'
import { DocumentAgentPanel, type FlagGroup, type RunInfo } from './DocumentAgentPanel'
import { DocumentEndCard } from './DocumentEndCard'
import { DocumentReferences } from './DocumentReferences'
import { CitationDataContext, type CitationData } from './citationDataContext'
import { DesignContractPanel } from './DesignContractPanel'
import { ReviewIssuesCard } from './ReviewIssuesCard'
import { RewriteReviewDialog } from './RewriteReviewDialog'
import {
  CONTRACT_FIELD, DESIGN_CONTRACT_KEY, EDITED_AFTER_APPROVAL_KEY, STALE_KEY, changedFields, clearStale, keyDecisionsSet, propagateStale,
  readContract, readEditedAfterApproval, readStale, serializeCodes, serializeContract, suggestedDecisions, withSuggestedDefaults, type DesignContract,
} from '../../../lib/designContract'
import { openIssueCount, runDocumentReview, type ReviewIssue } from '../../../lib/documentReview'
import { useSectionCitationChecks } from '../../../lib/sectionCitationCheck'
import { readRewriteReviews, rewriteLanded, writeRewriteReviews, type RewriteReview } from '../../../lib/rewriteReview'
import '../../../styles/research-agent-editor.css'
import '../../../styles/research-document-mode.css'

export interface DocumentModeActions { validate: () => void; export: () => void }
export interface DocumentModeActionsState { isValidating: boolean; isExporting: boolean; isThesisOrDissertation: boolean }

interface Props {
  project: ResearchProject
  actionsRef?: React.MutableRefObject<DocumentModeActions | null>
  onActionsStateChange?: (state: DocumentModeActionsState) => void
  /** Switch to Guided with this section open (where drafting and flag repair tools live). */
  onOpenGuided: (code: string) => void
}

const EMPTY_SECTIONS: ProjectSection[] = []
/** Fallback per-section length when the project set none (same default as Guided). */
const DEFAULT_SECTION_WORDS = 500
/** Most recent entries kept in the agent panel's activity log. */
const ACTIVITY_LIMIT = 8

export interface ActivityEntry { id: string; text: string; state: 'done' | 'active' | 'error' }
const POLL_MS = 3000
/** Offset from the top of the document column at which a section counts as "current". */
const ACTIVE_OFFSET = 120

// Approval refusals whose fix lives in Guided's citation/fact tools. The checks can be wrong, so
// the ones the server lets a student acknowledge get an "Approve anyway" button (same as Guided).
const APPROVE_BLOCK_TEXT: Record<string, string> = {
  APPROVAL_HARD_BLOCKED:      'This section has problems that must be fixed before it can be approved.',
  FACT_CONFLICT:              'This section states a fact that contradicts an earlier chapter.',
  CITATION_INTEGRITY_BLOCKED: 'This section has citation issues to resolve first.',
  UNRESOLVED_CITATION_GAP:    'This section still has a citation gap to fill.',
  CITATION_TARGET_SHORTFALL:  'This section has too few resolved citations.',
  PROSE_BODY_MISSING:         'This section has no body text yet.',
  METHODOLOGY_VIOLATION:      'This section contradicts your confirmed methodology.',
  METHODOLOGY_NOT_CONFIRMED:  'Confirm your methodology in Setup before approving this section.',
}
/** Refusals the server lifts when the approval is retried as acknowledged. */
const OVERRIDABLE_BLOCKS = new Set([
  'FACT_CONFLICT', 'CITATION_INTEGRITY_BLOCKED', 'UNRESOLVED_CITATION_GAP', 'CITATION_TARGET_SHORTFALL', 'PROSE_BODY_MISSING',
])

export function DocumentModeView({ project, actionsRef, onActionsStateChange, onOpenGuided }: Props) {
  const navigate = useNavigate()
  const rawSections = useResearchStore(s => s.sections[project.id] ?? EMPTY_SECTIONS)
  const sections = useMemo(() => dedupeSections(rawSections), [rawSections])
  const { confirm, dialog } = useConfirm()

  const [citationFlags, setCitationFlags] = useState<CitationFlag[]>([])
  // Pinned sources (and, for IEEE, the numbered reference list) that inline citations resolve to.
  const [literature, setLiterature] = useState<FetchedLiterature[]>([])
  const [bibliography, setBibliography] = useState<ParsedReference[]>([])
  const [referenceEntries, setReferenceEntries] = useState<BibliographyEntry[] | null>(null)
  const [literatureVersion, setLiteratureVersion] = useState(0)
  const [alignmentIssues, setAlignmentIssues] = useState<AlignmentIssue[]>([])
  const [approvingCode, setApprovingCode] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [activeCode, setActiveCode] = useState<string | null>(null)
  const [outlineOpen, setOutlineOpen] = useState(false)
  const [agentOpen, setAgentOpen] = useState(false)
  // Sections still to draft in the chapter the student started (drafted one after another).
  const [draftQueue, setDraftQueue] = useState<string[]>([])
  const [stoppingCode, setStoppingCode] = useState<string | null>(null)
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [stoppingAll, setStoppingAll] = useState(false)
  const [savingContract, setSavingContract] = useState(false)
  const [reviewIssues, setReviewIssues] = useState<ReviewIssue[] | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const [reviewedKey, setReviewedKey] = useState('')
  // Rewrites over text the student edited, waiting for their per-change decision (kept across reloads).
  const [rewriteReviews, setRewriteReviews] = useState<Record<string, RewriteReview>>(() => readRewriteReviews(project.id))
  const [reviewingRewrite, setReviewingRewrite] = useState<string | null>(null)
  const [applyingRewrite, setApplyingRewrite] = useState(false)
  const startingRef = useRef(false)
  const targetWords = Number(project.sectionContent?.['targetSectionWordCount']) || DEFAULT_SECTION_WORDS

  const logActivity = useCallback((text: string, state: ActivityEntry['state'] = 'done') => {
    setActivity(prev => [{ id: `${Date.now()}-${prev.length}`, text, state }, ...prev].slice(0, ACTIVITY_LIMIT))
  }, [])

  const scrollRef = useRef<HTMLElement | null>(null)
  const anchors = useRef(new Map<string, HTMLElement>())
  // Sections whose text changed materially since the last "Check alignment" (re-check needed).
  const [staleAlignment, setStaleAlignment] = useState<string[]>([])
  // Each mounted editor's "save now" — awaited before approve, alignment and export.
  const flushers = useRef(new Map<string, () => Promise<boolean>>())

  const registerFlush = useCallback((code: string, flush: (() => Promise<boolean>) | null) => {
    if (flush) flushers.current.set(code, flush)
    else flushers.current.delete(code)
  }, [])
  const flushAll = useCallback(() => Promise.all([...flushers.current.values()].map(f => f())), [])
  // Each mounted editor's "select these words" — used to open a Review issue at its text.
  const revealers = useRef(new Map<string, (text: string | null) => boolean>())
  const registerReveal = useCallback((code: string, reveal: ((text: string | null) => boolean) | null) => {
    if (reveal) revealers.current.set(code, reveal)
    else revealers.current.delete(code)
  }, [])

  // ── Design contract, stale marks and "edited after approval": all on the synced sectionContent ──
  const contract = useMemo(() => readContract(project.sectionContent), [project.sectionContent])
  const staleMarks = useMemo(() => readStale(project.sectionContent), [project.sectionContent])
  const editedApproved = useMemo(() => readEditedAfterApproval(project.sectionContent), [project.sectionContent])

  /** Writes keys of the project's sectionContent and syncs them (the same path the wizard's answers take). */
  const persistContent = useCallback(async (entries: Record<string, string>): Promise<boolean> => {
    const id = latest.current.project.id
    const store = useResearchStore.getState()
    for (const [key, value] of Object.entries(entries)) store.setContent(id, key, value)
    try {
      await store.syncProject(id)
      return true
    } catch {
      toast.error('The change is shown here but could not be saved yet. It will be saved with your next change.')
      return false
    }
  }, [])

  const handleSaveContract = useCallback(async (next: DesignContract): Promise<boolean> => {
    const { project: p, sections: list } = latest.current
    const before = readContract(p.sectionContent)
    const changed = changedFields(before, next)
    if (!changed.length) return true
    const previous = readStale(p.sectionContent)
    const stale = propagateStale(previous, changed, list)
    const newlyStale = Object.keys(stale).filter(code => (stale[code]?.length ?? 0) !== (previous[code]?.length ?? 0))
    setSavingContract(true)
    try {
      const ok = await persistContent({ [DESIGN_CONTRACT_KEY]: serializeContract(next), [STALE_KEY]: JSON.stringify(stale) })
      const fields = changed.map(k => CONTRACT_FIELD[k].label).join(', ')
      logActivity(`Study decisions changed: ${fields}`)
      if (ok) {
        toast.success(newlyStale.length
          ? `Study decisions saved. ${newlyStale.length} drafted section${newlyStale.length === 1 ? '' : 's'} may be out of date: ${newlyStale.join(', ')}.`
          : 'Study decisions saved. New drafts will follow them.', { duration: 7000 })
      }
      return ok
    } finally {
      setSavingContract(false)
    }
  }, [persistContent, logActivity])

  // Suggested values for the key decisions, from the project's own setup answers and confirmed methodology.
  const suggestions = useMemo(() => {
    const m = project.confirmedMethodology
    return suggestedDecisions({
      methodologyType:    m?.methodologyType || project.methodologyType,
      methodologySubType: m?.methodologySubType || project.methodologySubType,
      researchDesign:     m?.researchDesign || project.sectionContent?.['methodology-design'],
      dataCollection:     m?.dataCollectionApproach || project.sectionContent?.['methodology-data-collection'],
    })
  }, [project.confirmedMethodology, project.methodologyType, project.methodologySubType, project.sectionContent])

  // "Use suggested defaults": writes the values into the decisions, so they show as set and can be edited.
  const handleUseDefaults = useCallback(async () => {
    const current = readContract(latest.current.project.sectionContent)
    const next = withSuggestedDefaults(current, suggestions)
    if (await handleSaveContract(next)) toast('Suggested decisions saved. Check them and change any that differ from your study.', { duration: 7000 })
  }, [handleSaveContract, suggestions])

  // Clears the stale and edited-after-approval marks of one section (approved, reviewed or rewritten).
  const clearMarks = useCallback(async (code: string, which: { stale?: boolean; edited?: boolean }) => {
    const p = latest.current.project
    const entries: Record<string, string> = {}
    const stale = readStale(p.sectionContent)
    if (which.stale && stale[code]) entries[STALE_KEY] = JSON.stringify(clearStale(stale, code))
    const edited = readEditedAfterApproval(p.sectionContent)
    if (which.edited && edited.includes(code)) entries[EDITED_AFTER_APPROVAL_KEY] = serializeCodes(edited.filter(c => c !== code))
    if (Object.keys(entries).length) await persistContent(entries)
  }, [persistContent])

  const handleMarkReviewed = useCallback((code: string) => {
    void clearMarks(code, { stale: true }).then(() => logActivity(`Checked ${code} against the study decisions`))
  }, [clearMarks, logActivity])

  const handleEditedApproved = useCallback((code: string) => {
    const edited = readEditedAfterApproval(latest.current.project.sectionContent)
    if (edited.includes(code)) return
    void persistContent({ [EDITED_AFTER_APPROVAL_KEY]: serializeCodes([...edited, code]) })
  }, [persistContent])

  // A material edit ends the approval (server rule, SectionEditPolicy) and makes the last
  // alignment result for that section out of date: drop it and ask for a re-check.
  const handleDemoted = useCallback((code: string) => {
    setAlignmentIssues(prev => prev.filter(i => i.sectionCode !== code))
    setStaleAlignment(prev => (prev.includes(code) ? prev : [...prev, code]))
    toast(`Your edit to ${code} changed more than a small fix, so it needs approving again. Run Check alignment when you are done editing.`, { duration: 8000 })
  }, [])
  const isThesis = isThesisDocument(project.documentType)

  // ── Derived view model (one pass; blocks re-render only when their own slice changes) ──
  const ctx: DraftContext = useMemo(() => ({
    sections,
    documentType:         project.documentType,
    researchState:        project.researchState,
    methodologyConfirmed: !!project.confirmedMethodology,
    draftAhead:           isDraftAheadOn(project.sectionContent),
    chapterOrder:         REQUIRE_CHAPTER_ORDER,
    decisionsReady:       keyDecisionsSet(contract),
  }), [sections, project.documentType, project.researchState, project.confirmedMethodology, project.sectionContent, contract])
  const decisionsReady = ctx.decisionsReady === true

  // "Draft ahead, review later": stored on the project (synced sectionContent), off by default.
  const draftAhead = ctx.draftAhead === true
  const handleToggleDraftAhead = useCallback(async () => {
    const p = latest.current.project
    const next = !isDraftAheadOn(p.sectionContent)
    if (next) {
      const ok = await confirm({
        title: 'Draft ahead, review later?',
        message: 'Chapters 1 to 3 can then be drafted without waiting for earlier chapters to be approved. Each section still stops at Needs review, and nothing is approved for you. Inconsistencies between early chapters can build up until you review them. Chapter 4 onward still waits for every earlier chapter to be approved, and Results, Discussion and Conclusion keep their gates.',
        confirmLabel: 'Turn on',
      })
      if (!ok) return
    }
    const store = useResearchStore.getState()
    store.setContent(p.id, DRAFT_AHEAD_KEY, next ? 'on' : 'off')
    try {
      await store.syncProject(p.id)
      toast.success(next ? 'Draft ahead is on for Chapters 1 to 3.' : 'Draft ahead is off.')
    } catch {
      toast.error('The setting changed here but could not be saved. It will be saved with your next change.')
    }
  }, [confirm])

  const outline = useMemo(() => buildOutline(sections, project.documentType), [sections, project.documentType])
  // One count for the outline, the run card and the end card (fixes "27 approved" vs "25 sections").
  const counts = useMemo(() => documentCounts(sections), [sections])
  const progress = useMemo(() => ({ approved: counts.approved, total: counts.total }), [counts])

  const view = useMemo(() => {
    const bySection: Record<string, { status: ReturnType<typeof documentStatus>; flags: SectionFlag[]; draft: ReturnType<typeof canDraft> }> = {}
    for (const s of sections) {
      const status = withReviewMarks(documentStatus(s, ctx), {
        stale: !!staleMarks[s.code],
        editedAfterApproval: editedApproved.includes(s.code) && (s.status === 'Approved' || s.status === 'Edited'),
      })
      bySection[s.code] = { status, flags: sectionFlags(s, citationFlags, alignmentIssues, showCitationFlags()), draft: canDraft(s, ctx) }
    }
    return bySection
  }, [sections, ctx, citationFlags, alignmentIssues, staleMarks, editedApproved])

  // Flag counts (outline badges, Agent panel box, mobile button) are off for end users in production.
  const countFlags = showFlagCounts()
  const rows = useMemo(() => {
    const out: Record<string, OutlineRow> = {}
    for (const s of sections) {
      const v = view[s.code]
      if (v) out[s.code] = { status: v.status, flagCount: countFlags ? v.flags.length : 0, notApplicable: s.isApplicableForMethodology === false }
    }
    return out
  }, [view, sections, countFlags])

  const ordered = useMemo(() => outline.flatMap(c => c.sections), [outline])
  const writing = useMemo(() => ordered.filter(s => view[s.code]?.status === 'writing'), [ordered, view])
  const allFlags = useMemo(() => ordered.flatMap(s => {
    const v = view[s.code]
    return v && hasSectionBody(v.status) ? v.flags : []
  }), [ordered, view])
  // Flags grouped by section in reading order, with the section's name, so the Agent panel can
  // list "1.2 Background · 3" and jump straight to that section's flag list.
  const flagGroups = useMemo((): FlagGroup[] => {
    if (!countFlags) return []
    const counts = new Map<string, number>()
    for (const f of allFlags) counts.set(f.sectionCode, (counts.get(f.sectionCode) ?? 0) + 1)
    return ordered.filter(s => counts.has(s.code))
      .map(s => ({ code: s.code, label: `${s.displayCode || s.code} ${s.title}`, count: counts.get(s.code)! }))
  }, [countFlags, allFlags, ordered])
  const nextReview = useMemo(() => ordered.find(s => view[s.code]?.status === 'needs_review') ?? null, [ordered, view])
  const draftAction = useMemo(() => nextDraftAction(outline, ctx, targetWords), [outline, ctx, targetWords])

  // ── The automatic whole-proposal run, if this project has one: shown live in the Agent panel ──
  const proposalRun = useProposalRun(project.id, project.generation)
  const { status: runStatus, resume: resumeRun, stop: stopRun, refresh: refreshRun } = proposalRun
  const proposalRunStatusRef = useRef(runStatus)
  proposalRunStatusRef.current = runStatus
  const sectionLabel = useCallback((code: string | null | undefined) => {
    if (!code) return null
    const s = sections.find(x => x.code === code)
    return s ? `${s.displayCode || s.code} ${s.title}` : code
  }, [sections])
  const handleRunResume = useCallback(() => {
    resumeRun(targetWords).catch((err: ApiError | undefined) => toast.error(err?.message ?? 'The run could not resume. Try again.'))
  }, [resumeRun, targetWords])
  const handleRunStop = useCallback(async () => {
    const ok = await confirm({
      title: 'Stop the whole-proposal run?',
      message: 'Sections already written are kept. The section being written now may still finish. You can resume later.',
      confirmLabel: 'Stop the run',
    })
    if (!ok) return
    try { await stopRun(); logActivity('Stopped the whole-proposal run') }
    catch (err) { toast.error((err as ApiError | undefined)?.message ?? 'Could not stop the run.') }
  }, [confirm, stopRun, logActivity])
  const runInfo = useMemo((): RunInfo | null => runStatus && isRunVisible(runStatus) ? {
    status: runStatus, currentLabel: sectionLabel(runStatus.currentSection),
    resuming: proposalRun.resuming, stopping: proposalRun.stopping,
    onResume: handleRunResume, onStop: () => { void handleRunStop() },
  } : null, [runStatus, sectionLabel, proposalRun.resuming, proposalRun.stopping, handleRunResume, handleRunStop])

  // Run milestones in the activity log ("Writing 1.2 Background", "Paused at 2.0 …"). Only changes
  // seen while this view is open are logged; the run card always shows the current state.
  const runMark = useRef<string | null>(null)
  useEffect(() => {
    if (!runStatus || !isRunVisible(runStatus)) return
    const mark = `${runStatus.status}|${runStatus.currentSection ?? ''}`
    const previous = runMark.current
    runMark.current = mark
    if (previous === null || previous === mark) return
    const where = sectionLabel(runStatus.currentSection)
    if (isRunActive(runStatus)) { if (where) logActivity(`Writing ${where}`, 'active') }
    else if (runStatus.status === 'NeedsReview') logActivity(`Paused at ${where ?? 'a section'} for your review`, 'error')
    else if (runStatus.status === 'Completed') logActivity('Finished writing the proposal')
    else if (runStatus.status === 'Error') logActivity('The run stopped with an error', 'error')
  }, [runStatus, sectionLabel, logActivity])

  // ── Data: citation flags for every section in one request, refreshed when sections change ──
  const flagsKey = sections.map(s => `${s.code}:${s.status}:${s.generatedAt ?? ''}:${s.citationsPendingVerification}`).join('|')
  useEffect(() => {
    if (!sections.length) return
    let cancelled = false
    researchApi.getSectionCitationFlags(project.id)
      .then(flags => { if (!cancelled) setCitationFlags(flags) })
      .catch(() => { /* flags are advisory here; the approve gate re-checks server-side */ })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, flagsKey])

  // Cheap reads (no model calls). Refetched after a draft finishes: drafting can add sources.
  useEffect(() => {
    let cancelled = false
    researchApi.getLiterature(project.id)
      .then(list => { if (!cancelled) setLiterature(list) })
      .catch(() => { /* citations then show as unresolved; nothing is blocked */ })
    return () => { cancelled = true }
  }, [project.id, literatureVersion])

  // The project's compiled reference list: shown once, at the end of the document (each section's
  // own References block is hidden), and for IEEE also what numbered citations resolve to.
  // Refetched when a section is drafted, rewritten or changes status, not on every keystroke.
  const referencesKey = sections.map(s => `${s.code}:${s.status}:${s.generatedAt ?? ''}`).join('|')
  useEffect(() => {
    if (!sections.length) return
    let cancelled = false
    researchApi.getBibliography(project.id)
      .then(data => {
        if (cancelled) return
        setReferenceEntries(data.entries)
        setBibliography(project.citationStyle === 'ieee' ? bibliographyReferences({ status: 'ready', data }) ?? [] : [])
      })
      .catch(() => { /* the list is a convenience here; export compiles its own */ })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, project.citationStyle, literatureVersion, referencesKey])

  const sectionChecks = useSectionCitationChecks(project.id)
  const citationData = useMemo<CitationData>(() => ({
    style: project.citationStyle, literature, bibliography, flags: showCitationFlags() ? citationFlags : [],
    checks: sectionChecks.checks,
  }), [project.citationStyle, literature, bibliography, citationFlags, sectionChecks.checks])

  const runSectionCheck = sectionChecks.run
  const handleCheckCitations = useCallback(async (code: string) => {
    if ((await flushers.current.get(code)?.()) === false) {
      toast.error(`Your latest edit to ${code} is not saved yet. Retry the save, then check again.`)
      return
    }
    logActivity(`Checking the citations in ${code}`, 'active')
    try {
      const outcome = await runSectionCheck(code)
      if (outcome === 'done') { logActivity(`Checked the citations in ${code}`); toast.success(`Citations in ${code} checked. Each citation's dot shows the result.`) }
      else if (outcome === 'error') toast.error(`The citation check for ${code} did not finish. Try again.`)
    } catch (err) {
      toast.error((err as ApiError | undefined)?.message ?? `The citation check for ${code} could not run.`)
    }
  }, [runSectionCheck, logActivity])
  const handleCheckCitationsCb = useCallback((code: string) => { void handleCheckCitations(code) }, [handleCheckCitations])

  // Poll while anything is being written, so a run started here or in Guided lands in place.
  const anyWriting = writing.length > 0
  useEffect(() => {
    if (!anyWriting) return
    const poll = () => { useResearchStore.getState().loadSections(project.id).catch(() => {}) }
    const onVisible = () => { if (document.visibilityState === 'visible') poll() }
    const timer = window.setInterval(poll, POLL_MS)
    document.addEventListener('visibilitychange', onVisible)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [anyWriting, project.id])

  // ── Scrolling: active section follows the viewport; outline clicks scroll to the section ──
  const registerAnchor = useCallback((code: string, el: HTMLElement | null) => {
    if (el) anchors.current.set(code, el)
    else anchors.current.delete(code)
  }, [])

  const updateActive = useCallback(() => {
    const root = scrollRef.current
    if (!root) return
    const top = root.getBoundingClientRect().top + ACTIVE_OFFSET
    let current: string | null = null
    for (const s of ordered) {
      const el = anchors.current.get(s.code)
      if (!el) continue
      if (el.getBoundingClientRect().top <= top) current = s.code
      else break
    }
    setActiveCode(current ?? ordered[0]?.code ?? null)
  }, [ordered])

  useEffect(() => {
    const root = scrollRef.current
    if (!root) return
    let frame = 0
    const onScroll = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(updateActive) }
    updateActive()
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => { cancelAnimationFrame(frame); root.removeEventListener('scroll', onScroll) }
  }, [updateActive])

  const scrollToAnchor = useCallback((key: string) => {
    const el = anchors.current.get(key)
    if (!el) return
    const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    // Scroll only the document pane. scrollIntoView also scrolls overflow-hidden ancestors once
    // this pane hits its end, which shifted the whole view up and left a dead band at the bottom.
    const root = scrollRef.current
    if (root) {
      const top = el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - 16
      root.scrollTo?.({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto' })
    }
    el.querySelector<HTMLElement>('.dm-heading')?.focus({ preventScroll: true })
    if (!key.startsWith('chapter:')) setActiveCode(key)
    setOutlineOpen(false)
    setAgentOpen(false)
  }, [])

  // "Next flag": the first flagged section after the one being read, wrapping to the top.
  const activeRef = useRef(activeCode)
  activeRef.current = activeCode
  const handleNextFlag = useCallback(() => {
    if (!flagGroups.length) return
    const at = ordered.findIndex(s => s.code === activeRef.current)
    const pos = (code: string) => ordered.findIndex(s => s.code === code)
    const next = flagGroups.find(g => pos(g.code) > at) ?? flagGroups[0]
    scrollToAnchor(next.code)
  }, [flagGroups, ordered, scrollToAnchor])

  // ── Actions (the same store calls Guided uses, so both views update together) ──
  const latest = useRef({ project, sections, ctx })
  latest.current = { project, sections, ctx }

  const handleApprove = useCallback(async (code: string, acknowledge = !CONFIRM_APPROVAL_ISSUES): Promise<void> => {
    const { project: p } = latest.current
    setApprovingCode(code)
    try {
      if ((await flushers.current.get(code)?.()) === false) {
        toast.error(`Your latest edit to ${code} is not saved yet, so it was not approved. Retry the save first.`)
        return
      }
      // Same rule as Guided: Agent-mode projects approve without the human acknowledgement step;
      // the server still runs and records every integrity check.
      await useResearchStore.getState().approveSection(p.id, code, acknowledge || p.generatorMode === 'AGENT')
      toast.success(`Section ${code} approved.`)
      void clearMarks(code, { stale: true, edited: true })
    } catch (err) {
      const apiErr = err as ApiError | undefined
      const reasons = (apiErr?.details as { reasons?: string[] } | undefined)?.reasons ?? []
      const text = APPROVE_BLOCK_TEXT[apiErr?.code ?? ''] ?? apiErr?.message ?? 'Approval failed.'
      const canOverride = !acknowledge && OVERRIDABLE_BLOCKS.has(apiErr?.code ?? '')
      toast(t => (
        <div className="flex max-w-[420px] flex-col gap-2 text-[13px]">
          <span className="font-semibold" style={{ color: 'var(--color-amber-text)' }}>{code} was not approved.</span>
          <span style={{ color: 'var(--text-secondary)' }}>{text}</span>
          {reasons.length > 0 && <ul className="list-disc pl-5" style={{ color: 'var(--text-secondary)' }}>{reasons.map(r => <li key={r}>{r}</li>)}</ul>}
          <div className="flex gap-3">
            {canOverride && (
              <button onClick={() => { toast.dismiss(t.id); void handleApproveRef.current(code, true) }} className="font-semibold" style={{ color: 'var(--color-purple-text)' }}>Approve anyway</button>
            )}
            <button onClick={() => { toast.dismiss(t.id); onOpenGuided(code) }} className="font-semibold" style={{ color: 'var(--color-purple-text)' }}>Review in Guided</button>
            <button onClick={() => toast.dismiss(t.id)} style={{ color: 'var(--text-muted)' }}>Close</button>
          </div>
        </div>
      ), { duration: 20000 })
    } finally {
      setApprovingCode(null)
    }
  }, [onOpenGuided, clearMarks])
  const handleApproveRef = useRef(handleApprove)
  handleApproveRef.current = handleApprove

  // Credits for `count` drafts, and (for a proposal bound to a study design) an accepted design.
  const preflight = useCallback(async (count: number): Promise<boolean> => {
    const p = latest.current.project
    const cost = CREDIT_COSTS.proposalSectionGeneration * count
    const user = useAuthStore.getState().user
    if (user && user.plan !== 'Unlimited' && user.creditsLimit - user.creditsUsed < cost) {
      useUiStore.getState().openCreditLimitModal({
        used: user.creditsUsed, limit: user.creditsLimit,
        resetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
      })
      return false
    }
    if (p.documentMode === 'PROPOSAL') {
      try {
        const journey = await proposalJourneyApi.current(p.id)
        if (journey.summary.designRequired && (!journey.summary.acceptedRevisionId || journey.readiness?.canGenerate !== true)) {
          toast('Complete your study design before writing. Opening your proposal workspace.')
          navigate(`/app/research-agent/${p.id}/proposal-workflow?tab=design`)
          return false
        }
      } catch (err) {
        toast.error((err as ApiError | undefined)?.message ?? 'Could not check your study design. Try again.')
        return false
      }
    }
    return true
  }, [navigate])

  // Claims the section on the server (status Generating, lockedBy = its job) and streams it in.
  const startDraft = useCallback(async (code: string): Promise<boolean> => {
    const { project: p, sections: list, ctx: c } = latest.current
    const section = list.find(s => s.code === code)
    if (!section) return false
    const decision = canDraft(section, c)
    if (!decision.allowed) { toast.error(decision.reason ?? `${code} cannot be drafted yet.`); return false }
    try {
      await useResearchStore.getState().generateSection(p.id, code, Number(p.sectionContent?.['targetSectionWordCount']) || DEFAULT_SECTION_WORDS)
      logActivity(`Started drafting ${section.displayCode || code} ${section.title}`, 'active')
      return true
    } catch (err) {
      toast.error((err as ApiError | undefined)?.message ?? `Drafting ${code} could not start.`)
      return false
    }
  }, [logActivity])

  const handleDraftSection = useCallback(async (code: string) => {
    if (!(await preflight(1))) return
    await startDraft(code)
  }, [preflight, startDraft])

  const handleDraftAction = useCallback(async () => {
    const action = draftAction
    if (!action || !action.decision.allowed) return
    if (action.codes.length > 1) {
      const ok = await confirm({
        title: action.label.split(' · ')[0] + '?',
        message: `The agent drafts ${action.codes.length} sections one after another (${action.codes.join(', ')}). Each one stops at Needs review for you to approve; nothing is approved for you. You can stop at any time.`,
        confirmLabel: `Draft · ${CREDIT_COSTS.proposalSectionGeneration * action.codes.length} credits`,
      })
      if (!ok) return
    }
    if (!(await preflight(action.codes.length))) return
    const [first, ...rest] = action.codes
    if (await startDraft(first)) setDraftQueue(rest)
  }, [draftAction, confirm, preflight, startDraft])

  // Chapter drafting: start the next queued section once nothing is being written. Each start is
  // gated again, so a section that became undraftable meanwhile ends the run with its reason.
  // The queue holds (it is not cleared) at the first section that waits for the key study decisions,
  // and carries on by itself once they are set.
  const queueHeldForDecisions = useMemo(() => {
    if (decisionsReady || !draftQueue.length) return false
    const head = sections.find(s => s.code === draftQueue[0])
    return !!head && needsKeyDecisions(head)
  }, [decisionsReady, draftQueue, sections])
  useEffect(() => {
    if (writing.length > 0 || draftQueue.length === 0 || startingRef.current || queueHeldForDecisions) return
    const [next, ...rest] = draftQueue
    startingRef.current = true
    setDraftQueue(rest)
    void startDraft(next).then(ok => { if (!ok) setDraftQueue([]) }).finally(() => { startingRef.current = false })
  }, [writing.length, draftQueue, startDraft, queueHeldForDecisions])

  const handleStop = useCallback(async (code: string) => {
    const { project: p, sections: list } = latest.current
    const section = list.find(s => s.code === code)
    if (!section) return
    setDraftQueue([])
    setStoppingCode(code)
    try {
      if (section.lockedBy === 'generation') {
        // Held by the whole-proposal run: stopping means cancelling that run.
        const ok = await confirm({
          title: 'Stop the whole-proposal run?',
          message: 'This section is being written by the automatic whole-proposal run. Stopping cancels that run; the section it is writing may still finish.',
          confirmLabel: 'Stop the run',
        })
        if (!ok) return
        await useResearchStore.getState().cancelGeneration(p.id)
        refreshRun()
        logActivity('Stopped the whole-proposal run')
      } else {
        await useResearchStore.getState().stopSection(p.id, code)
        logActivity(`Stopped ${code}; the text so far is kept for review`)
        toast.success(`Stopped ${code}. The text written so far is kept for you to review.`)
      }
    } catch (err) {
      toast.error((err as ApiError | undefined)?.message ?? `Could not stop ${code}.`)
    } finally {
      setStoppingCode(null)
    }
  }, [confirm, logActivity, refreshRun])

  // One Stop for everything the agent is doing: the whole-proposal run, every section being drafted, the queue.
  const handleStopAll = useCallback(async () => {
    const { project: p, sections: list } = latest.current
    const ok = await confirm({
      title: 'Stop all drafting?',
      message: 'Every section being drafted stops; the text written so far is kept for you to review. The whole-proposal run, if one is going, is cancelled and can be resumed later.',
      confirmLabel: 'Stop all',
    })
    if (!ok) return
    setDraftQueue([])
    setStoppingAll(true)
    try {
      const store = useResearchStore.getState()
      const jobs: Promise<unknown>[] = []
      if (isRunActive(proposalRunStatusRef.current)) jobs.push(stopRun())
      for (const s of list.filter(x => x.status === 'Generating' && x.lockedBy !== 'generation')) jobs.push(store.stopSection(p.id, s.code))
      const results = await Promise.allSettled(jobs)
      const failed = results.filter(r => r.status === 'rejected').length
      logActivity(failed ? `Stopped drafting (${failed} could not be stopped)` : 'Stopped all drafting', failed ? 'error' : 'done')
      if (failed) toast.error(`${failed} stop request${failed === 1 ? '' : 's'} failed. Try again.`)
      else toast.success('Stopped. Text written so far is kept for review.')
      refreshRun()
    } finally {
      setStoppingAll(false)
    }
  }, [confirm, stopRun, refreshRun, logActivity])

  // Follow every section being written; when one finishes, forget its stream (the saved section
  // is the truth now), log the outcome, and mark its alignment as not yet checked.
  const writingCodes = writing.map(s => s.code).join('|')
  const followed = useRef(new Set<string>())
  useEffect(() => {
    const now = new Set(writing.map(s => s.code))
    for (const code of now) {
      if (!followed.current.has(code)) { followed.current.add(code); followDraft(project.id, code) }
    }
    for (const code of [...followed.current]) {
      if (now.has(code)) continue
      followed.current.delete(code)
      forgetDraft(project.id, code)
      const done = latest.current.sections.find(s => s.code === code)
      if (!done) continue
      const label = `${done.displayCode || code} ${done.title}`
      const stopped = done.generationError?.startsWith('Stopped') ?? false
      if (stopped) {
        // Already logged by handleStop when stopped from this tab.
      } else if (done.generationError && done.status === 'NotStarted') {
        logActivity(`${label} failed: ${done.generationError}`, 'error')
        toast.error(`${label}: ${done.generationError}`)
        setDraftQueue([])
      } else if (done.generationError) {
        logActivity(`${label} stopped or interrupted; text kept for review`, 'error')
      } else {
        setLiteratureVersion(v => v + 1)
        setStaleAlignment(prev => (prev.includes(code) ? prev : [...prev, code]))
        const pending = rewriteReviewsRef.current[code]
        if (pending && !pending.after) {
          // The student had edited this section: put their text back and hold the rewrite for review.
          void holdRewriteForReview(code, pending.before, done.content)
          logActivity(`Rewrote ${label}; your text is kept until you review the changes`)
        } else {
          logActivity(`Drafted ${label}; ready for review`)
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [writingCodes, project.id])

  useEffect(() => {
    const following = followed.current
    return () => {
      for (const code of following) forgetDraft(project.id, code)
      following.clear()
    }
  }, [project.id])

  const rewriteReviewsRef = useRef(rewriteReviews)
  rewriteReviewsRef.current = rewriteReviews
  const updateRewriteReviews = useCallback((fn: (prev: Record<string, RewriteReview>) => Record<string, RewriteReview>) => {
    setRewriteReviews(prev => {
      const next = fn(prev)
      rewriteReviewsRef.current = next
      writeRewriteReviews(latest.current.project.id, next)
      return next
    })
  }, [])

  // The rewrite landed over the student's edited text: put their text back and hold the rewrite for review.
  const holdRewriteForReview = useCallback(async (code: string, before: string, after: string) => {
    updateRewriteReviews(prev => ({ ...prev, [code]: { startedAt: prev[code]?.startedAt ?? new Date().toISOString(), before, after } }))
    try {
      await useResearchStore.getState().saveSection(latest.current.project.id, code, before)
      toast(`The rewrite of ${code} is ready. Your text is kept; choose which changes to accept.`, { duration: 7000 })
    } catch {
      toast.error(`Your edited text of ${code} could not be put back, so the rewrite is showing. Review the changes to choose what to keep.`)
    }
    setReviewingRewrite(code)
  }, [updateRewriteReviews])

  const applyRewriteReview = useCallback(async (code: string, merged: string) => {
    setApplyingRewrite(true)
    try {
      await useResearchStore.getState().saveSection(latest.current.project.id, code, merged)
      updateRewriteReviews(prev => { const next = { ...prev }; delete next[code]; return next })
      setReviewingRewrite(null)
      logActivity(`Applied your choices to the rewrite of ${code}`)
      toast.success(`${code} saved with the changes you chose.`)
    } catch (err) {
      toast.error((err as ApiError | undefined)?.message ?? `${code} could not be saved. Try again.`)
    } finally {
      setApplyingRewrite(false)
    }
  }, [updateRewriteReviews, logActivity])

  // A rewrite that finished while this page was closed or not watching: hold it for review now.
  useEffect(() => {
    for (const [code, review] of Object.entries(rewriteReviewsRef.current)) {
      const section = sections.find(s => s.code === code)
      if (rewriteLanded(review, section)) void holdRewriteForReview(code, review.before, section!.content)
      else if (review.after === null && section && section.status !== 'Generating' && section.generationError) {
        updateRewriteReviews(prev => { const next = { ...prev }; delete next[code]; return next })
      }
    }
  }, [sections, holdRewriteForReview, updateRewriteReviews])

  const handleRewrite = useCallback(async (code: string) => {
    const { project: p, sections: list, ctx: c } = latest.current
    const section = list.find(s => s.code === code)
    if (!section) return
    const decision = canDraft(section, c)
    if (!decision.allowed) { toast.error(decision.reason ?? 'This section cannot be rewritten yet.'); return }

    const cost = CREDIT_COSTS.proposalSectionGeneration
    // Text the student wrote or changed is never replaced silently: the rewrite comes back as a diff.
    const editedByStudent = section.status === 'Edited' || !!section.lastEditedAt
      || readEditedAfterApproval(p.sectionContent).includes(code)
    if (section.status === 'Edited' || section.status === 'Approved') {
      const ok = await confirm({
        title: 'Rewrite this section?',
        message: editedByStudent
          ? `The agent writes a new version of ${code}: ${section.title}. Your edited text stays in place: you then see each change and choose which to accept.${section.status === 'Approved' ? ' Accepting changes means approving the section again.' : ''}`
          : `Your current draft of ${code}: ${section.title} will be replaced. A copy is saved to History, so you can restore it afterwards.${section.status === 'Approved' ? ' It is currently approved, so you will need to approve it again.' : ''}`,
        confirmLabel: `Rewrite · ${cost} credits`,
      })
      if (!ok) return
    }

    try {
      if (!(await preflight(1))) return
      if ((await flushers.current.get(code)?.()) === false) {
        toast.error(`Your latest edit to ${code} is not saved yet, so the rewrite did not start. Retry the save first.`)
        return
      }
      if (editedByStudent) {
        const before = latest.current.sections.find(s => s.code === code)?.content ?? section.content
        updateRewriteReviews(prev => ({ ...prev, [code]: { before, after: null, startedAt: new Date().toISOString() } }))
      }
      await useResearchStore.getState().regenerateSection(p.id, code)
      void clearMarks(code, { stale: true })
      logActivity(`Started rewriting ${code} ${section.title}`, 'active')
    } catch (err) {
      updateRewriteReviews(prev => { if (!prev[code] || prev[code].after) return prev; const next = { ...prev }; delete next[code]; return next })
      toast.error((err as ApiError | undefined)?.message ?? 'Rewrite failed.')
    }
  }, [confirm, preflight, logActivity, clearMarks, updateRewriteReviews])

  const handleValidate = useCallback(async () => {
    setIsValidating(true)
    try {
      await flushAll()
      const result = await useResearchStore.getState().validateAlignment(latest.current.project.id)
      setAlignmentIssues(result.issues ?? [])
      setStaleAlignment([])
      if (result.issues?.length) toast(`${result.issues.length} alignment issue${result.issues.length === 1 ? '' : 's'} found. They are shown on the sections concerned.`)
      else toast.success(result.message || 'No alignment issues found.')
    } catch (err) {
      toast.error((err as ApiError | undefined)?.message ?? 'Alignment check failed.')
    } finally {
      setIsValidating(false)
    }
  }, [flushAll])

  // ── Review: deterministic checks (server release checks + text vs design contract) ──
  const contentKey = useMemo(() => sections.map(s => `${s.code}:${s.content.length}:${s.lastEditedAt ?? ''}:${s.generatedAt ?? ''}`).join('|'), [sections])
  const runReview = useCallback(async (): Promise<ReviewIssue[]> => {
    setReviewing(true)
    try {
      await flushAll().catch(() => {})
      const { project: p } = latest.current
      const server = await researchApi.getProposalIssues(p.id).then(r => r.issues, () => [])
      // Read sections after the flush, so text typed a moment ago is reviewed too.
      const now = dedupeSections(useResearchStore.getState().sections[p.id] ?? [])
      const issues = runDocumentReview(now.filter(s => s.isApplicableForMethodology !== false), readContract(p.sectionContent), server)
      setReviewIssues(issues)
      setReviewedKey(contentKeyRef.current)
      return issues
    } finally {
      setReviewing(false)
    }
  }, [flushAll])
  const contentKeyRef = useRef(contentKey)
  contentKeyRef.current = contentKey

  const handleReview = useCallback(async () => {
    const issues = await runReview()
    const open = openIssueCount(issues)
    logActivity(open ? `Review found ${open} open issue${open === 1 ? '' : 's'}` : 'Review found no open issues', open ? 'error' : 'done')
  }, [runReview, logActivity])

  const openReviewIssue = useCallback((issue: ReviewIssue) => {
    scrollToAnchor(issue.sectionCode)
    // The editor mounts once the section is near the viewport; give the scroll a moment.
    window.setTimeout(() => {
      const reveal = revealers.current.get(issue.sectionCode)
      if (reveal && !reveal(issue.evidence) && issue.evidence) toast(`Could not find “${issue.evidence.slice(0, 60)}” in ${issue.sectionCode}; it may have been fixed already.`)
    }, 450)
  }, [scrollToAnchor])

  const handleExport = useCallback(async () => {
    const p = latest.current.project
    await flushAll().catch(() => {})
    if (REVIEW_EXPORT_GATE !== 'off') {
      const issues = await runReview().catch(() => [] as ReviewIssue[])
      const open = openIssueCount(issues)
      if (open > 0 && REVIEW_EXPORT_GATE === 'warn') {
        toast(`Exporting with ${open} open review issue${open === 1 ? '' : 's'}. They are listed under Review in the Agent panel.`, { duration: 7000 })
      } else if (open > 0) {
        setAgentOpen(true)
        const override = await confirm({
          title: `${open} open review issue${open === 1 ? '' : 's'}`,
          message: `Review found ${open} issue${open === 1 ? '' : 's'} (placeholders, study-decision mismatches or variable conflicts). They are listed under Review in the Agent panel. Fix them first, or export anyway; the override is recorded.`,
          confirmLabel: 'Export anyway',
          tone: 'warning',
        })
        if (!override) return
        console.warn('[document-export] exported with open review issues (override)', { projectId: p.id, open, issues: issues.filter(i => i.blocking).map(i => i.id) })
        logActivity(`Exported with ${open} open review issue${open === 1 ? '' : 's'} (override)`, 'error')
      }
    }
    const thesis = isThesisDocument(p.documentType)
    setIsExporting(true)
    const toastId = toast.loading(thesis ? 'Building thesis .docx…' : 'Building .docx — this may take a moment…')
    try {
      const store = useResearchStore.getState()
      if (thesis) await store.exportThesisDocx(p.id)
      else await store.exportDocx(p.id)
      toast.success(thesis ? 'Thesis downloaded.' : 'Document downloaded.', { id: toastId })
    } catch (err) {
      toast.error((err as ApiError | undefined)?.message ?? 'Export was blocked.', { id: toastId })
    } finally {
      setIsExporting(false)
    }
  }, [flushAll, runReview, confirm, logActivity])

  useEffect(() => {
    if (!actionsRef) return
    actionsRef.current = { validate: handleValidate, export: handleExport }
    return () => { actionsRef.current = null }
  }, [actionsRef, handleValidate, handleExport])

  useEffect(() => {
    onActionsStateChange?.({ isValidating, isExporting, isThesisOrDissertation: isThesis })
  }, [onActionsStateChange, isValidating, isExporting, isThesis])

  // ── Study decisions gate: where drafting waits, and the server run's own pause at the same point ──
  const runHeldForDecisions = useMemo(() => {
    if (decisionsReady || runStatus?.status !== 'NeedsReview' || !runStatus.currentSection) return false
    const s = sections.find(x => x.code === runStatus.currentSection)
    return !!s && needsKeyDecisions(s) && !s.content.trim()
  }, [decisionsReady, runStatus, sections])
  const decisionsPausedAt = queueHeldForDecisions ? sectionLabel(draftQueue[0])
    : runHeldForDecisions ? sectionLabel(runStatus?.currentSection) : null
  // Sections after 1.1 still to draft: while any are left and a key decision is missing, setting them is the next step.
  const decisionsNeeded = useMemo(() => !decisionsReady && sections.some(s =>
    needsKeyDecisions(s) && s.isApplicableForMethodology !== false && !s.content.trim() && s.status !== 'Generating'
    && canDraft(s, ctx).blocker === 'decisions'), [decisionsReady, sections, ctx])

  // The run paused for the decisions picks up by itself once they are set (the student already started it).
  const runWasHeld = useRef(false)
  useEffect(() => {
    if (runHeldForDecisions) { runWasHeld.current = true; return }
    if (runWasHeld.current && decisionsReady && runStatus?.status === 'NeedsReview') {
      runWasHeld.current = false
      logActivity('Study decisions set; drafting resumes')
      handleRunResume()
    }
  }, [runHeldForDecisions, decisionsReady, runStatus?.status, logActivity, handleRunResume])

  const rail = (
    <DocumentOutlineRail chapters={outline} rows={rows} activeCode={activeCode} progress={progress}
      onSelect={scrollToAnchor} onSelectChapter={key => scrollToAnchor(`chapter:${key}`)} />
  )
  const contractHints = useMemo(() => ({
    designType: `e.g. ${suggestions.designType}`, dataSources: `e.g. ${suggestions.dataSources}`, sampleSize: `e.g. ${suggestions.sampleSize}`,
    software: `e.g. ${suggestions.software}`, dataCollector: `e.g. ${suggestions.dataCollector}`,
  }), [suggestions])
  const staleCount = Object.keys(staleMarks).length
  const contractPanel = (
    <DesignContractPanel contract={contract} hints={contractHints} saving={savingContract} staleCount={staleCount} onSave={handleSaveContract}
      onUseDefaults={() => { void handleUseDefaults() }} isNextStep={decisionsNeeded} pausedAt={decisionsPausedAt} />
  )
  const reviewCard = (
    <ReviewIssuesCard issues={reviewIssues} running={reviewing} outdated={reviewIssues !== null && reviewedKey !== contentKey}
      onRun={() => { void handleReview() }} onOpen={openReviewIssue} sectionLabel={code => sectionLabel(code) ?? code} />
  )
  const agent = (
    <DocumentAgentPanel run={runInfo} projectId={project.id} writing={writing} flagGroups={flagGroups} onNextFlag={handleNextFlag} nextReview={nextReview}
      draftAction={draftAction} queued={draftQueue} onDraftAction={handleDraftAction}
      counts={counts} onStopAll={() => { void handleStopAll() }} stoppingAll={stoppingAll} contract={contractPanel} review={reviewCard}
      targetWords={targetWords} activity={activity}
      onJump={scrollToAnchor}
      draftAhead={draftAhead} onToggleDraftAhead={handleToggleDraftAhead}
      staleAlignment={staleAlignment} isValidating={isValidating} onCheckAlignment={handleValidate} />
  )

  return (
    <CitationDataContext.Provider value={citationData}>
    <div className="absolute inset-0 flex" style={{ background: 'var(--surface-page)' }}>
      {dialog}
      {reviewingRewrite && rewriteReviews[reviewingRewrite]?.after && (
        <RewriteReviewDialog label={sectionLabel(reviewingRewrite) ?? reviewingRewrite}
          before={rewriteReviews[reviewingRewrite].before} after={rewriteReviews[reviewingRewrite].after!}
          applying={applyingRewrite} onApply={merged => { void applyRewriteReview(reviewingRewrite, merged) }}
          onClose={() => setReviewingRewrite(null)} />
      )}

      <div className="hidden lg:block w-[288px] shrink-0 bg-white" style={{ borderRight: '0.5px solid var(--border-hairline)' }}>{rail}</div>

      <main ref={scrollRef} className="flex-1 min-w-0 overflow-y-auto dm-scroll" aria-label="Document">
        <div className="xl:hidden sticky top-0 z-10 flex gap-2 px-4 py-2 bg-white/90 backdrop-blur" style={{ borderBottom: '0.5px solid var(--border-hairline)' }}>
          <button type="button" onClick={() => setOutlineOpen(true)} className="dm-action lg:hidden inline-flex items-center gap-1.5 text-[12px] rounded-md px-2.5 py-1.5"
            style={{ border: '0.5px solid var(--border-strong)', color: 'var(--text-secondary)' }}>
            <ListTree size={13} aria-hidden="true" /> Outline · {progress.approved} of {progress.total}
          </button>
          <button type="button" onClick={() => setAgentOpen(true)} className="dm-action inline-flex items-center gap-1.5 text-[12px] rounded-md px-2.5 py-1.5"
            style={{ border: '0.5px solid var(--border-strong)', color: 'var(--text-secondary)' }}>
            <Bot size={13} aria-hidden="true" /> Agent{countFlags && allFlags.length ? ` · ${allFlags.length} flags` : ''}
          </button>
        </div>

        <article className="max-w-[760px] mx-auto bg-white my-4 sm:my-7 px-4 sm:px-14 py-8 sm:py-9 rounded-xl"
          style={{ border: '0.5px solid var(--border-hairline)' }}>
          {!sections.length && <p className="text-[13px] m-0" style={{ color: 'var(--text-secondary)' }}>Loading your sections…</p>}
          {outline.map(chapter => chapter.lockedReason ? (
            // A proposal has no Results/Discussion/Conclusion: one quiet line, not three full chapters.
            <div key={chapter.key} ref={el => registerAnchor(`chapter:${chapter.key}`, el)}
              className="flex items-start gap-2.5 mb-8 rounded-lg px-3.5 py-3" style={{ background: 'var(--surface-rail)' }}>
              <Lock size={13} className="mt-[3px] shrink-0" aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
              <div className="min-w-0">
                <h2 tabIndex={-1} className="dm-heading m-0 text-[13px] font-semibold" style={{ color: 'var(--text-secondary)' }}>{chapter.title}</h2>
                <p className="m-0 text-[12px] leading-[1.5]" style={{ color: 'var(--text-muted)' }}>{chapter.lockedReason}</p>
              </div>
            </div>
          ) : (
            <div key={chapter.key} ref={el => registerAnchor(`chapter:${chapter.key}`, el)} className="mb-8">
              {chapter.number !== null && (
                <div className="text-[11px] font-semibold tracking-[0.08em] mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  CHAPTER {chapter.number}
                </div>
              )}
              <h2 tabIndex={-1} className="dm-heading m-0 mb-4 text-[26px] leading-tight font-semibold" style={{ fontFamily: 'Georgia, serif', color: 'var(--text-primary)' }}>
                {chapter.title}
              </h2>
              {chapter.sections.map(s => {
                const v = view[s.code]
                if (!v) return null
                return (
                  <DocumentSectionBlock key={s.code} projectId={project.id} section={s} status={v.status} flags={v.flags} draft={v.draft}
                    lockedReason={v.draft.blocker === 'locked' ? v.draft.reason : null}
                    isApproving={approvingCode === s.code} scrollRoot={scrollRef} registerAnchor={registerAnchor}
                    onApprove={handleApprove} onRewrite={handleRewrite} onOpenGuided={onOpenGuided}
                    onDemoted={handleDemoted} registerFlush={registerFlush}
                    onDraft={handleDraftSection} onStop={handleStop} isStopping={stoppingCode === s.code}
                    hideHeading={s.code === chapter.leadCode}
                    staleFields={staleMarks[s.code]} onMarkReviewed={handleMarkReviewed} onEditedApproved={handleEditedApproved}
                    registerReveal={registerReveal} onCheckCitations={handleCheckCitationsCb} checkState={sectionChecks.state[s.code]}
                    rewriteReviewPending={!!rewriteReviews[s.code]?.after} onOpenRewriteReview={setReviewingRewrite}
                    serverApproved={s.status === 'Approved'} />
                )
              })}
            </div>
          ))}
          <DocumentReferences entries={referenceEntries} registerAnchor={registerAnchor} />
          {sections.length > 0 && (
            <DocumentEndCard progress={progress} flagGroups={flagGroups} nextReview={nextReview}
              isExporting={isExporting} onJump={scrollToAnchor} onNextFlag={handleNextFlag} onExport={handleExport}
              onTop={() => scrollRef.current?.scrollTo?.({ top: 0, behavior: 'smooth' })} />
          )}
        </article>
      </main>

      <div className="hidden xl:block w-[344px] shrink-0 bg-white" style={{ borderLeft: '0.5px solid var(--border-hairline)' }}>{agent}</div>

      {(outlineOpen || agentOpen) && (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label={outlineOpen ? 'Outline' : 'Agent'}
          onKeyDown={e => { if (e.key === 'Escape') { setOutlineOpen(false); setAgentOpen(false) } }}>
          <button type="button" className="absolute inset-0 bg-black/30" aria-label="Close panel" onClick={() => { setOutlineOpen(false); setAgentOpen(false) }} />
          <div className={`relative h-full w-[min(344px,88vw)] bg-white shadow-xl ${agentOpen ? 'ml-auto' : ''}`}>
            <button type="button" onClick={() => { setOutlineOpen(false); setAgentOpen(false) }} aria-label="Close panel" autoFocus
              className="dm-action absolute right-2 top-2 z-10 rounded-md p-1.5 hover:bg-slate-50" style={{ color: 'var(--text-secondary)' }}>
              <X size={16} />
            </button>
            <div className="h-full pt-9">{outlineOpen ? rail : agent}</div>
          </div>
        </div>
      )}
    </div>
    </CitationDataContext.Provider>
  )
}
