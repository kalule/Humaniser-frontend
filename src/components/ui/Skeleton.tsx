import { cn } from '../../lib/utils'

interface SkeletonProps {
  className?: string
  lines?: number
  variant?: 'text' | 'card' | 'circle'
  /** 'dark' for dark-surfaced panels (default), 'light' for white tool-panel cards */
  tone?: 'dark' | 'light'
}

// Widths cycled through for each text line to look natural
const LINE_WIDTHS = ['w-full', 'w-5/6', 'w-4/5', 'w-3/4', 'w-2/3', 'w-11/12']

function ShimmerBase({ className, tone = 'dark' }: { className?: string; tone?: 'dark' | 'light' }) {
  return (
    <div
      className={cn(
        'animate-shimmer bg-[length:400%_100%] rounded',
        tone === 'light'
          ? 'bg-gradient-to-r from-[#f1f5f9] via-[#e2e8f0] to-[#f1f5f9]'
          : 'bg-gradient-to-r from-border via-slate-600 to-border',
        className,
      )}
    />
  )
}

export function Skeleton({
  className,
  lines = 3,
  variant = 'text',
  tone = 'dark',
}: SkeletonProps) {
  if (variant === 'circle') {
    return (
      <ShimmerBase
        tone={tone}
        className={cn('rounded-full w-10 h-10', className)}
      />
    )
  }

  if (variant === 'card') {
    return (
      <div
        className={cn(
          tone === 'light' ? 'bg-white border border-[#e0e0da]' : 'bg-card border border-border',
          'rounded-lg p-5 space-y-3',
          className,
        )}
      >
        <ShimmerBase tone={tone} className="h-5 w-2/5" />
        <ShimmerBase tone={tone} className="h-4 w-full" />
        <ShimmerBase tone={tone} className="h-4 w-11/12" />
        <ShimmerBase tone={tone} className="h-4 w-4/5" />
      </div>
    )
  }

  // variant === 'text'
  const count = Math.max(1, lines)
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: count }, (_, i) => (
        <ShimmerBase
          key={i}
          tone={tone}
          className={cn(
            'h-4',
            LINE_WIDTHS[i % LINE_WIDTHS.length],
            // Last line is shorter to look like natural text
            i === count - 1 && count > 1 && 'w-2/3',
          )}
        />
      ))}
    </div>
  )
}
