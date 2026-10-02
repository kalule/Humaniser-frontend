import { useEffect, useMemo, useRef, useState } from 'react'
import { Sparkles, Globe, FolderOpen, Layers, Loader2, X, ArrowRight, ArrowLeft } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { cn, tiptapJsonToText } from '../../lib/utils'
import { useLibraryStore } from '../../store/libraryStore'
import { workbenchApi } from '../../api/workbench'
import { analystApi } from '../../api/analyst'
import { useWriteWithAiStream } from '../../hooks/useWriteWithAiStream'
import type { CaseStudyPlan, EssayAcademicLevel, EssayCitationStyle, EssayDiscipline, EssayPlan, EssaySubType, LiteratureReviewArchetype, ResearchPaperDisciplineProfile, WriteWithAiDocumentType, WriteWithAiRequest, WriteWithAiResponse, WriteWithAiSourceMode } from '../../types/workbench'
import type { AnalystJobSummary } from '../../types/analyst'
import toast from 'react-hot-toast'
import { RESEARCH_STAGE_OPTIONS, toResearchState, type ResearchStageChoice } from './researchStage'

const STAGE_LABEL: Record<string, string> = {
  drafting: 'Drafting your essay…',
  verifying: 'Verifying citations…',
  revising: 'Revising…',
}

STAGE_LABEL['auditing-claims'] = 'Auditing evidence claims...'
STAGE_LABEL['outlining'] = 'Designing the review outline…'
STAGE_LABEL['retrieving'] = 'Retrieving and binding evidence…'

interface WriteWithAiModalProps {
  isOpen:            boolean
  onClose:           () => void
  onGenerated:       (result: WriteWithAiResponse, citationStyle: EssayCitationStyle) => void
  excludeDocumentId?: string
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

const DOC_TYPE_LABELS: Record<WriteWithAiDocumentType, string> = {
  General: 'General writing',
  Essay: 'Essay',
  CaseStudy: 'Case Study',
  ResearchPaper: 'Research Paper',
  LiteratureReview: 'Literature Review',
}

const STEP1_SUBTITLE: Record<WriteWithAiDocumentType, string> = {
  General: 'Step 1 of 2 · Writing setup',
  Essay: 'Step 1 of 2 · Essay setup',
  CaseStudy: 'Step 1 of 2 · Case study setup',
  ResearchPaper: 'Step 1 of 2 · Research paper setup',
  LiteratureReview: 'Step 1 of 2 · Literature review setup',
}

export function WriteWithAiModal({ isOpen, onClose, onGenerated, excludeDocumentId }: WriteWithAiModalProps) {
  const [wizardStep, setWizardStep] = useState<1 | 2>(1)
  const [topic, setTopic] = useState('')
  const [wordCount, setWordCount] = useState(1000)
  const [sourceMode, setSourceMode] = useState<WriteWithAiSourceMode>('Web')
  const [documentType, setDocumentType] = useState<WriteWithAiDocumentType>('Essay')
  const [essaySubType, setEssaySubType] = useState<EssaySubType>('Argumentative')
  const [academicLevel, setAcademicLevel] = useState<EssayAcademicLevel>('Undergraduate')
  const [discipline, setDiscipline] = useState<EssayDiscipline>('General')
  const [citationStyle, setCitationStyle] = useState<EssayCitationStyle>('Harvard')
  const [plan, setPlan] = useState<EssayPlan | null>(null)
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
  const { stage, generate } = useWriteWithAiStream()
  const abortControllerRef = useRef<AbortController | null>(null)
  const cancelledRef = useRef(false)

  const documents = useLibraryStore(s => s.documents)

  useEffect(() => {
    if (!isOpen || documentType !== 'ResearchPaper') return
    if (researchStage !== 'ResultsAvailable') return
    analystApi.listJobsWithStatistics().then(setAnalystJobs).catch(() => setAnalystJobs([]))
  }, [isOpen, documentType, researchStage])

  const candidateDocs = useMemo(() =>
    documents
      .filter(d => d.id !== excludeDocumentId && (d.content ?? '').trim())
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [documents, excludeDocumentId],
  )

  const usesMyFiles = sourceMode === 'MyFiles' || sourceMode === 'Hybrid'
  const isEssay = documentType === 'Essay'
  const isCaseStudy = documentType === 'CaseStudy'
  const isResearchPaper = documentType === 'ResearchPaper'
  const isLiteratureReview = documentType === 'LiteratureReview'
  const showDocPicker = usesMyFiles || isCaseStudy || isResearchPaper
  const primaryInputValid = isCaseStudy ? assignmentText.trim().length >= 20 : topic.trim().length > 0

  // Backend two-step flow (plan → draft) — separate from UI wizard steps
  const isInPlanReview = (isEssay && !!plan) || (isCaseStudy && !!casePlan)

  const loadingLabel = isCaseStudy && !casePlan
    ? 'Classifying and planning…'
    : documentType === 'Essay' && !plan
      ? 'Planning your essay…'
      : (stage && STAGE_LABEL[stage]) ?? 'Generating your draft…'

  const step2Subtitle = isInPlanReview
    ? (isCaseStudy ? 'Step 2 of 2 · Review case plan' : 'Step 2 of 2 · Review outline')
    : 'Step 2 of 2 · Sources & outline'

  const headerSubtitle = wizardStep === 1 ? STEP1_SUBTITLE[documentType] : step2Subtitle

  const handleClose = () => {
    if (loading) return
    setWizardStep(1)
    onClose()
  }

  const handleCancel = () => {
    if (!loading) { handleClose(); return }
    cancelledRef.current = true
    abortControllerRef.current?.abort()
    setLoading(false)
    toast('Generation cancelled.', { icon: '✕' })
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
      if (documentType === 'Essay' && !plan) {
        const result = await workbenchApi.planEssay({ topic: topic.trim(), targetWordCount: wordCount, subType: essaySubType, academicLevel, discipline, citationStyle })
        if (cancelledRef.current) return
        setPlan(result)
        return
      }
      const payload: WriteWithAiRequest = {
        topic: isCaseStudy ? (casePlan?.academicTitle ?? assignmentText.trim().slice(0, 200)) : topic.trim(),
        targetWordCount: wordCount,
        sourceMode,
        documentType,
        essaySubType,
        academicLevel,
        discipline,
        citationStyle,
        approvedPlan: plan ?? undefined,
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
      const result = await generate(payload, controller.signal)
      abortControllerRef.current = null
      if (cancelledRef.current) return
      onGenerated(result, citationStyle)
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
      if (!cancelledRef.current) {
        toast.error(error instanceof Error ? error.message : 'AI writing failed — please try again')
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
          {(['General', 'Essay', 'CaseStudy', 'ResearchPaper', 'LiteratureReview'] as WriteWithAiDocumentType[]).map(type => (
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
              <select value={discipline} onChange={e => { setDiscipline(e.target.value as EssayDiscipline); setPlan(null) }} className="w-full rounded-lg border border-slate-200 p-2.5 text-[13px] text-slate-700 bg-white">
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

      {/* Word count presets */}
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Target length</label>
        <div className="flex items-center gap-2">
          {WORD_COUNT_PRESETS.map(preset => (
            <button
              key={preset}
              type="button"
              onClick={() => { setWordCount(preset); setPlan(null) }}
              className={cn(
                'flex-1 rounded-lg border py-2 text-[13px] font-medium transition-colors',
                wordCount === preset
                  ? 'border-purple-accent bg-purple-tint text-purple-text'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50',
              )}
            >
              {preset.toLocaleString()}
            </button>
          ))}
          <div className="flex items-center gap-1 ml-1">
            <input
              type="number"
              min={150}
              max={2500}
              step={50}
              value={wordCount}
              onChange={e => { setWordCount(Math.min(2500, Math.max(150, Number(e.target.value) || 1000))); setPlan(null) }}
              className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-2 text-[13px] text-slate-700 text-right outline-none focus:border-purple-accent focus:ring-2 focus:ring-purple-accent/20"
            />
            <span className="text-[12px] text-slate-400 shrink-0">words</span>
          </div>
        </div>
      </div>
    </div>
  )

  // ─── Step 2: Sources + citation style + plan review ───────────────────────
  const renderStep2 = () => (
    <div className="px-6 py-6 space-y-6">
      {/* Plan review — shown after plan call completes */}
      {plan && (
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 space-y-3">
          <p className="text-[13px] font-semibold text-purple-900">Outline checkpoint — review before generating</p>
          <p className="text-[12px] text-slate-600">{plan.interpretedQuestion}</p>
          <label className="block text-[11px] font-medium text-slate-500">
            Title
            <input value={plan.academicTitle} onChange={e => setPlan({ ...plan, academicTitle: e.target.value })} className="mt-1 w-full rounded-lg border border-purple-200 p-2 text-[13px]" />
          </label>
          <label className="block text-[11px] font-medium text-slate-500">
            Thesis
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
                onClick={() => { setCitationStyle(v); setPlan(null); setCasePlan(null) }}
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
                onClick={() => setCitationStyle(v)}
                className={cn('rounded-lg border px-4 py-2 text-[13px] font-medium transition-colors', citationStyle === v ? 'border-purple-accent bg-purple-tint text-purple-text' : 'border-slate-200 text-slate-600 hover:border-slate-300')}
              >
                {v === 'Apa7' ? 'APA 7' : v === 'Ieee' ? 'IEEE' : v}
              </button>
            ))}
          </div>
        </div>
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
        <div className="flex items-center gap-2 text-[13px] text-purple-text" role="status" aria-live="polite">
          <Loader2 size={14} className="animate-spin shrink-0" />
          <span>{loadingLabel}</span>
          <span className="ml-auto h-1 w-24 overflow-hidden rounded-full bg-purple-tint">
            <span className="block h-full w-1/3 animate-pulse bg-purple-accent" />
          </span>
        </div>
      )}

      {/* Hint below CTA */}
      {!loading && !plan && !casePlan && (
        <p className="text-[12px] text-slate-400 text-center">
          {(isEssay || isCaseStudy)
            ? 'We\'ll generate a structured outline for you to review before writing.'
            : 'Your document will be generated with verified academic sources.'}
        </p>
      )}
    </div>
  )

  // ─── CTA label ────────────────────────────────────────────────────────────
  const ctaLabel = loading
    ? loadingLabel
    : isEssay && plan ? 'Generate essay'
    : isCaseStudy && casePlan ? 'Generate case study'
    : isEssay ? 'Generate outline'
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
          disabled={loading}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-60"
          aria-label="Close"
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
              onClick={handleBack}
              disabled={loading}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-[13px] font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-60"
            >
              <ArrowLeft size={14} />
              {isInPlanReview ? 'Edit outline' : 'Back'}
            </button>
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
