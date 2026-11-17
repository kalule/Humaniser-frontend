import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronRight, Copy, ExternalLink, Loader2, Lock, Plus, RotateCw } from 'lucide-react'
import toast from 'react-hot-toast'
import type { CitationCard } from '../../../types/citationCheck'
import {
  diffFieldLabel, evidenceLabel, extraNote, failureMeta, flagMeta, resolutionBadge, type Tone,
} from '../../../lib/citationCheckView'
import { cardTitle, chipFlags, linkNote, needsReferenceEntry, primaryBadge, referenceStub, safeExternalUrl } from '../../../lib/citationCheckActions'
import { overstatementMessage, visibleOverstatement } from '../../../lib/citationCheckOverstatement'
import { correctedReference, isRetryable } from '../../../lib/citationResults'
import { cn } from '../../../lib/utils'

export const TONE_CLASS: Record<Tone, string> = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  warning: 'bg-amber-50 border-amber-300 text-amber-900',
  danger: 'bg-red-50 border-red-200 text-red-700',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
  neutral: 'bg-slate-100 border-slate-300 text-slate-700',
}

export function ToneBadge({ tone, children, title }: { tone: Tone; children: React.ReactNode; title?: string }) {
  return (
    <span title={title} className={cn('inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap', TONE_CLASS[tone])}>
      {children}
    </span>
  )
}

function CopyRewrite({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Clipboard access denied')
    }
  }
  return (
    <button type="button" onClick={copy} className="shrink-0 inline-flex items-center gap-1 text-[12px] font-medium text-purple-text hover:underline">
      {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : label}
    </button>
  )
}

/** A citation past the plan's limit: where it is, and a way to unlock it. Nothing about it was checked. */
function LockedCard({ card }: { card: CitationCard }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <Lock size={13} className="text-slate-500 shrink-0" />
        <span className="text-[13px] font-semibold text-slate-700 truncate">{card.markerText}</span>
        <span className="text-[12px] text-slate-600 hidden sm:inline">Not checked on your plan</span>
      </div>
      <Link to="/app/upgrade" className="shrink-0 text-[12px] font-semibold text-purple-text hover:underline">Check this too</Link>
    </div>
  )
}

interface Props {
  card: CitationCard
  /** Called when the writer asks to add this citation to their reference list. Absent: the button is not shown. */
  onAddReference?: (card: CitationCard) => void
  /** Cards whose strong-wording warning the writer has dismissed (see lib/citationCheckOverstatement). Absent: nothing is dismissed. */
  dismissedOverstatements?: ReadonlySet<string>
  /** Called when the writer dismisses the strong-wording warning. Absent: the Dismiss button is not shown. */
  onDismissOverstatement?: (card: CitationCard) => void
  /** Run this one citation again after a failure on our side. Absent: the button is not shown. */
  onRetry?: (card: CitationCard) => void
}

export function CitationCardView({ card, onAddReference, dismissedOverstatements, onDismissOverstatement, onRetry }: Props) {
  if (card.locked) return <LockedCard card={card} />

  const v = card.verdict
  const badge = primaryBadge(card)
  const resolution = resolutionBadge(card)
  const failure = failureMeta(v?.failureType)
  const note = v && !linkNote(card) ? extraNote(v) : null   // the year-link note already carries any abstract-only caveat
  const sourceUrl = safeExternalUrl(card.sourceUrl)
  const canAddReference = !!onAddReference && needsReferenceEntry(card) && referenceStub(card) !== null
  const flags = chipFlags(card)
  const yearNote = linkNote(card)
  const overstatement = visibleOverstatement(card, dismissedOverstatements ?? new Set())
  const corrected = correctedReference(card)
  const retryable = isRetryable(card)

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[14px] font-semibold text-slate-900">{cardTitle(card)}</span>
        {sourceUrl && (
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer" title="Open the source in a new tab"
            className="shrink-0 inline-flex items-center gap-1 text-[12px] font-medium text-slate-600 hover:text-purple-text transition-colors">
            View Source <ExternalLink size={12} aria-hidden />
          </a>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {badge ? (
          <ToneBadge tone={badge.tone} title={badge.hint}>{badge.label}</ToneBadge>
        ) : (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium text-slate-600"><Loader2 size={12} className="animate-spin" /> Checking…</span>
        )}
      </div>
      {(resolution || flags.length > 0) && (
        <p className="text-[11.5px] text-slate-600" data-testid="secondary-findings">
          Also:{' '}
          {[
            resolution ? { key: 'resolution', label: resolution.label, hint: card.resolutionNote ?? undefined } : null,
            ...flags.map(f => ({ key: f, label: flagMeta(f).label, hint: flagMeta(f).hint })),
          ].filter((x): x is { key: string; label: string; hint: string | undefined } => x !== null).map((x, i) => (
            <span key={x.key} title={x.hint}>{i > 0 ? ' · ' : ''}{x.label}</span>
          ))}
        </p>
      )}

      {yearNote && <p className="text-[12.5px] leading-relaxed text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{yearNote}</p>}

      {v && <p className="text-[12.5px] leading-relaxed text-slate-700"><span className="font-semibold text-slate-800">Claim: </span>{v.claimText}</p>}

      {overstatement && (
        <div className="rounded-lg bg-amber-50 border border-amber-300 px-3 py-2">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[12.5px] font-semibold text-amber-900">Strongly worded{overstatement.severity === 'Elevated' ? ' and unsupported' : ''}</p>
            {onDismissOverstatement && (
              <button type="button" onClick={() => onDismissOverstatement(card)}
                className="shrink-0 text-[12px] font-medium text-amber-900 hover:underline">Dismiss</button>
            )}
          </div>
          <p className="text-[12.5px] text-amber-900 mt-0.5">{overstatementMessage(overstatement)}</p>
          <p className="text-[12.5px] text-slate-800 mt-0.5">{overstatement.suggestion}</p>
        </div>
      )}

      {v && (
        <>
          <p className="text-[12.5px] leading-relaxed text-slate-800">{v.reasoning}</p>

          {failure && (
            <p className="text-[12.5px] leading-relaxed text-slate-700">
              <span className="font-semibold text-slate-800">{failure.label}.</span> {failure.explanation}
            </p>
          )}

          {v.evidenceQuote && (
            <blockquote className="border-l-2 border-purple-accent/50 bg-purple-tint/30 rounded-r-lg px-3 py-2">
              <p className="text-[12.5px] italic text-slate-800">“{v.evidenceQuote}”</p>
              <p className="mt-1 text-[11px] text-slate-600">From the source · {evidenceLabel(v.evidenceLevel)}</p>
            </blockquote>
          )}
          {!v.evidenceQuote && v.verdict !== 'CannotVerify' && (
            <p className="text-[12px] text-slate-600">{evidenceLabel(v.evidenceLevel)}</p>
          )}

          {note && <p className="text-[12px] text-slate-600">{note}</p>}

          {v.suggestedRewrite && (
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[12px] font-medium text-slate-700">A wording the source supports</p>
                <CopyRewrite text={v.suggestedRewrite} />
              </div>
              <p className="text-[12.5px] text-slate-800 mt-0.5">{v.suggestedRewrite}</p>
            </div>
          )}
        </>
      )}

      {card.metadataDiffs.length > 0 && (
        <ul className="text-[12.5px] text-slate-700 space-y-0.5">
          {card.metadataDiffs.map(d => (
            <li key={d.field}>
              <span className="font-semibold text-slate-800">{diffFieldLabel(d.field)}:</span> your reference says <em>{d.inDraft}</em>; the record says <em>{d.inRecord}</em>.
            </li>
          ))}
        </ul>
      )}

      {corrected && (
        <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[12px] font-medium text-slate-700">Suggested corrected reference</p>
            <CopyRewrite text={corrected} label="Copy corrected reference" />
          </div>
          <p className="text-[12.5px] text-slate-800 mt-0.5 break-words">{corrected}</p>
          <p className="text-[11px] text-slate-600 mt-1">Copy it into your reference list. Your uploaded file is not changed.</p>
        </div>
      )}

      {retryable && onRetry && (
        <div className="pt-2.5 border-t border-slate-100">
          <button type="button" onClick={() => onRetry(card)}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-800 bg-slate-50 hover:bg-purple-tint/50 hover:text-purple-text border border-slate-300 px-3 py-1.5 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent">
            <RotateCw size={12} aria-hidden /> Retry this citation
          </button>
        </div>
      )}

      {card.referenceEntry && (
        <details className="text-[12px] text-slate-600">
          <summary className="cursor-pointer hover:text-slate-800">Reference entry</summary>
          <p className="mt-1 text-slate-700 break-words">{card.referenceEntry}</p>
        </details>
      )}

      {canAddReference && (
        <div className="pt-2.5 border-t border-slate-100 flex items-center gap-2">
          <button type="button" onClick={() => onAddReference?.(card)}
            title="Adds one line for you to fill in at the end of your reference list. Nothing else in your draft changes."
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-800 bg-slate-50 hover:bg-purple-tint/50 hover:text-purple-text border border-slate-300 hover:border-purple-accent/40 px-3 py-1.5 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent">
            <Plus size={13} aria-hidden /> Add entry to References
          </button>
        </div>
      )}
    </div>
  )
}

/** A supported citation as one line (status, who, what was claimed). Click or press Enter to open the full card. */
export function CollapsedCitationRow({ card, onOpen }: { card: CitationCard; onOpen: () => void }) {
  const badge = primaryBadge(card)
  return (
    <button type="button" onClick={onOpen} aria-expanded={false}
      className="w-full text-left rounded-lg border border-slate-200 bg-white px-3 py-2 flex items-center gap-2.5 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent">
      <ChevronRight size={13} className="shrink-0 text-slate-500" aria-hidden />
      {badge && <ToneBadge tone={badge.tone}>{badge.label}</ToneBadge>}
      <span className="text-[13px] font-medium text-slate-900 shrink-0">{cardTitle(card)}</span>
      <span className="text-[12px] text-slate-600 truncate min-w-0">{card.verdict?.claimText}</span>
    </button>
  )
}
