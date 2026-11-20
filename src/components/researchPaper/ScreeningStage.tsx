import { useCallback, useEffect, useRef, useState } from 'react'
import { ListOrdered, Wand2 } from 'lucide-react'
import { researchPaperApi } from '../../api/researchPaper'
import { useRunPoll } from '../../hooks/useRunPoll'
import { Chip, Loading, Notice, Panel, RunBanner } from '../literatureReview/ui'
import { btn, inputClass } from '../literatureReview/styles'
import { errorMessage, isRunActive, type Criteria, type DecisionEvent, type Flow, type Paper, type Reason, type ScreeningList } from '../../lib/researchPaper'

const PAGE = 50

/**
 * Stage 3: criteria, AI relevance screening with a one-line reason per record, a fast list ordered so the records that
 * need a person come first (ASReview-trained once there are decisions to learn from), bulk decisions, the audit trail
 * and PRISMA-style counts. Approving the screened sources is gate 2.
 */
export function ScreeningStage({ paper, onChanged, onNext }: { paper: Paper; onChanged: (p?: Paper) => void; onNext: () => void }) {
  const [criteria, setCriteria] = useState<Criteria | null>(null)
  const [draft, setDraft] = useState({ include: '', exclude: '' })
  const [list, setList] = useState<ScreeningList | null>(null)
  const [reasons, setReasons] = useState<Reason[]>([])
  const [flow, setFlow] = useState<Flow | null>(null)
  const [audit, setAudit] = useState<DecisionEvent[] | null>(null)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkReason, setBulkReason] = useState('')
  const [ack, setAck] = useState(false)
  /** Set when approval was refused because more sources are included than the synthesis compares. */
  const [overLimit, setOverLimit] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadList = useCallback(() => {
    researchPaperApi.screening(paper.id, { page, pageSize: PAGE }).then(setList).catch(e => setError(errorMessage(e, 'The screening list could not be loaded.')))
  }, [paper.id, page])
  const load = useCallback(() => {
    loadList()
    researchPaperApi.flow(paper.id).then(setFlow).catch(() => setFlow(null))
  }, [paper.id, loadList])
  useEffect(load, [load])
  useEffect(() => {
    researchPaperApi.criteria(paper.id).then(c => { setCriteria(c); setDraft({ include: c.include.join('\n'), exclude: c.exclude.join('\n') }) }).catch(() => setCriteria(null))
    researchPaperApi.reasons().then(setReasons).catch(() => setReasons([]))
  }, [paper.id])
  // While the AI is screening, refresh the list only (the counts are fetched once more when it finishes), every 5 seconds.
  const running = list?.screeningStatus === 'Running'
  useEffect(() => {
    if (!running) return
    const t = window.setTimeout(loadList, 5000)
    return () => window.clearTimeout(t)
  }, [running, list, loadList])
  const wasRunning = useRef(false)
  useEffect(() => {
    if (wasRunning.current && !running) researchPaperApi.flow(paper.id).then(setFlow).catch(() => setFlow(null))
    wasRunning.current = running
  }, [running, paper.id])

  const fetchOrder = useCallback(() => researchPaperApi.latestRun(paper.id, 'PrioritiseScreening'), [paper.id])
  const order = useRunPoll(fetchOrder, load)

  const act = async (fn: () => Promise<void>, failure: string) => {
    setBusy(true); setError(null)
    try { await fn() } catch (e) { setError(errorMessage(e, failure)) } finally { setBusy(false) }
  }
  const lines = (s: string) => s.split('\n').map(l => l.trim()).filter(Boolean)
  const saveCriteria = () => act(async () => setCriteria(await researchPaperApi.updateCriteria(paper.id, { include: lines(draft.include), exclude: lines(draft.exclude) })), 'The criteria could not be saved.')
  const decide = (candidateId: string, decision: 'include' | 'exclude' | 'undo', reasonCode?: string) =>
    act(async () => { await researchPaperApi.decide(paper.id, candidateId, { decision, reasonCode }); load() }, 'The decision could not be saved.')
  const bulk = (decision: 'include' | 'exclude') =>
    act(async () => {
      const r = await researchPaperApi.bulkDecide(paper.id, { candidateIds: [...selected], decision, reasonCode: decision === 'exclude' ? bulkReason : undefined })
      if (r.failed.length) setError(`${r.failed.length} could not be changed: ${r.failed[0].error}`)
      setSelected(new Set()); load()
    }, 'The decisions could not be saved.')
  const approve = (keepMostRelevant: boolean) => act(async () => {
    try {
      const r = await researchPaperApi.approveScreening(paper.id, ack, keepMostRelevant)
      setOverLimit(null); onChanged(r.paper); onNext()
    } catch (e) {
      if ((e as { serverCode?: string })?.serverCode === 'TOO_MANY_FOR_SYNTHESIS') { setOverLimit(errorMessage(e, 'Too many sources for the synthesis.')); return }
      throw e
    }
  }, 'The sources could not be approved.')
  const toggle = (id: string) => setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  if (!list) return <Panel>{error ? <Notice tone="error">{error}</Notice> : <Loading />}</Panel>
  const pages = Math.max(1, Math.ceil(list.totalCount / PAGE))

  return (
    <div className="space-y-4">
      {paper.studentMode ? <Notice tone="info">Screen with your criteria in mind. The AI suggests a decision and a reason for each record; you decide. Records the AI could not decide come first.</Notice> : null}

      <Panel title="Criteria" id="rp-criteria" description={criteria ? `Version ${criteria.version}. Every decision records the version it was made under.` : undefined}
        actions={<button type="button" onClick={() => void saveCriteria()} disabled={busy} className={btn.secondary}>Save criteria</button>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label htmlFor="rp-inc" className="block text-[14px] font-medium text-slate-900">Include if (one per line)</label>
            <textarea id="rp-inc" rows={4} value={draft.include} onChange={e => setDraft(d => ({ ...d, include: e.target.value }))} className={inputClass + ' mt-1'} /></div>
          <div><label htmlFor="rp-exc" className="block text-[14px] font-medium text-slate-900">Exclude if (one per line)</label>
            <textarea id="rp-exc" rows={4} value={draft.exclude} onChange={e => setDraft(d => ({ ...d, exclude: e.target.value }))} className={inputClass + ' mt-1'} /></div>
        </div>
      </Panel>

      <Panel title="Screening" id="rp-screening" description={list.orderNote}
        actions={<>
          <button type="button" onClick={() => void act(async () => { setList(await researchPaperApi.startScreening(paper.id)) }, 'Screening could not be started.')} disabled={busy || list.screeningStatus === 'Running'} className={btn.secondary}><Wand2 size={16} aria-hidden /> Screen with AI</button>
          {list.screeningStatus === 'Running' ? <button type="button" onClick={() => void act(async () => { setList(await researchPaperApi.stopScreening(paper.id)) }, 'Screening could not be stopped.')} disabled={busy} className={btn.secondary}>Stop screening</button> : null}
          <button type="button" onClick={() => void act(async () => { order.setRun(await researchPaperApi.prioritise(paper.id)) }, 'The order could not be updated.')} disabled={busy || isRunActive(order.run)} className={btn.secondary}><ListOrdered size={16} aria-hidden /> Update the order</button>
        </>}>
        {list.screeningStatus === 'Running' ? <Notice tone="info" role="status">The AI is screening ({list.screeningProgressPct}%). Stop it at any time; what it has judged is kept.</Notice> : null}
        <RunBanner run={order.run} label="Ordering" />
        <p className="mt-2 text-[13px] text-slate-700">{Object.entries(list.stateCounts).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()}`).join(' · ')}</p>

        {selected.size > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-purple-accent/30 bg-purple-tint/40 p-2 text-[13px]" role="region" aria-label="Bulk actions">
            <span>{selected.size} selected</span>
            <button type="button" onClick={() => void bulk('include')} disabled={busy} className={btn.small}>Include</button>
            <label className="sr-only" htmlFor="rp-bulk-reason">Reason for excluding</label>
            <select id="rp-bulk-reason" value={bulkReason} onChange={e => setBulkReason(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1">
              <option value="">Reason…</option>{reasons.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
            </select>
            <button type="button" onClick={() => void bulk('exclude')} disabled={busy || !bulkReason} className={btn.small}>Exclude</button>
            <button type="button" onClick={() => setSelected(new Set())} className={btn.small}>Clear</button>
          </div>
        ) : null}

        <ul className="mt-3 divide-y divide-slate-100">
          {list.items.map(e => <ScreeningRow key={e.item.candidateId} entry={e} reasons={reasons} selected={selected.has(e.item.candidateId)} onToggle={toggle} onDecide={decide} busy={busy} />)}
        </ul>
        {pages > 1 ? (
          <div className="mt-3 flex items-center gap-2 text-[13px]">
            <button type="button" className={btn.small} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
            <span>Page {page} of {pages}</span>
            <button type="button" className={btn.small} disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        ) : null}
      </Panel>

      {flow ? (
        <Panel title="Counts for your methods" id="rp-flow" description="Counted from the search and screening records. Use this text in your methods section.">
          <p className="text-[14px] leading-relaxed text-slate-900">{flow.methodsText}</p>
          {flow.caveats.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-amber-950">{flow.caveats.map(c => <li key={c}>{c}</li>)}</ul> : null}
        </Panel>
      ) : null}

      <Panel title="Decision history" id="rp-audit" description="Every decision, who made it, and what the AI had said."
        actions={<button type="button" className={btn.small} onClick={() => void researchPaperApi.audit(paper.id).then(r => setAudit(r.items)).catch(() => setAudit([]))}>{audit ? 'Refresh' : 'Show'}</button>}>
        {audit ? (audit.length === 0 ? <p className="text-[13px] text-slate-700">No decisions yet.</p> : (
          <ul className="space-y-1 text-[13px] text-slate-900">
            {audit.map((a, i) => <li key={i}>{a.at.slice(0, 16).replace('T', ' ')} · {a.actor === 'System' ? 'Rule' : 'You'}: {a.decision === 'Automatic' ? 'undid the decision on' : a.decision.toLowerCase() + 'd'} “{a.title}”{a.reasonLabel ? ` (${a.reasonLabel})` : ''} · AI had said {a.aiVerdict.toLowerCase()} · criteria v{a.criteriaVersion}</li>)}
          </ul>
        )) : null}
      </Panel>

      {error ? <Notice tone="error">{error}</Notice> : null}
      <Panel title="Approve the screened sources" id="rp-approve" description="Included records become the paper's evidence. The synthesis uses approved sources only.">
        <label className="flex items-start gap-2 text-[14px] text-slate-900">
          <input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} className="mt-1" />
          <span>Approve even if some parts of the topic are thinly covered by the search.</span>
        </label>
        <button type="button" className={btn.primary + ' mt-3'} disabled={busy || !list.canApprove}
          onClick={() => void approve(false)}>
          Approve and continue
        </button>
        {overLimit ? (
          <div className="mt-3 space-y-2">
            <Notice tone="warning">{overLimit}</Notice>
            <button type="button" className={btn.secondary} disabled={busy} onClick={() => void approve(true)}>Keep the most relevant and approve</button>
          </div>
        ) : null}
        {!list.canApprove ? <p className="mt-2 text-[13px] text-slate-700">Run the AI screening to completion first.</p> : null}
      </Panel>
    </div>
  )
}

function ScreeningRow({ entry, reasons, selected, onToggle, onDecide, busy }: {
  entry: ScreeningList['items'][number]; reasons: Reason[]; selected: boolean; onToggle: (id: string) => void
  onDecide: (id: string, decision: 'include' | 'exclude' | 'undo', reason?: string) => void; busy: boolean
}) {
  const [reason, setReason] = useState('')
  const it = entry.item
  return (
    <li className="py-2.5">
      <div className="flex items-start gap-2">
        <input type="checkbox" checked={selected} onChange={() => onToggle(it.candidateId)} aria-label={`Select ${it.title}`} className="mt-1" />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium text-slate-900 [overflow-wrap:anywhere]">{entry.position}. {it.title}</p>
          <p className="text-[13px] text-slate-700">{it.authors}{it.year ? ` (${it.year})` : ''}{it.journal ? ` · ${it.journal}` : ''}</p>
          <p className="mt-1 text-[13px] text-slate-900">{it.explanation}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Chip className="border-slate-300 text-slate-800">{it.state.replace(/([a-z])([A-Z])/g, '$1 $2')}</Chip>
            <Chip className="border-slate-200 text-slate-700">{entry.priorityReason}</Chip>
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 pl-6">
        <button type="button" className={btn.small} disabled={busy} onClick={() => onDecide(it.candidateId, 'include')}>Include</button>
        <label className="sr-only" htmlFor={`rp-reason-${it.candidateId}`}>Reason for excluding</label>
        <select id={`rp-reason-${it.candidateId}`} value={reason} onChange={e => setReason(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1 text-[13px]">
          <option value="">Reason…</option>{reasons.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
        </select>
        <button type="button" className={btn.small} disabled={busy || !reason} onClick={() => onDecide(it.candidateId, 'exclude', reason)}>Exclude</button>
        {entry.manualDecision !== 'Automatic' ? <button type="button" className={btn.small} disabled={busy} onClick={() => onDecide(it.candidateId, 'undo')}>Undo</button> : null}
      </div>
    </li>
  )
}
