import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft, ChevronRight, ChevronDown, Save, Download,
  Sparkles, Loader2, CheckCircle2, Circle, BookOpen,
  Lock, RefreshCw, FileText, AlertCircle, Check, Edit2,
  PenLine, ShieldCheck, X, GraduationCap,
  ClipboardList, Mic, HelpCircle, Copy, FolderOpen, Globe, Layers,
  Library, Shield, SpellCheck, Scissors, BarChart2, MessageSquare,
  BookMarked, Brain, Settings, Menu,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useResearchStore } from '../../store/researchStore'
import { useLibraryStore } from '../../store/libraryStore'
import { useAuthStore } from '../../store/authStore'
import { researchApi } from '../../api/research'
import { DocumentSurface, type DocumentSurfaceHandle } from '../../components/research-agent/DocumentSurface'
import { ReferencesDrawer } from '../../components/research-agent/ReferencesDrawer'
import { parseBibliographyEntries, formatInTextCitation, type ParsedReference } from '../../lib/citationFormat'
import '../../styles/research-agent-editor.css'
import type {
  AcademicLevel, AlignmentValidationResult, CitationStyle,
  DocumentMode, FetchedLiterature, GeneratorMode, ProjectSection, ResearchProject,
  ResearchTopic, GeneratedTitle, SectionStatus,
  ProjectHypothesis, UpdateHypothesisPayload, DefencePreparation,
} from '../../types/research'
import toast from 'react-hot-toast'

// ── Step definitions ──────────────────────────────────────────────────────────

export const STEPS: {
  id: string
  label: string
  group: 'setup' | 'chapters' | 'output'
  type: 'wizard' | 'chapter' | 'output'
  sectionKey?: string
  description?: string
}[] = [
  { id: 'research-topic', label: 'Research Topic',              group: 'setup',    type: 'wizard',  description: 'What is your research about?' },
  { id: 'research-title', label: 'Research Title',              group: 'setup',    type: 'wizard',  description: 'Give your proposal a working title.' },
  { id: 'location',       label: 'Location',                    group: 'setup',    type: 'wizard',  description: 'Where is the study being conducted?' },
  { id: 'literature',     label: 'Literature Gathering',        group: 'setup',    type: 'wizard',  description: 'Select documents or paste web references.' },
  { id: '1.0',            label: '1.0 Introduction',            group: 'chapters', type: 'chapter', sectionKey: '1.0' },
  { id: '1.2',            label: '1.2 Background',              group: 'chapters', type: 'chapter', sectionKey: '1.2' },
  { id: '2.0',            label: '2.0 Literature Review',       group: 'chapters', type: 'chapter', sectionKey: '2.0' },
  { id: '3.1',            label: '3.1 Problem Statement',       group: 'chapters', type: 'chapter', sectionKey: '3.1' },
  { id: '3.2',            label: '3.2 Justification',           group: 'chapters', type: 'chapter', sectionKey: '3.2' },
  { id: '3.3',            label: '3.3 Conceptual Framework',    group: 'chapters', type: 'chapter', sectionKey: '3.3' },
  { id: '4.1',            label: '4.1 Research Questions',      group: 'chapters', type: 'chapter', sectionKey: '4.1' },
  { id: '4.2',            label: '4.2 General Objective',       group: 'chapters', type: 'chapter', sectionKey: '4.2' },
  { id: '4.3',            label: '4.3 Specific Objectives',     group: 'chapters', type: 'chapter', sectionKey: '4.3' },
  { id: '5.1',            label: '5.1 Study Area',              group: 'chapters', type: 'chapter', sectionKey: '5.1' },
  { id: '5.2',            label: '5.2 Study Design',            group: 'chapters', type: 'chapter', sectionKey: '5.2' },
  { id: '5.3',            label: '5.3 Study Population',        group: 'chapters', type: 'chapter', sectionKey: '5.3' },
  { id: '5.4',            label: '5.4 Inclusion/Exclusion',     group: 'chapters', type: 'chapter', sectionKey: '5.4' },
  { id: '5.5',            label: '5.5 Sample Size',             group: 'chapters', type: 'chapter', sectionKey: '5.5' },
  { id: '5.6',            label: '5.6 Sampling Procedure',      group: 'chapters', type: 'chapter', sectionKey: '5.6' },
  { id: '5.7',            label: '5.7 Study Variables',         group: 'chapters', type: 'chapter', sectionKey: '5.7' },
  { id: '5.8',            label: '5.8 Data Collection',         group: 'chapters', type: 'chapter', sectionKey: '5.8' },
  { id: '5.9',            label: '5.9 Quality Assurance',       group: 'chapters', type: 'chapter', sectionKey: '5.9' },
  { id: '5.10',           label: '5.10 Data Management',        group: 'chapters', type: 'chapter', sectionKey: '5.10' },
  { id: '5.11',           label: '5.11 Ethical Considerations', group: 'chapters', type: 'chapter', sectionKey: '5.11' },
  { id: '5.12',           label: '5.12 Study Limitations',      group: 'chapters', type: 'chapter', sectionKey: '5.12' },
  { id: '6.1',            label: '6.1 Timeline',                group: 'chapters', type: 'chapter', sectionKey: '6.1' },
  { id: '6.2',            label: '6.2 Budget',                  group: 'chapters', type: 'chapter', sectionKey: '6.2' },
  { id: '6.3',            label: '6.3 Dissemination',           group: 'chapters', type: 'chapter', sectionKey: '6.3' },
  { id: 'references',     label: 'References',                  group: 'output',   type: 'output' },
  { id: 'full-document',  label: 'Full Document',               group: 'output',   type: 'output' },
  { id: 'download',       label: 'Download',                    group: 'output',   type: 'output' },
]

// ── Section descriptions ──────────────────────────────────────────────────────

const SECTION_PROMPTS: Record<string, { heading: string; prompt: string }> = {
  '1.0':  { heading: 'Introduction',          prompt: 'Write a compelling introduction that contextualises the study and outlines its importance within the field.' },
  '1.2':  { heading: 'Background',            prompt: 'Describe the historical and contextual background of the research problem, tracing its development and significance.' },
  '2.0':  { heading: 'Literature Review',     prompt: 'Synthesise existing research relevant to your topic. Identify key themes, debates, and gaps in the literature.' },
  '3.1':  { heading: 'Problem Statement',     prompt: 'Articulate the specific research problem your study addresses. Be precise about what gap or issue you are solving.' },
  '3.2':  { heading: 'Justification',         prompt: 'Justify why this research is necessary, timely, and valuable to the academic community and/or practitioners.' },
  '3.3':  { heading: 'Conceptual Framework',  prompt: 'Describe the theoretical or conceptual framework guiding the study, including key concepts and their relationships.' },
  '4.1':  { heading: 'Research Questions',    prompt: 'State the primary and secondary research questions that your study aims to answer.' },
  '4.2':  { heading: 'General Objective',     prompt: 'State the overarching goal of the study in one clear sentence.' },
  '4.3':  { heading: 'Specific Objectives',   prompt: 'List 3–5 measurable specific objectives that align with the research questions.' },
  '5.1':  { heading: 'Study Area',            prompt: 'Describe the geographic, institutional, or conceptual scope of the study area, including relevant characteristics.' },
  '5.2':  { heading: 'Study Design',          prompt: 'Specify the research design (e.g., cross-sectional, longitudinal, case study) and justify your choice.' },
  '5.3':  { heading: 'Study Population',      prompt: 'Define the target population, including key demographic characteristics and relevance to the study.' },
  '5.4':  { heading: 'Inclusion/Exclusion Criteria', prompt: 'List clear criteria for who or what will be included and excluded from the study, and justify each criterion.' },
  '5.5':  { heading: 'Sample Size',           prompt: 'Describe the sample size calculation method and the determined sample size with statistical justification.' },
  '5.6':  { heading: 'Sampling Procedure',    prompt: 'Describe the sampling technique (random, stratified, purposive, etc.) and the step-by-step procedure.' },
  '5.7':  { heading: 'Study Variables',       prompt: 'List and define the independent, dependent, and confounding variables. Describe measurement scales.' },
  '5.8':  { heading: 'Data Collection',       prompt: 'Describe the instruments, tools, and methods used to collect data, including validation approaches.' },
  '5.9':  { heading: 'Quality Assurance',     prompt: 'Explain measures taken to ensure data quality including training, pre-testing, and supervision protocols.' },
  '5.10': { heading: 'Data Management',       prompt: 'Describe how data will be stored, coded, cleaned, and backed up. Address data security and access controls.' },
  '5.11': { heading: 'Ethical Considerations', prompt: 'Outline the ethical issues considered: informed consent, confidentiality, anonymity, IRB approval, etc.' },
  '5.12': { heading: 'Study Limitations',     prompt: 'Honestly discuss the limitations of the study design, sample, instruments, and potential biases.' },
  '6.1':  { heading: 'Timeline',              prompt: 'Present a Gantt-style timeline of activities from proposal approval through data collection, analysis, and write-up.' },
  '6.2':  { heading: 'Budget',                prompt: 'Provide a detailed budget breakdown covering personnel, materials, travel, data collection, and dissemination costs.' },
  '6.3':  { heading: 'Dissemination',         prompt: 'Describe how findings will be communicated to stakeholders, journals, conferences, and policymakers.' },
}

function getSectionDescription(sectionCode?: string): string {
  const descriptions: Record<string, string> = {
    '1.0':  'Write a compelling introduction that contextualises the study and outlines its importance within the field.',
    '1.2':  'Provide historical and contextual background — how has the problem evolved and what do we know so far?',
    '2.0':  'Synthesise existing literature thematically and identify the gap this study addresses. Every paragraph must cite multiple sources.',
    '3.1':  'State the specific gap or problem this study addresses in one focused paragraph. Every sentence must be cited.',
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
    '5.7':  'Define all variables — type, operational definition, measurement scale, and data source.',
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

function ResearchTopicStep({
  project,
}: {
  project: ReturnType<typeof useResearchStore>['projects'][0]
  onNext:  () => void
}) {
  const { updateProject, setTopics, selectTopic } = useResearchStore()
  const [field,    setField]      = useState(project.fieldInterest)
  const [level,    setLevel]      = useState<AcademicLevel>(project.academicLevel)
  const [loading,  setLoading]    = useState(false)
  const [topics,   setLocalTopics] = useState<ResearchTopic[]>(project.suggestedTopics)
  const [chosen,   setChosen]     = useState<ResearchTopic | null>(project.selectedTopic)
  // When a topic is confirmed, show the summary view. Clicking "Edit Topic" flips back.
  const [confirmed, setConfirmed] = useState(!!project.selectedTopic)

  const canGenerate = field.trim().length > 10

  const handleGenerate = async () => {
    if (!canGenerate) return
    updateProject(project.id, { fieldInterest: field, academicLevel: level })
    setLoading(true)
    try {
      const results = await researchApi.generateTopics(project.id, field, level)
      setLocalTopics(results)
      setTopics(project.id, results)
    } catch {
      toast.error('Failed to generate topics. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (t: ResearchTopic) => {
    setChosen(t)
    selectTopic(project.id, t)
    setConfirmed(true)
  }

  const handleChangeTopic = () => {
    setChosen(null)
    selectTopic(project.id, null)
    setConfirmed(false)
    setLocalTopics([])
  }

  const handleChip = (chip: string) =>
    setField(prev => prev ? `${prev.trimEnd()} ${chip}` : chip)

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
        {/* Callout */}
        <div className="bg-sky-50/70 border border-sky-100 rounded-xl p-4 mb-6 flex gap-3">
          <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles size={15} className="text-sky-600" />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-slate-800">Find Your Research Topic</p>
            <p className="text-[12px] text-slate-500 mt-0.5 leading-relaxed">
              Enter your field of study or describe what you're interested in researching.
              Our AI searches real academic literature to suggest topics with genuine research gaps.
            </p>
          </div>
        </div>

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
                    ? 'bg-[#1e293b] text-white shadow-sm'
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
          <label className="block text-[13px] font-semibold text-slate-700 mb-2">
            Your Field or Research Interest
          </label>
          <textarea
            value={field}
            onChange={e => setField(e.target.value)}
            placeholder="Describe your field or what you're interested in researching…&#10;&#10;Examples:&#10;• Healthcare technology and how AI can help doctors make better diagnoses&#10;• Climate change impact on farming in developing countries"
            rows={5}
            className="w-full bg-white border border-slate-200 rounded-xl p-4 text-[13px] text-slate-700 placeholder-slate-400 resize-none outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all"
          />
        </div>

        {/* Chips */}
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
      </div>

      {/* ── Generated topic cards ─────────────────────────────────────────── */}
      <AnimatePresence>
        {topics.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="border-t border-slate-100 overflow-hidden"
          >
            <div className="p-6">
              <p className="text-[15px] font-bold text-slate-800 mb-0.5">Suggested Research Topics</p>
              <p className="text-[12px] text-slate-500 mb-4">
                Click on a topic to select it. You'll be able to edit it before proceeding.
              </p>

              <div className="space-y-4">
                {topics.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleSelect(t)}
                    className={cn(
                      'w-full text-left bg-white border rounded-xl p-6 cursor-pointer transition-all duration-200 relative',
                      chosen?.id === t.id
                        ? 'border-2 border-orange-500 bg-orange-50/30 shadow-sm'
                        : 'border border-slate-200 hover:bg-slate-50/50 hover:border-slate-300',
                    )}
                  >
                    <div className={cn(
                      'absolute top-4 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center',
                      chosen?.id === t.id ? 'border-orange-500 bg-orange-500' : 'border-slate-300',
                    )}>
                      {chosen?.id === t.id && <Check size={11} className="text-white" />}
                    </div>

                    <p className="text-[14px] font-bold text-slate-900 leading-snug pr-8 mb-2">
                      {t.title}
                    </p>
                    <p className="text-[12px] text-teal-700 leading-relaxed mb-3">
                      {t.description}
                    </p>

                    {t.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {t.tags.map(tag => (
                          <span key={tag} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[11px] font-medium">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

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
    </StepCard>
  )
}

// ── Step 1: Research Title ─────────────────────────────────────────────────────

function ResearchTitleStep({ project }: { project: ReturnType<typeof useResearchStore>['projects'][0] }) {
  const { updateProject, setGeneratedTitles } = useResearchStore()

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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const chosenTopic = project.selectedTopic?.title ?? project.fieldInterest

  const doGenerate = useCallback(async () => {
    if (!chosenTopic.trim()) return
    setGenerating(true)
    try {
      const results = await researchApi.generateTitles(project.id, chosenTopic, project.academicLevel)
      setTitles(results)
      setGeneratedTitles(project.id, results)
      setSelectedId(null)
      setCustomTitle('')
    } catch {
      toast.error('Failed to generate titles. Please try again.')
    } finally {
      setGenerating(false)
    }
  }, [project.id, chosenTopic, project.academicLevel])

  // Auto-generate on first load if no titles are cached yet
  useEffect(() => {
    if (existingTitles.length === 0 && chosenTopic.trim()) {
      doGenerate()
    }
  }, []) // run once on mount

  const handleSelectCard = (t: GeneratedTitle) => {
    setSelectedId(t.id)
    setCustomTitle('')
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

  return (
    <StepCard>
      <div className="p-8">
        {/* Confirmed topic read-only banner */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
            Your Research Topic
          </p>
          <p className="text-[14px] font-semibold text-slate-800 leading-snug">{chosenTopic}</p>
        </div>

        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
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

        {/* Instruction copy */}
        {!generating && titles.length > 0 && (
          <p className="text-[12px] text-slate-500 mb-4">
            Click on a title to select it as your research title. You can also edit or regenerate individual titles.
          </p>
        )}

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

        {/* Title cards */}
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

        {/* Custom title fallback */}
        {!generating && (
          <div>
            <p className="text-[13px] font-medium text-slate-600 mb-2">Or enter a custom title:</p>
            <input
              value={customTitle}
              onChange={e => handleCustomChange(e.target.value)}
              placeholder="Type your own research title…"
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 h-14 text-[13px] text-slate-800 placeholder-slate-400 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-100 transition-all"
            />
            {customTitle && (
              <p className="text-[11px] text-slate-400 mt-1.5 text-right">
                {customTitle.split(' ').filter(Boolean).length} words · auto-saving
              </p>
            )}
          </div>
        )}

        {/* Auto-save indicator */}
        {!generating && (
          <div className="flex items-center gap-1.5 mt-5">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <p className="text-[12px] text-slate-400">Progress automatically saved</p>
          </div>
        )}
      </div>
    </StepCard>
  )
}

// ── Step 2: Location ──────────────────────────────────────────────────────────

function LocationStep({ project }: { project: ReturnType<typeof useResearchStore>['projects'][0] }) {
  const { setContent } = useResearchStore()

  const enabled    = (project.sectionContent['location-enabled'] ?? 'true') !== 'false'
  const area       = project.sectionContent['location'] ?? ''
  const population = project.sectionContent['location-population'] ?? ''

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
                onChange={e => setContent(project.id, 'location', e.target.value)}
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
                onChange={e => setContent(project.id, 'location-population', e.target.value)}
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

// ── Generic Section Step ──────────────────────────────────────────────────────

function SectionStep({ project, stepId }: {
  project: ReturnType<typeof useResearchStore>['projects'][0]
  stepId:  string
}) {
  const { setContent } = useResearchStore()
  const [generating, setGenerating] = useState(false)
  const meta    = SECTION_PROMPTS[stepId]
  const content = project.sectionContent[stepId] ?? ''

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const content = await researchApi.generateWizardContent(project.id, stepId)
      setContent(project.id, stepId, content)
      toast.success(`${meta?.heading ?? stepId} generated`)
    } catch {
      toast.error('Generation failed — check the server is running.')
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
  project: ReturnType<typeof useResearchStore>['projects'][0]
  onStartWriting?: () => void
}) {
  const { setContent } = useResearchStore()
  const { documents, folders } = useLibraryStore()

  const [mode,           setMode]          = useState<LitMode>('documents')
  const [selectedFolder, setSelectedFolder] = useState<string>('all')
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set())
  const [folderOpen,     setFolderOpen]    = useState(false)

  const webVal = project.sectionContent['literature'] ?? ''

  // Docs filtered by selected folder
  const filteredDocs = selectedFolder === 'all'
    ? documents
    : documents.filter(d => d.folderId === selectedFolder)

  const selectedFolder_ = folders.find(f => f.id === selectedFolder)

  const toggleDoc = (docId: string, docTitle: string) => {
    setSelectedDocIds(prev => {
      const next = new Set(prev)
      if (next.has(docId)) {
        next.delete(docId)
        // Remove from literature content
        const lines = webVal.split('\n').filter(l => l.trim() !== `[Library] ${docTitle}`)
        setContent(project.id, 'literature', lines.join('\n'))
      } else {
        next.add(docId)
        // Append to literature content
        const entry = `[Library] ${docTitle}`
        const existing = webVal.trim()
        setContent(project.id, 'literature', existing ? `${existing}\n${entry}` : entry)
      }
      return next
    })
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
              onClick={() => setMode(m.id)}
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

function ReferencesStep({ project }: { project: ReturnType<typeof useResearchStore>['projects'][0] }) {
  const sections        = useResearchStore(s => s.sections[project.id] ?? [])
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

function FullDocumentStep({ project }: { project: ReturnType<typeof useResearchStore>['projects'][0] }) {
  const dbSections  = useResearchStore(s => s.sections[project.id] ?? [])
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

function DownloadStep({ project }: { project: ReturnType<typeof useResearchStore>['projects'][0] }) {
  const { exportDocx, syncProject } = useResearchStore()
  const dbSections  = useResearchStore(s => s.sections[project.id] ?? [])
  const [downloading, setDownloading] = useState<'docx' | 'txt' | null>(null)

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
      case 'literature': return project.sectionContent['literature'] ?? ''
      default:           return project.sectionContent[step.id] ?? ''
    }
  }

  const docSteps    = STEPS.filter(s => s.group !== 'output')
  const filledCount = docSteps.filter(s => getContent(s).trim()).length

  const handleDocx = async () => {
    setDownloading('docx')
    const toastId = toast.loading('Saving and building .docx…')
    try {
      await syncProject(project.id)
      await exportDocx(project.id)
      toast.success('Download started.', { id: toastId })
    } catch {
      toast.error('Export failed — check the server is running.', { id: toastId })
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          {/* .docx */}
          <button
            onClick={handleDocx}
            disabled={!!downloading}
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
  project:        ReturnType<typeof useResearchStore>['projects'][0]
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
}: {
  projectId: string
  section:   ProjectSection | undefined
}) {
  const {
    hypotheses: allHypotheses,
    loadHypotheses,
    generateHypotheses,
    updateHypothesis,
    generateHypothesisProse,
    isGeneratingHypotheses,
  } = useResearchStore()

  const hypotheses = allHypotheses[projectId] ?? []
  const [editing,            setEditing]           = useState<string | null>(null)
  const [editForm,           setEditForm]          = useState<Partial<UpdateHypothesisPayload>>({})
  const [isGeneratingProse,  setIsGeneratingProse] = useState(false)
  const [loadingAI,          setLoadingAI]         = useState(false)

  useEffect(() => {
    loadHypotheses(projectId).catch(() => {})
  }, [projectId])

  const handleGenerateAI = async () => {
    setLoadingAI(true)
    try {
      await generateHypotheses(projectId)
      toast.success('Hypotheses drafted — review and edit, then generate prose.')
    } catch {
      toast.error('Failed to generate hypotheses. Ensure sections 4.1 and 4.3 are complete.')
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
            onClick={handleGenerateAI}
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

// ── Sprint 3: Data Analysis Plan View ─────────────────────────────────────────

function AnalysisPlanView({ projectId }: { projectId: string }) {
  const { analysisPlan: allPlans, loadAnalysisPlan } = useResearchStore()
  const [loading, setLoading] = useState(false)
  const plans = allPlans[projectId] ?? []

  const doLoad = () => {
    setLoading(true)
    loadAnalysisPlan(projectId)
      .catch(() => toast.error('Failed to load analysis plan.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (plans.length === 0) doLoad()
  }, [projectId])

  return (
    <div className="max-w-4xl mx-auto px-6 py-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-[18px] font-bold text-slate-900">5.11 — Data Analysis Plan</h2>
          <p className="text-[12px] text-slate-500 mt-1">Auto-generated from your confirmed hypotheses.</p>
        </div>
        <button onClick={doLoad} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-[12px] font-medium transition-colors disabled:opacity-50">
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-3">
          <Loader2 size={24} className="animate-spin text-orange-400" />
          <p className="text-[13px] text-slate-600">Generating data analysis plan from hypotheses…</p>
        </div>
      ) : plans.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-xl">
          <AlertCircle size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-[13px] font-medium text-slate-600 mb-1">No analysis plan yet</p>
          <p className="text-[12px] text-slate-400">No hypotheses have been confirmed yet. Add and confirm hypotheses, then refresh.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['#', 'Objective', 'Descriptive Statistics', 'Inferential Test', 'Variables', 'Software'].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plans.map((p, i) => (
                <tr key={p.id} className={cn('border-b border-slate-100 last:border-0', i % 2 !== 0 && 'bg-slate-50/50')}>
                  <td className="px-3 py-3 text-slate-400 font-medium">{p.displayOrder}</td>
                  <td className="px-3 py-3 text-slate-700 max-w-[180px]">{p.objectiveText}</td>
                  <td className="px-3 py-3 text-slate-600 max-w-[160px]">{p.descriptiveApproach}</td>
                  <td className="px-3 py-3 text-slate-700 font-medium whitespace-nowrap">{p.inferentialTest}</td>
                  <td className="px-3 py-3 text-slate-600">{p.variablesInvolved}</td>
                  <td className="px-3 py-3 text-slate-500 whitespace-nowrap">{p.softwarePackage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Sprint 5: Thesis transition banner ───────────────────────────────────────

function ThesisTransitionBanner({
  project,
  onTransition,
  isTransitioning,
}: {
  project:        ResearchProject
  onTransition:   () => void
  isTransitioning: boolean
}) {
  return (
    <div className="mx-6 mt-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
      <GraduationCap size={18} className="text-emerald-600 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-emerald-800">All hypotheses tested — ready to transition to thesis writing.</p>
        <p className="text-[11px] text-emerald-700 mt-0.5">
          Methodology sections will be updated to past tense and chapters 6–8 will be unlocked.
        </p>
      </div>
      <button
        onClick={onTransition}
        disabled={isTransitioning}
        className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-semibold transition-colors disabled:opacity-50"
      >
        {isTransitioning
          ? <><Loader2 size={12} className="animate-spin" /> Transitioning…</>
          : <><GraduationCap size={12} /> Begin thesis writing</>}
      </button>
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

type StepStatus = 'done' | 'approved' | 'active' | 'draft' | 'generating' | 'todo' | 'locked'

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
        <span style={{ ...base, background: 'var(--color-purple-tint)' }}>
          <Check size={9} color="var(--color-purple-text)" strokeWidth={3} />
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
    case 'todo':
    default:
      return (
        <span style={{ ...base, background: 'white', border: '1.5px solid var(--border-strong)', color: 'var(--text-muted)', fontSize: 9, fontWeight: 500 }}>
          {stepNum}
        </span>
      )
  }
}

function StepBadge({ status, wordCount }: { status: 'done' | 'approved' | 'draft'; wordCount: number }) {
  const wc = wordCount > 0 ? ` · ${wordCount}w` : ''
  const base: React.CSSProperties = { fontSize: 9, padding: '1px 5px', borderRadius: 3, fontWeight: 500, whiteSpace: 'nowrap' as const }
  if (status === 'approved') return <span style={{ ...base, background: 'var(--color-purple-tint)', color: 'var(--color-purple-text)' }}>Approved{wc}</span>
  if (status === 'draft')    return <span style={{ ...base, background: 'var(--color-amber-tint)', color: 'var(--color-amber-text)' }}>Draft{wc}</span>
  return <span style={{ ...base, background: 'var(--color-green-tint)', color: 'var(--color-green-text)' }}>Done</span>
}

function StepRail({
  currentStepIdx,
  onSelectStep,
  project,
  isOpen,
  onClose,
}: {
  currentStepIdx: number
  onSelectStep:   (idx: number) => void
  project:        ResearchProject
  // Mobile drawer state — ignored by the desktop static-column rendering.
  isOpen?:        boolean
  onClose?:       () => void
}) {
  const { sections: allSections } = useResearchStore()
  const sections = allSections[project.id] ?? []

  function getStepStatus(idx: number): StepStatus {
    const step = STEPS[idx]
    if (idx === currentStepIdx) return 'active'
    if (step.type === 'wizard') return idx < currentStepIdx ? 'done' : 'todo'
    if (step.type === 'chapter') {
      const sec = sections.find(s => s.code === step.id)
      if (sec?.status === 'Approved') return 'approved'
      if (sec?.status === 'Generating') return 'generating'
      if (sec?.status === 'Draft' || sec?.status === 'Edited') return 'draft'
      return 'todo'
    }
    return 'todo'
  }

  const doneCount = STEPS.filter((_, idx) => {
    const st = getStepStatus(idx)
    return st === 'done' || st === 'approved' || st === 'draft'
  }).length
  const pct = Math.round((doneCount / STEPS.length) * 100)

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
    const isActive = status === 'active'
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
          {step.label}
        </span>
        {(status === 'done' || status === 'approved' || status === 'draft') && (
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
          Step {currentStepIdx + 1} of {STEPS.length} · {pct}% complete
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

// ── Tool Sidebar ──────────────────────────────────────────────────────────────

const TOOL_NAV: { label: string; icon: React.ElementType; link: string }[] = [
  { label: 'My Library',     icon: Library,       link: '/app/library' },
  { label: 'Web Library',    icon: Globe,         link: '/app/web-library' },
  { label: 'Doc Writer',     icon: FileText,      link: '/app/editor/new' },
  { label: 'Research Agent', icon: GraduationCap, link: '/app/research-agent/new' },
  { label: 'Voice Editor',   icon: Sparkles,      link: '/app/humaniser' },
  { label: 'AI Detector',    icon: Shield,        link: '/app/detector' },
  { label: 'Paraphraser',    icon: RefreshCw,     link: '/app/paraphrase' },
  { label: 'Grammar',        icon: SpellCheck,    link: '/app/grammar' },
  { label: 'Source Check',   icon: BookOpen,      link: '/app/plagiarism' },
  { label: 'Summariser',     icon: Scissors,      link: '/app/summarise' },
  { label: 'Data Analyst',   icon: BarChart2,     link: '/app/analyst' },
  { label: 'Document Chat',  icon: MessageSquare, link: '/app/document-chat' },
  { label: 'Citations',      icon: BookMarked,    link: '/app/citations' },
  { label: 'Flashcards',     icon: Brain,         link: '/app/flashcards' },
  { label: 'Lecture Notes',  icon: Mic,           link: '/app/lecture' },
]

function ToolSidebar() {
  const location = useLocation()
  const { user } = useAuthStore()
  const userInitials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : (user?.email?.[0]?.toUpperCase() ?? 'U')

  const isToolActive = (link: string) =>
    link === '/app/research-agent/new'
      ? location.pathname.includes('/research-agent/')
      : location.pathname === link

  return (
    <aside
      className="shrink-0 flex flex-col items-center overflow-hidden"
      style={{ width: 52, background: '#f8fafc', borderRight: '1px solid #e2e8f0' }}
    >
      {/* Logo mark */}
      <div className="w-full flex items-center justify-center py-3 shrink-0">
        <div
          className="flex items-center justify-center text-white font-semibold rounded-lg"
          style={{
            width: 32, height: 32,
            background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
            fontSize: 13,
          }}
        >
          H
        </div>
      </div>

      {/* Hairline divider */}
      <div className="shrink-0 mx-auto" style={{ width: 24, height: 0.5, background: '#e2e8f0' }} />

      {/* Tool icons */}
      <div className="flex-1 flex flex-col items-center gap-0.5 py-2 overflow-y-auto w-full px-2">
        {TOOL_NAV.map(tool => {
          const active = isToolActive(tool.link)
          return (
            <Link
              key={tool.label}
              to={tool.link}
              aria-label={tool.label}
              title={tool.label}
              className={cn(
                'flex items-center justify-center rounded-lg transition-colors',
                active
                  ? 'bg-[#ede9fe] text-[#7c3aed]'
                  : 'text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#475569]',
              )}
              style={{ width: 36, height: 36 }}
            >
              <tool.icon size={17} />
            </Link>
          )
        })}
      </div>

      {/* Settings + Avatar */}
      <div className="shrink-0 flex flex-col items-center gap-2 pb-3 pt-1">
        <Link
          to="/app/account"
          aria-label="Settings"
          title="Settings"
          className="flex items-center justify-center rounded-lg text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#475569] transition-colors"
          style={{ width: 36, height: 36 }}
        >
          <Settings size={17} />
        </Link>
        <Link
          to="/app/account"
          aria-label="Account"
          title="Account"
          className="flex items-center justify-center rounded-full text-white font-semibold"
          style={{ width: 32, height: 32, background: '#7c3aed', fontSize: 12 }}
        >
          {userInitials}
        </Link>
      </div>
    </aside>
  )
}

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
  const [, setStepParams] = useSearchParams()
  const {
    sections: allSections,
    hypotheses: allHypotheses,
    initSections,
    generateSection,
    saveSection,
    approveSection,
    regenerateSection,
    validateAlignment,
    exportDocx,
    transitionToThesis,
    isTransitioning,
    exportThesisDocx,
  } = useResearchStore()

  const rawSections: ProjectSection[]  = allSections[project.id]    ?? []
  const currentHypotheses              = allHypotheses[project.id]  ?? []

  // Deduplicate by code — a concurrent double-init can create duplicate DB rows.
  // Keep the row with the highest status / most content per code.
  const uniqueSections: ProjectSection[] = [
    ...new Map(
      [...rawSections]
        .sort((a, b) => {
          const statusOrder: Record<SectionStatus, number> =
            { NotStarted: 0, Generating: 1, Draft: 2, Edited: 3, Approved: 4 }
          const sd = statusOrder[b.status] - statusOrder[a.status]
          return sd !== 0 ? sd : b.content.length - a.content.length
        })
        .map(s => [s.code, s] as const),
    ).values(),
  ].sort((a, b) => a.order - b.order)

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
  const [isInitializingSections, setIsInitializingSections] = useState(false)
  const [showReferencesDrawer,  setShowReferencesDrawer]  = useState(false)
  const [bibliography,          setBibliography]          = useState<ParsedReference[] | null>(null)
  const [loadingBibliography,   setLoadingBibliography]   = useState(false)
  const saveTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initCalledRef = useRef(false)
  // Guards initSections against concurrent double-fire between the two effects below.
  // A ref (not isInitializingSections state) because both effects can run in the same
  // commit, before a setState from the first effect has actually applied.
  const sectionsInFlightRef = useRef(false)
  const documentSurfaceRef = useRef<DocumentSurfaceHandle>(null)

  // Compiling scans every generated section on the backend, so it's fetched lazily
  // (on first drawer open) and cached rather than run on every chapter view.
  const fetchBibliography = () => {
    setLoadingBibliography(true)
    researchApi.compileBibliography(project.id)
      .then(compiled => setBibliography(parseBibliographyEntries(compiled)))
      .catch(() => toast.error('Failed to load references. Please try again.'))
      .finally(() => setLoadingBibliography(false))
  }

  const handleOpenReferences = () => {
    setShowReferencesDrawer(true)
    if (!bibliography && !loadingBibliography) fetchBibliography()
  }

  const handleInsertCitation = (ref: ParsedReference, index: number) => {
    documentSurfaceRef.current?.insertCitationAtCursor(formatInTextCitation(ref, project.citationStyle, index))
  }

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

  const allHypothesesTested =
    currentHypotheses.length > 0 &&
    currentHypotheses.every(h => h.outcome !== 'Pending')
  const isThesisOrDissertation =
    project.documentType === 'Thesis' || project.documentType === 'Dissertation'
  const showTransitionBanner =
    !isThesisOrDissertation && allHypothesesTested

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
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    // DocumentSurface's onSave fires with its own 1s debounce; keep a 4s
    // fallback here so tab-switching without triggering onSave still saves.
    saveTimerRef.current = setTimeout(() => handleSave(val), 4000)
  }

  const handleSave = async (content = localContent) => {
    if (!activeSection || !isDirty) return
    setIsSaving(true)
    try {
      await saveSection(project.id, selectedCode, content)
      setIsDirty(false)
    } catch {
      toast.error('Save failed.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleGenerate = async (targetWordCount = 500) => {
    if (!activeSection) return
    const prompt = SECTION_PROMPTS[selectedCode]?.prompt || ''
    try {
      await generateSection(project.id, selectedCode, prompt, targetWordCount)
    } catch {
      toast.error('Generation failed — check the server is running.')
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
    const prompt = SECTION_PROMPTS[selectedCode]?.prompt || ''
    try {
      await regenerateSection(project.id, selectedCode, prompt)
    } catch {
      toast.error('Regeneration failed.')
    }
  }

  const confirmRegenerate = async () => {
    setShowRegenConfirm(false)
    const prompt = SECTION_PROMPTS[selectedCode]?.prompt || ''
    try {
      await regenerateSection(project.id, selectedCode, prompt)
    } catch {
      toast.error('Regeneration failed.')
    }
  }

  const handleApprove = async () => {
    if (isDirty) await handleSave()
    try {
      await approveSection(project.id, selectedCode)
      toast.success(`Section ${selectedCode} approved.`)
    } catch {
      toast.error('Could not approve section.')
    }
  }

  const handleValidate = async () => {
    setIsValidating(true)
    try {
      const result = await validateAlignment(project.id)
      setAlignment(result)
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
    } catch {
      toast.error('Export failed.', { id: toastId })
    } finally {
      setIsExporting(false)
    }
  }

  const isGenerating = activeSection?.status === 'Generating'
  const hasContent   = (activeSection?.content ?? '').trim().length > 0
  const wordCount    = editorContent.trim().split(/\s+/).filter(Boolean).length

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
            {alignment.message}
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

      {/* Alignment issues detail (expandable list below banner) */}
      {alignment && !alignment.isValid && alignment.issues.length > 0 && (
        <div className="shrink-0 bg-amber-50 border-b border-amber-100 px-4 pb-2">
          <div className="space-y-1">
            {alignment.issues.map((issue, i) => (
              <div key={i} className="flex gap-2 text-[11px]">
                <span className="shrink-0 font-bold text-amber-600 w-8">{issue.sectionCode}</span>
                <span className="text-amber-700">{issue.issue}</span>
                <span className="text-slate-400 shrink-0">→</span>
                <span className="text-slate-600 italic">{issue.suggestion}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Sprint 5: Thesis transition banner ───────────────────────────────── */}
      {showTransitionBanner && (
        <ThesisTransitionBanner
          project={project}
          onTransition={() =>
            transitionToThesis(project.id).catch(() =>
              toast.error('Transition failed — ensure all hypotheses are tested.'),
            )
          }
          isTransitioning={isTransitioning}
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
            ? <div className="flex-1 overflow-y-auto"><HypothesisEditor projectId={project.id} section={activeSection} /></div>
            : activeSection && (
              <>
                {/* ── Regenerate confirmation modal ───────────────────────── */}
                {showRegenConfirm && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
                      {/* Icon + header */}
                      <div className="flex flex-col items-center px-8 pt-8 pb-4 text-center">
                        <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center mb-4">
                          <RefreshCw size={22} className="text-orange-500" />
                        </div>
                        <h3 className="text-[16px] font-bold text-slate-800 mb-1">Regenerate section?</h3>
                        <p className="text-[13px] text-slate-500 leading-relaxed">
                          Your current draft of <span className="font-semibold text-slate-700">{activeSection.code}: {activeSection.title}</span> will be replaced. This cannot be undone.
                        </p>
                      </div>
                      {/* Actions */}
                      <div className="flex gap-2 px-6 pb-6 pt-2">
                        <button
                          onClick={() => setShowRegenConfirm(false)}
                          className="flex-1 py-2.5 rounded-xl border border-slate-200 text-[13px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                          Keep draft
                        </button>
                        <button
                          onClick={confirmRegenerate}
                          className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold transition-colors shadow-md shadow-orange-200 flex items-center justify-center gap-1.5"
                        >
                          <RefreshCw size={13} /> Regenerate
                        </button>
                      </div>
                    </div>
                  </div>
                )}

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
                  isSaving={isSaving}
                  hasContent={hasContent}
                  citationLabel={CITATION_LABELS[project.citationStyle]}
                  onContentChange={handleContentChange}
                  onSave={() => handleSave()}
                  onGenerate={(wc) => handleGenerate(wc)}
                  onRegenerate={handleRegenerate}
                  onApprove={handleApprove}
                />

                <ReferencesDrawer
                  open={showReferencesDrawer}
                  onClose={() => setShowReferencesDrawer(false)}
                  loading={loadingBibliography}
                  entries={bibliography ?? []}
                  citationStyle={project.citationStyle}
                  onInsert={handleInsertCitation}
                  onRefresh={fetchBibliography}
                  onManageFull={handleManageFullReferences}
                />
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

  // Derive current step from URL ?step=N, falling back to project.currentStep
  const urlStepNum = parseInt(searchParams.get('step') ?? '', 10)
  const currentStep = !isNaN(urlStepNum) && urlStepNum >= 0 && urlStepNum < STEPS.length
    ? urlStepNum
    : (project?.currentStep ?? 0)

  const stepType = STEPS[currentStep]?.type ?? 'wizard'
  const nextStep = currentStep < STEPS.length - 1 ? STEPS[currentStep + 1] : null

  const goToStep = (idx: number) => {
    if (idx < 0 || idx >= STEPS.length || !project) return
    setSearchParams({ step: String(idx) }, { replace: false })
    setStep(project.id, idx)
    syncProject(project.id).catch(console.error)
  }

  const goNext = () => goToStep(currentStep + 1)
  const goBack = () => goToStep(currentStep - 1)

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
            {STEPS[currentStep].label}
          </span>

          <div className="flex-1" />

          {/* Step counter pill */}
          <span
            className="shrink-0 text-[11px] font-medium whitespace-nowrap rounded-full px-2 py-0.5"
            style={{ background: 'var(--color-purple-tint)', color: 'var(--color-purple-text)' }}
          >
            Step {currentStep + 1} of {STEPS.length}
          </span>

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
                      <h2 className="text-[18px] font-medium" style={{ color: 'var(--text-primary)' }}>{STEPS[currentStep].label}</h2>
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
              externalCode={stepType === 'chapter' ? STEPS[currentStep].id : undefined}
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

          {/* Centre description */}
          <p className="flex-1 text-center text-[12px]" style={{ color: 'var(--text-secondary)' }}>
            {stepType === 'chapter' && nextStep
              ? (nextDisabledForChapter
                  ? `Approve this section to unlock ${nextStep.label}`
                  : `Section approved — ready for ${nextStep.label}`)
              : STEPS[currentStep].description ?? ''}
          </p>

          {/* Next */}
          <button
            onClick={goNext}
            disabled={(currentStep >= STEPS.length - 1 && nextVariant !== 'green') || nextDisabledForChapter}
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
        </div>

      </div>
    </div>
  )
}
