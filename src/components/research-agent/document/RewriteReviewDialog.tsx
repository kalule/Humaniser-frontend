import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { changeCount, diffParagraphs, mergeDiff } from '../../../lib/paragraphDiff'

interface Props {
  label:    string
  /** The student's text before the rewrite. */
  before:   string
  /** The rewrite. */
  after:    string
  applying: boolean
  onApply:  (merged: string) => void
  /** Close without deciding: the student's text stays, the review stays available. */
  onClose:  () => void
}

/**
 * Rewrite over text the student edited: every changed passage is shown old-beside-new and kept as
 * the student's version unless they accept it. Nothing is replaced until "Apply".
 */
export function RewriteReviewDialog({ label, before, after, applying, onApply, onClose }: Props) {
  const parts = useMemo(() => diffParagraphs(before, after), [before, after])
  const total = changeCount(parts)
  const [accepted, setAccepted] = useState<Set<number>>(() => new Set())
  const set = (id: number, on: boolean) => setAccepted(prev => { const next = new Set(prev); if (on) next.add(id); else next.delete(id); return next })
  const allIds = parts.flatMap(p => (p.kind === 'change' ? [p.id] : []))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="rewrite-review-title"
      onKeyDown={e => { if (e.key === 'Escape') onClose() }}>
      <button type="button" className="absolute inset-0 bg-black/30" aria-label="Close" onClick={onClose} />
      <div className="relative w-[min(860px,100%)] max-h-[88vh] flex flex-col rounded-xl bg-white shadow-xl" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div className="flex items-start gap-3 px-5 pt-4 pb-3" style={{ borderBottom: '0.5px solid var(--border-hairline)' }}>
          <div className="flex-1 min-w-0">
            <h2 id="rewrite-review-title" className="m-0 text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>Review the rewrite of {label}</h2>
            <p className="m-0 mt-0.5 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
              {total === 0 ? 'The rewrite matches your text.' : `${total} change${total === 1 ? '' : 's'}. Each one keeps your version unless you accept it.`}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="dm-action rounded-md p-1.5 hover:bg-slate-50" style={{ color: 'var(--text-secondary)' }}>
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto dm-scroll px-5 py-4 flex flex-col gap-3">
          {parts.map((part, i) => part.kind === 'same' ? (
            <p key={`s${i}`} className="m-0 text-[13px] leading-[1.6] line-clamp-2" style={{ color: 'var(--text-muted)', fontFamily: 'Georgia, serif' }}>
              {part.text.join(' ')}
            </p>
          ) : (
            <fieldset key={`c${part.id}`} className="m-0 rounded-lg p-3 flex flex-col gap-2" style={{ border: '1px solid var(--border-strong)' }}>
              <legend className="px-1 text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>Change {part.id + 1}</legend>
              <div className="grid gap-3 sm:grid-cols-2 text-[13px] leading-[1.6]" style={{ fontFamily: 'Georgia, serif' }}>
                <div>
                  <div className="text-[11px] font-semibold mb-1" style={{ color: 'var(--text-secondary)', fontFamily: 'Inter, system-ui, sans-serif' }}>Your text</div>
                  {part.before.length ? part.before.map((t, k) => <p key={k} className="m-0 mb-1.5">{t}</p>)
                    : <p className="m-0 italic" style={{ color: 'var(--text-muted)' }}>(nothing)</p>}
                </div>
                <div className="rounded-md px-2 py-1" style={{ background: 'var(--color-green-tint)' }}>
                  <div className="text-[11px] font-semibold mb-1" style={{ color: 'var(--color-green-text)', fontFamily: 'Inter, system-ui, sans-serif' }}>Rewrite</div>
                  {part.after.length ? part.after.map((t, k) => <p key={k} className="m-0 mb-1.5">{t}</p>)
                    : <p className="m-0 italic" style={{ color: 'var(--text-muted)' }}>(removed)</p>}
                </div>
              </div>
              <div className="flex gap-4 text-[12px]" style={{ color: 'var(--text-primary)' }}>
                <label className="inline-flex items-center gap-1.5">
                  <input type="radio" name={`change-${part.id}`} checked={!accepted.has(part.id)} onChange={() => set(part.id, false)} /> Keep mine
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input type="radio" name={`change-${part.id}`} checked={accepted.has(part.id)} onChange={() => set(part.id, true)} /> Accept rewrite
                </label>
              </div>
            </fieldset>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 px-5 py-3" style={{ borderTop: '0.5px solid var(--border-hairline)' }}>
          <button type="button" onClick={() => setAccepted(new Set(allIds))} disabled={total === 0}
            className="dm-action rounded-lg px-3 py-1.5 text-[12px] font-semibold disabled:opacity-50" style={{ border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}>
            Accept all
          </button>
          <button type="button" onClick={() => setAccepted(new Set())} disabled={total === 0}
            className="dm-action rounded-lg px-3 py-1.5 text-[12px] font-semibold disabled:opacity-50" style={{ border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}>
            Keep all mine
          </button>
          <div className="flex-1" />
          <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{accepted.size} of {total} accepted</span>
          <button type="button" onClick={() => onApply(mergeDiff(parts, accepted))} disabled={applying}
            className="dm-action rounded-lg px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60" style={{ background: 'var(--color-purple)' }}>
            {applying ? 'Saving…' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  )
}
