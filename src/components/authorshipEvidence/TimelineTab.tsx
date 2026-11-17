import { EVENT_TITLES, SOURCES, formatDateTime, n, plural, type EvidenceDocument } from '../../lib/authorshipEvidence'
import { Empty, LabelBadge } from './ui'

/** The recorded history, oldest first, with the edit sessions read off it. Nothing here is estimated. */
export function TimelineTab({ doc }: { doc: EvidenceDocument }) {
  if (doc.timeline.length === 0) return <Empty>No history has been recorded for this document yet.</Empty>
  return (
    <div className="space-y-6">
      <section aria-labelledby="ae-sessions-title">
        <h3 id="ae-sessions-title" className="text-[15px] font-semibold text-slate-900">Edit sessions</h3>
        {doc.sessions.length === 0 ? (
          <p className="mt-1 text-[14px] text-slate-800">No edits have been recorded yet.</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[560px] text-left text-[13px] text-slate-900">
              <thead className="bg-slate-50 text-slate-800">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">Session</th>
                  <th scope="col" className="px-3 py-2 font-semibold">From</th>
                  <th scope="col" className="px-3 py-2 font-semibold">To</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Saves</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Characters added</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Removed</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Words at end</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {doc.sessions.map(s => (
                  <tr key={s.number}>
                    <td className="px-3 py-2">{s.number}</td>
                    <td className="whitespace-nowrap px-3 py-2">{formatDateTime(s.startedAt)}</td>
                    <td className="whitespace-nowrap px-3 py-2">{formatDateTime(s.endedAt)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{n(s.saves)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{n(s.charsAdded)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{n(s.charsRemoved)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.wordCountAtEnd === null ? '' : n(s.wordCountAtEnd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-1.5 text-[13px] text-slate-700">A session is a run of recorded saves with no gap longer than 30 minutes. Large insertions are listed separately below and are not in the "added" column.</p>
      </section>

      <section aria-labelledby="ae-timeline-title">
        <h3 id="ae-timeline-title" className="text-[15px] font-semibold text-slate-900">Timeline <span className="font-normal text-slate-700">({plural(doc.timeline.length, 'entry', 'entries')})</span></h3>
        <ol className="mt-2 divide-y divide-slate-200 rounded-xl border border-slate-200">
          {doc.timeline.map(e => (
            <li key={e.id} className="px-3 py-3 sm:px-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-[14px] font-semibold text-slate-900">
                  <span className="mr-2 font-normal tabular-nums text-slate-700">{e.sequence}.</span>
                  {EVENT_TITLES[e.type] ?? e.type}{e.tool ? `: ${e.tool}` : ''}
                </p>
                <p className="whitespace-nowrap text-[13px] text-slate-700">{formatDateTime(e.occurredAt)}</p>
              </div>
              <p className="mt-1 text-[14px] text-slate-800 [overflow-wrap:anywhere]">{e.description}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-slate-700">
                <LabelBadge label={e.evidenceLabel} />
                <span>Source: {SOURCES[e.source] ?? e.source}</span>
                {e.versionNumber !== null ? <span>Version {e.versionNumber}</span> : null}
                {e.fileName ? <span className="[overflow-wrap:anywhere]">File: {e.fileName}</span> : null}
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
