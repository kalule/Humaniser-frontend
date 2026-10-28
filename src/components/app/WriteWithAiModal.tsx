import { useEffect, useMemo, useRef, useState } from 'react'
import { Sparkles, Globe, FolderOpen, Layers, Loader2, X, ArrowRight, ArrowLeft, FileText, Check } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { cn, tiptapJsonToText } from '../../lib/utils'
import { useLibraryStore } from '../../store/libraryStore'
import { workbenchApi } from '../../api/workbench'
import { THESIS_CHAPTERS } from '../../lib/thesisChapters'
import { analystApi } from '../../api/analyst'
import { suggestedCitationStyle } from '../../config/disciplineCitationStyle'
import { GenerationAlreadyRunningError, GenerationInterruptedError, useWriteWithAiStream } from '../../hooks/useWriteWithAiStream'
import { clearPendingGeneration, findAnyPendingGeneration, savePendingGeneration } from '../../lib/literatureReviewRecovery'
import type { CaseStudyPlan, EssayAcademicLevel, EssayCitationStyle, EssayDiscipline, EssayPlan, EssaySubType, LiteratureReviewArchetype, ResearchPaperDisciplineProfile, WriteWithAiDocumentType, WriteWithAiRequest, WriteWithAiResponse, WriteWithAiSourceMode, ThesisChapterKind } from '../../types/workbench'
import type { AnalystJobSummary } from '../../types/analyst'
import toast from 'react-hot-toast'
import { RESEARCH_STAGE_OPTIONS, toResearchState, type ResearchStageChoice } from './researchStage'
import { essayStageLabel } from '../../lib/essayProgress'

const STAGE_LABEL: Record<string, string> = {
  drafting: 'Drafting your essay…',
  verifying: 'Verifying citations…',
  revising: 'Revising prose…',
  'auditing-claims': 'Auditing evidence claims…',
  'planning-evidence': 'Checking evidence against your question…',
  'reusing-evidence': 'Reusing your prepared sources and citations…',
  'repairing-claims': 'Aligning claims with evidence…',
  outlining: 'Designing the review outline…',
  retrieving: 'Retrieving and binding evidence…',
  screening: 'Screening sources against your question…',
}

interface WriteWithAiModalProps {
  isOpen:            boolean
  onClose:           () => void
  onGenerated:       (result: WriteWithAiResponse, citationStyle: EssayCitationStyle) => void
  onIncomplete?:    (result: WriteWithAiResponse) => void
  onFailure?:       (message: string) => void
  /** Reports whether a generation is in flight and its current stage label, so the page can show progress while this modal is hidden. */
  onBusyChange?:     (busy: boolean, label: string) => void
  excludeDocumentId?: string
  // New-document creation card (prompt #3) hand-off — DocumentEditorPage passes these when it
  // auto-opens this modal right after creating a document from a "Create with draft" prompt, so
  // the user's one remaining step is reviewing and clicking "Generate", not re-entering what they
  // already typed in the card. Ignored (and only ever read once, on the isOpen:false→true edge)
  // for every other way this modal opens.
  initialTopic?:         string
  initialDocumentType?:  WriteWithAiDocumentType
  initialThesisChapter?: ThesisChapterKind
  initialCitationStyle?: EssayCitationStyle
}

const SOURCE_OPTIONS: { mode: WriteWithAiSourceMode; label: string; sub: string; icon: React.ReactNode }[] = [
  { mode: 'Web',     label: 'Web',     sub: 'Academic literature', icon: <Globe size={18} /> },
  { mode: 'MyFiles', label: 'My Files', sub: 'Library docs',       icon: <FolderOpen size={18} /> },
  { mode: 'Hybrid',  label: 'Hybrid',  sub: 'Both sources',        icon: <Layers size={18} /> },
]

const TOPIC_QUESTION: Record<Exclude<WriteWithAiDocumentType, 'CaseStudy'>, { label: string; placeholder: string }> = {
  General: {
    label: 'What would you like to write about?',
    placeholder: "Enter your topic or title (e.g., 'The impact of artificial intelligence on healthcare')",
  },
  ThesisChapter: {
    label: 'What is your thesis about?',
    placeholder: "Enter your thesis title or research question (e.g., 'How does remote work affect junior developers\' skill growth?')",
  },
  Essay: {
    label: 'What is your essay topic or question?',
    placeholder: "Enter your essay topic, question, or paste your assignment prompt…",
  },
  ResearchPaper: {
    label: 'What is your research topic or question?',
    placeholder: "Enter your research topic or question (e.g., 'The effect of remote work on employee productivity')",
  },
  LiteratureReview: {
    label: 'What topic or research question will you review?',
    placeholder: "Enter the topic or research question this review covers…",
  },
}

const ARCHETYPE_OPTIONS: { value: LiteratureReviewArchetype; label: string; description: string }[] = [
  { value: 'Thematic',       label: 'Thematic',       description: 'Organized around recurring concepts across sources' },
  { value: 'Chronological',  label: 'Chronological',  description: 'Traces how understanding evolved over time' },
  { value: 'Methodological', label: 'Methodological', description: 'Grouped by research design/method class' },
  { value: 'Theoretical',    label: 'Theoretical',    description: 'Grouped by competing theoretical frameworks' },
]

const WORD_COUNT_PRESETS = [500, 750, 1000, 1500, 2000]
// Only case studies go past 2500: the backend plans them up to 5000. Literature reviews are held at 2500
// on purpose: a 4,500-word request produced about 2,075 words (the section plan does not scale with the
// target), so offering more would promise length the pipeline does not deliver. Revisit once it does.
const MIN_WORDS = 150
const LONG_FORM_MAX_WORDS = 5000
const STANDARD_MAX_WORDS = 2500
const LONG_FORM_PRESETS = [1000, 2000, 3000, 4000, 5000]

const DOC_TYPE_LABELS: Record<WriteWithAiDocumentType, string> = {
  General: 'General writing',
  Essay: 'Essay',
  CaseStudy: 'Case Study',
  ResearchPaper: 'Research Paper',
  LiteratureReview: 'Literature Review',
  ThesisChapter: 'Thesis Chapter',
}

const STEP1_SUBTITLE: Record<WriteWithAiDocumentType, string> = {
  General: 'Step 1 of 2 · Writing setup',
  Essay: 'Step 1 of 2 · Essay setup',
  CaseStudy: 'Step 1 of 2 · Case study setup',
  ResearchPaper: 'Step 1 of 2 · Research paper setup',
  LiteratureReview: 'Step 1 of 2 · Literature review setup',
  ThesisChapter: 'Step 1 of 2 · Thesis chapter setup',
}

export function WriteWithAiModal({
  isOpen, onClose, onGenerated, onIncomplete, onFailure, onBusyChange, excludeDocumentId,
  initialTopic, initialDocumentType, initialThesisChapter, initialCitationStyle,
}: WriteWithAiModalProps) {
  const [wizardStep, setWizardStep] = useState<1 | 2>(1)
  const [topic, setTopic] = useState('')
  const [wordCount, setWordCount] = useState(1000)
  const [lengthDraft, setLengthDraft] = useState<string | null>(null)
  const [sourceMode, setSourceMode] = useState<WriteWithAiSourceMode>('Web')
  const [documentType, setDocumentType] = useState<WriteWithAiDocumentType>('Essay')
  const [thesisChapter, setThesisChapter] = useState<ThesisChapterKind>('Introduction')
  const [essaySubType, setEssaySubType] = useState<EssaySubType>('Argumentative')
  const [academicLevel, setAcademicLevel] = useState<EssayAcademicLevel>('Undergraduate')
  const [discipline, setDiscipline] = useState<EssayDiscipline>('General')
  const [citationStyle, setCitationStyle] = useState<EssayCitationStyle>('Harvard')
  // A subject suggests its usual citation style (Vancouver for medicine, IEEE for engineering…) until the user picks one themselves.
  const styleChosenByUser = useRef(false)
  // Essays are written one section at a time by default: the student reviews each paragraph and its sources before the next.
  const [plan, setPlan] = useState<EssayPlan | null>(null)
  // Essays need a plan before drafting (the backend requires one). By default it is made and used
  // automatically; this opt-in stops on the outline screen first so the user can edit it.
  const [reviewOutline, setReviewOutline] = useState(false)
  const [assignmentText, setAssignmentText] = useState('')
  const [casePlan, setCasePlan] = useState<CaseStudyPlan | null>(null)
  const [researchProfile, setResearchProfile] = useState<ResearchPaperDisciplineProfile>('GeneralImrad')
  const [literatureReviewArchetype, setLiteratureReviewArchetype] = useState<LiteratureReviewArchetype>('Thematic')
  const [includeLiteratureReview, setIncludeLiteratureReview] = useState(false)
  const [targetJournal, setTargetJournal] = useState('')
  const [researchStage, setResearchStage] = useState<ResearchStageChoice>('PlanningOrDesigning')
  const [hasDataset, setHasDataset] = useState(false)
  const [hasParticipantData, setHasParticipantData] = useState(false)
  const [hasCompletedDataCollection, setHasCompletedDataCollection] = useState(false)
  const [hasVerifiedSampleSize, setHasVerifiedSampleSize] = useState(false)
  const [methodologyEvidence, setMethodologyEvidence] = useState('')
  const [verifiedAnalysisResults, setVerifiedAnalysisResults] = useState('')
  const [analystJobId, setAnalystJobId] = useState('')
  const [analystJobs, setAnalystJobs] = useState<AnalystJobSummary[]>([])
  const [ethicsApprovalEvidence, setEthicsApprovalEvidence] = useState('')
  const [completedActivitiesEvidence, setCompletedActivitiesEvidence] = useState('')
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [incompleteEssay, setIncompleteEssay] = useState<WriteWithAiResponse | null>(null)
  // A literature review is already being written (HTTP 409): not a failure. Names the document it will appear in when this browser knows.
  const [alreadyRunning, setAlreadyRunning] = useState<{ message: string; documentId: string | null } | null>(null)
  const { stage, generate } = useWriteWithAiStream()
  const abortControllerRef = useRef<AbortController | null>(null)
  const cancelledRef = useRef(false)

  // Changing documents unmounts this dialog. A late response belongs to the old editor,
  // so stop it instead of inserting into a destroyed instance or showing an old result.
  useEffect(() => {
    cancelledRef.current = false
    return () => {
      cancelledRef.current = true
      abortControllerRef.current?.abort()
    }
  }, [])

  const documents = useLibraryStore(s => s.documents)
  const handoffSkipped = useRef<string | null>(null)
  // Full-draft generation is the default. Section-by-section is no longer offered up front; it is only
  // switched on by the "coverage too low" recovery action below.
  const [coWrite, setCoWrite] = useState(false)

  // Pre-fill from the creation card's hand-off, read once on the false→true edge (useState's own
  // initial value only applies on first mount, and this modal is mounted once and toggled via
  // `isOpen` for the rest of the page's life, so that alone wouldn't catch a later open).
  useEffect(() => {
    if (!isOpen) return
    if (initialTopic) setTopic(initialTopic)
    if (initialDocumentType) setDocumentType(initialDocumentType)
    if (initialThesisChapter) setThesisChapter(initialThesisChapter)
    if (initialCitationStyle) setCitationStyle(initialCitationStyle)
    // Hand-off from the New document dialog: the user has already given type, topic and citation
    // style, so don't ask again. Land on the sources/outline screen with a summary and an "Edit
    // details" link back to step 1. Applied once per document. Research papers still start on
    // step 1 because their research-stage answers affect what the draft may claim.
    const handoffKey = `${excludeDocumentId ?? ''}::${initialTopic ?? ''}`
    if (initialTopic && handoffSkipped.current !== handoffKey && initialDocumentType !== 'ResearchPaper' && initialDocumentType !== 'CaseStudy'
      && (initialDocumentType !== 'ThesisChapter' || initialThesisChapter === 'LiteratureReview')) {
      handoffSkipped.current = handoffKey
      setWizardStep(2)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  useEffect(() => {
    const writesPaper = documentType === 'ResearchPaper' || (documentType === 'ThesisChapter' && thesisChapter !== 'LiteratureReview')
    if (!isOpen || !writesPaper) return
    if (researchStage !== 'ResultsAvailable') return
    analystApi.listJobsWithStatistics().then(setAnalystJobs).catch(() => setAnalystJobs([]))
  }, [isOpen, documentType, thesisChapter, researchStage])

  const candidateDocs = useMemo(() =>
    documents
      .filter(d => d.id !== excludeDocumentId && (d.content ?? '').trim())
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [documents, excludeDocumentId],
  )

  const usesMyFiles = sourceMode === 'MyFiles' || sourceMode === 'Hybrid'
  const isEssay = documentType === 'Essay'
  const isCaseStudy = documentType === 'CaseStudy'
  // A thesis chapter is written by the research-paper writer, except the literature-review chapter, which goes to the
  // grounded literature-review pipeline because that one checks every citation against the source passage.
  const isThesisChapter = documentType === 'ThesisChapter'
  const thesisUsesReviewPipeline = isThesisChapter && thesisChapter === 'LiteratureReview'
  const isResearchPaper = documentType === 'ResearchPaper' || (isThesisChapter && !thesisUsesReviewPipeline)
  const isLiteratureReview = documentType === 'LiteratureReview' || thesisUsesReviewPipeline
  const requestDocumentType: WriteWithAiDocumentType = thesisUsesReviewPipeline ? 'LiteratureReview' : documentType
  const maxWords = isCaseStudy ? LONG_FORM_MAX_WORDS : STANDARD_MAX_WORDS
  const lengthPresets = maxWords > STANDARD_MAX_WORDS ? LONG_FORM_PRESETS : WORD_COUNT_PRESETS
  const showDocPicker = usesMyFiles || isCaseStudy || isResearchPaper
  const primaryInputValid = isCaseStudy ? assignmentText.trim().length >= 20 : topic.trim().length > 0

  // Backend two-step flow (plan → draft) — separate from UI wizard steps
  const isInPlanReview = (isEssay && !!plan) || (isCaseStudy && !!casePlan)

  const loadingLabel = isCaseStudy && !casePlan
    ? 'Classifying and planning…'
    : documentType === 'Essay' && !plan
      ? 'Planning your essay…'
      : (stage && (essayStageLabel(stage) ?? STAGE_LABEL[stage])) ?? 'Generating your draft…'

  const step2Subtitle = isInPlanReview
    ? (isCaseStudy ? 'Review case plan' : 'Review outline')
    : 'Step 2 of 2 · Sources & outline'

  const headerSubtitle = wizardStep === 1 ? STEP1_SUBTITLE[documentType] : step2Subtitle

  // Switching to a type with a lower ceiling (e.g. Literature Review at 4,000 words -> Essay) pulls the length back in range.
  useEffect(() => {
    if (wordCount > maxWords) { setWordCount(maxWords); setPlan(null); setCasePlan(null) }
  }, [maxWords, wordCount])

  const handleClose = () => {
    // Closing mid-generation only hides the dialog: the request keeps running and the page shows a progress banner.
    if (loading) { onClose(); return }
    setWizardStep(1)
    onClose()
  }

  const handleCancel = () => {
    if (!loading) { handleClose(); return }
    cancelledRef.current = true
    abortControllerRef.current?.abort()
    if (excludeDocumentId) clearPendingGeneration(excludeDocumentId)
    setLoading(false)
    toast('Generation cancelled.', { icon: '✕' })
  }

  const handleInsertIncompleteDraft = () => {
    if (!incompleteEssay) return
    onGenerated(incompleteEssay, citationStyle)
    toast('Draft inserted into editor. Please review citations and question coverage notes.', { icon: '📝', duration: 7000 })
    setTopic('')
    setPlan(null)
    setAssignmentText('')
    setCasePlan(null)
    setIncompleteEssay(null)
    setWizardStep(1)
    onClose()
  }

  const handleBack = () => {
    if (isInPlanReview) {
      // Clear the plan and stay on step 2 to re-generate
      setPlan(null)
      setCasePlan(null)
      return
    }
    setWizardStep(1)
  }

  const selectedLibraryDocuments = () =>
    candidateDocs.filter(d => selectedDocumentIds.includes(d.id))
      .map(d => ({ documentId: d.id, title: d.title, content: tiptapJsonToText(d.content ?? '') }))

  const handleSubmit = async () => {
    if (!primaryInputValid || loading) return
    setGenerationError(null)
    setAlreadyRunning(null)
    cancelledRef.current = false
    setLoading(true)
    try {
      if (isCaseStudy && !casePlan) {
        const result = await workbenchApi.planCaseStudy({
          assignmentText: assignmentText.trim(), targetWordCount: wordCount, academicLevel, discipline, citationStyle,
          libraryDocuments: selectedLibraryDocuments(),
        })
        if (cancelledRef.current) return
        setCasePlan(result)
        return
      }
      let essayPlan = plan
      if (documentType === 'Essay' && !essayPlan) {
        const result = await workbenchApi.planEssay({ topic: topic.trim(), targetWordCount: wordCount, subType: essaySubType, academicLevel, discipline, citationStyle })
        if (cancelledRef.current) return
        if (reviewOutline) {
          setPlan(result)
          return
        }
        // Default: use the plan as generated and go straight on to the full draft.
        essayPlan = result
      }
      const payload: WriteWithAiRequest = {
        topic: isCaseStudy ? (casePlan?.academicTitle ?? assignmentText.trim().slice(0, 200)) : topic.trim(),
        targetWordCount: wordCount,
        sourceMode,
        documentType: requestDocumentType,
        thesisChapter: isThesisChapter && !thesisUsesReviewPipeline ? thesisChapter : undefined,
        essaySubType,
        academicLevel,
        discipline,
        citationStyle,
        approvedPlan: essayPlan ?? undefined,
        coWrite: documentType === 'Essay' && coWrite ? true : undefined,
        approvedCasePlan: isCaseStudy ? casePlan ?? undefined : undefined,
        researchPaperProfile: isResearchPaper ? researchProfile : undefined,
        literatureReviewArchetype: isLiteratureReview ? literatureReviewArchetype : undefined,
        includeSeparateLiteratureReview: isResearchPaper ? includeLiteratureReview : undefined,
        targetJournal: isResearchPaper && targetJournal.trim() ? targetJournal.trim() : undefined,
        researchState: isResearchPaper ? toResearchState(researchStage) : undefined,
        researchEvidence: isResearchPaper ? {
          hasDataset, hasParticipantData, hasCompletedDataCollection, hasVerifiedSampleSize,
          analystJobId: analystJobId || undefined,
          methodologyEvidence: methodologyEvidence.trim() || undefined,
          verifiedAnalysisResults: verifiedAnalysisResults.trim() || undefined,
          ethicsApprovalEvidence: ethicsApprovalEvidence.trim() || undefined,
          completedActivitiesEvidence: completedActivitiesEvidence.trim() || undefined,
        } : undefined,
        libraryDocuments: showDocPicker ? selectedLibraryDocuments() : undefined,
      }
      const controller = new AbortController()
      abortControllerRef.current = controller
      // A literature review keeps running on the server if this page loses the stream, so remember it for this document
      // and let the editor collect the finished review when it can (see literatureReviewRecovery).
      const result = await generate(payload, controller.signal, projectId => {
        if (excludeDocumentId && requestDocumentType === 'LiteratureReview')
          savePendingGeneration(excludeDocumentId, { projectId, startedAt: Date.now(), citationStyle })
      }, excludeDocumentId)
      abortControllerRef.current = null
      if (cancelledRef.current) return
      if (result.completionStatus === 'Incomplete' || result.essayFlags?.some(flag => flag.code === 'EssayIncomplete')) {
        setIncompleteEssay(result)
        onIncomplete?.(result)
        setGenerationError(null)
        return
      }
      setIncompleteEssay(null)
      onGenerated(result, citationStyle)
      if (excludeDocumentId) clearPendingGeneration(excludeDocumentId)
      if (result.coWrite) {
        // Section-by-section results show no review notes, so the one that says which writer was used is shown here.
        result.essayFlags?.filter(flag => flag.code === 'EssayServiceUnavailable').forEach(flag => toast(flag.message, { icon: '!', duration: 10000 }))
        // The outline is ready; the writing panel takes over from here.
        setTopic(''); setPlan(null); setAssignmentText(''); setCasePlan(null); setWizardStep(1)
        onClose()
        return
      }
      if (result.claimAudit && !result.claimAudit.auditAvailable) {
        toast(result.claimAudit.auditWarning ?? 'Essay generated, but evidence auditing is temporarily unavailable.', { icon: '!' })
      }
      if (result.caseFactAudit?.quantitativeAnalysisFlagged) {
        toast(result.caseFactAudit.quantitativeAnalysisNote ?? 'Quantitative analysis was requested but is not yet supported — the draft covers qualitative analysis only.', { icon: '!' })
      }
      result.researchPaperFlags?.forEach(flag => toast(`${flag.section}: ${flag.message}`, { icon: '!' }))
      result.caseStudyFlags?.forEach(flag => toast(`${flag.section}: ${flag.message}`, { icon: '!' }))
      result.essayFlags?.forEach(flag => toast(`${flag.section}: ${flag.message}`, { icon: '!' }))
      result.argumentativeQuality?.findings.forEach(finding =>
        toast(`Argument: ${finding.message}`, { icon: '✎', duration: 8000 }))
      if (result.argumentativeQuality && !result.argumentativeQuality.available) {
        toast(result.argumentativeQuality.warning ?? 'The argumentative-structure checks could not run for this document.', { icon: '!' })
      }
      if (isEssay && result.wordCount > 0) {
        const overBy = result.wordCount - wordCount
        const overPercent = Math.round((overBy / wordCount) * 100)
        if (overPercent > 5 || overPercent < -20) {
          toast(`Length: ${result.wordCount} words vs a ${wordCount}-word target (${overPercent > 0 ? '+' : ''}${overPercent}%).`, { icon: '📏' })
        }
      }
      setTopic('')
      setPlan(null)
      setAssignmentText('')
      setCasePlan(null)
      setWizardStep(1)
      onClose()
    } catch (error) {
      if (cancelledRef.current) return
      // Only a stream that was cut while the server job may still be running stays recoverable; a real failure is final.
      if (error instanceof GenerationAlreadyRunningError) {
        // The server's answer is authoritative; this browser's own marker is the fallback.
        const runningDocumentId = error.documentId ?? findAnyPendingGeneration()?.documentId ?? null
        if (runningDocumentId && runningDocumentId === excludeDocumentId) {
          // It is this document's own run: close the dialog and let the page's progress banner take over.
          toast('Your literature review is still being written for this document. Progress shows at the bottom of the page.', { icon: '⏳', duration: 6000 })
          setWizardStep(1)
          onClose()
        } else setAlreadyRunning({ message: error.message, documentId: runningDocumentId })
        return
      }
      if (excludeDocumentId && !(error instanceof GenerationInterruptedError)) clearPendingGeneration(excludeDocumentId)
      if (!cancelledRef.current) {
        const message = error instanceof Error ? error.message : 'AI writing failed — please try again'
        setGenerationError(message)
        onFailure?.(message)
        toast.error(message)
      }
    } finally {
      abortControllerRef.current = null
      setLoading(false)
    }
  }

  // ─── Step 1: Document type + context + topic + word count ────────────────
  const renderStep1 = () => (
    <div className="px-6 py-6 space-y-6">
      {/* Document type */}
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Document type</label>
        <div className="flex flex-wrap gap-2">
          {(['General', 'Essay', 'CaseStudy', 'ResearchPaper', 'LiteratureReview', 'ThesisChapter'] as WriteWithAiDocumentType[]).map(type => (
            <button
              key={type}
              type="button"
              onClick={() => { setDocumentType(type); setPlan(null); setCasePlan(null) }}
              className={cn(
                'rounded-lg border px-3.5 py-2 text-[13px] font-medium transition-colors',
                documentType === type
                  ? 'border-purple-accent bg-purple-tint text-purple-text'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50',
              )}
            >
              {DOC_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      {/* Essay type + academic context */}
      {isEssay && (
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Essay type</label>
            <select
              value={essaySubType}
              onChange={e => { setEssaySubType(e.target.value as EssaySubType); setPlan(null) }}
              className="w-full rounded-lg border border-slate-200 p-2.5 text-[13px] text-slate-700 bg-white"
            >
              {(['Argumentative','Expository','CompareAndContrast','CriticalEvaluation','Discussion','Reflective','LiteratureBased'] as EssaySubType[]).map(type => (
                <option key={type} value={type}>{type.replace(/([A-Z])/g, ' $1').trim().replace('Expository', 'Analytical')}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Academic level</label>
              <select value={academicLevel} onChange={e => { setAcademicLevel(e.target.value as EssayAcademicLevel); setPlan(null) }} className="w-full rounded-lg border border-slate-200 p-2.5 text-[13px] text-slate-700 bg-white">
                {(['Undergraduate','Honours','Masters','Doctoral'] as EssayAcademicLevel[]).map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Discipline</label>
              <select value={discipline} onChange={e => { const next = e.target.value as EssayDiscipline; setDiscipline(next); setPlan(null); if (!styleChosenByUser.current) setCitationStyle(suggestedCitationStyle(next) ?? citationStyle) }} className="w-full rounded-lg border border-slate-200 p-2.5 text-[13px] text-slate-700 bg-white">
                {(['General','Engineering','ComputerScience','Law','Business','Medicine','Nursing','Education','Economics','PoliticalScience','Psychology','SocialSciences','Cybersecurity','History'] as EssayDiscipline[]).map(v => (
                  <option key={v} value={v}>{v.replace(/([A-Z])/g, ' $1').trim()}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Case study context */}
      {isCaseStudy && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Academic level</label>
            <select value={academicLevel} onChange={e => { setAcademicLevel(e.target.value as EssayAcademicLevel); setCasePlan(null) }} className="w-full rounded-lg border border-slate-200 p-2.5 text-[13px] text-slate-700 bg-white">
              {(['Undergraduate','Honours','Masters','Doctoral'] as EssayAcademicLevel[]).map(v => <option key={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Discipline</label>
            <select value={discipline} onChange={e => { setDiscipline(e.target.value as EssayDiscipline); setCasePlan(null) }} className="w-full rounded-lg border border-slate-200 p-2.5 text-[13px] text-slate-700 bg-white">
              {(['General','Engineering','ComputerScience','Law','Business','Medicine','Nursing','Education','Economics','PoliticalScience','Psychology','SocialSciences','Cybersecurity','History'] as EssayDiscipline[]).map(v => (
                <option key={v} value={v}>{v.replace(/([A-Z])/g, ' $1').trim()}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Thesis chapter */}
      {isThesisChapter && (
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Chapter</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {THESIS_CHAPTERS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setThesisChapter(opt.value)}
                title={opt.description}
                className={cn('rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors', thesisChapter === opt.value ? 'border-purple-accent bg-purple-tint text-purple-text' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50')}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-[12px] text-slate-500">{THESIS_CHAPTERS.find(o => o.value === thesisChapter)?.description}</p>
        </div>
      )}

      {/* Literature review structure */}
      {isLiteratureReview && (
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Review structure</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {ARCHETYPE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setLiteratureReviewArchetype(opt.value)}
                title={opt.description}
                className={cn('rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors', literatureReviewArchetype === opt.value ? 'border-purple-accent bg-purple-tint text-purple-text' : 'border-slate-200 text-slate-600 hover:border-slate-300')}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-[12px] text-slate-500">{ARCHETYPE_OPTIONS.find(o => o.value === literatureReviewArchetype)?.description}</p>
          <p className="mt-1 text-[11px] text-slate-400">For a full multi-source research project, use Literature Review Projects from the sidebar.</p>
        </div>
      )}

      {/* Research paper settings */}
      {isResearchPaper && (
        <div className="space-y-3 rounded-xl border border-slate-200 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Discipline profile</label>
              <select value={researchProfile} onChange={e => setResearchProfile(e.target.value as ResearchPaperDisciplineProfile)} className="w-full rounded-lg border border-slate-200 p-2.5 text-[13px] text-slate-700 bg-white">
                {(['GeneralImrad','Stem','SocialScience','HumanitiesEmpirical'] as ResearchPaperDisciplineProfile[]).map(v => (
                  <option key={v} value={v}>{v === 'GeneralImrad' ? 'General IMRaD' : v === 'Stem' ? 'STEM' : v.replace(/([A-Z])/g, ' $1').trim()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Target journal</label>
              <input value={targetJournal} onChange={e => setTargetJournal(e.target.value)} maxLength={200} placeholder="Optional" className="w-full rounded-lg border border-slate-200 p-2.5 text-[13px] text-slate-700 bg-white" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-[13px] text-slate-600">
            <input type="checkbox" checked={includeLiteratureReview} onChange={e => setIncludeLiteratureReview(e.target.checked)} />
            Include a separate Literature Review section
          </label>
        </div>
      )}

      {/* Research paper evidence stage */}
      {isResearchPaper && (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/40 p-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Actual research stage</label>
            <select value={researchStage} onChange={e => setResearchStage(e.target.value as ResearchStageChoice)} className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-[13px] text-slate-700">
              {RESEARCH_STAGE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <p className="mt-1 text-[11px] text-amber-800">Choose what has actually happened — not the document title you want.</p>
          </div>
          {researchStage !== 'LiteratureReviewOnly' && (
            <>
              <div className="grid grid-cols-2 gap-2 text-[13px] text-slate-600">
                <label className="flex items-center gap-2"><input type="checkbox" checked={hasDataset} onChange={e => setHasDataset(e.target.checked)} />Dataset available</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={hasParticipantData} onChange={e => setHasParticipantData(e.target.checked)} />Participant data</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={hasCompletedDataCollection} onChange={e => setHasCompletedDataCollection(e.target.checked)} />Data collection done</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={hasVerifiedSampleSize} onChange={e => setHasVerifiedSampleSize(e.target.checked)} />Sample size verified</label>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Verified methodology or study-design evidence</label>
                <textarea value={methodologyEvidence} onChange={e => setMethodologyEvidence(e.target.value)} rows={2} placeholder="Paste only confirmed or approved design details" className="w-full rounded-lg border border-slate-200 bg-white p-2 text-[13px] text-slate-700" />
              </div>
              {researchStage === 'ResultsAvailable' && (
                <>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Link a verified Data Analyst run</label>
                    <select value={analystJobId} onChange={e => setAnalystJobId(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white p-2 text-[13px] text-slate-700">
                      <option value="">None — use pasted text below</option>
                      {analystJobs.map(j => <option key={j.jobId} value={j.jobId}>{j.datasetFileName} — {j.query.slice(0, 60)}{j.query.length > 60 ? '…' : ''} ({j.statisticCount} stat{j.statisticCount === 1 ? '' : 's'})</option>)}
                    </select>
                    {analystJobs.length === 0 && <p className="mt-1 text-[11px] text-slate-400">No completed Data Analyst runs found yet.</p>}
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Verified structured analysis output</label>
                    <textarea value={verifiedAnalysisResults} onChange={e => setVerifiedAnalysisResults(e.target.value)} rows={4} placeholder="Paste verified tests, variables, sample size, coefficients, confidence intervals…" className="w-full rounded-lg border border-slate-200 bg-white p-2 text-[13px] text-slate-700" />
                  </div>
                </>
              )}
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Ethics approval evidence (optional)</label>
                <textarea value={ethicsApprovalEvidence} onChange={e => setEthicsApprovalEvidence(e.target.value)} rows={2} placeholder="Leave blank unless approval is documented" className="w-full rounded-lg border border-slate-200 bg-white p-2 text-[13px] text-slate-700" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Other confirmed completed activities</label>
                <textarea value={completedActivitiesEvidence} onChange={e => setCompletedActivitiesEvidence(e.target.value)} rows={2} placeholder="Recruitment or data-collection activities explicitly confirmed" className="w-full rounded-lg border border-slate-200 bg-white p-2 text-[13px] text-slate-700" />
              </div>
            </>
          )}
        </div>
      )}

      {/* Topic — visual focal point */}
      <div>
        <label className="block text-[15px] font-semibold text-slate-700 mb-2">
          {isCaseStudy ? 'Assignment or case brief' : TOPIC_QUESTION[documentType as Exclude<WriteWithAiDocumentType, 'CaseStudy'>].label}
        </label>
        {isCaseStudy ? (
          <textarea
            autoFocus
            value={assignmentText}
            onChange={e => { setAssignmentText(e.target.value); setCasePlan(null) }}
            placeholder="Paste the assignment instructions and/or case brief (the organisation, situation, and question you need to address)."
            rows={5}
            className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-[14px] text-slate-800 placeholder:text-slate-400 outline-none focus:border-purple-accent focus:ring-2 focus:ring-purple-accent/20"
          />
        ) : (
          <textarea
            autoFocus
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder={TOPIC_QUESTION[documentType as Exclude<WriteWithAiDocumentType, 'CaseStudy'>].placeholder}
            rows={3}
            className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-[14px] text-slate-800 placeholder:text-slate-400 outline-none focus:border-purple-accent focus:ring-2 focus:ring-purple-accent/20"
          />
        )}
        <p className="mt-1.5 text-[12px] text-slate-400">Be specific — the more detail you give, the better the output.</p>
      </div>

      {/* Target length: slider for the range, number box for an exact figure, preset marks to snap */}
      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <label htmlFor="write-ai-length" className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Target length</label>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={MIN_WORDS}
              max={maxWords}
              step={50}
              inputMode="numeric"
              aria-label="Target length in words"
              value={lengthDraft ?? String(wordCount)}
              onChange={e => {
                setLengthDraft(e.target.value)
                const n = Number(e.target.value)
                if (n >= MIN_WORDS && n <= maxWords) { setWordCount(n); setPlan(null); setCasePlan(null) }
              }}
              onBlur={() => {
                if (lengthDraft === null) return
                setWordCount(Math.min(maxWords, Math.max(MIN_WORDS, Math.round(Number(lengthDraft)) || wordCount)))
                setPlan(null); setCasePlan(null)
                setLengthDraft(null)
              }}
              className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[13px] font-semibold text-slate-700 text-right tabular-nums outline-none focus:border-purple-accent focus:ring-2 focus:ring-purple-accent/20"
            />
            <span className="text-[12px] text-slate-400">words</span>
            <span className="text-[12px] text-slate-400">≈ {Math.max(1, Math.round(wordCount / 500))} {Math.max(1, Math.round(wordCount / 500)) === 1 ? 'page' : 'pages'}</span>
          </div>
        </div>
        <input
          id="write-ai-length"
          type="range"
          min={MIN_WORDS}
          max={maxWords}
          step={50}
          value={wordCount}
          onChange={e => { setLengthDraft(null); setWordCount(Number(e.target.value)); setPlan(null); setCasePlan(null) }}
          aria-valuetext={`${wordCount} words`}
          className="h-2 w-full cursor-pointer accent-purple-700"
        />
        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
          <span>Short</span>
          {lengthPresets.map(preset => (
            <button
              key={preset}
              type="button"
              onClick={() => { setLengthDraft(null); setWordCount(preset); setPlan(null); setCasePlan(null) }}
              className={cn('rounded px-1.5 py-0.5 tabular-nums transition-colors hover:text-purple-700', wordCount === preset && 'font-semibold text-purple-700')}
            >
              {preset.toLocaleString()}
            </button>
          ))}
          <span>Long</span>
        </div>
        {wordCount > 3000 ? <p className="mt-1.5 text-[11px] text-slate-400">Long drafts can take several minutes to research and check. You can close this window and keep working.</p> : wordCount > 1500 && <p className="mt-1.5 text-[11px] text-slate-400">Longer drafts take more time to research and check.</p>}
      </div>
    </div>
  )

  // ─── Step 2: Sources + citation style + plan review ───────────────────────
  const renderStep2 = () => (
    <div className="px-6 py-6 space-y-6">
      {!isInPlanReview && !isCaseStudy && topic.trim() && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Writing</p>
            <p className="mt-0.5 line-clamp-2 text-[13px] text-slate-700">{topic.trim()}</p>
            <p className="mt-1 text-[11px] text-slate-500">
              {DOC_TYPE_LABELS[documentType]}{isEssay ? ` · ${academicLevel}` : ''} · {wordCount.toLocaleString()} words
            </p>
          </div>
          <button type="button" onClick={() => setWizardStep(1)} className="shrink-0 text-[12px] font-medium text-purple-700 hover:text-purple-900">Edit details</button>
        </div>
      )}
      {/* Plan review — shown after plan call completes */}
      {plan && (
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 space-y-3">
          <p className="text-[13px] font-semibold text-purple-900">Outline checkpoint — review before generating</p>
          <p className="text-[12px] text-slate-600">This outline is provisional. The thesis and claims will be checked against the sources during generation.</p>
          <p className="text-[12px] text-slate-600">{plan.interpretedQuestion}</p>
          <label className="block text-[11px] font-medium text-slate-500">
            Title
            <input value={plan.academicTitle} onChange={e => setPlan({ ...plan, academicTitle: e.target.value })} className="mt-1 w-full rounded-lg border border-purple-200 p-2 text-[13px]" />
          </label>
          <label className="block text-[11px] font-medium text-slate-500">
            Proposed thesis
            <textarea value={plan.thesis} onChange={e => setPlan({ ...plan, thesis: e.target.value })} rows={3} className="mt-1 w-full rounded-lg border border-purple-200 p-2 text-[13px]" />
          </label>
          <p className="text-[11px] font-medium text-slate-500">Body plan</p>
          <div className="space-y-2">
            {plan.subType === 'Reflective'
              ? plan.reflectiveStages.map((s, i) => (
                <input key={i} value={s.stage} onChange={e => setPlan({ ...plan, reflectiveStages: plan.reflectiveStages.map((st, n) => n === i ? { ...st, stage: e.target.value } : st) })} className="w-full rounded border border-purple-200 p-2 text-[13px]" />
              ))
              : plan.subClaims.map((point, i) => (
                <input key={i} value={point.claim} onChange={e => setPlan({ ...plan, subClaims: plan.subClaims.map((s, n) => n === i ? { ...s, claim: e.target.value } : s) })} className="w-full rounded border border-purple-200 p-2 text-[13px]" />
              ))
            }
          </div>
          <p className="text-[11px] text-slate-500">
            {plan.wordAllocation.introductionWords} intro · {plan.wordAllocation.bodyWords} body · {plan.wordAllocation.conclusionWords} conclusion
          </p>
          <button type="button" onClick={() => setPlan(null)} className="text-[12px] font-medium text-purple-700 hover:text-purple-900">
            ↺ Regenerate outline
          </button>
        </div>
      )}

      {/* Case plan review */}
      {casePlan && (
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 space-y-3">
          <p className="text-[13px] font-semibold text-purple-900">Case study plan checkpoint</p>
          <p className="text-[12px] text-slate-500">Review every field before generating — this is what the draft will follow.</p>
          <label className="block text-[11px] font-medium text-slate-500">
            Case type
            <select value={casePlan.caseType} onChange={e => setCasePlan({ ...casePlan, caseType: e.target.value as CaseStudyPlan['caseType'] })} className="mt-1 w-full rounded-lg border border-purple-200 p-2 text-[13px]">
              {(['Analytical','Decision','Evaluative','Explanatory','Comparative','ResearchBased'] as CaseStudyPlan['caseType'][]).map(v => (
                <option key={v} value={v}>{v.replace(/([A-Z])/g, ' $1').trim()}</option>
              ))}
            </select>
          </label>
          <label className="block text-[11px] font-medium text-slate-500">Title<input value={casePlan.academicTitle} onChange={e => setCasePlan({ ...casePlan, academicTitle: e.target.value })} className="mt-1 w-full rounded-lg border border-purple-200 p-2 text-[13px]" /></label>
          <label className="block text-[11px] font-medium text-slate-500">Central problem<textarea value={casePlan.centralProblem} onChange={e => setCasePlan({ ...casePlan, centralProblem: e.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-purple-200 p-2 text-[13px]" /></label>
          <div>
            <p className="text-[11px] font-medium text-slate-500 mb-1">Analysis points</p>
            <div className="space-y-2">
              {casePlan.analysisSubClaims.map((point, i) => (
                <textarea key={i} value={point.claim} rows={2} onChange={e => setCasePlan({ ...casePlan, analysisSubClaims: casePlan.analysisSubClaims.map((s, n) => n === i ? { ...s, claim: e.target.value } : s) })} className="w-full rounded-lg border border-purple-200 p-2 text-[13px]" />
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 mb-1">Structure ({casePlan.structure.filter(s => s.required).length} required, {casePlan.structure.filter(s => !s.required).length} optional)</p>
            <ul className="space-y-1">
              {casePlan.structure.map(s => (
                <li key={s.sectionKey} className="flex items-center justify-between text-[12px] text-slate-600 rounded border border-purple-100 bg-white px-2 py-1">
                  <span>{s.heading}</span>
                  <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', s.required ? 'bg-purple-tint text-purple-text' : 'bg-slate-100 text-slate-500')}>
                    {s.required ? 'Required' : 'Optional'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          {casePlan.suggestedFramework && (
            <p className="text-[12px] text-slate-500">Suggested framework: <span className="font-medium text-slate-700">{casePlan.suggestedFramework}</span></p>
          )}
          {casePlan.assignmentAnalysis.requiresQuantitativeAnalysis && (
            <p className="text-[12px] rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
              This assignment appears to need financial/statistical calculation, which isn't supported yet — the draft will state this limitation.
            </p>
          )}
          <button type="button" onClick={() => setCasePlan(null)} className="text-[12px] font-medium text-purple-700 hover:text-purple-900">↺ Regenerate plan</button>
        </div>
      )}

      {/* Citation style */}
      {!isResearchPaper && (
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Citation style</label>
          <div className="flex flex-wrap gap-2">
            {(['Harvard','Apa7','Ieee','Chicago','Vancouver'] as EssayCitationStyle[]).map(v => (
              <button
                key={v}
                type="button"
                onClick={() => { styleChosenByUser.current = true; setCitationStyle(v); setPlan(null); setCasePlan(null) }}
                className={cn(
                  'rounded-lg border px-4 py-2 text-[13px] font-medium transition-colors',
                  citationStyle === v ? 'border-purple-accent bg-purple-tint text-purple-text' : 'border-slate-200 text-slate-600 hover:border-slate-300',
                )}
              >
                {v === 'Apa7' ? 'APA 7' : v === 'Ieee' ? 'IEEE' : v}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Research paper citation style */}
      {isResearchPaper && (
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Citation style</label>
          <div className="flex flex-wrap gap-2">
            {(['Harvard','Apa7','Ieee','Chicago','Vancouver'] as EssayCitationStyle[]).map(v => (
              <button
                key={v}
                type="button"
                onClick={() => { styleChosenByUser.current = true; setCitationStyle(v) }}
                className={cn('rounded-lg border px-4 py-2 text-[13px] font-medium transition-colors', citationStyle === v ? 'border-purple-accent bg-purple-tint text-purple-text' : 'border-slate-200 text-slate-600 hover:border-slate-300')}
              >
                {v === 'Apa7' ? 'APA 7' : v === 'Ieee' ? 'IEEE' : v}
              </button>
            ))}
          </div>
        </div>
      )}

      {isEssay && !plan && (
        <label className="flex items-start gap-2 text-[13px] text-slate-600">
          <input type="checkbox" checked={reviewOutline} onChange={e => setReviewOutline(e.target.checked)} className="mt-0.5 accent-purple-700" />
          <span>
            Review the outline before writing
            <span className="block text-[12px] text-slate-400">Adds a step where you can edit the thesis and body plan.</span>
          </span>
        </label>
      )}

      {/* Source mode */}
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Citation sources</label>
        <div className="grid grid-cols-3 gap-2">
          {SOURCE_OPTIONS.map(opt => (
            <button
              key={opt.mode}
              type="button"
              disabled={loading}
              onClick={() => setSourceMode(opt.mode)}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 transition-all disabled:opacity-60',
                sourceMode === opt.mode
                  ? 'border-purple-accent bg-purple-tint text-purple-text'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50',
              )}
            >
              {opt.icon}
              <span className="text-[13px] font-semibold">{opt.label}</span>
              <span className="text-[11px] opacity-80">{opt.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Doc picker */}
      {showDocPicker && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
            {isCaseStudy ? 'Case materials (optional)' : 'Library sources'}
          </p>
          {candidateDocs.length === 0
            ? <p className="text-[13px] text-slate-400">No documents in your library yet.</p>
            : <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {candidateDocs.map(doc => (
                  <label key={doc.id} className="flex items-center gap-2 text-[13px] text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedDocumentIds.includes(doc.id)}
                      onChange={() => { setSelectedDocumentIds(ids => ids.includes(doc.id) ? ids.filter(id => id !== doc.id) : [...ids, doc.id]); setCasePlan(null) }}
                    />
                    {doc.title}
                  </label>
                ))}
              </div>
          }
        </div>
      )}

      {/* Loading status */}
      {loading && (
        <div className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-3" role="status" aria-live="polite">
          <ul className="space-y-1.5">
            {stageTrail.map((label, i) => {
              const current = i === stageTrail.length - 1
              return (
                <li key={`${i}-${label}`} className={cn('flex items-center gap-2 text-[13px]', current ? 'text-purple-text font-medium' : 'text-slate-500')}>
                  {current ? <Loader2 size={14} className="animate-spin shrink-0" /> : <Check size={14} className="shrink-0 text-emerald-600" />}
                  <span className="min-w-0">{label}</span>
                  {current && <span className="ml-auto shrink-0 tabular-nums text-[12px] text-slate-400">{elapsedText}</span>}
                </li>
              )
            })}
          </ul>
          <p className="mt-2 text-[11px] text-slate-500">Sources are searched and every citation is checked before the draft is shown. You can close this window; writing continues in the editor.</p>
        </div>
      )}

      {/* Hint below CTA */}
      {!loading && !plan && !casePlan && (
        <p className="text-[12px] text-slate-400 text-center">
          {(isEssay || isCaseStudy)
            ? (isEssay && !reviewOutline
              ? 'We\'ll plan the essay and write the full draft in one go. You can edit it freely afterwards.'
              : 'We\'ll generate a structured outline for you to review before writing.')
            : 'Your document will be generated with verified academic sources.'}
        </p>
      )}
    </div>
  )

  useEffect(() => { onBusyChange?.(loading, loadingLabel) }, [loading, loadingLabel, onBusyChange])

  // Progress trail: each distinct stage the backend reports stays on screen once finished, with a
  // running clock, so a long generation shows visible movement instead of one changing line.
  const [elapsedSec, setElapsedSec] = useState(0)
  const [stageTrail, setStageTrail] = useState<string[]>([])
  useEffect(() => {
    if (!loading) { setElapsedSec(0); setStageTrail([]); return }
    const startedAt = Date.now()
    const timer = window.setInterval(() => setElapsedSec(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [loading])
  useEffect(() => {
    if (!loading) return
    setStageTrail(trail => (trail[trail.length - 1] === loadingLabel ? trail : [...trail, loadingLabel].slice(-6)))
  }, [loading, loadingLabel])
  const elapsedText = `${Math.floor(elapsedSec / 60)}:${String(elapsedSec % 60).padStart(2, '0')}`

  // ─── CTA label ────────────────────────────────────────────────────────────
  const ctaLabel = loading
    ? loadingLabel
    : isEssay && plan ? 'Generate full draft'
    : isCaseStudy && casePlan ? 'Generate case study'
    : isEssay ? (reviewOutline ? 'Generate outline' : 'Generate full draft')
    : isCaseStudy ? 'Classify & plan case'
    : 'Start Writing'

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="lg"
      panelClassName="bg-white border border-slate-100 rounded-2xl shadow-2xl"
      bodyClassName=""
      showCloseButton={false}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-purple-accent text-white flex items-center justify-center shrink-0">
            <Sparkles size={16} />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-slate-800">Start AI Writing</h2>
            <p className="text-[11px] font-medium text-purple-text leading-tight">{headerSubtitle}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          aria-label={loading ? 'Hide (generation continues)' : 'Close'}
        >
          <X size={14} />
        </button>
      </div>

      {/* Step indicator */}
      <div className="flex px-6 pt-4 gap-2">
        <div className={cn('h-1 flex-1 rounded-full transition-colors', wizardStep >= 1 ? 'bg-purple-accent' : 'bg-slate-200')} />
        <div className={cn('h-1 flex-1 rounded-full transition-colors', wizardStep >= 2 ? 'bg-purple-accent' : 'bg-slate-200')} />
      </div>

      {/* Body */}
      {alreadyRunning && (
        <div role="status" className="mx-6 my-3 rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 text-[13px] text-slate-700">
          <p className="font-semibold text-purple-900">A literature review is already running</p>
          <p className="mt-1">{alreadyRunning.message}</p>
          {alreadyRunning.documentId
            ? <button type="button" className="mt-2 font-semibold text-purple-text hover:underline" onClick={() => { window.location.assign(`/app/editor/${alreadyRunning.documentId}`) }}>Open that document</button>
            : <p className="mt-1 text-slate-500">It was started from another document or browser. Open that document to see its progress.</p>}
        </div>
      )}
      {generationError && (
        <div role="alert" className="mx-6 my-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
          <p className="font-semibold">Generation did not finish</p>
          <p className="mt-1 whitespace-pre-wrap break-words">{generationError}</p>
          <p className="mt-1">Your existing document has been kept. You can retry with the same outline.</p>
        </div>
      )}
      {incompleteEssay && (() => {
        const hasUsableDraft = Boolean(incompleteEssay.content?.trim() || incompleteEssay.sections)
        const wordCountEstimate = incompleteEssay.wordCount || (incompleteEssay.content ? incompleteEssay.content.trim().split(/\s+/).length : 0)

        return (
          <div role="alert" className="mx-6 my-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-950">
            <p className="font-semibold text-amber-900">More evidence or revision is needed</p>
            <p className="mt-1 font-medium text-slate-800">{incompleteEssay.title}</p>
            <p className="mt-1 text-slate-700">{incompleteEssay.completionReason ?? incompleteEssay.essayFlags?.find(flag => flag.code === 'EssayIncomplete')?.message}</p>
            <ul className="mt-2 list-disc pl-4 text-xs text-slate-600">
              {incompleteEssay.essayFlags?.filter(flag => flag.code === 'QuestionComponentCoverage').map(flag => (
                <li key={flag.section}><strong>{flag.section}:</strong> {flag.message}</li>
              ))}
            </ul>

            {hasUsableDraft ? (
              <div className="mt-3 rounded-lg border border-amber-300 bg-amber-100/70 p-3">
                <p className="font-semibold text-amber-950 flex items-center gap-1.5">
                  <FileText size={15} className="text-amber-800" />
                  Generated draft is available ({wordCountEstimate} words)
                </p>
                <p className="mt-1 text-xs text-amber-900 leading-relaxed">
                  The automated pipeline completed writing and citations, but flagged specific claims or reference details for review. You can insert the generated draft into the editor now and make manual edits, or retry generation.
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleInsertIncompleteDraft}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-800 hover:bg-amber-900 text-white px-3.5 py-1.5 text-xs font-semibold shadow-sm transition-colors"
                  >
                    <FileText size={14} />
                    Insert draft into editor anyway
                  </button>
                  <button
                    type="button"
                    className="text-xs font-medium text-amber-900 underline hover:text-amber-950 ml-1"
                    onClick={() => {
                      const blob = new Blob([JSON.stringify(incompleteEssay, null, 2)], { type: 'application/json' })
                      const url = URL.createObjectURL(blob)
                      const link = document.createElement('a')
                      link.href = url
                      link.download = 'unfinished-essay-and-sources.json'
                      link.click()
                      URL.revokeObjectURL(url)
                    }}
                  >
                    Download raw JSON and sources
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-amber-300 bg-amber-100/70 p-3 space-y-2">
                <p className="text-xs text-amber-900 leading-relaxed">
                  Drafting paused because online literature coverage did not reach required targets for every sub-question. Try writing section-by-section (which writes each part interactively) or attach your own papers.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setCoWrite(true)
                      setIncompleteEssay(null)
                      setWizardStep(2)
                      toast('Switched to Section-by-Section (Co-Write).', { icon: '✍️' })
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors"
                  >
                    Switch to Section-by-Section (Co-Write)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSourceMode('Hybrid')
                      setIncompleteEssay(null)
                      setWizardStep(2)
                      toast('Switched to Hybrid sources. You can select documents from My Files.', { icon: '📂' })
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400 bg-white hover:bg-amber-50 text-amber-950 px-3 py-1.5 text-xs font-medium shadow-sm transition-colors"
                  >
                    Attach My Files (Hybrid)
                  </button>
                  <button
                    type="button"
                    className="text-xs font-medium text-amber-900 underline hover:text-amber-950 ml-auto"
                    onClick={() => {
                      const blob = new Blob([JSON.stringify(incompleteEssay, null, 2)], { type: 'application/json' })
                      const url = URL.createObjectURL(blob)
                      const link = document.createElement('a')
                      link.href = url
                      link.download = 'unfinished-essay-and-sources.json'
                      link.click()
                      URL.revokeObjectURL(url)
                    }}
                  >
                    Download research JSON
                  </button>
                </div>
              </div>
            )}

            {!!incompleteEssay.questionCoverage?.gapReport?.length && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <caption className="mb-2 text-left font-semibold">Evidence coverage — three direct sources per part is a retrieval target</caption>
                  <thead><tr><th className="p-2">Sub-question</th><th className="p-2">Period</th><th className="p-2">Direct sources</th><th className="p-2">Status</th></tr></thead>
                  <tbody>{incompleteEssay.questionCoverage.gapReport.map(row => (
                    <tr key={row.componentId} className="border-t border-amber-200">
                      <td className="p-2">{row.subQuestion}</td><td className="p-2">{row.period}</td>
                      <td className="p-2">{row.directSourceCount}<details><summary>Sources and periods</summary>{row.sourcePeriods.map(period => <p key={period}>{period}</p>)}</details></td>
                      <td className="p-2">{row.status}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        )
      })()}
      <div className="overflow-y-auto max-h-[60vh]">
        {wizardStep === 1 ? renderStep1() : renderStep2()}
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 z-10 flex items-center justify-between gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50">
        {wizardStep === 1 ? (
          <>
            <button
              type="button"
              onClick={handleCancel}
              className="px-5 py-2 rounded-lg text-[13px] font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setWizardStep(2)}
              disabled={!primaryInputValid}
              className={cn(
                'flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-colors shadow-md',
                primaryInputValid
                  ? 'bg-purple-accent hover:bg-purple-deep shadow-violet-200'
                  : 'bg-purple-accent/40 cursor-not-allowed shadow-none',
              )}
            >
              Continue
              <ArrowRight size={14} />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={loading ? handleCancel : handleBack}
              disabled={false}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-[13px] font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-60"
            >
              {loading ? <X size={14} /> : <ArrowLeft size={14} />}
              {loading ? 'Cancel generation' : isInPlanReview ? 'Change options' : 'Back'}
            </button>
            {loading && (
              <span className="hidden sm:inline-block text-[11px] text-slate-400 max-w-[220px] text-center leading-tight">
                Search and verification: {elapsedText} so far
              </span>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!primaryInputValid || loading}
              aria-busy={loading}
              className={cn(
                'flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-colors shadow-md',
                loading
                  ? 'bg-purple-accent cursor-wait shadow-violet-200'
                  : primaryInputValid
                    ? 'bg-purple-accent hover:bg-purple-deep shadow-violet-200'
                    : 'bg-purple-accent/40 cursor-not-allowed shadow-none',
              )}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {ctaLabel}
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}
