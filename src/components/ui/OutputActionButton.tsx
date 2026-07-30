import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface OutputActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode
  children: ReactNode
}

/**
 * Small bordered icon+label button for output-panel action bars (Copy,
 * Download/.txt, etc.) — shared so Detector's "Analysis report" actions and
 * Rewrite's "Humanised" actions render with identical chrome.
 */
export function OutputActionButton({ icon, children, className, ...rest }: OutputActionButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center gap-1 h-6 px-2 rounded text-[11px] text-text-sec border border-[#e0e0da] bg-white hover:border-[#d1d5db] hover:text-text-pri transition-colors disabled:opacity-40',
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
}
