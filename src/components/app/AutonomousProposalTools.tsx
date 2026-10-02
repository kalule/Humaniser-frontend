import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  Search, X, Loader2, ArrowLeft, ArrowRight,
  Globe, FolderOpen, ArrowLeftRight, Check, ExternalLink, BookText,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useResearchStore } from '../../store/researchStore'
import { useAuthStore } from '../../store/authStore'
import { useUiStore } from '../../store/uiStore'
import { CREDIT_COSTS } from '../../config/creditCosts'
import { findSimilarPapers, MIN_QUERY_LENGTH, type LiteratureCitation } from '../../api/semanticScholar'
import { CHAPTER_STEPS, SECTION_PROMPTS } from '../../data/proposalOutline'
import type { AcademicLevel, CitationStyle, DocumentMode, GeneratorMode, GenerationPhase } from '../../types/research'

// ── Autonomous Proposal + Similar Papers Finder ─────────────────────────────
// Hoisted out of the old "AI Thesis" page (now Thesis Studio, which no longer
// owns proposal creation) so Proposal Studio — the actual home for creating
// Proposal documents — can offer the one-shot autonomous generator and the
// Semantic Scholar lookup as creation-time options, verbatim.

export type SourceType = 'documents' | 'web' | 'hybrid'

export interface ProposalConfig {
  title:            string
  fieldInterest:    string
  academicLevel:    AcademicLevel
  sourceType:       SourceType
  citationStyle:    CitationStyle
  locationEnabled:  boolean
  geographicalArea: string
  studyPopulation:  string
  targetWords:      number
}

// The tool always produces a PROPOSAL document via the AGENT (autonomous)
// generator, so those two ResearchProject fields are fixed rather than
// exposed as a choice here.
const PROPOSAL_DOCUMENT_MODE: DocumentMode  = 'PROPOSAL'
const PROPOSAL_GENERATOR_MODE: GeneratorMode = 'AGENT'

// Real chapter count from the shared outline (1.0 through 6.3) — not derived
// from word count, since the proposal template always has this many chapters
// regardless of length.
const PROPOSAL_SECTION_COUNT = CHAPTER_STEPS.length
const WORDS_PER_PAGE = 250
const MINUTES_PER_WORD = 1 / 500

function labelForSectionCode(code: string | null): string {
  if (!code) return ''
  return CHAPTER_STEPS.find(s => s.sectionKey === code)?.label ?? code
}

type ModalTab = 'basic' | 'sources' | 'location' | 'options'
const MODAL_TABS: { key: ModalTab; label: string }[] = [
  { key: 'basic',    label: 'Basic Info' },
  { key: 'sources',  label: 'Sources' },
  { key: 'location', label: 'Location' },
  { key: 'options',  label: 'Options' },
]

const LEVEL_OPTIONS: { value: AcademicLevel; label: string; hint: string }[] = [
  { value: 'UNDERGRADUATE', label: "Undergraduate", hint: "Bachelor's level" },
  { value: 'MASTERS',       label: "Master's",      hint: 'Graduate level' },
  { value: 'PHD',           label: 'PhD',            hint: 'Doctoral level' },
]

const SOURCE_TYPE_OPTIONS: { value: SourceType; label: string; hint: string; icon: React.ElementType }[] = [
  { value: 'web',       label: 'Online Sources', hint: 'Search academic databases',   icon: Globe },
  { value: 'documents', label: 'My Documents',   hint: 'Use your uploaded library',   icon: FolderOpen },
  { value: 'hybrid',    label: 'Hybrid',         hint: 'Best of both sources',        icon: ArrowLeftRight },
]

const CITATION_SELECT_OPTIONS: { value: CitationStyle; label: string }[] = [
  { value: 'apa7',    label: 'APA 7th Edition — American Psychological Association' },
  { value: 'harvard', label: 'Harvard — Cite Them Right' },
  { value: 'mla',     label: 'MLA 9th Edition — Modern Language Association' },
  { value: 'ieee',    label: 'IEEE — Institute of Electrical and Electronics Engineers' },
]

export function AutonomousProposalModal({ onClose, onCreate }: {
  onClose:  () => void
  onCreate: (config: ProposalConfig) => void
}) {
  const [tab,              setTab]              = useState<ModalTab>('basic')
  const [title,            setTitle]            = useState('')
  const [fieldInterest,    setFieldInterest]    = useState('')
  const [academicLevel,    setAcademicLevel]    = useState<AcademicLevel>('MASTERS')
  const [sourceType,       setSourceType]       = useState<SourceType>('hybrid')
  const [citationStyle,    setCitationStyle]    = useState<CitationStyle>('apa7')
  const [locationEnabled,  setLocationEnabled]  = useState(true)
  const [geographicalArea, setGeographicalArea] = useState('')
  const [studyPopulation,  setStudyPopulation]  = useState('')
  const [targetWords,      setTargetWords]      = useState(8000)
  const [lengthUnit,       setLengthUnit]       = useState<'words' | 'pages'>('words')
  const [loading,          setLoading]          = useState(false)

  const tabIndex   = MODAL_TABS.findIndex(t => t.key === tab)
  const isLastTab  = tabIndex === MODAL_TABS.length - 1
  const canProceed = title.trim().length > 0

  const goNext = () => {
    if (!canProceed) return
    if (isLastTab) {
      handleCreate()
      return
    }
    setTab(MODAL_TABS[tabIndex + 1].key)
  }
  const goPrevious = () => {
    if (tabIndex === 0) return
    setTab(MODAL_TABS[tabIndex - 1].key)
  }

  const handleCreate = async () => {
    if (!canProceed) return
    setLoading(true)
    await new Promise(r => setTimeout(r, 400))
    onCreate({
      title:            title.trim(),
      fieldInterest:    fieldInterest.trim(),
      academicLevel,
      sourceType,
      citationStyle,
      locationEnabled,
      geographicalArea: geographicalArea.trim(),
      studyPopulation:  studyPopulation.trim(),
      targetWords,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="relative bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg p-6"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors">
          <X size={16} />
        </button>

        <div className="mb-5">
          <h3 className="text-[17px] font-bold text-slate-900">Autonomous Proposal</h3>
          <p className="text-[13px] text-slate-500 mt-1">Configure your research proposal settings</p>
        </div>

        {/* Tab pills */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 mb-5">
          {MODAL_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex-1 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all',
                tab === t.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="min-h-[240px]">
          {tab === 'basic' && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-[12px] font-semibold text-slate-700 mb-1.5 block">Research Title *</label>
                <input
                  autoFocus
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g., Impact of AI on Healthcare Delivery in Rural Areas"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-[14px] text-slate-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition placeholder-slate-400"
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-slate-700 mb-1.5 block">Topic / Keywords (Optional)</label>
                <input
                  value={fieldInterest}
                  onChange={e => setFieldInterest(e.target.value)}
                  placeholder="e.g., healthcare, artificial intelligence, rural medicine"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-[14px] text-slate-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition placeholder-slate-400"
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-slate-700 mb-1.5 block">Academic Level</label>
                <div className="grid grid-cols-3 gap-2">
                  {LEVEL_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setAcademicLevel(opt.value)}
                      className={cn(
                        'text-left rounded-xl border px-3 py-2.5 transition-colors',
                        academicLevel === opt.value
                          ? 'border-[#7c3aed] ring-1 ring-[#7c3aed]'
                          : 'border-slate-200 hover:border-slate-300',
                      )}
                    >
                      <p className="text-[12px] font-semibold text-slate-800">{opt.label}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{opt.hint}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'sources' && (
            <div className="flex flex-col gap-5">
              <div>
                <label className="text-[12px] font-semibold text-slate-700 mb-1.5 block">Source Type</label>
                <div className="flex flex-col gap-2">
                  {SOURCE_TYPE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setSourceType(opt.value)}
                      className={cn(
                        'flex items-center gap-3 text-left rounded-xl border px-3.5 py-3 transition-colors',
                        sourceType === opt.value
                          ? 'border-[#7c3aed] ring-1 ring-[#7c3aed]'
                          : 'border-slate-200 hover:border-slate-300',
                      )}
                    >
                      <span className="w-9 h-9 shrink-0 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 flex items-center justify-center">
                        <opt.icon size={16} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-slate-800">{opt.label}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{opt.hint}</p>
                      </span>
                      {sourceType === opt.value && (
                        <span className="w-5 h-5 shrink-0 rounded-full bg-[#7c3aed] text-white flex items-center justify-center">
                          <Check size={12} />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[12px] font-semibold text-slate-700 mb-1.5 block">Citation Style</label>
                <select
                  value={citationStyle}
                  onChange={e => setCitationStyle(e.target.value as CitationStyle)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-[13px] text-slate-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition bg-white"
                >
                  {CITATION_SELECT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {tab === 'location' && (
            <div className="flex flex-col gap-4">
              <button
                onClick={() => setLocationEnabled(v => !v)}
                className="w-full flex items-center justify-between gap-4 text-left rounded-xl border border-slate-200 px-3.5 py-3"
              >
                <span>
                  <p className="text-[13px] font-semibold text-slate-800">Location Context</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Include specific geographical area and study population</p>
                </span>
                <span className={cn(
                  'relative w-9 h-5 shrink-0 rounded-full transition-colors',
                  locationEnabled ? 'bg-[#7c3aed]' : 'bg-slate-200',
                )}>
                  <span className={cn(
                    'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                    locationEnabled && 'translate-x-4',
                  )} />
                </span>
              </button>

              {locationEnabled && (
                <>
                  <div>
                    <label className="text-[12px] font-semibold text-slate-700 mb-1.5 block">Geographical Area</label>
                    <input
                      value={geographicalArea}
                      onChange={e => setGeographicalArea(e.target.value)}
                      placeholder="e.g., Mulago Hospital, Kampala, Uganda"
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-[14px] text-slate-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition placeholder-slate-400"
                    />
                  </div>
                  <div>
                    <label className="text-[12px] font-semibold text-slate-700 mb-1.5 block">Study Population</label>
                    <input
                      value={studyPopulation}
                      onChange={e => setStudyPopulation(e.target.value)}
                      placeholder="e.g., Healthcare workers, Patients aged 18-65"
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-[14px] text-slate-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition placeholder-slate-400"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {tab === 'options' && (
            <div className="flex flex-col gap-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[12px] font-semibold text-slate-700">Document Length</label>
                  <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                    {(['words', 'pages'] as const).map(u => (
                      <button
                        key={u}
                        onClick={() => setLengthUnit(u)}
                        className={cn(
                          'px-3 py-1 rounded-md text-[11px] font-medium capitalize transition-all',
                          lengthUnit === u ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700',
                        )}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={1000}
                    max={20000}
                    step={250}
                    value={targetWords}
                    onChange={e => setTargetWords(Number(e.target.value))}
                    className="flex-1 accent-[#7c3aed]"
                  />
                  <div className="shrink-0 px-3 py-1.5 rounded-lg border border-slate-200 text-[13px] font-semibold text-slate-800">
                    {lengthUnit === 'words'
                      ? `${targetWords.toLocaleString()} words`
                      : `${Math.round(targetWords / WORDS_PER_PAGE)} pages`}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[11px] text-slate-400">~1,000 words</span>
                  <span className="text-[11px] text-slate-400">~20,000 words</span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[12px] font-semibold text-slate-700 mb-3">📊 Estimated Generation</p>
                <div className="grid grid-cols-2 gap-y-2 text-[12px]">
                  <p className="text-slate-500">Words: <span className="font-semibold text-slate-800">{targetWords.toLocaleString()}</span></p>
                  <p className="text-slate-500">Pages: <span className="font-semibold text-slate-800">~{Math.round(targetWords / WORDS_PER_PAGE)}</span></p>
                  <p className="text-slate-500">Sections: <span className="font-semibold text-slate-800">{PROPOSAL_SECTION_COUNT}</span></p>
                  <p className="text-slate-500">Est. Time: <span className="font-semibold text-slate-800">~{Math.round(targetWords * MINUTES_PER_WORD)} min</span></p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-between pt-5 mt-1 border-t border-slate-100">
          <button
            onClick={goPrevious}
            disabled={tabIndex === 0}
            className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-0"
          >
            <ArrowLeft size={14} /> Previous
          </button>
          <button
            onClick={goNext}
            disabled={loading || !canProceed}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#7c3aed] hover:bg-[#4c1d95] text-white text-[13px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
            {isLastTab ? 'Generate Proposal' : 'Next'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Similar Papers Finder ───────────────────────────────────────────────────
// Real Semantic Scholar integration, proxied through HumaniseAI's own
// backend (POST /api/v1/workbench/validate-literature — see
// src/api/semanticScholar.ts) rather than called directly from the browser.

function PaperResultCard({ paper }: { paper: LiteratureCitation }) {
  const [expanded, setExpanded] = useState(false)
  const authorLine = paper.authors.slice(0, 6).join(', ') + (paper.authors.length > 6 ? ', et al.' : '')

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="text-[14px] font-semibold text-slate-800 leading-snug">{paper.title}</p>
      <p className="text-[12px] text-slate-600 mt-1">
        {authorLine}{paper.year ? ` (${paper.year})` : ''}
      </p>
      {paper.journal && <p className="text-[12px] text-slate-500 italic mt-0.5">{paper.journal}</p>}

      {paper.abstract && (
        <div className="mt-2">
          <p className={cn('text-[12px] text-slate-600 leading-relaxed', !expanded && 'line-clamp-2')}>
            {paper.abstract}
          </p>
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-[12px] font-medium text-[#7c3aed] hover:text-[#4c1d95] transition-colors mt-1"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        </div>
      )}

      <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-slate-100">
        {paper.doi && <span className="text-[11px] text-slate-400">DOI: {paper.doi}</span>}
        {paper.citationCount !== null && (
          <span className="text-[11px] text-slate-400">{paper.citationCount.toLocaleString()} citations</span>
        )}
        {paper.url && (
          <a
            href={paper.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[12px] font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ExternalLink size={12} /> View source
          </a>
        )}
      </div>
    </div>
  )
}

export function SimilarPapersModal({ onClose }: { onClose: () => void }) {
  const [query,   setQuery]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [results, setResults] = useState<LiteratureCitation[] | null>(null)

  const handleSearch = async () => {
    if (query.trim().length < MIN_QUERY_LENGTH || loading) return
    setLoading(true)
    setError(null)
    try {
      const papers = await findSimilarPapers(query)
      setResults(papers)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed — please try again.')
      setResults(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="relative bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
      >
        <div className="flex items-start justify-between gap-4 p-6 pb-0">
          <div>
            <h3 className="text-[17px] font-bold text-slate-900">Similar Papers Finder</h3>
            <p className="text-[13px] text-slate-500 mt-1">Find related research using Semantic Scholar</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors shrink-0">
            <X size={16} />
          </button>
        </div>

        <div className="p-6">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
                placeholder="Search by title, topic, DOI, or paste a citation"
                className="w-full border border-slate-200 rounded-xl pl-4 pr-9 py-2.5 text-[14px] text-slate-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition placeholder-slate-400"
              />
              {query && (
                <button
                  onClick={() => { setQuery(''); setResults(null); setError(null) }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              onClick={handleSearch}
              disabled={loading || query.trim().length < MIN_QUERY_LENGTH}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-[13px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Find Similar
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">
            Example: "Malaria in Pregnancy" or "10.4084/MJHID.2013.010" or full citation text
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-2">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-[12px] text-red-600 mb-4">
              {error}
            </div>
          )}
          {!error && results !== null && results.length === 0 && (
            <p className="text-[13px] text-slate-500 text-center py-8">No related papers found — try a different search.</p>
          )}
          <div className="flex flex-col gap-3">
            {results?.map(paper => <PaperResultCard key={paper.paperId} paper={paper} />)}
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 shrink-0">
          <p className="text-[11px] text-slate-400">
            Powered by <span className="font-semibold text-slate-500">Semantic Scholar</span>
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Autonomous generation panel ─────────────────────────────────────────────
// Shown inline on the page (not a modal) while the Agent mode generator works
// through all PROPOSAL_SECTION_COUNT chapters unattended. Unlike a client-side
// loop, this reflects a job running server-side (ProposalGenerationJob) — the
// panel just polls GET .../generation-status, so it shows real progress even
// after a refresh, and Cancel/Close request a real server-side stop rather
// than abandoning an in-browser loop.

export interface GenerationState {
  projectId:    string
  title:        string
  phase:        GenerationPhase
  index:        number
  currentLabel: string
  words:        number
  failedCount:  number
  articleView:  boolean
  stalled:      boolean
}

export function GenerationPanel({ gen, onToggleArticleView, onCancel, onClose, onOpenDocument }: {
  gen:                 GenerationState
  onToggleArticleView: () => void
  onCancel:            () => void
  onClose:             () => void
  onOpenDocument:      () => void
}) {
  const sections = useResearchStore(s => s.sections[gen.projectId]) ?? []
  const isActive = gen.phase === 'Starting' || gen.phase === 'Generating'

  const statusText: Record<GenerationPhase, string> = {
    NotStarted: 'Not started',
    Starting:   'Starting generation…',
    Generating: `Writing ${gen.currentLabel}…`,
    Completed:  'Proposal generated!',
    Cancelled:  `Cancelled after ${gen.index} of ${PROPOSAL_SECTION_COUNT} sections`,
    Error:      'The agent could not continue after automatic retries. Your completed sections are safe.',
  }

  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden mb-8 shadow-sm">
      <div className="flex items-center justify-between gap-4 px-5 py-4 bg-slate-800">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-white truncate">
            {gen.phase === 'Completed' ? 'Proposal Generated' : gen.phase === 'Cancelled' ? 'Generation Cancelled' : 'Generating Proposal…'}
          </p>
          <p className="text-[12px] text-slate-300 mt-0.5">
            {gen.currentLabel || 'Preparing sections'} · Section {gen.index}/{PROPOSAL_SECTION_COUNT} · {gen.words.toLocaleString()} words
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onToggleArticleView}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-600 text-[12px] font-medium text-slate-200 hover:bg-slate-700 transition-colors"
          >
            <BookText size={13} /> Article View
          </button>
          {isActive && (
            <button
              onClick={onCancel}
              className="px-3.5 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-[12px] font-semibold transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-[12px] font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      <div className="bg-white">
        {gen.articleView ? (
          <div className="max-h-[420px] overflow-y-auto p-6 flex flex-col gap-5">
            {CHAPTER_STEPS.map(step => {
              const sec = sections.find(s => s.code === step.sectionKey)
              if (!sec?.content) return null
              return (
                <div key={step.id}>
                  <p className="text-[13px] font-bold text-slate-800 mb-1.5">
                    {SECTION_PROMPTS[step.sectionKey ?? '']?.heading ?? step.label}
                  </p>
                  <p className="text-[13px] text-slate-600 leading-relaxed whitespace-pre-wrap">{sec.content}</p>
                </div>
              )
            })}
            {sections.every(s => !s.content) && (
              <p className="text-[13px] text-slate-400 text-center py-10">Sections will appear here as they're written.</p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            {isActive && <Loader2 size={26} className="animate-spin text-[#7c3aed]" />}
            {gen.phase === 'Completed' && <Check size={26} className="text-emerald-500" />}
            <p className="text-[13px] font-medium text-slate-700">{statusText[gen.phase]}</p>
            {gen.phase === 'Starting' && <p className="text-[12px] text-slate-400">Preparing sections…</p>}
            {gen.phase === 'Starting' && gen.index > 0 && (
              <p className="text-[12px] text-violet-600">The agent is continuing automatically from your saved progress.</p>
            )}
            {isActive && gen.stalled && (
              <p className="text-[12px] text-amber-600 max-w-xs text-center">
                This is taking longer than usual. It should recover automatically within a
                few minutes — no need to leave this page.
              </p>
            )}
            {gen.failedCount > 0 && (gen.phase === 'Completed' || gen.phase === 'Cancelled') && (
              <p className="text-[12px] text-amber-600">
                {gen.failedCount} section{gen.failedCount === 1 ? '' : 's'} failed and can be retried from the document editor.
              </p>
            )}
            {(gen.phase === 'Completed' || gen.phase === 'Cancelled' || gen.phase === 'Error') && (
              <button
                onClick={onOpenDocument}
                className="mt-2 px-5 py-2 rounded-xl bg-[#7c3aed] hover:bg-[#4c1d95] text-white text-[13px] font-semibold transition-colors"
              >
                Open Document
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Shared flow hook ─────────────────────────────────────────────────────────
// Wraps state/effects for the Autonomous Proposal creation + progress-polling
// flow, so a consuming page (Proposal Studio) just needs to render the modal/
// panel components above wired to the values returned here.

// The backend's ProposalGenerationJob has no notion of "the user has seen and
// dismissed this outcome" — Error/Cancelled jobs sit at completedCount <
// totalCount forever, even after the student finishes the rest of the
// document by hand in the editor. Without this, the reattach effect below
// would keep resurrecting the same stale banner on every remount (nav away
// and back, refresh, etc.) since nothing server-side ever changes. Keyed on
// the exact status+count signature so a job that later actually resumes
// progress (new count) still surfaces normally.
const DISMISSED_STORAGE_KEY = 'humaniser:dismissedProposalGenerations'

function generationSignature(status: { status: string; completedCount: number }): string {
  return `${status.status}|${status.completedCount}`
}

function readDismissedSignature(projectId: string): string | null {
  try {
    const raw = window.localStorage.getItem(DISMISSED_STORAGE_KEY)
    if (!raw) return null
    return (JSON.parse(raw) as Record<string, string>)[projectId] ?? null
  } catch {
    return null
  }
}

function writeDismissedSignature(projectId: string, signature: string) {
  try {
    const raw = window.localStorage.getItem(DISMISSED_STORAGE_KEY)
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {}
    map[projectId] = signature
    window.localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Best-effort — worst case the banner can resurface once more.
  }
}

export function useAutonomousProposalFlow() {
  const navigate      = useNavigate()
  const researchStore = useResearchStore()
  const user          = useAuthStore((s) => s.user)

  const [showCreateModal, setShowCreateModal]   = useState(false)
  const [showSimilarModal, setShowSimilarModal] = useState(false)
  const [gen, setGen] = useState<GenerationState | null>(null)

  // Tracks the last time completedCount/currentSection/wordsWritten actually changed, so the
  // poll below can tell "still working" apart from "the job died mid-chapter and nothing will
  // ever move again" (e.g. the server process restarted while awaiting Claude). Ref, not state —
  // it's bookkeeping the poll uses to derive `gen.stalled`, not something that itself renders.
  const progressRef = useRef<{ projectId: string; key: string; since: number } | null>(null)

  useEffect(() => {
    // Reattach to an already-running generation on mount — e.g. the tab was
    // refreshed, or the user navigated away and back. Generation itself is a
    // Hangfire job (ProposalGenerationJob) driven entirely server-side, so it
    // kept running the whole time; only the panel needs to catch back up.
    // Agent-mode proposals are the only ones that ever have a generation job
    // running, so filtering on generatorMode is the real discriminator (this
    // tool only ever starts one run at a time — see isGenerating below — so
    // the most-recently-touched Agent-mode proposal is the only candidate).
    researchStore.loadProjects().then(() => {
      const candidate = [...researchStore.projects]
        .filter(p => p.generatorMode === 'AGENT' && p.documentMode === 'PROPOSAL')
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]
      if (!candidate) return
      return researchStore.getGenerationStatus(candidate.id).then(status => {
        const active = status.status === 'Starting' || status.status === 'Generating'
        const incompleteTerminal = status.completedCount < status.totalCount
          && (status.status === 'Error' || status.status === 'Cancelled' || status.status === 'Completed')
        const dismissed = incompleteTerminal && readDismissedSignature(candidate.id) === generationSignature(status)
        if (active || (incompleteTerminal && !dismissed)) {
          progressRef.current = {
            projectId: candidate.id,
            key:       `${status.completedCount}|${status.currentSection}|${status.wordsWritten}`,
            since:     Date.now(),
          }
          setGen({
            projectId:    candidate.id,
            title:        candidate.title,
            phase:        status.status,
            index:        status.completedCount,
            currentLabel: labelForSectionCode(status.currentSection),
            words:        status.wordsWritten,
            failedCount:  status.failedCount,
            articleView:  false,
            stalled:      false,
          })
        }
      })
    }).catch(() => {})
  }, [])

  // Polls GET .../generation-status while a run is in flight — the job is a
  // Hangfire job (ProposalGenerationJob), not a loop in this component, so
  // this is the only way the UI learns about progress. Keyed on projectId
  // only (not phase) so a terminal status doesn't retrigger the effect —
  // poll() decides for itself, from the freshest response, whether to
  // schedule another round.
  useEffect(() => {
    if (!gen) return
    const projectId = gen.projectId
    let cancelled = false
    let timer: number | null = null
    let consecutiveFailures = 0

    // Stuck-job threshold — well under the backend's own stale-generation reconciliation
    // window (5 min sweep interval, 10 min staleness — see
    // HangfireJobs.ReconcileStaleProposalGenerationsAsync), so the panel tells the student
    // sooner that something looks wrong instead of leaving them staring at a silent spinner
    // for up to 15 minutes before the server itself gives up on a dead job.
    const STALL_MS = 3 * 60_000

    const poll = async () => {
      try {
        const status = await researchStore.getGenerationStatus(projectId)
        if (cancelled) return
        consecutiveFailures = 0

        const key = `${status.completedCount}|${status.currentSection}|${status.wordsWritten}`
        const now = Date.now()
        if (!progressRef.current || progressRef.current.projectId !== projectId || progressRef.current.key !== key) {
          progressRef.current = { projectId, key, since: now }
        }
        const stalled =
          (status.status === 'Starting' || status.status === 'Generating') &&
          now - progressRef.current.since > STALL_MS

        setGen(g => (g && g.projectId === projectId) ? {
          ...g,
          phase:        status.status,
          index:        status.completedCount,
          currentLabel: labelForSectionCode(status.currentSection),
          words:        status.wordsWritten,
          failedCount:  status.failedCount,
          stalled,
        } : g)

        if (status.status === 'Starting' || status.status === 'Generating') {
          timer = window.setTimeout(poll, 2500)
        } else {
          researchStore.loadProjects().catch(() => {})
        }
      } catch {
        consecutiveFailures++
        if (!cancelled && consecutiveFailures < 3) {
          timer = window.setTimeout(poll, 5000)
        } else if (!cancelled) {
          // Stop an unhealthy endpoint from being polled forever. A page refresh or a new
          // generation action can reattach after the backend has recovered.
          setGen(g => (g && g.projectId === projectId) ? { ...g, phase: 'Error', stalled: true } : g)
        }
      }
    }

    poll()
    return () => { cancelled = true; if (timer) window.clearTimeout(timer) }
  }, [gen?.projectId])

  // A generation in flight is tracked by one `gen` state slot — starting a
  // second one while the first is running would reassign `gen` to the new
  // project and lose the UI's only pointer to the first (still running
  // server-side, since it's a real background job, but with no panel left
  // watching it). Block re-entry instead of losing track of it.
  const isGenerating = gen !== null && (gen.phase === 'Starting' || gen.phase === 'Generating')

  const handleCreate = async (config: ProposalConfig) => {
    if (user && user.plan !== 'Unlimited' && user.creditsLimit - user.creditsUsed < CREDIT_COSTS.proposalSectionGeneration) {
      useUiStore.getState().openCreditLimitModal({
        used: user.creditsUsed,
        limit: user.creditsLimit,
        resetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
      })
      return
    }

    const project = await researchStore.createProject({
      generatorMode: PROPOSAL_GENERATOR_MODE,
      documentMode:  PROPOSAL_DOCUMENT_MODE,
      title:         config.title,
    })
    researchStore.updateProject(project.id, {
      fieldInterest: config.fieldInterest,
      academicLevel: config.academicLevel,
      citationStyle: config.citationStyle,
    })

    // These all reuse the exact sectionContent keys ResearchAgentPage's own
    // steps already read/write (LiteratureStep's `mode`, LocationStep's
    // location-* fields, and per-section generation's word-count default) —
    // so the modal's choices genuinely land in the workspace instead of
    // being asked for twice or silently discarded.
    const perSectionWords = Math.max(150, Math.round(config.targetWords / PROPOSAL_SECTION_COUNT))
    researchStore.setContent(project.id, 'sourceTypePreference', config.sourceType)
    researchStore.setContent(project.id, 'location-enabled', config.locationEnabled ? 'true' : 'false')
    researchStore.setContent(project.id, 'location', config.geographicalArea)
    researchStore.setContent(project.id, 'location-population', config.studyPopulation)
    researchStore.setContent(project.id, 'targetSectionWordCount', String(perSectionWords))

    setShowCreateModal(false)
    progressRef.current = { projectId: project.id, key: '0||0', since: Date.now() }
    setGen({ projectId: project.id, title: config.title, phase: 'Starting', index: 0, currentLabel: '', words: 0, failedCount: 0, articleView: false, stalled: false })

    try {
      // Local mutations above (updateProject/setContent) only touch client
      // state — the backend job only knows the fieldInterest/academicLevel/
      // citationStyle/sectionContent set here once syncProject actually
      // pushes them, so this must happen before starting the job.
      await researchStore.syncProject(project.id)
      // Enqueues ProposalGenerationJob server-side (Hangfire) and returns
      // immediately — the polling effect above picks up progress from here.
      // Runs independently of this page: closing the tab, navigating away, or
      // refreshing no longer stops generation.
      await researchStore.generateAutonomous(project.id, perSectionWords)
    } catch {
      setGen(g => (g && g.projectId === project.id) ? { ...g, phase: 'Error' } : g)
      toast.error('Could not start autonomous generation — check the server is running.')
    }
  }

  const openCreateModal = () => {
    if (isGenerating) {
      toast.error('A proposal is already generating — cancel or wait for it to finish first.')
      return
    }
    setShowCreateModal(true)
  }

  const onToggleArticleView = () => setGen(g => g ? { ...g, articleView: !g.articleView } : g)
  const onCancelGeneration  = () => { if (gen) researchStore.cancelGeneration(gen.projectId).catch(() => {}) }
  const onCloseGeneration   = () => {
    if (!gen) return
    const projectId = gen.projectId
    researchStore.cancelGeneration(projectId)
      .then(status => writeDismissedSignature(projectId, generationSignature(status)))
      // The job was already terminal (Error/Cancelled/Completed) — cancelGeneration
      // rejects in that case, but the shown gen.phase is still the right signature
      // to dismiss so this exact outcome doesn't resurrect on next mount.
      .catch(() => writeDismissedSignature(projectId, generationSignature({ status: gen.phase, completedCount: gen.index })))
    setGen(null)
  }
  const onOpenGeneratedDocument = () => { if (gen) navigate(`/app/research-agent/${gen.projectId}`) }

  return {
    gen,
    showCreateModal, setShowCreateModal, openCreateModal,
    showSimilarModal, setShowSimilarModal,
    isGenerating,
    handleCreate,
    onToggleArticleView,
    onCancelGeneration,
    onCloseGeneration,
    onOpenGeneratedDocument,
  }
}
