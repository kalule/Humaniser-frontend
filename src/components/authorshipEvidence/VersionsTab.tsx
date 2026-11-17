import { useRef, useState } from 'react'
import { authorshipEvidenceApi } from '../../api/authorshipEvidence'
import {
  VERSION_REASONS, failureMessage, formatDateTime, n, type EvidenceDocument, type VersionComparison, type VersionContent,
} from '../../lib/authorshipEvidence'
import { formatShortDate } from '../../lib/utils'
import { Empty, ErrorNote, LabelBadge, field, labelText, primaryButton, secondaryButton } from './ui'

/** Kept copies of the document: view one, compare two, keep the current state, or add an earlier draft. */
export function VersionsTab({ doc, onChange }: { doc: EvidenceDocument; onChange: (d: EvidenceDocument) => void }) {
  const versions = doc.versions
  const [fromId, setFromId] = useState(versions.length > 1 ? versions[versions.length - 2].id : '')
  const [toId, setToId] = useState(versions.length > 0 ? versions[versions.length - 1].id : '')
  const [shown, setShown] = useState<VersionContent | null>(null)
  const [comparison, setComparison] = useState<VersionComparison | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  const [importText, setImportText] = useState('')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importDate, setImportDate] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [importProblem, setImportProblem] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const run = async (key: string, action: 'load' | 'save' | 'import', work: () => Promise<void>) => {
    setBusy(key)
    setFailure(null)
    try { await work() } catch (err) { setFailure(failureMessage(err, action)) } finally { setBusy(null) }
  }

  const keep = () => run('keep', 'save', async () => onChange(await authorshipEvidenceApi.saveVersion(doc.documentId)))
  const view = (id: string) => run('view:' + id, 'load', async () => { setComparison(null); setShown(await authorshipEvidenceApi.version(id)) })
  const compare = () => run('compare', 'load', async () => { setShown(null); setComparison(await authorshipEvidenceApi.compare(fromId, toId)) })

  const importDraft = () => {
    const text = importText.trim()
    if (!importFile && text.length < 20) { setImportProblem('Paste the earlier draft (at least 20 characters), or choose a file.'); return }
    setImportProblem(null)
    void run('import', 'import', async () => {
      const date = importDate || null
      const next = importFile
        ? await authorshipEvidenceApi.importDraftFile(doc.documentId, importFile, date)
        : await authorshipEvidenceApi.importDraft(doc.documentId, text, null, date)
      onChange(next)
      setImportText(''); setImportFile(null); setImportDate(''); setImportOpen(false)
      if (fileRef.current) fileRef.current.value = ''
    })
  }

  return (
    <div className="space-y-6">
      {failure ? <ErrorNote>{failure}</ErrorNote> : null}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => { void keep() }} disabled={busy !== null} className={secondaryButton}>{busy === 'keep' ? 'Keeping…' : 'Keep the current document as a version'}</button>
        <button type="button" onClick={() => setImportOpen(o => !o)} aria-expanded={importOpen} className={secondaryButton}>Add an earlier draft</button>
      </div>

      {importOpen ? (
        <section aria-labelledby="ae-import-title" className="rounded-xl border border-slate-300 bg-slate-50 p-3 sm:p-4">
          <h3 id="ae-import-title" className="text-[15px] font-semibold text-slate-900">Add an earlier draft</h3>
          <p className="mt-1 text-[13px] text-slate-800">
            Use this for a draft you wrote somewhere else, for example in Word. It is stored as <span className="font-semibold">Imported</span>, never as Verified by platform: HumaniseAI did not see how or when it was written.
          </p>
          <label htmlFor="ae-import-text" className={`mt-3 ${labelText}`}>Paste the draft</label>
          <textarea id="ae-import-text" rows={6} value={importText} onChange={e => setImportText(e.target.value)} disabled={busy !== null || importFile !== null} className={field} placeholder="Paste the earlier draft here" />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="ae-import-file" className={labelText}>Or choose a file <span className="font-normal text-slate-700">(.docx, .pdf or .txt)</span></label>
              <input ref={fileRef} id="ae-import-file" type="file" accept=".docx,.pdf,.txt" disabled={busy !== null}
                onChange={e => setImportFile(e.target.files?.[0] ?? null)} className="block w-full text-[13px] text-slate-900 file:mr-3 file:rounded-lg file:border file:border-slate-400 file:bg-white file:px-3 file:py-1.5 file:text-[13px] file:font-medium" />
            </div>
            <div>
              <label htmlFor="ae-import-date" className={labelText}>When did you write it? <span className="font-normal text-slate-700">(optional)</span></label>
              <input id="ae-import-date" type="date" value={importDate} max={new Date().toISOString().slice(0, 10)} onChange={e => setImportDate(e.target.value)} disabled={busy !== null} className={field} />
              <p className="mt-1 text-[13px] text-slate-700">Shown as the date you gave. The platform cannot confirm it.</p>
            </div>
          </div>
          {importProblem ? <p role="alert" className="mt-2 text-[13px] font-medium text-red-700">{importProblem}</p> : null}
          <button type="button" onClick={importDraft} disabled={busy !== null} className={`mt-3 ${primaryButton}`}>{busy === 'import' ? 'Importing…' : 'Import draft'}</button>
        </section>
      ) : null}

      {versions.length === 0 ? (
        <Empty>No versions have been kept yet. A copy is kept when recording starts, at the start of each edit session, and whenever you keep one yourself.</Empty>
      ) : (
        <>
          <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200">
            {versions.map(v => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2.5 sm:px-4">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-slate-900">Version {v.versionNumber} <span className="font-normal text-slate-700">· {VERSION_REASONS[v.reason] ?? v.reason}</span></p>
                  <p className="text-[13px] text-slate-700 [overflow-wrap:anywhere]">
                    {formatDateTime(v.createdAt)} · {n(v.wordCount)} words
                    {v.fileName ? ` · ${v.fileName}` : ''}
                    {v.declaredDate ? ` · date you gave: ${formatShortDate(v.declaredDate)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <LabelBadge label={v.evidenceLabel} />
                  <button type="button" onClick={() => { void view(v.id) }} disabled={busy !== null} className={secondaryButton}>{busy === 'view:' + v.id ? 'Opening…' : 'View'}</button>
                </div>
              </li>
            ))}
          </ul>

          {versions.length > 1 ? (
            <section aria-labelledby="ae-compare-title" className="rounded-xl border border-slate-200 p-3 sm:p-4">
              <h3 id="ae-compare-title" className="text-[15px] font-semibold text-slate-900">Compare two versions</h3>
              <div className="mt-2 flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor="ae-compare-from" className={labelText}>From</label>
                  <select id="ae-compare-from" value={fromId} onChange={e => setFromId(e.target.value)} className={field}>
                    {versions.map(v => <option key={v.id} value={v.id}>Version {v.versionNumber} ({formatDateTime(v.createdAt)})</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="ae-compare-to" className={labelText}>To</label>
                  <select id="ae-compare-to" value={toId} onChange={e => setToId(e.target.value)} className={field}>
                    {versions.map(v => <option key={v.id} value={v.id}>Version {v.versionNumber} ({formatDateTime(v.createdAt)})</option>)}
                  </select>
                </div>
                <button type="button" onClick={() => { void compare() }} disabled={busy !== null || !fromId || !toId || fromId === toId} className={primaryButton}>{busy === 'compare' ? 'Comparing…' : 'Compare'}</button>
              </div>
            </section>
          ) : null}
        </>
      )}

      {shown ? (
        <section aria-labelledby="ae-shown-title" className="rounded-xl border border-slate-200 p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="ae-shown-title" className="text-[15px] font-semibold text-slate-900">Version {shown.version.versionNumber} <span className="font-normal text-slate-700">· {n(shown.version.wordCount)} words</span></h3>
            <button type="button" onClick={() => setShown(null)} className={secondaryButton}>Close</button>
          </div>
          <div className="mt-2 max-h-[28rem] overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-[14px] leading-relaxed text-slate-900 [overflow-wrap:anywhere]">{shown.text || '(empty)'}</div>
        </section>
      ) : null}

      {comparison ? (
        <section aria-labelledby="ae-diff-title" className="rounded-xl border border-slate-200 p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="ae-diff-title" className="text-[15px] font-semibold text-slate-900">
              Version {comparison.from.versionNumber} to version {comparison.to.versionNumber}
            </h3>
            <button type="button" onClick={() => setComparison(null)} className={secondaryButton}>Close</button>
          </div>
          <p className="mt-1 text-[13px] text-slate-700">
            {n(comparison.wordsBefore)} words before, {n(comparison.wordsAfter)} after. {comparison.changes.length === 1 ? '1 passage differs' : `${comparison.changes.length} passages differ`}.
          </p>
          {comparison.tooLargeToCompare ? (
            <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-[13px] text-amber-950">These two versions are too different to line up passage by passage. Open each one to read it.</p>
          ) : comparison.changes.length === 0 ? (
            <p className="mt-2 text-[14px] text-slate-800">No differences in the wording.</p>
          ) : (
            <ol className="mt-3 space-y-3">
              {comparison.changes.map((c, i) => (
                <li key={i} className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-red-200 bg-red-50 p-2.5">
                    <p className="text-[12px] font-semibold uppercase tracking-wide text-red-900">Before</p>
                    <p className="mt-1 whitespace-pre-wrap text-[13px] text-slate-900 [overflow-wrap:anywhere]">{c.before || '(nothing here)'}</p>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
                    <p className="text-[12px] font-semibold uppercase tracking-wide text-emerald-900">After</p>
                    <p className="mt-1 whitespace-pre-wrap text-[13px] text-slate-900 [overflow-wrap:anywhere]">{c.after || '(removed)'}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      ) : null}
    </div>
  )
}
