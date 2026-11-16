import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { studyDesignApi, type CodebookAttachment, type PilotDataset, type PilotReliability as Result } from '../../api/studyDesign'
import type { ApiFieldError } from '../../lib/studyDesign'

interface ApiFailure { code?: string; details?: ApiFieldError[]; response?: { status?: number } }
const three = (value: number | null | undefined) => (typeof value === 'number' ? value.toFixed(3) : '—')

/**
 * Scores the saved questionnaire's scales on a dataset the student uploaded to Data Analyst, and shows Cronbach's
 * alpha for each. Every figure is computed on the server from the codebook and the data. This component formats
 * numbers and never says whether a value is good enough.
 */
export function PilotReliability({ projectId, ready, blockedReason }: { projectId: string; ready: boolean; blockedReason: string | null }) {
  const [datasets, setDatasets] = useState<PilotDataset[] | null>(null)
  const [failedToList, setFailedToList] = useState(false)
  const [datasetId, setDatasetId] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [attachment, setAttachment] = useState<CodebookAttachment | null>(null)
  const [attaching, setAttaching] = useState(false)

  useEffect(() => {
    let cancelled = false
    studyDesignApi.datasets().then(list => { if (!cancelled) setDatasets(list) }).catch(() => { if (!cancelled) { setDatasets([]); setFailedToList(true) } })
    return () => { cancelled = true }
  }, [])
  // A result belongs to the project and questionnaire it was computed for.
  useEffect(() => { setResult(null); setFailure(null); setAttachment(null) }, [projectId])

  const selected = datasets?.find(d => d.id === datasetId) ?? null
  const setCodebook = async (attach: boolean) => {
    setAttaching(true); setFailure(null)
    try {
      const done = attach ? await studyDesignApi.attachCodebook(projectId, datasetId) : await studyDesignApi.detachCodebook(datasetId)
      setAttachment(done)
      setDatasets(list => list?.map(d => (d.id === datasetId ? { ...d, hasCodebook: done.attached } : d)) ?? list)
    } catch (err) {
      const e = err as ApiFailure
      setAttachment(null)
      setFailure(e?.details?.[0]?.message ?? (e?.code === 'STUDY_DESIGN_NOT_FOUND' ? 'That dataset could not be found. It may have been removed.'
        : e?.response?.status === 429 ? 'Too many requests in a short time. Wait a minute and try again.' : 'That could not be done. Try again.'))
    } finally { setAttaching(false) }
  }

  const run = async () => {
    setBusy(true); setFailure(null)
    try { setResult(await studyDesignApi.reliability(projectId, datasetId)) }
    catch (err) {
      const e = err as ApiFailure
      setResult(null)
      setFailure(e?.details?.[0]?.message ?? (e?.code === 'STUDY_DESIGN_NOT_FOUND' ? 'That dataset could not be found. It may have been removed.'
        : e?.response?.status === 429 ? 'Too many requests in a short time. Wait a minute and try again.' : 'The check could not be run. Try again.'))
    } finally { setBusy(false) }
  }

  return (
    <section aria-label="Pilot data" className="rounded-xl border border-slate-200 p-4">
      <h2 className="text-[15px] font-semibold text-slate-900">Pilot data</h2>
      <p className="mt-0.5 text-[12px] leading-snug text-slate-600">
        Upload your pilot responses in <Link to="/app/analyst" className="font-medium text-purple-deep underline">Data Analyst</Link>, with one column per variable name, then choose the file here.
        The data are read to compute the figures below. Study Design stores nothing from them.
      </p>
      {datasets === null ? <p className="mt-2 text-[13px] text-slate-700">Loading your datasets…</p> : null}
      {failedToList ? <p role="alert" className="mt-2 text-[13px] font-medium text-red-700">Your datasets could not be loaded.</p> : null}
      {datasets && datasets.length === 0 && !failedToList ? <p className="mt-2 text-[13px] text-slate-700">You have not uploaded a dataset yet.</p> : null}
      {datasets && datasets.length > 0 ? (
        <div className="mt-2 space-y-2">
          <div>
            <label htmlFor="sdq-pilot-dataset" className="mb-1 block text-[13px] font-medium text-slate-800">Dataset</label>
            <select id="sdq-pilot-dataset" value={datasetId} onChange={e => { setDatasetId(e.target.value); setResult(null); setAttachment(null) }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[14px] text-slate-900 outline-none focus:border-purple-accent focus-visible:ring-2 focus-visible:ring-purple-accent/30">
              <option value="">Choose…</option>
              {datasets.map(d => <option key={d.id} value={d.id}>{d.fileName} ({d.rowCount} rows, {new Date(d.uploadedAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })})</option>)}
            </select>
          </div>
          <button type="button" disabled={!ready || !datasetId || busy} onClick={() => void run()}
            className="inline-flex min-h-9 items-center justify-center rounded-lg border border-purple-accent px-3 text-[13px] font-semibold text-purple-deep hover:bg-purple-tint/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40 disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? 'Checking…' : 'Check scales on this data'}
          </button>
          {blockedReason ? <p className="text-[12px] text-slate-600">{blockedReason}</p> : null}
          {selected ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
              <p className="text-[13px] font-medium text-slate-900">Use this codebook in Data Analyst</p>
              <p className="mt-0.5 text-[12px] leading-snug text-slate-600">
                Tells Data Analyst which columns form each scale, which items are reverse-coded and which values mean "no answer", so its analyses of this file use them. Your data are not changed.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button type="button" disabled={!ready || attaching} onClick={() => void setCodebook(true)}
                  className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40 disabled:cursor-not-allowed disabled:opacity-50">
                  {attaching ? 'Working…' : selected.hasCodebook ? 'Send the codebook again' : 'Send the codebook to Data Analyst'}
                </button>
                {selected.hasCodebook ? (
                  <button type="button" disabled={attaching} onClick={() => void setCodebook(false)} className="min-h-9 rounded-lg px-2 text-[13px] font-medium text-slate-700 underline hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40 disabled:opacity-50">
                    Remove it from this dataset
                  </button>
                ) : null}
              </div>
              <p className="mt-1.5 text-[12px] text-slate-700" aria-live="polite">
                {attachment?.attached ? `Sent. ${attachment.match.matched.length} variable${attachment.match.matched.length === 1 ? '' : 's'} matched to columns (questionnaire version ${attachment.questionnaireVersion}).`
                  : attachment ? 'Removed. Data Analyst no longer has a codebook for this dataset.'
                  : selected.hasCodebook ? 'Data Analyst has a codebook for this dataset. Send it again after you change the questionnaire.' : ''}
              </p>
              {attachment?.attached && attachment.match.variablesNotInDataset.length > 0 ? (
                <p className="mt-1 flex items-start gap-1.5 text-[12px] text-amber-950"><AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>No column named: {attachment.match.variablesNotInDataset.join(', ')}.{attachment.match.namesDifferingOnlyByCase.length > 0 ? ` ${attachment.match.namesDifferingOnlyByCase.join(', ')} differ${attachment.match.namesDifferingOnlyByCase.length === 1 ? 's' : ''} from a column only by capital letters; names must match exactly.` : ''}</span></p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {failure ? <p role="alert" className="mt-2 rounded-lg border border-red-300 bg-red-50 p-2.5 text-[13px] font-medium text-red-800">{failure}</p> : null}

      {result ? (
        <div className="mt-3 space-y-3" aria-live="polite">
          <p className="text-[12px] text-slate-600">{result.fileName} · {result.report.nRows} rows · questionnaire version {result.questionnaireVersion} · {result.report.formulaName} ({result.report.formulaVersion})</p>
          {result.report.variablesNotInDataset.length > 0 ? (
            <p className="flex items-start gap-1.5 rounded-lg border border-amber-300 bg-amber-50 p-2 text-[13px] text-amber-950"><AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>Not in the dataset: {result.report.variablesNotInDataset.join(', ')}. Column names must match the variable names exactly.</span></p>
          ) : null}
          {result.report.scales.map(s => (
            <div key={s.name} className="rounded-lg border border-slate-200 p-3">
              <h3 className="text-[14px] font-semibold text-slate-900">{s.label} <span className="font-normal text-slate-600">({s.name})</span></h3>
              {s.alpha !== null && s.alpha !== undefined ? (
                <p className="mt-1 text-[14px] text-slate-900">Cronbach&apos;s alpha <strong className="text-lg">{three(s.alpha)}</strong> <span className="text-[13px] text-slate-700">from {s.nComplete} of {s.nRows} responses complete on all {s.items.length} items</span></p>
              ) : <p className="mt-1 flex items-start gap-1.5 text-[13px] font-medium text-amber-950"><AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />{s.reason}</p>}
              {s.scoreMean !== null && s.scoreMean !== undefined ? <p className="text-[13px] text-slate-700">Scale score (mean of items): mean {three(s.scoreMean)}, SD {three(s.scoreSd)}, on a scale of {s.scaleMin} to {s.scaleMax}.</p> : null}
              {s.notes.length > 0 ? <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px] text-slate-800">{s.notes.map((n, i) => <li key={i}>{n.text}</li>)}</ul> : null}
              {s.items.length > 0 ? (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[21rem] text-left text-[12px]">
                    <caption className="sr-only">Item statistics for {s.label}: whether the item is reverse-coded, usable answers, answers left out, item–rest correlation, and alpha if the item is removed</caption>
                    <thead><tr className="border-b border-slate-200 align-bottom text-slate-700">
                      <th scope="col" className="py-1 pr-2 font-medium">Item</th><th scope="col" className="py-1 pr-2 font-medium">Reversed</th><th scope="col" className="py-1 pr-2 font-medium">Usable</th>
                      <th scope="col" className="py-1 pr-2 font-medium">Left out</th><th scope="col" className="py-1 pr-2 font-medium">Item–rest r</th>
                      <th scope="col" className="py-1 font-medium"><abbr title="Alpha if this item is removed" className="no-underline">α if removed</abbr></th>
                    </tr></thead>
                    <tbody>{s.items.map(i => (
                      <tr key={i.variable} className="border-b border-slate-100 text-slate-900">
                        <th scope="row" className="py-1 pr-2 font-mono font-normal">{i.variable}</th><td className="py-1 pr-2">{i.reverseCoded ? 'Yes' : 'No'}</td><td className="py-1 pr-2">{i.nValid}</td>
                        <td className="py-1 pr-2">{i.nMissing + i.nOutOfRange + i.nNotANumber}</td><td className="py-1 pr-2">{three(i.itemRestCorrelation)}</td><td className="py-1">{three(i.alphaIfDeleted)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ))}
          {result.report.scales.length === 0 ? <p className="text-[13px] text-slate-700">The questionnaire has no scales to score.</p> : null}
          <ul className="list-disc space-y-0.5 pl-5 text-[12px] text-slate-700">{result.report.assumptions.map(a => <li key={a.code}>{a.text}</li>)}</ul>
        </div>
      ) : null}
    </section>
  )
}
