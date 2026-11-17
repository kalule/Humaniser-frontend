import { Link } from 'react-router-dom'
import { cn } from '../../../lib/utils'

// The two ways to check citations, as one control on both pages. Each option keeps its own behaviour and URL: Document is the
// evidence-linked check of a whole file or draft; Quick paste is the lightweight text-only audit.

const OPTIONS = [
  { key: 'document', label: 'Document', to: '/app/citation-check' },
  { key: 'paste', label: 'Quick paste', to: '/app/citation-integrity' },
] as const

export function CitationModeToggle({ active }: { active: 'document' | 'paste' }) {
  return (
    <nav aria-label="Check mode" className="inline-flex rounded-lg border border-[#e0e0da] bg-slate-50 p-0.5">
      {OPTIONS.map(o => (
        <Link
          key={o.key}
          to={o.to}
          aria-current={o.key === active ? 'page' : undefined}
          className={cn(
            'px-3 py-1 rounded-md text-[12px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent',
            o.key === active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900',
          )}
        >
          {o.label}
        </Link>
      ))}
    </nav>
  )
}
