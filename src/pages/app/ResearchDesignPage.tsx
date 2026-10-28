import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { researchDesignApi as api } from '../../api/researchDesign'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { Skeleton } from '../../components/ui/Skeleton'
import { ResearchDesignReview } from '../../components/research-design/ResearchDesignReview'
import ResearchSpecificationEditor from '../../components/research-agent/ResearchSpecificationEditor'
import { ResearchDesignDetailsEditor } from '../../components/research-design/ResearchDesignDetailsEditor'
import { ResearchDesignQuestion } from '../../components/research-design/ResearchDesignQuestion'
import { designError, pollInterval, stageLabel } from '../../lib/researchDesign'
import type { DesignAction, DesignInputValue, ResearchDesignView } from '../../types/researchDesign'
import '../../components/research-design/researchDesign.css'

const commandLabels: Partial<Record<DesignAction, string>> = { Start: 'Build my research design', Accept: 'Accept research design', Revise: 'Create revision', Restart: 'Try again', Cancel: 'Stop building' }
const confirmations: Partial<Record<DesignAction, { title: string; body: string }>> = {
  Accept: { title: 'Accept this research design?', body: 'This version becomes your accepted research design. Future changes create a new revision and may require proposal sections to be reviewed. Proposal writing is a separate step.' },
  Revise: { title: 'Create a new revision?', body: 'We’ll reconsider your design using your current research details. Your accepted version stays unchanged until you accept a new one. This may use credits.' },
  Restart: { title: 'Try building your design again?', body: 'Your saved work remains available. A new attempt may use credits.' },
  Cancel: { title: 'Stop building this research design?', body: 'Your saved work remains available. Completed evidence will be kept where permitted.' },
}

export default function ResearchDesignPage() {
  const { projectId = '' } = useParams()
  const userId = useAuthStore(s => s.user?.id ?? '')
  return <ResearchDesignWorkspace key={`${userId}:${projectId}`} projectId={projectId} />
}

export function ResearchDesignWorkspace({ projectId, embedded = false, onAccepted }: { projectId: string; embedded?: boolean; onAccepted?: () => void }) {
  const userId = useAuthStore(s => s.user?.id ?? '')
  const queryClient = useQueryClient()
  const queryKey = ['research-design', userId, projectId]
  const query = useQuery({ queryKey, queryFn: ({ signal }) => api.current(projectId, signal), enabled: !!projectId && !!userId, staleTime: 0, retry: false, refetchOnWindowFocus: true, refetchInterval: q => q.state.error ? false : pollInterval(q.state.data), refetchIntervalInBackground: false })
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const [error, setError] = useState<ReturnType<typeof designError> | null>(null)
  const [dialog, setDialog] = useState<{ action: DesignAction; view: ResearchDesignView; trigger: HTMLElement | null } | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [historicalId, setHistoricalId] = useState<string | null>(null)
  const [cursor, setCursor] = useState<string | undefined>()
  const history = useQuery({ queryKey: [...queryKey, 'history', cursor], queryFn: ({ signal }) => api.history(projectId, cursor, signal), enabled: showHistory && !!userId, retry: false })
  const historical = useQuery({ queryKey: [...queryKey, 'run', historicalId], queryFn: ({ signal }) => api.run(projectId, historicalId!, signal), enabled: !!historicalId && !!userId, retry: false })
  const keys = useRef(new Map<string, string>())
  const refresh = async () => { setDialog(null); const result = await query.refetch(); if (!result.error) setError(null) }
  const command = async (action: DesignAction, view: ResearchDesignView, value?: DesignInputValue, questionId?: string) => {
    if (lock.current || !view.allowedActions.includes(action)) return
    lock.current = true; setBusy(true); setError(null)
    try {
      const payload = action === 'Start' ? { expectedSpecificationRevision: view.canonicalRevision }
        : action === 'ProvideInput' ? { expectedVersion: view.version, questionId: questionId!, value: value! }
        : { expectedVersion: view.version, expectedSpecificationRevision: view.canonicalRevision }
      // Preserve the key across reload/retry without storing research answers or bearer tokens.
      const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([userId, projectId, view.runId, action, payload])))
      const digest = Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('')
      const storageKey = `research-design-command:${digest}`
      let key = keys.current.get(digest)
      try { key ??= sessionStorage.getItem(storageKey) ?? undefined } catch { /* memory fallback when storage is unavailable */ }
      key ??= crypto.randomUUID(); keys.current.set(digest, key)
      try { sessionStorage.setItem(storageKey, key) } catch { /* same key remains in memory */ }
      const versionCommand = { idempotencyKey: key, expectedVersion: view.version, expectedSpecificationRevision: view.canonicalRevision }
      const result = action === 'Start' ? await api.start(projectId, { idempotencyKey: key, expectedSpecificationRevision: view.canonicalRevision })
        : action === 'ProvideInput' ? await api.input(projectId, view.runId!, { idempotencyKey: key, expectedVersion: view.version, questionId: questionId!, value: value! })
        : action === 'Accept' ? await api.accept(projectId, view.runId!, versionCommand)
        : action === 'Cancel' ? await api.cancel(projectId, view.runId!, versionCommand)
        : await api.revise(projectId, view.runId!, versionCommand)
      await queryClient.cancelQueries({ queryKey, exact: true })
      queryClient.setQueryData(queryKey, result.view)
      void queryClient.invalidateQueries({ queryKey: [...queryKey, 'history'] })
      if (mounted.current) { closeDialog(); if (action === 'Accept') onAccepted?.() }
    } catch (e) { if (mounted.current) { setError(designError(e)); closeDialog() } }
    finally { lock.current = false; if (mounted.current) setBusy(false) }
  }
  const closeDialog = () => { const trigger = dialog?.trigger; setDialog(null); requestAnimationFrame(() => trigger?.focus()) }
  const view = query.data
  const currentError = error ?? (query.error ? designError(query.error) : null)
  const Heading = embedded ? 'h2' : 'h1'
  const question = view?.questions.find(q => q.answerable && ['Text', 'AccessConfirmation', 'Specification'].includes(q.valueType)) ?? view?.questions[0]
  return <div className={embedded ? "research-design min-w-0" : "research-design max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8"}>
    {!embedded && <nav aria-label="Breadcrumb" className="text-sm text-text-secondary mb-5"><Link className="hover:underline" to="/app/proposal-studio">Proposal Studio</Link><span aria-hidden="true"> / </span><Link className="hover:underline" to={`/app/research-agent/${projectId}/dashboard`}>Your research</Link><span aria-hidden="true"> / </span><span>Research Design</span></nav>}
    <header className="flex flex-wrap items-center justify-between gap-3 mb-6"><Heading className="text-2xl font-semibold">{embedded ? "Let's design your study" : "Research Design"}</Heading><Button variant="ghost" onClick={() => setShowHistory(!showHistory)} aria-expanded={showHistory}>Version history</Button></header>
    {currentError && <div id="design-command-error" role="alert" className="rounded-lg border border-border bg-card p-4 mb-5 text-sm"><p>{currentError.message}</p>{currentError.reference && <p className="mt-2">Support reference: {currentError.reference}</p>}<Button variant="secondary" className="mt-3" disabled={query.isFetching || busy} onClick={() => void refresh()}>Refresh latest version</Button></div>}
    {!view && query.isPending && <div role="status" aria-label="Loading research design"><Skeleton tone="light" variant="card" /></div>}
    {view && <Card className="p-5 sm:p-8 min-w-0 shadow-sm">
      <div role="status" aria-live="polite" aria-atomic="true"><h2 className="text-xl font-semibold">{stageLabel(view.status)}</h2><p className="mt-2 text-sm text-text-secondary break-words">{view.researchSummary.title}</p></div>
      {view.attention && <p className="mt-4 text-sm">{view.attention}</p>}
      {pollInterval(view) !== false && <section className="my-6 space-y-3" aria-label="Research design progress"><p className="font-medium">{view.progress.revalidating ? 'Checking the design with the latest evidence' : stageLabel(view.progress.stage)}</p>{view.progress.elapsedSeconds != null && <p className="text-sm text-text-secondary">Elapsed: {Math.floor(view.progress.elapsedSeconds / 60)} min {view.progress.elapsedSeconds % 60} sec</p>}<p className="text-sm text-text-secondary">You can leave this page. We’ll keep working on your research design.</p></section>}
      {embedded && view.status === 'NotStarted' && !view.allowedActions.includes('Start') && view.attention && <Link className="inline-block mt-4 text-sm underline" to={`/app/research-agent/${projectId}`}>Open research setup</Link>}
      {view.status === 'NotStarted' && <p className="my-6 text-text-secondary">Build a research design that matches your questions, objectives and available evidence. We’ll help you review methodology, sampling, data collection and analysis.</p>}
      {['Failed', 'Cancelled', 'BudgetExhausted'].includes(view.status) && <p className="my-4 text-sm">Your work has been saved. {view.status === 'BudgetExhausted' && !view.attention ? 'This attempt stopped before the design was completed.' : ''}</p>}
      {view.status === 'Superseded' && <p className="my-4 text-sm">Your research details have changed. This earlier design is kept for reference.</p>}
      {view.status === 'RequiresInput' && question && question.valueType !== 'Specification' && <div className="my-6"><ResearchDesignQuestion key={`${view.runId}:${question.id}`} question={{ ...question, answerable: question.answerable && view.allowedActions.includes('ProvideInput') }} busy={busy || !!currentError} errorId={currentError ? 'design-command-error' : undefined} onSubmit={value => { if (view.allowedActions.includes('ProvideInput') && !currentError) void command('ProvideInput', view, value, question.id) }} /></div>}
      {view.status === 'RequiresInput' && question?.valueType === 'Specification' && question.answerable && view.draft && <div className="my-6"><ResearchSpecificationEditor key={`${view.runId}:${question.id}`} initial={view.draft} draftMode pending={busy || !!currentError || !view.allowedActions.includes('ProvideInput')} extraFields={(spec, onChange) => <ResearchDesignDetailsEditor spec={spec} onChange={onChange} />} onAccept={async specification => { if (view.allowedActions.includes('ProvideInput') && !currentError) await command('ProvideInput', view, { specification }, question.id) }} /></div>}
      {view.status === 'RequiresInput' && question && !view.allowedActions.includes('ProvideInput') && <p className="my-4 text-sm">Your research details need review before you can continue.</p>}
      {view.status === 'RequiresInput' && question && (!question.answerable || !['Text', 'AccessConfirmation', 'Specification'].includes(question.valueType)) && <Link className="inline-block my-3 text-sm underline" to={`/app/research-agent/${projectId}`}>Review your research specification</Link>}
      {view.status === 'RequiresInput' && question?.valueType === 'Specification' && !view.draft && <p role="alert" className="my-4 text-sm">The editable study details are unavailable. Refresh the latest version before continuing.</p>}
      {view.status === 'RequiresEvidence' && <p className="my-5 text-sm">{pollInterval(view) !== false ? 'We’re checking whether academic evidence supports the proposed choices.' : 'More evidence is needed before this design can be confirmed.'} Any unresolved evidence remains visible below.</p>}
      {view.status === 'Accepted' || view.status === 'AcceptedSpecification' ? <p className="my-4 text-sm">This version is saved as your accepted research design. You can now choose how to write your proposal.</p> : null}
      {!embedded && ['Accepted', 'AcceptedSpecification'].includes(view.status) && <Link className="inline-block my-3 text-sm text-violet-700 underline" to={`/app/research-agent/${projectId}/proposal-workflow`}>Continue to proposal writing</Link>}
      {view.status !== 'NotStarted' && <div className="mt-6"><ResearchDesignReview view={view} /></div>}
      <div className="flex flex-wrap gap-3 mt-6">
        {view.allowedActions.filter(a => commandLabels[a]).map(action => <Button key={action} variant={action === 'Start' || action === 'Accept' || action === 'Restart' ? 'primary' : 'secondary'} disabled={busy || !!currentError} isLoading={busy} onClick={e => action === 'Start' ? void command(action, view) : setDialog({ action, view, trigger: e.currentTarget })}>{(embedded && action === 'Accept' ? 'Accept & continue' : commandLabels[action])}</Button>)}
        {!embedded && view.allowedActions.includes('View') && <Button variant="ghost" onClick={() => document.getElementById('issues-heading')?.scrollIntoView({ block: 'nearest' })}>View review notes</Button>}
      </div>
    </Card>}
    {showHistory && <section className="mt-6" aria-labelledby="history-heading"><h2 id="history-heading" className="text-lg font-semibold">Version history</h2>{history.isPending && <p role="status">Loading history…</p>}{history.error && <div role="alert"><p>We couldn’t load the history. Your current design is still available.</p><Button variant="ghost" onClick={() => void history.refetch()}>Retry history</Button></div>}{history.data && <><ul className="divide-y divide-border mt-2">{history.data.items.map(item => <li key={item.runId} className="py-3 flex flex-wrap gap-2 items-center justify-between"><span>{stageLabel(item.status)} · {new Date(item.createdAt).toLocaleDateString()}</span><Button variant="ghost" onClick={() => setHistoricalId(item.runId)}>View this version</Button></li>)}</ul>{history.data.items.length === 0 && <p>No earlier attempts yet.</p>}{history.data.nextCursor && <Button variant="secondary" onClick={() => setCursor(history.data.nextCursor!)}>Older versions</Button>}{cursor && <Button variant="ghost" onClick={() => setCursor(undefined)}>Latest versions</Button>}</>}</section>}
    <Modal panelClassName="research-design" isOpen={!!dialog} onClose={() => { if (!busy) closeDialog() }} title={dialog ? confirmations[dialog.action]?.title : undefined}><p className="text-sm">{dialog && confirmations[dialog.action]?.body}</p><div className="flex flex-wrap justify-end gap-3 mt-6"><Button variant="secondary" disabled={busy} onClick={closeDialog}>{dialog?.action === 'Cancel' ? 'Keep working' : 'Cancel'}</Button><Button disabled={busy || !!currentError} isLoading={busy} onClick={() => { if (dialog) void command(dialog.action, dialog.view) }}>{dialog?.action === 'Accept' ? 'Accept design' : dialog?.action === 'Cancel' ? 'Stop' : dialog ? commandLabels[dialog.action] : ''}</Button></div></Modal>
    <Modal panelClassName="research-design" isOpen={!!historicalId} onClose={() => setHistoricalId(null)} title="Earlier research design" size="lg">{historical.isPending && <p role="status">Loading version…</p>}{historical.error && <p role="alert">We couldn’t load this version.</p>}{historical.data && <><p className="mb-4 text-sm">{stageLabel(historical.data.status)} · Read only</p><ResearchDesignReview view={historical.data} /></>}</Modal>
  </div>
}

