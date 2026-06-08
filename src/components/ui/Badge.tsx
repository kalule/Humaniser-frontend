import React from 'react'
import { cn } from '../../lib/utils'

type BadgeVariant =
  | 'plan-free'
  | 'plan-pro'
  | 'plan-unlimited'
  | 'success'
  | 'warning'
  | 'error'
  | 'tone'
  | 'default'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  'plan-free': 'bg-slate-500/20 text-slate-300',
  'plan-pro': 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30',
  'plan-unlimited': 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
  success: 'bg-emerald-500/20 text-emerald-400',
  warning: 'bg-amber-500/20 text-amber-400',
  error: 'bg-red-500/20 text-red-400',
  tone: 'bg-indigo-500/10 text-indigo-300 text-xs',
  default: 'bg-white/10 text-text-main',
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
