import { useState } from 'react'
import { ArrowUpRight, Check, ChevronDown, ChevronUp, Loader2, Microscope, RefreshCw, Square } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useGapFinder } from '../../hooks/useGapFinder'
import type { GapCard, GapRun, GapScope, UseGapResult } from '../../types/gapFinder'
import {
  GAP_STAGES, GAP_TYPE_LABEL, VERIFICATION_HELP, VERIFICATION_LABEL, parseDois, parseQueryLines, percent, stageIndex,
} from './gapFinderLabels'

interface Props {
  projectId: string
  /** The student's topic text. Level and methodology are read server-side from the project. */
  topic: string
  onUseGap: (result: UseGapResult) => void
  /** Wrapper spacing; the panel is the primary action of the topic step, so the caller places it. */
  className?: string
}

const MIN_TOPIC_CHARS = 12

/**
 * Research Gap Finder, inside the Research Topic step. Flow: start → edit the inferred scope → watch
 * the stages → read up to three verified gap cards → "Use this gap". Wording is deliberately calibrated:
 * "potential gap within the reviewed literature", never a novelty claim, never a confidence percentage.
 */
export function GapFinderPanel({ projectId, topic, onUseGap, className }: Props) {
  const gf = useGapFinder(projectId)
  const { run } = gf
  const canStart = topic.trim().length >= MIN_TOPIC_CHARS

  return (
    <section aria-label="Research gap finder" className={className ?? 'mt-6 pt-6 border-t border-slate-100'}>
      {!run && (
        <div>
          <button
            type="button"
            onClick={() => gf.start(topic.trim())}
            disabled={!canStart || gf.busy}
            className={cn(
              'px-6 py-3 rounded-xl text-[14px] font-semibold inline-flex items-center gap-2 transition-all',
              canStart && !gf.busy
                ? 'bg-purple-accent hover:bg-purple-deep text-white shadow-md'
                : 'bg-slate-200 text-slate-500 cursor-not-allowed',
            )}
          >
            {gf.busy ? <Loader2 size={15} className="animate-spin" /> : <Microscope size={15} />}
            Find research gaps
          </button>
          <p className="text-[12px] text-slate-500 mt-2 leading-relaxed max-w-xl">
            <strong className="text-slate-700">Recommended.</strong> Searches the literature, screens and reads
            the papers, then checks each gap against further searches before showing it, so every result
            comes with its evidence. Takes a minute or two. Your topic is sent to our AI and search
            providers; uploaded documents are not.
          </p>
          {!canStart && <p className="text-[11px] text-slate-400 mt-1">Describe your topic in a little more detail first.</p>}
        </div>
      )}

      {gf.error && (
        <p role="alert" className="mt-3 text-[12px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{gf.error}</p>
      )}

      {run?.status === 'queued' && run.stage === 'scope' && <Progress run={run} onStop={gf.cancel} busy={gf.busy} />}
      {run?.status === 'awaiting_scope' && run.scope && (
        <ScopeEditor key={run.id} scope={run.scope} busy={gf.busy} onConfirm={gf.confirmScope} onCancel={gf.cancel} />
      )}
      {(run?.status === 'running' || (run?.status === 'queued' && run.stage !== 'scope')) && (
        <Progress run={run} onStop={gf.cancel} busy={gf.busy} />
      )}
      {run?.status === 'failed' && (
        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-tint p-4">
          <p className="text-[13px] font-semibold text-amber-text mb-1">The search stopped</p>
          <p className="text-[12px] text-slate-700 mb-3">{run.failureReason ?? 'Something went wrong.'}</p>
          <div className="flex gap-2">
            <button type="button" onClick={gf.retry} disabled={gf.busy}
              className="px-3 py-1.5 rounded-lg bg-purple-accent hover:bg-purple-deep text-white text-[12px] font-medium inline-flex items-center gap-1.5 disabled:opacity-60">
              <RefreshCw size={12} /> Retry from where it stopped
            </button>
            <button type="button" onClick={gf.dismiss} className="px-3 py-1.5 rounded-lg border border-slate-200 text-[12px] text-slate-600 hover:bg-white">Dismiss</button>
          </div>
        </div>
      )}
      {run?.status === 'completed' && (
        <Results run={run} busy={gf.busy} onDismiss={gf.dismiss} onEditCorpus={gf.editCorpus}
          onUse={async (gapId, question) => { const r = await gf.chooseGap(gapId, question); if (r) onUseGap(r) }} />
      )}
    </section>
  )
}

// ── Scope editing (FR2) ──────────────────────────────────────────────────────

function ScopeEditor({ scope, busy, onConfirm, onCancel }: {
  scope: GapScope
  busy: boolean
  onConfirm: (p: { concepts: string[]; population: string | null; location: string | null; queries: string[]; isComputerScience: boolean }) => void
  onCancel: () => void
}) {
  const [population, setPopulation] = useState(scope.population ?? '')
  const [location, setLocation] = useState(scope.location ?? '')
  const [queries, setQueries] = useState(scope.queries.join('\n'))
  const [cs, setCs] = useState(scope.isComputerScience)
  const parsed = parseQueryLines(queries)

  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-white p-5">
      <h4 className="text-[14px] font-bold text-slate-800 mb-1">Check what we'll search for</h4>
      <p className="text-[12px] text-slate-500 mb-4">
        This is how we read your topic. Edit anything that's off, then search. Location is applied after a broad search, not before.
      </p>

      {scope.concepts.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4" aria-label="Concepts found in your topic">
          {scope.concepts.map(c => <span key={c} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-medium">{c}</span>)}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <label className="block text-[12px] font-medium text-slate-700">Population (optional)
          <input value={population} onChange={e => setPopulation(e.target.value)} maxLength={200}
            className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] outline-none focus:border-purple-accent" />
        </label>
        <label className="block text-[12px] font-medium text-slate-700">Location (optional)
          <input value={location} onChange={e => setLocation(e.target.value)} maxLength={200}
            className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] outline-none focus:border-purple-accent" />
        </label>
      </div>

      <label className="block text-[12px] font-medium text-slate-700 mb-3">Search queries (one per line, up to 4)
        <textarea value={queries} onChange={e => setQueries(e.target.value)} rows={4}
          className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] outline-none focus:border-purple-accent resize-none" />
      </label>

      <label className="flex items-center gap-2 text-[12px] text-slate-600 mb-4">
        <input type="checkbox" checked={cs} onChange={e => setCs(e.target.checked)} />
        Include arXiv preprints (recommended for computing and AI topics)
      </label>

      <div className="flex gap-2">
        <button type="button" disabled={busy || parsed.length === 0}
          onClick={() => onConfirm({
            concepts: scope.concepts, population: population.trim() || null, location: location.trim() || null,
            queries: parsed, isComputerScience: cs,
          })}
          className="px-4 py-2 rounded-lg bg-purple-accent hover:bg-purple-deep text-white text-[13px] font-semibold inline-flex items-center gap-2 disabled:opacity-60">
          {busy && <Loader2 size={13} className="animate-spin" />} Search the literature
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className="px-4 py-2 rounded-lg border border-slate-200 text-[13px] text-slate-600 hover:bg-slate-50">Cancel</button>
      </div>
    </div>
  )
}

// ── Progress (text + icon, not colour alone) ────────────────────────────────

function Progress({ run, onStop, busy }: { run: GapRun; onStop: () => void; busy: boolean }) {
  const current = stageIndex(run.stage)
  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <p role="status" aria-live="polite" className="text-[13px] font-semibold text-slate-800 flex items-center gap-2">
          <Loader2 size={14} className="animate-spin text-purple-accent" /> {run.statusMessage || 'Working…'}
        </p>
        <button type="button" onClick={onStop} disabled={busy}
          className="text-[12px] text-slate-500 hover:text-slate-700 inline-flex items-center gap-1"><Square size={11} /> Stop</button>
      </div>
      <ol className="space-y-1.5">
        {GAP_STAGES.map((s, i) => (
          <li key={s.id} className={cn('flex items-center gap-2 text-[12px]', i > current && 'text-slate-400', i === current && 'text-slate-800 font-medium', i < current && 'text-slate-500')}>
            <span aria-hidden className="w-4 inline-flex justify-center">
              {i < current ? <Check size={12} /> : i === current ? <Loader2 size={12} className="animate-spin" /> : '·'}
            </span>
            {s.label}
            <span className="sr-only">{i < current ? ' (done)' : i === current ? ' (in progress)' : ' (waiting)'}</span>
          </li>
        ))}
      </ol>
      {run.corpus && (
        <p className="text-[11px] text-slate-500 mt-3">{run.corpus.papersUsed} on-topic papers so far, from {run.corpus.papersScreened} screened.</p>
      )}
    </div>
  )
}

// ── Results ──────────────────────────────────────────────────────────────────

function Results({ run, busy, onUse, onDismiss, onEditCorpus }: {
  run: GapRun; busy: boolean; onUse: (gapId: string, question: string) => void; onDismiss: () => void
  onEditCorpus: (removeWorkIds: string[], addDois: string[]) => void
}) {
  const [showPapers, setShowPapers] = useState(false)
  const [removed, setRemoved] = useState<Set<string>>(new Set())
  const [doiText, setDoiText] = useState('')
  const dois = parseDois(doiText)
  const changed = removed.size > 0 || dois.length > 0
  const tooFew = (run.corpus?.papers.length ?? 0) - removed.size + dois.length < 2
  const toggleRemoved = (id: string) =>
    setRemoved(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  return (
    <div className="mt-2">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h3 className="text-[15px] font-bold text-slate-800">
          {run.cards.length === 0 ? 'No gap passed verification' : `${run.cards.length} potential gap${run.cards.length === 1 ? '' : 's'} within the reviewed literature`}
        </h3>
        <button type="button" onClick={onDismiss} className="text-[12px] text-slate-500 hover:text-slate-700 inline-flex items-center gap-1 shrink-0"><RefreshCw size={11} /> Search again</button>
      </div>
      <p className="text-[12px] text-slate-500 mb-4">{run.caveat}</p>

      {run.corpus && (
        <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-4 py-3 mb-4">
          <p className="text-[12px] text-slate-600">
            Reviewed <strong>{run.corpus.papersUsed}</strong> on-topic papers from {run.corpus.papersScreened} screened
            {' · '}{percent(run.corpus.preprintShare)} preprints
          </p>
          <button type="button" onClick={() => setShowPapers(v => !v)} aria-expanded={showPapers}
            className="text-[11px] font-medium text-purple-accent hover:text-purple-deep mt-1 inline-flex items-center gap-1">
            {showPapers ? <ChevronUp size={12} /> : <ChevronDown size={12} />} {showPapers ? 'Hide' : 'Show'} the papers
          </button>
          {showPapers && (
            <div className="mt-2">
              <ul className="space-y-1 max-h-56 overflow-auto">
                {run.corpus.papers.map(p => {
                  const marked = removed.has(p.workId)
                  return (
                    <li key={p.workId} className="text-[12px] text-slate-600 flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={marked}
                        onChange={() => toggleRemoved(p.workId)}
                        aria-label={`Remove ${p.title} from the reviewed papers`}
                        className="mt-0.5"
                      />
                      <span className={cn(marked && 'line-through text-slate-400')}>
                        {p.url ? <a href={p.url} target="_blank" rel="noreferrer" className="hover:text-purple-text underline-offset-2 hover:underline">{p.title}</a> : p.title}
                        <span className="text-slate-400"> · {p.year ?? 'n.d.'}{p.isPreprint ? ' · preprint' : ''}{p.isReview ? ' · review' : ''}</span>
                        {marked && <span className="sr-only"> (will be removed)</span>}
                      </span>
                    </li>
                  )
                })}
              </ul>
              <label className="block text-[11px] font-medium text-slate-600 mt-3">
                Add papers by DOI (up to 5; paste DOIs or doi.org links)
                <textarea
                  value={doiText}
                  onChange={e => setDoiText(e.target.value)}
                  rows={2}
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-[12px] outline-none focus:border-purple-accent resize-none"
                />
              </label>
              <div className="flex items-center gap-3 mt-2">
                <button
                  type="button"
                  disabled={busy || !changed || tooFew}
                  onClick={() => onEditCorpus([...removed], dois)}
                  className="px-3 py-1.5 rounded-lg bg-purple-accent hover:bg-purple-deep text-white text-[12px] font-medium inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  {busy && <Loader2 size={12} className="animate-spin" />} Re-check gaps with these papers
                </button>
                <span className="text-[11px] text-slate-500">
                  {tooFew ? 'Keep at least two papers.' : changed ? `${removed.size} removed, ${dois.length} to add. Uses credits again.` : 'Tick papers to remove, or add DOIs.'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {run.cards.length === 0 && (
        <p className="text-[13px] text-slate-600 mb-3">{run.noMoreQualifiedReason ?? 'The reviewed papers did not support a verified gap.'} You can still continue with your own topic.</p>
      )}

      <div className="space-y-4">
        {run.cards.map(card => (
          <GapCardView key={card.gapId} card={card} used={run.usedGapId === card.gapId} busy={busy} onUse={q => onUse(card.gapId, q)} />
        ))}
      </div>

      {run.cards.length > 0 && run.cards.length < 3 && run.noMoreQualifiedReason && (
        <p className="text-[12px] text-slate-500 mt-4">Why not more: {run.noMoreQualifiedReason}</p>
      )}
    </div>
  )
}

function GapCardView({ card, used, busy, onUse }: { card: GapCard; used: boolean; busy: boolean; onUse: (question: string) => void }) {
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState(card.suggestedQuestion)
  const questionOk = question.trim().length >= 10 && question.trim().length <= 400
  const v = card.verification
  const c = card.coverage
  return (
    <article aria-label={`Potential gap ${card.gapId}`} className={cn('rounded-xl border bg-white p-5', used ? 'border-2 border-purple-accent' : 'border-slate-200')}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-purple-text mb-1.5">{GAP_TYPE_LABEL[card.type]}</p>
      <h4 className="text-[14px] font-bold text-slate-900 leading-snug mb-2">{card.statement}</h4>
      <p className="text-[11px] text-slate-500 mb-2">
        Based on {c.papersUsed} on-topic papers from {c.papersScreened} screened · {card.evidence.length} verified passages · {v.queriesRun.length} follow-up searches
      </p>
      {card.whatIsKnown && <p className="text-[12px] text-slate-600 leading-relaxed mb-3"><strong className="text-slate-700">Already known: </strong>{card.whatIsKnown}</p>}

      <div className="mb-3">
        <p className="text-[11px] font-bold text-slate-700 mb-1.5">Evidence ({card.evidence.length} verified passages)</p>
        <ul className="space-y-2">
          {card.evidence.map(e => (
            <li key={e.workId} className="border-l-2 border-purple-accent/40 pl-3">
              <blockquote className="text-[12px] text-slate-700 italic leading-relaxed">“{e.passage}”</blockquote>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {e.url ? <a href={e.url} target="_blank" rel="noreferrer" className="hover:text-purple-text inline-flex items-center gap-0.5 underline-offset-2 hover:underline">{e.title}<ArrowUpRight size={10} /></a> : e.title}
                {e.year ? ` (${e.year})` : ''}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg bg-slate-50/70 border border-slate-100 p-3 mb-3">
        <p className="text-[11px] font-bold text-slate-700">Verification: {VERIFICATION_LABEL[v.status]}</p>
        <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">{VERIFICATION_HELP[v.status]}</p>
        <p className="text-[11px] text-slate-500 mt-1">{v.queriesRun.length} searches run · {v.hitsJudged} results judged</p>
        {v.closestWorks.length > 0 && (
          <ul className="mt-1.5 space-y-0.5">
            {v.closestWorks.map(w => (
              <li key={w.workId} className="text-[11px] text-slate-600">
                Closest: {w.url ? <a href={w.url} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline hover:text-purple-text">{w.title}</a> : w.title}
                <span className="text-slate-400"> — {w.judgement === 'addresses' ? 'addresses it' : 'partly addresses it'}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <label className="block text-[12px] font-medium text-slate-700 mb-3">
        Your research question — a draft to refine; your title will be built from it
        <textarea
          value={question}
          onChange={e => setQuestion(e.target.value)}
          rows={2}
          maxLength={400}
          disabled={used}
          className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] text-slate-800 outline-none focus:border-purple-accent resize-none disabled:bg-slate-50"
        />
      </label>

      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="text-[11px] font-medium text-purple-accent hover:text-purple-deep inline-flex items-center gap-1 mb-2">
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Evidence coverage
      </button>
      {open && (
        <dl className="text-[11px] text-slate-600 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 mb-3">
          <dt className="text-slate-400">Papers</dt><dd>{c.papersUsed} used of {c.papersScreened} screened</dd>
          <dt className="text-slate-400">Read as</dt><dd>{c.abstractsOnly} abstracts only · {c.fullTexts} full texts</dd>
          <dt className="text-slate-400">Preprints</dt><dd>{percent(c.preprintShare)}</dd>
          <dt className="text-slate-400">Sources</dt><dd>{c.sources.join(', ') || 'none'}</dd>
          <dt className="text-slate-400">Searched</dt><dd>{c.searchDate}</dd>
          <dt className="text-slate-400">Not reviewed</dt><dd>{c.notReviewed.join(', ')}</dd>
          {c.notes.length > 0 && (<><dt className="text-slate-400">Notes</dt><dd>{c.notes.join(' ')}</dd></>)}
        </dl>
      )}

      <button type="button" onClick={() => onUse(question.trim())} disabled={busy || used || !questionOk}
        className={cn('px-4 py-2 rounded-lg text-[13px] font-semibold inline-flex items-center gap-2 transition-colors',
          used ? 'bg-purple-tint text-purple-text cursor-default' : 'bg-purple-accent hover:bg-purple-deep text-white disabled:opacity-60')}>
        {used ? <><Check size={13} /> Selected</> : 'Use this gap'}
      </button>
    </article>
  )
}
