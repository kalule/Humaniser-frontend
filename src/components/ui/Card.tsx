import React from 'react'
import { cn } from '../../lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  gradient?: boolean
  onClick?: () => void
}

export function Card({
  children,
  className,
  hover = false,
  gradient = false,
  onClick,
}: CardProps) {
  const isClickable = onClick != null

  return (
    <div
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      className={cn(
        'bg-card rounded-lg border border-border shadow-card',
        hover && 'transition-all duration-300 hover:-translate-y-1 hover:shadow-elevated',
        gradient && [
          'relative',
          'before:absolute before:inset-0 before:rounded-lg before:-z-10',
          'before:opacity-0 hover:before:opacity-100',
          'before:transition-opacity before:duration-300',
          'shadow-[0_0_0_1px_#334155]',
          'hover:shadow-[0_0_0_1px_rgba(99,102,241,0.5),0_0_20px_rgba(99,102,241,0.15)]',
        ],
        isClickable && 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
        className,
      )}
    >
      {children}
    </div>
  )
}
