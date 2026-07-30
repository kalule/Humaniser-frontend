import { useState, type ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface TooltipProps {
  label: string
  children: ReactNode
  side?: 'top' | 'bottom'
}

export function Tooltip({ label, children, side = 'top' }: TooltipProps) {
  const [open, setOpen] = useState(false)

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className={cn(
            'pointer-events-none absolute left-1/2 -translate-x-1/2 z-50 whitespace-nowrap rounded-md bg-slate-800 px-2 py-1 text-[11px] font-medium text-white shadow-lg',
            side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
          )}
        >
          {label}
        </span>
      )}
    </span>
  )
}
