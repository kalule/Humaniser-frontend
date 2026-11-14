import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowDown, ArrowUp, Info, Plus, Trash2, XCircle } from 'lucide-react'
import { studyDesignApi } from '../../api/studyDesign'
import { fieldErrors, type ApiFieldError } from '../../lib/studyDesign'
import {
  SCALE_PRESETS, addOtherItem, addScaleItem, countBySeverity, emptyDocument, moveItem, newId, removeConstruct, removeObjective, removeScale, scaleFromPreset,
  setConstructScale, updateItem, type ItemRole, type QuestionnaireDocument, type QuestionnaireDto, type QuestionnaireFinding, type QuestionnaireItem, type ScalePoint,
} from '../../lib/questionnaire'
import { cn } from '../../lib/utils'
import { PilotReliability } from './PilotReliability'

const field = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[14px] text-slate-900 outline-none focus:border-purple-accent focus-visible:ring-2 focus-visible:ring-purple-accent/30'
const small = 'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-2.5 text-[13px] font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40 disabled:cursor-not-allowed disabled:opacity-50'
const icon = 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40 disabled:cursor-not-allowed disabled:opacity-40'
const FALLBACK_BANNER = 'DRAFT — NOT VALIDATED. This questionnaire has not been through content-validity review or pilot testing.'
interface ApiFailure { code?: string; message?: string; details?: ApiFieldError[]; response?: { status?: number } }

/**
 * Instrument tab: the student builds a questionnaire from constructs, items and response scales. Every check comes
 * from the server and is deterministic. The page stores the questionnaire only, never answers, and the draft label
 * shown here is the one every export carries.
 */
export function InstrumentTab({ projectId, projectTitle }: { projectId: string; projectTitle: string | null }) {
  const [doc, setDoc] = useState<QuestionnaireDocument>(emptyDocument)
  const [server, setServer] = useState<QuestionnaireDto | null>(null)
  const [dirty, setDirty] = useState(false)
  const [state, setState] = useState<'idle' | 'loading' | 'saving' | 'error'>('idle')
  const [failure, setFailure] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const [structure, setStructure] = useState<Record<string, string>>({})
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [notes, setNotes] = useState({ review: '', pilot: '' })
  const sequence = useRef(0)

  const load = useCallback(async () => {
    setFailure(null); setConflict(false); setStructure({}); setConfirmDelete(false)
    if (!projectId) { setServer(null); return }
    setState('loading')
    try {
      const dto = await studyDesignApi.instrument(projectId)
      setServer(dto); setDoc(dto.document); setDirty(false); setState('idle')
      setNotes({ review: dto.contentValidityNote ?? '', pilot: dto.pilotNote ?? '' })
    } catch { setState('error') }
  }, [projectId])
  useEffect(() => { void load() }, [load])

  // Re-run the checks on the server shortly after each edit. A slower reply never overwrites a newer one.
  useEffect(() => {
    if (!dirty) return
    const mine = ++sequence.current
    const timer = setTimeout(() => {
      studyDesignApi.checkInstrument(doc)
        .then(dto => { if (mine === sequence.current) { setServer(prev => (prev ? { ...prev, report: dto.report } : { ...dto, projectId: null })); setStructure({}) } })
        .catch((err: ApiFailure) => { if (mine === sequence.current && err?.code === 'STUDY_DESIGN_VALIDATION') setStructure(fieldErrors(err.details)) })
    }, 700)
    return () => clearTimeout(timer)
  }, [doc, dirty])

  const edit = (next: QuestionnaireDocument) => { setDoc(next); setDirty(true) }
  const report = server?.report ?? null
  const counts = countBySeverity(report)
  const saved = !!server?.id
  const banner = server?.banner ?? FALLBACK_BANNER

  const save = async () => {
    if (!projectId) return
    setState('saving'); setFailure(null); setConflict(false)
    try {
      const dto = await studyDesignApi.saveInstrument(projectId, doc, server?.version ?? 0)
      setServer(dto); setDoc(dto.document); setDirty(false); setStructure({})
    } catch (err) {
      const e = err as ApiFailure
      if (e?.code === 'STUDY_DESIGN_VERSION_CONFLICT') setConflict(true)
      else if (e?.code === 'STUDY_DESIGN_VALIDATION') { setStructure(fieldErrors(e.details)); setFailure('The questionnaire could not be saved. See the message under Checks.') }
      else if (e?.response?.status === 413) setFailure('The questionnaire is too large to save. Shorten it.')
      else if (e?.response?.status === 429) setFailure('Too many requests in a short time. Wait a minute and save again. Your changes are still here.')
      else setFailure('The questionnaire could not be saved. Check your connection and try again. Your changes are still here.')
    } finally { setState('idle') }
  }

  const setStatus = async (patch: { reviewed?: boolean; piloted?: boolean }) => {
    if (!projectId || !server?.id) return
    const before = server
    const reviewed = patch.reviewed ?? !!server.contentValidityReviewedAt
    const piloted = patch.piloted ?? !!server.pilotedAt
    // Show the tick at once; the server's answer (with its dates and label) replaces it, or it is undone on failure.
    const now = new Date().toISOString()
    setServer({ ...server, contentValidityReviewedAt: reviewed ? server.contentValidityReviewedAt ?? now : null, pilotedAt: piloted ? server.pilotedAt ?? now : null })
    try {
      const dto = await studyDesignApi.setInstrumentStatus(projectId, { contentValidityReviewed: reviewed, contentValidityNote: notes.review, piloted, pilotNote: notes.pilot })
      setServer(prev => (prev ? { ...dto, report: prev.report } : dto))
    } catch { setServer(before); setFailure('The status could not be updated. Try again.') }
  }

  const exportCodebook = async (format: 'json' | 'csv') => {
    setFailure(null)
    try { await studyDesignApi.downloadCodebook(projectId, format) }
    catch (err) { setFailure((err as ApiFailure)?.details?.[0]?.message ?? 'The codebook could not be exported. Try again.') }
  }

  const remove = async () => {
    try { await studyDesignApi.deleteInstrument(projectId); await load() }
    catch { setFailure('The questionnaire could not be deleted. Try again.') }
  }

  const focusFinding = (f: QuestionnaireFinding) => {
    const id = f.itemIds[0] ? `sdq-item-${f.itemIds[0]}` : f.constructId ? `sdq-construct-${f.constructId}` : f.scaleId ? `sdq-scale-${f.scaleId}` : null
    const el = id ? document.getElementById(id) : null
    if (el) { el.scrollIntoView({ block: 'center' }); (el.querySelector('input, textarea, select') as HTMLElement | null)?.focus() }
  }

  if (state === 'loading') return <p className="text-[14px] text-slate-700">Loading the questionnaire…</p>
  if (state === 'error') return <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-[14px] text-red-800">The questionnaire could not be loaded. <button type="button" className="font-semibold underline" onClick={() => void load()}>Try again</button></p>

  const otherItems = doc.items.filter(i => i.role !== 'Scale')
  const marked = (id: string) => report?.findings.some(f => f.severity === 'error' && f.itemIds.includes(id)) ?? false

  return (
    <div className="space-y-5">
      <p role="note" className="flex items-start gap-2 rounded-lg border-2 border-amber-400 bg-amber-50 p-3 text-[14px] font-semibold text-amber-950">
        <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" /><span>{banner}</span>
      </p>
      {!projectId ? <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[13px] text-slate-800">Choose a project above to save your questionnaire. Without one you can still build and check it here, but it is not stored and is lost when you leave.</p> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-6">
          <section aria-labelledby="sdq-about" className="space-y-3">
            <h2 id="sdq-about" className="text-[15px] font-semibold text-slate-900">1. About the questionnaire</h2>
            <div>
              <label htmlFor="sdq-title" className="mb-1 block text-[13px] font-medium text-slate-800">Title</label>
              <input id="sdq-title" value={doc.title} maxLength={200} onChange={e => edit({ ...doc, title: e.target.value })} className={field} />
            </div>
            <div>
              <label htmlFor="sdq-instructions" className="mb-1 block text-[13px] font-medium text-slate-800">Instructions to respondents</label>
              <textarea id="sdq-instructions" rows={3} maxLength={2000} value={doc.instructions} onChange={e => edit({ ...doc, instructions: e.target.value })} className={field} />
            </div>
          </section>

          <section aria-labelledby="sdq-objectives" className="space-y-2">
            <h2 id="sdq-objectives" className="text-[15px] font-semibold text-slate-900">2. Objectives</h2>
            <p className="text-[13px] text-slate-600">Each objective should be measured by at least one construct.</p>
            <ol className="space-y-2">
              {doc.objectives.map((o, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-2 w-5 shrink-0 text-right text-[13px] font-medium text-slate-700">{i + 1}.</span>
                  <textarea aria-label={`Objective ${i + 1}`} rows={2} maxLength={500} value={o} onChange={e => edit({ ...doc, objectives: doc.objectives.map((x, j) => (j === i ? e.target.value : x)) })} className={field} />
                  <button type="button" className={icon} aria-label={`Remove objective ${i + 1}`} onClick={() => edit(removeObjective(doc, i))}><Trash2 size={16} aria-hidden="true" /></button>
                </li>
              ))}
            </ol>
            <button type="button" className={small} disabled={doc.objectives.length >= 10} onClick={() => edit({ ...doc, objectives: [...doc.objectives, ''] })}><Plus size={16} aria-hidden="true" /> Add an objective</button>
          </section>

          <section aria-labelledby="sdq-scales" className="space-y-3">
            <h2 id="sdq-scales" className="text-[15px] font-semibold text-slate-900">3. Response scales</h2>
            <p className="text-[13px] text-slate-600">The answer options for your scale items. The starting points below are ordinary wording for you to edit, not taken from any published instrument.</p>
            {doc.scales.map((s, si) => (
              <div key={s.id} id={`sdq-scale-${s.id}`} className="space-y-2 rounded-lg border border-slate-200 p-3">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label htmlFor={`sdq-scale-name-${s.id}`} className="mb-1 block text-[13px] font-medium text-slate-800">Scale {si + 1} name</label>
                    <input id={`sdq-scale-name-${s.id}`} value={s.name} maxLength={80} onChange={e => edit({ ...doc, scales: doc.scales.map(x => (x.id === s.id ? { ...x, name: e.target.value } : x)) })} className={field} />
                  </div>
                  <button type="button" className={icon} aria-label={`Remove scale ${s.name || si + 1}`} onClick={() => edit(removeScale(doc, s.id))}><Trash2 size={16} aria-hidden="true" /></button>
                </div>
                <PointList legend="Points" valueLabel="Value" points={s.anchors} max={11} addLabel="Add a point"
                  onChange={anchors => edit({ ...doc, scales: doc.scales.map(x => (x.id === s.id ? { ...x, anchors } : x)) })} />
                <PointList legend="Missing-value codes (optional)" valueLabel="Code" points={s.missingCodes} max={5} addLabel="Add a missing-value code" startAt={-99}
                  onChange={missingCodes => edit({ ...doc, scales: doc.scales.map(x => (x.id === s.id ? { ...x, missingCodes } : x)) })} />
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              {SCALE_PRESETS.map(p => <button key={p.key} type="button" className={small} disabled={doc.scales.length >= 20} onClick={() => edit({ ...doc, scales: [...doc.scales, scaleFromPreset(p.key, doc)] })}><Plus size={16} aria-hidden="true" /> {p.name}</button>)}
            </div>
          </section>

          <section aria-labelledby="sdq-constructs" className="space-y-3">
            <h2 id="sdq-constructs" className="text-[15px] font-semibold text-slate-900">4. Constructs and their items</h2>
            <p className="text-[13px] text-slate-600">A construct is one thing you measure with several items. Write your own items; do not copy items from a published scale without permission.</p>
            {doc.constructs.map((c, ci) => {
              const items = doc.items.filter(i => i.role === 'Scale' && i.constructId === c.id)
              return (
                <div key={c.id} id={`sdq-construct-${c.id}`} className="space-y-3 rounded-lg border border-slate-200 p-3">
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label htmlFor={`sdq-cname-${c.id}`} className="mb-1 block text-[13px] font-medium text-slate-800">Construct {ci + 1} name</label>
                      <input id={`sdq-cname-${c.id}`} value={c.name} maxLength={120} onChange={e => edit({ ...doc, constructs: doc.constructs.map(x => (x.id === c.id ? { ...x, name: e.target.value } : x)) })} className={field} />
                    </div>
                    <button type="button" className={icon} aria-label={`Remove construct ${c.name || ci + 1} and its items`} onClick={() => edit(removeConstruct(doc, c.id))}><Trash2 size={16} aria-hidden="true" /></button>
                  </div>
                  <div>
                    <label htmlFor={`sdq-cdef-${c.id}`} className="mb-1 block text-[13px] font-medium text-slate-800">What it means in this study</label>
                    <textarea id={`sdq-cdef-${c.id}`} rows={2} maxLength={1000} value={c.definition} onChange={e => edit({ ...doc, constructs: doc.constructs.map(x => (x.id === c.id ? { ...x, definition: e.target.value } : x)) })} className={field} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <fieldset>
                      <legend className="mb-1 text-[13px] font-medium text-slate-800">Measures objective</legend>
                      {doc.objectives.length === 0 ? <p className="text-[13px] text-slate-600">Add objectives above to link them.</p> : (
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          {doc.objectives.map((_, i) => (
                            <label key={i} className="inline-flex min-h-8 items-center gap-1.5 text-[13px] text-slate-800">
                              <input type="checkbox" className="accent-purple-accent" checked={c.objectiveNumbers.includes(i + 1)}
                                onChange={e => edit({ ...doc, constructs: doc.constructs.map(x => (x.id === c.id ? { ...x, objectiveNumbers: e.target.checked ? [...x.objectiveNumbers, i + 1].sort((a, b) => a - b) : x.objectiveNumbers.filter(n => n !== i + 1) } : x)) })} />
                              {i + 1}
                            </label>
                          ))}
                        </div>
                      )}
                    </fieldset>
                    <div>
                      <label htmlFor={`sdq-cscale-${c.id}`} className="mb-1 block text-[13px] font-medium text-slate-800">Response scale for these items</label>
                      <select id={`sdq-cscale-${c.id}`} value={items[0]?.scaleId ?? ''} disabled={items.length === 0} onChange={e => edit(setConstructScale(doc, c.id, e.target.value || null))} className={field}>
                        <option value="">Choose…</option>
                        {doc.scales.map((s, si) => <option key={s.id} value={s.id}>{s.name || `Scale ${si + 1}`}</option>)}
                      </select>
                    </div>
                  </div>
                  <ol className="space-y-2">
                    {items.map((item, ii) => (
                      <ItemRow key={item.id} item={item} number={ii + 1} error={marked(item.id)} canUp={ii > 0} canDown={ii < items.length - 1}
                        onChange={patch => edit(updateItem(doc, item.id, patch))} onMove={d => edit(moveItem(doc, item.id, d))} onRemove={() => edit({ ...doc, items: doc.items.filter(x => x.id !== item.id) })} />
                    ))}
                  </ol>
                  <button type="button" className={small} disabled={doc.items.length >= 200} onClick={() => edit(addScaleItem(doc, c.id))}><Plus size={16} aria-hidden="true" /> Add an item to {c.name || `construct ${ci + 1}`}</button>
                </div>
              )
            })}
            <button type="button" className={small} disabled={doc.constructs.length >= 30}
              onClick={() => edit({ ...doc, constructs: [...doc.constructs, { id: newId('c', doc.constructs.map(c => c.id)), name: '', definition: '', objectiveNumbers: [] }] })}><Plus size={16} aria-hidden="true" /> Add a construct</button>
          </section>

          <section aria-labelledby="sdq-other" className="space-y-3">
            <h2 id="sdq-other" className="text-[15px] font-semibold text-slate-900">5. Other questions</h2>
            <p className="text-[13px] text-slate-600">Demographic, screening and open-text questions. Ask only for what you will analyse.</p>
            <ol className="space-y-2">
              {otherItems.map((item, ii) => (
                <ItemRow key={item.id} item={item} number={ii + 1} error={marked(item.id)} canUp={ii > 0} canDown={ii < otherItems.length - 1}
                  onChange={patch => edit(updateItem(doc, item.id, patch))} onMove={d => edit(moveItem(doc, item.id, d))} onRemove={() => edit({ ...doc, items: doc.items.filter(x => x.id !== item.id) })} />
              ))}
            </ol>
            <div className="flex flex-wrap gap-2">
              {(['Demographic', 'Screening', 'OpenText'] as const).map(role => (
                <button key={role} type="button" className={small} disabled={doc.items.length >= 200} onClick={() => edit(addOtherItem(doc, role))}><Plus size={16} aria-hidden="true" /> {role === 'OpenText' ? 'Open-text question' : `${role} question`}</button>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <section aria-label="Save" className="rounded-xl border border-slate-200 p-4">
            <p className="text-[13px] text-slate-700" role="status">
              {!projectId ? 'Not stored: no project chosen.' : dirty ? 'You have unsaved changes.' : saved ? `Saved${projectTitle ? ` with ${projectTitle}` : ''}. Version ${server?.version}.` : 'Not saved yet.'}
            </p>
            {conflict ? (
              <p role="alert" className="mt-2 rounded-lg border border-red-300 bg-red-50 p-2.5 text-[13px] text-red-800">
                This questionnaire was changed in another window, so it was not saved. <button type="button" className="font-semibold underline" onClick={() => void load()}>Load the latest version</button> (your unsaved changes here will be lost).
              </p>
            ) : null}
            {failure ? <p role="alert" className="mt-2 rounded-lg border border-red-300 bg-red-50 p-2.5 text-[13px] font-medium text-red-800">{failure}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={!projectId || state === 'saving' || (!dirty && saved)} onClick={() => void save()}
                className="inline-flex min-h-10 items-center justify-center rounded-lg bg-purple-accent px-4 text-[14px] font-semibold text-white hover:bg-purple-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40 disabled:cursor-not-allowed disabled:opacity-60">
                {state === 'saving' ? 'Saving…' : 'Save questionnaire'}
              </button>
            </div>
          </section>

          <section aria-label="Checks" aria-live="polite" className="rounded-xl border border-slate-200 p-4">
            <h2 className="text-[15px] font-semibold text-slate-900">Checks</h2>
            <p className="mt-0.5 text-[12px] text-slate-600">Automatic and rule-based. They find structural faults and wording worth a second look. They cannot tell you whether the questionnaire measures what you intend.</p>
            {Object.keys(structure).length > 0 ? <p role="alert" className="mt-2 rounded-lg border border-red-300 bg-red-50 p-2.5 text-[13px] text-red-800">{Object.values(structure).join(' ')}</p> : null}
            {report ? (
              <>
                <p className="mt-2 text-[13px] font-medium text-slate-900">{counts.error} {counts.error === 1 ? 'error' : 'errors'}, {counts.warning} {counts.warning === 1 ? 'warning' : 'warnings'}, {counts.info} {counts.info === 1 ? 'note' : 'notes'} · {report.itemCount} {report.itemCount === 1 ? 'item' : 'items'}</p>
                {report.findings.length === 0 ? <p className="mt-1 text-[13px] text-slate-700">Nothing to report yet.</p> : (
                  <ul className="mt-2 max-h-[28rem] space-y-1.5 overflow-y-auto pr-1">
                    {report.findings.map((f, i) => (
                      <li key={i} className={cn('rounded-lg border p-2 text-[13px]', f.severity === 'error' ? 'border-red-300 bg-red-50 text-red-900' : f.severity === 'warning' ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-slate-200 bg-slate-50 text-slate-800')}>
                        <span className="flex items-start gap-1.5">
                          {f.severity === 'error' ? <XCircle size={14} className="mt-0.5 shrink-0" aria-hidden="true" /> : f.severity === 'warning' ? <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" /> : <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />}
                          <span><strong>{f.severity === 'error' ? 'Error' : f.severity === 'warning' ? 'Warning' : 'Note'}.</strong> {f.message}{' '}
                            {(f.itemIds.length > 0 || f.constructId || f.scaleId) ? <button type="button" className="font-medium underline" onClick={() => focusFinding(f)}>Show</button> : null}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : <p className="mt-2 text-[13px] text-slate-700">Checks appear here as you build.</p>}
          </section>

          <section aria-label="Codebook export" className="rounded-xl border border-slate-200 p-4">
            <h2 className="text-[15px] font-semibold text-slate-900">Codebook</h2>
            <p className="mt-0.5 text-[12px] text-slate-600">Variable names, labels, value labels, which items form each scale, and which are reverse-coded. Every row is marked as a draft.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className={small} disabled={!saved || dirty || !report?.canExport} onClick={() => void exportCodebook('csv')}>Download CSV</button>
              <button type="button" className={small} disabled={!saved || dirty || !report?.canExport} onClick={() => void exportCodebook('json')}>Download JSON</button>
            </div>
            <p className="mt-2 text-[12px] text-slate-600">{!saved ? 'Save the questionnaire first.' : dirty ? 'Save your changes first: the codebook is built from the saved version.' : !report?.canExport ? 'Fix the errors under Checks first. A codebook built now would be wrong.' : 'Built from the saved version.'}</p>
          </section>

          {saved ? (
            <PilotReliability projectId={projectId} ready={!dirty && !!report?.canExport}
              blockedReason={dirty ? 'Save your changes first: scales are scored from the saved version.' : !report?.canExport ? 'Fix the errors under Checks first.' : null} />
          ) : null}

          {saved ? (
            <section aria-label="Review and pilot" className="rounded-xl border border-slate-200 p-4">
              <h2 className="text-[15px] font-semibold text-slate-900">Review and pilot</h2>
              <p className="mt-0.5 text-[12px] text-slate-600">Record these yourself when they are done. They change the label on exports; the questionnaire remains a draft and is never described as valid.</p>
              {([['review', 'Content-validity review done', server?.contentValidityReviewedAt, 'reviewed'], ['pilot', 'Pilot test done', server?.pilotedAt, 'piloted']] as const).map(([key, label, at, flag]) => (
                <div key={key} className="mt-3">
                  <label className="flex min-h-8 items-center gap-2 text-[14px] text-slate-900">
                    <input type="checkbox" className="accent-purple-accent" checked={!!at} onChange={e => void setStatus({ [flag]: e.target.checked })} />
                    {label}{at ? <span className="text-[12px] text-slate-600"> · {new Date(at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}</span> : null}
                  </label>
                  <label htmlFor={`sdq-note-${key}`} className="sr-only">{label}: note</label>
                  <input id={`sdq-note-${key}`} value={notes[key]} maxLength={500} placeholder="Who, how many, when" onChange={e => setNotes(n => ({ ...n, [key]: e.target.value }))} onBlur={() => { if (at) void setStatus({}) }} className={cn(field, 'mt-1 text-[13px]')} />
                </div>
              ))}
            </section>
          ) : null}

          {saved ? (
            <section aria-label="Delete" className="rounded-xl border border-slate-200 p-4">
              {confirmDelete ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] text-slate-800">Delete this questionnaire permanently?</span>
                  <button type="button" onClick={() => void remove()} className="min-h-9 rounded-lg bg-red-700 px-3 text-[13px] font-semibold text-white hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400">Delete permanently</button>
                  <button type="button" className={small} onClick={() => setConfirmDelete(false)}>Cancel</button>
                </div>
              ) : <button type="button" className={small} onClick={() => setConfirmDelete(true)}>Delete questionnaire</button>}
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  )
}

/**
 * A whole-number box that keeps what is being typed (including a lone minus sign) and passes a value on only once
 * it is a whole number. Missing-value codes such as -99 need the minus sign to be typeable.
 */
function WholeNumber({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const [text, setText] = useState(String(value))
  useEffect(() => { setText(current => (Number(current) === value && current.trim() !== '' ? current : String(value))) }, [value])
  const valid = /^-?\d{1,6}$/.test(text.trim())
  return (
    <input aria-label={label} inputMode="numeric" value={text} aria-invalid={!valid} className={cn(field, 'w-20', !valid && 'border-red-600')}
      onChange={e => { setText(e.target.value); if (/^-?\d{1,6}$/.test(e.target.value.trim())) onChange(Number(e.target.value.trim())) }}
      onBlur={() => { if (!valid) setText(String(value)) }} />
  )
}

function PointList({ legend, valueLabel, points, max, addLabel, startAt, onChange }: {
  legend: string; valueLabel: string; points: ScalePoint[]; max: number; addLabel: string; startAt?: number; onChange: (points: ScalePoint[]) => void
}) {
  const next = points.length === 0 ? (startAt ?? 1) : startAt !== undefined ? Math.min(...points.map(p => p.value)) - 1 : Math.max(...points.map(p => p.value)) + 1
  return (
    <fieldset>
      <legend className="mb-1 text-[13px] font-medium text-slate-800">{legend}</legend>
      <ul className="space-y-1.5">
        {points.map((p, i) => (
          <li key={i} className="flex items-center gap-2">
            <WholeNumber label={`${legend}: ${valueLabel.toLowerCase()} ${i + 1}`} value={p.value} onChange={value => onChange(points.map((x, j) => (j === i ? { ...x, value } : x)))} />
            <input aria-label={`${legend}: label ${i + 1}`} value={p.label} maxLength={80} placeholder="Label" className={field} onChange={e => onChange(points.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            <button type="button" className={icon} aria-label={`${legend}: remove ${i + 1}`} onClick={() => onChange(points.filter((_, j) => j !== i))}><Trash2 size={16} aria-hidden="true" /></button>
          </li>
        ))}
      </ul>
      <button type="button" className={cn(small, 'mt-1.5')} disabled={points.length >= max} onClick={() => onChange([...points, { value: next, label: '' }])}><Plus size={16} aria-hidden="true" /> {addLabel}</button>
    </fieldset>
  )
}

function ItemRow({ item, number, error, canUp, canDown, onChange, onMove, onRemove }: {
  item: QuestionnaireItem; number: number; error: boolean; canUp: boolean; canDown: boolean
  onChange: (patch: Partial<QuestionnaireItem>) => void; onMove: (direction: -1 | 1) => void; onRemove: () => void
}) {
  const scale = item.role === 'Scale'
  const what = scale ? `Item ${number}` : `Question ${number}`
  return (
    <li id={`sdq-item-${item.id}`} className={cn('rounded-lg border p-2.5', error ? 'border-red-400 bg-red-50/40' : 'border-slate-200')}>
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <label htmlFor={`sdq-text-${item.id}`} className="mb-1 block text-[12px] font-medium text-slate-700">{what} wording{error ? <span className="ml-2 font-semibold text-red-700">Has an error: see Checks</span> : null}</label>
          <textarea id={`sdq-text-${item.id}`} rows={2} maxLength={500} value={item.text} onChange={e => onChange({ text: e.target.value })} className={field} />
        </div>
        <div className="mt-5 flex gap-1">
          <button type="button" className={icon} disabled={!canUp} aria-label={`Move ${what.toLowerCase()} up`} onClick={() => onMove(-1)}><ArrowUp size={16} aria-hidden="true" /></button>
          <button type="button" className={icon} disabled={!canDown} aria-label={`Move ${what.toLowerCase()} down`} onClick={() => onMove(1)}><ArrowDown size={16} aria-hidden="true" /></button>
          <button type="button" className={icon} aria-label={`Remove ${what.toLowerCase()}`} onClick={onRemove}><Trash2 size={16} aria-hidden="true" /></button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-2">
        <div className="w-44">
          <label htmlFor={`sdq-var-${item.id}`} className="mb-1 block text-[12px] font-medium text-slate-700">Variable name</label>
          <input id={`sdq-var-${item.id}`} value={item.variableName} maxLength={64} onChange={e => onChange({ variableName: e.target.value })} className={cn(field, 'font-mono text-[13px]')} />
        </div>
        {scale ? (
          <label className="inline-flex min-h-9 items-center gap-1.5 text-[13px] text-slate-800"><input type="checkbox" className="accent-purple-accent" checked={item.reverseCoded} onChange={e => onChange({ reverseCoded: e.target.checked })} /> Reverse-coded</label>
        ) : (
          <div className="w-44">
            <label htmlFor={`sdq-role-${item.id}`} className="mb-1 block text-[12px] font-medium text-slate-700">Type</label>
            <select id={`sdq-role-${item.id}`} value={item.role} onChange={e => onChange({ role: e.target.value as ItemRole, options: e.target.value === 'OpenText' ? [] : item.options })} className={field}>
              <option value="Demographic">Demographic</option><option value="Screening">Screening</option><option value="OpenText">Open text</option>
            </select>
          </div>
        )}
        <label className="inline-flex min-h-9 items-center gap-1.5 text-[13px] text-slate-800"><input type="checkbox" className="accent-purple-accent" checked={item.required} onChange={e => onChange({ required: e.target.checked })} /> Required</label>
      </div>
      {!scale && item.role !== 'OpenText' ? (
        <div className="mt-2"><PointList legend="Answer options" valueLabel="Value" points={item.options} max={20} addLabel="Add an option" onChange={options => onChange({ options })} /></div>
      ) : null}
    </li>
  )
}
