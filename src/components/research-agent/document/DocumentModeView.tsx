import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ListTree, Bot, X, Lock } from 'lucide-react'
import toast from 'react-hot-toast'
import type { ApiError } from '../../../types'
import type { AlignmentIssue, CitationFlag, ProjectSection, ResearchProject } from '../../../types/research'
import { useResearchStore } from '../../../store/researchStore'
import { useAuthStore } from '../../../store/authStore'
import { useUiStore } from '../../../store/uiStore'
import { CREDIT_COSTS } from '../../../config/creditCosts'
import { researchApi } from '../../../api/research'
import { proposalJourneyApi } from '../../../api/proposalJourney'
import { useConfirm } from '../../ui/ConfirmDialog'
import { canDraft, dedupeSections, documentStatus, isThesisDocument, type DraftContext } from '../../../lib/sectionWorkflow'
import { buildOutline, outlineProgress, sectionFlags, type SectionFlag } from '../../../lib/documentOutline'
import { DocumentOutlineRail, type OutlineRow } from './DocumentOutlineRail'
import { DocumentSectionBlock } from './DocumentSectionBlock'
import { DocumentAgentPanel } from './DocumentAgentPanel'
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
  const [alignmentIssues, setAlignmentIssues] = useState<AlignmentIssue[]>([])
  const [approvingCode, setApprovingCode] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [activeCode, setActiveCode] = useState<string | null>(null)
  const [outlineOpen, setOutlineOpen] = useState(false)
  const [agentOpen, setAgentOpen] = useState(false)

  const scrollRef = useRef<HTMLElement | null>(null)
  const anchors = useRef(new Map<string, HTMLElement>())
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
  const nextDraft = useMemo(() => {
    const s = ordered.find(x => view[x.code]?.status === 'queued' && x.isApplicableForMethodology !== false)
    return s ? { section: s, decision: view[s.code].draft } : null
  }, [ordered, view])

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

    const user = useAuthStore.getState().user
    if (user && user.plan !== 'Unlimited' && user.creditsLimit - user.creditsUsed < cost) {
      useUiStore.getState().openCreditLimitModal({
        used: user.creditsUsed, limit: user.creditsLimit,
        resetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
      })
      return
    }

    try {
      if (p.documentMode === 'PROPOSAL') {
        const journey = await proposalJourneyApi.current(p.id)
        if (journey.summary.designRequired && (!journey.summary.acceptedRevisionId || journey.readiness?.canGenerate !== true)) {
          toast('Complete your study design before writing. Opening your proposal workspace.')
          navigate(`/app/research-agent/${p.id}/proposal-workflow?tab=design`)
          return
        }
      }
      await useResearchStore.getState().regenerateSection(p.id, code)
      toast.success(`Rewriting ${code}.`)
    } catch (err) {
      toast.error((err as ApiError | undefined)?.message ?? 'Rewrite failed.')
    }
  }, [confirm, navigate])

  const handleValidate = useCallback(async () => {
    setIsValidating(true)
    try {
      const result = await useResearchStore.getState().validateAlignment(latest.current.project.id)
      setAlignmentIssues(result.issues ?? [])
      if (result.issues?.length) toast(`${result.issues.length} alignment issue${result.issues.length === 1 ? '' : 's'} found. They are shown on the sections concerned.`)
      else toast.success(result.message || 'No alignment issues found.')
    } catch (err) {
      toast.error((err as ApiError | undefined)?.message ?? 'Alignment check failed.')
    } finally {
      setIsValidating(false)
    }
  }, [])

  const handleExport = useCallback(async () => {
    const p = latest.current.project
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
  }, [])

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
    <DocumentAgentPanel writing={writing} flags={allFlags} nextReview={nextReview} nextDraft={nextDraft}
      lockedNote={lockedNote} onJump={scrollToAnchor} onDraftInGuided={onOpenGuided} />
  )

  return (
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
                  <DocumentSectionBlock key={s.code} section={s} status={v.status} flags={v.flags} draft={v.draft}
                    lockedReason={v.draft.blocker === 'locked' ? v.draft.reason : null}
                    isApproving={approvingCode === s.code} scrollRoot={scrollRef} registerAnchor={registerAnchor}
                    onApprove={handleApprove} onRewrite={handleRewrite} onOpenGuided={onOpenGuided} />
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
  )
}
