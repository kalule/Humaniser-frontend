import { useEffect, useState } from 'react'
import { Search, TriangleAlert } from 'lucide-react'
import { literatureReviewApi } from '../../api/literatureReview'
import { errorMessage, SOURCE_KIND_LABELS, type Landmark, type SourceCheck, type SourceKind, type ThemeCoverage } from '../../lib/literatureReview'
import { Chip, Notice, Panel } from './ui'
import { btn, inputClass } from './styles'

/**
 * The source check (server flag LiteratureReviewStudio:SourceGate): how many sources the review has against what its length usually
 * needs, per-theme counts, the kinds of source, and highly cited search records left out. Each part renders nothing while the flag is
 * off (useSourceCheck then gives null).
 *
 * SourceCountLine: one line for the Screen step, sources in the review against the minimum.
 */
export function SourceCountLine({ check }: { check: SourceCheck | null }) {
  if (!check) return null
  const enough = check.included >= check.minimum
  return (
    <p role="status" className={`rounded-lg border px-3 py-2 text-[13px] ${enough ? 'border-slate-200 bg-white text-slate-800' : 'border-amber-300 bg-amber-50 text-amber-950'}`}>
      <span className="font-medium">{check.included} {check.included === 1 ? 'source' : 'sources'} in the review.</span>{' '}
      A review of this length usually needs at least {check.minimum}.{enough ? '' : ' Include more papers before you continue.'}
    </p>
  )
}

/** The Themes step's summary: counts at each stage, the minimum, source kinds, and the landmark check. */
export function SourceCheckPanel({ reviewId, check }: { reviewId: string; check: SourceCheck | null }) {
  if (!check) return null
  const counts = check.balance?.counts
  return (
    <Panel title="Source check" id="lr-source-check"
      description={`A review of this length usually needs at least ${check.minimum} sources, and each theme section at least ${check.minSourcesPerTheme}.`}>
      <dl className="grid grid-cols-3 gap-2 text-center">
        {[['In the review', check.included], ['Extracted', check.extracted], ['In checked themes', check.inThemes]].map(([label, n]) => (
          <div key={label as string} className="rounded-lg border border-slate-200 p-2">
            <dt className="text-[11px] uppercase tracking-wide text-slate-600">{label}</dt>
            <dd className="text-[18px] font-semibold text-slate-900">{n}</dd>
          </div>
        ))}
      </dl>
      {check.message ? (
        <div className="mt-2"><Notice tone="warning">{check.message}{check.overridden ? ' You chose to continue anyway.' : ''}</Notice></div>
      ) : null}
      {counts && check.balance && check.balance.total > 0 ? (
        <div className="mt-3">
          <p className="text-[12px] font-medium uppercase tracking-wide text-slate-600">Kinds of source</p>
          <ul className="mt-1 space-y-0.5 text-[13px] text-slate-800">
            {(Object.keys(SOURCE_KIND_LABELS) as SourceKind[]).filter(k => (counts[k] ?? 0) > 0).map(k => <li key={k}>{SOURCE_KIND_LABELS[k]}: {counts[k]}</li>)}
          </ul>
          {check.balance.warning ? <div className="mt-2"><Notice tone="warning">{check.balance.warning}</Notice></div> : null}
        </div>
      ) : null}
      <LandmarkCheck reviewId={reviewId} />
    </Panel>
  )
}

/** Optional: highly cited records the search found that are not in the review, so the student can include them. */
function LandmarkCheck({ reviewId }: { reviewId: string }) {
  const [items, setItems] = useState<Landmark[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [included, setIncluded] = useState<Set<string>>(new Set())
  const run = async () => {
    setError(null)
    try { setItems(await literatureReviewApi.landmarks(reviewId)) } catch (e) { setError(errorMessage(e, 'The landmark check could not be run.')) }
  }
  const include = async (l: Landmark) => {
    setError(null)
    try { await literatureReviewApi.decide(reviewId, l.candidateId, { decision: 'include' }); setIncluded(s => new Set(s).add(l.candidateId)) }
    catch (e) { setError(errorMessage(e, 'The paper could not be included.')) }
  }
  return (
    <div className="mt-3 border-t border-slate-200 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-slate-900">Landmark check</p>
        <button type="button" onClick={() => void run()} className={btn.small}>{items ? 'Check again' : 'Check'}</button>
      </div>
      <p className="mt-0.5 text-[12px] text-slate-700">Highly cited papers your search found that are not in the review.</p>
      {error ? <div className="mt-2"><Notice tone="error">{error}</Notice></div> : null}
      {items && items.length === 0 ? <p className="mt-2 text-[13px] text-slate-700">None found: every highly cited paper is already in the review or was set aside.</p> : null}
      {items && items.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {items.map(l => (
            <li key={l.candidateId} className="rounded-lg border border-slate-200 p-2 text-[13px]">
              <p className="text-slate-900 [overflow-wrap:anywhere]">{l.title}</p>
              <p className="text-[12px] text-slate-600">{[l.authors.split(/[;,]/)[0], l.year, `${l.citations.toLocaleString()} citations`].filter(Boolean).join(' · ')}</p>
              {included.has(l.candidateId)
                ? <p className="mt-1 text-[12px] text-green-900">Included. Approve on the Screen step to bring it into the review.</p>
                : <button type="button" onClick={() => void include(l)} className={btn.small + ' mt-1'}>Include</button>}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

/** On a theme card: the thin flag and a targeted search for more sources on the theme. */
export function ThinThemeBar({ reviewId, coverage, busy, onSearched }: { reviewId: string; coverage: ThemeCoverage | undefined; busy: boolean; onSearched: () => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(coverage?.suggestedQuery ?? '')
  const [state, setState] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  useEffect(() => { setQuery(coverage?.suggestedQuery ?? '') }, [coverage?.suggestedQuery])
  if (!coverage) return null
  const search = async () => {
    setState(null)
    try {
      await literatureReviewApi.searchTheme(reviewId, coverage.themeId, query)
      setState({ tone: 'success', text: 'Searching for more on this theme. New papers are added to the Screen step (nothing is removed): screen and approve them, extract them, then find themes again.' })
      setOpen(false)
      onSearched()
    } catch (e) { setState({ tone: 'error', text: errorMessage(e, 'The search could not be started.') }) }
  }
  return (
    <div className="mt-2">
      {coverage.thin ? (
        <div className="flex flex-wrap items-center gap-2">
          <Chip className="border-amber-300 bg-amber-50 text-amber-950"><TriangleAlert size={12} className="mr-1" aria-hidden />Thin: {coverage.evidenceSources} {coverage.evidenceSources === 1 ? 'source' : 'sources'}</Chip>
          <span className="text-[12px] text-slate-700">
            {coverage.overridden ? 'You chose to draft it anyway; the text will say the evidence is limited.' : 'Search for more on this theme, merge it with another, or delete it.'}
          </span>
        </div>
      ) : null}
      {open ? (
        <form className="mt-2 space-y-1.5" onSubmit={e => { e.preventDefault(); void search() }}>
          <label htmlFor={`lr-tq-${coverage.themeId}`} className="text-[12px] font-medium text-slate-900">Search query (you can edit it)</label>
          <input id={`lr-tq-${coverage.themeId}`} value={query} maxLength={500} onChange={e => setQuery(e.target.value)} className={inputClass} />
          <div className="flex gap-2">
            <button type="submit" disabled={busy || query.trim().length === 0} className={btn.small}><Search size={13} aria-hidden /> Search</button>
            <button type="button" onClick={() => setOpen(false)} className={btn.small}>Cancel</button>
          </div>
        </form>
      ) : coverage.thin ? <button type="button" disabled={busy} onClick={() => setOpen(true)} className={btn.small + ' mt-1.5'}><Search size={13} aria-hidden /> Search for more</button> : null}
      {state ? <div className="mt-2"><Notice tone={state.tone} role="status">{state.text}</Notice></div> : null}
    </div>
  )
}
