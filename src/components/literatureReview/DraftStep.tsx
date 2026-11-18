import { Fragment, useCallback, useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Pencil, RefreshCw, Trash2 } from 'lucide-react'
import { literatureReviewApi } from '../../api/literatureReview'
import {
  errorMessage, fromEditable, isRunActive, shortCite, splitCitations, toEditable,
  type Outline, type OutlineSection, type PoolSource, type Review, type Section,
} from '../../lib/literatureReview'
import { Chip, Loading, Notice, Panel, RunBanner } from './ui'
import { btn, inputClass } from './styles'
import { useRunPoll } from '../../hooks/useRunPoll'

const STATUS: Record<Section['status'], { label: string; tone: string }> = {
  NotDrafted: { label: 'Not written', tone: 'border-slate-300 bg-slate-50 text-slate-800' },
  Drafted: { label: 'Drafted', tone: 'border-green-300 bg-green-50 text-green-900' },
  Edited: { label: 'Edited by you', tone: 'border-purple-accent/40 bg-purple-tint text-purple-text' },
  Failed: { label: 'Needs attention', tone: 'border-amber-300 bg-amber-50 text-amber-950' },
}

/**
 * Step 5: the outline and the draft. Each section is written only from checked points and may cite only the review's
 * sources; every new draft is checked straight away. Editing keeps citations as numbered markers tied to sources.
 */
export function DraftStep({ review, onChanged, onNext }: { review: Review; onChanged: () => void; onNext: () => void }) {
  const [outline, setOutline] = useState<Outline | null | undefined>(undefined)
  const [sections, setSections] = useState<Section[]>([])
  const [pool, setPool] = useState<PoolSource[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [editingOutline, setEditingOutline] = useState(false)

  const load = useCallback(async () => {
    try {
      const [o, s, p] = await Promise.all([literatureReviewApi.outline(review.id), literatureReviewApi.sections(review.id), literatureReviewApi.sources(review.id)])
      setOutline(o); setSections(s); setPool(p)
    } catch (e) { setError(errorMessage(e, 'The draft could not be loaded.')) }
  }, [review.id])
  useEffect(() => { void load() }, [load])
  const fetchRun = useCallback(() => literatureReviewApi.latestRun(review.id, 'Draft'), [review.id])
  const { run, setRun } = useRunPoll(fetchRun, () => { void load(); onChanged() })
  const running = isRunActive(run)

  const start = async (fn: () => Promise<Awaited<ReturnType<typeof literatureReviewApi.draftAll>>>) => {
    setBusy(true)
    setError(null)
    try { setRun(await fn()) } catch (e) { setError(errorMessage(e, 'Drafting could not be started.')) } finally { setBusy(false) }
  }

  if (outline === undefined && !error) return <Panel><Loading /></Panel>
  if (!outline) return <Panel title="Draft" id="lr-draft"><Notice>Build the outline in the Themes step first.</Notice></Panel>
  const unwritten = sections.filter(s => s.status === 'NotDrafted' || s.status === 'Failed').length
  const poolById = new Map(pool.map(p => [p.id, p]))

  return (
    <div className="space-y-4">
      <Panel title="Outline" id="lr-outline" description={`${outline.sections.length} sections · about ${outline.totalWords.toLocaleString()} words`}
        actions={<button type="button" onClick={() => setEditingOutline(v => !v)} className={btn.secondary} aria-expanded={editingOutline}>{editingOutline ? 'Close' : 'Edit outline'}</button>}>
        {editingOutline ? <OutlineEditor reviewId={review.id} outline={outline} onSaved={o => { setOutline(o); setEditingOutline(false); void load() }} />
          : <ol className="list-decimal space-y-0.5 pl-5 text-[13px] text-slate-800">{outline.sections.map(s => <li key={s.code ?? s.title}>{s.title}</li>)}</ol>}
      </Panel>

      <Panel title="Draft" id="lr-draft" description="Each section uses only checked evidence from your sources. Each section costs 4 credits; a section without evidence is not charged."
        actions={unwritten > 0
          ? <button type="button" onClick={() => void start(() => literatureReviewApi.draftAll(review.id))} disabled={busy || running} className={btn.primary}>Draft {unwritten} section{unwritten === 1 ? '' : 's'}</button>
          : <button type="button" onClick={onNext} className={btn.primary}>Continue to review</button>}>
        <RunBanner run={run} label="Drafting" />
        {error ? <div className="mt-2"><Notice tone="error">{error}</Notice></div> : null}
      </Panel>

      {sections.map(s => (
        <SectionCard key={s.code} reviewId={review.id} section={s} poolById={poolById} busy={busy || running}
          onRegenerate={() => void start(() => literatureReviewApi.draftSection(review.id, s.code))}
          onSaved={updated => { setSections(list => list.map(x => x.code === updated.code ? updated : x)); onChanged() }} />
      ))}
    </div>
  )
}

function SectionCard({ reviewId, section, poolById, busy, onRegenerate, onSaved }: {
  reviewId: string; section: Section; poolById: Map<string, PoolSource>; busy: boolean; onRegenerate: () => void; onSaved: (s: Section) => void
}) {
  const [editing, setEditing] = useState<{ text: string; sources: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const status = STATUS[section.status]
  const save = async () => {
    if (!editing) return
    setError(null)
    try { onSaved(await literatureReviewApi.editSection(reviewId, section.code, fromEditable(editing.text, editing.sources))); setEditing(null) }
    catch (e) { setError(errorMessage(e, 'The section could not be saved.')) }
  }
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4" aria-labelledby={`lr-sec-${section.code}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 id={`lr-sec-${section.code}`} className="text-[15px] font-semibold text-slate-900">{section.title}</h3>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-slate-600">{section.wordCount} / ~{section.targetWords} words</span>
          <Chip className={status.tone}>{status.label}</Chip>
        </div>
      </div>
      {section.failureReason ? <p className="mt-1 text-[13px] text-amber-950">{section.failureReason}</p> : null}
      {error ? <div className="mt-2"><Notice tone="error">{error}</Notice></div> : null}

      {editing ? (
        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div>
            <label htmlFor={`lr-edit-${section.code}`} className="sr-only">Text of {section.title}</label>
            <textarea id={`lr-edit-${section.code}`} rows={14} value={editing.text} onChange={e => setEditing({ ...editing, text: e.target.value })} className={inputClass + ' font-[inherit] leading-relaxed'} />
            <p className="mt-1 text-[12px] text-slate-600">Citations show as [@1], [@2] … ([@n1] where the authors are the subject: "Kelly et al. (2019) report"). Keep them to keep each claim tied to its source; a number not in the list is flagged when the review is checked.</p>
            <div className="mt-2 flex gap-2"><button type="button" onClick={() => void save()} className={btn.small}>Save</button><button type="button" onClick={() => setEditing(null)} className={btn.small}>Cancel</button></div>
          </div>
          <ol className="list-none space-y-1 text-[12px] text-slate-800" aria-label="Citation numbers">
            {editing.sources.map((id, i) => <li key={id}><span className="font-semibold">[@{i + 1}]</span> {shortCite(poolById.get(id))} — {poolById.get(id)?.title ?? 'not in this review'}</li>)}
          </ol>
        </div>
      ) : section.text ? (
        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="space-y-3 text-[14px] leading-relaxed text-slate-900">
            {section.text.split('\n\n').map((para, i) => (
              <p key={i}>
                {splitCitations(para).map((part, j) => part.kind === 'text' ? <Fragment key={j}>{part.text}</Fragment>
                  : part.kind === 'cite' ? <span key={j} className="mx-0.5 rounded bg-purple-tint px-1 text-[12px] text-purple-text" title={poolById.get(part.sourceId)?.title}>{shortCite(poolById.get(part.sourceId), part.narrative)}</span>
                    : <span key={j} className="mx-0.5 rounded bg-red-100 px-1 text-[12px] text-red-900" title="This citation is not a source in the review">not in the review: {part.label}</span>)}
              </p>
            ))}
          </div>
          <div className="text-[12px] text-slate-800">
            <p className="font-medium uppercase tracking-wide text-slate-600">Cited sources</p>
            <ul className="mt-1 space-y-1">{section.citedSourceIds.map(id => <li key={id} className="[overflow-wrap:anywhere]">{shortCite(poolById.get(id))} — {poolById.get(id)?.title ?? 'no longer in the review'}</li>)}</ul>
          </div>
        </div>
      ) : null}

      {!editing ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button type="button" disabled={busy} onClick={onRegenerate} className={btn.small}><RefreshCw size={13} aria-hidden /> {section.text ? 'Regenerate' : 'Draft this section'}</button>
          {section.text ? <button type="button" disabled={busy} onClick={() => { const e = toEditable(section.text); setEditing({ text: e.editable, sources: e.sources }) }} className={btn.small}><Pencil size={13} aria-hidden /> Edit</button> : null}
        </div>
      ) : null}
    </article>
  )
}

function OutlineEditor({ reviewId, outline, onSaved }: { reviewId: string; outline: Outline; onSaved: (o: Outline) => void }) {
  const [sections, setSections] = useState<OutlineSection[]>(outline.sections)
  const [error, setError] = useState<string | null>(null)
  const update = (i: number, patch: Partial<OutlineSection>) => setSections(s => s.map((x, j) => j === i ? { ...x, ...patch } : x))
  const move = (i: number, dir: -1 | 1) => setSections(s => { const n = [...s]; [n[i], n[i + dir]] = [n[i + dir], n[i]]; return n })
  const save = async () => {
    setError(null)
    try { onSaved(await literatureReviewApi.saveOutline(reviewId, sections)) } catch (e) { setError(errorMessage(e, 'The outline could not be saved.')) }
  }
  return (
    <div className="space-y-2">
      {sections.map((s, i) => (
        <div key={s.code ?? i} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-2">
          <label className="sr-only" htmlFor={`lr-ol-t-${i}`}>Title of section {i + 1}</label>
          <input id={`lr-ol-t-${i}`} value={s.title} maxLength={200} onChange={e => update(i, { title: e.target.value })} className={inputClass + ' min-w-0 flex-1'} />
          <label className="sr-only" htmlFor={`lr-ol-w-${i}`}>Words for section {i + 1}</label>
          <input id={`lr-ol-w-${i}`} type="number" min={100} max={5000} step={50} value={s.targetWords} onChange={e => update(i, { targetWords: Number(e.target.value) })} className={inputClass + ' w-24'} />
          <button type="button" disabled={i <= 1} onClick={() => move(i, -1)} className={btn.small} aria-label={`Move "${s.title}" up`}><ArrowUp size={13} aria-hidden /></button>
          <button type="button" disabled={i === 0 || i === sections.length - 1} onClick={() => move(i, 1)} className={btn.small} aria-label={`Move "${s.title}" down`}><ArrowDown size={13} aria-hidden /></button>
          <button type="button" disabled={i === 0} onClick={() => setSections(x => x.filter((_, j) => j !== i))} className={btn.small} aria-label={`Remove "${s.title}"`}><Trash2 size={13} aria-hidden /></button>
        </div>
      ))}
      <p className="text-[12px] text-slate-600">The introduction stays first. Removing a section deletes its draft.</p>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <button type="button" onClick={() => void save()} className={btn.small}>Save outline</button>
    </div>
  )
}
