import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { errorMessage, qualApi, type QualAvailability, type QualStudy, type QualTranscript } from '../../api/qualitativeAnalysis'
import { Skeleton } from '../ui/Skeleton'
import { Notice, Pill, PrimaryButton, SecondaryButton, Section, date, inputClass, labelClass } from './ui'

const STATUS: Record<string, { label: string; tone: 'slate' | 'amber' | 'emerald' }> = {
  Imported: { label: 'Needs de-identification', tone: 'amber' },
  InReview: { label: 'In review', tone: 'amber' },
  Ready: { label: 'Ready to code', tone: 'emerald' },
}

export function TranscriptsTab({ study, features, onChange }: { study: QualStudy; features: QualAvailability; onChange: () => void }) {
  const [transcripts, setTranscripts] = useState<QualTranscript[] | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const load = () => { setFailed(null); qualApi.listTranscripts(study.id).then(setTranscripts).catch(e => setFailed(errorMessage(e, 'The transcripts could not be loaded.'))) }
  useEffect(load, [study.id])
  const full = (transcripts?.length ?? 0) >= features.maxTranscriptsPerStudy

  return (
    <>
      <Section title="Transcripts" id="qa-transcripts">
        {failed && <Notice tone="error">{failed}</Notice>}
        {transcripts === null && !failed ? <Skeleton lines={3} tone="light" /> : transcripts && transcripts.length === 0 ? (
          <p className="text-[14px] text-slate-700">No transcripts yet. Import one below.</p>
        ) : transcripts && (
          <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200">
            {transcripts.map(t => (
              <li key={t.id}>
                <Link to={`/app/qualitative-analysis/${study.id}/transcripts/${t.id}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-accent/40">
                  <span className="min-w-0 text-[15px] font-semibold text-purple-deep underline [overflow-wrap:anywhere]">{t.label}</span>
                  <span className="flex flex-wrap items-center gap-2 text-[13px] text-slate-700">
                    <Pill tone={STATUS[t.status]?.tone ?? 'slate'}>{STATUS[t.status]?.label ?? t.status}</Pill>
                    {t.wordCount.toLocaleString()} words{t.status === 'Ready' ? `, ${t.participantWordCount.toLocaleString()} from participants` : ''} · imported {date(t.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
      {study.myRole === 'Owner' && <Section title="Import a transcript" id="qa-import">
        {full ? <Notice>This study holds the most transcripts allowed ({features.maxTranscriptsPerStudy}).</Notice> : <ImportForm study={study} features={features} onImported={() => { load(); onChange() }} />}
      </Section>}
    </>
  )
}

function ImportForm({ study, features, onImported }: { study: QualStudy; features: QualAvailability; onImported: () => void }) {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'paste' | 'file'>('paste')
  const [label, setLabel] = useState('')
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (mode === 'paste' && !text.trim()) { setError('Paste the transcript text.'); return }
    if (mode === 'file' && !file) { setError('Choose a file.'); return }
    setBusy(true)
    try {
      const review = mode === 'paste' ? await qualApi.importText(study.id, label.trim(), text) : await qualApi.importFile(study.id, file!, label.trim())
      onImported()
      navigate(`/app/qualitative-analysis/${study.id}/transcripts/${review.id}`)
    } catch (err) { setError(errorMessage(err, 'The transcript could not be imported.')) } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-3 rounded-xl border border-slate-200 p-4" noValidate>
      <p className="text-[13px] text-slate-800">
        Nothing is sent to any AI model when you import. Next you will say who each speaker is and list the names to replace. Up to {features.maxTranscriptWords.toLocaleString()} words; {features.fileTypes.join(', ')} files, or paste the text.
        Each turn should start on a new line with the speaker’s label, for example <code className="rounded bg-slate-100 px-1">Interviewer:</code> or <code className="rounded bg-slate-100 px-1">P1:</code>.
      </p>
      <div role="radiogroup" aria-label="How to import" className="flex gap-4 text-[14px] text-slate-900">
        <label className="flex items-center gap-1.5"><input type="radio" checked={mode === 'paste'} onChange={() => setMode('paste')} /> Paste text</label>
        <label className="flex items-center gap-1.5"><input type="radio" checked={mode === 'file'} onChange={() => setMode('file')} /> Upload a file</label>
      </div>
      <div>
        <label htmlFor="qa-label" className={labelClass}>Label (optional)</label>
        <input id="qa-label" value={label} onChange={e => setLabel(e.target.value)} maxLength={120} className={inputClass} placeholder="For example: Interview 3" aria-describedby="qa-label-hint" />
        <p id="qa-label-hint" className="mt-1 text-[12px] text-slate-700">Do not use a participant’s name.</p>
      </div>
      {mode === 'paste' ? (
        <div>
          <label htmlFor="qa-text" className={labelClass}>Transcript text</label>
          <textarea id="qa-text" value={text} onChange={e => setText(e.target.value)} rows={10} className={inputClass} spellCheck={false} />
        </div>
      ) : (
        <div>
          <label htmlFor="qa-file" className={labelClass}>File</label>
          <input id="qa-file" type="file" accept={features.fileTypes.join(',')} onChange={e => setFile(e.target.files?.[0] ?? null)} className="block text-[14px] text-slate-900" />
          <p className="mt-1 text-[12px] text-slate-700">Scanned PDFs (images of pages) cannot be read. The file itself is not kept.</p>
        </div>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex gap-2">
        <PrimaryButton type="submit" disabled={busy}>{busy ? 'Importing…' : 'Import'}</PrimaryButton>
        {(text || file || label) && <SecondaryButton onClick={() => { setText(''); setFile(null); setLabel(''); setError(null) }} disabled={busy}>Clear</SecondaryButton>}
      </div>
    </form>
  )
}
