import type { ReactNode } from 'react'

// Visually flags unfilled legal placeholders in the rendered page (not just in source)
// so they can't be silently shipped — pair with a grep for "PLACEHOLDER" before publish.
export function LegalPlaceholder({ children }: { children: ReactNode }) {
  return (
    <span className="inline rounded px-1 py-0.5 bg-amber-100 text-amber-800 font-medium whitespace-normal">
      [PLACEHOLDER: {children}]
    </span>
  )
}
