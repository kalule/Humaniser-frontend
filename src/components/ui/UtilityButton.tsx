import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface UtilityButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode
  label: string
}

/**
 * Shared "utility action" button — Paste, Upload, Copy, Download, etc.
 * Used everywhere these actions appear so they render with identical
 * chrome across every tool page (Humaniser, Detector, Paraphraser,
 * Grammar, Summariser, Plagiarism).
 */
export function UtilityButton({ icon, label, className, ...rest }: UtilityButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 py-2',
        'text-[14px] font-medium text-zinc-700 transition-colors',
        'hover:bg-zinc-100 hover:border-zinc-300',
        'active:bg-zinc-200',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-zinc-200',
        className,
      )}
      {...rest}
    >
      <span className="inline-flex shrink-0 text-zinc-500 [&>svg]:w-4 [&>svg]:h-4">{icon}</span>
      {label}
    </button>
  )
}
