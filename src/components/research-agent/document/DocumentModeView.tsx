import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ListTree, Bot, X, Lock } from 'lucide-react'
import toast from 'react-hot-toast'
import type { ApiError } from '../../../types'
import type { AlignmentIssue, CitationFlag, FetchedLiterature, ProjectSection, ResearchProject } from '../../../types/research'
import type { ParsedReference } from '../../../lib/citationFormat'
import { bibliographyReferences } from '../../../lib/bibliographyState'
import { useResearchStore } from '../../../store/researchStore'
import { useAuthStore } from '../../../store/authStore'
import { useUiStore } from '../../../store/uiStore'
import { CREDIT_COSTS } from '../../../config/creditCosts'
import { researchApi } from '../../../api/research'
import { proposalJourneyApi } from '../../../api/proposalJourney'
import { useConfirm } from '../../ui/ConfirmDialog'
import { canDraft, dedupeSections, documentStatus, isThesisDocument, type DraftContext } from '../../../lib/sectionWorkflow'
import { buildOutline, outlineProgress, sectionFlags, type SectionFlag } from '../../../lib/documentOutline'
import { nextDraftAction } from '../../../lib/draftPlan'
import { followDraft, forgetDraft } from '../../../lib/liveDraftStore'
import { DocumentOutlineRail, type OutlineRow } from './DocumentOutlineRail'
import { DocumentSectionBlock } from './DocumentSectionBlock'
import { DocumentAgentPanel } from './DocumentAgentPanel'
import { CitationDataContext, type CitationData } from './citationDataContext'
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

// Approval refusals whose fix lives in Guided's citation/fact tools. Document mode never offers
// "Approve anyway": the gates stay where they are.
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

export function DocumentModeView({ project, actionsRef, onActionsStateChange, onOpenGuided }: Props) {
  const navigate = useNavigate()
  const rawSections = useResearchStore(s => s.sections[project.id] ?? EMPTY_SECTIONS)
  const sections = useMemo(() => dedupeSections(rawSections), [rawSections])
  const { confirm, dialog } = useConfirm()

  const [citationFlags, setCitationFlags] = useState<CitationFlag[]>([])
  // Pinned sources (and, for IEEE, the numbered reference list) that inline citations resolve to.
  const [literature, setLiterature] = useState<FetchedLiterature[]>([])
  const [bibliography, setBibliography] = useState<ParsedReference[]>([])
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
  }), [sections, project.documentType, project.researchState, project.confirmedMethodology])

  const outline = useMemo(() => buildOutline(sections, project.documentType), [sections, project.documentType])
  const progress = useMemo(() => outlineProgress(sections), [sections])

  const view = useMemo(() => {
    const bySection: Record<string, { status: ReturnType<typeof documentStatus>; flags: SectionFlag[]; draft: ReturnType<typeof canDraft> }> = {}
    for (const s of sections) {
      bySection[s.code] = { status: documentStatus(s, ctx), flags: sectionFlags(s, citationFlags, alignmentIssues), draft: canDraft(s, ctx) }
    }
    return bySection
  }, [sections, ctx, citationFlags, alignmentIssues])

  const rows = useMemo(() => {
    const out: Record<string, OutlineRow> = {}
    for (const s of sections) {
      const v = view[s.code]
      if (v) out[s.code] = { status: v.status, flagCount: v.flags.length, notApplicable: s.isApplicableForMethodology === false }
    }
    return out
  }, [view, sections])

  const ordered = useMemo(() => outline.flatMap(c => c.sections), [outline])
  const writing = useMemo(() => ordered.filter(s => view[s.code]?.status === 'writing'), [ordered, view])
  const allFlags = useMemo(() => ordered.flatMap(s => {
    const v = view[s.code]
    return v && (v.status === 'needs_review' || v.status === 'approved') ? v.flags : []
  }), [ordered, view])
  const nextReview = useMemo(() => ordered.find(s => view[s.code]?.status === 'needs_review') ?? null, [ordered, view])
  const draftAction = useMemo(() => nextDraftAction(outline, ctx, targetWords), [outline, ctx, targetWords])

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
    if (project.citationStyle === 'ieee') {
      researchApi.getBibliography(project.id)
        .then(data => { if (!cancelled) setBibliography(bibliographyReferences({ status: 'ready', data }) ?? []) })
        .catch(() => {})
    }
    return () => { cancelled = true }
  }, [project.id, project.citationStyle, literatureVersion])

  const citationData = useMemo<CitationData>(() => ({
    style: project.citationStyle, literature, bibliography, flags: citationFlags,
  }), [project.citationStyle, literature, bibliography, citationFlags])

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
    el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' })
    el.querySelector<HTMLElement>('.dm-heading')?.focus({ preventScroll: true })
    if (!key.startsWith('chapter:')) setActiveCode(key)
    setOutlineOpen(false)
    setAgentOpen(false)
  }, [])

  // ── Actions (the same store calls Guided uses, so both views update together) ──
  const latest = useRef({ project, sections, ctx })
  latest.current = { project, sections, ctx }

  const handleApprove = useCallback(async (code: string) => {
    const { project: p } = latest.current
    setApprovingCode(code)
    try {
      if ((await flushers.current.get(code)?.()) === false) {
        toast.error(`Your latest edit to ${code} is not saved yet, so it was not approved. Retry the save first.`)
        return
      }
      // Same rule as Guided: Agent-mode projects approve without the human acknowledgement step;
      // the server still runs and records every integrity check.
      await useResearchStore.getState().approveSection(p.id, code, p.generatorMode === 'AGENT')
      toast.success(`Section ${code} approved.`)
    } catch (err) {
      const apiErr = err as ApiError | undefined
      const reasons = (apiErr?.details as { reasons?: string[] } | undefined)?.reasons ?? []
      const text = APPROVE_BLOCK_TEXT[apiErr?.code ?? ''] ?? apiErr?.message ?? 'Approval failed.'
      toast(t => (
        <div className="flex max-w-[420px] flex-col gap-2 text-[13px]">
          <span className="font-semibold" style={{ color: 'var(--color-amber-text)' }}>{code} was not approved.</span>
          <span style={{ color: 'var(--text-secondary)' }}>{text}</span>
          {reasons.length > 0 && <ul className="list-disc pl-5" style={{ color: 'var(--text-secondary)' }}>{reasons.map(r => <li key={r}>{r}</li>)}</ul>}
          <div className="flex gap-3">
            <button onClick={() => { toast.dismiss(t.id); onOpenGuided(code) }} className="font-semibold" style={{ color: 'var(--color-purple-text)' }}>Review in Guided</button>
            <button onClick={() => toast.dismiss(t.id)} style={{ color: 'var(--text-muted)' }}>Close</button>
          </div>
        </div>
      ), { duration: 20000 })
    } finally {
      setApprovingCode(null)
    }
  }, [onOpenGuided])

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
  useEffect(() => {
    if (writing.length > 0 || draftQueue.length === 0 || startingRef.current) return
    const [next, ...rest] = draftQueue
    startingRef.current = true
    setDraftQueue(rest)
    void startDraft(next).then(ok => { if (!ok) setDraftQueue([]) }).finally(() => { startingRef.current = false })
  }, [writing.length, draftQueue, startDraft])

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
  }, [confirm, logActivity])

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
        logActivity(`Drafted ${label}; ready for review`)
        setStaleAlignment(prev => (prev.includes(code) ? prev : [...prev, code]))
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

  const handleRewrite = useCallback(async (code: string) => {
    const { project: p, sections: list, ctx: c } = latest.current
    const section = list.find(s => s.code === code)
    if (!section) return
    const decision = canDraft(section, c)
    if (!decision.allowed) { toast.error(decision.reason ?? 'This section cannot be rewritten yet.'); return }

    const cost = CREDIT_COSTS.proposalSectionGeneration
    if (section.status === 'Edited' || section.status === 'Approved') {
      const ok = await confirm({
        title: 'Rewrite this section?',
        message: `Your current draft of ${code}: ${section.title} will be replaced. A copy is saved to History, so you can restore it afterwards.${section.status === 'Approved' ? ' It is currently approved, so you will need to approve it again.' : ''}`,
        confirmLabel: `Rewrite · ${cost} credits`,
      })
      if (!ok) return
    }

    try {
      if (!(await preflight(1))) return
      await useResearchStore.getState().regenerateSection(p.id, code)
      logActivity(`Started rewriting ${code} ${section.title}`, 'active')
    } catch (err) {
      toast.error((err as ApiError | undefined)?.message ?? 'Rewrite failed.')
    }
  }, [confirm, preflight, logActivity])

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

  const handleExport = useCallback(async () => {
    const p = latest.current.project
    await flushAll().catch(() => {})
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
  }, [flushAll])

  useEffect(() => {
    if (!actionsRef) return
    actionsRef.current = { validate: handleValidate, export: handleExport }
    return () => { actionsRef.current = null }
  }, [actionsRef, handleValidate, handleExport])

  useEffect(() => {
    onActionsStateChange?.({ isValidating, isExporting, isThesisOrDissertation: isThesis })
  }, [onActionsStateChange, isValidating, isExporting, isThesis])

  const lockedNote = isThesis ? null : 'Results, Discussion and Conclusion unlock after the readiness audit passes.'

  const rail = (
    <DocumentOutlineRail chapters={outline} rows={rows} activeCode={activeCode} progress={progress}
      onSelect={scrollToAnchor} onSelectChapter={key => scrollToAnchor(`chapter:${key}`)} />
  )
  const agent = (
    <DocumentAgentPanel projectId={project.id} writing={writing} flags={allFlags} nextReview={nextReview}
      draftAction={draftAction} queued={draftQueue} onDraftAction={handleDraftAction} onStop={handleStop}
      stoppingCode={stoppingCode} targetWords={targetWords} activity={activity}
      lockedNote={lockedNote} onJump={scrollToAnchor}
      staleAlignment={staleAlignment} isValidating={isValidating} onCheckAlignment={handleValidate} />
  )

  return (
    <CitationDataContext.Provider value={citationData}>
    <div className="absolute inset-0 flex" style={{ background: 'var(--surface-page)' }}>
      {dialog}

      <div className="hidden lg:block w-[288px] shrink-0 bg-white" style={{ borderRight: '0.5px solid var(--border-hairline)' }}>{rail}</div>

      <main ref={scrollRef} className="flex-1 min-w-0 overflow-y-auto dm-scroll" aria-label="Document">
        <div className="xl:hidden sticky top-0 z-10 flex gap-2 px-4 py-2 bg-white/90 backdrop-blur" style={{ borderBottom: '0.5px solid var(--border-hairline)' }}>
          <button type="button" onClick={() => setOutlineOpen(true)} className="dm-action lg:hidden inline-flex items-center gap-1.5 text-[12px] rounded-md px-2.5 py-1.5"
            style={{ border: '0.5px solid var(--border-strong)', color: 'var(--text-secondary)' }}>
            <ListTree size={13} aria-hidden="true" /> Outline · {progress.approved} of {progress.total}
          </button>
          <button type="button" onClick={() => setAgentOpen(true)} className="dm-action inline-flex items-center gap-1.5 text-[12px] rounded-md px-2.5 py-1.5"
            style={{ border: '0.5px solid var(--border-strong)', color: 'var(--text-secondary)' }}>
            <Bot size={13} aria-hidden="true" /> Agent{allFlags.length ? ` · ${allFlags.length} flags` : ''}
          </button>
        </div>

        <article className="max-w-[760px] mx-auto bg-white my-4 sm:my-7 px-4 sm:px-14 py-8 sm:py-9 rounded-xl"
          style={{ border: '0.5px solid var(--border-hairline)' }}>
          {!sections.length && <p className="text-[13px] m-0" style={{ color: 'var(--text-secondary)' }}>Loading your sections…</p>}
          {outline.map(chapter => (
            <div key={chapter.key} ref={el => registerAnchor(`chapter:${chapter.key}`, el)} className="mb-8 last:mb-0">
              {(chapter.number === null ? !!chapter.lockedReason : chapter.title !== `Chapter ${chapter.number}`) && (
                <div className="text-[11px] font-semibold tracking-[0.08em] mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  {chapter.number !== null ? `CHAPTER ${chapter.number}` : 'LOCKED'}
                </div>
              )}
              <h2 tabIndex={-1} className="dm-heading m-0 mb-4 text-[26px] leading-tight font-semibold" style={{ fontFamily: 'Georgia, serif', color: chapter.lockedReason ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                {chapter.title}
              </h2>
              {chapter.lockedReason && (
                <p className="flex items-start gap-2 m-0 text-[13px] rounded-lg px-3 py-2.5" style={{ background: 'var(--surface-rail)', color: 'var(--text-secondary)' }}>
                  <Lock size={13} className="mt-0.5 shrink-0" aria-hidden="true" /> {chapter.lockedReason}
                </p>
              )}
              {chapter.sections.map(s => {
                const v = view[s.code]
                if (!v) return null
                return (
                  <DocumentSectionBlock key={s.code} projectId={project.id} section={s} status={v.status} flags={v.flags} draft={v.draft}
                    lockedReason={v.draft.blocker === 'locked' ? v.draft.reason : null}
                    isApproving={approvingCode === s.code} scrollRoot={scrollRef} registerAnchor={registerAnchor}
                    onApprove={handleApprove} onRewrite={handleRewrite} onOpenGuided={onOpenGuided}
                    onDemoted={handleDemoted} registerFlush={registerFlush}
                    onDraft={handleDraftSection} onStop={handleStop} isStopping={stoppingCode === s.code} />
                )
              })}
            </div>
          ))}
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
