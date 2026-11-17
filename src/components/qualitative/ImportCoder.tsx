import { useState, type FormEvent } from 'react'
import { errorMessage, qualApi, type QualCoderImport } from '../../api/qualitativeAnalysis'
import { Notice, PrimaryButton, SecondaryButton, inputClass, labelClass } from './ui'

/**
 * For a coder who works outside the tool: download a template with one row per participant turn and one column per
 * code, have them put 1 (or x) where a code applies, and import it. All or nothing: a file with any problem is not
 * stored, and the message says what to fix.
 */
export function ImportCoder({ studyId, onImported }: { studyId: string; onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [label, setLabel] = useState('')
  const [ack, setAck] = useState(false)
  const [busy, setBusy] = useState<'template' | 'import' | null>(null)
  const [result, setResult] = useState<QualCoderImport | null>(null)
  const [error, setError] = useState<string | null>(null)

  const template = async () => {
    if (!ack) { setError('Confirm the statement first: the template holds the de-identified text of every participant turn.'); return }
    setBusy('template'); setError(null)
    try { await qualApi.download(studyId, 'coding-template') } catch (e) { setError(errorMessage(e, 'The template could not be produced.')) } finally { setBusy(null) }
  }
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(null); setResult(null)
    if (!file) { setError('Choose the filled-in template.'); return }
    setBusy('import')
    try { setResult(await qualApi.importCoder(studyId, file, label.trim())); setFile(null); setLabel(''); onImported() }
    catch (err) { setError(errorMessage(err, 'The file could not be imported.')) } finally { setBusy(null) }
  }

  return (
    <div className="max-w-2xl space-y-3 rounded-xl border border-slate-200 p-4 text-[14px]">
      <p className="text-[13px] text-slate-800">
        For a second coder without an account. The template has one row per participant turn of every confirmed transcript and one column per code in your codebook.
        They put <strong>1</strong> or <strong>x</strong> where a code applies and leave the rest empty. Do not change the first seven columns. If you change the codebook or replace text in a transcript afterwards, download a new template.
      </p>
      <label className="flex items-start gap-2 text-[13px] text-slate-900">
        <input type="checkbox" className="mt-0.5" checked={ack} onChange={e => setAck(e.target.checked)} />
        <span>My ethics approval and my participants’ consent allow this person to receive the de-identified transcripts as a file.</span>
      </label>
      <SecondaryButton onClick={template} disabled={busy !== null}>{busy === 'template' ? 'Preparing…' : 'Download the coding template (.csv)'}</SecondaryButton>
      <form onSubmit={submit} className="space-y-2 border-t border-slate-200 pt-3" noValidate>
        <div><label htmlFor="qa-imp-file" className={labelClass}>Filled-in template</label><input id="qa-imp-file" type="file" accept=".csv,text/csv" onChange={e => setFile(e.target.files?.[0] ?? null)} className="block text-[14px]" /></div>
        <div><label htmlFor="qa-imp-label" className={labelClass}>Name for this coder (optional)</label><input id="qa-imp-label" value={label} maxLength={40} onChange={e => setLabel(e.target.value)} className={inputClass} placeholder="For example: Coder B (paper)" /></div>
        <PrimaryButton type="submit" disabled={busy !== null || !file}>{busy === 'import' ? 'Importing…' : 'Import'}</PrimaryButton>
      </form>
      {error && <Notice tone="error">{error}</Notice>}
      {result && (
        <Notice tone="success">
          Imported as {result.coder.label}: {result.turns} turns, {result.passages} coded, {result.transcriptsFinished} transcript{result.transcriptsFinished === 1 ? '' : 's'} complete and ready to compare.
          {result.warnings.map(w => <span key={w} className="mt-1 block text-amber-950">{w}</span>)}
        </Notice>
      )}
    </div>
  )
}
