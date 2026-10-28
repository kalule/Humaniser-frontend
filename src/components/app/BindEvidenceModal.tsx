import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { Modal } from '../ui/Modal'
import { deepResearchApi, type BindingSuggestion } from '../../api/deepResearch'
import { apiErrorMessage } from '../../lib/deepResearch'
import { proposalWorkflowApi } from '../../api/proposalWorkflow'
import type { EvidenceBinding, SectionContract } from '../../types/proposalWorkflow'

/**
 * Turns a Deep Research source into an evidence binding in Proposal Studio. The passage and its exact offset
 * come from the server and cannot be edited here; the student chooses the section, writes the claim, and
 * submits. Nothing is recorded until they press the button.
 */
export function BindEvidenceModal({ open, onClose, projectId, sessionId, sourceId, title }: {
  open: boolean
  onClose: () => void
  projectId: string
  sessionId: string
  sourceId: string
  title: string
}) {
  const [suggestion, setSuggestion] = useState<BindingSuggestion | null>(null)
  const [sections, setSections] = useState<SectionContract[]>([])
  const [noSpec, setNoSpec] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sectionCode, setSectionCode] = useState('')
  const [claim, setClaim] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ status: string; message: string } | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true); setResult(null); setSuggestion(null); setNoSpec(false)
    Promise.all([deepResearchApi.bindingSuggestion(sessionId, sourceId), proposalWorkflowApi.state(projectId).catch(() => null)])
      .then(([s, state]) => {
        if (cancelled) return
        setSuggestion(s)
        setClaim(s.suggestedClaim ?? '')
        const evidenceSections = (state?.contracts ?? []).filter(c => c.requiresEvidence).sort((a, b) => a.order - b.order)
        setSections(evidenceSections)
        setNoSpec(!state?.accepted)
        setSectionCode(evidenceSections[0]?.code ?? '')
      })
      .catch(() => { if (!cancelled) toast.error('Could not prepare this source.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, projectId, sessionId, sourceId])

  const canSubmit = !!suggestion?.canBind && !!sectionCode && claim.trim().length > 0 && !busy && !result

  const submit = async () => {
    if (!suggestion?.canBind || !suggestion.literatureId || !suggestion.coverage || !suggestion.quote || !suggestion.purpose) return
    setBusy(true)
    try {
      const r = await proposalWorkflowApi.evidence(projectId, {
        sectionCode, claim: claim.trim(), literatureId: suggestion.literatureId, coverage: suggestion.coverage,
        start: suggestion.start, length: suggestion.length, quote: suggestion.quote, purpose: suggestion.purpose,
      })
      const bound = r as EvidenceBinding
      setResult({ status: bound.status, message: bound.message })
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not check this evidence.'))
    } finally { setBusy(false) }
  }

  return (
    <Modal isOpen={open} onClose={onClose} title="Use as evidence in your proposal" size="lg">
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-slate-400" /></div>
      ) : !suggestion?.canBind ? (
        <p className="text-[13px] text-slate-600">{suggestion?.reason ?? 'This source cannot be used as evidence yet.'}</p>
      ) : noSpec ? (
        <p className="text-[13px] text-slate-600">Accept your research specification in Proposal Studio first, then come back to use this source.</p>
      ) : (
        <div className="space-y-4">
          <p className="text-[12px] text-slate-500">{title}</p>
          <div>
            <p className="text-[12px] text-slate-500 mb-1">Passage from the abstract ({suggestion.purpose === 'CounterEvidence' ? 'disagrees with your claim' : 'supports your claim'})</p>
            <blockquote className="text-[13px] text-slate-700 italic border-l-2 border-slate-200 pl-3">“{suggestion.quote}”</blockquote>
          </div>
          <div>
            <label className="text-[12px] text-slate-500 mb-1 block">Section</label>
            <select value={sectionCode} onChange={e => setSectionCode(e.target.value)} disabled={!!result}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-[13px] text-slate-700 bg-white outline-none focus:border-purple-accent">
              {sections.map(s => <option key={s.code} value={s.code}>{s.code} — {s.title}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[12px] text-slate-500 mb-1 block">The claim this passage backs</label>
            <textarea value={claim} onChange={e => setClaim(e.target.value)} rows={3} maxLength={4000} disabled={!!result}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-[13px] text-slate-700 outline-none focus:border-purple-accent resize-none" />
            <p className="text-[11px] text-slate-500 mt-1">Proposal Studio checks that the passage really supports this exact wording. Abstracts can back what they state, not more.</p>
          </div>
          {result && (
            <p className={result.status === 'Pass' ? 'text-[13px] text-emerald-700' : 'text-[13px] text-amber-700'}>
              {result.status === 'Pass' ? 'Accepted as evidence. ' : 'Not accepted: '}{result.message}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg border border-slate-200 text-[12px] text-slate-600 hover:bg-slate-50">{result ? 'Close' : 'Cancel'}</button>
            {!result && (
              <button onClick={() => void submit()} disabled={!canSubmit}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-white text-[12px] font-semibold disabled:opacity-50">
                {busy && <Loader2 size={12} className="animate-spin" />} Check and add
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
