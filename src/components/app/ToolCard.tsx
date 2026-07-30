import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

export interface ToolCardProps {
  icon: ReactNode
  iconClassName?: string
  title: string
  description: string
  ctaLabel?: string
  comingSoon?: boolean
  statusBadge?: ReactNode
  onCta: () => void
}

// Shared by AI Thesis's "Agentic Tools" grid and Proposal Studio's "What can
// you do in the Studio?" grid so both use the same explicit-CTA interaction
// pattern (see the AI Thesis + Proposal Studio UX audit).
export function ToolCard({
  icon,
  iconClassName = 'bg-slate-50 border-slate-200 text-slate-700',
  title,
  description,
  ctaLabel = 'Get Started',
  comingSoon = false,
  statusBadge,
  onCta,
}: ToolCardProps) {
  return (
    <div
      className={cn(
        'relative flex flex-col bg-white border border-slate-200 rounded-xl p-4 transition-all',
        comingSoon ? 'opacity-60 pointer-events-none' : 'hover:border-slate-300 hover:shadow-sm',
      )}
    >
      {comingSoon && (
        <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-tint text-amber-text">
          Coming Soon
        </span>
      )}
      {!comingSoon && statusBadge}

      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center mb-3 border shrink-0', iconClassName)}>
        {icon}
      </div>
      <h3 className="text-[13px] font-bold text-slate-800 leading-snug mb-1.5">{title}</h3>
      <p className="text-[12px] text-slate-500 leading-relaxed mb-3 flex-1">{description}</p>
      <button
        onClick={onCta}
        disabled={comingSoon}
        className="self-start px-3.5 py-1.5 rounded-lg bg-[#7c3aed] hover:bg-[#4c1d95] text-white text-[12px] font-semibold transition-colors shadow-sm shadow-violet-200 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {ctaLabel}
      </button>
    </div>
  )
}
