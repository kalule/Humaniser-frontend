import React, { useState, useId } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '../../lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftIcon?: React.ReactNode
  rightElement?: React.ReactNode
}

export function Input({
  label,
  error,
  hint,
  leftIcon,
  rightElement,
  className,
  type,
  id: idProp,
  ...rest
}: InputProps) {
  const generatedId = useId()
  const id = idProp ?? generatedId

  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'
  const resolvedType = isPassword ? (showPassword ? 'text' : 'password') : type

  const hasError = error != null && error.length > 0

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label != null && (
        <label
          htmlFor={id}
          className="text-sm font-medium text-text-main"
        >
          {label}
        </label>
      )}

      <div className="relative flex items-center">
        {leftIcon != null && (
          <span className="absolute left-3 flex items-center text-muted pointer-events-none">
            {leftIcon}
          </span>
        )}

        <input
          id={id}
          type={resolvedType}
          className={cn(
            'w-full bg-card border rounded-md px-4 py-3 text-text-main text-sm',
            'placeholder:text-muted',
            'transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            leftIcon != null && 'pl-10',
            (isPassword || rightElement != null) && 'pr-10',
            hasError
              ? 'border-red-500 focus:ring-red-500/30 focus:border-red-500'
              : 'border-border',
            className,
          )}
          {...rest}
        />

        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3 flex items-center text-muted hover:text-text-main transition-colors duration-150 focus:outline-none"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}

        {!isPassword && rightElement != null && (
          <span className="absolute right-3 flex items-center">
            {rightElement}
          </span>
        )}
      </div>

      {hasError && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      {!hasError && hint != null && (
        <p className="text-xs text-muted">{hint}</p>
      )}
    </div>
  )
}
