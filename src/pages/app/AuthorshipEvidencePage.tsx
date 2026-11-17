import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { authorshipEvidenceApi } from '../../api/authorshipEvidence'
import { ComingSoon } from '../../components/app/ToolGate'
import { DeclarationTab } from '../../components/authorshipEvidence/DeclarationTab'
import { RecordingNotice } from '../../components/authorshipEvidence/RecordingNotice'
import { RegisterTab } from '../../components/authorshipEvidence/RegisterTab'
import { ReportTab } from '../../components/authorshipEvidence/ReportTab'
import { TimelineTab } from '../../components/authorshipEvidence/TimelineTab'
import { VersionsTab } from '../../components/authorshipEvidence/VersionsTab'
import { ErrorNote, Frame, Note, Pill, dangerButton, secondaryButton } from '../../components/authorshipEvidence/ui'
import { Skeleton } from '../../components/ui/Skeleton'
import {
  ORIGINS, STATUS, failureMessage, formatDateTime, httpStatus, plural,
  type DocumentSummary, type EvidenceDocument, type Settings,
} from '../../lib/authorshipEvidence'
import { formatShortDate } from '../../lib/utils'

type Load<T> = { state: 'loading' } | { state: 'ready'; value: T } | { state: 'off' } | { state: 'missing' } | { state: 'error'; message: string }

/** A bare 404 (no body) is the server saying the feature is switched off; a 404 with a message is a missing document. */
const isOff = (e: unknown) => httpStatus(e) === 404
const isMissing = (e: unknown) => (e as { message?: string })?.message?.toLowerCase().includes('not found') === true

const DECLARATION: Record<string, { text: string; tone: string }> = {
  None: { text: 'No declaration', tone: 'border-slate-300 bg-slate-100 text-slate-800' },
  Draft: { text: 'Declaration: draft', tone: 'border-amber-300 bg-amber-50 text-amber-900' },
  Confirmed: { text: 'Declaration: confirmed', tone: 'border-emerald-300 bg-emerald-50 text-emerald-900' },
}

/**
 * Authorship Evidence: "Don't just check the final document. Document how the work was created."
 * `/app/authorship-evidence` lists the student's documents; `/app/authorship-evidence/:documentId` is one document's evidence.
 */
export default function AuthorshipEvidencePage() {
  const { documentId } = useParams<{ documentId: string }>()
  return documentId ? <DocumentRoute key={documentId} documentId={documentId} /> : <ListRoute />
}

function ListRoute() {
  const [page, setPage] = useState<Load<{ settings: Settings; documents: DocumentSummary[] }>>({ state: 'loading' })

  const load = useCallback(() => {
    setPage({ state: 'loading' })
    Promise.all([authorshipEvidenceApi.settings(), authorshipEvidenceApi.documents()])
      .then(([settings, documents]) => setPage({ state: 'ready', value: { settings, documents } }))
      .catch(e => setPage(isOff(e) ? { state: 'off' } : { state: 'error', message: failureMessage(e, 'load') }))
  }, [])
  useEffect(load, [load])

  if (page.state === 'loading') return <Frame><Skeleton lines={6} tone="light" /></Frame>
  if (page.state === 'off') return <ComingSoon tool="authorship-evidence" />
  if (page.state !== 'ready') return <Frame><ErrorNote onRetry={load}>{page.state === 'error' ? page.message : 'This could not be loaded.'}</ErrorNote></Frame>

  const { settings, documents } = page.value
  return (
    <Frame>
      {/* The app header already shows "Authorship Evidence" as the page's h1. */}
      <p className="max-w-3xl text-[15px] text-slate-800">
        Don't just check the final document. Document how the work was created: a factual history of your writing, a register of the AI tools you used, and a declaration you can give to a supervisor or examiner.
      </p>
      <div className="mt-2 max-w-3xl">
        <Note>
          This shows what was recorded and what was not. It does not say whether text was written by a person or by AI, it gives no score, and it does not replace your university's own rules on AI use.
        </Note>
      </div>

      <div className="mt-5">
        <RecordingNotice settings={settings} onChange={() => load()} />
      </div>

      <section aria-labelledby="ae-list-title" className="mt-7">
        <h2 id="ae-list-title" className="text-[16px] font-semibold text-slate-900">Your documents</h2>
        {documents.length === 0 ? (
          <p className="mt-2 rounded-lg border border-dashed border-slate-300 p-4 text-[14px] text-slate-800">
            You have no written documents yet. <Link to="/app/editor/new" className="font-semibold text-purple-deep underline">Start one in the editor</Link>.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-200 rounded-xl border border-slate-200">
            {documents.map(d => (
              <li key={d.documentId}>
                <Link to={`/app/authorship-evidence/${d.documentId}`} className="block px-4 py-3 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-accent/40">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    {/* A title can be one unbroken string: let it break anywhere rather than leave the card. */}
                    <span className="min-w-0 max-w-full text-[15px] font-semibold text-purple-deep underline [overflow-wrap:anywhere]">{d.title || 'Untitled document'}</span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Pill tone={STATUS[d.status].tone}>{STATUS[d.status].text}</Pill>
                      <Pill tone={DECLARATION[d.declarationStatus].tone}>{DECLARATION[d.declarationStatus].text}</Pill>
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] text-slate-700">
                    {d.status === 'NotRecording'
                      ? 'Nothing has been recorded for this document.'
                      : <>{plural(d.eventCount, 'timeline entry', 'timeline entries')} · {plural(d.versionCount, 'version')} · {plural(d.aiUseCount, 'AI tool use')} · {plural(d.reportCount, 'report')}{d.recordingStartedAt ? ` · recording since ${formatShortDate(d.recordingStartedAt)}` : ''}</>}
                    {' '}· last edited {formatShortDate(d.documentUpdatedAt)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[13px] text-slate-700">Uploaded PDFs are not listed: HumaniseAI holds no text for them, so there is nothing to record.</p>
      </section>
    </Frame>
  )
}

const TABS = [
  { key: 'timeline', label: 'Timeline' },
  { key: 'versions', label: 'Versions' },
  { key: 'register', label: 'AI use register' },
  { key: 'declaration', label: 'Declaration' },
  { key: 'report', label: 'Report' },
] as const
type TabKey = typeof TABS[number]['key']

function DocumentRoute({ documentId }: { documentId: string }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = (TABS.find(t => t.key === params.get('tab'))?.key ?? 'timeline') as TabKey
  const setTab = (key: TabKey) => setParams(key === 'timeline' ? {} : { tab: key }, { replace: true })

  const [page, setPage] = useState<Load<{ doc: EvidenceDocument; settings: Settings }>>({ state: 'loading' })
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const fetchAll = useCallback(async () => {
    const [doc, settings] = await Promise.all([authorshipEvidenceApi.document(documentId), authorshipEvidenceApi.settings()])
    setPage({ state: 'ready', value: { doc, settings } })
  }, [documentId])

  const load = useCallback(() => {
    setPage({ state: 'loading' })
    fetchAll().catch(e => {
      if (isMissing(e)) setPage({ state: 'missing' })
      else if (isOff(e)) setPage({ state: 'off' })
      else setPage({ state: 'error', message: failureMessage(e, 'load') })
    })
  }, [fetchAll])
  useEffect(load, [load])

  if (page.state === 'loading') return <Frame><Skeleton lines={8} tone="light" /></Frame>
  if (page.state === 'off') return <ComingSoon tool="authorship-evidence" />
  if (page.state === 'missing') {
    return (
      <Frame>
        <div role="alert" className="rounded-lg border border-slate-300 bg-slate-50 p-4 text-[14px] text-slate-900">
          This document does not exist, or it was deleted. <Link to="/app/authorship-evidence" className="font-semibold text-purple-deep underline">See your documents</Link>
        </div>
      </Frame>
    )
  }
  if (page.state === 'error') return <Frame><ErrorNote onRetry={load}>{page.message}</ErrorNote></Frame>

  const { doc, settings } = page.value
  const setDoc = (next: EvidenceDocument) => setPage({ state: 'ready', value: { doc: next, settings } })

  const act = async (action: 'save' | 'delete', work: () => Promise<void>) => {
    setBusy(true)
    setFailure(null)
    try { await work() } catch (err) { setFailure(failureMessage(err, action)) } finally { setBusy(false) }
  }
  const setRecording = (paused: boolean) => act('save', async () => setDoc(await authorshipEvidenceApi.setRecording(documentId, paused)))
  const deleteEvidence = () => act('delete', async () => {
    await authorshipEvidenceApi.deleteEvidence(documentId)
    navigate('/app/authorship-evidence', { replace: true })
  })

  const status = STATUS[doc.status]
  return (
    <Frame>
      <p className="text-[13px]"><Link to="/app/authorship-evidence" className="font-semibold text-purple-deep underline">All documents</Link></p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <h2 className="min-w-0 max-w-full text-[20px] font-semibold text-slate-900 [overflow-wrap:anywhere]">{doc.title || 'Untitled document'}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={status.tone}>{status.text}</Pill>
          <Link to={`/app/editor/${doc.documentId}`} className={`${secondaryButton} inline-flex items-center`}>Open in the editor</Link>
          {settings.recordingAccepted && doc.status === 'Recording' ? <button type="button" disabled={busy} onClick={() => { void setRecording(true) }} className={secondaryButton}>Switch recording off</button> : null}
          {settings.recordingAccepted && doc.status === 'Paused' ? <button type="button" disabled={busy} onClick={() => { void setRecording(false) }} className={secondaryButton}>Switch recording on</button> : null}
        </div>
      </div>
      <p className="mt-1 text-[13px] text-slate-700">
        Created {formatDateTime(doc.documentCreatedAt)}
        {doc.origin ? ` · ${ORIGINS[doc.origin] ?? doc.origin}${doc.originFileName ? ` (${doc.originFileName})` : ''}` : ''}
        {doc.recordingStartedAt ? ` · recording since ${formatDateTime(doc.recordingStartedAt)}` : ''}
      </p>
      {failure ? <div className="mt-3"><ErrorNote>{failure}</ErrorNote></div> : null}

      {doc.status === 'NotRecording' ? (
        <div className="mt-4 space-y-3">
          <Note>
            Nothing has been recorded for this document, so its history is not available. That is not a finding about your work: recording had not started.
            {settings.recordingAccepted
              ? ' Its history will begin at its next save in the editor. You can also add an earlier draft, a register entry or a declaration now.'
              : ' Switch recording on from the Authorship Evidence page to start a history for it.'}
          </Note>
          {!settings.recordingAccepted ? <Link to="/app/authorship-evidence" className={`${secondaryButton} inline-flex items-center`}>Read the recording notice</Link> : null}
        </div>
      ) : null}

      {doc.chain && !doc.chain.intact ? (
        <div role="alert" className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-[14px] text-red-900">
          The timeline's integrity check failed from entry {doc.chain.brokenAtSequence}. Entries from that point may have been altered or lost and should not be relied on. Any report says so.
        </div>
      ) : null}

      {doc.areas.length > 0 ? (
        <section aria-labelledby="ae-areas-title" className="mt-5">
          <h3 id="ae-areas-title" className="text-[15px] font-semibold text-slate-900">What the evidence covers, and what is missing</h3>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            {doc.areas.map(area => (
              <div key={area.key} className="rounded-xl border border-slate-200 p-3">
                <p className="text-[14px] font-semibold text-slate-900">{area.title}</p>
                {area.recorded.length > 0 ? (
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[13px] text-slate-900">{area.recorded.map(x => <li key={x}>{x}</li>)}</ul>
                ) : <p className="mt-1.5 text-[13px] text-slate-700">Nothing recorded yet.</p>}
                {area.missing.length > 0 ? (
                  <>
                    <p className="mt-2 text-[12px] font-semibold uppercase tracking-wide text-slate-700">Not available</p>
                    <ul className="list-disc space-y-0.5 pl-5 text-[13px] text-slate-700">{area.missing.map(x => <li key={x}>{x}</li>)}</ul>
                  </>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {(doc.status !== 'NotRecording' || settings.recordingAccepted) ? (
        <>
          <div role="tablist" aria-label="Evidence" className="mt-6 flex gap-1 overflow-x-auto border-b border-slate-200">
            {TABS.map(t => (
              <button key={t.key} type="button" role="tab" id={`ae-tab-${t.key}`} aria-selected={tab === t.key} aria-controls="ae-tabpanel" onClick={() => setTab(t.key)}
                className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-accent/40 ${tab === t.key ? 'border-purple-accent font-semibold text-purple-deep' : 'border-transparent text-slate-800 hover:border-slate-300'}`}>
                {t.label}
              </button>
            ))}
          </div>
          <div role="tabpanel" id="ae-tabpanel" aria-labelledby={`ae-tab-${tab}`} className="pt-5">
            {tab === 'timeline' ? <TimelineTab doc={doc} /> : null}
            {tab === 'versions' ? <VersionsTab doc={doc} onChange={setDoc} /> : null}
            {tab === 'register' ? <RegisterTab doc={doc} onReload={fetchAll} /> : null}
            {tab === 'declaration' ? <DeclarationTab doc={doc} wordingCredits={settings.wordingCredits} onReload={fetchAll} onOpenRegister={() => setTab('register')} /> : null}
            {tab === 'report' ? (
              doc.status === 'NotRecording'
                ? <Note>There is nothing to report for this document yet. Add a declaration, an earlier draft or a register entry, or edit it in the editor with recording on.</Note>
                : <ReportTab doc={doc} reportCredits={settings.reportCredits} onReload={fetchAll} onOpenDeclaration={() => setTab('declaration')} />
            ) : null}
          </div>
        </>
      ) : null}

      {doc.status !== 'NotRecording' ? (
        <section aria-labelledby="ae-limits-title" className="mt-8 border-t border-slate-200 pt-4">
          <h3 id="ae-limits-title" className="text-[14px] font-semibold text-slate-900">Limits of this evidence</h3>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[13px] text-slate-800">{doc.limitations.map(x => <li key={x}>{x}</li>)}</ul>
          <div className="mt-4 text-[13px] text-slate-800">
            <p>
              Stored encrypted.{doc.purgeAfter ? ` Deleted for good on ${formatShortDate(doc.purgeAfter)} if this document's evidence is not used before then (${settings.retentionDays} days without activity).` : ''} Deleting the document deletes its evidence too.
            </p>
            {confirmDelete ? (
              <div role="alertdialog" aria-labelledby="ae-delete-title" className="mt-2 rounded-lg border border-red-300 bg-red-50 p-3 text-red-900">
                <p id="ae-delete-title" className="text-[14px] font-semibold">Delete the timeline, all {doc.versions.length} {doc.versions.length === 1 ? 'version' : 'versions'}, the register entries, the declaration and all {doc.reports.length} {doc.reports.length === 1 ? 'report' : 'reports'} for this document?</p>
                <p className="mt-1">The document itself is kept. This cannot be undone, and a new history would start from nothing.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => { void deleteEvidence() }} disabled={busy} className={dangerButton}>{busy ? 'Deleting…' : 'Delete everything'}</button>
                  <button type="button" onClick={() => setConfirmDelete(false)} disabled={busy} className={secondaryButton}>Keep it</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="mt-1.5 rounded font-semibold text-red-700 underline outline-none focus-visible:ring-2 focus-visible:ring-red-700/40">Delete this document's evidence now</button>
            )}
          </div>
        </section>
      ) : null}
    </Frame>
  )
}
