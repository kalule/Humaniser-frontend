import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Button } from '../ui/Button'
import { proposalAgentApi, serverRefusal, STALE_BINDINGS_CODE } from '../../api/proposalAgent'
import type { AgentEvidenceAcceptResult, AgentEvidenceProposal, AgentEvidenceState } from '../../types/proposalAgent'
import { AgentActivity } from './AgentActivityList'

// Strict workflow (adapters P5/P6): the research agent proposes evidence; nothing is evidence until the student confirms it.
// Confirming includes the sources and runs the normal source check for each claim and passage (one paid check each).

export interface AgentEvidenceViewProps {
  state: AgentEvidenceState
  selected: ReadonlySet<string>
  busy: boolean
  /** Set when confirming would make existing evidence stale; the student must confirm again. */
  staleWarning: string | null
  lastResult: AgentEvidenceAcceptResult | null
  onToggle: (id: string) => void
  onSelectAllOpen: () => void
  onPrepare: () => void
  onConfirm: () => void
  onConfirmAnyway: () => void
  onCancelStale: () => void
  onDismiss: () => void
}

const open = (p: AgentEvidenceProposal) => p.status === 'Proposed' || p.status === 'Failed'

const STATUS_LABEL: Record<string, string> = {
  Proposed: 'Suggested', Accepted: 'Added as evidence', Dismissed: 'Dismissed', Failed: 'Could not be added',
}

export function AgentEvidenceView(props: AgentEvidenceViewProps) {
  const { state, selected, busy } = props
  const bySection = useMemo(() => {
    const groups = new Map<string, AgentEvidenceProposal[]>()
    for (const p of state.proposals) groups.set(p.sectionCode, [...(groups.get(p.sectionCode) ?? []), p])
    return [...groups.entries()]
  }, [state.proposals])
  const openCount = state.proposals.filter(open).length
  const chosen = state.proposals.filter(p => selected.has(p.id) && open(p))
  const newSources = new Set(chosen.filter(p => !p.sourceIncluded).map(p => p.literatureId ?? p.doi ?? p.sourceTitle)).size

  return (
    <section aria-label="Suggested evidence" className="space-y-4 rounded-xl border border-violet-200 bg-violet-50/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Suggested evidence</h3>
          <p className="mt-1 text-sm text-slate-600">
            The research agent searches, reads and suggests claims with the exact passage behind each. Nothing is used as evidence until you confirm it.
          </p>
        </div>
        <Button variant="secondary" disabled={busy || state.status === 'Running'} onClick={props.onPrepare}>
          {state.status === 'Running' ? 'Finding evidence…' : state.proposals.length > 0 ? 'Look again' : 'Find evidence'}
        </Button>
      </div>

      {state.status === 'Ready' && (
        <p className="text-xs text-slate-500">
          {state.searches} search{state.searches === 1 ? '' : 'es'} · {state.papersRead} paper{state.papersRead === 1 ? '' : 's'} read · {state.proposals.length} suggestion{state.proposals.length === 1 ? '' : 's'}
        </p>
      )}

      {state.gaps.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">No evidence found for:</p>
          <ul className="mt-1 list-disc pl-5">{state.gaps.map(g => <li key={g}>{g.replace(/^No source found that answers:\s*/, '')}</li>)}</ul>
        </div>
      )}

      {bySection.map(([code, proposals]) => (
        <div key={code} className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-800">Section {code}</h4>
          {proposals.map(p => (
            <article key={p.id} className={`rounded-lg border bg-white p-3 text-sm ${open(p) ? 'border-slate-200' : 'border-slate-100 opacity-70'}`}>
              <label className="flex gap-3">
                <input type="checkbox" className="mt-1" disabled={!open(p) || busy} checked={selected.has(p.id) && open(p)} onChange={() => props.onToggle(p.id)} aria-label={`Select: ${p.claim}`} />
                <span className="min-w-0 flex-1 space-y-2">
                  <span className="block font-medium text-slate-900">{p.claim}</span>
                  <blockquote className="m-0 whitespace-pre-wrap border-l-4 border-violet-300 bg-violet-50 p-2 text-slate-700">{p.quote}</blockquote>
                  <span className="block text-xs text-slate-500">
                    {p.authors ? `${p.authors} ` : ''}{p.year ? `(${p.year}) ` : ''}{p.sourceTitle} · {p.coverage === 'FullText' ? 'full text' : 'abstract'}
                    {!p.sourceIncluded && open(p) ? ' · not yet in your sources' : ''}
                  </span>
                  <span className="block text-xs font-medium text-slate-600">{STATUS_LABEL[p.status] ?? p.status}{p.message ? ` — ${p.message}` : ''}</span>
                </span>
              </label>
            </article>
          ))}
        </div>
      ))}

      {props.staleWarning && (
        <div role="alert" className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p>{props.staleWarning}</p>
          <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={props.onConfirmAnyway}>Add them anyway</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={props.onCancelStale}>Cancel</Button>
          </div>
        </div>
      )}

      {props.lastResult && (
        <p role="status" className="text-sm text-slate-700">
          Added {props.lastResult.bound.length} claim{props.lastResult.bound.length === 1 ? '' : 's'} as evidence
          {props.lastResult.sourcesIncluded > 0 ? `, ${props.lastResult.sourcesIncluded} new source${props.lastResult.sourcesIncluded === 1 ? '' : 's'}` : ''}
          {props.lastResult.failed.length > 0 ? `; ${props.lastResult.failed.length} could not be added` : ''}.
        </p>
      )}

      {openCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-violet-100 pt-3">
          <Button variant="ghost" size="sm" disabled={busy} onClick={props.onSelectAllOpen}>Select all suggestions</Button>
          <Button size="sm" disabled={busy || chosen.length === 0} onClick={props.onConfirm}>
            Add {chosen.length || ''} as evidence
          </Button>
          <Button size="sm" variant="secondary" disabled={busy || chosen.length === 0} onClick={props.onDismiss}>Dismiss</Button>
          {chosen.length > 0 && (
            <span className="text-xs text-slate-500">
              Checks each claim against its passage ({chosen.length} source check{chosen.length === 1 ? '' : 's'}, uses credits)
              {newSources > 0 ? ` and adds ${newSources} source${newSources === 1 ? '' : 's'} to your project` : ''}.
            </span>
          )}
        </div>
      )}
    </section>
  )
}

/** Connected panel. Renders nothing unless the agent is on for the strict workflow (the endpoint 404s otherwise). */
export function AgentEvidencePanel({ projectId, onChanged }: { projectId: string; onChanged?: () => void }) {
  const client = useQueryClient()
  const key = ['agent-evidence', projectId]
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => proposalAgentApi.evidence(projectId, signal),
    enabled: !!projectId,
    retry: false,
    refetchInterval: q => (q.state.data?.status === 'Running' ? 4000 : false),
  })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [staleWarning, setStaleWarning] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<AgentEvidenceAcceptResult | null>(null)
  const state = query.data
  if (!state) return null

  const act = async (action: () => Promise<void>) => {
    setBusy(true)
    try { await action() }
    catch (e) { toast.error(serverRefusal(e).message ?? 'That did not work. Your proposal is unchanged. Please try again.') }
    finally { setBusy(false) }
  }
  const ids = () => state.proposals.filter(p => selected.has(p.id) && open(p)).map(p => p.id)
  const confirm = (acknowledge: boolean) => act(async () => {
    try {
      const result = await proposalAgentApi.acceptEvidence(projectId, ids(), acknowledge)
      setLastResult(result); setStaleWarning(null); setSelected(new Set())
      await client.invalidateQueries({ queryKey: key }); onChanged?.()
    } catch (e) {
      const refusal = serverRefusal(e)
      if (refusal.code === STALE_BINDINGS_CODE) { setStaleWarning(refusal.message); return }
      throw e
    }
  })

  return (
    <div className="space-y-3">
      <AgentEvidenceView
        state={state} selected={selected} busy={busy} staleWarning={staleWarning} lastResult={lastResult}
        onToggle={id => setSelected(s => { const next = new Set(s); if (next.has(id)) next.delete(id); else next.add(id); return next })}
        onSelectAllOpen={() => setSelected(new Set(state.proposals.filter(open).map(p => p.id)))}
        onPrepare={() => void act(async () => { client.setQueryData(key, await proposalAgentApi.prepareEvidence(projectId)) })}
        onConfirm={() => void confirm(false)}
        onConfirmAnyway={() => void confirm(true)}
        onCancelStale={() => setStaleWarning(null)}
        onDismiss={() => void act(async () => { client.setQueryData(key, await proposalAgentApi.dismissEvidence(projectId, ids())); setSelected(new Set()) })}
      />
      <AgentActivity projectId={projectId} active={state.status === 'Running'} />
    </div>
  )
}
