import { useEffect, useState } from 'react'
import { errorMessage, qualApi, type QualChecklist, type QualChecklistItem, type QualStudy } from '../../api/qualitativeAnalysis'
import { cn } from '../../lib/utils'
import { Skeleton } from '../ui/Skeleton'
import { Notice, Pill, PrimaryButton, SecondaryButton, Section } from './ui'

type Id = 'coreq' | 'srqr'

/**
 * COREQ and SRQR. Item names follow the published checklists; the guidance is our own summary, and the published
 * checklist is cited for the authoritative wording. Where the study's records can answer part of an item, that is
 * offered to copy into the answer; the researcher writes every answer.
 */
export function ChecklistsTab({ study }: { study: QualStudy }) {
  const [id, setId] = useState<Id>('coreq')
  const [list, setList] = useState<QualChecklist | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { setList(null); setError(null); qualApi.checklist(study.id, id).then(setList).catch(e => setError(errorMessage(e, 'The checklist could not be loaded.'))) }, [study.id, id])

  const replace = (item: QualChecklistItem) => setList(l => l && ({ ...l, items: l.items.map(i => i.number === item.number ? item : i), answered: l.items.map(i => i.number === item.number ? item : i).filter(i => i.answer || i.notApplicable).length }))
  const download = async () => { setBusy(true); try { await qualApi.download(study.id, id) } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) } }

  const domains = list ? [...new Set(list.items.map(i => i.domain))] : []
  return (
    <Section title="Reporting checklists" id="qa-checklists" actions={
      <div className="flex gap-2">
        {(['coreq', 'srqr'] as const).map(c => (
          <button key={c} type="button" aria-pressed={id === c} onClick={() => setId(c)}
            className={cn('rounded-lg border px-3 py-1.5 text-[13px] font-medium', id === c ? 'border-purple-deep bg-purple-50 text-purple-deep' : 'border-slate-300 text-slate-800')}>{c.toUpperCase()}</button>
        ))}
        <SecondaryButton disabled={busy || !list} onClick={download}>{busy ? 'Preparing…' : 'Download (.csv)'}</SecondaryButton>
      </div>}>
      {error && <Notice tone="error">{error}</Notice>}
      {list === null ? !error && <Skeleton lines={6} tone="light" /> : (
        <>
          <p className="text-[14px] font-medium text-slate-900">{list.name}</p>
          <p className="mt-1 max-w-3xl text-[13px] text-slate-800">{list.note}</p>
          <p className="mt-1 max-w-3xl text-[12px] text-slate-700">{list.citation}</p>
          <p className="mt-2 text-[13px] text-slate-800">{list.answered} of {list.total} items answered or marked not applicable.</p>
          {domains.map(d => (
            <div key={d} className="mt-4">
              <h3 className="text-[15px] font-semibold text-slate-900">{d}</h3>
              <ul className="mt-2 space-y-2">{list.items.filter(i => i.domain === d).map(i => <Item key={`${id}-${i.number}`} studyId={study.id} checklist={id} item={i} onSaved={replace} />)}</ul>
            </div>
          ))}
        </>
      )}
    </Section>
  )
}

function Item({ studyId, checklist, item, onSaved }: { studyId: string; checklist: Id; item: QualChecklistItem; onSaved: (i: QualChecklistItem) => void }) {
  const [answer, setAnswer] = useState(item.answer ?? '')
  const [na, setNa] = useState(item.notApplicable)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dirty = answer !== (item.answer ?? '') || na !== item.notApplicable
  const save = async () => {
    setBusy(true); setError(null)
    try { const saved = await qualApi.saveChecklistAnswer(studyId, checklist, item.number, { answer, notApplicable: na }); onSaved(saved) } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  const done = !!item.answer || item.notApplicable
  return (
    <li className="rounded-xl border border-slate-200 p-3 text-[14px]">
      <p className="flex flex-wrap items-center gap-2"><span className="font-semibold text-slate-900">{item.number}. {item.title}</span>{done ? <Pill tone="emerald">{item.notApplicable ? 'Not applicable' : 'Answered'}</Pill> : <Pill>Open</Pill>}</p>
      <p className="mt-0.5 text-[13px] text-slate-800">{item.guidance}</p>
      {item.suggestion && (
        <div className="mt-2 rounded-lg bg-slate-50 p-2 text-[13px] text-slate-800">
          <span className="font-medium">From your study’s records</span> <span className="text-slate-700">({item.suggestionSource})</span>: {item.suggestion}
          {answer.trim() === '' && <button type="button" className="ml-2 text-[12px] font-medium underline" onClick={() => setAnswer(item.suggestion!)}>Use as a starting point</button>}
        </div>
      )}
      <label htmlFor={`qa-cl-${checklist}-${item.number}`} className="sr-only">Your answer to item {item.number}</label>
      <textarea id={`qa-cl-${checklist}-${item.number}`} rows={2} maxLength={4000} value={answer} onChange={e => setAnswer(e.target.value)} disabled={na}
        className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-[14px] text-slate-900 outline-none focus:border-purple-accent focus-visible:ring-2 focus-visible:ring-purple-accent/30 disabled:bg-slate-50"
        placeholder="Your answer, or where in your thesis this is reported" />
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-[13px] text-slate-800"><input type="checkbox" checked={na} onChange={e => setNa(e.target.checked)} /> Not applicable to this study</label>
        <PrimaryButton disabled={!dirty || busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</PrimaryButton>
      </div>
      {error && <Notice tone="error" className="mt-2">{error}</Notice>}
    </li>
  )
}
