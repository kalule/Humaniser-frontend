import { forwardRef, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'

/**
 * The one dropdown style for form fields: a native <select> (keyboard, screen readers and mobile
 * pickers for free) with consistent border, focus ring and chevron. For sort pills use SortControl.
 */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { wrapperClassName?: string }>(
  function Select({ className, wrapperClassName, children, ...props }, ref) {
    return (
      <span className={cn('relative inline-flex w-full', wrapperClassName)}>
        <select
          ref={ref}
          {...props}
          className={cn(
            'w-full appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pl-2.5 pr-8 text-[13px] text-slate-800 outline-none transition-colors',
            'hover:border-slate-300 focus:border-purple-accent focus:ring-2 focus:ring-purple-accent/20 disabled:opacity-60',
            className,
          )}
        >
          {children}
        </select>
        <ChevronDown size={14} aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
      </span>
    )
  },
)
