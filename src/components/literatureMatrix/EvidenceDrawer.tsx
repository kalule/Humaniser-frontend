import { useCallback, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { literatureMatrixApi } from '../../api/literatureMatrix'
import {
  DESIGNS, failureMessage, flagLabel, materialLabel, MAX_CELL_CHARS, MAX_NOTES_CHARS, mergeLabel, OPEN_ACCESS_SOURCE_LABEL, originLabel, statusLabel,
  studyLabel, validateUpload, withCell,
  type Evidence, type EvidenceCell, type Matrix, type MatrixStudy,
} from '../../lib/literatureMatrix'
import { formatShortDate } from '../../lib/utils'
import { Skeleton } from '../ui/Skeleton'
import { useConfirm } from '../ui/ConfirmDialog'
import { ConsentNotice, ErrorAlert, StatusChip, buttonClass } from './parts'

/**
 * One study, with each value beside the passage it came from, where that passage is, and how far the value can
 * be trusted. The researcher verifies or corrects each value here; a correction is stored beside the extracted
 * value, which stays visible.
 */
export function EvidenceDrawer({ studyId, matrix, onClose, onRowChange, onRemoved, onMatrixChange }: {
  studyId: string; matrix: Matrix; onClose: () => void; onRowChange: (r: MatrixStudy) => void; onRemoved: () => void; onMatrixChange: (m: Matrix) => void
}) {
  const [evidence, setEvidence] = useState<Evidence | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const panel = useRef<HTMLDivElement>(null)

  const load = useCallback(() => {
    setError(null)
    literatureMatrixApi.evidence(studyId).then(setEvidence).catch(e => setError(failureMessage(e, 'load')))
  }, [studyId])
  useEffect(load, [load])

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    panel.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); previous?.focus() }
  }, [onClose])

  const setStudy = (study: MatrixStudy) => { setEvidence(ev => ev ? { ...ev, study } : ev); onRowChange(study) }
  const setCell = (cell: EvidenceCell) => setEvidence(ev => {
    if (!ev) return ev
    const study = withCell(ev.study, cell)
    onRowChange(study)
    return { ...ev, study, cells: ev.cells.map(c => c.columnId === cell.columnId ? cell : c) }
  })

  const study = evidence?.study
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/30" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={study ? `Evidence for ${studyLabel(study)}` : 'Evidence'}
        className="flex h-full w-full max-w-[680px] flex-col bg-white shadow-elevated outline-none">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[12px] font-medium uppercase tracking-wide text-slate-600">Evidence</p>
            <h2 className="text-[16px] font-semibold text-slate-900 [overflow-wrap:anywhere]">{study ? studyLabel(study) : 'Loading…'}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-slate-600 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {error ? <ErrorAlert message={error} onRetry={load} /> : !evidence || !study ? <Skeleton lines={10} tone="light" /> : (
            <div className="space-y-5">
              {actionError ? <ErrorAlert message={actionError} /> : null}
              <Bibliography study={study} abstract={evidence.abstract} />
              {study.possibleDuplicateOfId ? <DuplicateDecision study={study} onDone={onRemoved} onKept={() => setStudy({ ...study, possibleDuplicateOfId: null, possibleDuplicateReason: null })} onError={setActionError} /> : null}
              <FullText study={study} matrix={matrix} onChange={s => { setStudy(s); onMatrixChange({ ...matrix, consentAccepted: true }) }} onError={setActionError} />
              <section aria-labelledby="ev-cells">
                <h3 id="ev-cells" className="text-[14px] font-semibold text-slate-900">Extracted values</h3>
                {study.extractionState === 'NotExtracted' ? <p className="mt-1 text-[13px] text-slate-700">Not extracted yet. You can enter values yourself, or run Extract from the table.</p> : null}
                <ul className="mt-2 space-y-3">
                  {evidence.cells.map(cell => <CellEvidence key={cell.columnId} cell={cell} studyId={study.id} onChange={setCell} onError={setActionError} />)}
                </ul>
              </section>
              <StudyDetails study={study} onChange={setStudy} onError={setActionError} />
              <section aria-labelledby="ev-origin">
                <h3 id="ev-origin" className="text-[14px] font-semibold text-slate-900">Where this study came from</h3>
                <ul className="mt-1 space-y-1 text-[13px] text-slate-800">
                  {study.provenance.map((p, i) => (
                    <li key={i} className="[overflow-wrap:anywhere]">
                      {originLabel(p)}, added {formatShortDate(p.addedAt)}{p.mergedBy ? ` (merged: ${mergeLabel(p.mergedBy) ?? p.mergedBy})` : ''}
                    </li>
                  ))}
                </ul>
              </section>
              <RemoveStudy study={study} onRemoved={onRemoved} onError={setActionError} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Bibliography({ study, abstract }: { study: MatrixStudy; abstract: string | null }) {
  const [open, setOpen] = useState(false)
  return (
    <section aria-labelledby="ev-bib" className="space-y-1 text-[13px] text-slate-800">
      <h3 id="ev-bib" className="text-[15px] font-semibold text-slate-900 [overflow-wrap:anywhere]">{study.title}</h3>
      <p className="[overflow-wrap:anywhere]">{study.authors.length > 0 ? study.authors.join(', ') : 'No author listed'}{study.year ? ` · ${study.year}` : ' · no year'}{study.journal ? ` · ${study.journal}` : ''}</p>
      {study.doi ? <p><a className="text-purple-deep underline [overflow-wrap:anywhere]" href={`https://doi.org/${study.doi}`} target="_blank" rel="noreferrer">doi.org/{study.doi}</a></p> : <p className="text-slate-600">No DOI recorded.</p>}
      <p><span className="font-medium">Material available:</span> {materialLabel(study.material).long}</p>
      {study.design ? <p><span className="font-medium">Study design:</span> {study.design}</p> : null}
      {study.sourceDeleted ? <p className="text-slate-700">This paper was removed from your saved sources; it stays in this matrix until you remove it here.</p> : null}
      {abstract ? (
        <div>
          <button type="button" className={buttonClass.link} aria-expanded={open} onClick={() => setOpen(o => !o)}>{open ? 'Hide abstract' : 'Show abstract'}</button>
          {open ? <p className="mt-1 whitespace-pre-line rounded-lg bg-slate-50 p-2 [overflow-wrap:anywhere]">{abstract}</p> : null}
        </div>
      ) : null}
    </section>
  )
}

function CellEvidence({ cell, studyId, onChange, onError }: { cell: EvidenceCell; studyId: string; onChange: (c: EvidenceCell) => void; onError: (m: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const save = async (patch: { value?: string; verified?: boolean }) => {
    setBusy(true)
    try { onChange(await literatureMatrixApi.updateCell(studyId, cell.columnId, patch)); setEditing(false) }
    catch (e) { onError(failureMessage(e, 'save')) }
    finally { setBusy(false) }
  }
  const flag = flagLabel(cell.flag)
  const label = statusLabel(cell.status)
  return (
    <li className="rounded-lg border border-slate-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-slate-900 [overflow-wrap:anywhere]">{cell.label}{cell.isInterpretation ? <span className="ml-1 font-normal text-slate-600">(AI judgement, not a finding of the study)</span> : null}</p>
        <StatusChip status={cell.status} verified={cell.verified} interpretation={cell.isInterpretation} />
      </div>
      {editing ? (
        <div className="mt-2">
          <label className="sr-only" htmlFor={`ev-${cell.columnId}`}>Your value for {cell.label}</label>
          <textarea id={`ev-${cell.columnId}`} rows={4} value={draft} maxLength={MAX_CELL_CHARS} onChange={e => setDraft(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-[13px]" />
          <div className="mt-1 flex gap-2">
            <button type="button" className={buttonClass.primary} disabled={busy} onClick={() => save({ value: draft })}>Save</button>
            <button type="button" className={buttonClass.secondary} onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-1 whitespace-pre-line text-[13px] text-slate-900 [overflow-wrap:anywhere]">{cell.value ?? <span className="text-slate-600">{cell.status ? label.long : 'Nothing here yet.'}</span>}</p>
          {cell.researcherValue !== null && cell.aiValue ? (
            <p className="mt-1 text-[12px] text-slate-700 [overflow-wrap:anywhere]">Extracted value, kept for reference: {cell.aiValue} ({statusLabel(cell.aiStatus).short.toLowerCase()})</p>
          ) : null}
          {flag ? <p className="mt-1 text-[12px] text-amber-900">{flag}</p> : null}
          {cell.value && cell.status !== 'UserSupplied' ? <p className="mt-1 text-[12px] text-slate-600">{label.long}</p> : null}
        </>
      )}
      {cell.passages.length > 0 ? (
        <ul className="mt-2 space-y-1" aria-label={cell.researcherValue !== null ? 'Passage for the extracted value' : 'Supporting passage'}>
          {cell.researcherValue !== null ? <li className="text-[11px] font-medium text-slate-600">Passage for the extracted value, not for yours:</li> : null}
          {cell.passages.map((p, i) => (
            <li key={i}>
              <blockquote className="border-l-2 border-slate-300 pl-2 text-[13px] italic text-slate-800 [overflow-wrap:anywhere]">"{p.text}"</blockquote>
              <p className="pl-2 text-[11px] text-slate-600">{p.basis === 'FullText' ? 'Full text' : p.basis === 'Abstract' ? 'Abstract' : 'Title'}{p.locator && p.locator !== 'Abstract' && p.locator !== 'Title' ? `, ${p.locator}` : ''}</p>
            </li>
          ))}
        </ul>
      ) : cell.value && cell.status !== 'UserSupplied' ? <p className="mt-2 text-[12px] text-slate-600">No supporting passage was confirmed.</p> : null}
      {!editing ? (
        <div className="mt-2 flex flex-wrap gap-3 text-[12px]">
          {cell.status ? <button type="button" className={buttonClass.link} disabled={busy} onClick={() => save({ verified: !cell.verified })}>{cell.verified ? 'Remove my check' : 'I checked this'}</button> : null}
          <button type="button" className={buttonClass.link} onClick={() => { setDraft(cell.value ?? ''); setEditing(true) }}>{cell.value ? 'Correct' : 'Enter a value'}</button>
          {cell.researcherValue !== null ? (
            <button type="button" className={buttonClass.link} disabled={busy} onClick={() => save({ value: '' })}>{cell.aiValue ? 'Use the extracted value' : 'Clear my value'}</button>
          ) : null}
        </div>
      ) : null}
      {cell.aiModel ? <p className="mt-1 text-[11px] text-slate-500">Extracted {cell.aiExtractedAt ? formatShortDate(cell.aiExtractedAt) : ''} · {cell.aiModel} · {cell.promptVersion}</p> : null}
    </li>
  )
}

function StudyDetails({ study, onChange, onError }: { study: MatrixStudy; onChange: (s: MatrixStudy) => void; onError: (m: string) => void }) {
  const [notes, setNotes] = useState(study.notes ?? '')
  const [themes, setThemes] = useState(study.themes.join(', '))
  const [saved, setSaved] = useState<string | null>(null)
  const save = async (patch: { notes?: string; design?: string; themes?: string[] }, what: string) => {
    try { onChange(await literatureMatrixApi.updateStudy(study.id, patch)); setSaved(`${what} saved.`) }
    catch (e) { onError(failureMessage(e, 'save')) }
  }
  const themeList = () => themes.split(',').map(t => t.trim()).filter(Boolean)
  return (
    <section aria-labelledby="ev-notes" className="space-y-3">
      <h3 id="ev-notes" className="text-[14px] font-semibold text-slate-900">Your notes</h3>
      <label className="block text-[13px]">
        Notes <span className="text-slate-600">(saved when you leave the box)</span>
        <textarea rows={3} value={notes} maxLength={MAX_NOTES_CHARS} onChange={e => setNotes(e.target.value)}
          onBlur={() => { if (notes.trim() !== (study.notes ?? '')) save({ notes }, 'Notes') }} className="mt-1 w-full rounded-lg border border-slate-300 p-2" />
      </label>
      <label className="block text-[13px]">
        Themes <span className="text-slate-600">(separate with commas)</span>
        <input value={themes} onChange={e => setThemes(e.target.value)}
          onBlur={() => { if (themeList().join('|') !== study.themes.join('|')) save({ themes: themeList() }, 'Themes') }} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5" />
      </label>
      <label className="block text-[13px]">
        Study design
        <select value={study.design ?? ''} onChange={e => save({ design: e.target.value }, 'Study design')} className="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5">
          <option value="">Not set</option>
          {DESIGNS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </label>
      <p role="status" className="text-[12px] text-emerald-800">{saved}</p>
    </section>
  )
}

function FullText({ study, matrix, onChange, onError }: { study: MatrixStudy; matrix: Matrix; onChange: (s: MatrixStudy) => void; onError: (m: string) => void }) {
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const upload = async (file: File | undefined) => {
    if (!file) return
    const problem = validateUpload(file)
    if (problem) { onError(problem); return }
    setBusy(true)
    try { onChange(await literatureMatrixApi.attachFullText(study.id, file, consent || matrix.consentAccepted)) }
    catch (e) { onError(failureMessage(e, 'upload')) }
    finally { setBusy(false) }
  }
  const remove = async () => {
    setBusy(true)
    try { onChange(await literatureMatrixApi.removeFullText(study.id)) } catch (e) { onError(failureMessage(e, 'delete')) } finally { setBusy(false) }
  }
  // Looking for a free copy is free (no model call, no credits) and only possible with a DOI.
  const [finding, setFinding] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const find = async () => {
    setFinding(true); setNotFound(false)
    try {
      const result = await literatureMatrixApi.findFullText(study.id)
      if (result.found) onChange(result.study); else setNotFound(true)
    } catch (e) { onError(failureMessage(e, 'load')) }
    finally { setFinding(false) }
  }
  const foundAutomatically = study.uploadedFileName === OPEN_ACCESS_SOURCE_LABEL
  return (
    <section aria-labelledby="ev-fulltext" className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-[13px]">
      <h3 id="ev-fulltext" className="font-semibold text-slate-900">Full text</h3>
      {study.material === 'FullText' ? (
        <p className="[overflow-wrap:anywhere]">
          {foundAutomatically ? 'From a free open-access copy found by its DOI.' : `From ${study.uploadedFileName ?? 'an uploaded file'}.`}{' '}
          <button type="button" className={buttonClass.link} disabled={busy} onClick={remove}>Remove the text</button>
        </p>
      ) : (
        <>
          {study.doi ? (
            <div className="space-y-1">
              <p>Many papers have a free, legal copy online. Looking for one costs nothing.</p>
              <button type="button" className={buttonClass.secondary} disabled={finding || busy} onClick={find}>
                {finding ? 'Looking for a free copy…' : 'Find a free copy'}
              </button>
              <p role="status" className="text-[12px] text-slate-700">
                {finding ? 'This can take up to a minute.' : notFound ? 'No free copy was found. Upload the paper instead.' : ''}
              </p>
            </div>
          ) : null}
          <p>Upload the paper (PDF or Word) so methods, sample and limitations can be checked against the full text. Scanned PDFs cannot be read.</p>
          {!matrix.consentAccepted ? <ConsentNotice checked={consent} onChange={setConsent} retentionDays={matrix.retentionDays} id={`ev-consent-${study.id}`} /> : null}
          <label className={buttonClass.secondary + ' cursor-pointer'}>
            {busy ? 'Uploading…' : 'Choose a file'}
            <input type="file" accept=".pdf,.docx" className="sr-only" disabled={busy || (!matrix.consentAccepted && !consent)} onChange={e => { upload(e.target.files?.[0]); e.target.value = '' }} />
          </label>
        </>
      )}
      {study.material === 'FullText' && study.extractionState === 'Extracted' ? <p className="text-slate-700">Run Extract again to read the new text. Your own values are kept.</p> : null}
    </section>
  )
}

function DuplicateDecision({ study, onDone, onKept, onError }: { study: MatrixStudy; onDone: () => void; onKept: () => void; onError: (m: string) => void }) {
  const [busy, setBusy] = useState(false)
  const decide = async (action: 'merge' | 'keep') => {
    setBusy(true)
    try { await literatureMatrixApi.resolveDuplicate(study.id, action); if (action === 'merge') onDone(); else onKept() }
    catch (e) { onError(failureMessage(e, 'save')) }
    finally { setBusy(false) }
  }
  return (
    <section className="rounded-lg border border-amber-400 bg-amber-50 p-3 text-[13px] text-amber-950">
      <p className="font-semibold">Possible duplicate</p>
      <p className="mt-1">{study.possibleDuplicateReason ?? 'This looks like another study in the matrix.'} Different editions and versions are kept apart unless you merge them.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className={buttonClass.secondary} disabled={busy} onClick={() => decide('keep')}>They are different: keep both</button>
        <button type="button" className={buttonClass.secondary} disabled={busy} onClick={() => decide('merge')}>Same publication: merge</button>
      </div>
    </section>
  )
}

function RemoveStudy({ study, onRemoved, onError }: { study: MatrixStudy; onRemoved: () => void; onError: (m: string) => void }) {
  const { confirm: ask, dialog } = useConfirm()
  const remove = async () => {
    const ok = await ask({
      title: 'Remove this study from the matrix?',
      message: 'Its extracted values and any uploaded text are deleted. The paper stays in Saved Sources.',
      confirmLabel: 'Remove study',
      tone: 'danger',
    })
    if (!ok) return
    try { await literatureMatrixApi.removeStudy(study.id); onRemoved() } catch (e) { onError(failureMessage(e, 'delete')) }
  }
  return <><button type="button" className={buttonClass.danger} onClick={() => void remove()}>Remove from matrix</button>{dialog}</>
}
