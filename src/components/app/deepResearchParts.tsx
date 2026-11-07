import { useId, useState, type KeyboardEvent } from 'react'
import { AlertTriangle, ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'
import { funnelRows } from '../../lib/deepResearchReport'
import { SEGMENT_LEGEND, SEGMENT_SYMBOL, SEGMENT_WORDS, sourcesSummaryLine, strengthLevel, type SegmentState } from '../../lib/deepResearchView'

// Small presentational parts of the results page. Each is used in more than one place, or needs its own keyboard
// behaviour, so it lives here rather than inline.

/** "Disagrees" with an icon and a word, so it never relies on colour. The same badge is used wherever a source disagrees. */
export function DisagreesBadge({ kind = 'Contradicts' }: { kind?: 'Contradicts' | 'Null' }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-orange-300 bg-orange-50 px-1.5 py-px text-[12px] font-semibold text-orange-900">
      <AlertTriangle size={12} aria-hidden="true" />
      {kind === 'Null' ? 'No effect found' : 'Disagrees'}
    </span>
  )
}

/** One evidence-strength indicator in place of several badges: four steps plus the word, so colour is never the only signal. */
export function StrengthMeter({ strength }: { strength: string }) {
  const { level, label } = strengthLevel(strength)
  return (
    <span className="inline-flex items-center gap-2 text-[12px] text-slate-700">
      <span className="inline-flex gap-0.5" aria-hidden="true">
        {[1, 2, 3, 4].map(i => <span key={i} className={cn('h-2 w-3 rounded-sm', i <= level ? 'bg-purple-accent' : 'bg-slate-200')} />)}
      </span>
      {label}
    </span>
  )
}

/** The question as typed, clamped to two lines until the student asks for the rest. */
export function ClampedTitle({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const long = text.length > 110
  return (
    <div>
      <h2 id={id} className={cn('text-left font-serif text-[24px] leading-snug font-semibold text-slate-900 break-words', long && !open && 'line-clamp-2')}>{text}</h2>
      {long && (
        <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(v => !v)}
          className="mt-1 text-[13px] font-medium text-purple-deep hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40">
          {open ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}

const SEGMENT_STYLES: Record<SegmentState, string> = {
  done: 'border-purple-accent bg-purple-accent text-white',
  partial: 'border-purple-300 bg-purple-100 text-purple-deep',
  pending: 'border-dashed border-slate-400 bg-white text-slate-700',
}

/** One button per question: a symbol and a number as well as a colour, a legend, and a click that jumps to that question. */
export function QuestionProgress({ segments, answered, onSelect }: { segments: SegmentState[]; answered: number; onSelect: (index: number) => void }) {
  if (segments.length === 0) return null
  return (
    <div className="mt-3">
      <div role="group" aria-label={`${answered} of ${segments.length} questions answered. Choose a question to go to it.`} className="flex gap-1.5">
        {segments.map((s, i) => (
          <button key={i} type="button" onClick={() => onSelect(i)}
            aria-label={`Question ${i + 1}: ${SEGMENT_WORDS[s]}. Go to this question.`}
            className={cn('flex h-8 min-w-0 flex-1 items-center justify-center gap-1 rounded border text-[12px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-purple-accent focus-visible:ring-offset-1', SEGMENT_STYLES[s])}>
            <span aria-hidden="true">{SEGMENT_SYMBOL[s]}</span><span aria-hidden="true">{i + 1}</span>
          </button>
        ))}
      </div>
      <ul aria-label="Legend" className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-slate-700">
        {SEGMENT_LEGEND.map(l => (
          <li key={l.state} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className={cn('inline-flex h-5 w-5 items-center justify-center rounded border text-[12px] font-semibold', SEGMENT_STYLES[l.state])}>{SEGMENT_SYMBOL[l.state]}</span>
            {l.word}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** "150 found · 86 accepted · 12 disagree", one line, opening into the funnel. */
export function SourcesSummary({ counts, against, overall, defaultOpen = false }: { counts: { found: number; used: number }; against: number; overall?: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  return (
    <section aria-label="Where the sources went" className="rounded-xl border border-slate-200 bg-white">
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-left text-[13px] font-medium text-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40">
        <span><span className="text-slate-600">Sources: </span>{sourcesSummaryLine(counts, against)}</span>
        <ChevronDown size={16} aria-hidden="true" className={cn('shrink-0 text-slate-600 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div id={id} className="border-t border-slate-100 px-4 pb-4 pt-3">
          <h3 className="mb-3 text-[14px] font-semibold text-slate-900">Where the {counts.found} sources went</h3>
          <ul className="space-y-2.5">
            {funnelRows(counts, against).map(b => (
              <li key={b.key} className="grid grid-cols-[11rem_1fr_2.5rem] items-center gap-3 text-[12px] text-slate-700">
                <span className={cn(b.nested && 'pl-3')}>{b.nested && <span aria-hidden="true">↳ </span>}{b.label}</span>
                {/* Centred and narrowing: each row is a part of the one above it, not a separate pool. */}
                <span className="flex h-2.5 justify-center overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                  <span className={cn('block h-full rounded-full', b.key === 'found' ? 'bg-purple-200' : b.key === 'used' ? 'bg-purple-accent' : 'bg-orange-700')} style={{ width: `${b.widthPct}%` }} />
                </span>
                <span className="text-right font-semibold tabular-nums text-slate-900">{b.n}</span>
              </li>
            ))}
          </ul>
          {overall && <p className="mt-3 text-[12px] text-slate-700">Overall: {overall}. Open any source to see its checks and the passage that supports it, where one was found.</p>}
        </div>
      )}
    </section>
  )
}

/** A numbered citation that opens the source panel, with a preview of the title and supporting quote on hover or focus. */
export function CitationMarker({ n, title, quote, selected, onOpen }: { n: number; title: string; quote: string | null; selected: boolean; onOpen: () => void }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
  return (
    <span className="relative inline-block" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" onClick={onOpen} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={onKey}
        aria-pressed={selected} aria-describedby={open ? id : undefined}
        aria-label={`Source ${n}: ${title}. Open its checks and supporting quote`}
        className={cn('mx-px rounded px-1 align-baseline text-[12px] font-semibold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-purple-accent',
          selected ? 'bg-purple-accent text-white' : 'bg-purple-tint text-purple-deep hover:bg-purple-100')}>
        [{n}]
      </button>
      {open && <CitationPreview id={id} title={title} quote={quote} />}
    </span>
  )
}

/** What a marker shows on hover or focus: the source's title and the sentence that supports the claim. */
export function CitationPreview({ id, title, quote }: { id: string; title: string; quote: string | null }) {
  return (
    <span id={id} role="tooltip" className="absolute bottom-full left-0 z-40 mb-1.5 block w-72 rounded-lg bg-slate-900 px-3 py-2 text-left text-[12px] font-normal leading-snug text-white shadow-lg">
      <span className="block font-semibold">{title}</span>
      {quote ? <span className="mt-1 block text-slate-200">“{quote.length > 220 ? `${quote.slice(0, 220).trimEnd()}…` : quote}”</span> : <span className="mt-1 block text-slate-300">No supporting sentence was kept for this source.</span>}
    </span>
  )
}
