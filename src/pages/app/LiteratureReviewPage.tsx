import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, Sparkles, Loader2,
  Bookmark, CheckCircle2, Check, Edit2, RefreshCw, X, FolderOpen, Globe, Layers,
  Copy, Trash2, Plus, Upload, Search, ShieldCheck, BookMarked, StickyNote, AlertTriangle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { ApiError } from '../../types'
import { cn } from '../../lib/utils'
import { Modal } from '../../components/ui/Modal'
import { Skeleton } from '../../components/ui/Skeleton'
import { researchApi } from '../../api/research'
import { useResearchStore } from '../../store/researchStore'
import { useLibraryStore } from '../../store/libraryStore'
import { useCreditGate } from '../../hooks/useCreditGate'
import { CREDIT_COSTS } from '../../config/creditCosts'
import { SECTION_PROMPTS, CHAPTER_STEPS, getStepLabel } from '../../data/proposalOutline'
import { DocumentSurface, type DocumentSurfaceHandle } from '../../components/research-agent/DocumentSurface'
import { parseBibliographyEntries, type ParsedReference } from '../../lib/citationFormat'
import { apiErrorMessage } from '../../lib/deepResearch'
import '../../styles/research-agent-editor.css'
import type {
  AcademicLevel, AlignmentValidationResult, CitationFlag, CitationStyle, DimensionCoverageSummary,
  DiscoveryConfig, DiscoveryStatus, DiversifiedShortlist, FetchedLiterature, FinalDecision, GatherMode, GeneratedTitle,
  LiteratureSearchQuery, ManualDecision, ProjectSection, ResearchProject,
  ResearchTopic, ScreeningCandidate, ScreeningCandidateList, SectionStatus, ScreeningStatus, SourceType,
} from '../../types/research'

// client.ts's response interceptor normalizes structured API errors into a plain
// { code, message } object (not an axios error), so `err.message` covers both that and
// any raw Error thrown before the request even went out.
const extractErrorMessage = (err: unknown): string | undefined =>
  err instanceof Error ? err.message : (err as { message?: string } | undefined)?.message

// A proper in-app confirmation dialog — replaces window.confirm(), which renders as an
// unbranded "localhost:3000 says" native browser prompt.
function ConfirmModal({
  isOpen, onClose, onConfirm, title, message, confirmLabel = 'OK', cancelLabel = 'Cancel', danger = false, confirmClassName,
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title?: string
  message: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  // Overrides the default danger/orange confirm-button color — for actions that are neither
  // destructive nor the "regenerate" warning tone, e.g. regenerate-section uses the app's own
  // purple primary-action color instead of the generic orange.
  confirmClassName?: string
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="text-[13px] text-slate-600 mb-5">{message}</div>
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onClose}
          className="px-4 py-1.5 rounded-lg border border-slate-200 text-[12px] text-slate-600 hover:bg-slate-50 transition-colors"
        >
          {cancelLabel}
        </button>
        <button
          onClick={() => { onConfirm(); onClose() }}
          className={cn(
            'px-4 py-1.5 rounded-lg text-white text-[12px] font-semibold transition-colors',
            confirmClassName ?? (danger ? 'bg-red-500 hover:bg-red-600' : 'bg-orange-500 hover:bg-orange-600'),
          )}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

// ── Local types ────────────────────────────────────────────────────────────────

type LrStepId = 'brief' | 'gather' | 'screen' | 'write' | 'finish'
type TopicTabId = 'topic' | 'title' | 'location'
type GatherTabId = 'gathering' | 'discovery'

export const LR_STEPS: { id: LrStepId; label: string }[] = [
  { id: 'brief',  label: 'Brief' },
  { id: 'gather', label: 'Gather' },
  { id: 'screen', label: 'Screen' },
  { id: 'write',  label: 'Write' },
  { id: 'finish', label: 'Finish' },
]

const TOPIC_TABS: { id: TopicTabId; label: string }[] = [
  { id: 'topic',    label: 'Research Topic' },
  { id: 'title',    label: 'Research Title' },
  { id: 'location', label: 'Research Location' },
]

const GATHER_TABS: { id: GatherTabId; label: string }[] = [
  { id: 'gathering', label: 'Literature Gathering' },
  { id: 'discovery',  label: 'Literature Discovery' },
]

const GATHER_MODES: { id: GatherMode; label: string; icon: React.ElementType }[] = [
  { id: 'documents', label: 'Library', icon: FolderOpen },
  { id: 'web',       label: 'Web',     icon: Globe },
  { id: 'hybrid',    label: 'Hybrid',  icon: Layers },
]

const ACADEMIC_LEVELS: AcademicLevel[] = ['UNDERGRADUATE', 'MASTERS', 'PHD']
const LEVEL_LABELS: Record<AcademicLevel, string> = {
  UNDERGRADUATE: 'Undergraduate',
  MASTERS:       'Masters',
  PHD:           'PhD',
}

export const CITATION_STYLES: CitationStyle[] = ['apa7', 'harvard', 'mla', 'ieee']
export const CITATION_LABELS: Record<CitationStyle, string> = {
  apa7:    'APA 7',
  harvard: 'Harvard',
  mla:     'MLA',
  ieee:    'IEEE',
}

const SUGGESTION_CHIPS = [
  'Humanizing AI Text',
  'AI Detection & Authenticity',
  'NLP Ethics in Academia',
  'AI Assistive Writing Tools',
  'Human-in-the-Loop Content Creation',
]

// ── Research Topic tab content ──────────────────────────────────────────────────

function ResearchTopicTab({
  project,
  onProceedToTitles,
}: {
  project: ResearchProject
  onProceedToTitles: () => void
}) {
  const { updateProject, setTopics: storeSetTopics, selectTopic, syncProject } = useResearchStore()

  const [topicQuery, setTopicQuery] = useState('')
  const [level, setLevel]           = useState<AcademicLevel>(project.academicLevel)
  const [field, setField]           = useState(project.fieldInterest || 'Humanizing AI-generated text and natural language authenticity')
  const [loading, setLoading]       = useState(false)
  const [topics, setLocalTopics]    = useState<ResearchTopic[]>(project.suggestedTopics ?? [])
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')

  const chosen = project.selectedTopic
  const canGenerate = field.trim().length > 10

  const handleChip = (chip: string) =>
    setField(prev => (prev ? `${prev.trimEnd()} ${chip}` : chip))

  // Reuses the same generate-topics endpoint that backs Proposal Studio's
  // Research Agent wizard (ResearchAgentPage.tsx) — it requires an existing
  // ResearchProject row, provisioned by the page-level bootstrap effect.
  const handleGenerate = async () => {
    if (!canGenerate) return
    updateProject(project.id, { fieldInterest: field, academicLevel: level })
    setLoading(true)
    try {
      const results = await researchApi.generateTopics(project.id, field, level)
      setLocalTopics(results)
      storeSetTopics(project.id, results)
    } catch {
      toast.error('Failed to generate topics. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Selecting/changing/editing a topic persists immediately via the same
  // full-project PATCH the rest of the app uses (researchStore.syncProject) —
  // there's no separate "select-topic"/"update-topic" endpoint on the backend,
  // just this one generic sync, called here instead of deferred to the next
  // step-navigation the way ResearchAgentPage.tsx does it.
  const handleSelect = (t: ResearchTopic) => {
    selectTopic(project.id, t)
    syncProject(project.id).catch(() => toast.error('Could not save your selected topic.'))
  }

  const handleChangeTopic = () => {
    selectTopic(project.id, null)
    syncProject(project.id).catch(() => toast.error('Could not update your project.'))
  }

  const startEditTitle = () => {
    if (!chosen) return
    setTitleDraft(chosen.title)
    setEditingTitle(true)
  }

  const saveEditTitle = () => {
    if (!chosen) return
    const trimmed = titleDraft.trim()
    setEditingTitle(false)
    if (!trimmed || trimmed === chosen.title) return
    selectTopic(project.id, { ...chosen, title: trimmed })
    syncProject(project.id).catch(() => toast.error('Could not save your edited topic.'))
  }

  // ── Confirmed topic — state 3 ────────────────────────────────────────────
  if (chosen) {
    return (
      <div className="p-8">
        <div className="flex gap-3 mb-6">
          <button
            onClick={startEditTitle}
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

        <div className="mb-6">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Your Research Topic
          </p>
          {editingTitle ? (
            <div className="flex items-center gap-2 mb-3">
              <input
                autoFocus
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') saveEditTitle()
                  if (e.key === 'Escape') setEditingTitle(false)
                }}
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-[15px] font-bold text-slate-900 outline-none focus:border-slate-500"
              />
              <button
                onClick={saveEditTitle}
                className="shrink-0 px-3 py-2 rounded-lg bg-[#1e293b] hover:bg-slate-800 text-white text-[12px] font-semibold transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => setEditingTitle(false)}
                className="shrink-0 p-2 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Cancel editing"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <p className="text-[17px] font-bold text-slate-900 leading-snug mb-3">{chosen.title}</p>
          )}
          <p className="text-[12px] text-slate-500 leading-relaxed">
            You can edit this topic or click <strong>Proceed to titles</strong> to continue generating your research title.
          </p>
        </div>

        {chosen.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-6">
            {chosen.tags.map(tag => (
              <span key={tag} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[11px] font-medium">
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <p className="text-[12px] text-slate-400">Progress automatically saved</p>
          </div>
          <button
            onClick={onProceedToTitles}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1e293b] hover:bg-slate-800 text-white text-[13px] font-semibold transition-colors"
          >
            Proceed to titles <ChevronRight size={14} />
          </button>
        </div>
      </div>
    )
  }

  // ── Generator view (form + list) — states 1 &amp; 2 ────────────────────────
  return (
    <div className="p-8">
      {/* Input header field */}
      <input
        value={topicQuery}
        onChange={e => setTopicQuery(e.target.value)}
        placeholder="Find Your Research Topic"
        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-[14px] text-slate-800 placeholder-slate-400 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all mb-6"
      />

      {/* Academic Level */}
      <div className="mb-6">
        <label className="block text-[13px] font-semibold text-slate-700 mb-2">Academic Level</label>
        <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg">
          {ACADEMIC_LEVELS.map(l => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={cn(
                'py-2 rounded-md text-[13px] font-medium transition-all',
                level === l ? 'bg-[#1e293b] text-white shadow-sm' : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {LEVEL_LABELS[l]}
            </button>
          ))}
        </div>
      </div>

      {/* Field textarea */}
      <div className="mb-5">
        <label className="block text-[13px] font-semibold text-slate-700 mb-2">
          Your Field or Research Interest
        </label>
        <textarea
          value={field}
          onChange={e => setField(e.target.value)}
          placeholder={"Describe your field or what you're interested in researching…\n\nExamples:\n• Humanizing AI-generated text for academic writing\n• Ethics of AI detection tools and humanizer software"}
          rows={6}
          className="w-full bg-white border border-slate-200 rounded-xl p-4 text-[13px] text-slate-700 placeholder-slate-400 resize-none outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all"
        />
      </div>

      {/* Suggested chips */}
      <div className="mb-6">
        <p className="text-[12px] text-slate-500 font-medium mb-2">Try these examples:</p>
        <div className="flex flex-wrap gap-2">
          {SUGGESTION_CHIPS.map(chip => (
            <button
              key={chip}
              onClick={() => handleChip(chip)}
              className="px-3 py-1.5 rounded-full border border-slate-200 text-[12px] text-slate-600 hover:border-slate-400 hover:text-slate-800 hover:bg-slate-50 transition-all"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={!canGenerate || loading}
        className={cn(
          'w-full py-3 rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 transition-all',
          canGenerate && !loading
            ? 'bg-[#1e293b] hover:bg-slate-800 text-white shadow-md'
            : 'bg-slate-100 text-slate-400 cursor-not-allowed',
        )}
      >
        {loading ? (
          <><Loader2 size={15} className="animate-spin" /> Searching literature &amp; generating topics…</>
        ) : (
          <><Sparkles size={15} /> Generate Research Topics</>
        )}
      </button>

      {/* Generated topic cards */}
      <AnimatePresence>
        {topics.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="overflow-hidden"
          >
            <div className="pt-6 mt-6 border-t border-slate-100">
              <p className="text-[15px] font-bold text-slate-800 mb-0.5">Suggested Research Topics</p>
              <p className="text-[12px] text-slate-500 mb-4">
                Click on a topic to select it. You'll be able to edit it before proceeding.
              </p>

              <div className="space-y-4">
                {topics.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleSelect(t)}
                    className="w-full text-left bg-white border border-slate-200 rounded-xl p-6 cursor-pointer transition-all duration-200 hover:bg-slate-50/50 hover:border-slate-300"
                  >
                    <p className="text-[14px] font-bold text-slate-900 leading-snug pr-8 mb-2">
                      {t.title}
                    </p>
                    <p className="text-[12px] text-slate-600 leading-relaxed mb-3">
                      {t.description}
                    </p>

                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {t.tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[11px] font-medium">
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="bg-slate-50/70 rounded-lg p-4 border border-slate-100">
                      <p className="text-[11px] font-bold text-slate-700 mb-1">Research Gap:</p>
                      <p className="text-[12px] text-slate-600 leading-relaxed">{t.gapSummary}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Research Title tab content ──────────────────────────────────────────────────

function ResearchTitleTab({ project }: { project: ResearchProject }) {
  const { updateProject, setGeneratedTitles, syncProject } = useResearchStore()

  const existingTitles = project.generatedTitles ?? []
  const [titles, setTitles]     = useState<GeneratedTitle[]>(existingTitles)
  const [selectedId, setSelectedId] = useState<string | null>(
    existingTitles.find(t => t.titleText === project.title)?.id ?? null,
  )
  const [customTitle, setCustomTitle] = useState(
    existingTitles.some(t => t.titleText === project.title) ? '' : (
      project.title === 'Untitled Research Project' ? '' : project.title
    ),
  )
  const [generating, setGenerating] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const chosenTopic = project.selectedTopic?.title ?? project.fieldInterest

  // Reuses the same generate-titles endpoint the Proposal Studio wizard uses
  // (ResearchAgentPage.tsx's ResearchTitleStep) — no separate backend work needed.
  const doGenerate = useCallback(async () => {
    if (!chosenTopic.trim()) return
    setGenerating(true)
    try {
      const results = await researchApi.generateTitles(project.id, chosenTopic, project.academicLevel)
      setTitles(results)
      setGeneratedTitles(project.id, results)
      setSelectedId(null)
      setCustomTitle('')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to generate titles. Please try again.'))
    } finally {
      setGenerating(false)
    }
  }, [project.id, chosenTopic, project.academicLevel, setGeneratedTitles])

  // Auto-generate on first entry into this tab if nothing's cached yet
  useEffect(() => {
    if (existingTitles.length === 0 && chosenTopic.trim()) {
      doGenerate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persists immediately via the same full-project sync used for topic
  // selection — there's no separate select-title endpoint on the backend.
  const handleSelectCard = (t: GeneratedTitle) => {
    setSelectedId(t.id)
    setCustomTitle('')
    updateProject(project.id, { title: t.titleText })
    syncProject(project.id).catch(() => toast.error('Could not save your selected title.'))
  }

  const handleCustomChange = (val: string) => {
    setCustomTitle(val)
    setSelectedId(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      updateProject(project.id, { title: val || 'Untitled Research Project' })
      syncProject(project.id).catch(() => toast.error('Could not save your title.'))
    }, 600)
  }

  return (
    <div className="p-8">
      {/* Topic context banner */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
          Your Research Topic
        </p>
        <p className="text-[14px] font-semibold text-slate-800 leading-snug">{chosenTopic}</p>
      </div>

      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-[15px] font-bold text-slate-800">Generated Research Titles</p>
        <button
          onClick={doGenerate}
          disabled={generating}
          className="flex items-center gap-1.5 bg-[#1e293b] hover:bg-slate-800 text-white text-[12px] font-medium rounded-lg px-3 py-1.5 transition-colors disabled:opacity-60"
        >
          {generating
            ? <><Loader2 size={12} className="animate-spin" /> Generating…</>
            : <><RefreshCw size={12} /> Regenerate All</>}
        </button>
      </div>

      {!generating && titles.length > 0 && (
        <p className="text-[12px] text-slate-500 mb-4">
          Click on a title to select it as your research title. You can also edit or regenerate individual titles.
        </p>
      )}

      {generating && (
        <div className="space-y-3 mt-4 mb-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="border border-slate-200 rounded-xl p-4 animate-pulse">
              <div className="h-3 bg-slate-200 rounded w-4/5 mb-2" />
              <div className="h-3 bg-slate-200 rounded w-2/3" />
            </div>
          ))}
        </div>
      )}

      {!generating && titles.length > 0 && (
        <div className="space-y-3 mb-6">
          {titles.map(t => (
            <button
              key={t.id}
              onClick={() => handleSelectCard(t)}
              className={cn(
                'block w-full text-left border rounded-xl p-4 text-sm transition-all duration-150 cursor-pointer',
                selectedId === t.id
                  ? 'border-2 border-orange-500 bg-orange-50/30 shadow-sm'
                  : 'border-slate-200 hover:border-slate-400 bg-white',
              )}
            >
              <p className={cn(
                'text-[13px] leading-snug font-medium',
                selectedId === t.id ? 'text-slate-900' : 'text-slate-700',
              )}>
                {t.titleText}
              </p>
              <p className="text-[11px] text-slate-400 mt-1.5">{t.methodology}</p>
            </button>
          ))}
        </div>
      )}

      {!generating && (
        <div>
          <p className="text-[13px] font-medium text-slate-600 mb-2">Or enter a custom title:</p>
          <input
            value={customTitle}
            onChange={e => handleCustomChange(e.target.value)}
            placeholder="Type your own research title…"
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-[13px] text-slate-800 placeholder-slate-400 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-100 transition-all"
          />
        </div>
      )}

      <div className="flex items-center gap-1.5 mt-5">
        <div className="w-2 h-2 rounded-full bg-emerald-400" />
        <p className="text-[12px] text-slate-400">Progress automatically saved</p>
      </div>
    </div>
  )
}

// ── Research Location tab content ───────────────────────────────────────────────

function ResearchLocationTab({
  project,
  onProceedToGather,
}: {
  project: ResearchProject
  onProceedToGather: () => void
}) {
  const { updateProject, setContent, syncProject } = useResearchStore()

  // The enabled/disabled toggle is a lightweight local preference (mirrors
  // ResearchAgentPage.tsx's LocationStep) — it isn't itself read by generation,
  // it just governs whether the two fields below are shown/required. The fields
  // themselves persist to the real studyLocation/studyPopulation columns that
  // ResearchPrompts.cs/ResearchService.cs interpolate into every chapter prompt.
  const enabled = (project.sectionContent['location-enabled'] ?? 'true') !== 'false'
  const [area, setArea]       = useState(project.studyLocation ?? '')
  const [population, setPopulation] = useState(project.studyPopulation ?? '')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const toggle = () => setContent(project.id, 'location-enabled', enabled ? 'false' : 'true')

  const canProceed = !enabled || (area.trim().length > 0 && population.trim().length > 0)

  const handleChange = (patch: { studyLocation?: string; studyPopulation?: string }) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      updateProject(project.id, patch)
      syncProject(project.id).catch(() => toast.error('Could not save your study location.'))
    }, 600)
  }

  return (
    <div className="p-8">
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

          <div className="mb-5">
            <label className="block text-[13px] font-semibold text-slate-700 mb-1">
              Geographical Area <span className="text-red-500">*</span>
            </label>
            <p className="text-[12px] text-slate-500 mb-2">
              Enter the country and name of place where you're going to conduct the study. Can be a school, company, clinic, hospital, etc.
            </p>
            <input
              value={area}
              onChange={e => { setArea(e.target.value); handleChange({ studyLocation: e.target.value }) }}
              placeholder="e.g., Mulago Out Patient Clinic, Kampala, Uganda"
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-[13px] text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all placeholder-slate-400"
            />
          </div>

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
              onChange={e => { setPopulation(e.target.value); handleChange({ studyPopulation: e.target.value }) }}
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

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <p className="text-[12px] text-slate-400">Progress automatically saved</p>
        </div>
        {canProceed && (
          <button
            onClick={onProceedToGather}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1e293b] hover:bg-slate-800 text-white text-[13px] font-semibold transition-colors"
          >
            Proceed to Gather <ChevronRight size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Research Gather tab content ─────────────────────────────────────────────────

function ResearchGatherTab({ project }: { project: ResearchProject }) {
  const { setContent, updateProject, syncProject } = useResearchStore()
  const { documents, folders, loadDocuments, hasLoaded } = useLibraryStore()

  useEffect(() => {
    if (!hasLoaded) loadDocuments()
  }, [hasLoaded, loadDocuments])

  const [mode, setMode] = useState<GatherMode>(project.gatherMode ?? 'documents')
  const [selectedFolder, setSelectedFolder] = useState('all')
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(
    new Set(project.selectedLibraryDocumentIds ?? []),
  )
  const [folderOpen, setFolderOpen] = useState(false)
  const [importing, setImporting] = useState(false)

  const webVal = project.sectionContent['literature'] ?? ''

  const handleModeChange = (m: GatherMode) => {
    setMode(m)
    updateProject(project.id, { gatherMode: m })
    syncProject(project.id).catch(() => toast.error('Could not save your gathering mode.'))
  }

  // Mirrors ResearchAgentPage.tsx's LiteratureStep (same underlying gatherMode/
  // selectedLibraryDocumentIds fields) — the free-text literature list is kept
  // in sync too, since that's what generate-topics-style AI calls elsewhere
  // actually read as citable source text.
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
    updateProject(project.id, { selectedLibraryDocumentIds: Array.from(next) })
    syncProject(project.id).catch(() => toast.error('Could not save your document selection.'))
  }

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

  const filteredDocs = selectedFolder === 'all'
    ? documents
    : documents.filter(d => d.folderId === selectedFolder)

  const selectedFolder_ = folders.find(f => f.id === selectedFolder)

  const DocsBrowser = () => (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative">
          <button
            onClick={() => setFolderOpen(v => !v)}
            className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 text-[12px] text-slate-700 bg-white hover:border-slate-300 transition-colors"
          >
            <FolderOpen size={13} className="text-slate-400" />
            {selectedFolder === 'all' ? 'All usable folders' : (selectedFolder_?.name ?? 'Folder')}
            <ChevronDown size={12} className={cn('text-slate-400 transition-transform', folderOpen && 'rotate-180')} />
          </button>
          {folderOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setFolderOpen(false)} />
              <div className="absolute z-20 top-full mt-1 left-0 min-w-[160px] bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                <button
                  onClick={() => { setSelectedFolder('all'); setFolderOpen(false) }}
                  className={cn('w-full text-left px-3 py-2 text-[12px] hover:bg-slate-50 transition-colors', selectedFolder === 'all' && 'font-semibold text-orange-500')}
                >
                  All usable folders
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
            </>
          )}
        </div>
        {selectedDocIds.size > 0 && (
          <span className="text-[11px] font-semibold bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
            {selectedDocIds.size} selected
          </span>
        )}
      </div>

      {filteredDocs.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
          <FolderOpen size={28} className="text-slate-300 mx-auto mb-2" />
          <p className="text-[13px] font-medium text-slate-500 mb-1">No documents yet</p>
          <p className="text-[12px] text-slate-400">Upload PDFs or documents in My Library, then come back to select them.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
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
    <div className="p-8">
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl">
        {GATHER_MODES.map(m => (
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

      <div className="flex items-center gap-1.5 mt-6">
        <div className="w-2 h-2 rounded-full bg-emerald-400" />
        <p className="text-[12px] text-slate-400">Progress automatically saved</p>
      </div>
    </div>
  )
}

// ── Literature Discovery tab content ────────────────────────────────────────────

const DISCOVERY_STRATEGIES = ['Balanced - adaptive', 'Broad - recall focused', 'Narrow - precision focused']

function SearchQueryCard({
  query, onSave, onToggleEnabled, onDuplicate, onDelete,
}: {
  query: LiteratureSearchQuery
  onSave: (patch: { title: string; queryText: string; description: string }) => void
  onToggleEnabled: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const [title, setTitle] = useState(query.title)
  const [queryText, setQueryText] = useState(query.queryText)

  useEffect(() => {
    setTitle(query.title)
    setQueryText(query.queryText)
  }, [query.id, query.title, query.queryText])

  const handleBlurSave = () => {
    if (title !== query.title || queryText !== query.queryText) {
      onSave({ title, queryText, description: query.description })
    }
  }

  return (
    <div className="border border-slate-200 rounded-xl p-4">
      <div className="flex items-start gap-2 mb-2">
        <button
          onClick={onToggleEnabled}
          className={cn(
            'w-4 h-4 mt-1 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
            query.enabled ? 'bg-orange-500 border-orange-500' : 'border-slate-300',
          )}
        >
          {query.enabled && <Check size={10} className="text-white" />}
        </button>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          onBlur={handleBlurSave}
          className="flex-1 text-[13px] font-bold text-slate-800 outline-none bg-transparent border-b border-transparent focus:border-slate-300 py-1"
        />
      </div>
      <textarea
        rows={2}
        value={queryText}
        onChange={e => setQueryText(e.target.value)}
        onBlur={handleBlurSave}
        placeholder="Boolean query text…"
        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-[12px] font-mono text-slate-700 outline-none focus:border-slate-400 resize-y mb-2 placeholder-slate-400"
      />
      {query.description && <p className="text-[12px] text-slate-500 mb-1">{query.description}</p>}
      {query.targets.length > 0 && (
        <p className="text-[11px] text-slate-400 mb-2">Targets: {query.targets.join(', ')}</p>
      )}
      <div className="flex items-center gap-4">
        <button onClick={onDuplicate} className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700 transition-colors">
          <Copy size={11} /> Duplicate
        </button>
        <button onClick={onDelete} className="flex items-center gap-1 text-[11px] text-red-500 hover:text-red-600 transition-colors">
          <Trash2 size={11} /> Delete
        </button>
      </div>
    </div>
  )
}

// Lightweight comma-separated tag editor for TopicScope's array fields — uncontrolled
// (keyed on the current value) so free typing doesn't fight external updates from a
// Regenerate call, and saves on blur rather than per-keystroke.
function ScopeField({
  label, value, onSave, placeholder,
}: {
  label: string
  value: string[]
  onSave: (next: string[]) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="text-[11px] font-semibold text-slate-500 block mb-1">{label}</label>
      <input
        key={value.join(',')}
        defaultValue={value.join(', ')}
        onBlur={e => onSave(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
        placeholder={placeholder ?? 'Comma-separated terms'}
        className="w-full text-[12px] border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none"
      />
    </div>
  )
}

function ResearchLiteratureDiscoveryTab({ project }: { project: ResearchProject }) {
  const navigate = useNavigate()
  const [config, setConfig] = useState<DiscoveryConfig | null>(null)
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [generatingTopicScope, setGeneratingTopicScope] = useState(false)
  const [generatingDimensions, setGeneratingDimensions] = useState(false)
  const [generatingQueries, setGeneratingQueries] = useState(false)
  const [starting, setStarting] = useState(false)
  const [confirmRegenerateQueries, setConfirmRegenerateQueries] = useState(false)
  const [confirmDeleteQueryId, setConfirmDeleteQueryId] = useState<string | null>(null)
  const bootstrappedRef = useRef(false)
  const capDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const goToProgressPage = () =>
    navigate(`/app/literature-review/discovery?projectId=${project.id}`, { replace: true })

  // Bootstraps dimensions + queries via Claude on first visit (nothing to show yet),
  // mirroring how ResearchTitleTab auto-generates once on first entry.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadingConfig(true)
      try {
        const cfg = await researchApi.getDiscoveryConfig(project.id)
        if (!bootstrappedRef.current && cfg.dimensions.length === 0) {
          bootstrappedRef.current = true
          setGeneratingDimensions(true)
          await researchApi.generateDiscoveryDimensions(project.id)
          setGeneratingDimensions(false)
          setGeneratingQueries(true)
          await researchApi.generateDiscoveryQueries(project.id)
          setGeneratingQueries(false)
          if (!cancelled) setConfig(await researchApi.getDiscoveryConfig(project.id))
        } else if (!cancelled) {
          setConfig(cfg)
        }
      } catch {
        toast.error('Could not load literature discovery configuration.')
      } finally {
        if (!cancelled) setLoadingConfig(false)
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A run in progress (or already finished) lives on its own page now — redirect there
  // instead of re-showing this editor, so reloading mid-run doesn't strand the user on
  // stale config.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const s = await researchApi.getDiscoveryStatus(project.id)
        if (!cancelled && s.status !== 'NotStarted') goToProgressPage()
      } catch { /* no run yet — stay on the editor */ }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id])

  const persistConfig = async (patch: Partial<Pick<DiscoveryConfig, 'strategy' | 'candidateCap'>> & {
    databases?: DiscoveryConfig['databases']
    dimensions?: DiscoveryConfig['dimensions']
    topicScope?: DiscoveryConfig['topicScope']
  }) => {
    if (!config) return
    const next = { ...config, ...patch }
    try {
      await researchApi.updateDiscoveryConfig(project.id, {
        strategy:          next.strategy,
        candidateCap:      next.candidateCap,
        selectedDatabases: (patch.databases ?? config.databases).filter(d => d.enabled).map(d => d.id),
        topicScope:        patch.topicScope ?? config.topicScope,
        dimensions:        patch.dimensions ?? config.dimensions,
      })
    } catch {
      toast.error('Could not save your discovery configuration.')
    }
  }

  const toggleDatabase = (dbId: string) => {
    if (!config) return
    const databases = config.databases.map(d => (d.id === dbId ? { ...d, enabled: !d.enabled } : d))
    setConfig({ ...config, databases })
    persistConfig({ databases })
  }

  const toggleDimension = (dimId: string) => {
    if (!config) return
    const dimensions = config.dimensions.map(d => (d.id === dimId ? { ...d, enabled: !d.enabled } : d))
    setConfig({ ...config, dimensions })
    persistConfig({ dimensions })
  }

  const changeStrategy = (strategy: string) => {
    if (!config) return
    setConfig({ ...config, strategy })
    persistConfig({ strategy })
  }

  const changeCandidateCap = (value: number) => {
    if (!config) return
    setConfig({ ...config, candidateCap: value })
    if (capDebounceRef.current) clearTimeout(capDebounceRef.current)
    capDebounceRef.current = setTimeout(() => persistConfig({ candidateCap: value }), 600)
  }

  const handleRegenerateTopicScope = async () => {
    setGeneratingTopicScope(true)
    try {
      const topicScope = await researchApi.generateTopicScope(project.id)
      setConfig(c => (c ? { ...c, topicScope } : c))
    } catch {
      toast.error('Failed to regenerate the research scope.')
    } finally {
      setGeneratingTopicScope(false)
    }
  }

  const updateTopicScopeField = (patch: Partial<DiscoveryConfig['topicScope']>) => {
    if (!config) return
    const topicScope = { ...config.topicScope, ...patch }
    setConfig({ ...config, topicScope })
    persistConfig({ topicScope })
  }

  const handleRegenerateDimensions = async () => {
    setGeneratingDimensions(true)
    try {
      const dimensions = await researchApi.generateDiscoveryDimensions(project.id)
      setConfig(c => (c ? { ...c, dimensions } : c))
    } catch {
      toast.error('Failed to regenerate research dimensions.')
    } finally {
      setGeneratingDimensions(false)
    }
  }

  const handleRegenerateQueries = async () => {
    setGeneratingQueries(true)
    try {
      const queries = await researchApi.generateDiscoveryQueries(project.id)
      setConfig(c => (c ? { ...c, queries } : c))
    } catch {
      toast.error('Failed to regenerate search queries.')
    } finally {
      setGeneratingQueries(false)
    }
  }

  const handleAddQuery = async () => {
    try {
      const q = await researchApi.createDiscoveryQuery(project.id)
      setConfig(c => (c ? { ...c, queries: [...c.queries, q] } : c))
    } catch {
      toast.error('Could not add a new query.')
    }
  }

  const handleUpdateQuery = async (
    queryId: string,
    patch: Partial<Pick<LiteratureSearchQuery, 'title' | 'queryText' | 'description' | 'enabled'>>,
  ) => {
    const current = config?.queries.find(q => q.id === queryId)
    if (!current) return
    const merged = { ...current, ...patch }
    setConfig(c => (c ? { ...c, queries: c.queries.map(q => (q.id === queryId ? merged : q)) } : c))
    try {
      await researchApi.updateDiscoveryQuery(project.id, queryId, {
        title: merged.title, queryText: merged.queryText, description: merged.description, enabled: merged.enabled,
      })
    } catch {
      toast.error('Could not save this query.')
    }
  }

  const handleDuplicateQuery = async (queryId: string) => {
    try {
      const copy = await researchApi.duplicateDiscoveryQuery(project.id, queryId)
      setConfig(c => (c ? { ...c, queries: [...c.queries, copy] } : c))
    } catch {
      toast.error('Could not duplicate this query.')
    }
  }

  const handleDeleteQuery = async (queryId: string) => {
    try {
      await researchApi.deleteDiscoveryQuery(project.id, queryId)
      setConfig(c => (c ? { ...c, queries: c.queries.filter(q => q.id !== queryId) } : c))
    } catch {
      toast.error('Could not delete this query.')
    }
  }

  const handleStart = async () => {
    setStarting(true)
    try {
      await researchApi.startDiscovery(project.id)
      goToProgressPage()
    } catch (err) {
      const message = err instanceof Error ? err.message
        : (err as { message?: string } | undefined)?.message
      toast.error(message ?? 'Could not start literature discovery.')
      setStarting(false)
    }
  }

  if (loadingConfig || !config) {
    return (
      <div className="p-8 flex items-center justify-center gap-2 text-slate-400 text-[13px]">
        <Loader2 size={14} className="animate-spin" />
        {generatingQueries ? 'Building boolean search queries…'
          : generatingDimensions ? 'Scoping research dimensions…'
          : 'Preparing your discovery strategy…'}
      </div>
    )
  }

  return (
    <div className="p-8 space-y-8">
      {/* Search strategy header */}
      <div>
        <div className="flex items-start justify-between gap-4 mb-1 flex-wrap">
          <h2 className="text-[16px] font-bold text-slate-800">Search strategy and canonical literature corpus</h2>
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={config.strategy}
              onChange={e => changeStrategy(e.target.value)}
              className="text-[12px] border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 outline-none"
            >
              {DISCOVERY_STRATEGIES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
              Candidate cap
              <input
                type="number"
                min={1}
                max={2000}
                value={config.candidateCap}
                onChange={e => changeCandidateCap(Number(e.target.value))}
                className="w-20 text-[12px] border border-slate-200 rounded-lg px-2 py-1.5 outline-none"
              />
            </label>
          </div>
        </div>
        <p className="text-[12px] text-slate-500">
          Opening this tab prepares the strategy. Database searches begin only when you click Start Literature Discovery.
        </p>
      </div>

      {/* Recommended databases */}
      <div>
        <p className="text-[13px] font-bold text-slate-700 mb-3">Recommended databases</p>
        <div className="grid grid-cols-2 gap-3">
          {config.databases.map(db => (
            <button
              key={db.id}
              disabled={!db.available}
              onClick={() => toggleDatabase(db.id)}
              className={cn(
                'text-left p-3 rounded-xl border transition-all',
                !db.available
                  ? 'opacity-50 cursor-not-allowed border-slate-100 bg-slate-50'
                  : db.enabled ? 'border-orange-300 bg-orange-50/40' : 'border-slate-200 hover:border-slate-300',
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={cn(
                  'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0',
                  db.enabled && db.available ? 'bg-orange-500 border-orange-500' : 'border-slate-300',
                )}>
                  {db.enabled && db.available && <Check size={10} className="text-white" />}
                </div>
                <span className="text-[13px] font-semibold text-slate-800">{db.name}</span>
                {db.recommended && (
                  <span className="text-[10px] font-semibold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded-full">
                    Recommended
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 pl-6">{db.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Research scope */}
      <div>
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-[13px] font-bold text-slate-700">Research scope</p>
            <p className="text-[11px] text-slate-400">Structured concepts, population, and geography used to rank and diversify results. Leave geography empty for international literature.</p>
          </div>
          <button
            onClick={handleRegenerateTopicScope}
            disabled={generatingTopicScope}
            className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700 disabled:opacity-50 transition-colors shrink-0"
          >
            {generatingTopicScope ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />} Regenerate
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <ScopeField label="Primary concepts" value={config.topicScope.primaryConcepts}
            onSave={v => updateTopicScopeField({ primaryConcepts: v })} />
          <ScopeField label="Population" value={config.topicScope.population}
            onSave={v => updateTopicScopeField({ population: v })} />
          <ScopeField label="Geography" value={config.topicScope.geography}
            onSave={v => updateTopicScopeField({ geography: v })} placeholder="Leave empty for international literature" />
          <ScopeField label="Setting" value={config.topicScope.setting}
            onSave={v => updateTopicScopeField({ setting: v })} />
          <ScopeField label="Named dataset/survey" value={config.topicScope.datasetTerms}
            onSave={v => updateTopicScopeField({ datasetTerms: v })} placeholder="e.g. SADHS, NHANES — detected automatically" />
        </div>
        <div className="mt-3">
          <label className="text-[11px] font-semibold text-slate-500 block mb-1">Methodology signal</label>
          <input
            key={config.topicScope.methodology}
            defaultValue={config.topicScope.methodology}
            onBlur={e => updateTopicScopeField({ methodology: e.target.value })}
            placeholder="e.g. quantitative correlational"
            className="w-full text-[12px] border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none"
          />
        </div>
      </div>

      {/* Research dimensions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[13px] font-bold text-slate-700">Research dimensions</p>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-400">{config.dimensions.filter(d => d.enabled).length} enabled</span>
            <button
              onClick={handleRegenerateDimensions}
              disabled={generatingDimensions}
              className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700 disabled:opacity-50 transition-colors"
            >
              {generatingDimensions ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />} Regenerate
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {config.dimensions.map(dim => (
            <button
              key={dim.id}
              onClick={() => toggleDimension(dim.id)}
              className={cn(
                'text-left p-3 rounded-xl border transition-all',
                dim.enabled ? 'border-orange-300 bg-orange-50/40' : 'border-slate-200 hover:border-slate-300',
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={cn(
                  'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0',
                  dim.enabled ? 'bg-orange-500 border-orange-500' : 'border-slate-300',
                )}>
                  {dim.enabled && <Check size={10} className="text-white" />}
                </div>
                <span className="text-[13px] font-semibold text-slate-800">{dim.name}</span>
              </div>
              <p className="text-[11px] text-slate-500 pl-6">{dim.keywords}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Boolean search strings */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[15px] font-bold text-slate-800">Boolean search strings</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setConfirmRegenerateQueries(true)}
              disabled={generatingQueries}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-[12px] text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              {generatingQueries ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Regenerate
            </button>
            <button
              onClick={handleAddQuery}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-[12px] text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Plus size={12} /> Add query
            </button>
          </div>
        </div>
        <div className="space-y-3">
          {config.queries.map(q => (
            <SearchQueryCard
              key={q.id}
              query={q}
              onSave={patch => handleUpdateQuery(q.id, patch)}
              onToggleEnabled={() => handleUpdateQuery(q.id, { enabled: !q.enabled })}
              onDuplicate={() => handleDuplicateQuery(q.id)}
              onDelete={() => setConfirmDeleteQueryId(q.id)}
            />
          ))}
          {config.queries.length === 0 && (
            <p className="text-[12px] text-slate-400 text-center py-6">
              No search queries yet — generate them from your research dimensions above, or add one manually.
            </p>
          )}
        </div>
      </div>

      <div className="border-t border-slate-100 pt-6 flex items-center justify-end">
        <button
          onClick={handleStart}
          disabled={starting}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold shadow-md shadow-orange-100 transition-all disabled:opacity-60"
        >
          {starting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          Start Literature Discovery
        </button>
      </div>

      <ConfirmModal
        isOpen={confirmRegenerateQueries}
        onClose={() => setConfirmRegenerateQueries(false)}
        onConfirm={handleRegenerateQueries}
        title="Regenerate search queries"
        message="Regenerate all search queries? This replaces every query below."
      />
      <ConfirmModal
        isOpen={confirmDeleteQueryId !== null}
        onClose={() => setConfirmDeleteQueryId(null)}
        onConfirm={() => { if (confirmDeleteQueryId) handleDeleteQuery(confirmDeleteQueryId) }}
        title="Delete search query"
        message="Delete this search query?"
        confirmLabel="Delete"
        danger
      />
    </div>
  )
}

// ── Evidence Screening ("Screen" step) ──────────────────────────────────────────

function ResearchScreeningTab({
  project, onReturnToDiscovery, onBackToGathering, onApprovedCountChange, onCorpusApproved,
}: {
  project: ResearchProject
  onReturnToDiscovery: () => void
  onBackToGathering: () => void
  onApprovedCountChange?: (count: number) => void
  onCorpusApproved?: (currentStep: number) => void
}) {
  const navigate = useNavigate()
  const { updateProject, syncProject } = useResearchStore()
  const [discovery, setDiscovery] = useState<DiscoveryStatus | null>(null)
  const [status, setStatus] = useState<ScreeningStatus | null>(null)
  const [coverage, setCoverage] = useState<DimensionCoverageSummary | null>(null)
  const [showLowCoverageModal, setShowLowCoverageModal] = useState(false)
  const [starting, setStarting] = useState(false)
  const [approving, setApproving] = useState(false)
  const [searchingDimension, setSearchingDimension] = useState<string | null>(null)

  const [candidates, setCandidates] = useState<ScreeningCandidateList | null>(null)
  const [candidatesLoading, setCandidatesLoading] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [decisionFilter, setDecisionFilter] = useState<FinalDecision | ''>('')
  const [relevanceBandFilter, setRelevanceBandFilter] = useState<'Strong' | 'Moderate' | 'Weak' | ''>('')
  const [sourceKindFilter, setSourceKindFilter] = useState<'Library' | 'Web' | ''>('')
  const [databaseFilter, setDatabaseFilter] = useState('')
  const [textStateFilter, setTextStateFilter] = useState<SourceType | ''>('')
  const [page, setPage] = useState(1)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [candidateView, setCandidateView] = useState<'all' | 'best'>('all')
  const [shortlist, setShortlist] = useState<DiversifiedShortlist | null>(null)
  const [shortlistLoading, setShortlistLoading] = useState(false)

  useEffect(() => {
    researchApi.getDiscoveryStatus(project.id).then(setDiscovery).catch(() => { /* no discovery run yet */ })
  }, [project.id])

  useEffect(() => {
    onApprovedCountChange?.(status?.approvedCount ?? 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.approvedCount])

  useEffect(() => {
    if (status?.status !== 'Completed') return
    researchApi.getDimensionCoverage(project.id).then(setCoverage).catch(() => { /* stays null — card just won't render */ })
  }, [project.id, status?.status])

  useEffect(() => {
    let mounted = true
    let interval: ReturnType<typeof setInterval> | null = null

    const poll = async () => {
      try {
        const s = await researchApi.getScreeningStatus(project.id)
        if (!mounted) return
        setStatus(s)
        if (s.status === 'Running') {
          if (!interval) interval = setInterval(poll, 2000)
        } else if (interval) {
          clearInterval(interval)
          interval = null
        }
      } catch (err) {
        // Was a silent no-op — a poll that fails the same way every tick (e.g. a server-side
        // bug in status computation) would freeze the UI forever with zero trace of why.
        console.error('Screening status poll failed:', err)
      }
    }
    poll()

    return () => { mounted = false; if (interval) clearInterval(interval) }
  }, [project.id])

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => { setAppliedSearch(searchInput); setPage(1) }, 500)
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current) }
  }, [searchInput])

  const loadCandidates = useCallback(async () => {
    if (status?.status !== 'Completed') return
    setCandidatesLoading(true)
    try {
      const list = await researchApi.getScreeningCandidates(project.id, {
        search: appliedSearch || undefined,
        decision: decisionFilter || undefined,
        relevanceBand: relevanceBandFilter || undefined,
        sourceKind: sourceKindFilter || undefined,
        database: databaseFilter || undefined,
        textState: textStateFilter || undefined,
        page,
        pageSize: 20,
      })
      setCandidates(list)
    } catch { /* transient failure — filter bar stays interactive to retry */ }
    finally { setCandidatesLoading(false) }
  }, [project.id, status?.status, appliedSearch, decisionFilter, relevanceBandFilter, sourceKindFilter, databaseFilter, textStateFilter, page])

  useEffect(() => { loadCandidates() }, [loadCandidates])

  useEffect(() => {
    if (candidateView !== 'best' || status?.status !== 'Completed') return
    let cancelled = false
    setShortlistLoading(true)
    researchApi.getDiversifiedShortlist(project.id)
      .then(s => { if (!cancelled) setShortlist(s) })
      .catch(() => { /* transient failure — toggle stays interactive to retry */ })
      .finally(() => { if (!cancelled) setShortlistLoading(false) })
    return () => { cancelled = true }
  }, [candidateView, project.id, status?.status])

  const handleUpdateDecision = async (candidateId: string, decision: ManualDecision) => {
    try {
      await researchApi.updateManualDecision(project.id, candidateId, decision)
      await loadCandidates()
    } catch (err) {
      toast.error(extractErrorMessage(err) ?? 'Could not update this decision.')
    }
  }

  const handleUploadPdf = async (candidateId: string, file: File) => {
    try {
      await researchApi.uploadCandidatePdf(project.id, candidateId, file)
      toast.success('PDF uploaded — full text extracted.')
      await loadCandidates()
      researchApi.getDimensionCoverage(project.id).then(setCoverage).catch(() => {})
    } catch (err) {
      toast.error(extractErrorMessage(err) ?? 'Could not upload this PDF.')
    }
  }

  const handleSearchDimension = async (dimensionName: string) => {
    setSearchingDimension(dimensionName)
    try {
      await researchApi.startTargetedDiscovery(project.id, dimensionName)
      navigate(`/app/literature-review/discovery?projectId=${project.id}`)
    } catch (err) {
      toast.error(extractErrorMessage(err) ?? 'Could not start targeted discovery.')
      setSearchingDimension(null)
    }
  }

  const handleStart = async () => {
    setStarting(true)
    try {
      await researchApi.startScreening(project.id)
      setStatus(await researchApi.getScreeningStatus(project.id))
    } catch (err) {
      const message = err instanceof Error ? err.message
        : (err as { message?: string } | undefined)?.message
      toast.error(message ?? 'Could not start evidence screening.')
    } finally {
      setStarting(false)
    }
  }

  const handleApproveCorpusClick = () => {
    if (status?.coverageStatus === 'Low') {
      setShowLowCoverageModal(true)
      return
    }
    void doApproveCorpus(false)
  }

  const doApproveCorpus = async (acknowledgeLimitedCoverage: boolean) => {
    setApproving(true)
    try {
      const result = await researchApi.approveCorpus(project.id, {
        acknowledgeLimitedCoverage,
        transitionToNextStep: true,
      })
      setStatus(result)
      toast.success('Evidence corpus approved.')
      onCorpusApproved?.(result.currentStep)
    } catch (err) {
      toast.error(extractErrorMessage(err) ?? 'Could not approve the evidence corpus.')
    } finally {
      setApproving(false)
    }
  }

  const handleConfirmLowCoverage = () => {
    setShowLowCoverageModal(false)
    void doApproveCorpus(true)
  }

  const handleSwitchToHybrid = () => {
    updateProject(project.id, { gatherMode: 'hybrid' })
    syncProject(project.id).catch(() => toast.error('Could not switch gather mode.'))
    toast.success('Switched to Hybrid gathering.')
  }

  if (!status) {
    return (
      <div className="p-8 space-y-6">
        <div className="space-y-2">
          <Skeleton lines={1} tone="light" className="w-40" />
          <Skeleton lines={1} tone="light" className="w-80 h-5" />
        </div>
        <Skeleton variant="card" tone="light" />
        <Skeleton variant="card" tone="light" />
      </div>
    )
  }

  const coveragePill = status.status === 'Completed' ? status.coverageStatus
    : status.status === 'Running' ? 'In progress'
    : 'Pending'

  const headline = status.status === 'NotStarted'
    ? (discovery
        ? `Discovery complete: ${discovery.resultCount} found, ${discovery.duplicateCount} duplicates collapsed, ${discovery.uniqueCount} unique candidates.`
        : 'Run Literature Discovery first to populate a canonical corpus.')
    : status.status === 'Completed'
    ? `Screening complete: ${status.relevantCount} relevant, ${status.evidenceReadyCount} evidence-ready, ${status.approvedCount} approved.`
    : status.statusMessage || 'Screening…'

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-4 mb-1 flex-wrap">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-orange-500 mb-1">Evidence Screening</p>
            <h2 className="text-[16px] font-bold text-slate-800">Relevant, evidence-ready sources for this project</h2>
          </div>
          <span className={cn(
            'shrink-0 text-[11px] font-semibold rounded-lg px-2.5 py-1.5 border',
            status.status === 'Completed' && status.coverageStatus === 'Low'
              ? 'text-amber-700 border-amber-200 bg-amber-50'
              : 'text-slate-500 border-slate-200 bg-slate-50',
          )}>
            Evidence Coverage: {coveragePill}
          </span>
        </div>
        <p className="text-[12px] text-slate-500">
          Relevance and evidence support are scored separately. Only the approved corpus can ground Generator sections.
        </p>
      </div>

      {/* Progress + metrics */}
      <div className="border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="flex items-center gap-2 text-[13px] font-medium text-slate-700">
            {status.status === 'Running' && <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse shrink-0" />}
            {headline}
          </p>
          <span className="text-[13px] font-semibold text-slate-500 shrink-0">
            {status.status === 'NotStarted' ? (discovery ? 100 : 0) : status.progressPct}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden mb-5">
          <div
            className={cn('h-full rounded-full transition-all duration-500', status.status === 'Error' ? 'bg-red-400' : 'bg-orange-500')}
            style={{ width: `${status.status === 'NotStarted' ? (discovery ? 100 : 0) : Math.max(status.progressPct, 3)}%` }}
          />
        </div>
        {status.status === 'Running' && (
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 mb-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Live activity</p>
            <p className="flex items-center gap-1.5 text-[12px] text-slate-600">
              <Loader2 size={12} className="animate-spin shrink-0 text-orange-500" />
              Screening candidates in batches — this can take a few minutes for large corpora. Feel free to leave this
              tab open; progress is saved as each batch completes.
            </p>
          </div>
        )}
        <div className="grid grid-cols-5 gap-3 mb-3">
          {[
            { label: 'Discovered', value: status.discoveredCount },
            { label: 'Unique', value: status.uniqueCount },
            { label: 'Relevant', value: status.relevantCount },
            { label: 'Evidence-ready', value: status.evidenceReadyCount },
            { label: 'Approved', value: status.approvedCount },
          ].map(m => (
            <div key={m.label}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">{m.label}</p>
              <p className="text-[18px] font-bold text-slate-800">{m.value}</p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-400">
          Screened: {status.screenedCount} · Manual review: {status.manualReviewCount} · Excluded: {status.excludedCount} ·
          {' '}Abstract-only: {status.abstractOnlyCount} · Dimensions:{' '}
          {coverage ? `${coverage.dimensions.filter(d => d.paperCount > 0).length}/${coverage.dimensions.length}` : 'pending screening'}
        </p>
      </div>

      {/* Info box — pre-completion only; the dimension coverage card replaces it once screening finishes */}
      {status.status !== 'Completed' && (
        <div className="border border-slate-200 rounded-xl px-4 py-3">
          <p className="text-[12px] text-slate-500">
            Discovery coverage is provisional. Run Evidence Screening to inspect page-grounded PDF passages and calculate final evidence coverage.
          </p>
        </div>
      )}

      {/* Evidence coverage by research dimension — skeleton while the summary is still loading */}
      {status.status === 'Completed' && !coverage && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[15px] font-bold text-slate-800">Evidence coverage by research dimension</p>
          </div>
          <Skeleton variant="card" tone="light" />
        </div>
      )}

      {status.status === 'Completed' && coverage && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[15px] font-bold text-slate-800">Evidence coverage by research dimension</p>
            <span className="text-[11px] text-slate-400">{coverage.pctDimensionsWithCoverage}% supported</span>
          </div>
          <div className="border border-slate-200 rounded-xl p-4">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-3">
              {coverage.dimensions.map(d => (
                <div key={d.name} className="flex items-center justify-between gap-2 text-[12px]">
                  <span className="text-slate-700">{d.name}</span>
                  <span className={cn(d.status === 'Missing' ? 'text-red-500' : 'text-slate-500')}>
                    {d.fullTextCount} full text · {d.paperCount} papers · {d.status.toLowerCase()}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mb-3">
              Library: {coverage.libraryCount} · Web: {coverage.webCount} · Databases: {coverage.databaseCount} ·
              {' '}Venues: {coverage.venueCount} · Author groups: {coverage.authorGroupCount} · Estimated defensible
              {' '}citations / 1,000 words: {coverage.estimatedCitationsLow}-{coverage.estimatedCitationsHigh} (not a guarantee)
            </p>
            {coverage.dimensions.some(d => d.status !== 'Supported') && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-[11px] text-amber-700 mb-2">Unsupported dimensions need targeted follow-up discovery.</p>
                <div className="flex flex-wrap gap-2">
                  {coverage.dimensions.filter(d => d.status !== 'Supported').map(d => (
                    <button
                      key={d.name}
                      onClick={() => handleSearchDimension(d.name)}
                      disabled={searchingDimension !== null}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-amber-300 bg-white text-[11px] text-amber-700 hover:bg-amber-100 disabled:opacity-50 transition-colors"
                    >
                      {searchingDimension === d.name ? <Loader2 size={10} className="animate-spin" /> : <Search size={10} />}
                      Search {d.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* New candidates from targeted follow-up need re-screening */}
      {status.status === 'Completed' && status.uniqueCount > status.screenedCount && (
        <div className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
          <p className="text-[12px] text-slate-600">
            {status.uniqueCount - status.screenedCount} new candidate{status.uniqueCount - status.screenedCount === 1 ? '' : 's'} need screening.
          </p>
          <button
            onClick={handleStart}
            disabled={starting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-[12px] font-semibold disabled:opacity-60 transition-colors"
          >
            {starting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Run Evidence Screening
          </button>
        </div>
      )}

      {/* Search / filter / candidate list */}
      {status.status === 'Completed' && (
        <div className="space-y-3">
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 w-fit">
            <button
              onClick={() => setCandidateView('all')}
              className={cn(
                'px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors',
                candidateView === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700',
              )}
            >
              All results
            </button>
            <button
              onClick={() => setCandidateView('best')}
              className={cn(
                'px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors',
                candidateView === 'best' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700',
              )}
            >
              Best matches
            </button>
          </div>

          {candidateView === 'best' ? (
            shortlistLoading ? (
              <div className="space-y-3">
                {[0, 1, 2].map(i => <Skeleton key={i} variant="card" tone="light" />)}
              </div>
            ) : shortlist && shortlist.buckets.length > 0 ? (
              <div className="space-y-6">
                {shortlist.buckets.map(bucket => (
                  <div key={bucket.label}>
                    <div className="flex items-baseline gap-2 mb-2">
                      <p className="text-[13px] font-bold text-slate-800">{bucket.label}</p>
                      <p className="text-[11px] text-slate-400">{bucket.reason}</p>
                    </div>
                    <div className="space-y-3">
                      {bucket.items.map(c => (
                        <ScreeningCandidateCard
                          key={c.id}
                          candidate={c}
                          onUpdateDecision={decision => handleUpdateDecision(c.id, decision)}
                          onUploadPdf={file => handleUploadPdf(c.id, file)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-slate-400 text-center py-6">No screened candidates yet to build a shortlist from.</p>
            )
          ) : (
          <>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search title, author, abstract"
              className="flex-1 min-w-[160px] text-[12px] border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-slate-400"
            />
            <select
              value={decisionFilter}
              onChange={e => { setDecisionFilter(e.target.value as FinalDecision | ''); setPage(1) }}
              className="text-[12px] border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-600 outline-none"
            >
              <option value="">All decisions</option>
              <option value="Included">Included</option>
              <option value="Excluded">Excluded</option>
              <option value="ManualReview">Manual review</option>
              <option value="Pending">Pending</option>
            </select>
            <select
              value={relevanceBandFilter}
              onChange={e => { setRelevanceBandFilter(e.target.value as typeof relevanceBandFilter); setPage(1) }}
              className="text-[12px] border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-600 outline-none"
            >
              <option value="">All relevance bands</option>
              <option value="Strong">Strong</option>
              <option value="Moderate">Moderate</option>
              <option value="Weak">Weak</option>
            </select>
            <select
              value={sourceKindFilter}
              onChange={e => { setSourceKindFilter(e.target.value as typeof sourceKindFilter); setPage(1) }}
              className="text-[12px] border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-600 outline-none"
            >
              <option value="">Library + Web</option>
              <option value="Library">Library</option>
              <option value="Web">Web</option>
            </select>
            <select
              value={databaseFilter}
              onChange={e => { setDatabaseFilter(e.target.value); setPage(1) }}
              className="text-[12px] border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-600 outline-none"
            >
              <option value="">All databases</option>
              {Object.keys(discovery?.sourceCounts ?? {}).map(id => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
            <select
              value={textStateFilter}
              onChange={e => { setTextStateFilter(e.target.value as typeof textStateFilter); setPage(1) }}
              className="text-[12px] border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-600 outline-none"
            >
              <option value="">All text states</option>
              <option value="FullText">Full text</option>
              <option value="AbstractOnly">Abstract only</option>
              <option value="MetadataOnly">Metadata only</option>
            </select>
          </div>

          {candidatesLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map(i => <Skeleton key={i} variant="card" tone="light" />)}
            </div>
          ) : candidates && candidates.items.length > 0 ? (
            <div className="space-y-3">
              {candidates.items.map(c => (
                <ScreeningCandidateCard
                  key={c.id}
                  candidate={c}
                  onUpdateDecision={decision => handleUpdateDecision(c.id, decision)}
                  onUploadPdf={file => handleUploadPdf(c.id, file)}
                />
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-slate-400 text-center py-6">No candidates match these filters.</p>
          )}

          {candidates && candidates.totalCount > candidates.pageSize && (
            <div className="flex items-center justify-between">
              <p className="text-[12px] text-slate-400">
                {candidates.totalCount} results · page {candidates.page} of {Math.ceil(candidates.totalCount / candidates.pageSize)}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-[12px] text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= Math.ceil(candidates.totalCount / candidates.pageSize)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-[12px] text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
          </>
          )}
        </div>
      )}

      {/* CTA */}
      {status.status !== 'Completed' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-[14px] font-bold text-amber-800 mb-1">
            Ready to screen {status.uniqueCount} canonical papers
          </p>
          <p className="text-[12px] text-amber-700 mb-3">
            Library PDFs are checked against exact page-grounded passages. Web records without acquired full text remain clearly marked as abstract-only or metadata-only.
          </p>
          <button
            onClick={handleStart}
            disabled={starting || status.status === 'Running' || status.uniqueCount === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-[12px] font-semibold disabled:opacity-60 transition-all"
          >
            {starting || status.status === 'Running' ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {status.status === 'Running' ? 'Screening…' : 'Run Evidence Screening'}
          </button>
        </div>
      )}

      {/* Footer nav */}
      <div className="flex items-center gap-2">
        <button
          onClick={onReturnToDiscovery}
          className="px-3 py-1.5 rounded-lg border border-slate-200 text-[12px] text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Return to discovery
        </button>
        <button
          onClick={handleSwitchToHybrid}
          className="px-3 py-1.5 rounded-lg border border-slate-200 text-[12px] text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Switch to Hybrid
        </button>
        <button
          onClick={onBackToGathering}
          className="px-3 py-1.5 rounded-lg border border-slate-200 text-[12px] text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Back to Literature Gathering
        </button>
        {status.status === 'Completed' && (
          <button
            onClick={handleApproveCorpusClick}
            disabled={approving || status.relevantCount === 0}
            className="ml-auto flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-[12px] font-semibold disabled:opacity-60 transition-colors"
          >
            {approving ? <Loader2 size={12} className="animate-spin" /> : null}
            Continue to section generation
          </button>
        )}
      </div>

      <ConfirmModal
        isOpen={showLowCoverageModal}
        onClose={() => setShowLowCoverageModal(false)}
        onConfirm={handleConfirmLowCoverage}
        title="Evidence coverage is limited"
        message="Continue with this explicitly acknowledged limitation? You can instead return to discovery or switch to Hybrid/Web to gather more evidence before approving."
      />
    </div>
  )
}

function ScreeningCandidateCard({
  candidate, onUpdateDecision, onUploadPdf,
}: {
  candidate: ScreeningCandidate
  onUpdateDecision: (decision: ManualDecision) => void
  onUploadPdf: (file: File) => Promise<void>
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      await onUploadPdf(file)
    } finally {
      setUploading(false)
    }
  }

  // Before Claude has actually screened this candidate (screeningVerdict === 'Pending',
  // screeningRelevanceScore always 0), the deterministic topicMatchScore is the real signal —
  // mirrors ResearchScreeningService.GetCandidatesAsync's own ordering fallback.
  const effectiveScore = candidate.screeningVerdict !== 'Pending' ? candidate.screeningRelevanceScore : candidate.topicMatchScore
  const relevanceBand = effectiveScore >= 80 ? 'Strong' : effectiveScore >= 50 ? 'Moderate' : 'Weak'
  const matchedTerms = [...candidate.matchedConcepts, ...candidate.matchedPopulation, ...candidate.matchedGeography]

  return (
    <div className="border border-slate-200 rounded-xl p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
              {candidate.source === 'manual' ? 'Library' : 'Web'}
            </span>
            <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
              {candidate.sourceType === 'FullText' ? 'full text' : candidate.sourceType === 'AbstractOnly' ? 'abstract only' : 'metadata only'}
            </span>
            <span className={cn(
              'text-[10px] font-semibold px-1.5 py-0.5 rounded',
              relevanceBand === 'Strong' ? 'bg-emerald-100 text-emerald-700'
                : relevanceBand === 'Moderate' ? 'bg-amber-100 text-amber-700'
                : 'bg-slate-100 text-slate-500',
            )}>
              {relevanceBand}
            </span>
            {candidate.duplicatesCollapsedCount > 0 && (
              <span className="text-[10px] text-slate-400">{candidate.duplicatesCollapsedCount} duplicates collapsed</span>
            )}
          </div>
          <p className="text-[13px] font-semibold text-slate-800 mb-1">{candidate.title}</p>
          <p className="text-[11px] text-slate-500 mb-1">
            {candidate.authors}
            {candidate.publicationYear && ` · ${candidate.publicationYear}`}
            {candidate.journal && ` · ${candidate.journal}`}
          </p>
          {candidate.screeningRationale && (
            <p className="text-[12px] text-slate-600 mb-1">
              <span className="font-semibold">Why:</span> {candidate.screeningRationale}
            </p>
          )}
          <p className="text-[11px] text-slate-400">
            {candidate.doi && <>DOI: {candidate.doi} · </>}
            Found via: {candidate.foundViaSources.join(', ')}
            {candidate.dimensions.length > 0 && <> · Dimensions: {candidate.dimensions.join(', ')}</>}
          </p>
          {matchedTerms.length > 0 && (
            <p className="text-[11px] text-slate-400 mt-1">
              <span className="font-semibold text-slate-500">Matched:</span> {matchedTerms.join(', ')}
            </p>
          )}
        </div>
        <div className="flex gap-3 shrink-0">
          <div className="text-center">
            <p className="text-[9px] font-bold uppercase text-slate-400">Match</p>
            <p className="text-[14px] font-bold text-slate-800">{candidate.topicMatchScore}%</p>
          </div>
          <div className="text-center">
            <p className="text-[9px] font-bold uppercase text-slate-400">Relevance</p>
            <p className="text-[14px] font-bold text-slate-800">{candidate.screeningRelevanceScore}%</p>
          </div>
          <div className="text-center">
            <p className="text-[9px] font-bold uppercase text-slate-400">Evidence</p>
            <p className="text-[14px] font-bold text-slate-800">{candidate.evidencePct}%</p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
        <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          {uploading ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />} Upload PDF
        </button>
        <select
          value={candidate.manualDecision}
          onChange={e => onUpdateDecision(e.target.value as ManualDecision)}
          className="text-[11px] border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-600 outline-none"
        >
          <option value="Automatic">Use automatic decision</option>
          <option value="Include">Include</option>
          <option value="Exclude">Exclude</option>
        </select>
        <span className="ml-auto text-[10px] font-bold uppercase text-slate-500">
          FINAL: {candidate.finalDecision === 'ManualReview' ? 'Manual review' : candidate.finalDecision}
        </span>
      </div>
    </div>
  )
}

// ── Write step: outline + editor + evidence panel ───────────────────────────────

// Stable reference so the Zustand selector's "no sections yet" fallback doesn't
// return a fresh array each render — same fix ResearchAgentPage.tsx applies to
// avoid tripping React's useSyncExternalStore infinite-loop guard.
const EMPTY_WRITE_SECTIONS: ProjectSection[] = []

const WRITE_SECTION_STATUS_ORDER: Record<SectionStatus, number> =
  { NotStarted: 0, Generating: 1, Draft: 2, Edited: 3, Approved: 4 }

const WRITE_SECTION_STATUS_DOT: Record<SectionStatus, string> = {
  NotStarted: 'bg-slate-300',
  Generating: 'bg-amber-400 animate-pulse',
  Draft:      'bg-blue-400',
  Edited:     'bg-violet-400',
  Approved:   'bg-emerald-400',
}

// Chapters whose framing/vocabulary branches on methodology type — kept in sync
// with MethodologySensitiveSectionCodes on the backend (ResearchService.cs).
// docs/OPEN_ITEMS.md #81 — was missing "3.3" and "5.2" relative to the backend's authoritative
// list; the backend independently re-gates both, but the toast below never fired for them.
const WRITE_METHODOLOGY_SENSITIVE_SECTIONS = new Set(['3.3', '5.2', '5.4', '5.5', '5.6', '5.7', '5.7a', '5.9', '5.10', '5.12'])

// A concurrent double-init can create duplicate DB rows for the same section —
// keep the row with the furthest-along status (or, if tied, the longer content).
function dedupeWriteSections(rawSections: ProjectSection[]): ProjectSection[] {
  const best = new Map<string, ProjectSection>()
  for (const s of rawSections) {
    const existing = best.get(s.code)
    if (!existing) { best.set(s.code, s); continue }
    const statusDelta = WRITE_SECTION_STATUS_ORDER[s.status] - WRITE_SECTION_STATUS_ORDER[existing.status]
    if (statusDelta > 0 || (statusDelta === 0 && s.content.length > existing.content.length)) {
      best.set(s.code, s)
    }
  }
  return [...best.values()].sort((a, b) => a.order - b.order)
}

function getWriteChapterNumber(stepId: string): string {
  const match = /^(\d+)\./.exec(stepId)
  return match ? match[1] : '?'
}

function WriteOutlinePane({
  sections, selectedCode, onSelectSection, search, onSearchChange, methodologyType,
}: {
  sections: ProjectSection[]
  selectedCode: string
  onSelectSection: (code: string) => void
  search: string
  onSearchChange: (v: string) => void
  methodologyType?: string
}) {
  const approvedCount = sections.filter(s => s.status === 'Approved').length
  const totalCount = sections.length
  const query = search.trim().toLowerCase()

  const chapterSteps = CHAPTER_STEPS.filter(step => step.sectionKey)
  const filteredSteps = query
    ? chapterSteps.filter(step => getStepLabel(step, methodologyType).toLowerCase().includes(query))
    : chapterSteps

  const chapterGroups: { chapterNum: string; steps: typeof chapterSteps }[] = []
  for (const step of filteredSteps) {
    const num = getWriteChapterNumber(step.id)
    let group = chapterGroups.find(g => g.chapterNum === num)
    if (!group) { group = { chapterNum: num, steps: [] }; chapterGroups.push(group) }
    group.steps.push(step)
  }

  return (
    <div className="w-64 shrink-0 border-r border-slate-200 bg-white flex flex-col min-h-0">
      <div className="p-3 border-b border-slate-100">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" />
          <input
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Find a section"
            className="w-full pl-7 pr-2 py-1.5 text-[12px] border border-slate-200 rounded-lg outline-none focus:border-slate-300"
          />
        </div>
        <p className="mt-2 text-[11px] text-slate-400">{totalCount} sections · {approvedCount} complete</p>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {chapterGroups.map(group => (
          <div key={group.chapterNum} className="mb-1">
            <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Chapter {group.chapterNum}
            </p>
            {group.steps.map(step => {
              const section = sections.find(s => s.code === step.sectionKey)
              const status: SectionStatus = section?.status ?? 'NotStarted'
              return (
                <button
                  key={step.id}
                  onClick={() => onSelectSection(step.sectionKey!)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px] transition-colors',
                    step.sectionKey === selectedCode ? 'bg-slate-100 text-slate-800 font-medium' : 'text-slate-600 hover:bg-slate-50',
                  )}
                >
                  <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', WRITE_SECTION_STATUS_DOT[status])} />
                  <span className="truncate">{getStepLabel(step, methodologyType)}</span>
                </button>
              )
            })}
          </div>
        ))}
        {chapterGroups.length === 0 && (
          <p className="px-3 py-4 text-[12px] text-slate-400 text-center">No sections match "{search}".</p>
        )}
      </div>

      <div className="p-3 border-t border-slate-100">
        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full bg-emerald-400 transition-all"
            style={{ width: `${totalCount ? Math.round((approvedCount / totalCount) * 100) : 0}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function WriteEvidencePanel({
  activeTab, onTabChange, approvedSourcesCount, coverageStatus, citationFlags, onDismissCitationFlag,
  quality, isValidatingQuality, onValidateQuality, notes, onNotesChange,
}: {
  activeTab: 'evidence' | 'quality' | 'notes'
  onTabChange: (tab: 'evidence' | 'quality' | 'notes') => void
  approvedSourcesCount: number
  coverageStatus: ScreeningStatus['coverageStatus'] | null
  citationFlags: CitationFlag[]
  onDismissCitationFlag: (flagId: string) => void
  quality: AlignmentValidationResult | null
  isValidatingQuality: boolean
  onValidateQuality: () => void
  notes: string
  onNotesChange: (v: string) => void
}) {
  const TABS: { id: typeof activeTab; label: string; icon: React.ElementType }[] = [
    { id: 'evidence', label: 'Evidence', icon: BookMarked },
    { id: 'quality',  label: 'Quality',  icon: ShieldCheck },
    { id: 'notes',    label: 'Notes',    icon: StickyNote },
  ]

  return (
    <div className="w-80 shrink-0 border-l border-slate-200 bg-white flex flex-col min-h-0">
      <div className="shrink-0 flex border-b border-slate-100">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => onTabChange(t.id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-medium border-b-2 transition-colors',
              activeTab === t.id ? 'border-[#1e293b] text-slate-800' : 'border-transparent text-slate-400 hover:text-slate-600',
            )}
          >
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'evidence' && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                <span className="text-[14px] font-bold text-emerald-600">{approvedSourcesCount}</span>
              </div>
              <div>
                <p className="text-[12px] font-semibold text-slate-700">Approved evidence</p>
                <p className="text-[11px] text-slate-400">
                  {coverageStatus ? `${coverageStatus} dimension coverage` : 'Coverage not yet assessed'}
                </p>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Citation flags</p>
              {citationFlags.length === 0 ? (
                <p className="text-[12px] text-slate-400 leading-relaxed">
                  This section has no citation flags. This is expected for sections that do not require citations, or once every flag has been resolved.
                </p>
              ) : (
                <div className="space-y-2">
                  {citationFlags.map(flag => (
                    <div key={flag.id} className="border border-amber-200 bg-amber-50 rounded-lg p-2.5">
                      <div className="flex items-start gap-1.5">
                        <AlertTriangle size={12} className="text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-amber-800 leading-snug">{flag.claimSentence || flag.citationRawText}</p>
                      </div>
                      {flag.llmReasoning && (
                        <p className="text-[10px] text-amber-600 mt-1 leading-snug">{flag.llmReasoning}</p>
                      )}
                      <button
                        onClick={() => onDismissCitationFlag(flag.id)}
                        className="mt-1.5 text-[10px] font-medium text-amber-700 hover:text-amber-900 underline underline-offset-2"
                      >
                        Dismiss
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'quality' && (
          <div className="space-y-3">
            <button
              onClick={onValidateQuality}
              disabled={isValidatingQuality}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-slate-200 text-[12px] font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              {isValidatingQuality ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
              {isValidatingQuality ? 'Checking…' : 'Check quality'}
            </button>
            {quality && (
              <>
                <p className={cn('text-[12px] font-medium', quality.isValid ? 'text-emerald-600' : 'text-amber-600')}>
                  {quality.message || (quality.isValid ? 'No quality issues found.' : `${quality.issues.length} issue(s) found.`)}
                </p>
                <div className="space-y-2">
                  {quality.issues.map((issue, i) => (
                    <div key={i} className="border border-slate-200 rounded-lg p-2.5">
                      <p className="text-[11px] font-semibold text-slate-700">{issue.sectionCode}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{issue.issue}</p>
                      {issue.suggestion && <p className="text-[10px] text-slate-400 mt-1">{issue.suggestion}</p>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'notes' && (
          <textarea
            value={notes}
            onChange={e => onNotesChange(e.target.value)}
            placeholder="Jot down anything worth remembering while writing — supervisor feedback, things to revisit, open questions…"
            className="w-full h-64 resize-none border border-slate-200 rounded-lg p-3 text-[12px] text-slate-700 outline-none focus:border-slate-300"
          />
        )}
      </div>
    </div>
  )
}

function WriteWorkspaceTab({ project, approvedSourcesCount }: { project: ResearchProject; approvedSourcesCount: number }) {
  const {
    sections: allSections, initSections, loadSections, generateSection, saveSection,
    approveSection, regenerateSection, validateQuality,
  } = useResearchStore()
  const updateProject = useResearchStore(s => s.updateProject)
  const syncProject = useResearchStore(s => s.syncProject)
  const hasEnoughCredits = useCreditGate()

  const rawSections = allSections[project.id] ?? EMPTY_WRITE_SECTIONS
  const sections = dedupeWriteSections(rawSections)

  const [selectedCode, setSelectedCode] = useState('1.0')
  const [search, setSearch] = useState('')
  const [localContent, setLocalContent] = useState(() =>
    (sections.find(s => s.code === '1.0')?.content ?? '').replace(/\r\n/g, '\n'))
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showRegenConfirm, setShowRegenConfirm] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [bibliography, setBibliography] = useState<ParsedReference[] | null>(null)
  const [loadingBibliography, setLoadingBibliography] = useState(false)
  const [literature, setLiterature] = useState<FetchedLiterature[] | null>(null)
  const [citationFlags, setCitationFlags] = useState<CitationFlag[]>([])
  const [rightTab, setRightTab] = useState<'evidence' | 'quality' | 'notes'>('evidence')
  const [screeningStatus, setScreeningStatus] = useState<ScreeningStatus | null>(null)
  const [quality, setQuality] = useState<AlignmentValidationResult | null>(null)
  const [isValidatingQuality, setIsValidatingQuality] = useState(false)
  const [notes, setNotes] = useState(project.notes ?? '')

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isSavingRef = useRef(false)
  const pendingContentRef = useRef<string | null>(null)
  const initCalledRef = useRef(false)
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const documentSurfaceRef = useRef<DocumentSurfaceHandle>(null)

  // Init sections once — idempotent POST, mirrors ChapterWriterView's own bootstrap.
  useEffect(() => {
    if (initCalledRef.current) return
    initCalledRef.current = true
    setIsInitializing(true)
    initSections(project.id)
      .catch(() => toast.error('Could not set up chapter sections.'))
      .finally(() => setIsInitializing(false))
  }, [project.id, initSections])

  // Cheap DB read (no LLM) — fetched once so citation clicks resolve to real data.
  useEffect(() => {
    researchApi.getLiterature(project.id).then(setLiterature).catch(() => setLiterature([]))
  }, [project.id])

  // Cheap DB read — drives the Evidence tab's approved-sources/coverage subtext.
  useEffect(() => {
    researchApi.getScreeningStatus(project.id).then(setScreeningStatus).catch(() => setScreeningStatus(null))
  }, [project.id])

  const activeSection = sections.find(s => s.code === selectedCode)

  // Plain-text excerpt of the active section's current content, for the regenerate-confirmation
  // preview — strips markdown syntax rather than rendering it, since the modal has no room for
  // formatted output.
  const regenPreviewExcerpt = (() => {
    if (!activeSection?.content) return ''
    const plain = activeSection.content.replace(/[#*_`>-]/g, '').replace(/\s+/g, ' ').trim()
    return plain.length > 100 ? `${plain.slice(0, 100)}…` : plain
  })()

  // Re-fetched on section change/status flip, and also when the background claim-support pass
  // (CitationClaimSupportVerificationJob) finishes — see the polling effect below — since that's
  // the pass that can find journal/author/claim mismatches, not just the deterministic checks
  // that already ran synchronously.
  useEffect(() => {
    if (!activeSection) { setCitationFlags([]); return }
    researchApi.getCitationFlags(project.id, activeSection.code)
      .then(setCitationFlags)
      .catch(() => setCitationFlags([]))
  }, [project.id, activeSection?.code, activeSection?.status, activeSection?.citationsPendingVerification])

  // Poll until the background claim-support check lands, so the "Verifying citations…" badge
  // clears and any resulting flags (handled above) appear without a manual refresh.
  useEffect(() => {
    if (!activeSection?.citationsPendingVerification) return
    const intervalId = setInterval(() => {
      loadSections(project.id).catch(() => {})
    }, 4000)
    return () => clearInterval(intervalId)
  }, [project.id, activeSection?.code, activeSection?.citationsPendingVerification, loadSections])

  const storeContent = (activeSection?.content ?? '').replace(/\r\n/g, '\n')
  const editorContent = isDirty ? localContent : storeContent

  const selectSection = (code: string) => {
    const sec = sections.find(s => s.code === code)
    setSelectedCode(code)
    setLocalContent((sec?.content ?? '').replace(/\r\n/g, '\n'))
    setIsDirty(false)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
  }

  // LLM-backed, so compiled lazily (on first request) rather than eagerly on mount.
  const fetchBibliography = () => {
    setLoadingBibliography(true)
    researchApi.compileBibliography(project.id)
      .then(compiled => setBibliography(parseBibliographyEntries(compiled)))
      .catch(() => toast.error('Failed to load references. Please try again.'))
      .finally(() => setLoadingBibliography(false))
  }
  const handleRequestBibliography = () => {
    if (!bibliography && !loadingBibliography) fetchBibliography()
  }

  const handleContentChange = (val: string) => {
    setLocalContent(val)
    setIsDirty(true)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    // DocumentSurface's own onSave fires with a 1s debounce; this 4s fallback
    // covers tab-switching without triggering onSave.
    saveTimerRef.current = setTimeout(() => handleSave(val), 4000)
  }

  const handleSave = async (content = localContent) => {
    if (!activeSection || !isDirty) return
    if (isSavingRef.current) { pendingContentRef.current = content; return }
    isSavingRef.current = true
    setIsSaving(true)
    let toSave: string | null = content
    try {
      while (toSave !== null) {
        await saveSection(project.id, selectedCode, toSave)
        if (pendingContentRef.current !== null && pendingContentRef.current !== toSave) {
          toSave = pendingContentRef.current
          pendingContentRef.current = null
        } else {
          toSave = null
        }
      }
      setIsDirty(false)
    } catch {
      toast.error('Save failed.')
    } finally {
      isSavingRef.current = false
      pendingContentRef.current = null
      setIsSaving(false)
    }
  }

  const syncAfterGeneration = () => {
    setIsDirty(false)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
  }

  const handleGenerate = async (targetWordCount = 500) => {
    if (!activeSection) return
    if (!hasEnoughCredits(CREDIT_COSTS.proposalSectionGeneration)) return
    // docs/OPEN_ITEMS.md #81 — checks the real confirmed methodology, not just whether
    // methodologyType is a non-empty (possibly unconfirmed) string.
    if (WRITE_METHODOLOGY_SENSITIVE_SECTIONS.has(selectedCode) && !project.confirmedMethodology) {
      toast.error('Methodology must be confirmed (in the Brief step) before generating this section.')
      return
    }
    try {
      await generateSection(project.id, selectedCode, targetWordCount)
      syncAfterGeneration()
    } catch (err) {
      toast.error(extractErrorMessage(err) || 'Generation failed — check the server is running.')
    }
  }

  const runRegenerate = async () => {
    if (!hasEnoughCredits(CREDIT_COSTS.proposalSectionGeneration)) return
    try {
      await regenerateSection(project.id, selectedCode)
      syncAfterGeneration()
    } catch {
      toast.error('Regeneration failed.')
    }
  }

  const handleRegenerate = async () => {
    if (!activeSection) return
    // Only confirm when the user has personally edited or approved the section —
    // a draft/not-started section contains only AI output, so no confirmation needed.
    if (activeSection.status === 'Edited' || activeSection.status === 'Approved') {
      setShowRegenConfirm(true)
      return
    }
    await runRegenerate()
  }

  const handleApprove = async (acknowledgeConflicts = false) => {
    if (isDirty) await handleSave()
    try {
      await approveSection(project.id, selectedCode, acknowledgeConflicts)
      toast.success(`Section ${selectedCode} approved.`)
    } catch (err) {
      const errorCode = (err as ApiError | undefined)?.code
      if (errorCode === 'FACT_CONFLICT' || errorCode === 'UNRESOLVED_CITATION_GAP' || errorCode === 'CITATION_INTEGRITY_BLOCKED') {
        const msg = errorCode === 'FACT_CONFLICT'
          ? "This section's facts conflict with an earlier chapter."
          : errorCode === 'UNRESOLVED_CITATION_GAP'
            ? 'This section still has an unresolved "[CITATION NEEDED]" gap.'
            : 'This section has an unresolved citation issue (unsupported claim or implausible year).'

        toast((t) => (
          <div className="flex flex-col gap-2 text-[13px]">
            <span>{msg}</span>
            <div className="flex gap-3 mt-1">
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
      toast.error(extractErrorMessage(err) || 'Could not approve section.')
    }
  }

  const handleDismissCitationFlag = (flagId: string) => {
    setCitationFlags(prev => prev.filter(f => f.id !== flagId))
    researchApi.dismissCitationFlag(project.id, flagId)
      .catch(() => toast.error('Failed to dismiss flag. Please try again.'))
  }

  const handleValidateQuality = async () => {
    setIsValidatingQuality(true)
    try {
      setQuality(await validateQuality(project.id))
    } catch {
      toast.error('Quality check failed.')
    } finally {
      setIsValidatingQuality(false)
    }
  }

  const handleNotesChange = (val: string) => {
    setNotes(val)
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current)
    notesTimerRef.current = setTimeout(() => {
      updateProject(project.id, { notes: val })
      syncProject(project.id).catch(() => toast.error('Could not save notes.'))
    }, 1000)
  }

  const isGenerating = activeSection?.status === 'Generating'
  const hasContent = (activeSection?.content ?? '').trim().length > 0
  const wordCount = editorContent.trim().split(/\s+/).filter(Boolean).length

  return (
    <div className="flex h-full min-h-0">
      <WriteOutlinePane
        sections={sections}
        selectedCode={selectedCode}
        onSelectSection={selectSection}
        search={search}
        onSearchChange={setSearch}
        methodologyType={project.methodologyType}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {!activeSection ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
            <Loader2 size={22} className="animate-spin text-slate-300" />
            <p className="text-[13px] text-slate-500">
              {isInitializing ? 'Setting up sections…' : 'Loading section…'}
            </p>
          </div>
        ) : (
          <>
            <ConfirmModal
              isOpen={showRegenConfirm}
              onClose={() => setShowRegenConfirm(false)}
              onConfirm={runRegenerate}
              title="Regenerate section?"
              message={
                <>
                  <p>
                    Your current draft of {activeSection.code} {activeSection.title} will be replaced. This cannot be undone.
                  </p>
                  {activeSection.status === 'Approved' && (
                    <p className="mt-2 text-amber-600">
                      This section is currently <span className="font-semibold">Approved</span>. Regenerating will reset it to Draft and you'll need to re-approve it.
                    </p>
                  )}
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-[11px] font-medium text-slate-500 mb-0.5">
                      Current draft &middot; {activeSection.wordCount.toLocaleString()} words
                    </p>
                    <p className="text-[12px] text-slate-600 line-clamp-2">
                      {regenPreviewExcerpt || 'No content yet.'}
                    </p>
                  </div>
                  <p className="mt-2 text-[12px] text-slate-500">
                    This will use {CREDIT_COSTS.proposalSectionGeneration} credits.
                  </p>
                </>
              }
              confirmLabel="Regenerate"
              confirmClassName="bg-[#7c3aed] hover:bg-[#6d28d9]"
            />
            <DocumentSurface
              ref={documentSurfaceRef}
              key={activeSection.code}
              sectionCode={activeSection.code}
              sectionTitle={activeSection.title}
              sectionDescription={SECTION_PROMPTS[activeSection.code]?.heading ?? ''}
              content={editorContent}
              status={activeSection.status}
              wordCount={wordCount}
              isGenerating={isGenerating}
              isSaving={isSaving}
              hasContent={hasContent}
              citationStyle={project.citationStyle}
              literature={literature}
              bibliography={bibliography}
              citationFlags={citationFlags}
              citationsPendingVerification={activeSection.citationsPendingVerification}
              isUnderReferenced={activeSection.isUnderReferenced}
              citationTarget={activeSection.citationTarget}
              resolvedCitationCount={activeSection.resolvedCitationCount}
              onContentChange={handleContentChange}
              onSave={() => handleSave()}
              onGenerate={wc => handleGenerate(wc)}
              onRegenerate={handleRegenerate}
              onApprove={handleApprove}
              onRequestBibliography={handleRequestBibliography}
              onDismissCitationFlag={handleDismissCitationFlag}
            />
          </>
        )}
      </div>

      <WriteEvidencePanel
        activeTab={rightTab}
        onTabChange={setRightTab}
        approvedSourcesCount={approvedSourcesCount}
        coverageStatus={screeningStatus?.coverageStatus ?? null}
        citationFlags={citationFlags}
        onDismissCitationFlag={handleDismissCitationFlag}
        quality={quality}
        isValidatingQuality={isValidatingQuality}
        onValidateQuality={handleValidateQuality}
        notes={notes}
        onNotesChange={handleNotesChange}
      />
    </div>
  )
}

// ── Placeholder tab/step content — not yet specced ──────────────────────────────

function PlaceholderPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-8">
      <div className="border-2 border-dashed border-slate-200 rounded-xl py-16 text-center">
        <p className="text-[14px] font-semibold text-slate-600 mb-1">{title}</p>
        <p className="text-[12px] text-slate-400 max-w-sm mx-auto">{description}</p>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function LiteratureReviewPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const existingProjectId = searchParams.get('projectId')

  const [currentStep, setCurrentStep] = useState(0)
  const [activeTab, setActiveTab]     = useState<TopicTabId>('topic')
  const [gatherTab, setGatherTab]     = useState<GatherTabId>('gathering')
  const [citation, setCitation]       = useState<CitationStyle>('apa7')
  const [citeMenuOpen, setCiteMenuOpen] = useState(false)
  const [approvedSources, setApprovedSources] = useState(0)
  const [projectId, setProjectId]     = useState<string | null>(null)
  const creatingRef = useRef(false)
  const hydratedRef = useRef(false)

  const createProject = useResearchStore(s => s.createProject)
  const loadProject    = useResearchStore(s => s.loadProject)
  const updateProject  = useResearchStore(s => s.updateProject)
  const syncProject    = useResearchStore(s => s.syncProject)
  const projects       = useResearchStore(s => s.projects)
  const project = projects.find(p => p.id === projectId) ?? null
  const gatheredCount = project?.selectedLibraryDocumentIds?.length ?? 0

  // Resume an existing project when navigated here with ?projectId= (from the Discovery
  // progress page's "Continue to Evidence Screening"/"Back to strategy" links) — otherwise
  // this would silently spin up a brand-new blank project every time, discarding whatever
  // step/data the user was already on. generate-topics requires an existing ResearchProject
  // row for a genuinely fresh session (it's what first persists fieldInterest/academicLevel
  // onto it) — silently provision one then, mirroring the "new" bootstrap in
  // ResearchAgentPage.tsx. The ref guard prevents a duplicate create/load under React 18
  // StrictMode's double effect-fire.
  useEffect(() => {
    if (projectId || creatingRef.current) return
    creatingRef.current = true

    if (existingProjectId) {
      loadProject(existingProjectId)
        .then(() => setProjectId(existingProjectId))
        .catch(() => toast.error('Could not load this research project.'))
      return
    }

    createProject({ generatorMode: 'GENERATOR', documentMode: 'PROPOSAL' })
      .then(p => setProjectId(p.id))
      .catch(() => toast.error('Could not start a new literature review session.'))
  }, [projectId, existingProjectId, createProject, loadProject])

  // Hydrate step position + citation style from the backend once the project
  // loads, so a refresh mid-flow doesn't silently reset progress back to Brief
  // or the citation dropdown back to a guessed default. Both fields already
  // exist on ResearchProject and ride the same full-state sync as everything
  // else on this page — this project row is dedicated to this page (never
  // opened via the Proposal Studio route), so reusing currentStep for our
  // 0-4 Brief/Gather/Screen/Write/Finish index has no semantic collision with
  // the wizard's own much longer STEPS array.
  useEffect(() => {
    if (!project || hydratedRef.current) return
    hydratedRef.current = true
    if (project.currentStep > 0) setCurrentStep(project.currentStep)
    setCitation(project.citationStyle)
  }, [project])

  const persistStep = (step: number) => {
    if (!project) return
    updateProject(project.id, { currentStep: step })
    syncProject(project.id).catch(() => toast.error('Could not save your progress.'))
  }

  const setCitationStyle = (style: CitationStyle) => {
    setCitation(style)
    setCiteMenuOpen(false)
    if (!project) return
    updateProject(project.id, { citationStyle: style })
    syncProject(project.id).catch(() => toast.error('Could not save your citation style.'))
  }

  // The Brief step (index 0) is itself a 3-tab sequence (Topic → Title → Location);
  // Previous/Next walk through those tabs before falling through to the outer
  // step stepper, matching the reference app where "Next" always means "the next
  // screen" regardless of which axis (tab or step) that screen lives on.
  const isBriefStep = currentStep === 0
  const tabIndex = TOPIC_TABS.findIndex(t => t.id === activeTab)

  const titleIsSet = !!project?.title && project.title !== 'Untitled Research Project'
  // Mirrors ResearchLocationTab's own canProceed — location is only required
  // when the enabled toggle is on, matching ResearchAgentPage.tsx's LocationStep.
  const locationEnabled = (project?.sectionContent['location-enabled'] ?? 'true') !== 'false'
  const locationComplete = !locationEnabled || (
    !!project?.studyLocation?.trim() && !!project?.studyPopulation?.trim()
  )
  const nextBlockedOnBrief = isBriefStep && (
    (activeTab === 'topic' && !project?.selectedTopic) ||
    (activeTab === 'title' && !titleIsSet) ||
    (activeTab === 'location' && !locationComplete)
  )

  // isBriefStep and "last step" are mutually exclusive (Brief is always index 0
  // of a 5-step pipeline), so the last-tab check only ever needs to gate Brief
  // itself — reaching the actual final step always means Next has nothing left.
  const canGoBack = !(isBriefStep && tabIndex === 0)
  const atLastScreen = !isBriefStep && currentStep >= LR_STEPS.length - 1
  const canGoNext = !atLastScreen && !nextBlockedOnBrief

  const goBack = () => {
    if (!canGoBack) return
    if (isBriefStep && tabIndex > 0) {
      setActiveTab(TOPIC_TABS[tabIndex - 1].id)
    } else {
      const next = currentStep - 1
      setCurrentStep(next)
      setActiveTab('location')
      persistStep(next)
    }
  }

  const goNext = () => {
    if (!canGoNext) return
    if (isBriefStep && tabIndex < TOPIC_TABS.length - 1) {
      setActiveTab(TOPIC_TABS[tabIndex + 1].id)
    } else {
      const next = currentStep + 1
      setCurrentStep(next)
      setActiveTab('topic')
      persistStep(next)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#F8F9FA' }}>

      {/* ── Header bar ─────────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-5 py-3 flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft size={16} />
        </button>

        {/* Title + badge */}
        <div className="shrink-0 flex items-center gap-2">
          <h1 className="text-[15px] font-bold text-slate-800">Literature Review</h1>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            Generator
          </span>
        </div>

        {/* Stepper */}
        <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
          {LR_STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => { setCurrentStep(i); persistStep(i) }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all whitespace-nowrap',
                i === currentStep
                  ? 'bg-[#1e293b] text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100',
              )}
            >
              <span className={cn(
                'w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
                i === currentStep ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500',
              )}>
                {i + 1}
              </span>
              {s.label}
            </button>
          ))}
        </div>

        {/* Right controls */}
        <div className="shrink-0 flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[12px] text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Saved
          </span>

          <div className="relative">
            <button
              onClick={() => setCiteMenuOpen(v => !v)}
              className="flex items-center gap-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-600 hover:bg-slate-50 transition-colors"
            >
              {CITATION_LABELS[citation]} <ChevronDown size={11} />
            </button>
            {citeMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setCiteMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-xl shadow-xl z-20 py-1 overflow-hidden border border-slate-200">
                  {CITATION_STYLES.map(s => (
                    <button
                      key={s}
                      onClick={() => setCitationStyle(s)}
                      className={cn(
                        'w-full text-left px-3 py-1.5 text-[12px] transition-colors hover:bg-slate-50',
                        s === citation ? 'font-semibold text-slate-800' : 'text-slate-600',
                      )}
                    >
                      {CITATION_LABELS[s]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <span className="flex items-center gap-1 border border-slate-200 rounded-lg px-2 py-1.5 text-[12px] text-slate-500">
            <Bookmark size={12} /> {gatheredCount}
          </span>

          <span className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-slate-600">
            <CheckCircle2 size={12} className="text-slate-400" /> {approvedSources} approved sources
          </span>

          <button
            className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-[12px] font-semibold rounded-lg px-3.5 py-1.5 transition-colors"
          >
            <Sparkles size={13} /> Generate
          </button>
        </div>
      </div>

      {/* ── Tab switcher — Brief's 3 tabs, or Gather's 2, per step ──────────── */}
      {(currentStep === 0 || currentStep === 1) && (
        <div className="shrink-0 bg-white border-b border-slate-100 px-5 py-3">
          <div className="inline-flex gap-1 bg-slate-100 p-1 rounded-lg">
            {currentStep === 0
              ? TOPIC_TABS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={cn(
                      'px-4 py-1.5 rounded-md text-[13px] font-medium transition-all',
                      activeTab === t.id
                        ? 'bg-[#1e293b] text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-700',
                    )}
                  >
                    {t.label}
                  </button>
                ))
              : GATHER_TABS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setGatherTab(t.id)}
                    className={cn(
                      'px-4 py-1.5 rounded-md text-[13px] font-medium transition-all',
                      gatherTab === t.id
                        ? 'bg-[#1e293b] text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-700',
                    )}
                  >
                    {t.label}
                  </button>
                ))}
          </div>
        </div>
      )}

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <div className={cn('flex-1 min-h-0', currentStep === 3 ? 'overflow-hidden' : 'overflow-y-auto py-8 px-4')}>
        <div className={cn(
          currentStep === 3
            ? 'h-full bg-white'
            : 'max-w-3xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm',
        )}>
          {currentStep === 0 ? (
            activeTab === 'topic' ? (
              project ? (
                <ResearchTopicTab project={project} onProceedToTitles={() => setActiveTab('title')} />
              ) : (
                <div className="p-8 flex items-center justify-center gap-2 text-slate-400 text-[13px]">
                  <Loader2 size={14} className="animate-spin" /> Preparing your workspace…
                </div>
              )
            ) : activeTab === 'title' ? (
              project?.selectedTopic ? (
                <ResearchTitleTab project={project} />
              ) : (
                <PlaceholderPanel
                  title="Research Title"
                  description="Confirm a research topic first, then generated title options will appear here."
                />
              )
            ) : project ? (
              <ResearchLocationTab project={project} onProceedToGather={goNext} />
            ) : (
              <div className="p-8 flex items-center justify-center gap-2 text-slate-400 text-[13px]">
                <Loader2 size={14} className="animate-spin" /> Preparing your workspace…
              </div>
            )
          ) : currentStep === 1 ? (
            project ? (
              gatherTab === 'gathering' ? (
                <ResearchGatherTab project={project} />
              ) : (
                <ResearchLiteratureDiscoveryTab project={project} />
              )
            ) : (
              <div className="p-8 flex items-center justify-center gap-2 text-slate-400 text-[13px]">
                <Loader2 size={14} className="animate-spin" /> Preparing your workspace…
              </div>
            )
          ) : currentStep === 2 ? (
            project ? (
              <ResearchScreeningTab
                project={project}
                onReturnToDiscovery={() => { setCurrentStep(1); setGatherTab('discovery'); persistStep(1) }}
                onBackToGathering={() => { setCurrentStep(1); setGatherTab('gathering'); persistStep(1) }}
                onApprovedCountChange={setApprovedSources}
                onCorpusApproved={step => { setCurrentStep(step); persistStep(step) }}
              />
            ) : (
              <div className="p-8 flex items-center justify-center gap-2 text-slate-400 text-[13px]">
                <Loader2 size={14} className="animate-spin" /> Preparing your workspace…
              </div>
            )
          ) : currentStep === 3 ? (
            project ? (
              <WriteWorkspaceTab project={project} approvedSourcesCount={approvedSources} />
            ) : (
              <div className="p-8 flex items-center justify-center gap-2 text-slate-400 text-[13px]">
                <Loader2 size={14} className="animate-spin" /> Preparing your workspace…
              </div>
            )
          ) : (
            <PlaceholderPanel
              title={`${LR_STEPS[currentStep].label} — coming soon`}
              description="This step of the Literature Review workflow hasn't been built out yet."
            />
          )}
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-white border-t border-slate-200 px-5 py-3 flex items-center gap-3">
        <button
          onClick={goBack}
          disabled={!canGoBack}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[13px] text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 hover:text-slate-600 transition-colors"
        >
          <ChevronLeft size={14} /> Previous
        </button>

        <p className="flex-1 text-center text-[12px] text-slate-400 flex items-center justify-center gap-1.5">
          <Check size={12} className="text-emerald-400" /> All changes saved
        </p>

        <button
          onClick={goNext}
          disabled={!canGoNext}
          className="flex items-center gap-1.5 px-5 py-1.5 rounded-lg bg-[#1e293b] hover:bg-slate-800 text-white text-[13px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}
