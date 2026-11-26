import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, CheckCircle2, Pencil, Scissors, Trash2, TriangleAlert } from 'lucide-react'
import { literatureReviewApi } from '../../api/literatureReview'
import { useConfirm } from '../ui/ConfirmDialog'
import { errorMessage, isRunActive, type Gap, type Outline, type PoolSource, type Review, type Theme } from '../../lib/literatureReview'
import { Chip, Loading, Notice, Panel, RunBanner } from './ui'
import { btn, inputClass } from './styles'
import { useRunPoll } from '../../hooks/useRunPoll'
import { SourceCheckPanel, ThinThemeBar } from './SourceCheck'
import { useSourceCheck } from '../../hooks/useSourceCheck'

const KIND_LABELS: Record<string, string> = {
  Agreement: 'Agreement', Contradiction: 'Contradiction', MethodDifference: 'Methods differ', TheoryDifference: 'Theories differ',
  Limitation: 'Limitation', UnderexploredContext: 'Under-studied context', Trend: 'Change over time',
}
const STANCES = ['Supports', 'Contradicts', 'Mixed', 'Context']

/**
 * Step 4: themes across the sources, each point checked word for word against the extracted passages. Points that
 * failed the checks are shown with the reason and are never used in the draft. Gaps sit beside the themes.
 */
export function ThemesStep({ review, onChanged, onNext }: { review: Review; onChanged: () => void; onNext: () => void }) {
  const [themes, setThemes] = useState<Theme[] | null>(null)
  const [gaps, setGaps] = useState<Gap[]>([])
  const [pool, setPool] = useState<PoolSource[]>([])
  const [outline, setOutline] = useState<Outline | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { confirm, dialog } = useConfirm()
  const [checkKey, setCheckKey] = useState(0)
  const { check } = useSourceCheck(review.id, checkKey)

  const load = useCallback(async () => {
    try {
      const [t, g, p, o] = await Promise.all([literatureReviewApi.themes(review.id), literatureReviewApi.gaps(review.id), literatureReviewApi.sources(review.id), literatureReviewApi.outline(review.id)])
      setThemes(t); setGaps(g); setPool(p); setOutline(o); setCheckKey(k => k + 1)
    } catch (e) { setError(errorMessage(e, 'The themes could not be loaded.')) }
  }, [review.id])
  useEffect(() => { void load() }, [load])
  const fetchRun = useCallback(() => literatureReviewApi.latestRun(review.id, 'Themes'), [review.id])
  const { run, setRun } = useRunPoll(fetchRun, () => { void load(); onChanged() })

  const act = async (fn: () => Promise<unknown>, fallback: string) => {
    setBusy(true)
    setError(null)
    try { await fn(); await load(); onChanged() } catch (e) { setError(errorMessage(e, fallback)) } finally { setBusy(false) }
  }
  const synthesise = async () => {
    if (themes && themes.length > 0 && !(await confirm({ title: 'Find themes again?', message: 'Themes found by AI are replaced. Themes you created or edited are kept. This uses 10 credits.', confirmLabel: 'Find themes again' }))) return
    setBusy(true)
    setError(null)
    try { setRun(await literatureReviewApi.synthesise(review.id)) } catch (e) { setError(errorMessage(e, 'Themes could not be started.')) } finally { setBusy(false) }
  }
  const buildOutline = () => act(async () => setOutline(await literatureReviewApi.buildOutline(review.id)), 'The outline could not be built.')

  if (!themes && !error) return <Panel><Loading /></Panel>
  const running = isRunActive(run)
  const verified = themes?.filter(t => t.verificationState === 'Verified').length ?? 0

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-3">
        <Panel title="Themes across your sources" id="lr-themes"
          description="Each theme rests on at least two sources. Every point quotes the sources word for word; points that could not be checked are shown but never used in the draft."
          actions={themes && themes.length > 0 ? <button type="button" onClick={() => void synthesise()} disabled={busy || running} className={btn.secondary}>Find themes again</button> : null}>
          <RunBanner run={run} label="Finding themes" />
          {error ? <div className="mt-2"><Notice tone="error">{error}</Notice></div> : null}
          {themes && themes.length === 0 && !running ? (
            <div className="space-y-2">
              <p className="text-[14px] text-slate-800">No themes yet. Themes are found from the evidence extracted in the previous step.</p>
              <button type="button" onClick={() => void synthesise()} disabled={busy} className={btn.primary}>Find themes (10 credits)</button>
            </div>
          ) : null}
        </Panel>
        {themes?.map((t, i) => (
          <ThemeCard key={t.id} theme={t} index={i} count={themes.length} themes={themes} pool={pool} busy={busy || running}
            coverage={<ThinThemeBar reviewId={review.id} coverage={check?.themes.find(c => c.themeId === t.id)} busy={busy || running} onSearched={onChanged} />}
            onRename={(title, summary) => act(() => literatureReviewApi.updateTheme(review.id, t.id, { title, summary }), 'The theme could not be saved.')}
            onMove={dir => act(() => { const ids = themes.map(x => x.id); const j = i + dir; [ids[i], ids[j]] = [ids[j], ids[i]]; return literatureReviewApi.reorderThemes(review.id, ids) }, 'The order could not be saved.')}
            onMerge={other => act(() => literatureReviewApi.mergeThemes(review.id, [t.id, other]), 'The themes could not be merged.')}
            onSplit={ids => act(() => literatureReviewApi.splitTheme(review.id, t.id, ids), 'The theme could not be split.')}
            onSources={sources => act(() => literatureReviewApi.setThemeSources(review.id, t.id, sources), 'The sources could not be changed.')}
            onDelete={async () => { if (await confirm({ title: `Delete "${t.title}"?`, message: 'Its points are deleted with it.', confirmLabel: 'Delete', tone: 'danger' })) await act(() => literatureReviewApi.deleteTheme(review.id, t.id), 'The theme could not be deleted.') }}
          />
        ))}
      </div>

      <div className="space-y-4">
        <SourceCheckPanel reviewId={review.id} check={check} />
        <GapsPanel reviewId={review.id} gaps={gaps} onChanged={() => void load()} />
        <Panel title="Outline" id="lr-outline-preview" description="Built from the themes that passed their checks. You can edit it in the next step.">
          {outline ? (
            <ol className="list-decimal space-y-1 pl-5 text-[13px] text-slate-800">{outline.sections.map(s => <li key={s.code ?? s.title}>{s.title} <span className="text-slate-600">· ~{s.targetWords} words</span></li>)}</ol>
          ) : <p className="text-[13px] text-slate-700">{verified > 0 ? 'Not built yet.' : 'Needs at least one theme that passed its checks.'}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {outline ? (
              <>
                <button type="button" onClick={onNext} className={btn.primary}>Continue to drafting</button>
                <button type="button" onClick={() => void buildOutline()} disabled={busy || verified === 0} className={btn.secondary}>Rebuild</button>
              </>
            ) : <button type="button" onClick={() => void buildOutline()} disabled={busy || verified === 0} className={themes && themes.length > 0 ? btn.primary : btn.secondary}>Build the outline</button>}
          </div>
        </Panel>
      </div>
      {dialog}
    </div>
  )
}

function ThemeCard({ theme, index, count, themes, pool, busy, coverage, onRename, onMove, onMerge, onSplit, onSources, onDelete }: {
  theme: Theme; index: number; count: number; themes: Theme[]; pool: PoolSource[]; busy: boolean; coverage?: ReactNode
  onRename: (title: string, summary: string) => void; onMove: (dir: -1 | 1) => void; onMerge: (other: string) => void
  onSplit: (ids: string[]) => void; onSources: (s: { literatureId: string; stance: string }[]) => void; onDelete: () => void
}) {
  const [mode, setMode] = useState<'view' | 'rename' | 'split' | 'sources'>('view')
  const [title, setTitle] = useState(theme.title)
  const [summary, setSummary] = useState(theme.summary ?? '')
  const [picked, setPicked] = useState<string[]>([])
  const [stances, setStances] = useState<Record<string, string>>(Object.fromEntries(theme.sources.map(s => [s.literatureId, s.stance])))
  const titleOf = (id: string) => pool.find(p => p.id === id)?.title ?? theme.sources.find(s => s.literatureId === id)?.title ?? 'A source no longer in the review'
  const ok = theme.verificationState === 'Verified'

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4" aria-labelledby={`lr-theme-${theme.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id={`lr-theme-${theme.id}`} className="text-[15px] font-semibold text-slate-900 [overflow-wrap:anywhere]">{theme.title}</h3>
          {theme.summary ? <p className="mt-0.5 text-[13px] text-slate-700">{theme.summary}</p> : null}
        </div>
        <Chip className={ok ? 'border-green-300 bg-green-50 text-green-900' : 'border-amber-300 bg-amber-50 text-amber-950'}>
          {ok ? <><CheckCircle2 size={12} className="mr-1" aria-hidden />Checked</> : <><TriangleAlert size={12} className="mr-1" aria-hidden />Needs attention</>}
        </Chip>
      </div>
      {!ok && theme.failureReason ? <p className="mt-1.5 text-[13px] text-amber-950">{theme.failureReason}</p> : null}
      {coverage}

      <p className="mt-2 text-[12px] font-medium uppercase tracking-wide text-slate-600">Sources</p>
      <ul className="mt-1 flex flex-wrap gap-1.5">
        {theme.sources.map(s => <li key={s.literatureId}><Chip className="border-slate-300 bg-slate-50 text-slate-800">{s.authors.split(/[;,]/)[0] || 'Unknown'}{s.year ? ` ${s.year}` : ''} · {s.stance.toLowerCase()}</Chip></li>)}
      </ul>

      <ul className="mt-3 space-y-2">
        {theme.points.map(p => (
          <li key={p.id} className={p.verified ? 'text-[13px] text-slate-900' : 'text-[13px] text-slate-600'}>
            <span className="font-medium">{KIND_LABELS[p.kind] ?? p.kind}:</span> {p.text}
            {p.verified ? (
              <details className="mt-0.5"><summary className="cursor-pointer text-[12px] text-slate-700">{p.evidence.length} quote{p.evidence.length === 1 ? '' : 's'} from the sources</summary>
                <ul className="mt-1 space-y-1 border-l-2 border-slate-200 pl-3">{p.evidence.map((e, i) => <li key={i} className="text-[12px] text-slate-700">“{e.quote}” <span className="text-slate-500">({titleOf(e.source)})</span></li>)}</ul>
              </details>
            ) : <p className="text-[12px] text-amber-900">Not used in the draft: {p.failureReason}</p>}
          </li>
        ))}
      </ul>

      {mode === 'rename' ? (
        <form className="mt-3 space-y-2" onSubmit={e => { e.preventDefault(); onRename(title, summary); setMode('view') }}>
          <label htmlFor={`lr-tt-${theme.id}`} className="sr-only">Theme title</label>
          <input id={`lr-tt-${theme.id}`} value={title} maxLength={160} onChange={e => setTitle(e.target.value)} className={inputClass} />
          <label htmlFor={`lr-ts-${theme.id}`} className="sr-only">Theme summary</label>
          <textarea id={`lr-ts-${theme.id}`} value={summary} rows={2} maxLength={4000} onChange={e => setSummary(e.target.value)} className={inputClass} />
          <div className="flex gap-2"><button type="submit" className={btn.small}>Save</button><button type="button" onClick={() => setMode('view')} className={btn.small}>Cancel</button></div>
        </form>
      ) : null}
      {mode === 'split' ? (
        <fieldset className="mt-3 space-y-1.5">
          <legend className="text-[13px] font-medium text-slate-900">Move these sources to a new theme</legend>
          {theme.sources.map(s => (
            <label key={s.literatureId} className="flex items-start gap-2 text-[13px]"><input type="checkbox" checked={picked.includes(s.literatureId)} onChange={e => setPicked(v => e.target.checked ? [...v, s.literatureId] : v.filter(x => x !== s.literatureId))} className="mt-0.5" />{s.title}</label>
          ))}
          <div className="flex gap-2"><button type="button" disabled={picked.length === 0 || picked.length === theme.sources.length} onClick={() => { onSplit(picked); setMode('view'); setPicked([]) }} className={btn.small}>Split</button><button type="button" onClick={() => setMode('view')} className={btn.small}>Cancel</button></div>
        </fieldset>
      ) : null}
      {mode === 'sources' ? (
        <fieldset className="mt-3 space-y-1.5">
          <legend className="text-[13px] font-medium text-slate-900">Sources in this theme</legend>
          {pool.map(p => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 text-[13px]">
              <label className="flex min-w-0 flex-1 items-start gap-2"><input type="checkbox" checked={p.id in stances} onChange={e => setStances(s => { const n = { ...s }; if (e.target.checked) n[p.id] = 'Supports'; else delete n[p.id]; return n })} className="mt-0.5" /><span className="[overflow-wrap:anywhere]">{p.title}</span></label>
              {p.id in stances ? (
                <select aria-label={`Stance of "${p.title}"`} value={stances[p.id]} onChange={e => setStances(s => ({ ...s, [p.id]: e.target.value }))} className={inputClass + ' w-auto py-1 text-[13px]'}>
                  {STANCES.map(st => <option key={st} value={st}>{st}</option>)}
                </select>
              ) : null}
            </div>
          ))}
          <div className="flex gap-2"><button type="button" onClick={() => { onSources(Object.entries(stances).map(([literatureId, stance]) => ({ literatureId, stance }))); setMode('view') }} className={btn.small}>Save sources</button><button type="button" onClick={() => setMode('view')} className={btn.small}>Cancel</button></div>
        </fieldset>
      ) : null}

      {mode === 'view' ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button type="button" disabled={busy} onClick={() => setMode('rename')} className={btn.small}><Pencil size={13} aria-hidden /> Rename</button>
          <button type="button" disabled={busy} onClick={() => setMode('sources')} className={btn.small}>Sources</button>
          <button type="button" disabled={busy || theme.sources.length < 2} onClick={() => setMode('split')} className={btn.small}><Scissors size={13} aria-hidden /> Split</button>
          {count > 1 ? (
            <select aria-label={`Merge "${theme.title}" with another theme`} disabled={busy} value="" onChange={e => e.target.value && onMerge(e.target.value)} className={inputClass + ' w-auto py-1 text-[13px]'}>
              <option value="">Merge with…</option>
              {themes.filter(o => o.id !== theme.id).map(o => <option key={o.id} value={o.id}>{o.title}</option>)}
            </select>
          ) : null}
          <button type="button" disabled={busy || index === 0} onClick={() => onMove(-1)} className={btn.small} aria-label={`Move "${theme.title}" up`}><ArrowUp size={13} aria-hidden /></button>
          <button type="button" disabled={busy || index === count - 1} onClick={() => onMove(1)} className={btn.small} aria-label={`Move "${theme.title}" down`}><ArrowDown size={13} aria-hidden /></button>
          <button type="button" disabled={busy} onClick={onDelete} className={btn.small} aria-label={`Delete "${theme.title}"`}><Trash2 size={13} aria-hidden /></button>
        </div>
      ) : null}
    </article>
  )
}

const GAP_LABELS: Record<Gap['classification'], string> = { ResearchGap: 'Research gap', CoverageLimit: 'May be the search', Rejected: 'Not enough evidence' }

function GapsPanel({ reviewId, gaps, onChanged }: { reviewId: string; gaps: Gap[]; onChanged: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const update = async (g: Gap, status: 'accept' | 'dismiss' | 'undo') => {
    setError(null)
    try { await literatureReviewApi.updateGap(reviewId, g.id, status); onChanged() } catch (e) { setError(errorMessage(e, 'The gap could not be updated.')) }
  }
  return (
    <Panel title="Gaps" id="lr-gaps" description="Proposed only from checked points. A gap that may come from a thin search is marked as such, never as a gap in the literature.">
      {error ? <Notice tone="error">{error}</Notice> : null}
      {gaps.length === 0 ? <p className="text-[13px] text-slate-700">No gaps proposed yet.</p> : (
        <ul className="space-y-2">
          {gaps.map(g => (
            <li key={g.id} className="rounded-lg border border-slate-200 p-2.5 text-[13px]">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <Chip className={g.classification === 'ResearchGap' ? 'border-purple-accent/40 bg-purple-tint text-purple-text' : 'border-slate-300 bg-slate-50 text-slate-800'}>{GAP_LABELS[g.classification]}</Chip>
                <span className="text-[12px] text-slate-600">{g.confidence} confidence · {g.sourceIds.length} sources{g.status !== 'Proposed' ? ` · ${g.status.toLowerCase()}` : ''}</span>
              </div>
              <p className="mt-1 text-slate-900">{g.explanation}</p>
              {g.justification ? <p className="mt-0.5 text-slate-700">{g.justification}</p> : null}
              {g.rejectionReason ? <p className="mt-0.5 text-amber-900">{g.rejectionReason}</p> : null}
              <div className="mt-1.5 flex gap-1.5">
                {g.status === 'Proposed' ? <>
                  {g.classification === 'ResearchGap' ? <button type="button" onClick={() => void update(g, 'accept')} className={btn.small}>Use in the review</button> : null}
                  <button type="button" onClick={() => void update(g, 'dismiss')} className={btn.small}>Dismiss</button>
                </> : <button type="button" onClick={() => void update(g, 'undo')} className={btn.small}>Undo</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
