import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, FilePen, History, ListTree, PenLine, Play, Square, X } from 'lucide-react'
import { researchPaperApi } from '../../api/researchPaper'
import { useRunPoll } from '../../hooks/useRunPoll'
import { splitCitations } from '../../lib/literatureReview'
import { Chip, Loading, Notice, Panel, RunBanner } from '../literatureReview/ui'
import { btn, inputClass } from '../literatureReview/styles'
import {
  errorMessage, EVIDENCE_LABELS, fromEditable, isRunActive, shortCite, toEditable,
  type Claim, type Outline, type OutlineSection, type Paper, type PaperIssue, type PaperSource, type ResultsInput, type Section, type SectionVersion,
} from '../../lib/researchPaper'

const USER_INPUT_KINDS = ['StudyMethods', 'StudyResults', 'ProposedMethods']

/**
 * Stage 5: the outline (gate 3), the author's own results, drafting in generation order, and the document. Each
 * citation opens its evidence (source, evidence level, supporting passage); each section can be regenerated, expanded,
 * tightened, re-toned, given the author's notes, edited and restored from its history. Open check findings are marked
 * on the sentence they are about.
 */
export function WritingStage({ paper, onChanged, onNext }: { paper: Paper; onChanged: (p?: Paper) => void; onNext: () => void }) {
  const [outline, setOutline] = useState<Outline | null>(null)
  const [sections, setSections] = useState<Section[] | null>(null)
  const [sources, setSources] = useState<Record<string, PaperSource>>({})
  const [issues, setIssues] = useState<PaperIssue[]>([])
  const [evidence, setEvidence] = useState<{ section: Section; sourceId: string; claims: Claim[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    researchPaperApi.outline(paper.id).then(setOutline).catch(() => setOutline(null))
    researchPaperApi.sections(paper.id).then(setSections).catch(e => setError(errorMessage(e, 'The sections could not be loaded.')))
    researchPaperApi.sources(paper.id).then(list => setSources(Object.fromEntries(list.map(s => [s.id, s])))).catch(() => setSources({}))
    researchPaperApi.integrity(paper.id).then(r => setIssues(r.issues.filter(i => i.status === 'Open' || i.status === 'Stale'))).catch(() => setIssues([]))
  }, [paper.id])
  useEffect(load, [load])
  const fetchDraft = useCallback(() => researchPaperApi.latestRun(paper.id, 'DraftSections'), [paper.id])
  const draft = useRunPoll(fetchDraft, () => { load(); onChanged() })
  const fetchRevise = useCallback(() => researchPaperApi.latestRun(paper.id, 'ReviseSection'), [paper.id])
  const revise = useRunPoll(fetchRevise, load)
  const writing = isRunActive(draft.run) || isRunActive(revise.run)

  const act = async (fn: () => Promise<void>, failure: string) => {
    setBusy(true); setError(null)
    try { await fn() } catch (e) { setError(errorMessage(e, failure)) } finally { setBusy(false) }
  }

  const openEvidence = async (section: Section, sourceId: string) => {
    try { setEvidence({ section, sourceId, claims: await researchPaperApi.claims(paper.id, section.code) }) } catch { setEvidence({ section, sourceId, claims: [] }) }
  }

  const needsInput = outline?.sections.some(s => USER_INPUT_KINDS.includes(s.kind)) ?? false
  const approved = !!outline?.approved

  return (
    <div className="space-y-4">
      {paper.studentMode ? <Notice tone="info">The draft is written only from the evidence you approved, with every claim tied to a source. Read it as a first draft: change what you would say differently, and check what each citation rests on.</Notice> : null}
      <OutlinePanel paper={paper} outline={outline} busy={busy || writing} onBuilt={setOutline} onApproved={o => { setOutline(o); load(); onChanged() }} setError={setError} />
      {needsInput ? <ResultsInputPanel paper={paper} onSaved={load} /> : null}

      {approved ? (
        <Panel title="Draft" id="rp-draft" description="Methods and results first, the abstract last. Sections with nothing to be written from hold a labelled placeholder instead of invented text."
          actions={<>
            <button type="button" onClick={() => void act(async () => { draft.setRun(await researchPaperApi.draftAll(paper.id)) }, 'Drafting could not be started.')} disabled={busy || writing} className={btn.primary}><Play size={16} aria-hidden /> Draft the paper</button>
            {isRunActive(draft.run) && draft.run ? <button type="button" onClick={() => void act(async () => { draft.setRun(await researchPaperApi.cancelRun(paper.id, draft.run!.id)) }, 'The run could not be cancelled.')} className={btn.secondary}><Square size={14} aria-hidden /> Cancel</button> : null}
          </>}>
          <RunBanner run={draft.run} label="Drafting" />
          <RunBanner run={revise.run} label="Revising" />
        </Panel>
      ) : null}

      {error ? <Notice tone="error">{error}</Notice> : null}

      {sections && sections.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <article aria-label="Paper" className="space-y-4">
            {sections.map(s => (
              <SectionCard key={s.code} paper={paper} section={s} sources={sources} issues={issues.filter(i => i.sectionCode === s.code)} busy={busy || writing}
                onCite={id => void openEvidence(s, id)} onChanged={load} onRun={r => revise.setRun(r)} onDraftRun={r => draft.setRun(r)} setError={setError} />
            ))}
          </article>
          <aside aria-label="Evidence" className="xl:sticky xl:top-4 xl:self-start">
            <EvidencePanel evidence={evidence} sources={sources} onClose={() => setEvidence(null)} />
          </aside>
        </div>
      ) : approved ? null : <Notice tone="info">Build and approve the outline to start writing.</Notice>}

      {sections?.some(s => s.status === 'Drafted' || s.status === 'Edited') ? <button type="button" onClick={onNext} className={btn.primary}>Continue to the integrity check</button> : null}
    </div>
  )
}

// ── Outline (gate 3) ────────────────────────────────────────────────────────────────────────────────────

function OutlinePanel({ paper, outline, busy, onBuilt, onApproved, setError }: {
  paper: Paper; outline: Outline | null; busy: boolean; onBuilt: (o: Outline) => void; onApproved: (o: Outline) => void; setError: (e: string | null) => void
}) {
  const [rows, setRows] = useState<OutlineSection[]>([])
  useEffect(() => setRows(outline?.sections ?? []), [outline])
  const dirty = JSON.stringify(rows.map(r => [r.code, r.title, r.targetWords])) !== JSON.stringify((outline?.sections ?? []).map(r => [r.code, r.title, r.targetWords]))
  const run = async (fn: () => Promise<Outline>, failure: string) => { setError(null); try { return await fn() } catch (e) { setError(errorMessage(e, failure)); return null } }
  const move = (i: number, d: -1 | 1) => setRows(r => { const n = [...r]; const j = i + d; if (j < 1 || j >= n.length || i < 1) return r; [n[i], n[j]] = [n[j], n[i]]; return n })

  return (
    <Panel title="Outline" id="rp-outline" description={outline?.approved ? 'Approved. Drafting follows this plan; any change needs a new approval.' : 'Approve the outline before drafting.'}
      actions={<button type="button" disabled={busy} onClick={async () => { const o = await run(() => researchPaperApi.buildOutline(paper.id), 'The outline could not be built.'); if (o) onBuilt(o) }} className={btn.secondary}><ListTree size={16} aria-hidden /> {outline?.sections.length ? 'Rebuild' : 'Build the outline'}</button>}>
      {outline?.notes.map(n => <p key={n} className="mb-2 text-[13px] text-slate-700">{n}</p>)}
      {rows.length ? (
        <ol className="space-y-2">
          {rows.map((s, i) => (
            <li key={s.code} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-2">
              <label className="sr-only" htmlFor={`rp-ot-${s.code}`}>Title of section {i + 1}</label>
              <input id={`rp-ot-${s.code}`} value={s.title} onChange={e => setRows(r => r.map(x => x.code === s.code ? { ...x, title: e.target.value } : x))} className={inputClass + ' min-w-[12rem] flex-1'} />
              <label className="sr-only" htmlFor={`rp-ow-${s.code}`}>Words for {s.title}</label>
              <input id={`rp-ow-${s.code}`} type="number" min={50} max={6000} value={s.targetWords} onChange={e => setRows(r => r.map(x => x.code === s.code ? { ...x, targetWords: Number(e.target.value) } : x))} className={inputClass + ' w-24'} />
              <span className="text-[12px] text-slate-600">words</span>
              <button type="button" aria-label={`Move ${s.title} up`} className={btn.small} disabled={i < 2} onClick={() => move(i, -1)}><ArrowUp size={14} aria-hidden /></button>
              <button type="button" aria-label={`Move ${s.title} down`} className={btn.small} disabled={i < 1 || i === rows.length - 1} onClick={() => move(i, 1)}><ArrowDown size={14} aria-hidden /></button>
              {!s.required ? <button type="button" aria-label={`Remove ${s.title}`} className={btn.small} onClick={() => setRows(r => r.filter(x => x.code !== s.code))}><X size={14} aria-hidden /></button> : null}
            </li>
          ))}
        </ol>
      ) : null}
      {rows.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busy || !dirty} className={btn.secondary}
            onClick={async () => { const o = await run(() => researchPaperApi.updateOutline(paper.id, rows.map(r => ({ code: r.code, title: r.title, purpose: r.purpose, targetWords: r.targetWords }))), 'The outline could not be saved.'); if (o) onBuilt(o) }}>Save outline</button>
          <button type="button" disabled={busy || dirty || !!outline?.approved} className={btn.primary}
            onClick={async () => { const o = await run(() => researchPaperApi.approveOutline(paper.id), 'The outline could not be approved.'); if (o) onApproved(o) }}>{outline?.approved ? 'Approved' : 'Approve the outline'}</button>
        </div>
      ) : null}
    </Panel>
  )
}

// ── The author's own study ──────────────────────────────────────────────────────────────────────────────

function ResultsInputPanel({ paper, onSaved }: { paper: Paper; onSaved: () => void }) {
  const [input, setInput] = useState<ResultsInput | null>(null)
  const [form, setForm] = useState({ methodsDescription: '', resultsText: '', tablesText: '', attest: false })
  const [state, setState] = useState<{ busy: boolean; error: string | null; saved: boolean }>({ busy: false, error: null, saved: false })
  useEffect(() => {
    researchPaperApi.resultsInput(paper.id).then(r => { setInput(r); setForm({ methodsDescription: r.methodsDescription ?? '', resultsText: r.resultsText ?? '', tablesText: r.tablesText ?? '', attest: !!r.attestedAt }) }).catch(() => setInput(null))
  }, [paper.id])
  const save = async () => {
    setState({ busy: true, error: null, saved: false })
    try { setInput(await researchPaperApi.updateResultsInput(paper.id, form)); setState({ busy: false, error: null, saved: true }); onSaved() }
    catch (e) { setState({ busy: false, error: errorMessage(e, 'Your input could not be saved.'), saved: false }) }
  }
  const proposal = paper.paperType === 'Proposal'
  return (
    <Panel title={proposal ? 'Your planned study' : 'Your study and its results'} id="rp-results"
      description={proposal ? 'The proposed methodology is written from your plan. Nothing is reported as done.' : 'Methods and results are written only from what you put here. With nothing here they stay as placeholders; numbers are never invented.'}>
      {input === null ? <Loading /> : (
        <div className="space-y-3">
          <div><label htmlFor="rp-in-methods" className="block text-[14px] font-medium text-slate-900">{proposal ? 'Planned design, participants and analysis' : 'Methods: design, participants, data collection, analysis'}</label>
            <textarea id="rp-in-methods" rows={4} value={form.methodsDescription} onChange={e => setForm(f => ({ ...f, methodsDescription: e.target.value }))} className={inputClass + ' mt-1'} /></div>
          {!proposal ? <>
            <div><label htmlFor="rp-in-results" className="block text-[14px] font-medium text-slate-900">Results</label>
              <textarea id="rp-in-results" rows={5} value={form.resultsText} onChange={e => setForm(f => ({ ...f, resultsText: e.target.value }))} className={inputClass + ' mt-1'} /></div>
            <div><label htmlFor="rp-in-tables" className="block text-[14px] font-medium text-slate-900">Tables (paste as text)</label>
              <textarea id="rp-in-tables" rows={4} value={form.tablesText} onChange={e => setForm(f => ({ ...f, tablesText: e.target.value }))} className={inputClass + ' mt-1 font-mono text-[13px]'} /></div>
          </> : null}
          <label className="flex items-start gap-2 text-[14px] text-slate-900">
            <input type="checkbox" checked={form.attest} onChange={e => setForm(f => ({ ...f, attest: e.target.checked }))} className="mt-1" />
            <span>This describes my own study{proposal ? '' : ' and its real results'}. The paper reports only what I supply here.</span>
          </label>
          {state.error ? <Notice tone="error">{state.error}</Notice> : null}
          {state.saved ? <Notice tone="success" role="status">Saved. Draft the sections written from it again so they match.</Notice> : null}
          <button type="button" onClick={() => void save()} disabled={state.busy} className={btn.secondary}>{state.busy ? 'Saving…' : 'Save'}</button>
        </div>
      )}
    </Panel>
  )
}

// ── A section ───────────────────────────────────────────────────────────────────────────────────────────

const SENTENCE = /(?<=[.!?])\s+(?=[A-Z"“([{])/

function SectionCard({ paper, section, sources, issues, busy, onCite, onChanged, onRun, onDraftRun, setError }: {
  paper: Paper; section: Section; sources: Record<string, PaperSource>; issues: PaperIssue[]; busy: boolean
  onCite: (sourceId: string) => void; onChanged: () => void; onRun: (r: Awaited<ReturnType<typeof researchPaperApi.revise>>) => void
  onDraftRun: (r: Awaited<ReturnType<typeof researchPaperApi.revise>>) => void; setError: (e: string | null) => void
}) {
  const [mode, setMode] = useState<'read' | 'edit' | 'notes' | 'history'>('read')
  const [tone, setTone] = useState('formal')
  const [notes, setNotes] = useState('')
  const written = section.status === 'Drafted' || section.status === 'Edited'
  const reviseWith = async (action: string, extra: { tone?: string; notes?: string } = {}) => {
    setError(null)
    try {
      const run = await researchPaperApi.revise(paper.id, section.code, { action, ...extra })
      if (action === 'Regenerate') onDraftRun(run); else onRun(run)
      setMode('read')
    } catch (e) { setError(errorMessage(e, 'The section could not be revised.')) }
  }

  return (
    <section aria-labelledby={`rp-sec-${section.code}`} className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id={`rp-sec-${section.code}`} className="text-[17px] font-semibold text-slate-900">{section.title}</h2>
          <p className="text-[12px] text-slate-600">{section.wordCount} of about {section.targetWords} words · {section.versions} version{section.versions === 1 ? '' : 's'}{section.model ? '' : section.status === 'Drafted' ? ' · written from records' : ''}</p>
        </div>
        <Chip className={section.status === 'Placeholder' || section.status === 'Failed' ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-slate-300 text-slate-800'}>{section.status === 'NotDrafted' ? 'Not written' : section.status}</Chip>
      </div>
      {section.failureReason ? <Notice tone="warning">{section.failureReason}</Notice> : null}
      {section.flags.length ? <ul className="mb-2 list-disc pl-5 text-[12px] text-amber-950">{section.flags.map(f => <li key={f.code + f.message}>{f.message}</li>)}</ul> : null}

      {mode === 'edit' ? <SectionEditor paper={paper} section={section} sources={sources} onDone={() => { setMode('read'); onChanged() }} setError={setError} />
        : mode === 'history' ? <VersionHistory paper={paper} section={section} onRestored={() => { setMode('read'); onChanged() }} setError={setError} />
        : <SectionText text={section.text} sources={sources} issues={issues} onCite={onCite} />}

      {mode === 'notes' ? (
        <div className="mt-3 space-y-2">
          <label htmlFor={`rp-notes-${section.code}`} className="block text-[14px] font-medium text-slate-900">Your notes to work in (your own points; they are not attributed to any source)</label>
          <textarea id={`rp-notes-${section.code}`} rows={3} maxLength={2000} value={notes} onChange={e => setNotes(e.target.value)} className={inputClass} />
          <div className="flex gap-2"><button type="button" className={btn.small} disabled={busy || !notes.trim()} onClick={() => void reviseWith('AddNotes', { notes })}>Add my notes</button><button type="button" className={btn.small} onClick={() => setMode('read')}>Cancel</button></div>
        </div>
      ) : null}

      {mode === 'read' ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3" role="toolbar" aria-label={`Actions for ${section.title}`}>
          <button type="button" className={btn.small} disabled={busy} onClick={() => void reviseWith('Regenerate')}>{written ? 'Regenerate' : 'Draft'}</button>
          {written ? <>
            <button type="button" className={btn.small} disabled={busy} onClick={() => void reviseWith('Expand')}>Expand</button>
            <button type="button" className={btn.small} disabled={busy} onClick={() => void reviseWith('Tighten')}>Tighten</button>
            <label className="sr-only" htmlFor={`rp-tone-${section.code}`}>Tone</label>
            <select id={`rp-tone-${section.code}`} value={tone} onChange={e => setTone(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1 text-[13px]">
              {['formal', 'concise', 'accessible', 'critical'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <button type="button" className={btn.small} disabled={busy} onClick={() => void reviseWith('Tone', { tone })}>Change tone</button>
            <button type="button" className={btn.small} disabled={busy} onClick={() => setMode('notes')}><PenLine size={14} aria-hidden /> Add my notes</button>
            <button type="button" className={btn.small} disabled={busy} onClick={() => setMode('edit')}><FilePen size={14} aria-hidden /> Edit</button>
          </> : null}
          {section.versions > 0 ? <button type="button" className={btn.small} onClick={() => setMode('history')}><History size={14} aria-hidden /> History</button> : null}
        </div>
      ) : null}
    </section>
  )
}

/** The section text with citations as buttons and sentences with open findings marked. */
function SectionText({ text, sources, issues, onCite }: { text: string; sources: Record<string, PaperSource>; issues: PaperIssue[]; onCite: (id: string) => void }) {
  if (!text) return <p className="text-[14px] text-slate-600">Not written yet.</p>
  return (
    <div className="space-y-3 text-[15px] leading-relaxed text-slate-900">
      {text.split(/\n\s*\n/).map((para, pi) => (
        <p key={pi}>
          {para.split(SENTENCE).map((sentence, si) => {
            const issue = issues.find(i => i.claimText && (i.claimText.trim() === sentence.trim() || sentence.includes(i.claimText.trim())))
            const body = splitCitations(sentence).map((part, k) => part.kind === 'text' ? <span key={k}>{part.text}</span>
              : part.kind === 'unknown' ? <span key={k} className="rounded bg-red-50 px-1 text-red-900">[citation not in this paper]</span>
              : <button key={k} type="button" onClick={() => onCite(part.sourceId)} className="rounded px-0.5 text-purple-deep underline decoration-dotted outline-none hover:bg-purple-tint focus-visible:ring-2 focus-visible:ring-purple-accent/40">
                  {part.narrative ? shortCite(sources[part.sourceId], true) : `(${shortCite(sources[part.sourceId])})`}
                </button>)
            return issue
              ? <mark key={si} title={issue.message} className={issue.severity === 'Blocking' ? 'bg-red-50 underline decoration-red-500 decoration-wavy' : 'bg-amber-50 underline decoration-amber-500 decoration-wavy'}>{body} <span className="sr-only">({issue.severity === 'Blocking' ? 'must fix' : 'warning'}: {issue.message})</span></mark>
              : <span key={si}>{body} </span>
          })}
        </p>
      ))}
    </div>
  )
}

/** Editing with numbered citation markers ([1], [@1] for narrative) and a draft kept in this browser until saved. */
function SectionEditor({ paper, section, sources, onDone, setError }: { paper: Paper; section: Section; sources: Record<string, PaperSource>; onDone: () => void; setError: (e: string | null) => void }) {
  const editable = useMemo(() => toEditable(section.text), [section.text])
  const key = `researchPaper.draft.${paper.id}.${section.code}`
  const [ids, setIds] = useState(editable.ids)
  const [value, setValue] = useState(() => { try { return localStorage.getItem(key) ?? editable.text } catch { return editable.text } })
  const [busy, setBusy] = useState(false)
  const restored = useRef(value !== editable.text)
  useEffect(() => { try { localStorage.setItem(key, value) } catch { /* private mode: no local draft */ } }, [key, value])
  const discard = () => { try { localStorage.removeItem(key) } catch { /* ignore */ } }
  const insert = (sourceId: string) => {
    let n = ids.indexOf(sourceId)
    if (n < 0) { setIds(x => [...x, sourceId]); n = ids.length }
    setValue(v => `${v.trimEnd()} [${n + 1}]`)
  }
  const save = async () => {
    setBusy(true); setError(null)
    try { await researchPaperApi.editSection(paper.id, section.code, fromEditable(value, ids)); discard(); onDone() }
    catch (e) { setError(errorMessage(e, 'The section could not be saved.')) } finally { setBusy(false) }
  }
  return (
    <div className="space-y-2">
      {restored.current ? <Notice tone="info">Your unsaved changes from before were restored.</Notice> : null}
      <label htmlFor={`rp-edit-${section.code}`} className="sr-only">Text of {section.title}</label>
      <textarea id={`rp-edit-${section.code}`} rows={14} value={value} onChange={e => setValue(e.target.value)} className={inputClass + ' font-serif text-[15px] leading-relaxed'} />
      <p className="text-[12px] text-slate-700">Citations: {ids.length ? ids.map((id, i) => `[${i + 1}] ${shortCite(sources[id])}`).join(' · ') : 'none'}. Write [@n] where the authors are the subject of the sentence.</p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`rp-insert-${section.code}`}>Insert a citation</label>
        <select id={`rp-insert-${section.code}`} defaultValue="" onChange={e => { if (e.target.value) insert(e.target.value); e.target.value = '' }} className="rounded-md border border-slate-300 px-2 py-1 text-[13px]">
          <option value="">Insert a citation…</option>
          {Object.values(sources).map(s => <option key={s.id} value={s.id}>{shortCite(s)} — {s.title.slice(0, 60)}</option>)}
        </select>
        <button type="button" className={btn.primary} disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save'}</button>
        <button type="button" className={btn.secondary} onClick={() => { discard(); onDone() }}>Discard changes</button>
      </div>
    </div>
  )
}

function VersionHistory({ paper, section, onRestored, setError }: { paper: Paper; section: Section; onRestored: () => void; setError: (e: string | null) => void }) {
  const [versions, setVersions] = useState<SectionVersion[] | null>(null)
  const [open, setOpen] = useState<number | null>(null)
  useEffect(() => { researchPaperApi.versions(paper.id, section.code).then(setVersions).catch(() => setVersions([])) }, [paper.id, section.code])
  if (!versions) return <Loading label="Loading history" />
  return (
    <div className="space-y-2">
      <ul className="divide-y divide-slate-100 text-[13px]">
        {versions.map(v => (
          <li key={v.versionNo} className="py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>Version {v.versionNo} · {v.action} · {v.createdAt.slice(0, 16).replace('T', ' ')} · {v.wordCount} words{v.note ? ` · ${v.note}` : ''}</span>
              <span className="flex gap-2">
                <button type="button" className={btn.small} onClick={() => setOpen(open === v.versionNo ? null : v.versionNo)}>{open === v.versionNo ? 'Hide' : 'Show'}</button>
                <button type="button" className={btn.small} onClick={async () => { try { await researchPaperApi.restore(paper.id, section.code, v.versionNo); onRestored() } catch (e) { setError(errorMessage(e, 'That version could not be restored.')) } }}>Restore</button>
              </span>
            </div>
            {open === v.versionNo ? <p className="mt-2 whitespace-pre-wrap rounded bg-slate-50 p-2 text-slate-900">{toEditable(v.text).text}</p> : null}
          </li>
        ))}
      </ul>
      <button type="button" className={btn.small} onClick={onRestored}>Close history</button>
    </div>
  )
}

/** What a citation rests on: the source, its evidence level, and the passage for each sentence that cites it here. */
function EvidencePanel({ evidence, sources, onClose }: { evidence: { section: Section; sourceId: string; claims: Claim[] } | null; sources: Record<string, PaperSource>; onClose: () => void }) {
  if (!evidence) return <Panel title="Evidence"><p className="text-[13px] text-slate-700">Select a citation to see the source, how much of it was read, and the passage the sentence rests on.</p></Panel>
  const source = sources[evidence.sourceId]
  const uses = evidence.claims.filter(c => c.sources.some(s => s.sourceId === evidence.sourceId))
  return (
    <Panel title="Evidence" actions={<button type="button" aria-label="Close evidence" className={btn.small} onClick={onClose}><X size={14} aria-hidden /></button>}>
      {source ? (
        <div className="space-y-1 text-[13px] text-slate-900">
          <p className="font-medium">{source.title}</p>
          <p className="text-slate-700">{source.authors}{source.year > 0 ? ` (${source.year})` : ''}{source.journal ? ` · ${source.journal}` : ''}</p>
          <div className="flex flex-wrap gap-1.5"><Chip className={source.evidenceLevel === 'FullText' ? 'border-green-300 bg-green-50 text-green-900' : 'border-amber-300 bg-amber-50 text-amber-950'}>{EVIDENCE_LABELS[source.evidenceLevel]}</Chip></div>
        </div>
      ) : <Notice tone="warning">This source is no longer one of the paper's sources.</Notice>}
      <ul className="mt-3 space-y-3">
        {uses.map(c => {
          const link = c.sources.find(s => s.sourceId === evidence.sourceId)!
          return (
            <li key={c.ordinal} className="rounded-lg border border-slate-200 p-2 text-[13px]">
              <p className="text-slate-900">{c.text.replace(/\{\{cite:[^}]+\}\}/g, '').trim()}</p>
              {link.passage ? <blockquote className="mt-2 border-l-2 border-purple-accent/50 pl-2 text-slate-800">“{link.passage}”</blockquote>
                : <p className="mt-2 text-red-900">No passage supports this citation yet.</p>}
              <p className="mt-1 text-[12px] text-slate-600">{link.verdict === 'Unchecked' ? 'Not checked yet' : link.verdict === 'Supported' ? 'Checked: supported' : link.verdict === 'Partial' ? 'Checked: partly supported' : link.verdict === 'NoPassage' ? 'No supporting passage' : 'Checked: not supported'}</p>
            </li>
          )
        })}
        {uses.length === 0 ? <li className="text-[13px] text-slate-700">No sentence in this section cites it.</li> : null}
      </ul>
    </Panel>
  )
}
