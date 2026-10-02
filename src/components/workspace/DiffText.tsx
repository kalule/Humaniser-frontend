import { useMemo } from 'react'
import { computeWordDiff } from '../../lib/wordDiff'

interface DiffTextProps {
  original: string
  revised: string
  className?: string
}

/** Renders `revised` with inline highlights for words changed relative to `original`. */
export function DiffText({ original, revised, className }: DiffTextProps) {
  const tokens = useMemo(() => computeWordDiff(original, revised), [original, revised])

  return (
    <p className={className ?? 'text-slate-100 text-sm leading-relaxed whitespace-pre-wrap'}>
      {tokens.map((token, idx) => {
        if (token.type === 'removed') {
          return (
            <span
              key={idx}
              className="text-red-400/80 line-through decoration-red-400/60 bg-red-500/10 rounded-sm"
            >
              {token.text}
            </span>
          )
        }
        if (token.type === 'added') {
          return (
            <mark key={idx} className="bg-sky-500/20 text-sky-300 rounded-sm">
              {token.text}
            </mark>
          )
        }
        return <span key={idx}>{token.text}</span>
      })}
    </p>
  )
}
