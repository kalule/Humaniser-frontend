import { cn } from '../../lib/utils'

interface SkeletonProps {
  className?: string
  lines?: number
  variant?: 'text' | 'card' | 'circle'
}

// Widths cycled through for each text line to look natural
const LINE_WIDTHS = ['w-full', 'w-5/6', 'w-4/5', 'w-3/4', 'w-2/3', 'w-11/12']

function ShimmerBase({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-shimmer bg-gradient-to-r from-border via-slate-600 to-border bg-[length:400%_100%] rounded',
        className,
      )}
    />
  )
}

export function Skeleton({
  className,
  lines = 3,
  variant = 'text',
}: SkeletonProps) {
  if (variant === 'circle') {
    return (
      <ShimmerBase
        className={cn('rounded-full w-10 h-10', className)}
      />
    )
  }

  if (variant === 'card') {
    return (
      <div
        className={cn(
          'bg-card border border-border rounded-lg p-5 space-y-3',
          className,
        )}
      >
        <ShimmerBase className="h-5 w-2/5" />
        <ShimmerBase className="h-4 w-full" />
        <ShimmerBase className="h-4 w-11/12" />
        <ShimmerBase className="h-4 w-4/5" />
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
