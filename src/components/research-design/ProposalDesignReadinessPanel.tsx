import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { proposalWorkflowApi as api } from '../../api/proposalWorkflow'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Modal } from '../ui/Modal'
import { designError } from '../../lib/researchDesign'
import type { ProposalDesignReadiness } from '../../types/proposalWorkflow'

export function ProposalDesignReadinessPanel({ projectId, onChanged, onView, providedView }: { projectId: string; providedView?: ProposalDesignReadiness; onChanged?: () => void; onView?: (view: ProposalDesignReadiness | null) => void }) {
  const userId = useAuthStore(s => s.user?.id ?? '')
  return <ReadinessPanel key={`${userId}:${projectId}`} projectId={projectId} userId={userId} onChanged={onChanged} onView={onView} providedView={providedView} />
}
function ReadinessPanel({ projectId, userId, onChanged, onView, providedView }: { projectId: string; userId: string; providedView?: ProposalDesignReadiness; onChanged?: () => void; onView?: (view: ProposalDesignReadiness | null) => void }) {
  const query = useQuery({ queryKey: ['proposal-design-readiness', userId, projectId], queryFn: ({ signal }) => api.readiness(projectId, signal), enabled: !providedView && !!projectId && !!userId, retry: false, staleTime: 0, refetchOnWindowFocus: true })
  useEffect(() => { onView?.(providedView ?? (query.error ? null : query.data ?? null)) }, [providedView, query.data, query.error, onView])
  const [confirm, setConfirm] = useState<ProposalDesignReadiness | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const keys = useRef(new Map<string, string>())
  const bind = async () => {
    if (!confirm?.acceptedRevisionId || lock.current) return
    lock.current = true; setBusy(true); setError('')
    const slot = `${userId}:${projectId}:${confirm.boundRevisionId}:${confirm.acceptedRevisionId}`
    let key = keys.current.get(slot)
    try { key ??= sessionStorage.getItem(`proposal-design-binding:${slot}`) ?? undefined } catch { /* storage is optional */ }
    key ??= crypto.randomUUID(); keys.current.set(slot, key)
    try {
      try { sessionStorage.setItem(`proposal-design-binding:${slot}`, key) } catch { /* retain in memory */ }
      await api.bindDesign(projectId, confirm.acceptedRevisionId, confirm.boundRevisionId, key)
      setConfirm(null); if (!providedView) await query.refetch(); onChanged?.()
    } catch (e) { setError(designError(e).message) }
    finally { lock.current = false; setBusy(false) }
  }
  if (!providedView && query.isPending) return <p role="status" className="text-sm text-slate-500">Checking your proposal’s research design…</p>
  if (!providedView && (query.error || !query.data)) return <div role="alert" className="text-sm text-red-700">Unable to check your research design. <Button variant="ghost" size="sm" onClick={() => void query.refetch()}>Try again</Button></div>
  const view = (providedView ?? query.data)!
  return <Card className="!bg-white !border-slate-200 p-4 space-y-3">
    <h2 className="font-semibold text-slate-900">{view.mode === 'CanonicalResearchDesign' ? `Research design · version ${view.acceptedVersion}` : 'Research design'}</h2>
    <p className="text-sm text-slate-600">{view.canGenerate ? 'Your proposal can use this research design. Section evidence and review checks still apply.' : 'Your proposal needs attention before writing can continue.'}</p>
    {view.mode.startsWith('Legacy') && <p className="text-sm text-amber-700">This proposal uses the earlier research workflow. It has not been validated by Research Design.</p>}
    {view.findings.map((f, i) => <p key={`${f.key}:${i}`} className="text-sm text-amber-800">{f.message}</p>)}
    {view.sections.some(s => s.affected) && <p className="text-sm text-slate-600">Review sections: {view.sections.filter(s => s.affected).map(s => s.code).join(', ')}. Your text is preserved.</p>}
    <div className="flex flex-wrap gap-3 text-sm">
      <Link className="text-violet-700 underline" to={`/app/research-design/${projectId}`}>View research design</Link>
      {view.allowedActions.includes('ReviewAffectedSections') && <Link className="text-violet-700 underline" to={`/app/research-agent/${projectId}/proposal-workflow`}>Review affected sections</Link>}
      {view.allowedActions.includes('UseUpdatedDesign') && <Button size="sm" onClick={() => setConfirm(view)}>Use updated design</Button>}
    </div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {confirm && <Modal panelClassName="research-design" isOpen onClose={() => { if (!busy) setConfirm(null) }} title="Use the updated research design?">
      <p className="text-sm text-text-secondary">New writing will use version {confirm?.acceptedVersion}. Existing paragraphs stay unchanged. Review and reconcile the affected sections before accepting them.</p>
      <div className="flex justify-end gap-3 mt-5"><Button variant="ghost" disabled={busy} onClick={() => setConfirm(null)}>Cancel</Button><Button isLoading={busy} onClick={() => void bind()}>Use updated design</Button></div>
    </Modal>}
  </Card>
}
