import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface ConfidenceCaveatProps {
  children: ReactNode
  className?: string
}

/**
 * Quiet inline note for low-input-size accuracy caveats — matches the muted
 * "Based on N words · low confidence" treatment used on the AI Detector page,
 * as opposed to a prominent warning banner (reserved for blocking/data-integrity issues).
 */
export function ConfidenceCaveat({ children, className }: ConfidenceCaveatProps) {
  return <p className={cn('text-xs text-gray-400', className)}>{children}</p>
}
