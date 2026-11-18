import { useCallback, useEffect, useState } from 'react'
import { BadgeCheck, Search, Sparkles } from 'lucide-react'
import { researchPaperApi } from '../../api/researchPaper'
import { researchApi } from '../../api/research'
import { useRunPoll } from '../../hooks/useRunPoll'
import { Chip, Loading, Notice, Panel, RunBanner } from '../literatureReview/ui'
import { btn } from '../literatureReview/styles'
import { DOI_LABELS, errorMessage, EVIDENCE_LABELS, isRunActive, type EvidenceStatus, type Paper, type PaperSource, type SearchLog } from '../../lib/researchPaper'
import type { DiscoveryStatus } from '../../types/research'

/**
 * Stage 2: the multi-database search on the approved question, its log, the evidence target, semantic ranking, DOI
 * checks and extraction. Too few sources is shown as a limit of this search, with ways to broaden it, never as a gap.
 */
export function EvidenceStage({ paper, onChanged, onNext }: { paper: Paper; onChanged: (p?: Paper) => void; onNext: () => void }) {
  const [status, setStatus] = useState<EvidenceStatus | null>(null)
  const [log, setLog] = useState<SearchLog | null>(null)
  const [sources, setSources] = useState<PaperSource[] | null>(null)
  const [discovery, setDiscovery] = useState<DiscoveryStatus | null>(null)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const load = useCallback(() => {
    researchPaperApi.evidenceStatus(paper.id).then(setStatus).catch(e => setError(errorMessage(e, 'The search status could not be loaded.')))
    researchPaperApi.searchLog(paper.id).then(setLog).catch(() => setLog(null))
    researchPaperApi.sources(paper.id).then(setSources).catch(() => setSources([]))
  }, [paper.id])
  useEffect(load, [load])

  // The discovery job reports its own progress; poll it while it runs.
  useEffect(() => {
    if (status?.state !== 'Searching') return
    const timer = window.setInterval(async () => {
      try {
        const d = await researchApi.getDiscoveryStatus(paper.researchProjectId)
        setDiscovery(d)
        if (d.status !== 'Running') { window.clearInterval(timer); load(); onChanged() }
      } catch { /* keep the last status */ }
    }, 3000)
    return () => window.clearInterval(timer)
  }, [status?.state, paper.researchProjectId, load, onChanged])

  const fetchVerify = useCallback(() => researchPaperApi.latestRun(paper.id, 'VerifySources'), [paper.id])
  const verify = useRunPoll(fetchVerify, load)
  const fetchRank = useCallback(() => researchPaperApi.latestRun(paper.id, 'RankCandidates'), [paper.id])
  const rank = useRunPoll(fetchRank, load)

  const act = async (fn: () => Promise<void>, failure: string) => {
    setBusy(true); setError(null); setNote(null)
    try { await fn() } catch (e) { setError(errorMessage(e, failure)) } finally { setBusy(false) }
  }

  if (!status) return <Panel>{error ? <Notice tone="error">{error}</Notice> : <Loading />}</Panel>
  const searching = status.state === 'Searching'

  return (
    <div className="space-y-4">
      {!paper.questionApproved ? <Notice tone="warning">Approve your research question first. The search runs only on the question you approved.</Notice> : null}
      {paper.studentMode ? <Notice tone="info">The studio searches several databases with queries built from your question. Every search is logged, so your methods section can say exactly what was searched.</Notice> : null}

      <Panel title="Search" id="rp-search" description={status.message}
        actions={<button type="button" disabled={busy || searching || !paper.questionApproved} onClick={() => void act(async () => { setStatus(await researchPaperApi.search(paper.id)) }, 'The search could not be started.')} className={btn.primary}>
          <Search size={16} aria-hidden /> {status.state === 'NotSearched' ? 'Search the databases' : 'Search again'}</button>}>
        {searching ? <Notice tone="info" role="status">{discovery?.liveActivityMessage || discovery?.statusMessage || 'Searching…'}{discovery ? ` (${discovery.progressPct}%)` : ''}</Notice> : null}
        <p className="mt-2 text-[14px] text-slate-800">{status.includedSources} included · {status.candidateSources} found · target {status.minSourceTarget}</p>
        {status.isCoverageLimit ? <div className="mt-3"><Notice tone="warning">{status.message}</Notice></div> : null}
        {status.suggestions.length ? (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-[14px] text-slate-900">{status.suggestions.map(s => <li key={s.code}>{s.message}</li>)}</ul>
        ) : null}
      </Panel>

      {log && log.entries.length > 0 ? (
        <Panel title="Search log" id="rp-log" description={`${log.totalRecords} records from ${log.databasesSearched.join(', ')}; ${log.duplicates} duplicates removed.`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[13px]">
              <thead className="text-slate-600"><tr><th className="py-1 pr-3 font-medium">Search</th><th className="py-1 pr-3 font-medium">Database</th><th className="py-1 pr-3 font-medium">Date</th><th className="py-1 pr-3 font-medium">Records</th><th className="py-1 font-medium">Outcome</th></tr></thead>
              <tbody className="text-slate-900">
                {log.entries.map((e, i) => (
                  <tr key={i} className="border-t border-slate-100 align-top">
                    <td className="py-1.5 pr-3 [overflow-wrap:anywhere]">{e.query}</td><td className="py-1.5 pr-3">{e.database}</td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">{e.searchedAt.slice(0, 10)}</td><td className="py-1.5 pr-3">{e.resultCount}</td>
                    <td className="py-1.5">{e.outcome === 'Failed' ? <span className="text-red-800">Did not answer</span> : e.outcome === 'NoResults' ? 'Nothing found' : 'Results'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      <Panel title="Order by relevance" id="rp-rank" description="Ranks found records by how closely they match your approved questions. It only orders them; nothing is hidden or excluded."
        actions={<button type="button" disabled={busy || isRunActive(rank.run) || status.candidateSources === 0} onClick={() => void act(async () => { rank.setRun(await researchPaperApi.rank(paper.id)) }, 'Ranking could not be started.')} className={btn.secondary}><Sparkles size={16} aria-hidden /> Rank</button>}>
        <RunBanner run={rank.run} label="Ranking" />
      </Panel>

      {sources && sources.length > 0 ? (
        <Panel title="Included sources" id="rp-sources" description="What each source can support depends on whether its full text was read."
          actions={<button type="button" disabled={busy || isRunActive(verify.run)} onClick={() => void act(async () => { verify.setRun(await researchPaperApi.verifySources(paper.id)) }, 'The check could not be started.')} className={btn.secondary}><BadgeCheck size={16} aria-hidden /> Check DOIs</button>}>
          <RunBanner run={verify.run} label="DOI check" />
          <ul className="mt-2 divide-y divide-slate-100">
            {sources.map(s => (
              <li key={s.id} className="py-2">
                <p className="text-[14px] font-medium text-slate-900 [overflow-wrap:anywhere]">{s.title}</p>
                <p className="text-[13px] text-slate-700">{s.authors || 'No authors listed'}{s.year > 0 ? ` (${s.year})` : ''}{s.journal ? ` · ${s.journal}` : ''}{s.retrievedFrom ? ` · from ${s.retrievedFrom}` : ''}{s.retrievedAt ? ` on ${s.retrievedAt.slice(0, 10)}` : ''}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Chip className={s.evidenceLevel === 'FullText' ? 'border-green-300 bg-green-50 text-green-900' : 'border-amber-300 bg-amber-50 text-amber-950'}>{EVIDENCE_LABELS[s.evidenceLevel]}</Chip>
                  {s.verification ? <Chip className={s.verification === 'Verified' || s.verification === 'SingleRegistry' ? 'border-green-300 bg-green-50 text-green-900' : s.verification === 'NoDoi' ? 'border-slate-300 text-slate-800' : 'border-red-300 bg-red-50 text-red-900'}>{DOI_LABELS[s.verification] ?? s.verification}</Chip> : null}
                  {s.isRetracted ? <Chip className="border-red-300 bg-red-50 text-red-900">Retracted</Chip> : null}
                </div>
                {s.verificationNote && s.verification !== 'Verified' ? <p className="mt-1 text-[12px] text-slate-700">{s.verificationNote}</p> : null}
              </li>
            ))}
          </ul>
          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
            <label className="flex items-start gap-2 text-[14px] text-slate-900">
              <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1" />
              <span>Send these sources' text to the AI to extract their aims, methods, findings, limitations and conclusions, each tied to a passage.</span>
            </label>
            <button type="button" disabled={busy || !consent} onClick={() => void act(async () => { await researchPaperApi.startExtraction(paper.id, true); setNote('Extraction has started. It continues in the background.') }, 'Extraction could not be started.')} className={btn.secondary}>Extract evidence</button>
          </div>
        </Panel>
      ) : null}

      {note ? <Notice tone="success" role="status">{note}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <button type="button" onClick={onNext} disabled={status.candidateSources === 0 && status.includedSources === 0} className={btn.primary}>Continue to screening</button>
    </div>
  )
}
