import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { ArrowRight, Check, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { researchApi } from '../../api/research'
import { useResearchStore } from '../../store/researchStore'
import { cn } from '../../lib/utils'
import type { ApiError } from '../../types'
import type {
  ConfirmMethodologyClassificationPayload,
  EthicsChecklist,
  EthicsDataCollectionMethod,
} from '../../types/research'

// Loading-UX threshold (Ethics section load delay fix, Fix 2) — matches this codebase's own
// established "taking longer than usual" convention (ResearchAgentPage/DocumentSurface/
// AutonomousProposalTools all use the same wording), but NOT its 3-minute timer: that threshold
// is sized for AI-generation-scale work. This is a database read, not a generation job — a
// reported real-world load of "over a minute" is already far outside a normal query's expected
// range, so the threshold here is seconds, not minutes, or the message would never appear in time
// to be useful for the problem it's meant to explain.
const SLOW_LOAD_MS = 5_000

const METHODS: EthicsDataCollectionMethod[] = [
  'Interview', 'Survey', 'FocusGroup', 'Experiment', 'Observation', 'SecondaryData', 'Other',
]

const DOCUMENT_LABELS: Record<string, string> = {
  ParticipantInformationSheet: 'Participant information sheet',
  ConsentForm: 'Consent form',
  EthicsApplication: 'Ethics application',
  PrivacyDataManagementPlan: 'Privacy and data management plan',
  RiskAssessment: 'Risk assessment',
  ConfidentialityStatement: 'Confidentiality statement',
}

type EditableClassification = ConfirmMethodologyClassificationPayload

function editable(checklist: EthicsChecklist): EditableClassification | null {
  const c = checklist.classification
  return c ? {
    dataCollectionMethods: c.dataCollectionMethods,
    involvesVulnerablePopulation: c.involvesVulnerablePopulation,
    participantsIdentifiable: c.participantsIdentifiable,
    involvesSensitiveTopics: c.involvesSensitiveTopics,
  } : null
}

export function EthicsManager({ projectId, onOpenWriting }: {
  projectId: string
  onOpenWriting: (sectionCode?: string) => void
}) {
  // Ethics checklist cache (Fix 3) — researchStore.ethicsChecklist is the single source of truth,
  // shared across mount/unmount so navigating away and back re-renders instantly from the cached
  // entry with no spinner, instead of always refetching. See invalidateEthicsChecklistIfRelevant
  // in researchStore.ts for the full, explicit list of mutations that clear this project's entry.
  const checklist          = useResearchStore(s => s.ethicsChecklist[projectId])
  const loadEthicsChecklist = useResearchStore(s => s.loadEthicsChecklist)
  const setEthicsChecklist  = useResearchStore(s => s.setEthicsChecklist)

  const [form, setForm] = useState<EditableClassification | null>(() => checklist ? editable(checklist) : null)
  const [loading, setLoading] = useState(!checklist)
  const [busy, setBusy] = useState<string | null>(null)

  // Loading-UX stall detection (Fix 2) — see SLOW_LOAD_MS above for the threshold rationale.
  const [isSlow, setIsSlow] = useState(false)
  const loadingSinceRef = useRef<number | null>(null)

  const applyChecklist = (next: EthicsChecklist) => {
    setEthicsChecklist(projectId, next)
    setForm(editable(next))
  }

  useEffect(() => {
    // Cache hit: an invalidation-untouched entry already exists for this project — render it
    // immediately, no fetch, no spinner. This is the actual fix for "every time you leave and
    // reopen Ethics, its data is discarded and fetched again."
    const cached = useResearchStore.getState().ethicsChecklist[projectId]
    if (cached) {
      setForm(editable(cached))
      setLoading(false)
      return
    }
    setLoading(true)
    loadEthicsChecklist(projectId)
      .then(() => setForm(editable(useResearchStore.getState().ethicsChecklist[projectId]!)))
      .catch((error: ApiError) => toast.error(error?.message ?? 'Could not load the ethics checklist.'))
      .finally(() => setLoading(false))
  }, [projectId])

  useEffect(() => {
    if (!loading) {
      loadingSinceRef.current = null
      setIsSlow(false)
      return
    }
    loadingSinceRef.current = Date.now()
    setIsSlow(false)
    const interval = setInterval(() => {
      setIsSlow(!!loadingSinceRef.current && Date.now() - loadingSinceRef.current > SLOW_LOAD_MS)
    }, 1000)
    return () => clearInterval(interval)
  }, [loading])

  const propose = async () => {
    setBusy('classify')
    try {
      const classification = await researchApi.proposeEthicsClassification(projectId)
      applyChecklist({ classification, documents: checklist?.documents ?? [] })
      toast.success('AI proposal ready. Review it before confirming.')
    } catch (error) {
      toast.error((error as ApiError)?.message ?? 'Could not classify this methodology.')
    } finally { setBusy(null) }
  }

  const confirm = async () => {
    if (!form?.dataCollectionMethods.length) {
      toast.error('Select at least one data-collection method.')
      return
    }
    setBusy('confirm')
    try {
      applyChecklist(await researchApi.confirmEthicsClassification(projectId, form))
      toast.success('Methodology confirmed and ethics requirements updated.')
    } catch (error) {
      toast.error((error as ApiError)?.message ?? 'Could not confirm the classification.')
    } finally { setBusy(null) }
  }

  const draft = async (documentType: string) => {
    setBusy(`draft:${documentType}`)
    try {
      const document = await researchApi.draftEthicsDocument(projectId, documentType)
      const current = useResearchStore.getState().ethicsChecklist[projectId]
      if (current) setEthicsChecklist(projectId, {
        ...current,
        documents: current.documents.map(item => item.documentType === documentType ? document : item),
      })
      toast.success(`${DOCUMENT_LABELS[documentType] ?? documentType} drafted for review.`)
    } catch (error) {
      toast.error((error as ApiError)?.message ?? 'Could not draft this document.')
    } finally { setBusy(null) }
  }

  const updateStatus = async (documentType: string, status: 'Drafted' | 'UnderReview' | 'Approved') => {
    setBusy(`status:${documentType}`)
    try {
      const document = await researchApi.updateEthicsDocumentStatus(projectId, documentType, status)
      const current = useResearchStore.getState().ethicsChecklist[projectId]
      if (current) setEthicsChecklist(projectId, {
        ...current,
        documents: current.documents.map(item => item.documentType === documentType ? document : item),
      })
      toast.success('Document status updated.')
    } catch (error) {
      toast.error((error as ApiError)?.message ?? 'Could not update this document.')
    } finally { setBusy(null) }
  }

  if (loading) return <div className="flex flex-col items-center gap-3 py-16">
    <Loader2 className="animate-spin text-violet-600" />
    {isSlow && <p className="text-[12px] text-amber-600">
      This is taking longer than usual. It should recover automatically within a few minutes — no need to leave this page.
    </p>}
  </div>

  const classification = checklist?.classification
  const confirmed = !!classification?.isConfirmedByStudent && !classification.isStale

  return <div className="space-y-4">
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Methodology ethics classification</h3>
          <p className="mt-1 text-xs text-slate-500">AI proposes a classification from Sections 5.3, 5.4, 5.8 and 5.11. Review it before confirming.</p>
        </div>
        {classification && <span className={cn(
          'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium',
          confirmed ? 'bg-green-tint text-green-text' : 'bg-amber-tint text-amber-text',
        )}>{confirmed ? 'Confirmed' : classification.isStale ? 'Needs review' : 'Proposed'}</span>}
      </div>

      {!form ? <button disabled={busy !== null} onClick={() => void propose()} className="mt-4 flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
        {busy === 'classify' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Classify methodology
      </button> : <div className="mt-4 space-y-4">
        {classification?.isStale && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">The methodology sections changed after classification. Reclassify and confirm the current details.</div>}
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-700">Data-collection methods</p>
          <div className="flex flex-wrap gap-2">{METHODS.map(method => <label key={method} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700">
            <input type="checkbox" checked={form.dataCollectionMethods.includes(method)} onChange={() => setForm(current => current && ({
              ...current,
              dataCollectionMethods: current.dataCollectionMethods.includes(method)
                ? current.dataCollectionMethods.filter(item => item !== method)
                : [...current.dataCollectionMethods, method],
            }))} />
            {method.replace(/([a-z])([A-Z])/g, '$1 $2')}
          </label>)}</div>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">{([
          ['involvesVulnerablePopulation', 'Vulnerable population'],
          ['participantsIdentifiable', 'Participants identifiable'],
          ['involvesSensitiveTopics', 'Sensitive topics'],
        ] as const).map(([key, label]) => <label key={key} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 p-3 text-xs text-slate-700">
          <input type="checkbox" checked={form[key]} onChange={event => setForm(current => current && ({ ...current, [key]: event.target.checked }))} /> {label}
        </label>)}</div>
        <div className="flex flex-wrap gap-2">
          <button disabled={busy !== null} onClick={() => void confirm()} className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
            {busy === 'confirm' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Confirm classification
          </button>
          <button disabled={busy !== null} onClick={() => void propose()} className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 disabled:opacity-50"><RefreshCw size={13} /> Reclassify from sections</button>
          <button onClick={() => onOpenWriting('5.11')} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-violet-600">Review Section 5.11 <ArrowRight size={12} /></button>
        </div>
      </div>}
    </section>

    {confirmed && <section className="space-y-2">
      <div><h3 className="text-sm font-semibold text-slate-800">Ethics document checklist</h3><p className="text-xs text-slate-500">AI drafts are starting points. Mark Approved only after real institutional approval.</p></div>
      {checklist?.documents.map(document => {
        const inactive = document.status === 'NotApplicable'
        return <article key={document.documentType} className={cn('rounded-xl border p-4', inactive ? 'border-slate-100 bg-slate-50 opacity-70' : 'border-slate-200 bg-white')}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-sm font-medium text-slate-800">{DOCUMENT_LABELS[document.documentType] ?? document.documentType}</p>{document.isStale && <p className="mt-1 text-[11px] text-amber-700">Draft is stale because the methodology changed.</p>}</div>
            <div className="flex items-center gap-2">
              {!inactive && <button disabled={busy !== null} onClick={() => void draft(document.documentType)} className="rounded-lg border border-violet-200 px-3 py-1.5 text-[11px] font-medium text-violet-700 disabled:opacity-50">{busy === `draft:${document.documentType}` ? 'Drafting…' : document.content ? 'Regenerate draft' : 'Draft with AI'}</button>}
              {!inactive && document.status !== 'Required' ? <select disabled={busy !== null} value={document.status} onChange={event => void updateStatus(document.documentType, event.target.value as 'Drafted' | 'UnderReview' | 'Approved')} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px]"><option value="Drafted">Drafted</option><option value="UnderReview">Under review</option><option value="Approved">Approved</option></select> : <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-medium', inactive ? 'bg-slate-200 text-slate-500' : 'bg-amber-tint text-amber-text')}>{document.status.replace(/([a-z])([A-Z])/g, '$1 $2')}</span>}
            </div>
          </div>
          {document.content && <details className="mt-3"><summary className="cursor-pointer text-xs font-medium text-violet-600">Review draft</summary><pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-4 font-sans text-xs leading-relaxed text-slate-700">{document.content}</pre></details>}
        </article>
      })}
    </section>}
  </div>
}
