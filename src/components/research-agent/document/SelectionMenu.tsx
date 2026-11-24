import { useState } from 'react'
import { Check, Loader2, Quote, SearchCheck, Sparkles, X } from 'lucide-react'
import type { FetchedLiterature } from '../../../types/research'

export type AiEditKind = 'rewrite' | 'shorten' | 'expand'

export interface Suggestion {
  kind:     AiEditKind
  original: string
  /** Null while the request runs. */
  proposed: string | null
  error:    string | null
  /** Citations in the original that the proposed text dropped or changed. */
  lostCitations: string[]
}

const KIND_LABEL: Record<AiEditKind, string> = { rewrite: 'Rewrite', shorten: 'Shorten', expand: 'Expand' }

interface MenuProps {
  style:       React.CSSProperties
  busy:        boolean
  canCite:     boolean
  sources:     FetchedLiterature[]
  onAiEdit:    (kind: AiEditKind) => void
  onCite:      (source: FetchedLiterature) => void
  onCheckClaim: () => void
}

/**
 * The only editing chrome in Document view: a small menu over selected text. Nothing shows until
 * text is selected; every AI change comes back as a suggestion to accept or reject.
 */
export function SelectionMenu({ style, busy, canCite, sources, onAiEdit, onCite, onCheckClaim }: MenuProps) {
  const [citing, setCiting] = useState(false)
  const button = 'dm-action inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium hover:bg-slate-50 disabled:opacity-50'
  return (
    <div role="toolbar" aria-label="Edit selected text" style={style}
      className="dm-floating absolute z-30 rounded-lg bg-white p-1 flex flex-col"
      // Keep the editor's selection: clicking a button must not collapse it first.
      onMouseDown={e => { if ((e.target as HTMLElement).closest('button')) e.preventDefault() }}>
      <div className="flex items-center gap-0.5">
        {(['rewrite', 'shorten', 'expand'] as const).map(kind => (
          <button key={kind} type="button" className={button} disabled={busy} onClick={() => onAiEdit(kind)} style={{ color: 'var(--text-primary)' }}>
            {kind === 'rewrite' && <Sparkles size={12} aria-hidden="true" />}{KIND_LABEL[kind]}
          </button>
        ))}
        <span aria-hidden="true" className="w-px h-4 mx-0.5" style={{ background: 'var(--border-hairline)' }} />
        <button type="button" className={button} disabled={!canCite || sources.length === 0} aria-expanded={citing}
          onClick={() => setCiting(c => !c)} style={{ color: 'var(--text-primary)' }}
          title={!canCite ? 'Numbered (IEEE) citations are added in Guided.' : sources.length === 0 ? 'Pin a source first.' : undefined}>
          <Quote size={12} aria-hidden="true" /> Add citation
        </button>
        <button type="button" className={button} onClick={onCheckClaim} style={{ color: 'var(--text-primary)' }}>
          <SearchCheck size={12} aria-hidden="true" /> Check claim
        </button>
      </div>
      {citing && (
        <ul className="list-none m-0 p-0 mt-1 max-h-48 w-[min(340px,80vw)] overflow-y-auto dm-scroll flex flex-col" aria-label="Cite a pinned source">
          {sources.map(s => (
            <li key={s.id}>
              <button type="button" onClick={() => { setCiting(false); onCite(s) }}
                className="dm-action w-full text-left rounded-md px-2 py-1.5 text-[12px] hover:bg-slate-50" style={{ color: 'var(--text-primary)' }}>
                <span className="font-semibold">{s.authors.split(',')[0]} ({s.year || 'n.d.'})</span> · {s.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

interface SuggestionProps {
  suggestion: Suggestion
  style:      React.CSSProperties
  onAccept:   () => void
  onReject:   () => void
}

/** A proposed change to selected text: the old words struck through, the new ones beside them. */
export function SuggestionCard({ suggestion, style, onAccept, onReject }: SuggestionProps) {
  const { kind, original, proposed, error, lostCitations } = suggestion
  return (
    <div role="dialog" aria-label={`${KIND_LABEL[kind]} suggestion`} style={style}
      className="dm-floating absolute z-30 w-[min(420px,calc(100%-16px))] rounded-[10px] bg-white p-3.5 flex flex-col gap-2.5"
      onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onReject() } }}>
      <div className="text-[12px] font-semibold" style={{ color: 'var(--text-secondary)' }}>{KIND_LABEL[kind]} suggestion</div>
      {proposed === null && !error && (
        <p className="m-0 inline-flex items-center gap-2 text-[13px]" style={{ color: 'var(--text-secondary)' }} aria-live="polite">
          <Loader2 size={13} className="animate-spin" aria-hidden="true" /> Writing a suggestion…
        </p>
      )}
      {error && <p className="m-0 text-[13px]" style={{ color: 'var(--color-red-text)' }} role="alert">{error}</p>}
      {proposed !== null && (
        <div className="text-[14px] leading-[1.6] max-h-64 overflow-y-auto dm-scroll" style={{ fontFamily: 'Georgia, serif' }}>
          <span className="dm-suggest-old"><span className="sr-only">Current text: </span>{original}</span>{' '}
          <span className="dm-suggest-new"><span className="sr-only">Suggested text: </span>{proposed}</span>
        </div>
      )}
      {lostCitations.length > 0 && (
        <p className="m-0 text-[12px] leading-[1.45] rounded-md px-2.5 py-1.5" style={{ background: 'var(--color-amber-tint)', color: 'var(--color-amber-text)' }}>
          The suggestion drops or changes {lostCitations.join(', ')}. Accepting removes {lostCitations.length === 1 ? 'that citation' : 'those citations'} from this text.
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={onAccept} disabled={proposed === null} autoFocus={proposed !== null}
          className="dm-action inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
          style={{ background: 'var(--color-purple)' }}>
          <Check size={12} aria-hidden="true" /> Accept
        </button>
        <button type="button" onClick={onReject}
          className="dm-action inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold"
          style={{ border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}>
          <X size={12} aria-hidden="true" /> {proposed === null && !error ? 'Cancel' : 'Reject'}
        </button>
      </div>
    </div>
  )
}
