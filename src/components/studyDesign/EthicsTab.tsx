import { useCallback, useEffect, useState } from 'react'
import { Info } from 'lucide-react'
import { studyDesignApi, type EthicsChecklist, type EthicsEntry, type EthicsState } from '../../api/studyDesign'
import type { ApiFieldError } from '../../lib/studyDesign'
import { Skeleton } from '../ui/Skeleton'

interface ApiFailure { code?: string; details?: ApiFieldError[]; response?: { status?: number } }
type Edits = Record<string, { state: EthicsState; note: string }>

const STATES: { id: EthicsState; label: string }[] = [
  { id: 'NotStarted', label: 'Not started' },
  { id: 'InProgress', label: 'In progress' },
  { id: 'Done', label: 'Done' },
  { id: 'NotApplicable', label: 'Not applicable' },
]

const toEdits = (c: EthicsChecklist): Edits =>
  Object.fromEntries(c.groups.flatMap(g => g.items).map(i => [i.id, { state: i.state, note: i.note }]))

/**
 * The ethics-readiness checklist. The items, the header and every linked fact come from the server. The student
 * sets each state; nothing here sets one for them, adds up a score, or says the study is ready.
 */
export function EthicsTab({ projectId }: { projectId: string }) {
  const [server, setServer] = useState<EthicsChecklist | null>(null)
  const [edits, setEdits] = useState<Edits>({})
  const [dirty, setDirty] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({})
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!projectId) { setServer(null); return }
    setLoadFailed(false); setConflict(false); setFailure(null); setItemErrors({}); setSavedAt(null)
    let cancelled = false
    studyDesignApi.ethicsChecklist(projectId)
      .then(c => { if (!cancelled) { setServer(c); setEdits(toEdits(c)); setDirty(false) } })
      .catch(() => { if (!cancelled) { setServer(null); setLoadFailed(true) } })
    return () => { cancelled = true }
  }, [projectId])
  useEffect(() => load(), [load])

  const change = (id: string, patch: Partial<{ state: EthicsState; note: string }>) => {
    setEdits(e => ({ ...e, [id]: { ...e[id], ...patch } }))
    setDirty(true); setSavedAt(null)
    setItemErrors(e => { const { [id]: _removed, ...rest } = e; return rest })
  }

  const save = async () => {
    if (!server) return
    setSaving(true); setFailure(null); setItemErrors({})
    const entries: EthicsEntry[] = Object.entries(edits).map(([itemId, v]) => ({ itemId, state: v.state, note: v.note.trim() || null }))
    try {
      const saved = await studyDesignApi.saveEthicsChecklist(projectId, entries, server.version)
      setServer(saved); setEdits(toEdits(saved)); setDirty(false)
      setSavedAt(new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }))
    } catch (err) {
      const e = err as ApiFailure
      if (e?.code === 'STUDY_DESIGN_VERSION_CONFLICT') setConflict(true)
      else if (e?.code === 'STUDY_DESIGN_VALIDATION') {
        setItemErrors(Object.fromEntries((e.details ?? []).map(d => [d.field, d.message])))
        setFailure('The checklist was not saved. See the message beside the item.')
      } else if (e?.response?.status === 429) setFailure('Too many requests in a short time. Wait a minute and save again. Your changes are still here.')
      else setFailure('The checklist could not be saved. Check your connection and try again. Your changes are still here.')
    } finally { setSaving(false) }
  }

  if (!projectId) return <p className="text-[14px] text-slate-800">Choose a project above to keep an ethics checklist for it.</p>
  if (loadFailed) {
    return <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-[14px] text-red-800">
      The checklist could not be loaded. <button type="button" onClick={() => load()} className="font-semibold underline">Try again</button>
    </div>
  }
  if (!server) return <Skeleton lines={8} tone="light" />

  const linksFor = (id: string) => server.links.filter(l => l.itemId === id)
  const count = (s: EthicsState) => Object.values(edits).filter(v => v.state === s).length

  return (
    <div className="max-w-3xl space-y-5">
      <div className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-[14px] text-slate-900">
        <p className="font-semibold">{server.header}</p>
        <p className="mt-1 text-[13px] text-slate-700">{server.wordingNotice}</p>
      </div>

      <p className="text-[13px] text-slate-700" aria-live="polite">
        {STATES.map(s => `${count(s.id)} ${s.label.toLowerCase()}`).join(' · ')}
      </p>

      {server.groups.map(g => (
        <fieldset key={g.id} className="rounded-xl border border-slate-200 p-4">
          <legend className="px-1 text-[15px] font-semibold text-slate-900">{g.title}</legend>
          <ul className="space-y-4">
            {g.items.map(item => {
              const v = edits[item.id] ?? { state: 'NotStarted' as EthicsState, note: '' }
              const showNote = v.state !== 'NotStarted' || v.note.length > 0
              const error = itemErrors[item.id]
              return (
                <li key={item.id} className="border-t border-slate-100 pt-3 first:border-t-0 first:pt-0">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p id={`sde-text-${item.id}`} className="text-[14px] leading-snug text-slate-900">{item.text}</p>
                      {item.basis ? <p className="mt-0.5 text-[12px] text-slate-600">Source: {item.basis}</p> : null}
                    </div>
                    <select aria-labelledby={`sde-text-${item.id}`} value={v.state} onChange={e => change(item.id, { state: e.target.value as EthicsState })}
                      className="w-full shrink-0 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[13px] text-slate-900 outline-none focus:border-purple-accent focus-visible:ring-2 focus-visible:ring-purple-accent/30 sm:w-40">
                      {STATES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </div>
                  {linksFor(item.id).map((l, i) => (
                    <p key={i} className="mt-1.5 flex items-start gap-1.5 rounded-md bg-slate-50 p-2 text-[12px] leading-snug text-slate-700">
                      <Info size={13} className="mt-0.5 shrink-0" aria-hidden="true" /><span>{l.text}</span>
                    </p>
                  ))}
                  {showNote ? (
                    <div className="mt-2">
                      <label htmlFor={`sde-note-${item.id}`} className="mb-0.5 block text-[12px] font-medium text-slate-700">
                        {v.state === 'NotApplicable' ? 'Why this does not apply (required)' : 'Note (optional)'}
                      </label>
                      <textarea id={`sde-note-${item.id}`} value={v.note} maxLength={500} rows={2} onChange={e => change(item.id, { note: e.target.value })}
                        aria-invalid={error ? true : undefined} aria-describedby={error ? `sde-err-${item.id}` : undefined}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[13px] text-slate-900 outline-none focus:border-purple-accent focus-visible:ring-2 focus-visible:ring-purple-accent/30" />
                    </div>
                  ) : null}
                  {error ? <p id={`sde-err-${item.id}`} role="alert" className="mt-1 text-[13px] font-medium text-red-700">{error}</p> : null}
                </li>
              )
            })}
          </ul>
        </fieldset>
      ))}

      {conflict ? (
        <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-[14px] text-amber-950">
          This checklist was changed in another window, so it was not saved.{' '}
          <button type="button" onClick={() => load()} className="font-semibold underline">Load the latest version</button> (your unsaved changes here will be lost).
        </div>
      ) : null}
      {failure ? <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-2.5 text-[13px] font-medium text-red-800">{failure}</p> : null}

      <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center gap-3 border-t border-slate-200 bg-white px-1 py-3">
        <button type="button" disabled={!dirty || saving || conflict} onClick={() => void save()}
          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-purple-accent px-4 text-[14px] font-semibold text-white hover:bg-purple-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40 disabled:cursor-not-allowed disabled:opacity-50">
          {saving ? 'Saving…' : 'Save checklist'}
        </button>
        <p className="text-[13px] text-slate-700" aria-live="polite">
          {dirty ? 'You have unsaved changes.' : savedAt ? `Saved at ${savedAt}.` : server.version === 0 ? 'Nothing saved yet.' : 'All changes saved.'}
        </p>
      </div>
    </div>
  )
}
