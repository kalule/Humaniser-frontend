import type { ReactNode } from 'react'
import { LABELS, NOT_AVAILABLE, type EvidenceLabel } from '../../lib/authorshipEvidence'

// Shared pieces for the Authorship Evidence screens, in the same visual language as Feedback Tracker.

export const field = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[14px] text-slate-900 outline-none placeholder:text-slate-500 focus:border-purple-accent focus-visible:ring-2 focus-visible:ring-purple-accent/30'
export const primaryButton = 'min-h-10 rounded-lg bg-purple-accent px-4 text-[14px] font-semibold text-white outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-purple-accent/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60'
export const secondaryButton = 'min-h-9 rounded-lg border border-slate-400 bg-white px-3 text-[13px] font-medium text-slate-900 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-purple-accent/40 disabled:cursor-not-allowed disabled:opacity-60'
export const dangerButton = 'min-h-9 rounded-lg bg-red-700 px-3 text-[13px] font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-red-700/50 focus-visible:ring-offset-1 disabled:opacity-60'
export const linkButton = 'rounded font-semibold text-purple-deep underline outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40'
export const labelText = 'mb-1 block text-[13px] font-medium text-slate-800'

/** Where a piece of evidence came from. Shown next to every recorded item. */
export function LabelBadge({ label }: { label: EvidenceLabel | null | undefined }) {
  const l = label ? LABELS[label] : NOT_AVAILABLE
  return <span title={l.hint} className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[12px] font-medium ${l.tone}`}>{l.text}</span>
}

export function Pill({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[12px] font-medium ${tone}`}>{children}</span>
}

export function ErrorNote({ children, onRetry }: { children: ReactNode; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-[14px] text-red-800">
      {children}{' '}
      {onRetry ? <button type="button" onClick={onRetry} className="font-semibold underline">Try again</button> : null}
    </div>
  )
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[13px] text-slate-800">{children}</p>
}

/** A plain statement that something was not recorded. Never worded as a problem with the student's work. */
export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-[14px] text-slate-800">{children}</p>
}

export function Frame({ children }: { children: ReactNode }) {
  return <div className="h-full overflow-y-auto bg-white"><div className="px-4 py-6 sm:px-6 sm:py-8"><div className="mx-auto max-w-5xl">{children}</div></div></div>
}
