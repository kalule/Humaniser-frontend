import { useEffect, useState } from 'react'
import { errorMessage, qualApi, type ExportKind, type QualMethodsText, type QualStudy } from '../../api/qualitativeAnalysis'
import { Skeleton } from '../ui/Skeleton'
import { Notice, SecondaryButton, Section } from './ui'

const EXPORTS: { kind: ExportKind; format?: 'docx' | 'md'; label: string; hint: string }[] = [
  { kind: 'report', format: 'docx', label: 'Report (.docx)', hint: 'Themes with their codes, counts and verified quotes, the draft method text and the AI-use statement.' },
  { kind: 'report', format: 'md', label: 'Report (.md)', hint: 'The same report as plain text.' },
  { kind: 'codebook', label: 'Codebook (.csv)', hint: 'Every code with its definition, notes, counts and themes.' },
  { kind: 'excerpts', label: 'Coded passages (.csv)', hint: 'Every passage you coded, with its code, speaker and turn.' },
  { kind: 'quotes', label: 'Quotes (.csv)', hint: 'Verified quotes only.' },
  { kind: 'statistics', label: 'Counts (.csv)', hint: 'Counts per code, codes used together, and coverage.' },
  { kind: 'audit', label: 'Record of the analysis (.csv)', hint: 'Every change, in order, with the check that it was not altered.' },
]

/** The draft methods text, the AI-use statement and the exports. Everything is built from the study's stored records. */
export function ReportTab({ study }: { study: QualStudy }) {
  const [methods, setMethods] = useState<QualMethodsText | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  useEffect(() => { qualApi.methodsText(study.id).then(setMethods).catch(e => setError(errorMessage(e, 'The methods text could not be built.'))) }, [study.id])

  const copy = async (key: string, text: string) => { try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 2000) } catch { setCopied(null) } }
  const download = async (kind: ExportKind, format?: 'docx' | 'md') => {
    const key = kind + (format ?? ''); setBusy(key); setError(null)
    try { await qualApi.download(study.id, kind, format) } catch (e) { setError(errorMessage(e, 'The file could not be produced.')) } finally { setBusy(null) }
  }

  return (
    <>
      <Section title="Method (draft)" id="qa-methods" actions={methods ? <SecondaryButton onClick={() => copy('m', methods.text)}>{copied === 'm' ? 'Copied' : 'Copy'}</SecondaryButton> : undefined}>
        {error && <Notice tone="error" className="mb-2">{error}</Notice>}
        {methods === null ? !error && <Skeleton lines={4} tone="light" /> : (
          <>
            <p className="max-w-3xl whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-4 text-[15px] leading-relaxed text-slate-900">{methods.text}</p>
            <ul className="mt-2 max-w-3xl list-disc space-y-1 pl-5 text-[13px] text-slate-800">{methods.notes.map(n => <li key={n}>{n}</li>)}</ul>
          </>
        )}
      </Section>
      {methods && (
        <Section title="Use of AI" id="qa-disclosure" actions={<SecondaryButton onClick={() => copy('d', methods.disclosure)}>{copied === 'd' ? 'Copied' : 'Copy'}</SecondaryButton>}>
          <p className="max-w-3xl rounded-xl border border-slate-200 bg-white p-4 text-[15px] leading-relaxed text-slate-900">{methods.disclosure}</p>
          <p className="mt-1 text-[12px] text-slate-700">Built from the record of every suggestion and every coded passage in this study.</p>
        </Section>
      )}
      <Section title="Download" id="qa-exports">
        <p className="mb-2 max-w-3xl text-[13px] text-slate-800">Files hold de-identified text only. The identifier key is never exported, and a quote that no longer matches the transcript is left out. Each download is recorded.</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {EXPORTS.map(x => (
            <li key={x.kind + (x.format ?? '')} className="rounded-xl border border-slate-200 p-3">
              <SecondaryButton disabled={busy !== null} onClick={() => download(x.kind, x.format)}>{busy === x.kind + (x.format ?? '') ? 'Preparing…' : x.label}</SecondaryButton>
              <p className="mt-1 text-[12px] text-slate-700">{x.hint}</p>
            </li>
          ))}
        </ul>
      </Section>
    </>
  )
}
