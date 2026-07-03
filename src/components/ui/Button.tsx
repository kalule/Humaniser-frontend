import React from 'react'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: [
    'bg-primary text-white font-semibold',
    'hover:opacity-90 hover:shadow-glow',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ].join(' '),
  secondary: [
    'border border-border text-text-main bg-transparent',
    'hover:bg-white/5',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ].join(' '),
  ghost: [
    'bg-transparent text-[#555555]',
    'hover:text-[#1a1a18] hover:bg-[#f1f5f9]',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ].join(' '),
  danger: [
    'bg-red-500/10 border border-red-500/50 text-red-400',
    'hover:bg-red-500/20',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ].join(' '),
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-sm gap-1.5',
  md: 'px-6 py-3 text-sm rounded-md gap-2',
  lg: 'px-8 py-4 text-base rounded-md gap-2',
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  children,
  className,
  disabled,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled ?? isLoading

  return (
    <motion.button
      whileTap={isDisabled ? undefined : { scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 select-none',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      disabled={isDisabled}
      {...(rest as unknown as React.ComponentPropsWithoutRef<typeof motion.button>)}
    >
      {isLoading ? (
        <Loader2 className="animate-spin shrink-0" size={16} />
      ) : leftIcon != null ? (
        <span className="shrink-0">{leftIcon}</span>
      ) : null}
      {children}
      {!isLoading && rightIcon != null ? (
        <span className="shrink-0">{rightIcon}</span>
      ) : null}
    </motion.button>
  )
}
