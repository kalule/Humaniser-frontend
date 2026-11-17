import { useEffect, useState } from 'react'
import { errorMessage, qualApi, type QualStats, type QualStudy } from '../../api/qualitativeAnalysis'
import { percent } from '../../lib/qualitative'
import { Skeleton } from '../ui/Skeleton'
import { Notice, Section } from './ui'

/** Descriptive counts, computed from your stored coding each time. No ranking, no verdict, no saturation claim. */
export function StatsTab({ study }: { study: QualStudy }) {
  const [stats, setStats] = useState<QualStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { qualApi.stats(study.id).then(setStats).catch(e => setError(errorMessage(e, 'The counts could not be loaded.'))) }, [study.id])

  if (error) return <Notice tone="error" className="mt-6">{error}</Notice>
  if (!stats) return <div className="mt-6"><Skeleton lines={6} tone="light" /></div>
  const n = stats.participantsInStudy

  return (
    <>
      <Notice className="mt-6">{stats.note}</Notice>
      <Section title="Overview" id="qa-overview">
        <dl className="grid gap-3 sm:grid-cols-4">
          {[['Participants', n], ['Transcripts ready', stats.transcriptsReady], ['Active codes', stats.activeCodes], ['Coded passages', stats.totalApplications]].map(([k, v]) => (
            <div key={k as string} className="rounded-xl border border-slate-200 p-3"><dt className="text-[13px] text-slate-700">{k}</dt><dd className="text-[20px] font-semibold text-slate-900">{v}</dd></div>
          ))}
        </dl>
        <p className="mt-2 text-[13px] text-slate-800">{stats.participantsWithAnyCode} of {n} participant{n === 1 ? ' has' : 's have'} at least one coded passage.</p>
      </Section>

      <Section title="Codes" id="qa-code-counts">
        {stats.codes.length === 0 ? <p className="text-[14px] text-slate-700">Nothing coded yet.</p> : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-[14px]">
              <caption className="sr-only">Counts per code</caption>
              <thead className="bg-slate-50 text-[13px] text-slate-800"><tr>
                <th scope="col" className="px-3 py-2">Code</th><th scope="col" className="px-3 py-2">Passages</th><th scope="col" className="px-3 py-2">Turns</th><th scope="col" className="px-3 py-2">Participants</th><th scope="col" className="px-3 py-2">Transcripts</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-200">
                {stats.codes.map(c => (
                  <tr key={c.codeId}>
                    <th scope="row" className="px-3 py-2 font-medium text-slate-900">{c.name}{c.status !== 'Active' && <span className="text-[12px] font-normal text-slate-700"> ({c.status.toLowerCase()})</span>}</th>
                    <td className="px-3 py-2">{c.applications}</td>
                    <td className="px-3 py-2">{c.segments}{c.segments !== c.participantSegments && <span className="text-[12px] text-slate-700"> ({c.participantSegments} participant)</span>}</td>
                    <td className="px-3 py-2">{c.participants} of {n}</td>
                    <td className="px-3 py-2">{c.transcripts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {stats.coOccurrence.length > 0 && (
        <Section title="Codes used on the same passage" id="qa-cooccur">
          <p className="mb-2 text-[13px] text-slate-800">Participant turns in which both codes cover at least one shared character.</p>
          <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 text-[14px]">
            {stats.coOccurrence.slice(0, 50).map(p => <li key={p.codeA + p.codeB} className="flex justify-between gap-3 px-3 py-2"><span>{p.nameA} + {p.nameB}</span><span>{p.segments} turn{p.segments === 1 ? '' : 's'}</span></li>)}
          </ul>
        </Section>
      )}

      <Section title="How much of each transcript is coded" id="qa-coverage">
        {stats.coverage.length === 0 ? <p className="text-[14px] text-slate-700">No confirmed transcripts yet.</p> : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-[14px]">
              <caption className="sr-only">Coverage of participant speech per transcript</caption>
              <thead className="bg-slate-50 text-[13px] text-slate-800"><tr><th scope="col" className="px-3 py-2">Transcript</th><th scope="col" className="px-3 py-2">Participant turns coded</th><th scope="col" className="px-3 py-2">Participant text coded</th></tr></thead>
              <tbody className="divide-y divide-slate-200">
                {stats.coverage.map(c => (
                  <tr key={c.transcriptId}>
                    <th scope="row" className="px-3 py-2 font-medium text-slate-900">{c.label}</th>
                    <td className="px-3 py-2">{c.codedParticipantSegments} of {c.participantSegments} ({percent(c.segmentShare)})</td>
                    <td className="px-3 py-2">{percent(c.characterShare)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  )
}
