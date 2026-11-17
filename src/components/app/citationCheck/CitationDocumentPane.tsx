import { memo, useMemo } from 'react'
import type { CitationCard } from '../../../types/citationCheck'
import {
  buildHighlightIndex, splitParagraphs, TONE_LABEL, type DocParagraph, type MarkSegment,
} from '../../../lib/citationHighlights'
import { goToCard } from '../../../lib/citationLinking'
import { cn } from '../../../lib/utils'

interface Props {
  text: string
  cards: CitationCard[]
  /** Clicking or pressing Enter on a highlight. Defaults to scrolling to and focusing its result card. */
  onActivate?: (cardId: string) => void
}

const HEADING_CLASS: Record<number, string> = {
  1: 'text-[18px] font-semibold mt-5 mb-1', 2: 'text-[16px] font-semibold mt-4 mb-1', 3: 'text-[14.5px] font-semibold mt-3 mb-0.5',
}

interface ParagraphProps { paragraph: DocParagraph; segments: MarkSegment[]; labels: Map<string, string>; onActivate: (cardId: string) => void }

// Memoised: the highlight index is built once per (text, cards) and each paragraph only re-renders if its own segments change,
// so a status update on one card does not touch the other thousands of lines.
const Paragraph = memo(function Paragraph({ paragraph, segments, labels, onActivate }: ParagraphProps) {
  if (paragraph.text === '' ) return <div data-para={paragraph.index} className="cc-para h-3" aria-hidden />

  const parts: React.ReactNode[] = []
  let at = 0
  for (const seg of segments) {
    if (seg.start > at) parts.push(paragraph.text.slice(at, seg.start))
    const shown = paragraph.text.slice(seg.start, seg.end)
    const label = `Citation ${labels.get(seg.cardIds[0]) ?? shown}, ${TONE_LABEL[seg.tone]}${seg.cardIds.length > 1 ? `, ${seg.cardIds.length} works` : ''}. Press Enter to go to its result.`
    parts.push(
      <mark
        key={seg.start}
        role="button"
        tabIndex={0}
        aria-label={label}
        data-card-ids={seg.cardIds.join(' ')}
        className={cn('cc-mark bg-transparent text-inherit', `cc-mark--${seg.tone}`)}
        onClick={() => onActivate(seg.cardIds[0])}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate(seg.cardIds[0]) } }}
      >
        {shown}
      </mark>,
    )
    at = seg.end
  }
  if (at < paragraph.text.length) parts.push(paragraph.text.slice(at))

  const Tag = paragraph.heading > 0 ? 'h3' : 'p'
  return (
    <Tag data-para={paragraph.index} className={cn('cc-para', paragraph.heading > 0 ? HEADING_CLASS[Math.min(paragraph.heading, 3)] : 'mb-2')}>
      {parts}
    </Tag>
  )
})

/**
 * The checked draft, read-only so a highlight can never drift from the text under it. Every citation marker is a button; its
 * underline style and icon (not only its colour) say whether it is supported, needs attention, or could not be verified.
 */
export function CitationDocumentPane({ text, cards, onActivate = goToCard }: Props) {
  const paragraphs = useMemo(() => splitParagraphs(text), [text])
  const index = useMemo(() => buildHighlightIndex(text, paragraphs, cards), [text, paragraphs, cards])
  const labels = useMemo(() => new Map(cards.map(c => [c.id, c.markerText])), [cards])

  return (
    <div className="absolute inset-0 overflow-y-auto px-5 py-4 text-[14px] leading-7 text-slate-900" data-testid="document-pane">
      <article aria-label="Your checked draft (read only)" tabIndex={-1}>
        {paragraphs.map(p => (
          <Paragraph key={p.index} paragraph={p} segments={index.byParagraph.get(p.index) ?? NONE} labels={labels} onActivate={onActivate} />
        ))}
      </article>
      {index.unplaced.length > 0 && (
        <p className="mt-4 text-[12px] text-slate-600">
          {index.unplaced.length} citation{index.unplaced.length === 1 ? '' : 's'} could not be located in the text, so
          {index.unplaced.length === 1 ? ' it is' : ' they are'} shown in the results only.
        </p>
      )}
    </div>
  )
}

const NONE: MarkSegment[] = []
