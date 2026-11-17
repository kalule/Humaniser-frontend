import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

// Small shared pieces for the Qualitative Analysis screens, in the same plain style as Study Design and Feedback Tracker.

export const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[14px] text-slate-900 outline-none focus:border-purple-accent focus-visible:ring-2 focus-visible:ring-purple-accent/30 disabled:bg-slate-50'
export const labelClass = 'mb-1 block text-[13px] font-medium text-slate-800'

export function PrimaryButton({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...props}
      className={cn('inline-flex items-center justify-center gap-1.5 rounded-lg bg-purple-deep px-3.5 py-2 text-[14px] font-semibold text-white outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-purple-accent/50 disabled:cursor-not-allowed disabled:opacity-50', className)}>
      {children}
    </button>
  )
}

export function SecondaryButton({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...props}
      className={cn('inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-800 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-purple-accent/40 disabled:cursor-not-allowed disabled:opacity-50', className)}>
      {children}
    </button>
  )
}

export function DangerButton({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...props}
      className={cn('inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-[13px] font-medium text-red-800 outline-none hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-400/50 disabled:cursor-not-allowed disabled:opacity-50', className)}>
      {children}
    </button>
  )
}

/** A notice that stays on screen. Tone is carried by an icon-free text label as well as colour. */
export function Notice({ tone = 'info', title, children, className }: { tone?: 'info' | 'warning' | 'error' | 'success'; title?: string; children: ReactNode; className?: string }) {
  const styles = {
    info: 'border-slate-200 bg-slate-50 text-slate-800',
    warning: 'border-amber-300 bg-amber-50 text-amber-950',
    error: 'border-red-300 bg-red-50 text-red-800',
    success: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  }[tone]
  return (
    <div role={tone === 'error' ? 'alert' : undefined} className={cn('rounded-lg border p-3 text-[13px]', styles, className)}>
      {title && <p className="mb-0.5 font-semibold">{title}</p>}
      {children}
    </div>
  )
}

export function Section({ title, id, children, actions }: { title: string; id: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="text-[16px] font-semibold text-slate-900">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  )
}

export function Pill({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'purple' | 'amber' | 'emerald' | 'red' }) {
  const styles = {
    slate: 'border-slate-300 bg-slate-50 text-slate-800',
    purple: 'border-purple-200 bg-purple-50 text-purple-deep',
    amber: 'border-amber-300 bg-amber-50 text-amber-950',
    emerald: 'border-emerald-300 bg-emerald-50 text-emerald-900',
    red: 'border-red-300 bg-red-50 text-red-800',
  }[tone]
  return <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[12px] font-medium', styles)}>{children}</span>
}

export const dateTime = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
export const date = (iso: string) => new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })
