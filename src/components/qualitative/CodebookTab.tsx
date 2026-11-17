import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { errorMessage, qualApi, type QualCode, type QualExcerpt, type QualStudy } from '../../api/qualitativeAnalysis'
import { PROVENANCE_LABELS } from '../../lib/qualitative'
import { Skeleton } from '../ui/Skeleton'
import { useConfirm } from '../ui/ConfirmDialog'
import { DangerButton, Notice, Pill, PrimaryButton, SecondaryButton, Section, inputClass, labelClass } from './ui'

/** The codebook: every code with what it means and how often it has been used, nested up to four levels. */
export function CodebookTab({ study }: { study: QualStudy }) {
  const [codes, setCodes] = useState<QualCode[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const load = () => qualApi.listCodes(study.id).then(setCodes).catch(e => setError(errorMessage(e, 'The codebook could not be loaded.')))
  useEffect(() => { void load() }, [study.id])

  const visible = useMemo(() => (codes ?? []).filter(c => showInactive || c.status === 'Active'), [codes, showInactive])
  const tree = useMemo(() => {
    const byParent = new Map<string | null, QualCode[]>()
    for (const c of visible) { const p = c.parentId && visible.some(v => v.id === c.parentId) ? c.parentId : null; byParent.set(p, [...(byParent.get(p) ?? []), c]) }
    for (const list of byParent.values()) list.sort((a, b) => a.name.localeCompare(b.name))
    const out: { code: QualCode; depth: number }[] = []
    const walk = (parent: string | null, depth: number) => { for (const c of byParent.get(parent) ?? []) { out.push({ code: c, depth }); walk(c.id, depth + 1) } }
    walk(null, 0)
    return out
  }, [visible])

  return (
    <>
      <Section title="Codebook" id="qa-codebook" actions={
        <label className="flex items-center gap-1.5 text-[13px] text-slate-800"><input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} /> Show retired and merged codes</label>}>
        <p className="mb-2 text-[13px] text-slate-800">Counts are for your coding of this data. They describe what you have coded, not how important a code is.</p>
        {error && <Notice tone="error" className="mb-2">{error}</Notice>}
        {codes === null ? <Skeleton lines={4} tone="light" /> : tree.length === 0 ? <p className="text-[14px] text-slate-700">No codes yet. Create one below, or while coding a transcript.</p> : (
          <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200">
            {tree.map(({ code, depth }) => (
              <li key={code.id} style={{ paddingLeft: `${0.75 + depth * 1.25}rem` }} className="py-2 pr-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <button type="button" onClick={() => setOpenId(openId === code.id ? null : code.id)} aria-expanded={openId === code.id}
                    className="min-w-0 text-left text-[15px] font-semibold text-purple-deep underline [overflow-wrap:anywhere]">{code.name}</button>
                  <span className="flex flex-wrap items-center gap-1.5 text-[13px] text-slate-700">
                    {code.status !== 'Active' && <Pill tone="amber">{code.status}</Pill>}
                    {code.provenance !== 'Human' && <Pill tone="purple">{PROVENANCE_LABELS[code.provenance] ?? code.provenance}</Pill>}
                    {code.applications} passage{code.applications === 1 ? '' : 's'} · {code.participants} participant{code.participants === 1 ? '' : 's'} · {code.transcripts} transcript{code.transcripts === 1 ? '' : 's'}
                  </span>
                </div>
                {code.definition && <p className="mt-0.5 text-[13px] text-slate-800">{code.definition}</p>}
                {openId === code.id && <CodeDetail code={code} all={codes ?? []} onChanged={load} onClose={() => setOpenId(null)} />}
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Add a code" id="qa-add-code"><NewCode studyId={study.id} codes={codes ?? []} onCreated={load} /></Section>
    </>
  )
}

function NewCode({ studyId, codes, onCreated }: { studyId: string; codes: QualCode[]; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [definition, setDefinition] = useState('')
  const [parentId, setParentId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(null)
    if (!name.trim()) { setError('A code needs a name.'); return }
    setBusy(true)
    try { await qualApi.createCode(studyId, { name: name.trim(), definition: definition.trim(), parentId: parentId || null }); setName(''); setDefinition(''); setParentId(''); onCreated() }
    catch (err) { setError(errorMessage(err, 'The code could not be created.')) } finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="max-w-2xl space-y-3 rounded-xl border border-slate-200 p-4" noValidate>
      <div><label htmlFor="qa-code-name" className={labelClass}>Name</label><input id="qa-code-name" value={name} maxLength={80} onChange={e => setName(e.target.value)} className={inputClass} /></div>
      <div><label htmlFor="qa-code-def" className={labelClass}>Definition (optional)</label><textarea id="qa-code-def" value={definition} maxLength={2000} rows={2} onChange={e => setDefinition(e.target.value)} className={inputClass} /></div>
      <div>
        <label htmlFor="qa-code-parent" className={labelClass}>Under (optional)</label>
        <select id="qa-code-parent" value={parentId} onChange={e => setParentId(e.target.value)} className={inputClass}>
          <option value="">Top level</option>
          {codes.filter(c => c.status === 'Active').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <p className="text-[12px] text-slate-700">Code names and definitions are stored as you type them. Do not put a participant’s name in them.</p>
      {error && <Notice tone="error">{error}</Notice>}
      <PrimaryButton type="submit" disabled={busy}>{busy ? 'Adding…' : 'Add code'}</PrimaryButton>
    </form>
  )
}

function CodeDetail({ code, all, onChanged, onClose }: { code: QualCode; all: QualCode[]; onChanged: () => void; onClose: () => void }) {
  const [name, setName] = useState(code.name)
  const [definition, setDefinition] = useState(code.definition)
  const [inclusion, setInclusion] = useState(code.inclusionNotes)
  const [exclusion, setExclusion] = useState(code.exclusionNotes)
  const [parentId, setParentId] = useState(code.parentId ?? '')
  const [mergeInto, setMergeInto] = useState('')
  const [excerpts, setExcerpts] = useState<QualExcerpt[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { confirm: ask, dialog } = useConfirm()
  useEffect(() => { qualApi.excerpts(code.id).then(setExcerpts).catch(() => setExcerpts([])) }, [code.id])

  const act = async (f: () => Promise<unknown>, close = false) => {
    setBusy(true); setError(null)
    try { await f(); onChanged(); if (close) onClose() } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  const editable = code.status !== 'Merged'
  const others = all.filter(c => c.id !== code.id && c.status === 'Active')

  return (
    <div className="mt-2 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      {dialog}
      {editable && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label htmlFor={`qa-n-${code.id}`} className={labelClass}>Name</label><input id={`qa-n-${code.id}`} value={name} maxLength={80} onChange={e => setName(e.target.value)} className={inputClass} /></div>
          <div>
            <label htmlFor={`qa-p-${code.id}`} className={labelClass}>Under</label>
            <select id={`qa-p-${code.id}`} value={parentId} onChange={e => setParentId(e.target.value)} className={inputClass}>
              <option value="">Top level</option>
              {others.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2"><label htmlFor={`qa-d-${code.id}`} className={labelClass}>Definition</label><textarea id={`qa-d-${code.id}`} rows={2} maxLength={2000} value={definition} onChange={e => setDefinition(e.target.value)} className={inputClass} /></div>
          <div><label htmlFor={`qa-i-${code.id}`} className={labelClass}>Use it when</label><textarea id={`qa-i-${code.id}`} rows={2} maxLength={2000} value={inclusion} onChange={e => setInclusion(e.target.value)} className={inputClass} /></div>
          <div><label htmlFor={`qa-e-${code.id}`} className={labelClass}>Do not use it when</label><textarea id={`qa-e-${code.id}`} rows={2} maxLength={2000} value={exclusion} onChange={e => setExclusion(e.target.value)} className={inputClass} /></div>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <PrimaryButton disabled={busy} onClick={() => act(() => qualApi.updateCode(code.id, { name, definition, inclusionNotes: inclusion, exclusionNotes: exclusion, ...(parentId ? { parentId } : { clearParent: true }) }))}>Save changes</PrimaryButton>
            <SecondaryButton disabled={busy} onClick={() => act(() => qualApi.updateCode(code.id, { status: code.status === 'Active' ? 'Retired' : 'Active' }))}>{code.status === 'Active' ? 'Retire' : 'Make active again'}</SecondaryButton>
            {code.applications === 0 && <DangerButton disabled={busy} onClick={async () => { if (await ask({ title: `Delete “${code.name}”?`, message: 'The code has no coded passages. This cannot be undone.', confirmLabel: 'Delete code', tone: 'danger' })) await act(() => qualApi.deleteCode(code.id), true) }}>Delete</DangerButton>}
          </div>
          {code.status === 'Active' && others.length > 0 && (
            <div className="sm:col-span-2">
              <label htmlFor={`qa-m-${code.id}`} className={labelClass}>Merge into another code</label>
              <div className="flex gap-2">
                <select id={`qa-m-${code.id}`} value={mergeInto} onChange={e => setMergeInto(e.target.value)} className={inputClass}>
                  <option value="">Choose…</option>
                  {others.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <SecondaryButton disabled={!mergeInto || busy} onClick={async () => { if (await ask({ title: `Merge “${code.name}” into “${others.find(o => o.id === mergeInto)?.name}”?`, message: 'Its passages, quotes and memos move across. This is recorded and cannot be undone.', confirmLabel: 'Merge codes', tone: 'warning' })) await act(() => qualApi.mergeCode(code.id, mergeInto), true) }}>Merge</SecondaryButton>
              </div>
            </div>
          )}
        </div>
      )}
      {!editable && <p className="text-[13px] text-slate-800">Merged into “{all.find(c => c.id === code.mergedIntoId)?.name ?? 'another code'}”. Kept so the record of the analysis stays complete.</p>}
      {error && <Notice tone="error">{error}</Notice>}
      <div>
        <h4 className="text-[14px] font-semibold text-slate-900">Coded passages</h4>
        {excerpts === null ? <Skeleton lines={2} tone="light" /> : excerpts.length === 0 ? <p className="text-[13px] text-slate-700">None.</p> : (
          <ul className="mt-1 max-h-80 space-y-1.5 overflow-y-auto">
            {excerpts.map(x => (
              <li key={x.applicationId} className="rounded border border-slate-200 bg-white p-2 text-[13px] text-slate-900">
                “{x.text}” <span className="text-slate-700">— {x.pseudonym ?? x.role}, {x.transcriptLabel}, turn {x.segmentOrdinal + 1}</span>
                {x.needsReview && <> <Pill tone="amber">Check: text changed</Pill></>}
                {x.role !== 'Participant' && <> <Pill>Not participant speech</Pill></>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
