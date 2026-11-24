import { useState } from 'react'
import { Info, X } from 'lucide-react'

export const MODE_HINT_KEY = 'dm.modeHint.dismissed'

const readDismissed = () => { try { return localStorage.getItem(MODE_HINT_KEY) === '1' } catch { return false } }

/**
 * Shown on first use of the Document view until dismissed: what Document is for, and what Guided
 * is for. Per viewer (browser storage); a private window simply shows it again.
 */
export function ModeHint() {
  const [dismissed, setDismissed] = useState(readDismissed)
  if (dismissed) return null
  const dismiss = () => {
    try { localStorage.setItem(MODE_HINT_KEY, '1') } catch { /* convenience only */ }
    setDismissed(true)
  }
  return (
    <aside aria-label="About this view" className="max-w-[760px] mx-auto mt-4 sm:mt-7 -mb-1 sm:-mb-3 flex items-start gap-2.5 rounded-xl px-4 py-3 text-[13px] leading-[1.5]"
      style={{ background: 'var(--color-purple-tint)', color: 'var(--text-primary)' }}>
      <Info size={15} className="mt-0.5 shrink-0" aria-hidden="true" style={{ color: 'var(--color-purple-text)' }} />
      <p className="m-0 flex-1">
        <b className="font-semibold">Document</b> shows the whole proposal: read, edit and approve any section here while the agent drafts the rest.{' '}
        <b className="font-semibold">Guided</b> takes you through one section at a time, with the setup and repair tools.
        Switch between them at the top right.
      </p>
      <button type="button" onClick={dismiss} aria-label="Dismiss this tip"
        className="dm-action shrink-0 rounded-md p-1 hover:bg-white/60" style={{ color: 'var(--text-secondary)' }}>
        <X size={14} aria-hidden="true" />
      </button>
    </aside>
  )
}
