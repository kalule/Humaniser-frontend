import { Trash2 } from 'lucide-react'
import { cn } from '../../lib/utils'

interface ClearButtonProps {
  onClick: () => void
  disabled?: boolean
  className?: string
}

/**
 * Unified "Clear" action for the input-card footer, shared across all tool
 * pages (Humaniser, Detector, Paraphrase, Grammar, Plagiarism, Summarise).
 * Always rendered — disabled (not hidden) when there's nothing to clear, so
 * the footer layout stays stable as text is typed and removed.
 */
export function ClearButton({ onClick, disabled, className }: ClearButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title="Clear"
      className={cn(
        'group flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium text-purple-accent hover:text-purple-deep hover:bg-purple-tint active:bg-purple-tint transition-colors duration-150 ease-in-out disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-purple-accent disabled:hover:bg-transparent',
        className,
      )}
    >
      <Trash2 size={14} className="transition-transform duration-150 group-hover:scale-110" />
      Clear
    </button>
  )
}
