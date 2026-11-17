import { useEffect, useState } from 'react'
import { errorMessage, qualApi, type QualCode, type QualEvidenceList, type QualStudy } from '../../api/qualitativeAnalysis'
import { Skeleton } from '../ui/Skeleton'
import { Notice, Pill, Section, inputClass, labelClass } from './ui'

/**
 * Quotes kept as evidence. Each is checked against the transcript every time this list loads; one that no longer
 * matches is shown without its words and must be selected again.
 */
export function EvidenceTab({ study }: { study: QualStudy }) {
  const [codes, setCodes] = useState<QualCode[]>([])
  const [codeId, setCodeId] = useState('')
  const [list, setList] = useState<QualEvidenceList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = () => { setError(null); setList(null); qualApi.evidence(study.id, codeId || undefined).then(setList).catch(e => setError(errorMessage(e, 'The quotes could not be loaded.'))) }
  useEffect(() => { qualApi.listCodes(study.id).then(setCodes).catch(() => setCodes([])) }, [study.id])
  useEffect(load, [study.id, codeId])

  const remove = async (id: string) => { try { await qualApi.deleteEvidence(id); load() } catch (e) { setError(errorMessage(e)) } }

  return (
    <Section title="Quotes" id="qa-quotes">
      <p className="mb-2 text-[13px] text-slate-800">To keep a quote, select it while coding a transcript and choose “Keep as a quote”. Only participants’ own words can be kept.</p>
      <div className="mb-3 max-w-sm">
        <label htmlFor="qa-quote-code" className={labelClass}>Code</label>
        <select id="qa-quote-code" value={codeId} onChange={e => setCodeId(e.target.value)} className={inputClass}>
          <option value="">All quotes</option>
          {codes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {list === null && !error ? <Skeleton lines={4} tone="light" /> : list && (
        <>
          <p className="mb-2 text-[13px] text-slate-800">
            {list.verified} verified{list.notVerified > 0 ? `, ${list.notVerified} not verified` : ''}, from {list.participantsQuoted} participant{list.participantsQuoted === 1 ? '' : 's'}. {list.note}
          </p>
          {list.quotes.length === 0 ? <p className="text-[14px] text-slate-700">No quotes kept yet.</p> : (
            <ul className="space-y-2">
              {list.quotes.map(q => (
                <li key={q.id} className="rounded-xl border border-slate-200 p-3 text-[14px]">
                  {q.state === 'Verified' ? (
                    <blockquote className="text-slate-900">“{q.text}”</blockquote>
                  ) : (
                    <p className="text-amber-950"><Pill tone="amber">Not verified</Pill> {q.problem}</p>
                  )}
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-slate-700">
                    <span>{q.pseudonym ?? 'Participant'} · {q.transcriptLabel}{q.segmentOrdinal !== null ? `, turn ${q.segmentOrdinal + 1}` : ''}</span>
                    {q.codeName && <Pill tone="purple">{q.codeName}</Pill>}
                    {q.state === 'Verified' && <Pill tone="emerald">Verified word for word</Pill>}
                    <button type="button" className="text-[12px] font-medium text-red-800 underline" onClick={() => remove(q.id)}>Remove</button>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Section>
  )
}
