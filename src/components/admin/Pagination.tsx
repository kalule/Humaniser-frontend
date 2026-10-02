import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'

interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null

  const hasPrev = page > 1
  const hasNext = page < totalPages

  return (
    <div className="flex items-center justify-between mt-4">
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={!hasPrev}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
          hasPrev
            ? 'bg-card border border-border text-text-main hover:bg-white/5'
            : 'bg-card/50 border border-border/50 text-muted cursor-not-allowed',
        )}
      >
        <ChevronLeft size={14} />
        Previous
      </button>
      <span className="text-xs text-muted">
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={!hasNext}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
          hasNext
            ? 'bg-card border border-border text-text-main hover:bg-white/5'
            : 'bg-card/50 border border-border/50 text-muted cursor-not-allowed',
        )}
      >
        Next
        <ChevronRight size={14} />
      </button>
    </div>
  )
}
