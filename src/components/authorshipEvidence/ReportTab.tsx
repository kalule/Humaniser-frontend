import { useCallback, useEffect, useState } from 'react'
import { authorshipEvidenceApi } from '../../api/authorshipEvidence'
import {
  EVENT_TITLES, ORIGINS, SOURCES, VERSION_REASONS, assistanceLabel, categoryLabel, failureMessage, formatDateTime, n, outcomeLabel,
  type EvidenceDocument, type Report, type ReportContent,
} from '../../lib/authorshipEvidence'
import { ErrorNote, LabelBadge, Note, dangerButton, primaryButton, secondaryButton } from './ui'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-slate-200 pt-4 first:border-t-0 first:pt-0">
      <h4 className="text-[14px] font-semibold uppercase tracking-wide text-slate-800">{title}</h4>
      <div className="mt-2 text-[14px] text-slate-900">{children}</div>
    </section>
  )
}

const Row = ({ k, children }: { k: string; children: React.ReactNode }) => (
  <div className="grid gap-x-3 py-0.5 sm:grid-cols-[11rem_1fr]"><dt className="text-slate-700">{k}</dt><dd className="[overflow-wrap:anywhere]">{children}</dd></div>
)

/** The report as it reads on screen. Recorded evidence and the student's declaration are kept in separate sections. */
export function ReportBody({ report }: { report: Report }) {
  const c: ReportContent = report.content
  const a = c.revisionActivity
  return (
    <div className="space-y-4 rounded-xl border border-slate-300 bg-white p-4 sm:p-6">
      <header>
        <h3 className="text-[18px] font-semibold text-slate-900">Authorship Evidence Report</h3>
        <p className="mt-1 text-[13px] text-slate-700">
          {report.reportNumber ? <>Report ID {report.reportNumber} · created {formatDateTime(report.generatedAt!)}</> : 'Preview: not yet created, no report ID'}
        </p>
      </header>

      <Section title="Student and document">
        <dl>
          <Row k="Student">{c.studentName} ({c.studentEmail})</Row>
          <Row k="Document">{c.documentTitle}</Row>
          <Row k="Created">{formatDateTime(c.documentCreatedAt)}</Row>
          <Row k="Origin">{ORIGINS[c.origin] ?? c.origin}{c.originFileName ? ` (${c.originFileName})` : ''}</Row>
          <Row k="Recording began">{formatDateTime(c.recordingStartedAt)}</Row>
        </dl>
      </Section>

      <Section title="Recorded evidence, by area">
        <div className="grid gap-3 sm:grid-cols-2">
          {c.areas.map(area => (
            <div key={area.key} className="rounded-lg border border-slate-200 p-3">
              <p className="font-semibold">{area.title}</p>
              <p className="mt-1.5 text-[13px] font-medium text-slate-800">Recorded</p>
              {area.recorded.length > 0 ? <ul className="list-disc pl-5 text-[13px]">{area.recorded.map(x => <li key={x}>{x}</li>)}</ul> : <p className="text-[13px] text-slate-700">Nothing recorded.</p>}
              <p className="mt-1.5 text-[13px] font-medium text-slate-800">Not available</p>
              {area.missing.length > 0 ? <ul className="list-disc pl-5 text-[13px]">{area.missing.map(x => <li key={x}>{x}</li>)}</ul> : <p className="text-[13px] text-slate-700">Nothing noted.</p>}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Revision activity (recorded)">
        <dl>
          <Row k="Edit sessions">{n(a.sessions)}</Row>
          <Row k="Recorded saves">{n(a.saves)}</Row>
          <Row k="Characters added">{n(a.charsAdded)}</Row>
          <Row k="Characters removed">{n(a.charsRemoved)}</Row>
          <Row k="Large insertions">{n(a.largeInsertions)}</Row>
          <Row k="Versions kept">{n(a.versions)}</Row>
          <Row k="Word count">{a.firstWordCount === null ? 'Not available' : `${n(a.firstWordCount)} at the first record, ${n(a.lastWordCount ?? 0)} at the last`}</Row>
        </dl>
      </Section>

      <Section title={`Timeline (${c.timeline.length} entries)`}>
        {c.timeline.length === 0 ? <p>Not available.</p> : (
          <ol className="space-y-2">
            {c.timeline.map(e => (
              <li key={e.id} className="text-[13px]">
                <span className="font-semibold">{e.sequence}. {formatDateTime(e.occurredAt)} · {EVENT_TITLES[e.type] ?? e.type}</span>{' '}
                <LabelBadge label={e.evidenceLabel} /> <span className="text-slate-700">Source: {SOURCES[e.source] ?? e.source}</span>
                <span className="block [overflow-wrap:anywhere]">{e.description}</span>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section title={`Revision history (${c.versions.length} versions)`}>
        {c.versions.length === 0 ? <p>Not available.</p> : (
          <ul className="space-y-1 text-[13px]">
            {c.versions.map(v => (
              <li key={v.id}>Version {v.versionNumber} · {formatDateTime(v.createdAt)} · {VERSION_REASONS[v.reason] ?? v.reason} · {n(v.wordCount)} words <LabelBadge label={v.evidenceLabel} /></li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="AI usage (recorded and student-entered)">
        {c.usageSummary.length === 0 ? (
          <p>No AI tool use is recorded for this document. This does not show that none was used.</p>
        ) : (
          <>
            <ul className="space-y-1 text-[13px]">
              {c.usageSummary.map(u => (
                <li key={`${u.tool}|${u.assistanceType}|${u.evidenceLabel}`}>
                  <span className="font-semibold">{u.tool}</span> · {assistanceLabel(u.assistanceType)} · {u.uses === 1 ? '1 use' : `${u.uses} uses`} · {n(u.wordsAffected)} words · {formatDateTime(u.first)}{u.uses > 1 ? ` to ${formatDateTime(u.last)}` : ''} <LabelBadge label={u.evidenceLabel} />
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[13px] font-medium text-slate-800">Each use</p>
            <ul className="space-y-1 text-[13px]">
              {c.register.map(e => (
                <li key={e.id} className="[overflow-wrap:anywhere]">
                  {formatDateTime(e.occurredAt)} · {e.tool} · {n(e.wordsAffected)} words · result: {outcomeLabel(e.outcome)}{e.outcomeLabel ? <> <LabelBadge label={e.outcomeLabel} /></> : null}
                  {e.corrected ? ' · corrected by a later entry' : ''}{e.correctsEntryId ? ' · correction' : ''} <LabelBadge label={e.evidenceLabel} />
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>

      <Section title="Student's AI use declaration">
        {c.declarationText ? (
          <>
            <p className="text-[13px] text-slate-700">Category: {categoryLabel(c.declarationCategory)} <LabelBadge label="UserSupplied" /></p>
            <p className="mt-1.5 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 leading-relaxed [overflow-wrap:anywhere]">{c.declarationText}</p>
            {report.reportNumber ? <p className="mt-1.5 text-[13px] text-slate-700">Confirmed as accurate by the student on {formatDateTime(c.declarationConfirmedAt)}.</p> : null}
          </>
        ) : <p>No declaration has been written yet.</p>}
        <ul className="mt-2 list-disc pl-5 text-[13px] text-slate-800">{c.declarationNotes.map(x => <li key={x}>{x}</li>)}</ul>
      </Section>

      <Section title="Evidence limitations and verification notes">
        <ul className="list-disc space-y-1 pl-5 text-[13px]">{c.limitations.map(x => <li key={x}>{x}</li>)}</ul>
        <p className="mt-2 text-[13px] text-slate-700 [overflow-wrap:anywhere]">
          Timeline check: {c.chain.intact ? 'unbroken' : `did not verify from entry ${c.chain.brokenAtSequence}`} · {c.chain.eventCount} entries · chain value {c.chain.headHash.slice(0, 16)}…
        </p>
      </Section>
    </div>
  )
}

/** Preview, create (charged only on success) and download reports. Nothing can be created until the declaration is confirmed. */
export function ReportTab({ doc, reportCredits, onReload, onOpenDeclaration }: {
  doc: EvidenceDocument
  reportCredits: number
  onReload: () => Promise<void>
  onOpenDeclaration: () => void
}) {
  const [shown, setShown] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const preview = useCallback(async () => {
    setLoading(true)
    setFailure(null)
    try { setShown(await authorshipEvidenceApi.previewReport(doc.documentId)) }
    catch (err) { setFailure(failureMessage(err, 'load')) }
    finally { setLoading(false) }
  }, [doc.documentId])
  useEffect(() => { void preview() }, [preview])

  const run = async (key: string, action: 'report' | 'load' | 'delete', work: () => Promise<void>) => {
    setBusy(key)
    setFailure(null)
    try { await work() } catch (err) { setFailure(failureMessage(err, action)) } finally { setBusy(null) }
  }

  const create = () => run('create', 'report', async () => { setShown(await authorshipEvidenceApi.generateReport(doc.documentId)); await onReload() })
  const open = (id: string) => run('open:' + id, 'load', async () => { setShown(await authorshipEvidenceApi.report(id)) })
  const remove = (id: string) => run('delete:' + id, 'delete', async () => {
    await authorshipEvidenceApi.deleteReport(id)
    setConfirmDelete(null)
    if (shown?.id === id) await preview()
    await onReload()
  })
  const download = (id: string, number: string, format: 'pdf' | 'docx') => run(`${format}:${id}`, 'load', async () => {
    const response = await authorshipEvidenceApi.exportReport(id, format)
    const url = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = url
    link.download = `Authorship-Evidence-${number}.${format}`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  })

  const confirmed = doc.declaration?.confirmed === true
  const isPreview = shown !== null && shown.id === null

  return (
    <div className="space-y-5">
      {failure ? <ErrorNote>{failure}</ErrorNote> : null}

      <section aria-labelledby="ae-report-create" className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
        <h3 id="ae-report-create" className="text-[15px] font-semibold text-slate-900">Create a report</h3>
        <p className="mt-1 text-[14px] text-slate-800">
          A report freezes the evidence and your declaration as they are now and gives them a report ID. You can download it as PDF or Word and decide who to give it to.
        </p>
        {!confirmed ? (
          <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-[13px] text-amber-950">
            A report cannot be created or exported until you have written the declaration and ticked "I have checked this is accurate".{' '}
            <button type="button" onClick={onOpenDeclaration} className="font-semibold underline">Go to the declaration</button>
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => { void create() }} disabled={!confirmed || busy !== null} aria-disabled={!confirmed} className={primaryButton}>
            {busy === 'create' ? 'Creating the report…' : `Create report (${reportCredits} credits)`}
          </button>
          <span className="text-[13px] text-slate-700">You are charged only if the report is created.</span>
        </div>
      </section>

      {doc.reports.length > 0 ? (
        <section aria-labelledby="ae-report-list">
          <h3 id="ae-report-list" className="text-[15px] font-semibold text-slate-900">Reports you have created</h3>
          <ul className="mt-2 divide-y divide-slate-200 rounded-xl border border-slate-200">
            {doc.reports.map(r => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2.5 sm:px-4">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-slate-900 [overflow-wrap:anywhere]">{r.reportNumber}</p>
                  <p className="text-[13px] text-slate-700">Created {formatDateTime(r.generatedAt)} · {r.eventCount} timeline entries</p>
                </div>
                {confirmDelete === r.id ? (
                  <div role="alertdialog" aria-label="Delete report" className="flex flex-wrap items-center gap-2 rounded-lg border border-red-300 bg-red-50 p-2 text-[13px] text-red-900">
                    Delete this report and its access log for good?
                    <button type="button" onClick={() => { void remove(r.id) }} disabled={busy !== null} className={dangerButton}>{busy === 'delete:' + r.id ? 'Deleting…' : 'Delete'}</button>
                    <button type="button" onClick={() => setConfirmDelete(null)} disabled={busy !== null} className={secondaryButton}>Keep it</button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => { void open(r.id) }} disabled={busy !== null} className={secondaryButton}>{busy === 'open:' + r.id ? 'Opening…' : 'View'}</button>
                    <button type="button" onClick={() => { void download(r.id, r.reportNumber, 'pdf') }} disabled={busy !== null} className={secondaryButton}>{busy === 'pdf:' + r.id ? 'Preparing…' : 'PDF'}</button>
                    <button type="button" onClick={() => { void download(r.id, r.reportNumber, 'docx') }} disabled={busy !== null} className={secondaryButton}>{busy === 'docx:' + r.id ? 'Preparing…' : 'Word'}</button>
                    <button type="button" onClick={() => setConfirmDelete(r.id)} disabled={busy !== null} className="rounded px-1 text-[13px] font-semibold text-red-700 underline outline-none focus-visible:ring-2 focus-visible:ring-red-700/40">Delete</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[13px] text-slate-700">A stored report does not change when the document does. Viewing and downloading are logged.</p>
        </section>
      ) : null}

      <section aria-labelledby="ae-report-shown">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 id="ae-report-shown" className="text-[15px] font-semibold text-slate-900">{isPreview || !shown ? 'Preview of a report created now' : `Stored report ${shown.reportNumber}`}</h3>
          {shown && !isPreview ? <button type="button" onClick={() => { void preview() }} disabled={busy !== null} className={secondaryButton}>Back to the preview</button> : null}
        </div>
        {loading ? <Note>Loading the preview…</Note> : shown ? <ReportBody report={shown} /> : null}
      </section>
    </div>
  )
}
