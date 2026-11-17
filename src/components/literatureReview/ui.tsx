import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { isRunActive, type ReviewRun } from '../../lib/literatureReview'

// Small shared pieces of Literature Review Studio's steps, built on the app's tokens (all-light theme).


export function Panel({ title, description, actions, children, className, id }: { title?: string; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section aria-labelledby={title && id ? `${id}-title` : undefined} className={cn('rounded-xl border border-slate-200 bg-white p-4', className)}>
      {title || actions ? (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            {title ? <h2 id={id ? `${id}-title` : undefined} className="text-[16px] font-semibold text-slate-900">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-[13px] text-slate-700">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}

export function Notice({ tone = 'info', children, role }: { tone?: 'info' | 'warning' | 'error' | 'success'; children: ReactNode; role?: 'alert' | 'status' }) {
  const tones = {
    info: 'border-slate-300 bg-slate-50 text-slate-900',
    warning: 'border-amber-300 bg-amber-50 text-amber-950',
    error: 'border-red-300 bg-red-50 text-red-900',
    success: 'border-green-300 bg-green-50 text-green-900',
  }
  return <div role={role ?? (tone === 'error' ? 'alert' : undefined)} className={cn('rounded-lg border p-3 text-[13px]', tones[tone])}>{children}</div>
}

export function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[12px] font-medium', className)}>{children}</span>
}

/** A background run's progress, its failure in plain words, or nothing when there is no run yet. */
export function RunBanner({ run, label }: { run: ReviewRun | null; label: string }) {
  if (!run) return null
  if (isRunActive(run)) {
    const pct = run.total > 0 ? Math.round((run.done / run.total) * 100) : null
    return (
      <div role="status" className="rounded-lg border border-purple-accent/30 bg-purple-tint/40 p-3 text-[13px] text-slate-900">
        <div className="flex items-center gap-2"><Loader2 size={14} className="animate-spin text-purple-accent" aria-hidden /> {label}: {run.stage ?? 'working'}{pct !== null ? ` (${run.done} of ${run.total})` : ''}</div>
        {pct !== null ? <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white"><div className="h-full bg-purple-accent" style={{ width: `${pct}%` }} /></div> : null}
      </div>
    )
  }
  if (run.status === 'Failed') return <Notice tone="error">{run.errorMessage ?? `${label} did not finish.`}</Notice>
  if (run.status === 'PartiallySucceeded') return <Notice tone="warning">{run.stage ?? `${label} finished; some parts need attention.`}{run.creditsCharged ? ` ${run.creditsCharged} credits used.` : ''}</Notice>
  return <Notice tone="success" role="status">{run.stage ?? `${label} finished.`}{run.creditsCharged ? ` ${run.creditsCharged} credits used.` : ''}</Notice>
}


export function Loading({ label = 'Loading' }: { label?: string }) {
  return <div role="status" className="flex items-center gap-2 p-4 text-[14px] text-slate-700"><Loader2 size={16} className="animate-spin text-purple-accent" aria-hidden /> {label}…</div>
}
