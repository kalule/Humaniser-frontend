import { useState } from 'react'
import { ExternalLink, Repeat, Trash2 } from 'lucide-react'
import type { FetchedLiterature } from '../../../types/research'
import { VERIFICATION_LABEL, type CitationCardEntry, type CitationVerification, type ClaimSupport } from '../../../lib/citationCard'

const VERIFICATION_TONE: Record<CitationVerification, 'good' | 'warn' | 'bad' | 'neutral'> = {
  mismatch: 'bad', claim_supported: 'good', metadata_verified: 'good', unchecked: 'neutral',
}


const SUPPORT: Record<ClaimSupport, { text: string; tone: 'good' | 'warn' | 'bad' | 'neutral' }> = {
  no_issues:     { text: 'Claim check: no issues found', tone: 'good' },
  partly:        { text: 'Claim: partly supported', tone: 'warn' },
  not_supported: { text: 'Claim: not supported', tone: 'bad' },
  checking:      { text: 'Claim: being checked', tone: 'neutral' },
  not_checked:   { text: 'Claim: not checked', tone: 'neutral' },
}

const TONE: Record<'good' | 'warn' | 'bad' | 'neutral', React.CSSProperties> = {
  good:    { background: 'var(--color-green-tint)', color: 'var(--color-green-text)' },
  warn:    { background: 'var(--color-amber-tint)', color: 'var(--color-amber-text)' },
  bad:     { background: 'var(--color-red-tint)',   color: 'var(--color-red-text)' },
  neutral: { background: 'var(--surface-rail)',     color: 'var(--text-secondary)' },
}

function Chip({ tone, children }: { tone: keyof typeof TONE; children: React.ReactNode }) {
  return <span className="text-[11px] font-semibold rounded-full px-2.5 py-0.5" style={TONE[tone]}>{children}</span>
}

// "Pillay and Beharry-Ramraj, 2024" -> "Pillay and Beharry-Ramraj (2024) · Title": the names as the
// text cites them. A numeric (IEEE) clause has no names, so it falls back to the first author.
function heading(entry: CitationCardEntry) {
  if (!entry.sourceExists) return entry.title
  const asCited = /\D/.test(entry.clause) ? entry.clause.replace(/,\s*(\d{4}[a-z]?)\s*$/, ' ($1)') : null
  const who = asCited ?? `${entry.authors?.split(',')[0]?.trim() ?? ''} (${entry.year})`
  return `${who} · ${entry.title}`
}

export interface CitationCardProps {
  entries:   CitationCardEntry[]
  /** Pinned sources a citation can be swapped to; empty hides Swap. */
  swapTo:    FetchedLiterature[]
  canSwap:   boolean
  onSwap:    (entryIndex: number, source: FetchedLiterature) => void
  /** Takes this source out of the citation; omitted when it cannot be removed cleanly (narrative or IEEE). */
  onRemove?: (entryIndex: number) => void
  onClose:   () => void
  style:     React.CSSProperties
  onPointerEnter: () => void
  onPointerLeave: () => void
}

/**
 * The hover/caret card for an inline citation: does the source exist, is its full text pinned,
 * does the source support the claim. Keyboard: it sits right after the editor, so Tab reaches its
 * buttons; Escape closes it.
 */
export function CitationCard({ entries, swapTo, canSwap, onSwap, onRemove, onClose, style, onPointerEnter, onPointerLeave }: CitationCardProps) {
  const [swapping, setSwapping] = useState<number | null>(null)
  const summary = entries.map(e => `${e.sourceExists ? 'Source found' : 'Source not found'}. ${SUPPORT[e.support].text}.`).join(' ')
  return (
    <div role="group" aria-label="Citation details" style={style}
      className="absolute z-20 w-[min(360px,calc(100%-16px))] rounded-[10px] bg-white p-3.5 flex flex-col gap-3"
      onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave}
      onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }}>
      <span className="sr-only" aria-live="polite">{summary} Press Tab for actions, Escape to close.</span>
      <div className="absolute inset-0 rounded-[10px] pointer-events-none" style={{ border: '1px solid var(--border-strong)', boxShadow: '0 8px 24px rgba(28,26,43,.12)' }} />
      {entries.map((entry, i) => (
        <div key={`${entry.clause}-${i}`} className="relative flex flex-col gap-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
          <div className="text-[13px] font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>{heading(entry)}</div>
          {entry.sourceExists && (entry.authors || entry.journal || entry.doi || entry.evidenceLevel) && (
            <div className="text-[11.5px] leading-[1.45] flex flex-col gap-0.5" style={{ color: 'var(--text-secondary)' }} data-testid="citation-source-meta">
              {entry.authors && <span>{entry.authors}</span>}
              {(entry.journal || entry.doi) && <span>{[entry.journal, entry.doi ? `DOI ${entry.doi}` : null].filter(Boolean).join(' · ')}</span>}
              {entry.evidenceLevel && <span>Evidence: {entry.evidenceLevel}</span>}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {entry.verification && entry.sourceExists && (
              <Chip tone={VERIFICATION_TONE[entry.verification]}>{VERIFICATION_LABEL[entry.verification]}</Chip>
            )}
            <Chip tone={entry.sourceExists ? 'good' : 'bad'}>{entry.sourceExists ? (entry.ambiguous ? 'Source exists · same author and year as another' : 'Source exists') : 'Source not found'}</Chip>
            {entry.fullTextPinned !== null && <Chip tone={entry.fullTextPinned ? 'good' : 'neutral'}>{entry.fullTextPinned ? 'Full text pinned' : 'Abstract only'}</Chip>}
            <Chip tone={SUPPORT[entry.support].tone}>{SUPPORT[entry.support].text}</Chip>
            {entry.qualityFlags?.filter(f => f !== 'Abstract only').map(f => <Chip key={f} tone={f === 'Retracted' ? 'bad' : 'warn'}>{f}</Chip>)}
          </div>
          {entry.checkedBy === 'section_check' && (
            <p className="m-0 text-[11px]" style={{ color: 'var(--text-muted)' }}>From this section's citation check.</p>
          )}
          {entry.note && <p className="m-0 text-[12px] leading-[1.5]" style={{ color: 'var(--text-secondary)' }}>{entry.note}</p>}
          {entry.passage && (
            <blockquote className="m-0 pl-2.5 text-[12px] leading-[1.5] italic" style={{ borderLeft: '2px solid var(--border-strong)', color: 'var(--text-secondary)' }}>
              “{entry.passage.quote}”{entry.passage.location && <span className="not-italic" style={{ color: 'var(--text-muted)' }}> ({entry.passage.location})</span>}
            </blockquote>
          )}
          <div className="flex flex-wrap gap-2">
            {entry.viewUrl ? (
              <a href={entry.viewUrl} target="_blank" rel="noopener noreferrer"
                className="dm-action inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium no-underline"
                style={{ border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}>
                <ExternalLink size={12} aria-hidden="true" /> Open source
              </a>
            ) : (
              <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>No link for this source</span>
            )}
            {canSwap && swapTo.length > 0 && (
              <button type="button" onClick={() => setSwapping(swapping === i ? null : i)} aria-expanded={swapping === i}
                className="dm-action inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium"
                style={{ border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}>
                <Repeat size={12} aria-hidden="true" /> Swap citation
              </button>
            )}
            {onRemove && (
              <button type="button" onClick={() => onRemove(i)}
                className="dm-action inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium"
                style={{ border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}
                aria-label={`Remove ${entry.clause} from this citation`}>
                <Trash2 size={12} aria-hidden="true" /> Remove
              </button>
            )}
          </div>
          {swapping === i && (
            <ul className="list-none m-0 p-0 max-h-48 overflow-y-auto dm-scroll flex flex-col gap-1" aria-label="Replace with">
              {swapTo.filter(s => s.id !== entry.literatureId).map(source => (
                <li key={source.id}>
                  <button type="button" onClick={() => { setSwapping(null); onSwap(i, source) }}
                    className="dm-action w-full text-left rounded-md px-2 py-1.5 text-[12px] hover:bg-slate-50" style={{ color: 'var(--text-primary)' }}>
                    <span className="font-semibold">{source.authors.split(',')[0]} ({source.year})</span> · {source.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {i < entries.length - 1 && <hr className="m-0 border-0 h-px" style={{ background: 'var(--border-hairline)' }} />}
        </div>
      ))}
      {canSwap && <p className="relative m-0 text-[11px]" style={{ color: 'var(--text-muted)' }}>Swapping a citation changes the text, so the section will need approving again.</p>}
    </div>
  )
}
