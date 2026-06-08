import { useRef, type KeyboardEvent, type ClipboardEvent } from 'react'
import { cn } from '../../lib/utils'

interface OtpInputProps {
  value: string[]
  onChange: (value: string[]) => void
  length?: number
  disabled?: boolean
  hasError?: boolean
}

export function OtpInput({ value, onChange, length = 6, disabled = false, hasError = false }: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([])

  const focusNext = (index: number) => refs.current[index + 1]?.focus()
  const focusPrev = (index: number) => refs.current[index - 1]?.focus()

  const handleChange = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1)
    const next = [...value]
    next[index] = digit
    onChange(next)
    if (digit) focusNext(index)
  }

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (value[index]) {
        const next = [...value]
        next[index] = ''
        onChange(next)
      } else {
        focusPrev(index)
      }
    }
    if (e.key === 'ArrowLeft') focusPrev(index)
    if (e.key === 'ArrowRight') focusNext(index)
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!pasted) return
    const next = Array(length).fill('')
    pasted.split('').forEach((ch, i) => { next[i] = ch })
    onChange(next)
    const lastFilled = Math.min(pasted.length, length - 1)
    refs.current[lastFilled]?.focus()
  }

  return (
    <div className="flex gap-3 justify-center">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el }}
          type="text"
          inputMode="numeric"
          pattern="\d*"
          maxLength={1}
          value={value[i] ?? ''}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className={cn(
            'w-12 h-14 text-center text-xl font-bold rounded-md border bg-card',
            'transition-all duration-200 focus:outline-none focus:ring-2',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            value[i]
              ? hasError
                ? 'border-red-500 text-red-400 focus:ring-red-500/40'
                : 'border-primary text-primary focus:ring-primary/40'
              : hasError
                ? 'border-red-500/50 text-text-main focus:ring-red-500/40'
                : 'border-border text-text-main focus:ring-primary/40',
          )}
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  )
}
