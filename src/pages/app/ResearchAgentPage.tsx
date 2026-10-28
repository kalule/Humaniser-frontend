import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft, ChevronRight, ChevronDown, Download,
  Sparkles, Loader2, CheckCircle2, Circle, BookOpen,
  Lock, RefreshCw, FileText, AlertCircle, Check, Edit2,
  PenLine, ShieldCheck, X, GraduationCap,
  ClipboardList, Mic, HelpCircle, Copy, FolderOpen, Globe, Layers,
  BookMarked, Menu, AlertTriangle, History,
} from 'lucide-react'
import type { ApiError } from '../../types'
import { cn } from '../../lib/utils'
import { countBodyWords } from '../../lib/wordCount'
import { useResearchStore } from '../../store/researchStore'
import { useLibraryStore } from '../../store/libraryStore'
import { useAuthStore } from '../../store/authStore'
import { useUiStore } from '../../store/uiStore'
import { CREDIT_COSTS } from '../../config/creditCosts'
import { researchApi } from '../../api/research'
import { proposalJourneyApi } from '../../api/proposalJourney'
import { useSectionDraftStream } from '../../hooks/useSectionDraftStream'
import { ToolSidebar } from '../../components/layout/ToolSidebar'
import { Tooltip } from '../../components/ui/Tooltip'
import ConfirmActionModal from '../../components/app/ConfirmActionModal'
import { DocumentSurface, type DocumentSurfaceHandle } from '../../components/research-agent/DocumentSurface'
import { ReviewNotesPanel } from '../../components/research-agent/ReviewNotesPanel'
import { ReferencesDrawer } from '../../components/research-agent/ReferencesDrawer'
import { SectionVersionHistoryDrawer } from '../../components/research-agent/SectionVersionHistoryDrawer'
import { EvidenceCoverageDrawer } from '../../components/research-agent/EvidenceCoverageDrawer'
import { GapFinderPanel } from '../../components/research-agent/GapFinderPanel'
import { GapQuestionEditor, QUESTION_PREFIX, questionFromDescription } from '../../components/research-agent/GapQuestionEditor'
import { FactConflictsPanel } from '../../components/research-agent/FactConflictsPanel'
import { formatInTextCitation, type ParsedReference } from '../../lib/citationFormat'
import { bibliographyReferences, buildBibliographyKey, type BibliographyState } from '../../lib/bibliographyState'
import '../../styles/research-agent-editor.css'
import { SectionFixDiffModal } from '../../components/research-agent/SectionFixDiffModal'
import type {
  AcademicLevel, AlignmentIssue, AlignmentValidationResult, CitationFixAction, CitationFlag, CitationStyle,
  DocumentMode, FactConflict, FetchedLiterature, GeneratorMode, ProjectSection, ResearchProject,
  ResearchTopic, GeneratedTitle, SectionFixPreview, SectionStatus,
  MethodologyViolation, ProjectHypothesis, UpdateHypothesisPayload, DefencePreparation, ThesisAuditResult, RubricScores,
} from '../../types/research'
import toast from 'react-hot-toast'
import { FixIssuesPanel } from '../../components/research-agent/FixIssuesPanel'
// STEPS and SECTION_PROMPTS live in src/data/proposalOutline.ts — shared with
// AutonomousProposalTools' autonomous generation flow, which needs the same
// chapter list and prompts without pulling in this whole page's module.
import { STEPS, SECTION_PROMPTS, getStepLabel } from '../../data/proposalOutline'
import { isAbstractStepLocked } from './abstractStepStatus'
import { apiErrorMessage } from '../../lib/deepResearch'
import { recommendMethodology, methodologyInputFingerprint, type MethodologyRecommendation } from '../../lib/methodologyRecommendation'

export { STEPS }

// Stable reference so Zustand selectors that fall back to "no sections yet"
// don't return a fresh array each render (which trips React's
// useSyncExternalStore infinite-loop guard).
const EMPTY_SECTIONS: ProjectSection[] = []

// Structured API errors are unwrapped by client.ts before reaching page handlers.
// Preserve the server's actionable message for error codes this page does not yet
// have a dedicated interaction for.
const extractErrorMessage = (err: unknown): string | undefined =>
  err instanceof Error ? err.message : (err as { message?: string } | undefined)?.message

// Deduplicates project sections by code — a concurrent double-init can create duplicate DB rows
// for the same section (see initSections's StrictMode-double-fire guard). Keeps the row with the
// highest status, then most content, per code. Single source of truth used by BOTH StepRail (the
// sidebar word-count badge) and ChapterWriterView (the open editor) — previously StepRail read
// the raw, undeduplicated array while ChapterWriterView deduplicated via a sort-then-Map that
// actually kept the LAST duplicate seen (JS Map overwrites on repeated keys), not the best one
// as its comment claimed. Together those two bugs could show a stale/empty duplicate row's content
// (0 words) in the editor while the sidebar's badge, reading the raw array, happened to reflect
// the real generated row (524w) — the exact "sidebar and editor disagree" symptom this fixes.
const SECTION_STATUS_ORDER: Record<SectionStatus, number> =
  { NotStarted: 0, Generating: 1, Draft: 2, Edited: 3, Approved: 4 }

function dedupeSections(rawSections: ProjectSection[]): ProjectSection[] {
  const best = new Map<string, ProjectSection>()
  for (const s of rawSections) {
    const existing = best.get(s.code)
    if (!existing) { best.set(s.code, s); continue }
    const statusDelta = SECTION_STATUS_ORDER[s.status] - SECTION_STATUS_ORDER[existing.status]
    if (statusDelta > 0 || (statusDelta === 0 && s.content.length > existing.content.length)) {
      best.set(s.code, s)
    }
  }
  return [...best.values()].sort((a, b) => a.order - b.order)
}

// Groups alignment/quality issues by sectionCode for display, and separates out each group's
// 'LlmJudged' subset — the only issues eligible for "Apply fix" (see IssueSource in
// types/research.ts). A section can have both eligible and ineligible issues folded together
// (e.g. a coherence issue alongside a citation-mismatch issue on the same section code); the
// eligible subset is what a single "Apply fix" click sends to applySectionFix.
function groupIssuesBySection(issues: AlignmentIssue[]) {
  const order: string[] = []
  const bySection = new Map<string, AlignmentIssue[]>()
  for (const issue of issues) {
    if (!bySection.has(issue.sectionCode)) {
      bySection.set(issue.sectionCode, [])
      order.push(issue.sectionCode)
    }
    bySection.get(issue.sectionCode)!.push(issue)
  }
  return order.map(sectionCode => {
    const sectionIssues = bySection.get(sectionCode)!
    return {
      sectionCode,
      issues: sectionIssues,
      eligibleIssues: sectionIssues.filter(i => i.source === 'LlmJudged'),
    }
  })
}

function getSectionDescription(sectionCode?: string): string {
  const descriptions: Record<string, string> = {
    '0.0':  'Summarize the study\'s purpose, method, and — once the thesis is complete — findings and contribution; before then, the intended design and significance. No citations.',
    '1.0':  'Write a compelling introduction that contextualises the study and outlines its importance within the field.',
    '1.2':  'Provide historical and contextual background — how has the problem evolved and what do we know so far?',
    '2.0':  'Synthesise existing literature thematically and identify the gap this study addresses. Every paragraph must cite multiple sources.',
    // Aligned with the actual generation prompt (ResearchPrompts.cs's "3.1" case + the shared
    // "continuous prose paragraphs only" rule) — this previously described a stricter, invented
    // "one paragraph, every sentence cited" rule the backend never actually enforced (Phase 0
    // audit finding #6). No shared source of truth exists between this TS hint copy and the C#
    // prompt text today; hand-aligning here is the pragmatic fix, not a generator.
    '3.1':  'State the specific, evidence-based research problem with precision, referencing the gap identified in the literature. Quantify or qualify the consequences of not addressing it, and close with a single clear problem statement sentence. Continuous prose only — no lists.',
    '3.2':  'Justify the need for this study — scientific contribution, practical value, and contextual relevance.',
    '3.3':  'Present the theoretical or conceptual framework and explain how it applies to this specific study.',
    '4.1':  'State 3–4 specific, answerable research questions derived from the problem statement.',
    '4.2':  'State the single overarching aim of the study in one sentence beginning with an action verb.',
    '4.3':  'List 4–5 specific objectives aligned to the research questions, each with a SMART action verb.',
    '4.4':  'State null (H₀) and alternative (H₁) hypotheses for each quantitative objective.',
    '5.1':  'Describe the geographic and institutional study area with supporting citations.',
    '5.2':  'Name and justify the study design. Explain why alternatives were not appropriate.',
    '5.3':  'Define the target and accessible population with demographic characteristics.',
    '5.4':  'List inclusion and exclusion criteria — each must be operationalisable and evidence-based.',
    '5.5':  'State the sample size and show the calculation formula with all parameters.',
    '5.6':  'Describe the sampling strategy and step-by-step sampling procedure.',
    '5.7':  'Define all variables — type, role, operational definition, measurement scale, and data source.',
    '5.7a': 'Name the exact statistical test for every research question, with assumptions and the missing-data strategy.',
    '5.8':  'Describe the data collection instrument, procedure, and any training of collectors.',
    '5.9':  'Address validity, reliability, and quality control procedures for the instruments.',
    '5.10': 'Describe data storage, coding, cleaning, access control, and retention procedures.',
    '5.11': 'Address ethical principles: consent, confidentiality, risk-benefit, and institutional approval.',
    '5.12': 'Honestly discuss the limitations of the study design, sample, instruments, and potential biases.',
    '6.0':  'Report findings from each analysis. No interpretation here — only what was found.',
    '6.1':  'Present a Gantt chart of proposed activities across the study timeline.',
    '6.2':  'Itemise the proposed budget with justification for each line item.',
    '6.3':  'State dissemination plans — target journals, conferences, and policy stakeholders.',
    '7.0':  'Interpret findings against the literature and conceptual framework. Address the literature gap.',
    '8.0':  "Answer each research question and state the study's contribution to knowledge.",
    '8.1':  'Provide specific, evidence-based recommendations for policy, practice, and future research.',
  }
  return descriptions[sectionCode ?? ''] ?? 'Write this section using your project context and included literature.'
}

const CITATION_LABELS: Record<CitationStyle, string> = {
  apa7:    'APA 7 (Author, 2023)',
  harvard: 'Harvard (Author, 2023)',
  mla:     'MLA (Author 23)',
  ieee:    'IEEE [1]',
}

const LEVEL_LABELS: Record<AcademicLevel, string> = {
  UNDERGRADUATE: 'Undergraduate',
  MASTERS:       'Masters',
  PHD:           'PhD',
}

const SUGGESTION_CHIPS = [
  'Healthcare technology and patient care',
  'Artificial intelligence in education',
  'Climate change and sustainable agriculture',
  'Cybersecurity in financial systems',
  'Mental health interventions for youth',
]


// ── Shared sub-components ─────────────────────────────────────────────────────

function StepCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('max-w-3xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm', className)}>
      {children}
    </div>
  )
}

// ── Step 0: Research Topic ─────────────────────────────────────────────────────

const OWN_TOPIC_ID = '__own_topic__'
const GENERATE_COOLDOWN_MS = 3000

function ResearchTopicStep({
  project,
}: {
  project: ResearchProject
  onNext:  () => void
}) {
  const { updateProject, setTopics, selectTopic, setGeneratedTitles, syncProject } = useResearchStore()
  // The create-proposal flow only ever writes project.title, never fieldInterest (confirmed —
  // ProposalStudioPage's handleCreate passes ?title= into CreateProjectPayload.title only), so a
  // project created with a working title arrived here with an empty field despite already having
  // a real research question. Fall back to the title (excluding the generic placeholder) so that
  // text isn't silently discarded (Research Agent UX audit, 2026-10-03).
  const prefillFromTitle = !project.fieldInterest && project.title && project.title !== 'Untitled Research Project'
    ? project.title : ''
  const [field,    setField]      = useState(project.fieldInterest || prefillFromTitle)
  const [level,    setLevel]      = useState<AcademicLevel>(project.academicLevel)
  const [loading,  setLoading]    = useState(false)
  const [topics,   setLocalTopics] = useState<ResearchTopic[]>(project.suggestedTopics)
  const [chosen,   setChosen]     = useState<ResearchTopic | null>(project.selectedTopic)
  // When a topic is confirmed, show the summary view. Clicking "Edit Topic" flips back.
  const [confirmed, setConfirmed] = useState(!!project.selectedTopic)
  const [showPrefillBanner, setShowPrefillBanner] = useState(!!prefillFromTitle)
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const [, forceTick] = useState(0)
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const submittingRef = useRef(false)

  const canGenerate = field.trim().length > 10
  const inCooldown = Date.now() < cooldownUntil

  const handleGenerate = async () => {
    if (!canGenerate || submittingRef.current || inCooldown) return
    submittingRef.current = true
    setShowPrefillBanner(false)
    updateProject(project.id, { fieldInterest: field, academicLevel: level })
    setLoading(true)
    try {
      const results = await researchApi.generateTopics(project.id, field, level)
      setLocalTopics(results)
      setTopics(project.id, results)
      setCooldownUntil(Date.now() + GENERATE_COOLDOWN_MS)
      setTimeout(() => forceTick(t => t + 1), GENERATE_COOLDOWN_MS + 50)
      requestAnimationFrame(() => {
        resultsHeadingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        resultsHeadingRef.current?.focus()
      })
    } catch {
      toast.error('Failed to generate topics. Please try again.')
    } finally {
      setLoading(false)
      submittingRef.current = false
    }
  }

  const handleSelect = (t: ResearchTopic) => {
    setChosen(t)
    selectTopic(project.id, t)
    setConfirmed(true)
    setShowPrefillBanner(false)
  }

  const handleUseOwnTopic = () => {
    const trimmed = field.trim()
    if (!trimmed) return
    handleSelect({ id: OWN_TOPIC_ID, title: trimmed, description: '', tags: [], gapSummary: '' })
  }

  const handleChangeTopic = () => {
    setChosen(null)
    selectTopic(project.id, null)
    setConfirmed(false)
    setLocalTopics([])
  }

  const handleChip = (chip: string) => {
    setField(chip)
    textareaRef.current?.focus()
  }

  const resultCards: (ResearchTopic & { isOwn?: boolean })[] = field.trim()
    ? [{ id: OWN_TOPIC_ID, title: field.trim(), description: '', tags: [], gapSummary: '', isOwn: true }, ...topics]
    : topics

  const handleCardKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const next = e.key === 'ArrowDown' ? (idx + 1) % resultCards.length : (idx - 1 + resultCards.length) % resultCards.length
    const el = document.getElementById(`topic-card-${resultCards[next].id}`)
    el?.focus()
  }

  // ── Confirmed topic summary view ─────────────────────────────────────────
  if (confirmed && chosen) {
    return (
      <StepCard>
        <div className="p-8">
          {/* Action buttons */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => setConfirmed(false)}
              className="flex-1 flex items-center justify-center gap-2 border border-slate-200 rounded-lg py-2.5 px-4 text-[13px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Edit2 size={13} /> Edit Topic
            </button>
            <button
              onClick={handleChangeTopic}
              className="flex-1 flex items-center justify-center gap-2 border border-slate-200 rounded-lg py-2.5 px-4 text-[13px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <RefreshCw size={13} /> Change Topic
            </button>
          </div>

          {/* Confirmed topic display */}
          <div className="mb-6">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Your Research Topic
            </p>
            <p className="text-[17px] font-bold text-slate-900 leading-snug mb-3">
              {chosen.title}
            </p>
            <p className="text-[12px] text-slate-500 leading-relaxed">
              You can edit this topic or click <strong>Next</strong> to proceed to generating your research title.
            </p>
          </div>

          {/* A gap chosen from the literature: refine its research question before titles are built from it. */}
          {chosen.id.startsWith('gap-') && (
            <GapQuestionEditor
              question={questionFromDescription(chosen.description)}
              gap={chosen.gapSummary}
              onSave={async q => {
                const next = { ...chosen, description: `${QUESTION_PREFIX} ${q}` }
                setChosen(next)
                selectTopic(project.id, next)
                setGeneratedTitles(project.id, [])
                await syncProject(project.id).catch(() => toast.error('Could not save your research question.'))
              }}
            />
          )}

          {/* Tags */}
          {chosen.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-5">
              {chosen.tags.map(tag => (
                <span key={tag} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[11px] font-medium">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Auto-save indicator */}
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <p className="text-[12px] text-slate-400">Progress automatically saved</p>
          </div>
        </div>
      </StepCard>
    )
  }

  // ── Topic generator view ──────────────────────────────────────────────────
  return (
    <StepCard>
      <div className="p-8">
        <p className="text-[13px] text-slate-500 mb-5">
          Describe your field or interest, then use <strong>Find research gaps</strong> to get topics
          backed by real papers. <strong>Quick ideas</strong> is a faster brainstorm with no literature check.
        </p>

        {/* Pre-filled banner */}
        {showPrefillBanner && (
          <div className="bg-purple-tint border border-purple-accent/20 rounded-xl p-3.5 mb-5 flex items-center justify-between gap-3">
            <p className="text-[12px] text-purple-text">Pre-filled from your proposal. Review or change it below.</p>
            <button
              onClick={handleUseOwnTopic}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-purple-accent hover:bg-purple-deep text-white text-[12px] font-medium transition-colors"
            >
              Continue
            </button>
          </div>
        )}

        {/* Academic Level */}
        <div className="mb-6">
          <label className="block text-[13px] font-semibold text-slate-700 mb-2">Academic Level</label>
          <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg">
            {(['UNDERGRADUATE', 'MASTERS', 'PHD'] as AcademicLevel[]).map(l => (
              <button
                key={l}
                onClick={() => setLevel(l)}
                className={cn(
                  'py-2 rounded-md text-[13px] font-medium transition-all',
                  level === l
                    ? 'bg-purple-accent text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700',
                )}
              >
                {LEVEL_LABELS[l]}
              </button>
            ))}
          </div>
        </div>

        {/* Field textarea */}
        <div className="mb-5">
          <label htmlFor="research-topic-field" className="block text-[13px] font-semibold text-slate-700 mb-2">
            Enter your research topic or existing title
          </label>
          <textarea
            id="research-topic-field"
            ref={textareaRef}
            value={field}
            onChange={e => setField(e.target.value)}
            placeholder="A broad topic (e.g. digital learning adoption among university students) or a title you already have. You don't need a final title to look for gaps."
            rows={5}
            data-gramm="false"
            data-gramm_editor="false"
            data-enable-grammarly="false"
            className="w-full bg-white border border-slate-200 rounded-xl p-4 text-[13px] text-slate-700 placeholder-slate-400 resize-none outline-none focus:border-purple-accent focus:ring-2 focus:ring-purple-tint transition-all"
          />
        </div>

        {/* Chips — only while the field is empty, so they read as starting points, not clutter
            once the student has already written something. */}
        {!field.trim() && (
          <div className="mb-6">
            <p className="text-[12px] text-slate-500 font-medium mb-2">Or start from an example:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTION_CHIPS.map(chip => (
                <button
                  key={chip}
                  onClick={() => handleChip(chip)}
                  className="px-3 py-1.5 rounded-full border border-slate-200 text-[12px] text-slate-600 hover:border-purple-accent hover:text-purple-text hover:bg-purple-tint transition-all"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Primary action — verified gaps: retrieval, screening, evidence passages and a
            counter-search per gap. Listed first so it is the default way to find a topic. */}
        <GapFinderPanel
          className="mb-6"
          projectId={project.id}
          topic={field}
          onUseGap={r => {
            // Titles generated before this gap was chosen don't reflect its research question.
            setGeneratedTitles(project.id, [])
            handleSelect({
              id: `gap-${r.gapId}`,
              title: r.title,
              description: `Research question: ${r.suggestedQuestion}`,
              tags: [],
              gapSummary: `Potential gap within the reviewed literature: ${r.statement}`,
            })
          }}
        />

        {/* Secondary action — fast, model-only ideas with no literature check behind them. */}
        <div className="pt-5 border-t border-slate-100">
          <Tooltip label={!canGenerate ? 'Describe your interest or pick an example (at least a few words)' : inCooldown ? 'Give it a moment before generating again' : 'Quick ideas'}>
            <button
              onClick={handleGenerate}
              disabled={!canGenerate || loading || inCooldown}
              className={cn(
                'px-5 py-2.5 rounded-xl text-[13px] font-semibold whitespace-nowrap shrink-0 inline-flex items-center justify-center gap-2 border transition-all',
                canGenerate && !loading && !inCooldown
                  ? 'border-slate-300 text-slate-700 bg-white hover:bg-slate-50'
                  : 'border-slate-200 text-slate-400 cursor-not-allowed',
              )}
            >
              {loading ? (
                <><Loader2 size={14} className="animate-spin" /> Generating…</>
              ) : (
                <><Sparkles size={14} /> {topics.length > 0 ? 'More quick ideas' : 'Quick ideas (unverified)'}</>
              )}
            </button>
          </Tooltip>
          <p className="text-[12px] text-slate-500 mt-2 max-w-xl leading-relaxed">
            A fast brainstorm from a handful of abstracts. These are ideas, not checked gaps; nothing
            confirms the literature has not already covered them.
          </p>
        </div>
      </div>

      {/* ── Topic cards (own-topic option + generated suggestions) ─────────── */}
      <AnimatePresence>
        {resultCards.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="border-t border-slate-100 overflow-hidden"
          >
            <div className="p-6">
              <h3 ref={resultsHeadingRef} tabIndex={-1} className="text-[15px] font-bold text-slate-800 mb-0.5 outline-none">
                {topics.length > 0 ? `${topics.length} quick idea${topics.length === 1 ? '' : 's'} (unverified)` : 'Your topic'}
              </h3>
              <p className="text-[12px] text-slate-500 mb-4">
                Click a topic to select it. You'll be able to edit it before proceeding.
              </p>

              <div role="radiogroup" aria-label="Research topic options" className="space-y-4">
                {resultCards.map((t, idx) => {
                  const isOwn = t.id === OWN_TOPIC_ID
                  const isSelected = chosen?.id === t.id
                  return (
                    <button
                      id={`topic-card-${t.id}`}
                      key={t.id}
                      role="radio"
                      aria-checked={isSelected}
                      onKeyDown={e => handleCardKeyDown(e, idx)}
                      onClick={() => isOwn ? handleUseOwnTopic() : handleSelect(t)}
                      className={cn(
                        'w-full text-left bg-white border rounded-xl p-5 cursor-pointer transition-all duration-200 relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/50',
                        isSelected
                          ? 'border-2 border-purple-accent bg-purple-tint/30 shadow-sm'
                          : 'border border-slate-200 hover:bg-slate-50/50 hover:border-slate-300',
                      )}
                    >
                      <div className={cn(
                        'absolute top-4 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center',
                        isSelected ? 'border-purple-accent bg-purple-accent' : 'border-slate-300',
                      )}>
                        {isSelected && <Check size={11} className="text-white" />}
                      </div>

                      {isOwn ? (
                        <>
                          <p className="text-[11px] font-bold uppercase tracking-wide text-purple-text mb-1.5">Use my topic as written</p>
                          <p className="text-[14px] font-semibold text-slate-800 leading-snug pr-8">{t.title}</p>
                        </>
                      ) : (
                        <TopicCardBody topic={t} />
                      )}
                    </button>
                  )
                })}
              </div>

              {chosen && (
                <p className="text-[12px] text-slate-500 mt-4">
                  Selected: <strong className="text-slate-700">{chosen.title}</strong>. You'll refine the title in the next step.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </StepCard>
  )
}

// Compact by default — full description and tags only on "Show details", so two cards can be
// compared without a 450px scroll each (Research Agent UX audit, 2026-10-03). The gap text was
// removed: generateTopics returns no supporting papers, so it was an unverified claim.
function TopicCardBody({ topic }: { topic: ResearchTopic }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div onClick={e => e.stopPropagation()}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Unverified idea</p>
      <p className="text-[14px] font-bold text-slate-900 leading-snug pr-8 mb-2">{topic.title}</p>
      <p className={cn('text-[12px] text-slate-600 leading-relaxed mb-2', !expanded && 'line-clamp-2')}>
        {topic.description}
      </p>
      {topic.tags?.length > 0 && expanded && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {topic.tags.map(tag => (
            <span key={tag} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[11px] font-medium">
              {tag}
            </span>
          ))}
        </div>
      )}
      {/* No gap text here: generateTopics' gapSummary is an unchecked model assertion over six
          truncated abstracts. Verified gaps come only from Find research gaps. */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="text-[11px] font-medium text-purple-accent hover:text-purple-deep mt-2 transition-colors"
      >
        {expanded ? 'Show less' : 'Show details'}
      </button>
    </div>
  )
}

// Coarse keyword classifier for GeneratedTitle.methodology free text (e.g. "Cross-Sectional
// Survey", "Mixed-Methods Investigation") into the three canonical Tier 1 buckets the
// Methodology Type step uses. Used to pre-fill that step from whichever title the student
// picked — mirrors (and is a superset of) ResearchPrompts.ClassifyMethodology server-side,
// which only matches the literal words "qualitative"/"quantitative"/"mixed".
// ── Step 1: Research Title ─────────────────────────────────────────────────────

// Coarse keyword classifier for GeneratedTitle.methodology free text, so an already-confirmed
// methodology can be checked against what each title implies — mirrors (and is a superset of)
// ResearchPrompts.ClassifyMethodology server-side, which only matches the literal words
// "qualitative"/"quantitative"/"mixed". Display-only flag, never auto-corrects anything.
function classifyTitleDesign(methodology: string): 'Qualitative' | 'Quantitative' | 'Mixed Methods' | null {
  const text = methodology.toLowerCase()
  if (text.includes('mixed')) return 'Mixed Methods'
  if (text.includes('qualitative')) return 'Qualitative'
  if (text.includes('quantitative') || text.includes('survey') || text.includes('cross-sectional') || text.includes('experiment')) return 'Quantitative'
  return null
}

function ResearchTitleStep({ project }: { project: ResearchProject }) {
  const { updateProject, setGeneratedTitles } = useResearchStore()
  const [, setSearchParams] = useSearchParams()

  const existingTitles = project.generatedTitles ?? []
  const [titles,          setTitles]      = useState<GeneratedTitle[]>(existingTitles)
  const [selectedId,      setSelectedId]  = useState<string | null>(
    // Pre-select whichever title matches the stored project title, if any
    existingTitles.find(t => t.titleText === project.title)?.id ?? null
  )
  const [customTitle,     setCustomTitle] = useState(
    // Pre-fill custom input if the stored title doesn't match any generated one
    existingTitles.some(t => t.titleText === project.title) ? '' : (
      project.title === 'Untitled Research Project' ? '' : project.title
    )
  )
  const [generating, setGenerating] = useState(false)
  const [pendingRegenerateConfirm, setPendingRegenerateConfirm] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const customInputRef = useRef<HTMLInputElement>(null)
  const regenSubmittingRef = useRef(false)

  const chosenTopic = project.selectedTopic?.title ?? project.fieldInterest
  const hasSelection = Boolean(selectedId || customTitle.trim())

  const doGenerate = useCallback(async () => {
    if (!chosenTopic.trim() || regenSubmittingRef.current) return
    regenSubmittingRef.current = true
    setGenerating(true)
    try {
      const results = await researchApi.generateTitles(project.id, chosenTopic, project.academicLevel)
      setTitles(results)
      setGeneratedTitles(project.id, results)
      setSelectedId(null)
      setCustomTitle('')
      // Clear the stale title string too — previously Regenerate All left project.title
      // pointing at a title no card was marked as selected for (Research Agent UX audit).
      updateProject(project.id, { title: 'Untitled Research Project' })
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to generate titles. Please try again.'))
    } finally {
      setGenerating(false)
      regenSubmittingRef.current = false
    }
  }, [project.id, chosenTopic, project.academicLevel])

  const handleRegenerateAllClick = () => {
    if (hasSelection) { setPendingRegenerateConfirm(true); return }
    doGenerate()
  }

  // Auto-generate on first load if no titles are cached yet
  useEffect(() => {
    if (existingTitles.length === 0 && chosenTopic.trim()) {
      doGenerate()
    }
  }, []) // run once on mount

  const handleSelectCard = (t: GeneratedTitle) => {
    setSelectedId(t.id)
    setCustomTitle('')
    // Only pre-fill the canonical field when it classifies cleanly — leaving it unset is better
    // than writing a guess the Methodology Type step (and backend branching) can't recognise.
    updateProject(project.id, { title: t.titleText })
  }

  // Debounced custom-title sync — 600 ms after the user stops typing
  const handleCustomChange = (val: string) => {
    setCustomTitle(val)
    setSelectedId(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      updateProject(project.id, { title: val || 'Untitled Research Project' })
    }, 600)
  }

  // "Edit" on a generated card: no per-title edit handler exists anywhere (confirmed via
  // discovery — the backend only ever regenerates the whole batch), so editing a generated
  // title reuses the same custom-title field, pre-filled with that title's text, rather than
  // inventing a per-title update call.
  const handleEditCard = (t: GeneratedTitle) => {
    setSelectedId(null)
    handleCustomChange(t.titleText)
    customInputRef.current?.focus()
  }

  const methodologyMismatch = project.methodologyType
    ? titles.find(t => {
        const design = classifyTitleDesign(t.methodology)
        return design && design !== project.methodologyType
      })
    : null

  if (!chosenTopic.trim()) {
    return (
      <StepCard>
        <div className="p-8 text-center">
          <p className="text-[14px] font-semibold text-slate-700 mb-1">No topic confirmed yet</p>
          <p className="text-[13px] text-slate-500 mb-4">Choose or write a research topic first — titles are generated from it.</p>
          <button
            onClick={() => setSearchParams({ step: '0' })}
            className="px-4 py-2 rounded-lg bg-purple-accent hover:bg-purple-deep text-white text-[13px] font-medium transition-colors"
          >
            Go to Research Topic
          </button>
        </div>
      </StepCard>
    )
  }

  return (
    <StepCard>
      <div className="p-8">
        {/* Carry-over card */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                Your Research Topic
              </p>
              <p className="text-[14px] font-semibold text-slate-800 leading-snug">{chosenTopic}</p>
            </div>
            <button
              onClick={() => setSearchParams({ step: '0' })}
              className="shrink-0 flex items-center gap-1 text-[12px] font-medium text-purple-accent hover:text-purple-deep transition-colors"
            >
              <Edit2 size={12} /> Edit
            </button>
          </div>
          {project.selectedTopic?.id.startsWith('gap-') && project.selectedTopic.gapSummary && (
            <p className="text-[12px] text-slate-500 mt-2 leading-relaxed">{project.selectedTopic.gapSummary}</p>
          )}
        </div>

        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-[15px] font-bold text-slate-800">Research titles</p>
          <Tooltip label="Regenerating replaces every title below">
            <button
              onClick={handleRegenerateAllClick}
              disabled={generating}
              className="flex items-center gap-1.5 bg-purple-accent hover:bg-purple-deep text-white text-[12px] font-medium rounded-lg px-3 py-1.5 transition-colors disabled:opacity-60"
            >
              {generating
                ? <><Loader2 size={12} className="animate-spin" /> Generating…</>
                : <><RefreshCw size={12} /> Regenerate all</>}
            </button>
          </Tooltip>
        </div>

        {/* Loading skeleton */}
        {generating && (
          <div className="space-y-3 mb-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="border border-slate-200 rounded-xl p-4 animate-pulse">
                <div className="h-3 bg-slate-200 rounded w-4/5 mb-2" />
                <div className="h-3 bg-slate-200 rounded w-2/3" />
              </div>
            ))}
          </div>
        )}

        {!generating && (
          <div role="radiogroup" aria-label="Research title options" className="space-y-3 mb-2">
            {/* Write my own — first option, same selected treatment as generated cards */}
            <div
              className={cn(
                'border rounded-xl p-4 transition-all duration-150',
                selectedId === null && customTitle.trim()
                  ? 'border-2 border-purple-accent bg-purple-tint/30 shadow-sm'
                  : 'border-slate-200 bg-white',
              )}
            >
              <label htmlFor="custom-title-input" className="block text-[12px] font-semibold text-slate-700 mb-1.5">
                Write my own title
              </label>
              <input
                id="custom-title-input"
                ref={customInputRef}
                value={customTitle}
                onChange={e => handleCustomChange(e.target.value)}
                placeholder="Type your own research title…"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-[13px] text-slate-800 placeholder-slate-400 outline-none focus:border-purple-accent focus:ring-2 focus:ring-purple-tint transition-all"
              />
              {customTitle && (
                <p className="text-[11px] text-slate-400 mt-1.5 text-right">
                  {customTitle.split(' ').filter(Boolean).length} words
                </p>
              )}
            </div>

            {/* Generated titles */}
            {titles.map(t => {
              const isSelected = selectedId === t.id
              const design = classifyTitleDesign(t.methodology)
              const mismatches = Boolean(project.methodologyType && design && design !== project.methodologyType)
              return (
                <div
                  key={t.id}
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={0}
                  onClick={() => handleSelectCard(t)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectCard(t) } }}
                  className={cn(
                    'group block w-full text-left border rounded-xl p-4 text-sm transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/50',
                    isSelected
                      ? 'border-2 border-purple-accent bg-purple-tint/30 shadow-sm'
                      : 'border-slate-200 hover:border-slate-400 bg-white',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn(
                      'text-[13px] leading-snug font-medium',
                      isSelected ? 'text-slate-900' : 'text-slate-700',
                    )}>
                      {t.titleText}
                    </p>
                    <button
                      onClick={e => { e.stopPropagation(); handleEditCard(t) }}
                      className="shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-purple-accent transition-all"
                    >
                      <Edit2 size={11} /> Edit
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-medium">
                      {t.methodology}
                    </span>
                    {mismatches && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-tint text-amber-text text-[11px] font-medium">
                        <AlertTriangle size={10} /> Differs from your chosen methodology
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {!generating && (
          <p className="text-[11px] text-slate-400 mb-5">
            {project.methodologyType
              ? methodologyMismatch
                ? 'One or more titles suggest a different design than your confirmed methodology — pick one that matches, or adjust your methodology on that step.'
                : ''
              : "Titles suggest a design. You'll confirm your methodology in step 4."}
          </p>
        )}

        {/* Workspace name note — there's no separate rename; the title chosen here is the
            same field the proposal list and breadcrumb both read. */}
        <p className="text-[11px] text-slate-400 mb-5">
          This also becomes your proposal's name in Proposal Studio — you can rename it any time.
        </p>

        {/* Auto-save indicator */}
        {!generating && (
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <p className="text-[12px] text-slate-400">Progress automatically saved</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {pendingRegenerateConfirm && (
          <ConfirmActionModal
            title="Regenerate all titles?"
            message="This replaces every title below, including the one you've selected or written. It can't be undone."
            confirmLabel="Regenerate all"
            onClose={() => setPendingRegenerateConfirm(false)}
            onConfirm={async () => { setPendingRegenerateConfirm(false); await doGenerate() }}
          />
        )}
      </AnimatePresence>
    </StepCard>
  )
}

// ── Step 2: Location ──────────────────────────────────────────────────────────

function LocationStep({ project }: { project: ResearchProject }) {
  const { setContent, updateProject } = useResearchStore()

  const enabled    = (project.sectionContent['location-enabled'] ?? 'true') !== 'false'
  // Both fields persist to real columns that ResearchPrompts.cs/ResearchService.cs
  // interpolate into every chapter-generation prompt ("Study Location: ..." /
  // "Study Population: ...") — previously these only lived in the generic
  // sectionContent bag and never reached generated content at all.
  const area       = project.studyLocation ?? ''
  const population = project.studyPopulation ?? ''

  const toggle = () => setContent(project.id, 'location-enabled', enabled ? 'false' : 'true')

  const canProceed = !enabled || (area.trim().length > 0 && population.trim().length > 0)

  return (
    <StepCard>
      <div className="p-8">
        {/* Header + toggle */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[16px] font-bold text-slate-800">Research Project Location</h2>
          <button
            onClick={toggle}
            className="flex items-center gap-2 text-[12px] font-semibold text-slate-600 select-none"
          >
            <span className={cn(
              'relative inline-flex w-9 h-5 rounded-full transition-colors duration-200',
              enabled ? 'bg-[#1e293b]' : 'bg-slate-300',
            )}>
              <span className={cn(
                'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-200',
                enabled ? 'left-[18px]' : 'left-0.5',
              )} />
            </span>
            {enabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        {enabled ? (
          <>
            <p className="text-[13px] text-slate-600 mb-6 leading-relaxed">
              Location is enabled. Provide the geographical location and population for your research study.{' '}
              <span className="text-sky-600">This information will be used throughout your proposal to ensure context-specific content generation.</span>
            </p>

            {/* Geographical Area */}
            <div className="mb-5">
              <label className="block text-[13px] font-semibold text-slate-700 mb-1">
                Geographical Area <span className="text-red-500">*</span>
              </label>
              <p className="text-[12px] text-slate-500 mb-2">
                Enter the country and name of place where you're going to conduct the study. Can be a school, company, clinic, hospital, etc.
              </p>
              <input
                value={area}
                onChange={e => updateProject(project.id, { studyLocation: e.target.value })}
                placeholder="e.g., Mulago Out Patient Clinic, Kampala, Uganda"
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-[13px] text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all placeholder-slate-400"
              />
            </div>

            {/* Population */}
            <div className="mb-5">
              <label className="block text-[13px] font-semibold text-slate-700 mb-1">
                Population <span className="text-red-500">*</span>
              </label>
              <p className="text-[12px] text-slate-500 mb-2">
                Specify the population you're going to study. Can be people (e.g., patients, students, healthcare workers), objects, or other entities.
              </p>
              <textarea
                rows={3}
                value={population}
                onChange={e => updateProject(project.id, { studyPopulation: e.target.value })}
                placeholder="e.g., Patients visiting the clinic, Healthcare workers, AI chatbots"
                className="w-full bg-white border border-slate-200 rounded-xl p-4 text-[13px] text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all placeholder-slate-400 resize-none"
              />
            </div>

            {!canProceed && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-[12px] text-amber-700">
                  Please fill in both fields before proceeding. This information is required for generating contextually appropriate content.
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-[13px] text-slate-500 mb-5 leading-relaxed">
              Location is disabled. Your research will not include specific geographical or population context.
              You can enable it anytime by toggling the switch above.
            </p>
            <div className="border border-slate-200 rounded-xl p-6 text-center mb-5">
              <p className="text-[13px] font-medium text-slate-500 mb-1">Location Disabled</p>
              <p className="text-[12px] text-slate-400">
                Your research will proceed without specific geographical context. Enable location above to add context-specific information.
              </p>
            </div>
          </>
        )}

        {/* Context summary — shown when values exist */}
        {(area || population) && (
          <div className="border border-slate-200 rounded-xl p-4 mb-4">
            <p className="text-[12px] font-semibold text-slate-700 mb-2">Research Context Summary</p>
            <p className="text-[12px] text-slate-600 mb-1">
              <span className="font-medium text-slate-700">Location: </span>{area || '—'}
            </p>
            <p className="text-[12px] text-slate-600 mb-2">
              <span className="font-medium text-slate-700">Population: </span>{population || '—'}
            </p>
            <p className="text-[11px] text-sky-600 leading-relaxed">
              This information will be used throughout your proposal to ensure all generated content is contextually relevant to your study location and population.
            </p>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <p className="text-[12px] text-slate-400">Progress automatically saved</p>
        </div>
      </div>
    </StepCard>
  )
}

// ── Step: Methodology Type ──────────────────────────────────────────────────────

type MethodologyTier1 = 'Qualitative' | 'Quantitative' | 'Mixed Methods'

const METHODOLOGY_TIER1: { value: MethodologyTier1; description: string }[] = [
  { value: 'Qualitative',   description: 'Interviews, focus groups, case studies — explores meaning and experience through non-numerical data.' },
  { value: 'Quantitative',  description: 'Surveys, experiments, statistical analysis — measures variables and tests relationships numerically.' },
  { value: 'Mixed Methods', description: 'Combines qualitative and quantitative strands within a single study.' },
]

const METHODOLOGY_TIER2: Record<MethodologyTier1, string[]> = {
  'Qualitative': ['Case Study', 'Phenomenology', 'Grounded Theory', 'Narrative Inquiry', 'Other'],
  'Quantitative': ['Correlational', 'Experimental', 'Quasi-Experimental', 'Case Study', 'Other'],
  'Mixed Methods': ['Case Study', 'Correlational', 'Other'],
}

const RECOMMENDATION_KEY = 'methodology-recommendation-v1'
const CONFIRMATION_SOURCE_KEY = 'methodology-confirmation-source'
const METHODOLOGY_TIME_FRAMES = ['Cross-sectional', 'Longitudinal', 'Unspecified']
const METHODOLOGY_COLLECTION = ['Questionnaire', 'Interview', 'Focus Group', 'Observation', 'Existing Records', 'Other']
const METHODOLOGY_ANALYSIS = ['Regression', 'Thematic Analysis', 'Descriptive Statistics', 'Other']
const METHODOLOGY_MIXED_DESIGNS = ['Convergent', 'Explanatory Sequential', 'Exploratory Sequential', 'Unspecified']

// Chapters whose framing/vocabulary branches on methodology type — kept in sync with
// MethodologySensitiveSectionCodes in ResearchService.cs and the branches in ResearchPrompts.
// docs/OPEN_ITEMS.md #81 — this list was missing "3.3" and "5.2" relative to the backend's
// authoritative list; the backend independently re-gates both (this is a client-side pre-check
// only), but the mismatch meant the friendly toast below never fired for those two codes.
const METHODOLOGY_SENSITIVE_SECTIONS = new Set(['3.3', '5.2', '5.4', '5.5', '5.6', '5.7', '5.7a', '5.9', '5.10', '5.12'])

function MethodologyTypeStep({ project }: { project: ResearchProject }) {
  const { updateProject, syncProject, loadProject, loadSections, setContent } = useResearchStore()
  const dbSections = useResearchStore(s => s.sections[project.id] ?? EMPTY_SECTIONS)
  const [loadingSuggestion, setLoadingSuggestion] = useState(false)
  const [showWhy, setShowWhy] = useState(false)
  const [suggestionError, setSuggestionError] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const requestRef = useRef(0)

  // Setup steps run before the chapter-writing screen's own initSections/loadSections effect —
  // load here too so the "already generated content" lock-check below isn't working off a
  // stale/empty cache for a project the student is revisiting.
  useEffect(() => { loadSections(project.id) }, [project.id, loadSections])

  const tier1 = project.methodologyType as MethodologyTier1 | undefined
  const tier2 = project.methodologySubType ?? ''
  const hasGeneratedContent = dbSections.some(s => s.content && s.content.trim().length > 0)
  const suggestion = (() => {
    try { return JSON.parse(project.sectionContent[RECOMMENDATION_KEY] ?? '') as MethodologyRecommendation }
    catch { return null }
  })()
  const currentFingerprint = methodologyInputFingerprint({ title: project.title, topic: project.selectedTopic?.title ?? project.fieldInterest, context: `${project.studyLocation ?? ''}|${project.studyPopulation ?? ''}|${project.academicLevel}` })
  const suggestionIsStale = Boolean(suggestion && suggestion.inputFingerprint !== currentFingerprint)

  const generateSuggestion = useCallback((clarificationAnswer?: string) => {
    const requestId = ++requestRef.current
    setLoadingSuggestion(true)
    setSuggestionError(false)
    const input = { title: project.title, topic: project.selectedTopic?.title ?? project.fieldInterest, context: `${project.studyLocation ?? ''}|${project.studyPopulation ?? ''}|${project.academicLevel}` }

    const persist = (next: MethodologyRecommendation) => {
      if (requestRef.current !== requestId) return
      setContent(project.id, RECOMMENDATION_KEY, JSON.stringify(next))
      return syncProject(project.id).catch(() => setSuggestionError(true))
    }
    // Local, synchronous fallback — used when the backend AI call fails (network error, 503,
    // etc.) so the suggestion panel still has something to show rather than a bare error state.
    // Doesn't receive clarificationAnswer — the deterministic engine has no way to act on a
    // free-form answer, so a clarification click that hits this path just re-runs the same
    // keyword pass on the original input.
    const fallbackToLocalEngine = () => {
      if (requestRef.current !== requestId) return
      try { void persist(recommendMethodology(input)) }
      catch { setSuggestionError(true) }
    }

    researchApi.recommendMethodology(project.id, clarificationAnswer)
      .then(result => {
        if (requestRef.current !== requestId) return
        void persist({
          ...result,
          design: result.design ?? undefined,
          alternative: result.alternative ?? undefined,
          clarificationQuestion: result.clarificationQuestion ?? undefined,
          clarificationOptions: result.clarificationOptions,
          inputFingerprint: methodologyInputFingerprint(input),
          version: 'methodology-recommendation-v1',
        })
      })
      .catch(fallbackToLocalEngine)
      .finally(() => { if (requestRef.current === requestId) setLoadingSuggestion(false) })
  }, [project.id, project.title, project.selectedTopic?.title, project.fieldInterest, project.studyLocation, project.studyPopulation, project.academicLevel, setContent, syncProject])

  useEffect(() => {
    if (!suggestion && project.title && project.title !== 'Untitled Research Project') generateSuggestion()
    return () => { requestRef.current += 1 }
  }, [project.id])

  const saveApproach = async (value: MethodologyTier1, source: 'accepted-suggestion' | 'manual-choice') => {
    requestRef.current += 1
    updateProject(project.id, { methodologyType: value, methodologySubType: source === 'accepted-suggestion' ? (suggestion?.design ?? '') : (tier1 === value ? tier2 : '') })
    setContent(project.id, CONFIRMATION_SOURCE_KEY, source)
    try { await syncProject(project.id); toast.success('Research approach saved.') }
    catch { toast.error('Could not save the research approach.') }
  }

  const applyTier1 = (value: MethodologyTier1) => {
    if (tier1 && tier1 !== value && hasGeneratedContent) {
      const ok = window.confirm(
        `Changing this may require regenerating already-approved chapters that assumed "${tier1}". Continue?`,
      )
      if (!ok) return
    }
    void saveApproach(value, 'manual-choice')
  }

  const applyTier2 = (value: string) => {
    const next = tier2 === value ? '' : value // click the selected pill again to deselect
    updateProject(project.id, { methodologySubType: next })
    setContent(project.id, 'methodology-design', next)
    syncProject(project.id).catch(() => toast.error('Could not save methodology refinement.'))
  }

  const saveDetail = (key: string, value: string) => {
    setContent(project.id, key, value)
    syncProject(project.id).then(() => toast.success('Methodology detail saved.')).catch(() => toast.error('Could not save methodology detail.'))
  }

  // docs/OPEN_ITEMS.md #81 — the explicit confirmation action. Distinct from the tier1/tier2
  // pickers above, which only ever autosave a free-editing scratch value via `sync` — this is
  // what actually unlocks generation/approval for methodology-sensitive chapters server-side.
  // Business rule SD-BR1 (UI half): a methodology is not confirmable without a data-collection method, because
  // the data collection, data management and ethics chapters are written from it and are blocked at approval
  // while it is blank. Re-confirmation is also offered when only the details changed (same type), so a project
  // that was confirmed with the field blank can be corrected without changing its methodology type.
  const selectedCollection = project.sectionContent['methodology-data-collection'] ?? ''
  const confirmedCollection = project.confirmedMethodology?.dataCollectionApproach ?? ''
  const methodologyTypeChanged = !project.confirmedMethodology || project.confirmedMethodology.methodologyType !== tier1
  const methodologyDetailsChanged = !methodologyTypeChanged && selectedCollection !== confirmedCollection
  const confirmedWithoutCollection = !methodologyTypeChanged && !confirmedCollection

  const confirmMethodology = async () => {
    if (!tier1) return
    if (project.confirmedMethodology && project.confirmedMethodology.methodologyType !== tier1) {
      try {
        const impact = await researchApi.previewMethodologyChangeImpact(project.id, tier1)
        if (impact.isGenuineChange) {
          const parts = [
            impact.affectedApprovedSectionCodes.length > 0
              ? `${impact.affectedApprovedSectionCodes.length} approved chapter(s) (${impact.affectedApprovedSectionCodes.join(', ')}) will be un-approved and flagged for review`
              : null,
            impact.affectedDraftSectionCodes.length > 0
              ? `${impact.affectedDraftSectionCodes.length} draft chapter(s) (${impact.affectedDraftSectionCodes.join(', ')}) will be flagged for review`
              : null,
          ].filter(Boolean)
          const ok = window.confirm(
            `Changing the confirmed methodology from "${project.confirmedMethodology.methodologyType}" to "${tier1}" ` +
            (parts.length > 0 ? `will: ${parts.join('; ')}. Content is preserved, not deleted. ` : '') +
            'Continue?',
          )
          if (!ok) return
        }
      } catch {
        // Preview failing shouldn't block confirmation itself — the backend re-derives the same
        // impact deterministically when it actually confirms, so this is best-effort UX only.
      }
    }

    setConfirming(true)
    try {
      await researchApi.confirmMethodology(project.id, {
        methodologyType: tier1,
        methodologySubType: tier2,
        timeHorizon: project.sectionContent['methodology-time-frame'] ?? '',
        dataCollectionApproach: project.sectionContent['methodology-data-collection'] ?? '',
        dataAnalysisApproach: project.sectionContent['methodology-analysis'] ?? '',
      })
      await loadProject(project.id)
      toast.success('Methodology confirmed.')
    } catch {
      toast.error('Could not confirm methodology.')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <StepCard>
      <div className="p-8">
        <h2 className="text-[16px] font-bold text-slate-800 mb-1">Methodology Type</h2>
        <p className="text-[13px] text-slate-600 mb-6 leading-relaxed">
          This determines the language and structure of your methodology chapters — qualitative
          studies use constructs and trustworthiness criteria, quantitative studies use variables
          and statistical validity. Required before generating the Chapter 5 sections that depend
          on it (Sample Size, Study Variables, Quality Assurance).
        </p>

        <section aria-labelledby="suggested-approach" className="mb-6 rounded-xl border border-violet-200 bg-violet-50/50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p id="suggested-approach" className="text-[11px] font-semibold uppercase tracking-wide text-violet-500">AI suggestion</p>
              {loadingSuggestion && <p role="status" className="mt-2 flex items-center gap-2 text-[12px] text-slate-600"><Loader2 size={13} className="animate-spin" /> Reviewing the saved title and context…</p>}
              {!loadingSuggestion && suggestion && <>
                <p className="mt-1 text-[14px] font-semibold text-violet-800">{suggestion.approach}{suggestion.design && suggestion.design !== 'Unspecified' ? ` · ${suggestion.design}` : ''}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-600">{suggestion.rationale}</p>
                <p className="mt-2 text-[11px] text-slate-500">Confidence: {suggestion.confidence}</p>
                {/* Never silently imply an override — a manual choice stays authoritative and
                    visible alongside the suggestion, whether or not the two agree. */}
                {tier1 && (
                  tier1 === suggestion.approach
                    ? <p className="mt-2 text-[11px] font-semibold text-emerald-700">Your confirmed approach: {tier1} — matches this suggestion.</p>
                    : <p className="mt-2 text-[11px] font-semibold text-slate-700">Your confirmed approach: {tier1} <span className="font-normal text-slate-500">(differs from this suggestion — your choice is what's saved)</span></p>
                )}
                {suggestion.clarificationQuestion && !loadingSuggestion && (
                  <div className="mt-2 rounded-lg bg-white p-2">
                    <p className="text-[12px] font-medium text-slate-700">{suggestion.clarificationQuestion}</p>
                    {suggestion.clarificationOptions && suggestion.clarificationOptions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {suggestion.clarificationOptions.map(option => (
                          <button
                            key={option}
                            onClick={() => generateSuggestion(option)}
                            className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-[11px] font-medium text-violet-700 hover:bg-violet-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {suggestionIsStale && <p className="mt-2 text-[11px] font-semibold text-amber-700">Context changed after this suggestion. Refresh it; your confirmed choice remains unchanged.</p>}
              </>}
              {!loadingSuggestion && suggestionError && <p role="alert" className="mt-2 text-[12px] text-red-700">Suggestion unavailable. Manual selection remains available.</p>}
            </div>
            <button onClick={() => generateSuggestion()} className="shrink-0 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500">{suggestion ? 'Refresh' : 'Retry'}</button>
          </div>
          {suggestion && !loadingSuggestion && <div className="mt-3 flex flex-wrap gap-2">
            {suggestion.approach !== 'Undetermined' && <button onClick={() => void saveApproach(suggestion.approach as MethodologyTier1, 'accepted-suggestion')} className="rounded-lg bg-violet-700 px-3 py-2 text-[12px] font-semibold text-white focus:outline-none focus:ring-2 focus:ring-violet-500">Accept suggestion</button>}
            <button onClick={() => document.getElementById('methodology-options')?.focus()} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500">Choose another approach</button>
            <button aria-expanded={showWhy} onClick={() => setShowWhy(value => !value)} className="px-2 py-2 text-[12px] font-semibold text-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500">Why this suggestion?</button>
          </div>}
          {showWhy && suggestion && <div className="mt-3 border-t border-violet-200 pt-3 text-[11px] leading-relaxed text-slate-600"><p><b>Confidence reason:</b> {suggestion.confidenceReason}</p><p><b>Signals:</b> {suggestion.signals.join(', ') || 'No decisive wording signal.'}</p><p><b>Assumptions:</b> {suggestion.assumptions.join(' ') || 'None.'}</p><p><b>Missing:</b> {suggestion.missingInformation.join('; ')}.</p>{suggestion.alternative && <p><b>Alternative:</b> {suggestion.alternative}</p>}</div>}
        </section>

        <div id="methodology-options" tabIndex={-1} role="radiogroup" aria-label="Confirmed research approach" className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {METHODOLOGY_TIER1.map(opt => (
            <button
              key={opt.value}
              role="radio"
              aria-checked={tier1 === opt.value}
              onClick={() => applyTier1(opt.value)}
              className={cn(
                'text-left p-4 rounded-xl border transition-all',
                tier1 === opt.value
                  ? 'border-slate-800 bg-slate-50 ring-2 ring-slate-100'
                  : 'border-slate-200 hover:border-slate-300',
              )}
            >
              <p className="text-[13px] font-semibold text-slate-800 mb-1">{opt.value}</p>
              <p className="text-[11px] text-slate-500 leading-relaxed">{opt.description}</p>
            </button>
          ))}
        </div>

        {!tier1 && (
          <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-[12px] text-amber-700">
              Required — Chapter 5 sections that depend on methodology can't be generated until
              this is set.
            </p>
          </div>
        )}

        {tier1 && (
          <div className="mb-2">
            <p className="text-[13px] font-semibold text-slate-700 mb-1">
              Refine further <span className="text-slate-400 font-normal">(optional)</span>
            </p>
            <p className="text-[12px] text-slate-500 mb-3">
              Narrows chapter wording further — e.g. experimental vs. correlational designs use
              different variable framing. Skip if you're not sure yet.
            </p>
            <div className="flex flex-wrap gap-2">
              {METHODOLOGY_TIER2[tier1].map(sub => (
                <button
                  key={sub}
                  onClick={() => applyTier2(sub)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all',
                    tier2 === sub
                      ? 'border-slate-800 bg-slate-800 text-white'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300',
                  )}
                >
                  {sub}
                </button>
              ))}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <MethodologyDetailSelect label="Time frame" value={project.sectionContent['methodology-time-frame'] ?? ''} options={METHODOLOGY_TIME_FRAMES} onChange={value => saveDetail('methodology-time-frame', value)} />
              <MethodologyDetailSelect label="Data collection" value={project.sectionContent['methodology-data-collection'] ?? ''} options={METHODOLOGY_COLLECTION} onChange={value => saveDetail('methodology-data-collection', value)} />
              <MethodologyDetailSelect label="Analysis" value={project.sectionContent['methodology-analysis'] ?? ''} options={METHODOLOGY_ANALYSIS} onChange={value => saveDetail('methodology-analysis', value)} />
              {tier1 === 'Mixed Methods' && <MethodologyDetailSelect label="Mixed-methods design" value={project.sectionContent['methodology-mixed-design'] ?? ''} options={METHODOLOGY_MIXED_DESIGNS} onChange={value => saveDetail('methodology-mixed-design', value)} />}
            </div>
          </div>
        )}

        {tier1 && (
          <div className={cn(
            'mt-4 rounded-xl border p-4',
            project.confirmedMethodology
              ? project.confirmedMethodology.methodologyType === tier1
                ? 'border-emerald-200 bg-emerald-50'
                : 'border-amber-200 bg-amber-50'
              : 'border-amber-200 bg-amber-50',
          )}>
            {project.confirmedMethodology && project.confirmedMethodology.methodologyType === tier1 ? (
              <>
                <p className="text-[12px] font-semibold text-emerald-800">
                  ✓ Confirmed — {project.confirmedMethodology.methodologyType}
                  {project.confirmedMethodology.methodologySubType ? ` · ${project.confirmedMethodology.methodologySubType}` : ''}
                  {' '}(version {project.confirmedMethodology.version})
                </p>
                <p className="mt-1 text-[11px] text-emerald-700">
                  Confirmed {new Date(project.confirmedMethodology.confirmedAtUtc).toLocaleDateString()}.
                  Methodology-dependent chapters can now be generated and approved.
                </p>
              </>
            ) : (
              <>
                <p className="text-[12px] font-semibold text-amber-800">
                  {project.confirmedMethodology ? 'Methodology changed — re-confirmation required' : 'Not yet confirmed'}
                </p>
                <p className="mt-1 text-[11px] text-amber-700">
                  Methodology-dependent chapters (Hypotheses, Sampling, Study Variables, Quality
                  Assurance, and others) cannot be generated or approved until you confirm this
                  choice.
                </p>
              </>
            )}
            {confirmedWithoutCollection && (
              <p className="mt-2 text-[11px] font-medium text-amber-800">
                No data-collection method is confirmed. Chapters about data collection, data management and ethics
                cannot be approved until you choose one below and update the confirmed methodology.
              </p>
            )}
            {(methodologyTypeChanged || methodologyDetailsChanged) && !selectedCollection && (
              <p className="mt-2 text-[11px] text-amber-700">
                Choose a data-collection method (Data collection, above) to continue.
              </p>
            )}
            {(methodologyTypeChanged || methodologyDetailsChanged) && (
              <button
                onClick={() => void confirmMethodology()}
                disabled={confirming || !selectedCollection}
                title={!selectedCollection ? 'Choose a data-collection method first' : undefined}
                className="mt-3 rounded-lg bg-emerald-700 px-3 py-2 text-[12px] font-semibold text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
              >
                {confirming ? 'Confirming…' : methodologyTypeChanged ? 'Confirm Methodology' : 'Update confirmed methodology'}
              </button>
            )}
          </div>
        )}

        <div className="flex items-center gap-1.5 mt-6">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <p className="text-[12px] text-slate-400">Progress automatically saved</p>
        </div>
      </div>
    </StepCard>
  )
}

function MethodologyDetailSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="text-[12px] font-medium text-slate-700">{label}
    <select value={value} onChange={event => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500">
      <option value="">Not specified</option>
      {options.map(option => <option key={option} value={option}>{option}</option>)}
    </select>
  </label>
}

// ── Generic Section Step ──────────────────────────────────────────────────────

function SectionStep({ project, stepId }: {
  project: ResearchProject
  stepId:  string
}) {
  const { setContent } = useResearchStore()
  const [generating, setGenerating] = useState(false)
  const meta    = SECTION_PROMPTS[stepId]
  const content = project.sectionContent[stepId] ?? ''

  // Wizard generation is a single blocking request (no Hangfire job / poll behind it), so unlike
  // DocumentSurface's isStalled it can't watch a server-side status flip — it just times a local
  // clock against the same 3-minute threshold so the student isn't left staring at a spinner with
  // zero feedback on what's normally a much longer-than-usual wait.
  const [isStalled, setIsStalled] = useState(false)
  const generatingSinceRef = useRef<number | null>(null)

  useEffect(() => {
    if (!generating) {
      generatingSinceRef.current = null
      setIsStalled(false)
      return
    }
    generatingSinceRef.current = Date.now()
    setIsStalled(false)

    const STALL_MS = 3 * 60_000
    const interval = setInterval(() => {
      setIsStalled(!!generatingSinceRef.current && Date.now() - generatingSinceRef.current > STALL_MS)
    }, 5000)
    return () => clearInterval(interval)
  }, [generating])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const content = await researchApi.generateWizardContent(project.id, stepId)
      setContent(project.id, stepId, content)
      toast.success(`${meta?.heading ?? stepId} generated`)
    } catch (err) {
      const status = (err as { response?: { status?: number } } | null)?.response?.status
      toast.error(
        status === 504
          ? 'Generation timed out — please try again.'
          : 'Generation failed — check the server is running.',
      )
    } finally {
      setGenerating(false)
    }
  }

  return (
    <StepCard>
      <div className="p-8">
        <div className="bg-sky-50/70 border border-sky-100 rounded-xl p-4 mb-6 flex gap-3">
          <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center shrink-0">
            <BookOpen size={15} className="text-sky-600" />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-slate-800">{meta?.heading ?? stepId}</p>
            <p className="text-[12px] text-slate-500 mt-0.5 leading-relaxed">{meta?.prompt ?? 'Write the content for this section.'}</p>
          </div>
        </div>

        <div className="flex items-center justify-between mb-2">
          <label className="text-[13px] font-semibold text-slate-700">{meta?.heading ?? stepId}</label>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-[12px] font-medium transition-colors disabled:opacity-60"
          >
            {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {generating ? 'Generating…' : 'Generate with AI'}
          </button>
        </div>

        {generating && isStalled && (
          <p className="text-[12px] text-amber-600 mb-2">
            This is taking longer than usual. It should recover automatically within a
            few minutes — no need to leave this page.
          </p>
        )}

        <textarea
          rows={12}
          value={content}
          onChange={e => setContent(project.id, stepId, e.target.value)}
          placeholder={`Write your ${meta?.heading ?? stepId} here, or click "Generate with AI" to auto-draft…`}
          className="w-full bg-white border border-slate-200 rounded-xl p-4 text-[13px] text-slate-700 outline-none focus:border-slate-400 resize-none transition-all placeholder-slate-400 leading-relaxed"
        />
        <p className="text-[11px] text-slate-400 mt-1.5 text-right">
          {content.trim().split(/\s+/).filter(Boolean).length} words
        </p>
      </div>
    </StepCard>
  )
}

// ── Literature Gathering Step ─────────────────────────────────────────────────

type LitMode = 'documents' | 'web' | 'hybrid'

function LiteratureStep({
  project,
  onStartWriting,
}: {
  project: ResearchProject
  onStartWriting?: () => void
}) {
  const { setContent, updateProject, syncProject } = useResearchStore()
  const { documents, folders } = useLibraryStore()

  // AI Thesis's creation modal used to stash the source type under this
  // sectionContent key before project.gatherMode existed — still honoured
  // once here as a one-time migration fallback for projects created before
  // gatherMode was added (which all got backfilled to the "documents" default).
  const initialMode = (project.sectionContent['sourceTypePreference'] as LitMode) || project.gatherMode || 'documents'
  const [mode,           setMode]          = useState<LitMode>(initialMode)
  const [selectedFolder, setSelectedFolder] = useState<string>('all')
  // Hydrated from the real persisted field — previously this always started
  // empty on mount even when documents had already been picked, so reloading
  // made every checkbox appear unchecked despite the selection still existing
  // in the free-text literature list below.
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set(project.selectedLibraryDocumentIds ?? []))
  const [folderOpen,     setFolderOpen]    = useState(false)
  const [importing,      setImporting]     = useState(false)

  const handleModeChange = (m: LitMode) => {
    setMode(m)
    updateProject(project.id, { gatherMode: m })
    syncProject(project.id).catch(() => toast.error('Could not save your gathering mode.'))
  }

  const webVal = project.sectionContent['literature'] ?? ''

  const handleImportCsv = async () => {
    setImporting(true)
    try {
      const result = await researchApi.importLiteratureCsv(project.id, webVal)
      toast.success(
        result.imported > 0
          ? `${result.imported} reference${result.imported === 1 ? '' : 's'} imported${result.skipped > 0 ? ` (${result.skipped} already added)` : ''}`
          : 'No new references found to import.',
      )
    } catch (err) {
      const message = err instanceof Error ? err.message
        : (err as { message?: string } | undefined)?.message
      toast.error(message ?? 'Could not import this list — check it has a Title column.')
    } finally {
      setImporting(false)
    }
  }

  // Docs filtered by selected folder
  const filteredDocs = selectedFolder === 'all'
    ? documents
    : documents.filter(d => d.folderId === selectedFolder)

  const selectedFolder_ = folders.find(f => f.id === selectedFolder)

  const toggleDoc = (docId: string, docTitle: string) => {
    const next = new Set(selectedDocIds)
    let literatureText: string
    if (next.has(docId)) {
      next.delete(docId)
      literatureText = webVal.split('\n').filter(l => l.trim() !== `[Library] ${docTitle}`).join('\n')
    } else {
      next.add(docId)
      const entry = `[Library] ${docTitle}`
      const existing = webVal.trim()
      literatureText = existing ? `${existing}\n${entry}` : entry
    }
    setSelectedDocIds(next)
    setContent(project.id, 'literature', literatureText)
    // Persists the actual id selection (previously only this derived free-text
    // list survived a reload, not the checkbox state itself — see selectedDocIds above).
    updateProject(project.id, { selectedLibraryDocumentIds: Array.from(next) })
    syncProject(project.id).catch(() => toast.error('Could not save your document selection.'))
  }

  const MODES: { id: LitMode; label: string; icon: React.ElementType }[] = [
    { id: 'documents', label: 'My Documents', icon: FolderOpen },
    { id: 'web',       label: 'Web',          icon: Globe      },
    { id: 'hybrid',    label: 'Hybrid',       icon: Layers     },
  ]

  const DocsBrowser = () => (
    <div>
      {/* Folder selector */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative">
          <button
            onClick={() => setFolderOpen(v => !v)}
            className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 text-[12px] text-slate-700 bg-white hover:border-slate-300 transition-colors"
          >
            <FolderOpen size={13} className="text-slate-400" />
            {selectedFolder === 'all' ? 'All folders' : (selectedFolder_?.name ?? 'Folder')}
            <ChevronDown size={12} className={cn('text-slate-400 transition-transform', folderOpen && 'rotate-180')} />
          </button>
          {folderOpen && (
            <div className="absolute z-20 top-full mt-1 left-0 min-w-[160px] bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
              <button
                onClick={() => { setSelectedFolder('all'); setFolderOpen(false) }}
                className={cn('w-full text-left px-3 py-2 text-[12px] hover:bg-slate-50 transition-colors', selectedFolder === 'all' && 'font-semibold text-orange-500')}
              >
                All folders
              </button>
              {folders.map(f => (
                <button
                  key={f.id}
                  onClick={() => { setSelectedFolder(f.id); setFolderOpen(false) }}
                  className={cn('w-full text-left px-3 py-2 text-[12px] hover:bg-slate-50 transition-colors', selectedFolder === f.id && 'font-semibold text-orange-500')}
                >
                  {f.name}
                </button>
              ))}
            </div>
          )}
        </div>
        {selectedDocIds.size > 0 && (
          <span className="text-[11px] font-semibold bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
            {selectedDocIds.size} selected
          </span>
        )}
      </div>

      {/* Document list */}
      {filteredDocs.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
          <FolderOpen size={28} className="text-slate-300 mx-auto mb-2" />
          <p className="text-[13px] font-medium text-slate-500 mb-1">No documents yet</p>
          <p className="text-[12px] text-slate-400">Upload PDFs or documents in My Library, then come back to select them.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {filteredDocs.map(doc => {
            const checked = selectedDocIds.has(doc.id)
            const folder  = folders.find(f => f.id === doc.folderId)
            return (
              <button
                key={doc.id}
                onClick={() => toggleDoc(doc.id, doc.title)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all',
                  checked
                    ? 'border-orange-400 bg-orange-50'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                )}
              >
                <div className={cn(
                  'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                  checked ? 'bg-orange-500 border-orange-500' : 'border-slate-300',
                )}>
                  {checked && <Check size={10} className="text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-slate-800 truncate">{doc.title}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {doc.isPdf || doc.type === 'pdf' ? 'PDF' : doc.type?.toUpperCase()}
                    {folder ? ` · ${folder.name}` : ''}
                  </p>
                </div>
                {checked && <CheckCircle2 size={14} className="text-orange-500 shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )

  const WebInput = () => (
    <div>
      <label className="block text-[13px] font-semibold text-slate-700 mb-1">Paste references, DOIs, or URLs</label>
      <p className="text-[12px] text-slate-500 mb-3">One entry per line — DOIs, PubMed URLs, or full reference strings.</p>
      <textarea
        rows={8}
        value={webVal}
        onChange={e => setContent(project.id, 'literature', e.target.value)}
        placeholder={'10.1016/j.example.2023.001\nhttps://pubmed.ncbi.nlm.nih.gov/...\nSmith, J. (2023). Title. Journal, 12(3), 45–67.'}
        className="w-full bg-white border border-slate-200 rounded-xl p-4 text-[12px] text-slate-700 font-mono outline-none focus:border-slate-400 resize-none transition-all placeholder-slate-400"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-[11px] text-slate-400">
          Pasted a CSV export instead (e.g. from Consensus)? Import it as real citations so
          they're actually cited when sections are generated.
        </p>
        <button
          onClick={handleImportCsv}
          disabled={importing || !webVal.trim()}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[12px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {importing ? <><Loader2 size={12} className="animate-spin" /> Importing…</> : 'Import as citations'}
        </button>
      </div>
    </div>
  )

  return (
    <StepCard className="max-w-3xl">
      <div className="p-8">
        {/* Header */}
        <div className="bg-sky-50/70 border border-sky-100 rounded-xl p-4 mb-6 flex gap-3">
          <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center shrink-0">
            <BookOpen size={15} className="text-sky-600" />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-slate-800">Literature Gathering</p>
            <p className="text-[12px] text-slate-500 mt-0.5">
              Select documents from your library, paste web references, or use both together.
            </p>
          </div>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl">
          {MODES.map(m => (
            <button
              key={m.id}
              onClick={() => handleModeChange(m.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-semibold transition-all',
                mode === m.id
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              <m.icon size={13} /> {m.label}
            </button>
          ))}
        </div>

        {/* Panel content */}
        {mode === 'documents' && <DocsBrowser />}
        {mode === 'web'       && <WebInput />}
        {mode === 'hybrid'    && (
          <div className="space-y-6">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">From My Library</p>
              <DocsBrowser />
            </div>
            <div className="border-t border-slate-100 pt-6">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">From Web / DOI</p>
              <WebInput />
            </div>
          </div>
        )}

        {/* Summary of gathered sources */}
        {webVal.trim() && (
          <div className="mt-5 p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              {webVal.trim().split('\n').filter(Boolean).length} source{webVal.trim().split('\n').filter(Boolean).length !== 1 ? 's' : ''} gathered
            </p>
            <p className="text-[11px] text-slate-400">These will be used when generating your literature review and references section.</p>
          </div>
        )}

        {/* Start writing CTA */}
        {onStartWriting && (
          <div className="mt-6 pt-6 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-slate-800">Ready to start writing?</p>
                <p className="text-[12px] text-slate-400 mt-0.5">Switch to the Chapter Writer to generate each section with AI.</p>
              </div>
              <button
                onClick={onStartWriting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold shadow-md shadow-orange-100 transition-all"
              >
                <PenLine size={14} /> Start Writing Chapters
              </button>
            </div>
          </div>
        )}
      </div>
    </StepCard>
  )
}

// ── References Step ───────────────────────────────────────────────────────────

function ReferencesStep({ project }: { project: ResearchProject }) {
  // dedupeSections — see its doc comment; a duplicate row for a code would otherwise let
  // Object.fromEntries/find silently resolve to whichever duplicate happens to win.
  const sections        = dedupeSections(useResearchStore(s => s.sections[project.id] ?? EMPTY_SECTIONS))
  const [compiled, setCompiled]   = useState<string>('')
  const [compiling, setCompiling] = useState(false)
  const [copied, setCopied]       = useState(false)

  // Parse numbered entries out of the compiled master bibliography string
  const entries = compiled
    .split('\n')
    .filter(l => /^\d+\.\s/.test(l.trim()))
    .map(l => l.trim())

  const draftedCount = sections.filter(s => s.status !== 'NotStarted' && s.status !== 'Generating').length

  const handleCompile = async () => {
    setCompiling(true)
    try {
      const result = await researchApi.compileBibliography(project.id)
      setCompiled(result)
    } catch {
      toast.error('Failed to compile bibliography. Please try again.')
    } finally {
      setCompiling(false)
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(entries.join('\n\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <StepCard>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-[16px] font-bold text-slate-800">Master Bibliography</h2>
            <p className="text-[12px] text-slate-400 mt-0.5">
              {entries.length > 0
                ? `${entries.length} unique source${entries.length !== 1 ? 's' : ''} · compiled from ${draftedCount} section${draftedCount !== 1 ? 's' : ''}`
                : `${draftedCount} section${draftedCount !== 1 ? 's' : ''} available to scan`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {entries.length > 0 && (
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-[12px] text-slate-600 hover:bg-slate-50 transition-colors"
              >
                {copied ? <CheckCircle2 size={13} className="text-emerald-500" /> : <Copy size={13} />}
                {copied ? 'Copied' : 'Copy all'}
              </button>
            )}
            <span className="text-[11px] bg-[#ede9fe] text-[#7c3aed] px-2.5 py-1 rounded-full font-medium">
              {CITATION_LABELS[project.citationStyle]}
            </span>
          </div>
        </div>

        {/* Compile CTA */}
        {!compiled && (
          <div className="mb-6 p-5 rounded-xl border border-[#ede9fe] bg-[#faf5ff]">
            <div className="flex items-start gap-3">
              <BookMarked size={18} className="text-[#7c3aed] shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-slate-800 mb-1">Compile Master Bibliography</p>
                <p className="text-[12px] text-slate-500 leading-relaxed">
                  Scans all {draftedCount} generated section{draftedCount !== 1 ? 's' : ''}, extracts every citation,
                  removes duplicates, and returns a single alphabetically-sorted reference list in {CITATION_LABELS[project.citationStyle]} style.
                </p>
              </div>
            </div>
            <button
              onClick={handleCompile}
              disabled={compiling || draftedCount === 0}
              className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-50 disabled:cursor-not-allowed text-white text-[13px] font-semibold transition-colors"
            >
              {compiling
                ? <><Loader2 size={14} className="animate-spin" /> Compiling bibliography…</>
                : <><Sparkles size={14} /> Compile Master Bibliography</>}
            </button>
            {draftedCount === 0 && (
              <p className="text-[11px] text-slate-400 text-center mt-2">
                Generate at least one section first to compile references.
              </p>
            )}
          </div>
        )}

        {/* Results */}
        {entries.length > 0 && (
          <ol className="space-y-4">
            {entries.map((entry, i) => {
              const text    = entry.replace(/^\d+\.\s*/, '')
              const doiMatch = text.match(/https?:\/\/doi\.org\/\S+/)
              const doiUrl  = doiMatch?.[0]
              const display = doiUrl ? text.replace(doiUrl, '').trimEnd() : text
              return (
                <li key={i} className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-[#ede9fe] text-[#7c3aed] text-[11px] font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-slate-700 leading-relaxed">{display}</p>
                    {doiUrl && (
                      <a
                        href={doiUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-[#7c3aed] hover:underline mt-0.5 inline-block break-all"
                      >
                        {doiUrl}
                      </a>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        )}

        {/* Re-compile button after first compile */}
        {compiled && (
          <button
            onClick={handleCompile}
            disabled={compiling}
            className="mt-6 flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-[#7c3aed] transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={compiling ? 'animate-spin' : ''} />
            {compiling ? 'Re-compiling…' : 'Re-compile'}
          </button>
        )}
      </div>
    </StepCard>
  )
}

// ── Full Document Step ────────────────────────────────────────────────────────

function FullDocumentStep({ project }: { project: ResearchProject }) {
  // dedupeSections — see its doc comment; the compiled document must never silently
  // pick up an empty/stale duplicate row instead of the real generated content.
  const dbSections  = dedupeSections(useResearchStore(s => s.sections[project.id] ?? EMPTY_SECTIONS))
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [copied, setCopied]     = useState(false)

  // Build a lookup: sectionCode → content from the AI-generated sections store
  const dbContentMap = Object.fromEntries(dbSections.map(s => [s.code, s.content]))

  const getContent = (step: typeof STEPS[0]): string => {
    if (step.sectionKey) return dbContentMap[step.sectionKey] ?? ''
    // Wizard/setup steps: each stores its data differently
    switch (step.id) {
      case 'research-topic': {
        const topic = project.selectedTopic?.title ?? project.fieldInterest ?? ''
        const desc  = project.selectedTopic?.description ?? ''
        return [topic, desc].filter(Boolean).join('\n')
      }
      case 'research-title':
        return project.title ?? ''
      case 'location': {
        const area = project.sectionContent['location'] ?? ''
        const pop  = project.sectionContent['location-population'] ?? ''
        return [area && `Study area: ${area}`, pop && `Target population: ${pop}`].filter(Boolean).join('\n')
      }
      case 'methodology-type':
        return [project.methodologyType, project.methodologySubType].filter(Boolean).join(' — ')
      case 'literature':
        return project.sectionContent['literature'] ?? ''
      default:
        return project.sectionContent[step.id] ?? ''
    }
  }

  const docSteps    = STEPS.filter(s => s.group !== 'output')
  const filledCount = docSteps.filter(s => getContent(s).trim()).length

  const toggleExpand = (id: string) =>
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  const handleCopyAll = async () => {
    const lines: string[] = [project.title || 'Research Proposal', '']
    for (const step of docSteps) {
      const content = getContent(step).trim()
      if (content) {
        lines.push(`## ${step.label}`, '', content, '')
      }
    }
    await navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <StepCard>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="text-[17px] font-bold text-slate-900 leading-snug">{project.title}</h2>
            <p className="text-[12px] text-slate-400 mt-1">
              {filledCount} of {docSteps.length} sections completed
            </p>
          </div>
          <button
            onClick={handleCopyAll}
            disabled={filledCount === 0}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-[12px] text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {copied ? <CheckCircle2 size={13} className="text-emerald-500" /> : <Copy size={13} />}
            {copied ? 'Copied' : 'Copy document'}
          </button>
        </div>

        {/* Section list */}
        <div className="space-y-1">
          {docSteps.map(step => {
            const content  = getContent(step).trim()
            const isOpen   = expanded[step.id] ?? false
            const PREVIEW  = 4
            const lines    = content.split('\n').filter(Boolean)
            const preview  = lines.slice(0, PREVIEW).join('\n')
            const hasMore  = lines.length > PREVIEW

            return (
              <div key={step.id} className="rounded-xl border border-slate-100 overflow-hidden">
                {/* Section header row */}
                <button
                  onClick={() => content && toggleExpand(step.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                    content ? 'hover:bg-slate-50 cursor-pointer' : 'cursor-default',
                  )}
                >
                  {content
                    ? <CheckCircle2 size={15} className="shrink-0 text-emerald-500" />
                    : <Circle size={15} className="shrink-0 text-slate-300" />}
                  <span className={cn(
                    'flex-1 text-[13px] font-semibold',
                    content ? 'text-slate-800' : 'text-slate-400',
                  )}>
                    {step.label}
                  </span>
                  {content && (
                    <span className="text-[11px] text-slate-400 shrink-0">
                      {isOpen ? 'Collapse' : `${lines.length} line${lines.length !== 1 ? 's' : ''}`}
                    </span>
                  )}
                </button>

                {/* Content area */}
                {content && (
                  <div className="px-4 pb-4">
                    <p className="text-[12.5px] text-slate-600 leading-relaxed whitespace-pre-wrap">
                      {isOpen ? content : preview}
                    </p>
                    {hasMore && (
                      <button
                        onClick={() => toggleExpand(step.id)}
                        className="mt-2 text-[11px] text-[#7c3aed] hover:underline"
                      >
                        {isOpen ? 'Show less' : `Show ${lines.length - PREVIEW} more lines…`}
                      </button>
                    )}
                  </div>
                )}

                {!content && (
                  <p className="px-4 pb-3 text-[12px] text-slate-400 italic">Section not yet completed.</p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </StepCard>
  )
}

// ── Download Step ─────────────────────────────────────────────────────────────

function DownloadStep({ project }: { project: ResearchProject }) {
  const { exportDocx, syncProject } = useResearchStore()
  const [, setSearchParams] = useSearchParams()
  // dedupeSections — see its doc comment; the downloaded .docx must never silently
  // pick up an empty/stale duplicate row instead of the real generated content.
  const dbSections  = dedupeSections(useResearchStore(s => s.sections[project.id] ?? EMPTY_SECTIONS))
  const [downloading, setDownloading] = useState<'docx' | 'txt' | null>(null)
  const [blockedSections, setBlockedSections] = useState<Array<{ code: string; label: string; stepIdx: number; reason: string }> | null>(null)
  // "Fix issues and download" owns the issue list. The older per-section scan below only shows if that list could not be loaded.
  const [issuePanelFailed, setIssuePanelFailed] = useState(false)
  const [issuePanelBusy, setIssuePanelBusy] = useState(false)
  const stepIndexFor = (key: string) => STEPS.findIndex(s => s.id === key)

  const showAcknowledgedExportError = (err: unknown, toastId: string) => {
    const apiError = err as ApiError | undefined
    const message = (() => {
      switch (apiError?.code) {
        case 'FACT_CONFLICT':
          return 'Citation issues were acknowledged, but export is still blocked by an unresolved fact conflict. Resolve or dismiss the conflict in the affected section, then try again.'
        case 'ELIGIBILITY_CONTRADICTION':
          return 'Citation issues were acknowledged, but Study Population and Exclusion Criteria still conflict. Resolve or acknowledge that eligibility issue before exporting.'
        case 'EXPORT_PLACEHOLDER_LEAK':
          return 'Export is blocked because editor placeholder text remains in the proposal. Remove the placeholder and try again.'
        case 'PROSE_BODY_MISSING':
          return 'Export is blocked because a required section has no prose body.'
        case 'UNRESOLVED_CITATION_GAP':
        case 'CITATION_INTEGRITY_BLOCKED':
          return 'The server did not accept the citation acknowledgement. Refresh the page and try once more; if it persists, review the newly reported citation issues.'
        default:
          return apiError?.message || 'Export failed after acknowledging citation issues.'
      }
    })()
    toast.error(message, { id: toastId, duration: 9000 })
  }

  const handleDownloadAnyway = async (_blocked: Array<{ code: string }>) => {
    setDownloading('docx')
    const toastId = toast.loading('Acknowledging issues and building .docx…')
    try {
      await syncProject(project.id)
      await exportDocx(project.id, true)
      toast.success('Download started!', { id: toastId })
      setBlockedSections(null)
    } catch (err) {
      showAcknowledgedExportError(err, toastId)
    } finally {
      setDownloading(null)
    }
  }

  const dbContentMap = Object.fromEntries(dbSections.map(s => [s.code, s.content]))
  const getContent = (step: typeof STEPS[0]): string => {
    if (step.sectionKey) return dbContentMap[step.sectionKey] ?? ''
    switch (step.id) {
      case 'research-topic': {
        const topic = project.selectedTopic?.title ?? project.fieldInterest ?? ''
        const desc  = project.selectedTopic?.description ?? ''
        return [topic, desc].filter(Boolean).join('\n')
      }
      case 'research-title': return project.title ?? ''
      case 'location': {
        const area = project.sectionContent['location'] ?? ''
        const pop  = project.sectionContent['location-population'] ?? ''
        return [area && `Study area: ${area}`, pop && `Target population: ${pop}`].filter(Boolean).join('\n')
      }
      case 'methodology-type':
        return [project.methodologyType, project.methodologySubType].filter(Boolean).join(' — ')
      case 'literature': return project.sectionContent['literature'] ?? ''
      default:           return project.sectionContent[step.id] ?? ''
    }
  }

  const docSteps    = STEPS.filter(s => s.group !== 'output')
  const filledCount = docSteps.filter(s => getContent(s).trim()).length

  const scanBlockedSections = async () => {
    const chapterSteps = STEPS.filter(s => s.type === 'chapter')
    const issues: Array<{ code: string; label: string; stepIdx: number; reason: string }> = []

    // 1. In-memory check for [CITATION NEEDED]
    for (const step of chapterSteps) {
      const sec = dbSections.find(s => s.code === step.id)
      if (sec?.content?.includes('[CITATION NEEDED]')) {
        const stepIdx = STEPS.findIndex(s => s.id === step.id)
        issues.push({
          code: step.id,
          label: step.label,
          stepIdx,
          reason: 'Contains an unresolved "[CITATION NEEDED]" gap',
        })
      }
    }

    // 2. Fetch citation flags from backend for all chapter sections in parallel
    const flagResults = await Promise.all(
      chapterSteps.map(async (step) => {
        const flags = await researchApi.getCitationFlags(project.id, step.id).catch(() => [])
        const openFlags = flags.filter(f =>
          f.status === 'Open' &&
          f.mismatchTypes.some(m => m === 'ClaimContentMismatch' || m === 'ImplausibleYear' || m === 'UnresolvedCitation'
            || m === 'GeographicMismatch' || m === 'GeneralizationBeyondSample' || m === 'PopulationScopeViolation')
        )
        if (openFlags.length > 0) {
          const stepIdx = STEPS.findIndex(s => s.id === step.id)
          return {
            code: step.id,
            label: step.label,
            stepIdx,
            reason: `${openFlags.length} flagged citation issue${openFlags.length > 1 ? 's' : ''} (unsupported claim or year)`,
          }
        }
        return null
      })
    )

    for (const item of flagResults) {
      if (item && !issues.some(i => i.code === item.code)) {
        issues.push(item)
      }
    }

    setBlockedSections(issues)
    return issues
  }

  // Automatically scan on mount so any blocked sections are identified immediately
  useEffect(() => {
    scanBlockedSections()
  }, [project.id])

  const handleDocx = async () => {
    setDownloading('docx')
    const toastId = toast.loading('Saving and building .docx…')
    try {
      await syncProject(project.id)
      await exportDocx(project.id)
      toast.success('Download started.', { id: toastId })
    } catch (err) {
      toast.dismiss(toastId)
      const errorCode = (err as ApiError | undefined)?.code
      if (errorCode === 'UNRESOLVED_CITATION_GAP' || errorCode === 'CITATION_INTEGRITY_BLOCKED') {
        const found = await scanBlockedSections()
        const title = errorCode === 'UNRESOLVED_CITATION_GAP'
          ? 'Export Blocked: Unresolved Citation Gap'
          : 'Export Blocked: Flagged Citation'

        toast((t) => (
          <div className="flex flex-col gap-2 text-[13px] max-w-md">
            <span className="font-semibold text-red-700">{title}</span>
            <span>
              {found.length > 0
                ? `Issue found in ${found.map(f => f.label).join(', ')}.`
                : 'One or more sections have flagged citations or unresolved gaps.'}
            </span>
            <div className="flex flex-wrap gap-2 mt-1 items-center">
              {found.length > 0 && (
                <button
                  onClick={() => {
                    toast.dismiss(t.id)
                    handleDownloadAnyway(found)
                  }}
                  className="px-2.5 py-1 rounded bg-amber-600 text-white font-medium text-[11px] hover:bg-amber-700 transition-colors"
                >
                  Download Anyway
                </button>
              )}
              {found.length > 0 ? (
                found.map(f => (
                  <button
                    key={f.code}
                    onClick={() => {
                      toast.dismiss(t.id)
                      setSearchParams({ step: String(f.stepIdx) })
                    }}
                    className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 font-medium text-[11px] hover:bg-slate-200 transition-colors"
                  >
                    Jump to {f.code}
                  </button>
                ))
              ) : (
                <button
                  onClick={() => {
                    toast.dismiss(t.id)
                    const firstChapterIdx = STEPS.findIndex(s => s.type === 'chapter')
                    if (firstChapterIdx !== -1) setSearchParams({ step: String(firstChapterIdx) })
                  }}
                  className="font-semibold text-[#7c3aed] hover:text-[#6d28d9]"
                >
                  Review Sections
                </button>
              )}
              <button onClick={() => toast.dismiss(t.id)} className="text-slate-500 hover:text-slate-700 text-[11px] ml-auto">
                Dismiss
              </button>
            </div>
          </div>
        ), { duration: 12000 })
      } else {
        toast.error('Export failed — check the server is running.')
      }
    } finally {
      setDownloading(null)
    }
  }

  const handleTxt = () => {
    setDownloading('txt')
    try {
      const lines: string[] = [
        project.title || 'Research Proposal',
        '='.repeat(60),
        '',
      ]
      for (const step of docSteps) {
        const content = getContent(step)
        if (content?.trim()) {
          lines.push(step.label.toUpperCase())
          lines.push('-'.repeat(40))
          lines.push(content.trim())
          lines.push('')
        }
      }
      const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `research-proposal-${new Date().toISOString().slice(0, 10)}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Text file downloaded.')
    } catch {
      toast.error('Could not create text file.')
    } finally {
      setDownloading(null)
    }
  }

  return (
    <StepCard>
      <div className="p-8">
        <div className="flex items-start gap-4 mb-6">
          <div>
            <h2 className="text-[16px] font-bold text-slate-800 mb-1">Download Your Document</h2>
            <p className="text-[13px] text-slate-500">
              Export your completed research proposal.
              {filledCount > 0 && (
                <span className="ml-2 text-emerald-600 font-medium">{filledCount} section{filledCount !== 1 ? 's' : ''} ready.</span>
              )}
            </p>
          </div>
        </div>

        {!issuePanelFailed && (
          <FixIssuesPanel
            projectId={project.id}
            canJump={key => stepIndexFor(key) >= 0}
            onJump={key => setSearchParams({ step: String(stepIndexFor(key)) })}
            prepare={() => syncProject(project.id)}
            download={() => exportDocx(project.id, true)}
            onRepaired={async () => {
              const store = useResearchStore.getState()
              await Promise.all([store.loadSections(project.id), store.loadProject(project.id)])
            }}
            onUnavailable={() => setIssuePanelFailed(true)}
            onBusyChange={setIssuePanelBusy}
          />
        )}

        {issuePanelFailed && blockedSections && blockedSections.length > 0 && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[13px] flex flex-col gap-3">
            <div className="flex items-center gap-2 font-semibold text-amber-900">
              <AlertTriangle size={18} className="text-amber-600 shrink-0" />
              <span>Citation Warnings Found ({blockedSections.length})</span>
            </div>
            <p className="text-amber-800 leading-relaxed">
              The reference integrity check found citation issues in the following section{blockedSections.length > 1 ? 's' : ''}. You can still download the document, but these issues may need review before submission:
            </p>
            <div className="flex flex-col gap-2 bg-white/80 p-3 rounded-lg border border-amber-200/80">
              {blockedSections.map((sec) => (
                <div key={sec.code} className="flex items-center justify-between gap-3 text-[12.5px]">
                  <div>
                    {/* sec.label already carries the section code prefix (see proposalOutline.ts's
                        STEPS) for every chapter step scanBlockedSections can produce — prepending
                        sec.code again duplicated it, e.g. "3.1 3.1 Problem Statement". */}
                    <span className="font-semibold text-slate-800">{sec.label}</span>
                    <span className="text-amber-700 block text-[11px] font-medium">{sec.reason}</span>
                  </div>
                  <button
                    onClick={() => setSearchParams({ step: String(sec.stepIdx) })}
                    className="px-3 py-1 rounded bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-medium text-[11px] shrink-0 transition-colors shadow-sm"
                  >
                    Jump to {sec.code}
                  </button>
                </div>
              ))}
            </div>
            <p className="text-[11.5px] text-slate-600">
              <span className="font-semibold">Optional review:</span> Click <span className="font-medium text-[#7c3aed]">Jump to section</span> to fix or dismiss the citation warning. These warnings do not prevent download.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          {/* .docx */}
          <button
            onClick={handleDocx}
            disabled={!!downloading || issuePanelBusy}
            className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50 transition-all disabled:opacity-60 disabled:cursor-not-allowed bg-white"
          >
            {downloading === 'docx'
              ? <Loader2 size={32} className="animate-spin text-blue-400" />
              : <span className="text-3xl">📄</span>}
            <span className="text-[12px] text-slate-700 font-semibold text-center">Microsoft Word</span>
            <span className="text-[11px] text-slate-400">.docx</span>
            <span className="flex items-center gap-1 text-[11px] text-blue-500 font-medium">
              <Download size={11} /> {downloading === 'docx' ? 'Building…' : 'Download'}
            </span>
          </button>

          {/* PDF — not yet available */}
          <div
            title="PDF export is not yet available — download .docx and save as PDF in Word"
            className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed select-none"
          >
            <span className="text-3xl">📕</span>
            <span className="text-[12px] text-slate-500 font-semibold text-center">PDF Document</span>
            <span className="text-[11px] text-slate-400">.pdf</span>
            <span className="flex items-center gap-1 text-[11px] text-slate-400">
              Coming soon
            </span>
          </div>

          {/* .txt */}
          <button
            onClick={handleTxt}
            disabled={!!downloading}
            className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition-all disabled:opacity-60 disabled:cursor-not-allowed bg-white"
          >
            {downloading === 'txt'
              ? <Loader2 size={32} className="animate-spin text-slate-400" />
              : <span className="text-3xl">📝</span>}
            <span className="text-[12px] text-slate-700 font-semibold text-center">Plain Text</span>
            <span className="text-[11px] text-slate-400">.txt</span>
            <span className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
              <Download size={11} /> {downloading === 'txt' ? 'Building…' : 'Download'}
            </span>
          </button>

        </div>

        {filledCount === 0 && (
          <div className="mt-5 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-[12px] text-amber-700 font-medium">
              No sections have been written yet. Go back through the steps and generate or write each section before downloading.
            </p>
          </div>
        )}
      </div>
    </StepCard>
  )
}

// ── Step router ───────────────────────────────────────────────────────────────

function StepContent({ project, stepIdx, onNext, onStartWriting }: {
  project:        ResearchProject
  stepIdx:        number
  onNext:         () => void
  onStartWriting?: () => void
}) {
  const step = STEPS[stepIdx]
  if (!step) return null

  switch (step.id) {
    case 'research-topic': return <ResearchTopicStep project={project} onNext={onNext} />
    case 'research-title': return <ResearchTitleStep project={project} />
    case 'location':       return <LocationStep project={project} />
    case 'methodology-type': return <MethodologyTypeStep project={project} />
    case 'literature':     return <LiteratureStep project={project} onStartWriting={onStartWriting} />
    case 'references':     return <ReferencesStep project={project} />
    case 'full-document':  return <FullDocumentStep project={project} />
    case 'download':       return <DownloadStep project={project} />
    default:               return <SectionStep project={project} stepId={step.id} />
  }
}

// ── Status chip helper ────────────────────────────────────────────────────────

const STATUS_STYLES: Record<SectionStatus, string> = {
  NotStarted: 'bg-slate-100 text-slate-400',
  Generating: 'bg-amber-100 text-amber-600',
  Draft:      'bg-sky-100 text-sky-600',
  Edited:     'bg-violet-100 text-violet-600',
  Approved:   'bg-emerald-100 text-emerald-600',
}

const STATUS_LABELS: Record<SectionStatus, string> = {
  NotStarted: 'Not started',
  Generating: 'Generating…',
  Draft:      'Draft',
  Edited:     'Edited',
  Approved:   'Approved',
}

// ── Sprint 3: Hypothesis Editor ───────────────────────────────────────────────

function HypothesisEditor({
  projectId,
  section,
  methodologyType,
}: {
  projectId: string
  section:   ProjectSection | undefined
  methodologyType?: string
}) {
  const navigate = useNavigate()
  const {
    hypotheses: allHypotheses,
    loadHypotheses,
    generateHypotheses,
    updateHypothesis,
    generateHypothesisProse,
    approveSection,
    isGeneratingHypotheses,
  } = useResearchStore()

  const hypotheses = allHypotheses[projectId] ?? []
  const [editing,            setEditing]           = useState<string | null>(null)
  const [editForm,           setEditForm]          = useState<Partial<UpdateHypothesisPayload>>({})
  const [isGeneratingProse,  setIsGeneratingProse] = useState(false)
  const [isApproving,        setIsApproving]       = useState(false)
  const [loadingAI,          setLoadingAI]         = useState(false)
  const isQualitative = methodologyType?.trim().toLowerCase() === 'qualitative'

  useEffect(() => {
    if (isQualitative) return
    loadHypotheses(projectId).catch(() => {})
  }, [projectId, isQualitative])

  const handleGenerateAI = async (force = false) => {
    setLoadingAI(true)
    try {
      await generateHypotheses(projectId, force)
      toast.success('Hypotheses drafted — review and edit, then generate prose.')
    } catch (err) {
      // HYPOTHESIS_OUTCOME_DATA_LOSS (409) — regenerating always replaces every hypothesis, and
      // one or more here already carry a real, manually-recorded analysis outcome that would be
      // silently destroyed (hypotheses have no version history the way sections do). Same
      // override pattern as FACT_CONFLICT/UNRESOLVED_CITATION_GAP elsewhere in this file.
      const errorCode = (err as ApiError | undefined)?.code
      if (errorCode === 'HYPOTHESIS_OUTCOME_DATA_LOSS') {
        const affectedCount = ((err as ApiError)?.details as { affectedCount?: number } | undefined)?.affectedCount
        toast((t) => (
          <div className="flex flex-col gap-2 text-[13px]">
            <span>
              {affectedCount ? `${affectedCount} existing hypothesis${affectedCount === 1 ? '' : 'es'}` : 'One or more existing hypotheses'} already
              {' '}{affectedCount === 1 ? 'has' : 'have'} a recorded outcome from real analysis. Regenerating replaces all
              hypotheses and would discard that data — record it elsewhere first, or regenerate anyway.
            </span>
            <div className="flex gap-3">
              <button
                onClick={() => { toast.dismiss(t.id); handleGenerateAI(true) }}
                className="font-semibold text-amber-700 hover:text-amber-900"
              >
                Regenerate anyway
              </button>
              <button onClick={() => toast.dismiss(t.id)} className="text-slate-500 hover:text-slate-700">
                Cancel
              </button>
            </div>
          </div>
        ), { duration: 15000 })
        return
      }
      const message = (err as { message?: string } | undefined)?.message
      toast.error(message || 'Failed to generate hypotheses. Ensure sections 4.1 and 4.3 are complete.')
    } finally {
      setLoadingAI(false)
    }
  }

  const handleStartEdit = (h: ProjectHypothesis) => {
    setEditing(h.id)
    setEditForm({
      nullHypothesis:         h.nullHypothesis,
      alternativeHypothesis:  h.alternativeHypothesis,
      dependentVariable:      h.dependentVariable,
      independentVariable:    h.independentVariable,
      plannedStatisticalTest: h.plannedStatisticalTest,
      significanceLevel:      h.significanceLevel,
    })
  }

  const handleSaveEdit = async (h: ProjectHypothesis) => {
    try {
      await updateHypothesis(projectId, h.id, editForm)
      setEditing(null)
      toast.success(`H${h.number} saved.`)
    } catch {
      toast.error('Failed to save hypothesis.')
    }
  }

  const handleGenerateProse = async () => {
    setIsGeneratingProse(true)
    try {
      await generateHypothesisProse(projectId)
      toast.success('Section 4.4 prose generated.')
    } catch {
      toast.error('Failed to generate prose — ensure at least one hypothesis exists.')
    } finally {
      setIsGeneratingProse(false)
    }
  }

  const sectionStatus = section?.status ?? 'NotStarted'
  const hasProse = (section?.content ?? '').trim().length > 0
  const busy = isGeneratingHypotheses || loadingAI

  const handleApprove = async () => {
    if (!hasProse || sectionStatus === 'Approved') return
    setIsApproving(true)
    try {
      await approveSection(projectId, '4.4')
      toast.success('Section 4.4 approved.')
    } catch (err) {
      const message = (err as { message?: string } | undefined)?.message
      toast.error(message || 'Could not approve Section 4.4. Please try again.')
    } finally {
      setIsApproving(false)
    }
  }

  if (isQualitative) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="mt-0.5 shrink-0 text-violet-600" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[18px] font-bold text-slate-900">4.4 — Hypotheses</h2>
                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-violet-700 ring-1 ring-violet-200">
                  Not applicable
                </span>
              </div>
              <p className="mt-3 text-[13px] leading-6 text-slate-600">
                This project uses a qualitative design. Statistical hypotheses require measurable
                variables and a planned statistical test, so Section 4.4 is intentionally skipped.
                The study is guided by its research questions and Specific Objectives in Section 4.3.
              </p>
              {hasProse && (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                  Earlier 4.4 prose exists, but it is not applicable to this qualitative design and
                  should not be used as a statistical-hypotheses section.
                </p>
              )}
              <button
                type="button"
                onClick={() => navigate(`/app/research-agent/${projectId}?section=5.1`)}
                className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-[12px] font-semibold text-white hover:bg-violet-700"
              >
                Continue to Section 5.1 <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4 gap-4">
        <div>
          <h2 className="text-[18px] font-bold text-slate-900">4.4 — Hypotheses</h2>
          <p className="text-[12px] text-slate-500 mt-1">
            Generate AI drafts from sections 4.1 + 4.3, edit each hypothesis, then click "Generate Prose" to produce the academic section.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => handleGenerateAI()}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-[12px] font-medium transition-colors disabled:opacity-50"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            AI Draft
          </button>
          <button
            onClick={handleGenerateProse}
            disabled={hypotheses.length === 0 || isGeneratingProse || sectionStatus === 'Generating'}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-[12px] font-semibold transition-colors disabled:opacity-50 shadow-sm"
          >
            {isGeneratingProse || sectionStatus === 'Generating'
              ? <Loader2 size={12} className="animate-spin" />
              : <FileText size={12} />}
            Generate 4.4 Prose
          </button>
          <button
            onClick={handleApprove}
            disabled={!hasProse || isGeneratingProse || sectionStatus === 'Generating' || sectionStatus === 'Approved' || isApproving}
            title={!hasProse ? 'Generate the Section 4.4 prose before approving it' : undefined}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-semibold transition-colors disabled:opacity-50 shadow-sm"
          >
            {isApproving
              ? <Loader2 size={12} className="animate-spin" />
              : <CheckCircle2 size={12} />}
            {sectionStatus === 'Approved' ? 'Approved' : isApproving ? 'Approving…' : 'Approve'}
          </button>
        </div>
      </div>

      {/* Prose status */}
      {hasProse && (
        <div className="mb-4 flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
          <span className="text-[12px] text-emerald-700 font-medium flex-1">
            Section 4.4 prose generated
          </span>
          <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full', STATUS_STYLES[sectionStatus])}>
            {STATUS_LABELS[sectionStatus]}
          </span>
        </div>
      )}

      {/* Empty state */}
      {hypotheses.length === 0 && !busy && (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-xl">
          <FileText size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-[13px] font-medium text-slate-600 mb-1">No hypotheses yet</p>
          <p className="text-[12px] text-slate-400">
            Click <strong>AI Draft</strong> to generate H0/H1 pairs from your research questions and specific objectives.
          </p>
        </div>
      )}

      {/* Loading */}
      {busy && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 size={24} className="animate-spin text-orange-400" />
          <p className="text-[13px] text-slate-600">Drafting hypotheses from sections 4.1 and 4.3…</p>
        </div>
      )}

      {/* Hypothesis cards */}
      {hypotheses.length > 0 && !busy && (
        <div className="space-y-4">
          {hypotheses.map(h => (
            <div key={h.id} className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between bg-slate-50 px-4 py-2.5 border-b border-slate-200">
                <span className="text-[13px] font-bold text-slate-800">H{h.number}</span>
                {editing !== h.id && (
                  <button
                    onClick={() => handleStartEdit(h)}
                    className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    <Edit2 size={11} /> Edit
                  </button>
                )}
              </div>

              {editing === h.id ? (
                <div className="p-4 space-y-3">
                  {[
                    { key: 'nullHypothesis',        label: 'H0 — Null Hypothesis',        rows: 2 },
                    { key: 'alternativeHypothesis', label: 'H1 — Alternative Hypothesis', rows: 2 },
                  ].map(({ key, label, rows }) => (
                    <div key={key}>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</label>
                      <textarea
                        rows={rows}
                        value={(editForm as Record<string, string>)[key] ?? ''}
                        onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                        className="w-full bg-white border border-slate-200 rounded-lg p-3 text-[12px] text-slate-800 outline-none focus:border-orange-400 resize-none"
                      />
                    </div>
                  ))}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: 'dependentVariable',     label: 'Dependent Variable' },
                      { key: 'independentVariable',   label: 'Independent Variable' },
                      { key: 'plannedStatisticalTest', label: 'Statistical Test' },
                      { key: 'significanceLevel',     label: 'Significance Level (α)' },
                    ].map(({ key, label }) => (
                      <div key={key}>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</label>
                        <input
                          value={(editForm as Record<string, string>)[key] ?? ''}
                          onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[12px] text-slate-800 outline-none focus:border-orange-400"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => handleSaveEdit(h)}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[12px] font-medium">
                      <Check size={12} /> Save
                    </button>
                    <button onClick={() => setEditing(null)}
                      className="px-4 py-1.5 rounded-lg border border-slate-200 text-slate-500 text-[12px] hover:bg-slate-50">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 space-y-2">
                  <div className="bg-red-50 rounded-lg p-3">
                    <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-0.5">H0 — Null</p>
                    <p className="text-[12px] text-slate-700">{h.nullHypothesis}</p>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-3">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-0.5">H1 — Alternative</p>
                    <p className="text-[12px] text-slate-700">{h.alternativeHypothesis}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-slate-50 rounded-lg p-2.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Dependent Var.</p>
                      <p className="text-[12px] text-slate-700">{h.dependentVariable || '—'}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Independent Var.</p>
                      <p className="text-[12px] text-slate-700">{h.independentVariable || '—'}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Test · α</p>
                      <p className="text-[12px] text-slate-700">{h.plannedStatisticalTest || '—'}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">α = {h.significanceLevel}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Sprint 5: Thesis transition banner ───────────────────────────────────────

// ── Thesis Studio: methodology-aware audit gating the transition to thesis ───

const RUBRIC_PILLAR_LABELS: Record<keyof RubricScores, string> = {
  scope:                    'Scope',
  methodologicalAlignment:  'Methodological Alignment',
  writingClarity:           'Writing Clarity',
  citationRigor:            'Citation Rigor',
  limitationsMaturity:      'Limitations Maturity',
}

const RUBRIC_SCORE_STYLES: Record<string, string> = {
  weak:       'bg-red-100 text-red-700',
  developing: 'bg-amber-100 text-amber-700',
  strong:     'bg-emerald-100 text-emerald-700',
}

function ThesisAuditPanel({
  project,
  audit,
  isLoadingAudit,
  isTransitioning,
  onRunAudit,
  onAnswer,
  onTransition,
}: {
  project:         ResearchProject
  audit:           ThesisAuditResult | undefined
  isLoadingAudit:  boolean
  isTransitioning: boolean
  onRunAudit:      () => void
  onAnswer:        (questionKey: string, answer: string) => void
  onTransition:    () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [answers, setAnswers]   = useState<Record<number, string>>({})

  const handleOpen = () => {
    setExpanded(true)
    if (!audit) onRunAudit()
  }

  const methodologyUnresolved = !project.methodologyType
  const blockingQuestions = audit?.unlockCondition.blockingQuestions ?? []
  const readyToTransition = !!audit && blockingQuestions.length === 0

  const submitAnswer = (index: number) => {
    const answer = (answers[index] ?? '').trim()
    if (!answer) return
    const questionKey = methodologyUnresolved && index === 0 ? 'methodology_type' : `question_${index}`
    onAnswer(questionKey, answer)
    setAnswers(prev => ({ ...prev, [index]: '' }))
  }

  return (
    <div className="mx-6 mt-4 rounded-xl border border-violet-200 bg-violet-50">
      <button
        onClick={() => (expanded ? setExpanded(false) : handleOpen())}
        className="w-full flex items-start gap-3 px-4 py-3 text-left"
      >
        <GraduationCap size={18} className="text-violet-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-violet-800">
            {readyToTransition ? 'Audit complete — ready to transition to thesis.' : 'Ready for thesis? Run the readiness audit.'}
          </p>
          <p className="text-[11px] text-violet-700 mt-0.5">
            Methodology-aware audit of your chapters, facts, and pinned literature before Results/Discussion/Conclusion unlock.
          </p>
        </div>
        <ChevronDown size={16} className={cn('shrink-0 text-violet-500 transition-transform', expanded && 'rotate-180')} />
      </button>

      {expanded && (
        <div className="border-t border-violet-200 px-4 py-3 space-y-3">
          {isLoadingAudit && (
            <div className="flex items-center gap-2 text-[12px] text-violet-700">
              <Loader2 size={14} className="animate-spin" /> Running audit…
            </div>
          )}

          {audit && !isLoadingAudit && (
            <>
              <p className="text-[12px] text-slate-700 whitespace-pre-wrap">{audit.narrative}</p>

              <div className="space-y-1.5">
                {(Object.keys(RUBRIC_PILLAR_LABELS) as (keyof RubricScores)[]).map(key => {
                  const pillar = audit.rubricScores[key]
                  if (!pillar) return null
                  return (
                    <div key={key} className="flex items-start gap-2 text-[11px]">
                      <span className={cn('shrink-0 px-1.5 py-0.5 rounded font-semibold', RUBRIC_SCORE_STYLES[pillar.score] ?? RUBRIC_SCORE_STYLES.weak)}>
                        {pillar.score}
                      </span>
                      <span className="shrink-0 font-semibold text-violet-700">
                        {RUBRIC_PILLAR_LABELS[key]}:
                      </span>
                      <span className="text-slate-600">{pillar.evidence}</span>
                    </div>
                  )
                })}
              </div>

              {audit.unresolvedFlags.length > 0 && (
                <div className="space-y-1">
                  {audit.unresolvedFlags.map((flag, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11px] text-amber-700">
                      <AlertCircle size={12} className="shrink-0 mt-0.5" />
                      <span>{flag}</span>
                    </div>
                  ))}
                </div>
              )}

              {blockingQuestions.length > 0 && (
                <div className="rounded-lg bg-white border border-violet-200 p-3 space-y-2">
                  <p className="text-[11px] font-semibold text-violet-800 flex items-center gap-1.5">
                    <AlertCircle size={12} /> Supervisor's Challenge — answer to unlock thesis writing
                  </p>
                  {blockingQuestions.map((q, i) => (
                    <div key={i} className="space-y-1">
                      <p className="text-[12px] text-slate-700">{q}</p>
                      {methodologyUnresolved && i === 0 ? (
                        <div className="flex gap-2">
                          <select
                            value={answers[i] ?? ''}
                            onChange={e => setAnswers(prev => ({ ...prev, [i]: e.target.value }))}
                            className="flex-1 text-[12px] rounded-md border border-slate-300 px-2 py-1.5"
                          >
                            <option value="">Select methodology type…</option>
                            {METHODOLOGY_TIER1.map(m => (
                              <option key={m.value} value={m.value}>{m.value}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => submitAnswer(i)}
                            disabled={!answers[i]}
                            className="shrink-0 px-3 py-1.5 rounded-md bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-semibold disabled:opacity-50"
                          >
                            Confirm
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <input
                            value={answers[i] ?? ''}
                            onChange={e => setAnswers(prev => ({ ...prev, [i]: e.target.value }))}
                            placeholder="Your answer…"
                            className="flex-1 text-[12px] rounded-md border border-slate-300 px-2 py-1.5"
                          />
                          <button
                            onClick={() => submitAnswer(i)}
                            disabled={!answers[i]?.trim()}
                            className="shrink-0 px-3 py-1.5 rounded-md bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-semibold disabled:opacity-50"
                          >
                            Answer
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={onRunAudit}
                  className="text-[11px] text-violet-600 hover:text-violet-800 font-medium flex items-center gap-1"
                >
                  <RefreshCw size={11} /> Re-run audit
                </button>
                <button
                  onClick={onTransition}
                  disabled={!readyToTransition || isTransitioning}
                  className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-semibold transition-colors disabled:opacity-50"
                >
                  {isTransitioning
                    ? <><Loader2 size={12} className="animate-spin" /> Transitioning…</>
                    : <><GraduationCap size={12} /> Begin thesis writing</>}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Sprint 5: Defence preparation view ───────────────────────────────────────

function DefencePrepView({ project }: { project: ResearchProject }) {
  const {
    defence: allDefence,
    loadDefence,
    generateDefence,
    toggleChecklistItem,
    isGeneratingDefence,
  } = useResearchStore()

  const defence: DefencePreparation | undefined = allDefence[project.id]
  const [activeTab, setActiveTab] = useState<'questions' | 'viva' | 'checklist'>('questions')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!defence) {
      setLoading(true)
      loadDefence(project.id).finally(() => setLoading(false))
    }
  }, [project.id])

  const DIFFICULTY_STYLES: Record<string, string> = {
    basic:       'bg-sky-100 text-sky-700',
    moderate:    'bg-amber-100 text-amber-700',
    challenging: 'bg-red-100 text-red-700',
  }

  const CATEGORY_STYLES: Record<string, string> = {
    Methodology: 'bg-violet-100 text-violet-700',
    Results:     'bg-emerald-100 text-emerald-700',
    Discussion:  'bg-blue-100 text-blue-700',
    Literature:  'bg-orange-100 text-orange-700',
    Theory:      'bg-pink-100 text-pink-700',
    General:     'bg-slate-100 text-slate-700',
  }

  const tabs = [
    { id: 'questions' as const, label: 'Examiner Questions', icon: HelpCircle },
    { id: 'viva'      as const, label: 'Viva Statement',     icon: Mic },
    { id: 'checklist' as const, label: 'Pre-Viva Checklist', icon: ClipboardList },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 border-b border-slate-200 px-6 py-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-bold text-slate-900">Defence Preparation</h2>
          <p className="text-[12px] text-slate-500 mt-0.5">Examiner questions, opening statement, and pre-viva checklist.</p>
        </div>
        <button
          onClick={() => {
            generateDefence(project.id).catch(() => toast.error('Failed to generate defence materials.'))
          }}
          disabled={isGeneratingDefence}
          className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-[12px] font-semibold transition-colors disabled:opacity-50"
        >
          {isGeneratingDefence
            ? <><Loader2 size={12} className="animate-spin" /> Generating…</>
            : <><Sparkles size={12} /> {defence ? 'Regenerate' : 'Generate'}</>}
        </button>
      </div>

      {/* Tabs */}
      <div className="shrink-0 border-b border-slate-200 px-6">
        <div className="flex gap-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-3 text-[12px] font-medium border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700',
              )}
            >
              <tab.icon size={13} /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {loading || isGeneratingDefence ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 size={24} className="animate-spin text-orange-400" />
            <p className="text-[13px] text-slate-600">
              {isGeneratingDefence ? 'Claude is preparing your defence materials…' : 'Loading…'}
            </p>
          </div>
        ) : !defence ? (
          <div className="text-center py-24 border-2 border-dashed border-slate-200 rounded-xl">
            <GraduationCap size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="text-[13px] font-medium text-slate-600 mb-1">No defence preparation yet</p>
            <p className="text-[12px] text-slate-400 mb-4">
              Generate after Results (6.0) and Discussion (7.0) are drafted.
            </p>
          </div>
        ) : activeTab === 'questions' ? (
          <div className="space-y-3">
            {defence.examinerQuestions.map((q, i) => (
              <details key={i} className="group border border-slate-200 rounded-xl">
                <summary className="flex items-start gap-3 px-4 py-3 cursor-pointer list-none">
                  <span className="text-[11px] font-bold text-slate-400 mt-0.5 w-5 shrink-0">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', CATEGORY_STYLES[q.category] ?? 'bg-slate-100 text-slate-600')}>
                        {q.category}
                      </span>
                      <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', DIFFICULTY_STYLES[q.difficulty])}>
                        {q.difficulty}
                      </span>
                    </div>
                    <p className="text-[13px] font-medium text-slate-800">{q.question}</p>
                  </div>
                  <ChevronDown size={14} className="text-slate-400 shrink-0 group-open:rotate-180 transition-transform mt-0.5" />
                </summary>
                <div className="px-4 pb-4 border-t border-slate-100 mt-0 space-y-3 pt-3">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Why asked</p>
                    <p className="text-[12px] text-slate-600">{q.whyAsked}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Suggested response</p>
                    <p className="text-[12px] text-slate-700">{q.suggestedResponse}</p>
                  </div>
                </div>
              </details>
            ))}
          </div>
        ) : activeTab === 'viva' ? (
          <div className="max-w-2xl">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] font-semibold text-slate-700">Your 2-minute opening statement</p>
              <button
                onClick={() => navigator.clipboard.writeText(defence.vivaOpeningStatement).then(() => toast.success('Copied!'))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-[11px] font-medium transition-colors"
              >
                <Copy size={11} /> Copy
              </button>
            </div>
            <div className="border border-slate-200 rounded-xl p-5 text-[14px] text-slate-800 leading-relaxed whitespace-pre-wrap font-[Georgia,serif]">
              {defence.vivaOpeningStatement}
            </div>
          </div>
        ) : (
          // Checklist tab — group by category
          <div className="space-y-4">
            {Array.from(new Set(defence.checklist.map(c => c.category))).map(category => (
              <div key={category}>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">{category}</p>
                <div className="space-y-1">
                  {defence.checklist.map((item, i) => item.category !== category ? null : (
                    <label key={i} className={cn(
                      'flex items-start gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors',
                      item.checked ? 'bg-emerald-50' : 'hover:bg-slate-50',
                    )}>
                      <input
                        type="checkbox"
                        checked={item.checked ?? false}
                        onChange={() => toggleChecklistItem(project.id, i)}
                        className="mt-0.5 accent-emerald-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-[13px] font-medium', item.checked ? 'line-through text-slate-400' : 'text-slate-800')}>
                          {item.item}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{item.detail}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Step Rail ─────────────────────────────────────────────────────────────────

type StepStatus = 'done' | 'approved' | 'active' | 'draft' | 'generating' | 'todo' | 'locked' | 'required'

type StepGroup = 'setup' | 'chapters' | 'output'
const STEP_GROUPS: StepGroup[] = ['setup', 'chapters', 'output']
const STEP_GROUP_LABELS: Record<StepGroup, string> = {
  setup: 'Setup',
  chapters: 'Chapters',
  output: 'References & Output',
}

// Chapter-number grouping for the StepRail tree — distinct from the coarse STEP_GROUPS
// phase grouping above. Only used to nest e.g. "3.1"/"3.2"/"3.3" under a "Chapter 3"
// parent row within the existing 'chapters' STEP_GROUP; setup/output stay flat.
function getChapterNumber(stepId: string): string | null {
  const match = /^(\d+)\./.exec(stepId)
  return match ? match[1] : null
}

interface ChapterNode { chapterNum: string; label: string; indices: number[] }

function StepStatusDot({ status, stepNum }: { status: StepStatus; stepNum: number }) {
  const base: React.CSSProperties = {
    width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }
  switch (status) {
    case 'done':
      return (
        <span style={{ ...base, background: 'var(--color-green)' }}>
          <Check size={9} color="white" strokeWidth={3} />
        </span>
      )
    case 'approved':
      return (
        <span style={{ ...base, background: 'var(--color-green)' }}>
          <Check size={9} color="white" strokeWidth={3} />
        </span>
      )
    case 'draft':
      return (
        <span style={{ ...base, background: 'var(--color-amber)', color: 'white', fontSize: 12, fontWeight: 700, lineHeight: 1 }}>
          ~
        </span>
      )
    case 'generating':
      return (
        <span style={{ ...base, background: 'var(--color-amber)' }}>
          <Loader2 size={9} color="white" className="animate-spin" />
        </span>
      )
    case 'active':
      return (
        <span style={{ ...base, background: 'var(--color-purple)', color: 'white', fontSize: 9, fontWeight: 700 }}>
          {stepNum}
        </span>
      )
    case 'locked':
      return (
        <span style={{ ...base, background: 'var(--surface-rail)', border: '0.5px solid var(--border-strong)' }}>
          <Lock size={8} color="var(--text-disabled)" />
        </span>
      )
    case 'required':
      return (
        <span style={{ ...base, background: 'var(--color-amber)', color: 'white', fontSize: 11, fontWeight: 700, lineHeight: 1 }}>
          !
        </span>
      )
    case 'todo':
    default:
      return (
        <span style={{ ...base, background: 'white', border: '1.5px solid var(--border-strong)', color: 'var(--text-muted)', fontSize: 9, fontWeight: 500 }}>
          {stepNum}
        </span>
      )
  }
}

function StepBadge({ status, wordCount }: { status: 'done' | 'approved' | 'draft' | 'required'; wordCount: number }) {
  const wc = wordCount > 0 ? ` · ${wordCount}w` : ''
  const base: React.CSSProperties = { fontSize: 9, padding: '1px 5px', borderRadius: 3, fontWeight: 500, whiteSpace: 'nowrap' as const }
  if (status === 'approved') return <span style={{ ...base, background: 'var(--color-green-tint)', color: 'var(--color-green-text)' }}>Approved{wc}</span>
  if (status === 'draft')    return <span style={{ ...base, background: 'var(--color-amber-tint)', color: 'var(--color-amber-text)' }}>Draft{wc}</span>
  if (status === 'required') return <span style={{ ...base, background: 'var(--color-amber-tint)', color: 'var(--color-amber-text)' }}>Required</span>
  return <span style={{ ...base, background: 'var(--color-green-tint)', color: 'var(--color-green-text)' }}>Done</span>
}

function StepRail({
  currentStepIdx,
  onSelectStep,
  onSelectSectionCode,
  activeSectionCode,
  project,
  isOpen,
  onClose,
}: {
  currentStepIdx: number
  onSelectStep:   (idx: number) => void
  onSelectSectionCode: (code: string) => void
  activeSectionCode?: string | null
  project:        ResearchProject
  // Mobile drawer state — ignored by the desktop static-column rendering.
  isOpen?:        boolean
  onClose?:       () => void
}) {
  const { sections: allSections } = useResearchStore()
  // Same dedupeSections used by ChapterWriterView — the open editor and this sidebar badge
  // must always resolve "the section for code X" identically, or they can silently disagree.
  const sections = dedupeSections(allSections[project.id] ?? [])
  // Backend seeds/generates the Abstract (0.0) for a Proposal-stage project too now — it
  // summarizes the intended study instead of completed findings; see abstractStepStatus's own
  // doc comment for the document-type fork.
  const showAbstract = true
  const abstractLocked = isAbstractStepLocked(sections, project.documentType)
  // Mirrors isAbstractStepLocked's own real unlock rule — shown as a caption instead of
  // leaving the lock icon unexplained (Research Agent UX audit, 2026-10-03).
  const abstractLockedReason = project.documentType === 'Thesis' || project.documentType === 'Dissertation'
    ? 'Unlocks after Conclusion (8.0) and Recommendations (8.1) are approved'
    : 'Unlocks after Problem Statement, Justification, General Objective, Specific Objectives, and Study Design are approved'
  const abstractSection = sections.find(section => section.code === '0.0')
  const abstractStatus: StepStatus = abstractLocked
    ? 'locked'
    : abstractSection?.status === 'Approved' ? 'approved'
    : abstractSection?.status === 'Generating' ? 'generating'
    : abstractSection?.status === 'Draft' || abstractSection?.status === 'Edited' ? 'draft'
    : activeSectionCode === '0.0' ? 'active'
    : 'todo'

  // 'active' (the current-step highlight) is only returned when there's nothing more
  // specific to show for that step — an approved/drafted/generating step keeps its real
  // status (and icon) even while it's the one currently open. Row highlighting for "this
  // is the open step" is a separate concern — see isActive in renderStepButton below.
  function getStepStatus(idx: number): StepStatus {
    const step = STEPS[idx]
    if (step.type === 'wizard') {
      // Methodology Type is the one setup step that's actually content-gated (see
      // MethodologyTypeStep) rather than the generic "have you passed this index" rule every
      // other wizard step uses — so its status reflects whether a value is set, not just visited.
      // 'required' (the amber warning treatment) only fires once the student has actually moved
      // past it incomplete — while still approaching it, it reads as a plain upcoming step, not a
      // standing warning (Research Agent UX audit, 2026-10-03).
      if (step.id === 'methodology-type' && idx !== currentStepIdx) {
        if (project.methodologyType) return 'done'
        return idx < currentStepIdx ? 'required' : 'todo'
      }
      // research-topic shows Done only once a topic is actually confirmed — previously this
      // fell through to the generic "have you passed this index" rule below, so it could read
      // Done purely from having moved on, even with nothing ever selected.
      if (step.id === 'research-topic' && idx !== currentStepIdx) {
        return project.selectedTopic ? 'done' : 'todo'
      }
      return idx < currentStepIdx ? 'done' : idx === currentStepIdx ? 'active' : 'todo'
    }
    if (step.type === 'chapter') {
      const sec = sections.find(s => s.code === step.id)
      if (sec?.status === 'Approved') return 'approved'
      if (sec?.status === 'Generating') return 'generating'
      if (sec?.status === 'Draft' || sec?.status === 'Edited') return 'draft'
      return idx === currentStepIdx ? 'active' : 'todo'
    }
    // 'output' steps (References / Full Document / Download) are review-and-export checkpoints,
    // not generated content with its own unfinished state — unlike a chapter's 'active' (which
    // can genuinely mean "not yet approved"), simply having reached one means it's satisfied.
    // Previously fell through to the generic 'active'/'todo' branch, which meant these 3 steps
    // could never count toward doneCount below — capping progress below 100% even with every
    // chapter approved and the student standing on the very last step. Current-position row
    // highlighting is handled separately by isActive, not this status, so this is safe to change.
    if (step.type === 'output') {
      return idx <= currentStepIdx ? 'done' : 'todo'
    }
    return idx === currentStepIdx ? 'active' : 'todo'
  }

  const doneCount = STEPS.filter((_, idx) => {
    const st = getStepStatus(idx)
    return st === 'done' || st === 'approved' || st === 'draft'
  }).length
  const pct = Math.round((doneCount / STEPS.length) * 100)

  // Phase-based headline instead of "Step N of 34" — a raw-index count felt
  // intimidating against this many total steps. "Step N of 34 · 0% complete"
  // stays nowhere but the StepRail header; the page eyebrow keeps the plain
  // step number per-step (Research Agent UX audit, 2026-10-03).
  const currentGroup = STEPS[currentStepIdx]?.group ?? 'setup'
  const groupIndices = STEPS.map((s, i) => ({ s, i })).filter(({ s }) => s.group === currentGroup).map(({ i }) => i)
  const headline = (() => {
    if (currentGroup === 'chapters') {
      const approvedChapters = groupIndices.filter(idx => getStepStatus(idx) === 'approved').length
      return `Chapters: ${approvedChapters} of ${groupIndices.length} approved`
    }
    const posInGroup = groupIndices.indexOf(currentStepIdx) + 1
    const groupLabel = currentGroup === 'setup' ? 'Setup' : 'Output'
    return `${groupLabel} ${posInGroup} of ${groupIndices.length}`
  })()

  const stepsByGroup = STEP_GROUPS.reduce<Record<string, number[]>>((acc, g) => {
    acc[g] = STEPS.map((s, i) => ({ s, i })).filter(({ s }) => s.group === g).map(({ i }) => i)
    return acc
  }, {})

  // Chapter-number tree, built only from the 'chapters' STEP_GROUP — setup/output
  // keep the flat stepsByGroup rendering below, untouched.
  const chapterNodes: ChapterNode[] = (() => {
    const byNum = new Map<string, number[]>()
    STEPS.forEach((s, i) => {
      if (s.group !== 'chapters') return
      const num = getChapterNumber(s.id) ?? s.id
      if (!byNum.has(num)) byNum.set(num, [])
      byNum.get(num)!.push(i)
    })
    return Array.from(byNum.entries())
      .map(([chapterNum, indices]) => ({ chapterNum, label: `Chapter ${chapterNum}`, indices }))
      .sort((a, b) => parseFloat(a.chapterNum) - parseFloat(b.chapterNum))
  })()

  const activeChapterNum = getChapterNumber(STEPS[currentStepIdx]?.id ?? '')

  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(
    () => new Set(activeChapterNum ? [activeChapterNum] : []),
  )

  // Auto-reveal the active chapter on Previous/Next navigation without collapsing
  // anything the user manually expanded.
  useEffect(() => {
    if (!activeChapterNum) return
    setExpandedChapters(prev => (prev.has(activeChapterNum) ? prev : new Set(prev).add(activeChapterNum)))
  }, [activeChapterNum])

  const toggleChapter = (num: string) => {
    setExpandedChapters(prev => {
      const next = new Set(prev)
      if (next.has(num)) next.delete(num)
      else next.add(num)
      return next
    })
  }

  // Shared row renderer for both the flat setup/output lists and the nested chapter
  // children — keeps a single definition of the active/locked/hover treatment.
  const renderStepButton = (idx: number, indent = 0) => {
    const step = STEPS[idx]
    const status = getStepStatus(idx)
    const isActive = idx === currentStepIdx
    const isLocked = status === 'locked'
    const sec = sections.find(s => s.code === step.id)
    const wordCount = sec?.wordCount ?? 0
    const basePad = 14 + indent

    return (
      <button
        key={idx}
        onClick={() => !isLocked && onSelectStep(idx)}
        role="button"
        aria-current={isActive ? 'step' : undefined}
        aria-disabled={isLocked ? true : undefined}
        tabIndex={isLocked ? -1 : 0}
        className={cn(
          'w-full flex items-center gap-2 py-1.5 text-left transition-colors',
          isActive  ? 'bg-purple-tint'
          : isLocked ? 'cursor-default pointer-events-none'
          : 'hover:bg-[#eff6ff] cursor-pointer',
        )}
        style={{
          borderLeft: isActive ? '3px solid var(--color-purple)' : '3px solid transparent',
          paddingLeft: isActive ? basePad - 3 : basePad,
          paddingRight: 14,
        }}
      >
        <StepStatusDot status={status} stepNum={idx + 1} />
        <span
          className="flex-1 min-w-0 truncate"
          style={{
            fontSize: 12,
            lineHeight: 1.3,
            color: isActive ? 'var(--color-purple-text)' : isLocked ? 'var(--text-disabled)' : 'var(--text-secondary)',
            fontWeight: isActive ? 500 : 400,
          }}
        >
          {getStepLabel(step, project.methodologyType)}
          {/* docs/OPEN_ITEMS.md #81 — not a substitute for the backend gate, just a visible signal
              a student can act on before hitting it. */}
          {sec?.isApplicableForMethodology === false && (
            <span className="ml-1.5 text-[10px] font-normal text-slate-400" title={sec.notApplicableReason ?? 'Not applicable for the confirmed methodology'}>
              (N/A)
            </span>
          )}
        </span>
        {sec?.isMethodologyStale && (
          <span
            className="shrink-0"
            title={sec.methodologyStaleReason ?? 'Needs review — methodology changed since this was drafted'}
          >
            <AlertTriangle size={12} className="text-amber-500" aria-label="Needs review — methodology changed since this was drafted" />
          </span>
        )}
        {(status === 'done' || status === 'approved' || status === 'draft' || status === 'required') && (
          <StepBadge status={status} wordCount={wordCount} />
        )}
      </button>
    )
  }

  return (
    <>
      {/* Mobile backdrop — closes the drawer on outside click; desktop never shows it */}
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={onClose} />
      )}

      <aside
        className={cn(
          'shrink-0 flex flex-col overflow-hidden transition-transform duration-300 ease-in-out',
          'fixed inset-y-0 left-0 z-50 md:relative md:z-auto md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        style={{ width: 220, background: 'var(--surface-rail)', borderRight: '0.5px solid var(--border-hairline)' }}
      >
      {/* Pinned header */}
      <div className="shrink-0 px-3.5 pt-3.5 pb-2.5" style={{ borderBottom: '0.5px solid var(--border-hairline)' }}>
        <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 8 }}>
          Research Agent
        </p>
        <div
          className="rounded-full overflow-hidden"
          style={{ height: 4, background: 'var(--border-hairline)' }}
          role="progressbar"
          aria-valuenow={currentStepIdx}
          aria-valuemin={0}
          aria-valuemax={STEPS.length - 1}
          aria-label="Proposal completion"
        >
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, background: 'var(--color-purple)', transition: 'width 300ms ease' }}
          />
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          {headline} · {pct}% complete
        </p>
      </div>

      {/* Scrollable step list */}
      <div className="flex-1 overflow-y-auto">
        {STEP_GROUPS.map(group => {
          if (group === 'chapters') {
            if (!chapterNodes.length) return null

            return (
              <div key={group}>
                <p
                  className="px-3.5"
                  style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', paddingTop: 10, paddingBottom: 4 }}
                >
                  {STEP_GROUP_LABELS[group]}
                </p>

                {showAbstract && (
                  <button
                    type="button"
                    onClick={() => !abstractLocked && onSelectSectionCode('0.0')}
                    aria-current={activeSectionCode === '0.0' ? 'step' : undefined}
                    aria-disabled={abstractLocked || undefined}
                    title={abstractLocked ? abstractLockedReason : undefined}
                    tabIndex={abstractLocked ? -1 : 0}
                    className={cn(
                      'w-full flex items-center gap-2 py-1.5 px-3.5 text-left transition-colors',
                      activeSectionCode === '0.0' ? 'bg-purple-tint'
                        : abstractLocked ? 'cursor-default pointer-events-none'
                        : 'hover:bg-[#eff6ff] cursor-pointer',
                    )}
                  >
                    <StepStatusDot status={abstractStatus} stepNum={1} />
                    <span className="flex-1 min-w-0 truncate" style={{
                      fontSize: 12,
                      color: activeSectionCode === '0.0'
                        ? 'var(--color-purple-text)'
                        : abstractLocked ? 'var(--text-disabled)' : 'var(--text-secondary)',
                      fontWeight: activeSectionCode === '0.0' ? 500 : 400,
                    }}>
                      0.0 Abstract
                    </span>
                    {(abstractStatus === 'approved' || abstractStatus === 'draft') && (
                      <StepBadge status={abstractStatus} wordCount={abstractSection?.wordCount ?? 0} />
                    )}
                  </button>
                )}

                {chapterNodes.map(node => {
                  const isExpanded = expandedChapters.has(node.chapterNum)
                  const hasActive = node.indices.includes(currentStepIdx)
                  const approvedCount = node.indices.filter(idx => getStepStatus(idx) === 'approved').length

                  return (
                    <div key={node.chapterNum}>
                      <button
                        onClick={() => toggleChapter(node.chapterNum)}
                        aria-expanded={isExpanded}
                        className={cn(
                          'w-full flex items-center gap-1.5 px-3.5 py-1.5 text-left transition-colors',
                          hasActive ? 'bg-purple-tint' : 'hover:bg-[#eff6ff]',
                        )}
                      >
                        {isExpanded
                          ? <ChevronDown size={13} className="shrink-0" style={{ color: 'var(--text-muted)' }} />
                          : <ChevronRight size={13} className="shrink-0" style={{ color: 'var(--text-muted)' }} />}
                        <span className="flex-1 min-w-0 truncate" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                          {node.label}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                          {approvedCount}/{node.indices.length} approved
                        </span>
                      </button>

                      {isExpanded && node.indices.map(idx => renderStepButton(idx, 14))}
                    </div>
                  )
                })}
              </div>
            )
          }

          const indices = stepsByGroup[group] ?? []
          if (!indices.length) return null

          return (
            <div key={group}>
              <p
                className="px-3.5"
                style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', paddingTop: 10, paddingBottom: 4 }}
              >
                {STEP_GROUP_LABELS[group]}
              </p>

              {indices.map(idx => renderStepButton(idx))}
            </div>
          )
        })}
      </div>
      </aside>
    </>
  )
}

// ToolSidebar + TOOL_NAV live in src/components/layout/ToolSidebar.tsx — shared
// with ResearchDashboardPage's 3-pane workspace shell.

// ── Chapter Writer ────────────────────────────────────────────────────────────

// Imperative handle exposing ChapterWriterView's Check Alignment / Export actions to
// the page-level topbar, which owns those buttons but not the per-section state they
// depend on (isDirty, handleSave, project.id already closed over inside the handlers).
// The callable functions live on a ref (no need to be reactive — always called fresh);
// the flags that drive button appearance are pushed up via onActionsStateChange instead,
// since a ref mutation alone would not trigger a re-render of the parent's buttons.
export interface ChapterActions {
  validate:       () => void
  export:         () => void
  openReferences: () => void
}

export interface ChapterActionsState {
  isValidating:           boolean
  isExporting:            boolean
  isThesisOrDissertation: boolean
}

function ChapterWriterView({
  project,
  externalCode,
  actionsRef,
  onActionsStateChange,
  onActiveSectionChange,
}: {
  project:                ResearchProject
  externalCode?:          string
  actionsRef?:            React.MutableRefObject<ChapterActions | null>
  onActionsStateChange?:  (state: ChapterActionsState) => void
  onActiveSectionChange?: (section: ProjectSection | null) => void
}) {
  const navigateToWorkflow = useNavigate()
  const [, setStepParams] = useSearchParams()
  const {
    sections: allSections,
    initSections,
    loadSections,
    generateSection,
    saveSection,
    approveSection,
    regenerateSection,
    applySectionFix,
    confirmSectionFix,
    discardSectionFix,
    validateAlignment,
    validateQuality,
    exportDocx,
    transitionToThesis,
    isTransitioning,
    exportThesisDocx,
    thesisAudit: allThesisAudits,
    isLoadingThesisAudit,
    loadThesisAudit,
    answerThesisAuditQuestion,
    sectionVersions: allSectionVersions,
    isLoadingSectionVersions,
    loadSectionVersions,
    restoreSectionVersion,
    evidenceCoverageAudit: allEvidenceCoverageAudits,
    loadEvidenceCoverageAudit,
    updateSectionContent,
  } = useResearchStore()

  const user = useAuthStore((s) => s.user)
  const sectionGenerationCost = CREDIT_COSTS.proposalSectionGeneration
  const hasEnoughCreditsForSection = () => {
    if (!user) return true
    if (user.plan === 'Unlimited') return true
    if (user.creditsLimit - user.creditsUsed >= sectionGenerationCost) return true
    useUiStore.getState().openCreditLimitModal({
      used: user.creditsUsed,
      limit: user.creditsLimit,
      resetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
    })
    return false
  }

  const rawSections: ProjectSection[]  = allSections[project.id]    ?? []
  const uniqueSections: ProjectSection[] = dedupeSections(rawSections)

  const [selectedCode,          setSelectedCode]          = useState(externalCode ?? '1.0')
  // Lazy-initialize so DocumentSurface receives the real stored content on its very
  // first render — avoids the intermediate empty state where hasContent=true but the
  // editor is blank because the useEffect hasn't fired yet.
  const [localContent,          setLocalContent]          = useState(() => {
    const code    = externalCode ?? '1.0'
    const section = uniqueSections.find(s => s.code === code)
    return (section?.content ?? '').replace(/\r\n/g, '\n')
  })
  const [isDirty,               setIsDirty]               = useState(false)
  const [isSaving,              setIsSaving]              = useState(false)
  const [isExporting,           setIsExporting]           = useState(false)
  const [alignment,             setAlignment]             = useState<AlignmentValidationResult | null>(null)
  const [isValidating,          setIsValidating]          = useState(false)
  const [showRegenConfirm,      setShowRegenConfirm]      = useState(false)
  // "Apply fix" — pre-flight cost confirm (applyFixTarget set) -> preview call -> diff review
  // (sectionFixPreview set) -> Apply (confirmSectionFix) or Cancel (discardSectionFix). See
  // handleApplyFixClick/confirmApplyFix/handleAcceptSectionFix/handleCancelSectionFix below.
  const [applyFixTarget,   setApplyFixTarget]   = useState<{ sectionCode: string; issues: AlignmentIssue[] } | null>(null)
  const [sectionFixPreview, setSectionFixPreview] = useState<SectionFixPreview | null>(null)
  const [isApplyingFix,    setIsApplyingFix]    = useState(false)
  const [isConfirmingFix,  setIsConfirmingFix]  = useState(false)
  const [isInitializingSections, setIsInitializingSections] = useState(false)
  const [showReferencesDrawer,  setShowReferencesDrawer]  = useState(false)
  const [showVersionHistory,    setShowVersionHistory]    = useState(false)
  const [restoringVersion,      setRestoringVersion]      = useState<number | null>(null)
  const [showEvidenceCoverage,  setShowEvidenceCoverage]  = useState(false)
  const [loadingEvidenceCoverage, setLoadingEvidenceCoverage] = useState(false)
  // Explicit idle/loading/ready/error — "not asked yet", "asking", "zero references" and "failed"
  // are different conditions and the panel must say which one it is.
  const [bibliographyState,     setBibliographyState]     = useState<BibliographyState>({ status: 'idle' })
  // Full per-source metadata (title/abstract/DOI) for the in-editor citation popover —
  // cheap DB read (unlike compileBibliography, which is LLM-backed), so fetched eagerly.
  const [literature,             setLiterature]            = useState<FetchedLiterature[] | null>(null)
  const [citationFlags,          setCitationFlags]         = useState<CitationFlag[]>([])
  const [citationFix, setCitationFix] = useState<{ flagId: string; action: CitationFixAction; preview: SectionFixPreview } | null>(null)
  const [busyCitationFlagId, setBusyCitationFlagId] = useState<string | null>(null)
  const [isConfirmingCitationFix, setIsConfirmingCitationFix] = useState(false)
  const [factConflicts,          setFactConflicts]         = useState<FactConflict[]>([])
  const saveTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  // DocumentSurface's own 1s save debounce and this page's 4s fallback debounce
  // (see handleContentChange) can both land on handleSave for the same section.
  // Without serializing, a slow save (e.g. one carrying an embedded image) can
  // resolve *after* a faster, newer save (e.g. that image being deleted) and
  // overwrite the store with its stale content — reintroducing deleted content.
  // These two refs force at most one saveSection request in flight per section,
  // always chasing the latest content rather than racing.
  const isSavingRef      = useRef(false)
  const pendingContentRef = useRef<{ sectionCode: string; content: string } | null>(null)
  // Guards against a double mousedown/click on Approve firing two concurrent
  // approveSection requests — the button has no in-flight disabled state of its own
  // (DocumentSurface's onApprove is a plain () => void), so each overlapping call would
  // otherwise reach the same 409 and stack a duplicate "unresolved citation issue" toast.
  const isApprovingRef = useRef(false)
  const initCalledRef = useRef(false)
  // Guards initSections against concurrent double-fire between the two effects below.
  // A ref (not isInitializingSections state) because both effects can run in the same
  // commit, before a setState from the first effect has actually applied.
  const sectionsInFlightRef = useRef(false)
  const documentSurfaceRef = useRef<DocumentSurfaceHandle>(null)

  // Structured bibliography (deterministic, no LLM). Each request gets an id; only the newest
  // request may write state, so a slow older response can never overwrite a newer result.
  const bibliographyRequestRef = useRef(0)
  // The cache identity the current state was fetched for; null = nothing valid cached.
  const bibliographyKeyRef = useRef<string | null>(null)

  // Everything the result depends on. Content is only trusted once persisted (see the effect
  // below), because the server compiles from SAVED text, not what is currently in the editor.
  const bibliographyKey = useMemo(() => buildBibliographyKey({
    projectId:     project.id,
    citationStyle: project.citationStyle,
    sections:      rawSections,
    literature,
  }), [project.id, project.citationStyle, rawSections, literature])

  const fetchBibliography = () => {
    const requestId = ++bibliographyRequestRef.current
    bibliographyKeyRef.current = bibliographyKey
    setBibliographyState({ status: 'loading' })
    researchApi.getBibliography(project.id)
      .then(data => {
        if (requestId !== bibliographyRequestRef.current) return
        setBibliographyState({ status: 'ready', data })
      })
      .catch(err => {
        if (requestId !== bibliographyRequestRef.current) return
        // A failed request must not be remembered as a valid (empty) result.
        bibliographyKeyRef.current = null
        setBibliographyState({
          status: 'error',
          message: extractErrorMessage(err) ?? 'References couldn’t load.',
        })
      })
  }

  const contentPersisted = !isDirty && !isSaving

  // Keep the cache honest. When saved content, the source registry, section statuses or the
  // citation style change, the old result is stale: refetch if the panel is open, otherwise drop
  // it so the next open fetches fresh data. This also covers the banner's "Open references"
  // button, which used to open the panel without ever requesting anything.
  useEffect(() => {
    if (!contentPersisted) return
    if (bibliographyKeyRef.current === bibliographyKey) return
    if (showReferencesDrawer) {
      fetchBibliography()
    } else {
      bibliographyRequestRef.current++            // abandon anything still in flight
      bibliographyKeyRef.current = null
      setBibliographyState(prev => (prev.status === 'idle' ? prev : { status: 'idle' }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bibliographyKey, contentPersisted, showReferencesDrawer])

  const bibliography: ParsedReference[] | null = useMemo(
    () => bibliographyReferences(bibliographyState), [bibliographyState])

  const handleOpenReferences = () => {
    setShowReferencesDrawer(true)
    if (activeSection) {
      researchApi.getCitationFlags(project.id, selectedCode)
        .then(setCitationFlags)
        .catch(() => {})
    }
  }

  // Triggered when the citation popover needs to resolve an IEEE "[N]" click and nothing has been
  // compiled yet.
  const handleRequestBibliography = () => {
    if (bibliographyState.status === 'idle' || bibliographyState.status === 'error') fetchBibliography()
  }

  // ── Thesis Foundation (Phase 2): version history ────────────────────────────

  const handleOpenVersionHistory = () => {
    setShowVersionHistory(true)
    loadSectionVersions(project.id, selectedCode).catch(() => toast.error('Could not load version history.'))
  }

  const handleRestoreVersion = async (versionNumber: number) => {
    setRestoringVersion(versionNumber)
    try {
      await restoreSectionVersion(project.id, selectedCode, versionNumber)
      toast.success(`Restored version ${versionNumber}.`)
      setShowVersionHistory(false)
    } catch {
      toast.error('Could not restore this version. Please try again.')
    } finally {
      setRestoringVersion(null)
    }
  }

  // ── Thesis Foundation (Phase 2): evidence coverage audit (2.0 only) ─────────

  const handleOpenEvidenceCoverage = () => {
    setShowEvidenceCoverage(true)
    setLoadingEvidenceCoverage(true)
    loadEvidenceCoverageAudit(project.id, selectedCode)
      .catch(() => toast.error('Could not load evidence coverage.'))
      .finally(() => setLoadingEvidenceCoverage(false))
  }

  const handleInsertCitation = (ref: ParsedReference, index: number) => {
    documentSurfaceRef.current?.insertCitationAtCursor(formatInTextCitation(ref, project.citationStyle, index))
  }

  // Cheap DB read (no LLM) — used both on initial mount and after a section finishes
  // generating (see the wasGeneratingRef effect below), since generation can add new
  // sources to the project's literature pool mid-session. Without the second call site, a
  // citation drafted from literature fetched during THIS visit stayed "Unmatched" in
  // CitationPopover until the page reloaded, even though the server had already resolved it.
  const refetchLiterature = () => {
    researchApi.getLiterature(project.id)
      .then(setLiterature)
      .catch(() => setLiterature([]))
  }

  useEffect(() => {
    refetchLiterature()
  }, [project.id])

  const handleManageFullReferences = () => {
    setShowReferencesDrawer(false)
    const refIdx = STEPS.findIndex(s => s.id === 'references')
    if (refIdx !== -1) setStepParams({ step: String(refIdx) })
  }

  // Sync selected section when driven by external step rail navigation
  useEffect(() => {
    if (externalCode && externalCode !== selectedCode) {
      selectSection(externalCode)
      recoveryCalledRef.current = false  // allow recovery to retry for the new section
    }
  }, [externalCode])

  // Reset scroll to top whenever section changes.
  // rAF fires after TipTap's content sync so it wins the race.
  const rightPanelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (rightPanelRef.current) rightPanelRef.current.scrollTop = 0
    })
    return () => cancelAnimationFrame(id)
  }, [selectedCode])

  const activeSection = uniqueSections.find(s => s.code === selectedCode)

  // Plain-text excerpt of the active section's current content, for the regenerate-confirmation
  // preview — strips markdown syntax rather than rendering it, since the modal has no room for
  // formatted output.
  const regenPreviewExcerpt = (() => {
    if (!activeSection?.content) return ''
    const plain = activeSection.content.replace(/[#*_`>-]/g, '').replace(/\s+/g, ' ').trim()
    return plain.length > 100 ? `${plain.slice(0, 100)}…` : plain
  })()

  // Citation-integrity flags for the active section, from the post-generation verification
  // pass that runs automatically inside GenerateSectionAsync. Re-fetched whenever the section
  // changes, its status flips (e.g. Generating -> Draft after a (re)generate completes), or its
  // claim-support check finishes in the background (see the polling effect below) — that's the
  // pass that can find journal/author/claim mismatches, so flags found there wouldn't otherwise
  // show up until something else happened to re-trigger this fetch.
  useEffect(() => {
    if (!activeSection) { setCitationFlags([]); return }
    researchApi.getCitationFlags(project.id, activeSection.code)
      .then(setCitationFlags)
      .catch(() => setCitationFlags([]))
  }, [project.id, activeSection?.code, activeSection?.status, activeSection?.citationsPendingVerification])

  // Claim-support citation verification (OpenAlex + Claude comparison) now runs in the
  // background for chapter sections (CitationClaimSupportVerificationJob) instead of blocking
  // GenerateSectionAsync's response — poll until it lands so the word count strip's "Verifying
  // citations…" indicator clears and any resulting flags (handled above) actually appear without
  // the student having to navigate away and back.
  useEffect(() => {
    if (!activeSection?.citationsPendingVerification) return
    const intervalId = setInterval(() => {
      loadSections(project.id).catch(() => {})
    }, 4000)
    return () => clearInterval(intervalId)
  }, [project.id, activeSection?.code, activeSection?.citationsPendingVerification])

  const handleDismissCitationFlag = async (flagId: string, reason?: string) => {
    setBusyCitationFlagId(flagId)
    try {
      await researchApi.dismissCitationFlag(project.id, flagId, reason)
      setCitationFlags(prev => prev.filter(f => f.id !== flagId))
    } catch (err) {
      const message = err instanceof Error || (typeof err === 'object' && err !== null && 'message' in err)
        ? String((err as { message?: unknown }).message)
        : undefined
      toast.error(message || 'Failed to dismiss flag. Please try again.')
    } finally {
      setBusyCitationFlagId(null)
    }
  }

  const handleRepairCitationFlag = async (
    flagId: string, action: CitationFixAction, replacementLiteratureId?: string,
  ) => {
    if (!hasEnoughCreditsForSection()) return
    setBusyCitationFlagId(flagId)
    try {
      const preview = await researchApi.previewCitationFix(project.id, flagId, action, replacementLiteratureId)
      setCitationFix({ flagId, action, preview })
    } catch {
      toast.error('Could not generate this citation repair.')
    } finally {
      setBusyCitationFlagId(null)
    }
  }

  const handleConfirmCitationFix = async () => {
    if (!citationFix) return
    setIsConfirmingCitationFix(true)
    try {
      const updated = await researchApi.confirmCitationFix(
        project.id, citationFix.flagId, citationFix.action, citationFix.preview.proposedContent,
      )
      setLocalContent(updated.content.replace(/\r\n/g, '\n'))
      setCitationFlags(prev => prev.filter(flag => flag.id !== citationFix.flagId))
      setCitationFix(null)
      await loadSections(project.id)
      toast.success('Citation issue repaired.')
    } catch (err) {
      // ConfirmCitationFixAsync throws several distinct, specific reasons (stale content since
      // preview, fix didn't actually change the flagged sentence/marker, re-verification still
      // finds the citation doesn't support the claim) — surface whichever one it was instead of
      // a single generic message that gives the student no idea what to do differently.
      toast.error(extractErrorMessage(err) ?? 'The proposed repair could not be verified, so it was not saved.')
    } finally {
      setIsConfirmingCitationFix(false)
    }
  }

  const handleCancelCitationFix = async () => {
    setCitationFix(null)
    try { await researchApi.discardSectionFix(project.id) } catch { /* stale reservations are reconciled */ }
  }

  const handleChooseCitationSource = async (flagId: string, literatureId: string) => {
    setBusyCitationFlagId(flagId)
    try {
      const updated = await researchApi.chooseCitationSource(project.id, flagId, literatureId)
      setLocalContent(updated.content.replace(/\r\n/g, '\n'))
      setCitationFlags(prev => prev.filter(flag => flag.id !== flagId))
      await loadSections(project.id)
      toast.success('Citation source saved to the reference list.')
    } catch (err) {
      // The server explains why a choice could not be recorded (text edited since, paper no longer
      // shares the author and year, reference list could not be updated) — show that, not a generic line.
      toast.error(extractErrorMessage(err) ?? 'Could not save this choice; the section may have changed.')
    } finally {
      setBusyCitationFlagId(null)
    }
  }

  const handleRemoveCitationClaim = async (flagId: string) => {
    setBusyCitationFlagId(flagId)
    try {
      const updated = await researchApi.removeCitationClaim(project.id, flagId)
      setLocalContent(updated.content.replace(/\r\n/g, '\n'))
      setCitationFlags(prev => prev.filter(flag => flag.id !== flagId))
      await loadSections(project.id)
      toast.success('Claim removed.')
    } catch {
      toast.error('Could not remove this claim; the section may have changed.')
    } finally {
      setBusyCitationFlagId(null)
    }
  }

  // Fact conflicts are project-wide (not per-section) — refetched whenever the active
  // section's status changes (e.g. Generating -> Draft after a (re)generate completes,
  // which is when CheckFactsConsistencyAsync could have raised a new one).
  useEffect(() => {
    researchApi.getFactConflicts(project.id)
      .then(setFactConflicts)
      .catch(() => setFactConflicts([]))
  }, [project.id, activeSection?.status])

  const handleDismissFactConflict = (conflictId: string) => {
    setFactConflicts(prev => prev.filter(c => c.id !== conflictId))
    researchApi.dismissFactConflict(project.id, conflictId)
      .catch(() => toast.error('Failed to dismiss conflict. Please try again.'))
  }

  const handleAcceptNewFactValue = (conflictId: string) => {
    setFactConflicts(prev => prev.filter(c => c.id !== conflictId))
    researchApi.acceptNewFactValue(project.id, conflictId)
      .catch(() => toast.error('Failed to update the registry. Please try again.'))
  }

  // Derive content that the editor should show.
  // When the user is actively editing, use their in-progress text so keystrokes
  // are not overwritten by store updates. When the state is clean (just navigated
  // to a section, or AI just finished generating), pull straight from the store so
  // the editor gets the new content in the SAME render — no extra round-trip through
  // setLocalContent/useEffect which would leave the editor blank for one frame.
  const storeContent  = (activeSection?.content ?? '').replace(/\r\n/g, '\n')
  const editorContent = isDirty ? localContent : storeContent

  // Batches selectedCode + localContent together so DocumentSurface always
  // mounts with the correct content on its first render (not the previous section's).
  const selectSection = (code: string) => {
    const sec = uniqueSections.find(s => s.code === code)
    setSelectedCode(code)
    setLocalContent((sec?.content ?? '').replace(/\r\n/g, '\n'))
    setIsDirty(false)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
  }

  const isThesisOrDissertation =
    project.documentType === 'Thesis' || project.documentType === 'Dissertation'
  // The audit itself is the readiness gate now (methodology-aware, not a hypothesis-only
  // heuristic that could never fire for a qualitative thesis) — the panel is always available
  // once the project isn't already a thesis, and the user triggers the audit on demand.
  const showThesisAuditPanel = !isThesisOrDissertation

  // Special section codes that use their own UI instead of the textarea editor
  const isSpecialSection = selectedCode === '4.4' || selectedCode === 'defence'

  // Init sections once — guard against React StrictMode double-fire.
  // Always call initSections (idempotent POST) rather than branching to loadSections (GET).
  // The GET can return a stale DB snapshot taken before initSections creates the new rows,
  // which would overwrite valid store state and silently break the generate handler.
  useEffect(() => {
    if (initCalledRef.current) return
    initCalledRef.current = true
    if (sectionsInFlightRef.current) return
    sectionsInFlightRef.current = true
    setIsInitializingSections(true)
    initSections(project.id)
      .catch(() => toast.error('Could not initialise sections.'))
      .finally(() => {
        sectionsInFlightRef.current = false
        setIsInitializingSections(false)
      })
  }, [project.id])

  // Recovery: if we navigate to a chapter section that isn't in the store yet
  // (project initialised before this section template existed), re-run initSections
  // to create the missing rows. Guard with a ref so we only do it once per mount.
  const recoveryCalledRef = useRef(false)
  useEffect(() => {
    if (sectionsInFlightRef.current) return                // already in flight elsewhere
    if (isSpecialSection) return                           // no DB row needed
    if (activeSection) return                              // already exists
    if (recoveryCalledRef.current) return                  // tried once, don't loop
    recoveryCalledRef.current = true
    sectionsInFlightRef.current = true
    setIsInitializingSections(true)
    initSections(project.id)
      .catch(() => toast.error('Could not create missing sections.'))
      .finally(() => {
        sectionsInFlightRef.current = false
        setIsInitializingSections(false)
      })
  }, [selectedCode, activeSection, isInitializingSections, isSpecialSection, project.id])

  // Reset dirty state and pending save timers whenever the user switches sections.
  // Content sync is no longer needed here — editorContent derives from the store
  // directly so the editor is never one render behind.
  useEffect(() => {
    setIsDirty(false)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
  }, [selectedCode])

  const handleContentChange = (val: string) => {
    setLocalContent(val)
    setIsDirty(true)
    // Updates the sidebar's word-count badge and status immediately, ahead of the
    // debounced save below — a pure local store write (no request), so the badge
    // no longer lags typing until the next save/approve/generate round-trip.
    if (activeSection) updateSectionContent(project.id, activeSection.code, val)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    // DocumentSurface's onSave fires with its own 1s debounce; keep a 4s
    // fallback here so tab-switching without triggering onSave still saves.
    saveTimerRef.current = setTimeout(() => handleSave(val), 4000)
  }

  const handleSave = async (content = localContent) => {
    if (!activeSection || !isDirty) return
    const sectionCode = activeSection.code
    // A save is already in flight — don't fire a second, overlapping request.
    // Stash this (newer) content and the in-flight save will pick it up next.
    if (isSavingRef.current) {
      pendingContentRef.current = { sectionCode, content }
      return
    }
    isSavingRef.current = true
    setIsSaving(true)
    let toSave: { sectionCode: string; content: string } | null = { sectionCode, content }
    try {
      while (toSave !== null) {
        await saveSection(project.id, toSave.sectionCode, toSave.content)
        if (pendingContentRef.current !== null
            && (pendingContentRef.current.sectionCode !== toSave.sectionCode
                || pendingContentRef.current.content !== toSave.content)) {
          toSave = pendingContentRef.current
          pendingContentRef.current = null
        } else {
          toSave = null
        }
      }
      setIsDirty(false)
    } catch (err) {
      // SECTION_EDIT_CONFLICT (409) — this section's ContentVersion moved since it was loaded
      // (another tab, a background verification pass, a regenerate already won). Retrying would
      // just fail again with the same stale version, and silently discarding either side would
      // defeat the whole point of the guard — reload the section's current content instead, same
      // "never silently overwrite" posture as FACT_CONFLICT elsewhere in this file.
      if ((err as ApiError | undefined)?.code === 'SECTION_EDIT_CONFLICT') {
        toast((t) => (
          <div className="flex flex-col gap-2 text-[13px]">
            <span>This section changed elsewhere while you were editing — your last change wasn't saved. Reload to see the current version.</span>
            <div className="flex gap-3">
              <button
                onClick={() => { toast.dismiss(t.id); setIsDirty(false); loadSections(project.id).catch(() => toast.error('Reload failed.')) }}
                className="font-semibold text-amber-700 hover:text-amber-900"
              >
                Reload section
              </button>
              <button onClick={() => toast.dismiss(t.id)} className="text-slate-500 hover:text-slate-700">
                Dismiss
              </button>
            </div>
          </div>
        ), { duration: 30000 })
      } else {
        toast.error('Save failed.')
      }
    } finally {
      isSavingRef.current = false
      pendingContentRef.current = null
      setIsSaving(false)
    }
  }

  // AI Thesis's creation modal lets users set a total document length up
  // front and stashes the per-section share as `targetSectionWordCount` —
  // fall back to the previous fixed default when a project has none (i.e.
  // every project created before this existed, or via any other entry point).
  const defaultTargetWordCount = Number(project.sectionContent['targetSectionWordCount']) || 500

  // After a successful generate/regenerate, the store's section.content is the fresh
  // truth — but editorContent only reads it when isDirty is false (see editorContent
  // above). Without resetting here, any lingering dirty state (a stale local edit that
  // never got cleanly resolved) hides the newly generated content behind the old
  // localContent, showing an empty/stale body even though generation succeeded.
  const syncAfterGeneration = () => {
    setIsDirty(false)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
  }

  // Shared by the client-side pre-check below and the catch-block fallback (in case
  // project.methodologyType is stale locally) — mirrors the message
  // ResearchService.GenerateSectionAsync throws for MethodologySensitiveSectionCodes.
  const showMethodologyRequiredToast = () => {
    const methodologyIdx = STEPS.findIndex(s => s.id === 'methodology-type')
    toast((t) => (
      <div className="flex flex-col gap-2 text-[13px]">
        <span>Methodology Type must be set before generating this section.</span>
        <div className="flex gap-3">
          <button
            onClick={() => { toast.dismiss(t.id); setStepParams({ step: String(methodologyIdx) }) }}
            className="font-semibold text-amber-700 hover:text-amber-900"
          >
            Go to Setup
          </button>
          <button onClick={() => toast.dismiss(t.id)} className="text-slate-500 hover:text-slate-700">
            Dismiss
          </button>
        </div>
      </div>
    ), { duration: 10000 })
  }

  const ensureProposalDesignReady = async () => {
    if (project.documentMode !== 'PROPOSAL') return true
    const view = await proposalJourneyApi.current(project.id)
    if (view.summary.designRequired && (!view.summary.acceptedRevisionId || view.readiness?.canGenerate !== true)) {
      if (isDirty) {
        toast.error('Save your changes, then open Design study in your proposal workspace before generating.')
        return false
      }
      toast('Complete your study design before writing. Opening your proposal workspace.')
      navigateToWorkflow(`/app/research-agent/${project.id}/proposal-workflow?tab=design`)
      return false
    }
    return true
  }

  const handleGenerate = async (targetWordCount = defaultTargetWordCount) => {
    if (!activeSection) return
    if (!hasEnoughCreditsForSection()) return
    // Client-side pre-check — avoids a wasted round-trip (and credit reservation attempt) for
    // the common case; the server-side guard is still authoritative if this is stale.
    // docs/OPEN_ITEMS.md #81 — checks the real confirmed methodology, not just whether
    // methodologyType is a non-empty (possibly unconfirmed, e.g. AI-pre-filled) string.
    if (METHODOLOGY_SENSITIVE_SECTIONS.has(selectedCode) && !project.confirmedMethodology) {
      showMethodologyRequiredToast()
      return
    }
    try {
      if (!await ensureProposalDesignReady()) return
      await generateSection(project.id, selectedCode, targetWordCount)
      syncAfterGeneration()
      toast.success(`Generation started for section ${selectedCode}.`)
    } catch (err) {
      const code = (err as { response?: { data?: { error?: { code?: string } } } } | undefined)?.response?.data?.error?.code
      if (code === 'METHODOLOGY_NOT_CONFIRMED') {
        showMethodologyRequiredToast()
        return
      }
      const message = (err as { message?: string } | undefined)?.message ?? ''
      toast.error(message || 'Generation failed — check the server is running.')
    }
  }

  const handleRegenerate = async () => {
    if (!activeSection) return
    // Only confirm when the user has personally edited or approved the section —
    // draft/not-started sections contain only AI output, so no confirmation needed.
    const needsConfirm = activeSection.status === 'Edited' || activeSection.status === 'Approved'
    if (needsConfirm) {
      setShowRegenConfirm(true)
      return
    }
    if (!hasEnoughCreditsForSection()) return
    try {
      if (!await ensureProposalDesignReady()) return
      await regenerateSection(project.id, selectedCode)
      syncAfterGeneration()
    } catch {
      toast.error('Regeneration failed.')
    }
  }

  const confirmRegenerate = async () => {
    if (!hasEnoughCreditsForSection()) { setShowRegenConfirm(false); return }
    try {
      if (!await ensureProposalDesignReady()) return
      await regenerateSection(project.id, selectedCode)
      syncAfterGeneration()
    } catch {
      toast.error('Regeneration failed.')
    } finally {
      setShowRegenConfirm(false)
    }
  }

  // ── "Apply fix" — see the pre-flight cost modal and SectionFixDiffModal rendered near the
  // regenerate-confirm modal below. Opens the cost-confirm step for one section's grouped
  // LlmJudged issues (see groupIssuesBySection).
  const handleApplyFixClick = (sectionCode: string, issues: AlignmentIssue[]) => {
    setApplyFixTarget({ sectionCode, issues })
  }

  // Cost-confirm step's Confirm button: fires the actual preview (Claude) call and opens the
  // diff modal on success. Credits are only reserved by this call, not committed — Cancel on
  // the diff modal releases the reservation via discardSectionFix.
  const confirmApplyFix = async () => {
    if (!applyFixTarget) return
    const { sectionCode, issues } = applyFixTarget
    setApplyFixTarget(null)
    if (!hasEnoughCreditsForSection()) return
    setIsApplyingFix(true)
    try {
      const preview = await applySectionFix(project.id, sectionCode, issues)
      setSectionFixPreview(preview)
    } catch {
      toast.error('Could not generate a fix for this section.')
    } finally {
      setIsApplyingFix(false)
    }
  }

  const handleAcceptSectionFix = async () => {
    if (!sectionFixPreview) return
    setIsConfirmingFix(true)
    try {
      await confirmSectionFix(project.id, sectionFixPreview.sectionCode, sectionFixPreview.proposedContent)
      toast.success(`Section ${sectionFixPreview.sectionCode} updated.`)
      setSectionFixPreview(null)
      // Re-run the merged alignment+quality check so the banner reflects the correction —
      // mirrors what the student would otherwise do manually by re-clicking "Check".
      if (alignment) handleValidate()
    } catch (err) {
      toast.error(extractErrorMessage(err) ?? 'Could not save the fix.')
    } finally {
      setIsConfirmingFix(false)
    }
  }

  const handleCancelSectionFix = async () => {
    if (!sectionFixPreview) return
    const { sectionCode } = sectionFixPreview
    setSectionFixPreview(null)
    try {
      await discardSectionFix(project.id)
    } catch {
      // Best-effort — the stale-reservation reconciler is the safety net if this fails.
      console.warn(`discardSectionFix failed for section ${sectionCode}`)
    }
  }

  const handleApprove = async (acknowledgeConflicts = false) => {
    // A double mousedown/click on the Approve button (DocumentSurface.tsx) has no button-level
    // guard of its own — each overlapping call would otherwise reach the same 409 and stack a
    // duplicate "unresolved citation issue" toast. Only blocks concurrent invocations; a
    // sequential retry from a toast's own "Approve anyway" button runs after this has already
    // settled and released the lock in `finally`, so it is never blocked by this guard.
    if (isApprovingRef.current) return
    isApprovingRef.current = true
    try {
    if (isDirty) await handleSave()
    try {
      // Autonomous Agent projects are explicitly hands-off: generated sections must not pause
      // for the same citation/fact acknowledgement that protects the interactive Generator flow.
      // The server still runs every integrity check and records/dismisses its flags through the
      // normal acknowledged-approval path; this only removes the redundant human confirmation.
      const acknowledgeAgentIssues = project.generatorMode === 'AGENT' || acknowledgeConflicts
      await approveSection(project.id, selectedCode, acknowledgeAgentIssues)
      toast.success(`Section ${selectedCode} approved.`)
    } catch (err) {
      // client.ts's response interceptor already unwraps any structured `{ error: {...} }`
      // response body and rejects with that plain ApiError object directly (see its "Surface
      // structured ApiError" block) — by the time it gets here, `err` is no longer an
      // AxiosError at all, so `axios.isAxiosError(err)` is always false and this never matched
      // anything (FACT_CONFLICT included — same dormant bug, not something new).
      const errorCode = (err as ApiError | undefined)?.code

      // FACT_CONFLICT (409) — this section's own stated facts contradict an earlier chapter
      // (see CheckFactsConsistencyAsync). Show the competing values here: a generic warning made
      // it impossible to make an informed choice and encouraged blindly approving bad results.
      if (errorCode === 'FACT_CONFLICT') {
        const responseConflicts = ((err as ApiError)?.details as { conflicts?: FactConflict[] } | undefined)?.conflicts
        const latestConflicts = (responseConflicts?.length ? responseConflicts : await researchApi.getFactConflicts(project.id)
          .catch(() => factConflicts))
          .filter(conflict => conflict.conflictingSectionCode === selectedCode)
        if (latestConflicts.length > 0) {
          setFactConflicts(prev => {
            const retained = prev.filter(existing =>
              !latestConflicts.some(conflict => conflict.id === existing.id))
            return [...latestConflicts, ...retained]
          })
        }

        toast((t) => (
          <div className="flex max-w-[430px] flex-col gap-2 text-[13px]">
            <span className="font-semibold text-amber-800">
              Review {latestConflicts.length || 'the'} fact conflict{latestConflicts.length === 1 ? '' : 's'} before approval.
            </span>
            {latestConflicts.slice(0, 3).map(conflict => (
              <div key={conflict.id} className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[12px] leading-snug">
                <div className="font-medium text-slate-800">{conflict.factKey.replaceAll('_', ' ')}</div>
                <div className="mt-1 text-slate-600">
                  Section {conflict.conflictingSectionCode}: <strong>“{conflict.conflictingValue}”</strong>
                </div>
                <div className="text-slate-600">
                  Section {conflict.canonicalSourceSectionCode}: <strong>“{conflict.canonicalValue}”</strong>
                </div>
                {conflict.conflictingExcerpt && (
                  <div className="mt-1 line-clamp-2 italic text-slate-500">“{conflict.conflictingExcerpt}”</div>
                )}
              </div>
            ))}
            {latestConflicts.length > 3 && (
              <span className="text-[12px] text-slate-500">And {latestConflicts.length - 3} more conflict(s).</span>
            )}
            <span className="text-[12px] text-slate-600">
              Correct or regenerate the section when the new value is wrong. Only override when you have verified the new value.
            </span>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => { toast.dismiss(t.id); handleApprove(true) }}
                className="font-semibold text-amber-700 hover:text-amber-900"
              >
                I verified it — approve
              </button>
              <button onClick={() => toast.dismiss(t.id)} className="text-slate-500 hover:text-slate-700">
                Cancel
              </button>
            </div>
          </div>
        ), { duration: 30000 })
        return
      }

      // UNRESOLVED_CITATION_GAP (409) — the model wrote "[CITATION NEEDED]" rather than force a
      // citation that didn't fit (see VerifyCitationIntegrityAsync). Same override pattern as
      // FACT_CONFLICT: let the student add a real source first, or explicitly approve as-is.
      if (errorCode === 'UNRESOLVED_CITATION_GAP') {
        toast((t) => (
          <div className="flex flex-col gap-2 text-[13px]">
            <span>This section still has an unresolved "[CITATION NEEDED]" gap — search the text for it and add a real source, or approve anyway.</span>
            <div className="flex gap-3">
              <button
                onClick={() => { toast.dismiss(t.id); handleApprove(true) }}
                className="font-semibold text-amber-700 hover:text-amber-900"
              >
                Approve anyway
              </button>
              <button onClick={() => toast.dismiss(t.id)} className="text-slate-500 hover:text-slate-700">
                Cancel
              </button>
            </div>
          </div>
        ), { duration: 10000 })
        return
      }

      // CITATION_INTEGRITY_BLOCKED (409) — an open citation flag on this section is a claim the
      // real source doesn't support (ClaimContentMismatch) or an implausible publication year.
      if (errorCode === 'CITATION_INTEGRITY_BLOCKED') {
        const latestFlags = await researchApi.getCitationFlags(project.id, selectedCode)
          .catch(() => citationFlags)
        const blockingFlags = (latestFlags ?? []).filter(flag =>
          flag.status === 'Open'
          && flag.mismatchTypes.some(type =>
            type === 'ClaimContentMismatch' || type === 'ImplausibleYear' || type === 'UnresolvedCitation'
            || type === 'GeographicMismatch' || type === 'GeneralizationBeyondSample'
            || type === 'PopulationScopeViolation'))

        toast((t) => (
          <div className="flex flex-col gap-2 text-[13px]">
            <span>
              This section has {blockingFlags.length > 0
                ? `${blockingFlags.length} unresolved citation issue${blockingFlags.length === 1 ? '' : 's'}`
                : 'an unresolved citation issue'}. Review the flagged claim and verified source, or approve anyway.
            </span>
            <div className="flex gap-3 mt-1">
              <button
                onClick={() => { toast.dismiss(t.id); handleOpenReferences() }}
                className="font-semibold text-[#7c3aed] hover:text-[#6d28d9]"
              >
                Review issues
              </button>
              <button
                onClick={() => { toast.dismiss(t.id); handleApprove(true) }}
                className="font-semibold text-amber-700 hover:text-amber-900"
              >
                Approve anyway
              </button>
              <button onClick={() => toast.dismiss(t.id)} className="text-slate-500 hover:text-slate-700">
                Cancel
              </button>
            </div>
          </div>
        ), { duration: 12000 })
        return
      }

      // PROSE_BODY_MISSING (409) — every non-empty line in this section's body is reference-list-
      // shaped (Author (Year) 'Title'...) with no prose sentence anywhere. Regenerating is the
      // right fix (the model didn't follow the "continuous prose" instruction), so offer that
      // directly rather than the "approve anyway" pattern used for citation-content flags.
      // METHODOLOGY_VIOLATION (409) — this section contradicts the project's confirmed methodology
      // (the deterministic rules plus the AI check in MethodologyConsistencyVerifier). This used to
      // fall through to a generic toast that gave a count but not the passages, and offered no way to
      // act on "fix the flagged passage(s), or explicitly approve anyway". Show what was flagged.
      if (errorCode === 'METHODOLOGY_VIOLATION') {
        const violations = ((err as ApiError)?.details as { violations?: MethodologyViolation[] } | undefined)?.violations ?? []
        const ordered = [...violations].sort((a, b) => (a.severity === 'Blocking' ? 0 : 1) - (b.severity === 'Blocking' ? 0 : 1))
        // The explanations are long, so this panel can be taller than the screen: it scrolls, the title row
        // carries a close button, and the actions sit directly under the title instead of at the bottom,
        // where they used to be pushed off-screen with no way to dismiss the panel.
        toast((t) => (
          <div className="flex max-h-[80vh] w-[440px] max-w-full flex-col gap-2 overflow-y-auto text-[13px]">
            <div className="flex items-start justify-between gap-3">
              <span className="font-semibold text-amber-800">
                {violations.length || 'Some'} passage{violations.length === 1 ? '' : 's'} in {selectedCode} contradict{violations.length === 1 ? 's' : ''} this project's confirmed methodology.
              </span>
              <button
                type="button"
                aria-label="Close"
                onClick={() => toast.dismiss(t.id)}
                className="shrink-0 rounded px-1.5 text-[16px] leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => { toast.dismiss(t.id); handleRegenerate() }}
                className="font-semibold text-[#7c3aed] hover:text-[#6d28d9]"
              >
                Regenerate section
              </button>
              <button
                onClick={() => { toast.dismiss(t.id); handleApprove(true) }}
                className="font-semibold text-amber-700 hover:text-amber-900"
              >
                Approve anyway
              </button>
              <button onClick={() => toast.dismiss(t.id)} className="text-slate-500 hover:text-slate-700">
                Dismiss
              </button>
            </div>
            {ordered.slice(0, 3).map((v, i) => (
              <div key={i} className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[12px] leading-snug">
                <div className="line-clamp-3 italic text-slate-700">“{v.quote}”</div>
                <div className="mt-1 text-slate-600">{v.explanation}</div>
                {v.suggestedCorrection && (
                  <div className="mt-1 text-slate-600"><strong>Suggested: </strong>{v.suggestedCorrection}</div>
                )}
              </div>
            ))}
            {violations.length > 3 && (
              <span className="text-[12px] text-slate-500">And {violations.length - 3} more.</span>
            )}
            <span className="text-[12px] text-slate-600">
              If the confirmed methodology itself is incomplete or wrong (for example no data-collection method is set), correct it on the Methodology Type step rather than editing the text.
            </span>
          </div>
        ), { duration: 30000 })
        return
      }

      if (errorCode === 'PROSE_BODY_MISSING') {
        toast((t) => (
          <div className="flex flex-col gap-2 text-[13px]">
            <span>This section has no prose paragraph — its content is only reference-list lines. Regenerate it, or approve anyway.</span>
            <div className="flex gap-3">
              <button
                onClick={() => { toast.dismiss(t.id); handleRegenerate() }}
                className="font-semibold text-[#7c3aed] hover:text-[#6d28d9]"
              >
                Regenerate section
              </button>
              <button
                onClick={() => { toast.dismiss(t.id); handleApprove(true) }}
                className="font-semibold text-amber-700 hover:text-amber-900"
              >
                Approve anyway
              </button>
              <button onClick={() => toast.dismiss(t.id)} className="text-slate-500 hover:text-slate-700">
                Cancel
              </button>
            </div>
          </div>
        ), { duration: 12000 })
        return
      }

      // CITATION_TARGET_SHORTFALL (409) — approval validates the live editor content,
      // not stale generation metadata. A citation-required section with no resolvable
      // source must be regenerated/revised before it can be approved.
      if (errorCode === 'CITATION_TARGET_SHORTFALL') {
        toast((t) => (
          <div className="flex flex-col gap-2 text-[13px]">
            <span>
              Section {selectedCode} does not contain enough verified in-text citations. Regenerate it with project literature, or review the available sources.
            </span>
            <div className="flex gap-3 mt-1">
              <button
                onClick={() => { toast.dismiss(t.id); handleRegenerate() }}
                className="font-semibold text-[#7c3aed] hover:text-[#6d28d9]"
              >
                Regenerate with sources
              </button>
              <button
                onClick={() => { toast.dismiss(t.id); handleOpenReferences() }}
                className="font-semibold text-slate-700 hover:text-slate-900"
              >
                Review references
              </button>
              <button
                onClick={() => { toast.dismiss(t.id); handleApprove(true) }}
                className="font-semibold text-amber-700 hover:text-amber-900"
              >
                Approve anyway
              </button>
              <button onClick={() => toast.dismiss(t.id)} className="text-slate-500 hover:text-slate-700">
                Cancel
              </button>
            </div>
          </div>
        ), { duration: 12000 })
        return
      }

      toast.error(extractErrorMessage(err) ?? 'Could not approve section.')
    }
    } finally {
      isApprovingRef.current = false
    }
  }

  const handleValidate = async () => {
    setIsValidating(true)
    try {
      // Alignment checks cross-section coherence; quality checks content-quality rules
      // (gap explicitness, methodology justification, limitations honesty, proportionality,
      // style) — run both and merge into one banner since they share the same result shape.
      const [alignmentResult, qualityResult] = await Promise.all([
        validateAlignment(project.id),
        validateQuality(project.id),
      ])
      const issues = [...alignmentResult.issues, ...qualityResult.issues]
      const messages = [alignmentResult.message, qualityResult.message].filter(Boolean)
      setAlignment({
        assessmentStatus: alignmentResult.assessmentStatus === 'Unknown' || qualityResult.assessmentStatus === 'Unknown' ? 'Unknown' : 'Completed',
        isValid: alignmentResult.isValid && qualityResult.isValid,
        issues,
        message: messages.join(' '),
      })
    } catch {
      toast.error('Alignment check failed.')
    } finally {
      setIsValidating(false)
    }
  }

  const handleExport = async () => {
    if (isDirty) await handleSave()
    setIsExporting(true)
    const toastId = toast.loading(isThesisOrDissertation ? 'Building thesis .docx…' : 'Building .docx — this may take a moment…')
    try {
      if (isThesisOrDissertation) await exportThesisDocx(project.id)
      else await exportDocx(project.id)
      toast.success(isThesisOrDissertation ? 'Thesis downloaded.' : 'Document downloaded.', { id: toastId })
    } catch (err) {
      toast.error((err as ApiError | undefined)?.message ?? 'Thesis export was blocked.', { id: toastId })
    } finally {
      setIsExporting(false)
    }
  }

  const isGenerating = activeSection?.status === 'Generating'
  const hasContent   = (activeSection?.content ?? '').trim().length > 0
  const wordCount    = countBodyWords(editorContent)

  // Live token stream (see ResearchController.StreamSectionDraft) — purely additive to the poll
  // below, which remains the sole source of truth for the Generating -> Draft transition. If the
  // stream never connects or drops, streamingContent just stays empty/stale and the poll's own
  // refetch is what actually ends the "Generating" UI state.
  const { streamingContent, startStream, stopStream } = useSectionDraftStream()

  // A section can flip Generating -> Draft server-side without this page's own
  // generateSection/regenerateSection call ever resolving here — the autonomous
  // whole-document flow (ProposalGenerationJob, started from Proposal Studio) drives
  // that transition entirely server-side. Without this poll, a section that was
  // already "Generating" when this page mounted stays stuck showing that status
  // forever once the background job actually finishes it, since nothing else
  // re-fetches sections for this page. Mirrors the 2.5s poll AutonomousProposalTools
  // already uses to track the same job's overall progress.
  //
  // Background tabs get their setInterval throttled by the browser (Chrome can back
  // this off to roughly once a minute, longer if the tab stays hidden a while) — a
  // student who alt-tabs away mid-generation can otherwise sit on a stale "Generating"
  // screen for minutes after the backend actually finished. The visibility/focus
  // listeners force an immediate refetch the moment the tab is looked at again, so the
  // interval is only the belt to that listener's suspenders.
  useEffect(() => {
    if (!isGenerating || !activeSection) return

    startStream(project.id, activeSection.code)

    const poll = () => { loadSections(project.id).catch(err => console.error('Section status poll failed:', err)) }
    const onVisible = () => { if (document.visibilityState === 'visible') poll() }

    const timer = window.setInterval(poll, 3000)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', poll)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', poll)
      stopStream()
    }
  }, [isGenerating, activeSection?.code, project.id, loadSections, startStream, stopStream])

  // Stall detection — a single section has no incremental progress signal (it's atomic
  // generate-or-not), so "stuck" here just means "Generating for longer than any real Claude
  // call + retries should ever take". A dead ProposalGenerationJob (e.g. the server process
  // restarted mid-chapter) otherwise leaves this spinning with zero feedback until the backend's
  // own stale-generation reconciliation job catches up (runs every 5 min, 10 min staleness
  // threshold — see HangfireJobs.ReconcileStaleProposalGenerationsAsync) — this just tells the
  // student sooner that it's probably fine to keep waiting rather than assume the page is frozen.
  const generatingSinceRef = useRef<number | null>(null)
  const [isSectionStalled, setIsSectionStalled] = useState(false)

  useEffect(() => {
    generatingSinceRef.current = isGenerating ? Date.now() : null
    setIsSectionStalled(false)
  }, [activeSection?.code])

  useEffect(() => {
    if (!isGenerating) {
      generatingSinceRef.current = null
      setIsSectionStalled(false)
      return
    }
    if (generatingSinceRef.current === null) generatingSinceRef.current = Date.now()

    const STALL_MS = 3 * 60_000
    const check = () => {
      setIsSectionStalled(!!generatingSinceRef.current && Date.now() - generatingSinceRef.current > STALL_MS)
    }
    check()
    const timer = window.setInterval(check, 15_000)
    return () => window.clearInterval(timer)
  }, [isGenerating])

  // Background-failure toast — generate/regenerate now return as soon as the run is enqueued
  // (see api/research.ts's generateSection/regenerateSection comments), long before
  // SectionGenerationJob could actually fail, so handleGenerate/handleRegenerate's own try/catch
  // never sees that failure. This is the other half: catch the Generating -> NotStarted
  // transition this same poll already drives and surface activeSection.generationError once,
  // the same way a synchronous failure would have. wasGeneratingRef is reset on every section
  // switch so an OLD error already sitting on a section you just navigated to (not a transition
  // you actually watched happen) never re-fires this.
  const wasGeneratingRef = useRef(false)

  useEffect(() => {
    wasGeneratingRef.current = isGenerating
  }, [activeSection?.code])

  useEffect(() => {
    if (wasGeneratingRef.current && !isGenerating) {
      if (activeSection?.generationError) toast.error(activeSection.generationError)
      // Generation can add new sources to the project's literature pool (OpenAlex fetch/
      // enrichment) — refetch so citations drafted from them resolve immediately instead of
      // showing "Unmatched" in CitationPopover until the page is reloaded. Cheap DB read, no LLM.
      refetchLiterature()
    }
    wasGeneratingRef.current = isGenerating
  }, [isGenerating, activeSection?.generationError])

  // Expose Check Alignment / Export to the page-level topbar via ref (it owns those
  // buttons but not the per-section state/handlers they depend on).
  useEffect(() => {
    if (!actionsRef) return
    actionsRef.current = { validate: handleValidate, export: handleExport, openReferences: handleOpenReferences }
    return () => { actionsRef.current = null }
  })

  // Push the reactive bits (button labels/disabled state) up via state, not the ref —
  // a ref mutation alone would not re-render the parent's topbar buttons.
  useEffect(() => {
    onActionsStateChange?.({ isValidating, isExporting, isThesisOrDissertation })
  }, [isValidating, isExporting, isThesisOrDissertation, onActionsStateChange])

  // Let the parent know the active section's approval status, so the bottom-bar Next
  // button can gate on it.
  useEffect(() => {
    onActiveSectionChange?.(activeSection ?? null)
  }, [activeSection, onActiveSectionChange])

  return (
    <div className="flex flex-col h-full bg-[#f8f9fb] overflow-hidden">

      {/* ── Alignment result banner (compact) ────────────────────────────────── */}
      {alignment && (
        <div className={cn(
          'shrink-0 border-b px-4 py-2 flex items-center gap-3',
          alignment.isValid ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200',
        )}>
          {alignment.isValid
            ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
            : <AlertCircle size={14} className="text-amber-500 shrink-0" />}

          <p className={cn('text-[12px] font-medium flex-1 truncate',
            alignment.isValid ? 'text-emerald-700' : 'text-amber-700')}>
            {alignment.assessmentStatus === 'Unknown' ? `Review incomplete. ${alignment.message}` : alignment.message}
          </p>

          {alignment.issues.length > 0 && (
            <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-200 text-amber-700">
              {alignment.issues.length} issue{alignment.issues.length > 1 ? 's' : ''}
            </span>
          )}

          <button
            onClick={() => setAlignment(null)}
            className="shrink-0 text-slate-400 hover:text-slate-600 ml-1"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Alignment issues detail (expandable list below banner) — grouped by section so a
          section with multiple eligible issues gets one "Apply fix" action, not one per issue. */}
      {alignment && !alignment.isValid && alignment.issues.length > 0 && (
        <div className="shrink-0 bg-amber-50 border-b border-amber-100 px-4 pb-2 max-h-[45vh] overflow-y-auto">
          <div className="space-y-2">
            {groupIssuesBySection(alignment.issues).map(group => (
              <div key={group.sectionCode} className="space-y-1">
                {group.issues.map((issue, i) => (
                  <div key={i} className="flex gap-2 text-[11px]">
                    <span className="shrink-0 font-bold text-amber-600 w-8">{issue.sectionCode}</span>
                    <span className="text-amber-700">
                      {issue.issue}
                      {issue.relatedSectionCodes && issue.relatedSectionCodes.length > 0 && (
                        <span className="text-amber-500 not-italic">
                          {' '}(also relates to: {issue.relatedSectionCodes.join(', ')})
                        </span>
                      )}
                    </span>
                    <span className="text-slate-400 shrink-0">→</span>
                    <span className="text-slate-600 italic">{issue.suggestion}</span>
                  </div>
                ))}
                {group.eligibleIssues.length > 0 && (
                  <div className="pl-10">
                    <button
                      onClick={() => handleApplyFixClick(group.sectionCode, group.eligibleIssues)}
                      disabled={isApplyingFix}
                      className="flex items-center gap-1 text-[11px] font-medium text-[#7c3aed] hover:text-[#6d28d9] transition-colors disabled:opacity-50"
                    >
                      <Sparkles size={11} />
                      Apply fix{group.eligibleIssues.length > 1 ? ` (${group.eligibleIssues.length})` : ''}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Apply-fix: pre-flight cost confirm ───────────────────────────────── */}
      {applyFixTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="flex flex-col items-center px-8 pt-8 pb-4 text-center">
              <div className="w-12 h-12 rounded-full bg-violet-50 flex items-center justify-center mb-4">
                <Sparkles size={22} className="text-[#7c3aed]" />
              </div>
              <h3 className="text-[16px] font-bold text-slate-800 mb-1">
                Apply fix to section {applyFixTarget.sectionCode}?
              </h3>
              <p className="text-[13px] text-slate-500 leading-relaxed">
                Claude will propose a correction addressing{' '}
                {applyFixTarget.issues.length > 1 ? `these ${applyFixTarget.issues.length} issues` : 'this issue'}{' '}
                for your review — nothing is saved until you accept it.
              </p>
            </div>

            <p className="px-6 pb-2 text-[12px] text-slate-500 text-center">
              This will use {sectionGenerationCost} credits.
            </p>

            <div className="flex gap-2 px-6 pb-6 pt-2">
              <button
                onClick={() => setApplyFixTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-[13px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmApplyFix}
                className="flex-1 py-2.5 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-[13px] font-semibold transition-colors shadow-md shadow-[#7c3aed]/20 flex items-center justify-center gap-1.5"
              >
                <Sparkles size={13} /> Apply fix
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Apply-fix: waiting on the preview call ───────────────────────────── */}
      {isApplyingFix && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl px-8 py-6 flex items-center gap-3">
            <Loader2 size={18} className="animate-spin text-[#7c3aed]" />
            <span className="text-[13px] font-medium text-slate-600">Generating a fix…</span>
          </div>
        </div>
      )}

      {/* ── Apply-fix: diff preview (Apply persists, Cancel releases credits) ────── */}
      {sectionFixPreview && (
        <SectionFixDiffModal
          preview={sectionFixPreview}
          isConfirming={isConfirmingFix}
          onAccept={handleAcceptSectionFix}
          onCancel={handleCancelSectionFix}
        />
      )}

      {citationFix && (
        <SectionFixDiffModal
          preview={citationFix.preview}
          isConfirming={isConfirmingCitationFix}
          onAccept={handleConfirmCitationFix}
          onCancel={handleCancelCitationFix}
        />
      )}

      {/* ── Facts registry conflicts (actionable — dismiss/accept-new) ──────────── */}
      <FactConflictsPanel
        conflicts={factConflicts}
        onDismiss={handleDismissFactConflict}
        onAcceptNew={handleAcceptNewFactValue}
      />

      {/* ── Thesis Studio: audit-gated transition to thesis ──────────────────── */}
      {showThesisAuditPanel && (
        <ThesisAuditPanel
          project={project}
          audit={allThesisAudits[project.id]}
          isLoadingAudit={isLoadingThesisAudit}
          isTransitioning={isTransitioning}
          onRunAudit={() => loadThesisAudit(project.id).catch(() => toast.error('Audit failed — please try again.'))}
          onAnswer={(questionKey, answer) =>
            answerThesisAuditQuestion(project.id, questionKey, answer)
              .catch(() => toast.error('Could not save your answer — please try again.'))
          }
          onTransition={() =>
            transitionToThesis(project.id).catch(() =>
              toast.error('Transition failed — resolve the audit\'s blocking questions first.'),
            )
          }
        />
      )}

      {/* ── Two-panel body ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Right: section editor — viewport-locked, internal scroll per-component */}
        <div ref={rightPanelRef} className="flex-1 flex flex-col min-h-0 overflow-hidden">

          {/* ── Section context strip: word count + References only (title lives in
                DocumentSurface's own card header; Check Alignment / Export live in the
                page-level topbar — see ResearchAgentPage's topbar for those). ──────── */}
          {activeSection && (
            <div className="shrink-0 flex items-center justify-end gap-2 px-5 py-2" style={{ background: 'var(--surface-sidebar)', borderBottom: '0.5px solid var(--border-hairline)' }}>
              <span
                className="shrink-0 text-[10px] font-semibold rounded-full px-2 py-0.5"
                style={{ color: 'var(--color-purple-text)', background: '#fff', border: '0.5px solid var(--color-purple-tint)' }}
              >
                {wordCount.toLocaleString()}w
              </span>
              <button
                onClick={handleOpenReferences}
                title="Insert a reference"
                className="flex items-center gap-1 text-[11px] rounded-lg px-2.5 py-1 hover:bg-white transition-colors shrink-0"
                style={{ color: 'var(--color-purple-text)', background: '#fff', border: '0.5px solid var(--color-purple-tint)' }}
              >
                <BookMarked size={11} />
                References
              </button>
              <button
                onClick={handleOpenVersionHistory}
                title="Version history"
                className="flex items-center gap-1 text-[11px] rounded-lg px-2.5 py-1 hover:bg-white transition-colors shrink-0"
                style={{ color: 'var(--color-purple-text)', background: '#fff', border: '0.5px solid var(--color-purple-tint)' }}
              >
                <History size={11} />
                History
              </button>
              {/* Thesis Foundation (Phase 2), Step 4 — evidence coverage audit, scoped to 2.0
                  (Literature Review) only for now; see docs/OPEN_ITEMS.md #17. */}
              {selectedCode === '2.0' && (
                <button
                  onClick={handleOpenEvidenceCoverage}
                  title="Evidence coverage"
                  className="flex items-center gap-1 text-[11px] rounded-lg px-2.5 py-1 hover:bg-white transition-colors shrink-0"
                  style={{ color: 'var(--color-purple-text)', background: '#fff', border: '0.5px solid var(--color-purple-tint)' }}
                >
                  <Sparkles size={11} />
                  Evidence
                </button>
              )}
            </div>
          )}

          {!activeSection && !isSpecialSection
            ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
                <Loader2 size={24} className="animate-spin text-[#7c3aed]" />
                <p className="text-[13px] font-medium text-slate-700">
                  {isInitializingSections ? 'Setting up sections…' : 'Loading section…'}
                </p>
                {!isInitializingSections && (
                  <button
                    onClick={() => {
                      recoveryCalledRef.current = false
                      setIsInitializingSections(true)
                      initSections(project.id)
                        .catch(() => toast.error('Could not create missing sections.'))
                        .finally(() => setIsInitializingSections(false))
                    }}
                    className="text-[12px] text-[#7c3aed] underline underline-offset-2 hover:text-[#6d28d9]"
                  >
                    Retry
                  </button>
                )}
              </div>
            )
            : selectedCode === 'defence'
            ? <div className="flex-1 overflow-y-auto"><DefencePrepView project={project} /></div>
            : selectedCode === '4.4'
            ? <div className="flex-1 overflow-y-auto"><HypothesisEditor projectId={project.id} section={activeSection} methodologyType={project.methodologyType} /></div>
            : activeSection && (
              <>
                {/* ── Regenerate confirmation modal ───────────────────────── */}
                {/* "A copy is saved to History" is accurate, not reassurance copy — confirmed via
                    discovery: SectionVersionHistoryDrawer snapshots a version the first time a
                    Draft is regenerated or hand-edited, which is exactly the Edited/Approved case
                    this confirmation gates on (Research Agent UX audit, 2026-10-03). */}
                {showRegenConfirm && (
                  <ConfirmActionModal
                    title="Regenerate this section?"
                    message={`Your current draft of ${activeSection.code}: ${activeSection.title} will be replaced. A copy is saved to History, so you can restore it afterwards.${activeSection.status === 'Approved' ? ' This section is currently Approved — regenerating resets it to Draft and you\'ll need to re-approve it.' : ''}`}
                    confirmLabel={`Regenerate (${sectionGenerationCost} credits)`}
                    tone="reversible"
                    icon={<RefreshCw size={20} className="text-purple-accent" />}
                    onClose={() => setShowRegenConfirm(false)}
                    onConfirm={confirmRegenerate}
                  >
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-[11px] font-medium text-slate-500 mb-0.5">
                        Current draft &middot; {activeSection.wordCount.toLocaleString()} words
                      </p>
                      <p className="text-[12px] text-slate-600 line-clamp-2">
                        {regenPreviewExcerpt || 'No content yet.'}
                      </p>
                    </div>
                  </ConfirmActionModal>
                )}

                <ReviewNotesPanel
                  projectId={project.id}
                  sectionCode={activeSection.code}
                  refreshKey={`${activeSection.status}:${activeSection.citationsPendingVerification}`}
                />

                <DocumentSurface
                  ref={documentSurfaceRef}
                  key={activeSection.code}
                  sectionCode={activeSection.code}
                  sectionTitle={activeSection.title}
                  sectionDescription={getSectionDescription(activeSection.code)}
                  content={editorContent}
                  status={activeSection.status}
                  wordCount={wordCount}
                  isGenerating={isGenerating}
                  streamingContent={streamingContent}
                  isStalled={isSectionStalled}
                  isSaving={isSaving}
                  hasContent={hasContent}
                  citationStyle={project.citationStyle}
                  literature={literature}
                  bibliography={bibliography}
                  citationFlags={citationFlags}
                  citationsPendingVerification={activeSection.citationsPendingVerification}
                  methodologyReviewAdvisory={activeSection.methodologyReviewAdvisory}
                  onContentChange={handleContentChange}
                  onSave={() => handleSave()}
                  onGenerate={(wc) => handleGenerate(wc)}
                  generateImmediately={(Number.parseInt(selectedCode.split('.')[0] ?? '', 10) || 0) >= 6}
                  defaultTargetWordCount={defaultTargetWordCount}
                  onRegenerate={handleRegenerate}
                  onApprove={handleApprove}
                  onRequestBibliography={handleRequestBibliography}
                  onRequestLiteratureRefresh={refetchLiterature}
                  onResolveCitationGap={handleOpenReferences}
                  onOpenReferences={handleOpenReferences}
                  busyCitationFlagId={busyCitationFlagId}
                  onRepairCitationFlag={handleRepairCitationFlag}
                  onRemoveCitationClaim={handleRemoveCitationClaim}
                  onDismissCitationFlag={handleDismissCitationFlag}
                  onChooseCitationSource={handleChooseCitationSource}
                />

                <ReferencesDrawer
                  open={showReferencesDrawer}
                  onClose={() => setShowReferencesDrawer(false)}
                  bibliography={bibliographyState}
                  entries={bibliography ?? []}
                  citationStyle={project.citationStyle}
                  onInsert={handleInsertCitation}
                  onRefresh={fetchBibliography}
                  onManageFull={handleManageFullReferences}
                  flags={citationFlags}
                  literature={literature ?? []}
                  busyFlagId={busyCitationFlagId}
                  onRepairFlag={handleRepairCitationFlag}
                  onRemoveClaim={handleRemoveCitationClaim}
                  onDismissFlag={handleDismissCitationFlag}
                  onChooseSource={handleChooseCitationSource}
                />

                <SectionVersionHistoryDrawer
                  open={showVersionHistory}
                  onClose={() => setShowVersionHistory(false)}
                  loading={isLoadingSectionVersions}
                  versions={allSectionVersions[`${project.id}:${selectedCode}`] ?? []}
                  restoringVersion={restoringVersion}
                  onRestore={handleRestoreVersion}
                  onRefresh={() => loadSectionVersions(project.id, selectedCode).catch(() => toast.error('Could not refresh version history.'))}
                />

                {selectedCode === '2.0' && (
                  <EvidenceCoverageDrawer
                    open={showEvidenceCoverage}
                    onClose={() => setShowEvidenceCoverage(false)}
                    loading={loadingEvidenceCoverage}
                    audit={allEvidenceCoverageAudits[`${project.id}:${selectedCode}`] ?? null}
                    onRefresh={handleOpenEvidenceCoverage}
                  />
                )}
              </>
            )}
        </div>
      </div>

    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

// Module-level flag: survives React 18 StrictMode unmount/remount cycles.
// A useRef(false) resets to false on remount, causing double-creation in development.
let _projectCreationInFlight = false

export default function ResearchAgentPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { projects, createProject, loadProject, syncProject, setStep, updateProject } = useResearchStore()

  const [citeMenuOpen, setCiteMenuOpen] = useState(false)
  const [loadError,    setLoadError]    = useState(false)
  // StepRail becomes a mobile slide-in drawer below the md breakpoint; desktop ignores this.
  const [railOpen,     setRailOpen]     = useState(false)

  // Check Alignment / Export live in this topbar, but the handlers + isDirty/isSaving
  // state they depend on belong to ChapterWriterView — chapterActionsRef exposes the
  // callables, chapterActionsState carries the reactive flags that drive button UI.
  const chapterActionsRef = useRef<ChapterActions | null>(null)
  const [chapterActionsState, setChapterActionsState] = useState<ChapterActionsState>({
    isValidating: false, isExporting: false, isThesisOrDissertation: false,
  })
  const [activeChapterSection, setActiveChapterSection] = useState<ProjectSection | null>(null)
  // Real save-state signal — driven by the actual syncProject promise this page already
  // calls on every step change, not a decorative "Progress automatically saved" label with
  // nothing behind it (Research Agent UX audit, 2026-10-03). Resets to idle a couple of
  // seconds after a successful save so it doesn't sit there permanently.
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const saveStateResetRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Bootstrap: create project on backend then navigate to its real ID.
  // The module-level flag prevents double-creation from StrictMode remounts.
  useEffect(() => {
    if (projectId !== 'new') return
    if (_projectCreationInFlight) return
    _projectCreationInFlight = true
    const mode  = (searchParams.get('mode')  ?? 'GENERATOR') as GeneratorMode
    const doc   = (searchParams.get('doc')   ?? 'PROPOSAL')  as DocumentMode
    const title = searchParams.get('title') ?? ''
    createProject({ generatorMode: mode, documentMode: doc, title: title || undefined })
      .then(p => {
        _projectCreationInFlight = false
        navigate(`/app/research-agent/${p.id}`, { replace: true })
      })
      .catch(() => {
        _projectCreationInFlight = false
        navigate('/app/proposal-studio', { replace: true })
      })
  }, [projectId])

  useEffect(() => {
    if (!projectId || projectId === 'new') return
    loadProject(projectId).catch(() => {
      if (!projects.some(p => p.id === projectId)) setLoadError(true)
    })
  }, [projectId])

  const project = projects.find(p => p.id === projectId)

  // Proposal sections use the legacy numeric step index. Thesis sections are
  // addressed directly because Results/Discussion/Conclusion are not members
  // of the fixed proposal outline.
  const rawRequestedSectionCode = searchParams.get('section')?.trim() || null
  const requestedSectionCode = rawRequestedSectionCode && /^\d+(?:\.\d+)?$/.test(rawRequestedSectionCode)
    ? rawRequestedSectionCode
    : null

  useEffect(() => {
    if (!rawRequestedSectionCode || requestedSectionCode) return
    const cleaned = new URLSearchParams(searchParams)
    cleaned.delete('section')
    setSearchParams(cleaned, { replace: true })
  }, [rawRequestedSectionCode, requestedSectionCode, searchParams, setSearchParams])
  const urlStepNum = parseInt(searchParams.get('step') ?? '', 10)
  const requestedStepIndex = requestedSectionCode
    ? STEPS.findIndex(step => step.id === requestedSectionCode)
    : -1
  // A direct ?section= route is authoritative for every navigation surface, not only the
  // editor. Previously the editor used 7.0 while the rail/footer kept project.currentStep=5.5.
  const currentStep = requestedStepIndex >= 0
    ? requestedStepIndex
    : !isNaN(urlStepNum) && urlStepNum >= 0 && urlStepNum < STEPS.length
      ? urlStepNum
      : (project?.currentStep ?? 0)

  const stepType = requestedSectionCode ? 'chapter' : (STEPS[currentStep]?.type ?? 'wizard')
  const nextStep = currentStep < STEPS.length - 1 ? STEPS[currentStep + 1] : null

  const goToStep = (idx: number) => {
    if (idx < 0 || idx >= STEPS.length || !project) return
    setSearchParams({ step: String(idx) }, { replace: false })
    setStep(project.id, idx)
    setSaveState('saving')
    if (saveStateResetRef.current) clearTimeout(saveStateResetRef.current)
    syncProject(project.id)
      .then(() => {
        setSaveState('saved')
        saveStateResetRef.current = setTimeout(() => setSaveState('idle'), 2500)
      })
      .catch(err => { console.error(err); setSaveState('idle') })
  }

  const goNext = () => goToStep(currentStep + 1)
  const goBack = () => goToStep(currentStep - 1)

  // On the last step (Download) goNext's target index is out of bounds, so goToStep's own
  // bounds check silently no-ops — "Finish" looked clickable but genuinely did nothing. The
  // download itself already happens via the Download panel's own buttons on this page; Finish's
  // job is just to exit the wizard back to the project list.
  const handleFinish = () => navigate('/app/proposal-studio')

  // "Save and exit" — there's no dedicated save-and-exit action anywhere in the repo to reuse
  // (confirmed via discovery), so this just makes the already-real autosave explicit before
  // leaving, same as every other navigation away from a step already does.
  const handleSaveAndExit = () => {
    if (!project) return
    syncProject(project.id)
      .catch(console.error)
      .finally(() => navigate('/app/proposal-studio'))
  }

  const setCite = (style: CitationStyle) => {
    if (!project) return
    updateProject(project.id, { citationStyle: style })
    setCiteMenuOpen(false)
  }

  // Next button label and visual variant
  const nextLabel = (() => {
    if (currentStep >= STEPS.length - 1) return 'Finish'
    if (stepType === 'wizard' && nextStep?.type === 'chapter') return 'Start writing chapters'
    if (nextStep) return `Next: ${nextStep.label}`
    return 'Next'
  })()
  const nextVariant: 'default' | 'purple' | 'green' = (() => {
    if (currentStep >= STEPS.length - 1) return 'green'
    if (stepType === 'wizard' && nextStep?.type === 'chapter') return 'purple'
    return 'default'
  })()

  // Next must stay locked on a chapter step until the active section is Approved.
  const nextDisabledForChapter = stepType === 'chapter' && activeChapterSection?.status !== 'Approved'
  // Next must stay locked on Research Title until a title is actually chosen or written —
  // previously nothing blocked moving on with no title at all (Research Agent UX audit).
  const nextDisabledForTitle = STEPS[currentStep]?.id === 'research-title'
    && (!project?.title || project.title === 'Untitled Research Project')

  if (loadError) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 text-center px-6 bg-white">
        <AlertCircle size={32} className="text-slate-300" />
        <p className="text-[14px] font-semibold text-slate-700">Project not found</p>
        <p className="text-[12px] text-slate-400">This project may have been deleted or doesn't belong to your account.</p>
        <button
          onClick={() => navigate('/app/proposal-studio')}
          className="mt-2 px-4 py-2 rounded-lg bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-[13px] font-medium transition-colors"
        >
          Back to Studio
        </button>
      </div>
    )
  }

  if (!project || projectId === 'new') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
        <Loader2 size={24} className="animate-spin text-[#7c3aed]" />
      </div>
    )
  }

  const docTitle = (project.title || 'Untitled Project').slice(0, 28)

  return (
    <div className="fixed inset-0 z-50 flex" style={{ background: 'var(--surface-page)' }}>

      {/* ── 1. Tool Sidebar — 52px, all-light ───────────────────────────────── */}
      <ToolSidebar />

      {/* ── 2. Step Rail — 220px, mobile slide-in drawer below md ───────────── */}
      <StepRail
        currentStepIdx={currentStep}
        activeSectionCode={requestedSectionCode}
        onSelectSectionCode={code => {
          setSearchParams({ section: code }, { replace: false })
          setRailOpen(false)
        }}
        onSelectStep={idx => {
          // While a chapter is active, opening References shouldn't navigate away and
          // unmount the editor — it opens the in-context drawer instead so citations can
          // be inserted at the live cursor. From any other step (no editor to insert
          // into) it falls through to the normal full-page Master Bibliography view.
          if (STEPS[idx].id === 'references' && stepType === 'chapter' && chapterActionsRef.current) {
            chapterActionsRef.current.openReferences()
            setRailOpen(false)
            return
          }
          goToStep(idx)
          setRailOpen(false)
        }}
        project={project}
        isOpen={railOpen}
        onClose={() => setRailOpen(false)}
      />

      {/* ── 3. Main Panel ───────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Topbar — 44px */}
        <div
          className="shrink-0 h-11 flex items-center gap-2 px-4 bg-white"
          style={{ borderBottom: '0.5px solid var(--border-hairline)' }}
        >
          {/* Mobile-only rail toggle */}
          <button
            onClick={() => setRailOpen(true)}
            className="shrink-0 md:hidden flex items-center justify-center rounded-lg hover:bg-slate-50 transition-colors"
            style={{ width: 28, height: 28, color: 'var(--text-secondary)' }}
            aria-label="Open chapter list"
          >
            <Menu size={16} />
          </button>

          {/* Breadcrumb */}
          <span className="text-[12px] shrink-0" style={{ color: 'var(--text-muted)' }}>Research Agent</span>
          <span className="text-[12px] shrink-0" style={{ color: 'var(--border-strong)' }}>›</span>
          <span className="text-[12px] truncate max-w-[140px]" style={{ color: 'var(--text-secondary)' }} title={project.title}>{docTitle}</span>
          <span className="text-[12px] shrink-0" style={{ color: 'var(--border-strong)' }}>›</span>
          <span className="text-[12px] font-medium truncate max-w-[130px]" style={{ color: 'var(--text-primary)' }}>
            {requestedSectionCode
              ? activeChapterSection
                ? `${activeChapterSection.code} ${activeChapterSection.title}`
                : requestedSectionCode === '0.0' ? '0.0 Abstract'
                : requestedSectionCode === '6.0' ? '6.0 Results'
                : requestedSectionCode === '7.0' ? '7.0 Discussion'
                : requestedSectionCode === '8.0' ? '8.0 Conclusion'
                : requestedSectionCode
              : getStepLabel(STEPS[currentStep], project.methodologyType)}
          </span>

          {/* Saved indicator — driven by the real syncProject state, not decorative copy. */}
          {saveState !== 'idle' && (
            <span className="text-[11px] shrink-0 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
              {saveState === 'saving'
                ? <><Loader2 size={11} className="animate-spin" /> Saving…</>
                : <><Check size={11} style={{ color: 'var(--color-green)' }} /> Saved</>}
            </span>
          )}

          <div className="flex-1" />

          {/* Step counter lives in the sidebar header ("Step N of M · X% complete") —
              not repeated here to avoid showing the same fact twice in one screen. */}

          {/* Save and exit — makes the already-real autosave explicit before leaving. */}
          <button
            onClick={handleSaveAndExit}
            className="shrink-0 flex items-center gap-1.5 text-[12px] hover:bg-slate-50 transition-colors"
            style={{ height: 28, border: '0.5px solid var(--border-strong)', borderRadius: 6, padding: '0 10px', color: 'var(--text-secondary)' }}
          >
            Save and exit
          </button>

          {/* Check alignment / Export .docx — chapter writer view only. The handlers
              live inside ChapterWriterView (they close over isDirty/handleSave/project.id);
              this topbar just triggers them through chapterActionsRef. */}
          {stepType === 'chapter' && (
            <>
              <button
                onClick={() => chapterActionsRef.current?.validate()}
                disabled={chapterActionsState.isValidating}
                className="shrink-0 flex items-center gap-1.5 text-[12px] hover:bg-slate-50 transition-colors disabled:opacity-50"
                style={{ height: 28, border: '0.5px solid var(--border-strong)', borderRadius: 6, padding: '0 10px', color: 'var(--text-secondary)' }}
              >
                {chapterActionsState.isValidating ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
                Check alignment
              </button>

              <button
                onClick={() => chapterActionsRef.current?.export()}
                disabled={chapterActionsState.isExporting}
                className="shrink-0 flex items-center gap-1.5 text-[12px] hover:bg-slate-50 transition-colors disabled:opacity-50"
                style={{ height: 28, border: '0.5px solid var(--border-strong)', borderRadius: 6, padding: '0 10px', color: 'var(--text-secondary)' }}
              >
                {chapterActionsState.isExporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                {chapterActionsState.isThesisOrDissertation ? 'Export Thesis' : 'Export .docx'}
              </button>
            </>
          )}

          {/* Citation selector */}
          <div className="relative shrink-0">
            <button
              onClick={() => setCiteMenuOpen(v => !v)}
              className="flex items-center gap-1.5 text-[12px] hover:bg-slate-50 transition-colors"
              style={{ height: 28, border: '0.5px solid var(--border-strong)', borderRadius: 6, padding: '0 10px', color: 'var(--text-secondary)' }}
            >
              {CITATION_LABELS[project.citationStyle]} <ChevronDown size={11} />
            </button>
            {citeMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setCiteMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-xl z-20 py-1 overflow-hidden" style={{ border: '0.5px solid var(--border-hairline)' }}>
                  {(Object.keys(CITATION_LABELS) as CitationStyle[]).map(s => (
                    <button key={s} onClick={() => setCite(s)}
                      className={cn('w-full text-left px-3 py-1.5 text-[12px] transition-colors',
                        s === project.citationStyle
                          ? 'text-purple-accent bg-purple-tint font-medium'
                          : 'hover:bg-slate-50')}
                      style={s === project.citationStyle ? undefined : { color: 'var(--text-secondary)' }}>
                      {CITATION_LABELS[s]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-hidden relative" style={{ background: 'var(--surface-page)' }}>

          {/* Wizard / output steps */}
          <AnimatePresence mode="wait">
            {(stepType === 'wizard' || stepType === 'output') && (
              <motion.div
                key={currentStep}
                className="absolute inset-0 overflow-y-auto py-6 px-7"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
              >
                <>
                  {stepType === 'wizard' && (
                    <div className="max-w-3xl mx-auto mb-4">
                      <p className="text-[11px] uppercase tracking-[0.08em] mb-1" style={{ color: 'var(--text-muted)' }}>
                        Step {currentStep + 1} of {STEPS.length}
                      </p>
                      <h2 className="text-[18px] font-medium" style={{ color: 'var(--text-primary)' }}>{getStepLabel(STEPS[currentStep], project.methodologyType)}</h2>
                      {STEPS[currentStep].description && (
                        <p className="text-[13px] mt-1" style={{ color: 'var(--text-secondary)' }}>{STEPS[currentStep].description}</p>
                      )}
                    </div>
                  )}
                  <StepContent project={project} stepIdx={currentStep} onNext={goNext} />
                  <div className="h-20" />
                </>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Chapter writer — stays mounted to preserve TipTap editor state */}
          <div className={cn('absolute inset-0', stepType !== 'chapter' && 'hidden')}>
            <ChapterWriterView
              project={project}
              externalCode={requestedSectionCode ?? (stepType === 'chapter' ? STEPS[currentStep].id : undefined)}
              actionsRef={chapterActionsRef}
              onActionsStateChange={setChapterActionsState}
              onActiveSectionChange={setActiveChapterSection}
            />
          </div>
        </div>

        {/* Bottom nav — 48px */}
        <div
          className="shrink-0 h-12 flex items-center gap-3 px-4 bg-white"
          style={{ borderTop: '0.5px solid var(--border-hairline)' }}
        >
          {/* Previous */}
          <button
            onClick={goBack}
            disabled={currentStep === 0}
            aria-label="Go to previous step"
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[13px] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            style={{ border: '0.5px solid var(--border-strong)', color: 'var(--text-secondary)' }}
          >
            <ChevronLeft size={14} /> Previous
          </button>

          {/* Centre: a chapter-gating reason takes priority (real, actionable info); otherwise
              the save state — this used to repeat the page's own subtitle verbatim, which the
              Next button's "Next: {label}" text already conveyed (Research Agent UX audit). */}
          <p className="flex-1 text-center text-[12px]" style={{ color: 'var(--text-secondary)' }}>
            {stepType === 'chapter' && nextStep && nextDisabledForChapter
              ? `Approve this section to unlock ${nextStep.label}`
              : nextDisabledForTitle ? 'Choose or write a title to continue'
              : saveState === 'saving' ? 'Saving…'
              : saveState === 'saved' ? 'Saved'
              : ''}
          </p>

          {/* Next / Finish */}
          <Tooltip label={nextDisabledForTitle ? 'Choose or write a title to continue' : nextLabel}>
            <button
              onClick={currentStep >= STEPS.length - 1 ? handleFinish : goNext}
              disabled={(currentStep >= STEPS.length - 1 && nextVariant !== 'green') || nextDisabledForChapter || nextDisabledForTitle}
              aria-label={`Go to next step${nextStep ? `: ${nextStep.label}` : ''}`}
              className={cn(
                'flex items-center gap-2 px-5 py-1.5 rounded-lg text-[13px] font-semibold transition-colors',
                nextVariant === 'purple'
                  ? 'bg-purple-accent hover:bg-purple-deep text-white shadow-md shadow-violet-200'
                  : nextVariant === 'green'
                  ? 'bg-green-accent hover:bg-emerald-600 text-white'
                  : 'hover:bg-slate-50',
              )}
              style={nextVariant === 'default' ? { border: '0.5px solid var(--border-strong)', color: 'var(--text-secondary)' } : {}}
            >
              {nextLabel} <ChevronRight size={14} />
            </button>
          </Tooltip>
        </div>

      </div>
    </div>
  )
}
