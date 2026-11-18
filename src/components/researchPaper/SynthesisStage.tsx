import { useCallback, useEffect, useState } from 'react'
import { Layers } from 'lucide-react'
import { researchPaperApi } from '../../api/researchPaper'
import { useRunPoll } from '../../hooks/useRunPoll'
import { Chip, Loading, Notice, Panel, RunBanner } from '../literatureReview/ui'
import { btn } from '../literatureReview/styles'
import { errorMessage, EVIDENCE_LABELS, isRunActive, type Gap, type Paper, type SynthesisTable } from '../../lib/researchPaper'

/**
 * Stage 4: themes from approved evidence only, shown as a table before any prose: per theme, each source's stance,
 * evidence level and design, and what that evidence can carry. Research gaps are listed apart from limits of the search.
 */
export function SynthesisStage({ paper, onNext }: { paper: Paper; onNext: () => void }) {
  const [table, setTable] = useState<SynthesisTable | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => {
    researchPaperApi.synthesisTable(paper.id).then(setTable).catch(e => setError(errorMessage(e, 'The synthesis could not be loaded.')))
  }, [paper.id])
  useEffect(load, [load])
  const fetchRun = useCallback(() => researchPaperApi.synthesisRun(paper.id), [paper.id])
  const run = useRunPoll(fetchRun, load)
  const approved = paper.status !== 'Question' && paper.status !== 'Evidence' && paper.status !== 'Screening'

  const start = async () => {
    setBusy(true); setError(null)
    try { run.setRun(await researchPaperApi.synthesise(paper.id)) } catch (e) { setError(errorMessage(e, 'The synthesis could not be started.')) } finally { setBusy(false) }
  }
  const gap = async (g: Gap, status: 'Accepted' | 'Dismissed') => {
    try { await researchPaperApi.updateGap(paper.id, g.id, status); load() } catch (e) { setError(errorMessage(e, 'The gap could not be updated.')) }
  }

  return (
    <div className="space-y-4">
      {paper.studentMode ? <Notice tone="info">A synthesis compares studies rather than summarising them one by one. Check each theme's notes: they say how much the evidence can carry.</Notice> : null}
      <Panel title="Themes" id="rp-synth" description="Built from the passages of your approved sources. A theme statement is kept only when passages from at least two sources support it."
        actions={<button type="button" onClick={() => void start()} disabled={busy || !approved || isRunActive(run.run)} className={btn.primary}><Layers size={16} aria-hidden /> {table?.themes.length ? 'Find themes again' : 'Find themes'}</button>}>
        {!approved ? <Notice tone="warning">Approve your screened sources first; the synthesis uses approved evidence only.</Notice> : null}
        <RunBanner run={run.run} label="Synthesis" />
        {table ? table.notes.map(n => <p key={n} className="mt-2 text-[13px] text-slate-700">{n}</p>) : <Loading />}
      </Panel>

      {table?.themes.map(t => (
        <Panel key={t.themeId} title={t.title} id={`rp-theme-${t.themeId}`} description={t.summary ?? undefined}
          actions={<Chip className={t.draftable ? 'border-green-300 bg-green-50 text-green-900' : 'border-amber-300 bg-amber-50 text-amber-950'}>{t.draftable ? 'Can be drafted' : 'Not enough verified evidence'}</Chip>}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-[13px]">
              <thead className="text-slate-600"><tr><th className="py-1 pr-3 font-medium">Source</th><th className="py-1 pr-3 font-medium">Stance</th><th className="py-1 pr-3 font-medium">Evidence</th><th className="py-1 font-medium">Design</th></tr></thead>
              <tbody>
                {t.sources.map(s => (
                  <tr key={s.literatureId} className="border-t border-slate-100 align-top text-slate-900">
                    <td className="py-1.5 pr-3 [overflow-wrap:anywhere]">{s.title}{s.year ? ` (${s.year})` : ''}</td>
                    <td className="py-1.5 pr-3">{s.stance}</td><td className="py-1.5 pr-3">{EVIDENCE_LABELS[s.evidenceLevel]}</td><td className="py-1.5">{s.design ?? 'Not classified'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[13px] text-slate-700">
            {Object.entries(t.pointCounts).map(([k, n]) => `${n} ${k.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()}`).join(' · ') || 'No verified points'}
            {t.unverifiedPoints ? ` · ${t.unverifiedPoints} statement${t.unverifiedPoints === 1 ? '' : 's'} failed the evidence check` : ''}
          </p>
          {t.qualityNotes.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-slate-900">{t.qualityNotes.map(n => <li key={n}>{n}</li>)}</ul> : null}
        </Panel>
      ))}

      {table && (table.researchGaps.length > 0 || table.coverageLimits.length > 0) ? (
        <Panel title="Gaps" id="rp-gaps">
          {table.researchGaps.length ? <h3 className="text-[14px] font-semibold text-slate-900">Research gaps the evidence supports</h3> : null}
          <ul className="mt-1 space-y-2">
            {table.researchGaps.map(g => (
              <li key={g.id} className="rounded-lg border border-slate-200 p-2 text-[13px] text-slate-900">
                <p>{g.explanation}</p>
                <div className="mt-1 flex gap-2">
                  <button type="button" className={btn.small} disabled={g.status === 'Accepted'} onClick={() => void gap(g, 'Accepted')}>{g.status === 'Accepted' ? 'Accepted' : 'Accept'}</button>
                  <button type="button" className={btn.small} onClick={() => void gap(g, 'Dismissed')}>Dismiss</button>
                </div>
              </li>
            ))}
          </ul>
          {table.coverageLimits.length ? (
            <>
              <h3 className="mt-3 text-[14px] font-semibold text-slate-900">Limits of this search (not gaps in the literature)</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-[13px] text-slate-900">{table.coverageLimits.map(g => <li key={g.id}>{g.explanation}</li>)}</ul>
            </>
          ) : null}
        </Panel>
      ) : null}

      {error ? <Notice tone="error">{error}</Notice> : null}
      <button type="button" onClick={onNext} disabled={!table?.themes.some(t => t.draftable)} className={btn.primary}>Continue to writing</button>
    </div>
  )
}
