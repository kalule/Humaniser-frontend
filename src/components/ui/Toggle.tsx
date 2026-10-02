import { cn } from '../../lib/utils'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  disabled?: boolean
  className?: string
}

export function Toggle({ checked, onChange, label, disabled = false, className }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800',
        checked ? 'bg-indigo-600' : 'bg-slate-600',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}
