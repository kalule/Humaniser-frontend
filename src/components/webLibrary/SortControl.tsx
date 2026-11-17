import { useEffect, useId, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { SortDir } from '../../lib/collectionsView'

export interface SortOption<K extends string> { value: K; label: string; defaultDir: SortDir }

/**
 * One sort control for the Research Library: a pill that opens the field list, and a separate
 * direction toggle. Picking a field applies its natural direction (newest first, A–Z, most papers
 * first); the toggle flips it.
 */
export function SortControl<K extends string>({ options, value, dir, onChange, label = 'Sort' }: {
  options: SortOption<K>[]
  value: K
  dir: SortDir
  onChange: (value: K, dir: SortDir) => void
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const id = useId()
  const current = options.find(o => o.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    const at = Math.max(0, options.findIndex(o => o.value === value))
    itemRefs.current[at]?.focus()
    const onDown = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open, options, value])

  const onMenuKey = (e: React.KeyboardEvent) => {
    const items = itemRefs.current.filter(Boolean) as HTMLButtonElement[]
    const at = items.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      items[(at + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus()
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      items[e.key === 'Home' ? 0 : items.length - 1]?.focus()
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); buttonRef.current?.focus() }
      setOpen(false)
    }
  }

  const DirIcon = dir === 'asc' ? ArrowUp : ArrowDown
  const dirLabel = current.value === 'name' || current.value === 'title'
    ? (dir === 'asc' ? 'A to Z' : 'Z to A')
    : (dir === 'asc' ? 'ascending' : 'descending')

  return (
    <div ref={rootRef} className="relative flex items-center rounded-lg border border-slate-200 bg-white text-[13px]">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        className="flex items-center gap-1.5 whitespace-nowrap rounded-l-lg px-3 py-1.5 text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40"
      >
        <ArrowUpDown size={13} aria-hidden className="text-slate-500" />
        <span>{label}: <span className="font-medium text-slate-900">{current.label}</span></span>
        <ChevronDown size={12} aria-hidden className={cn('text-slate-500 transition-transform', open && 'rotate-180')} />
      </button>
      <button
        type="button"
        onClick={() => onChange(current.value, dir === 'asc' ? 'desc' : 'asc')}
        aria-label={`Sort direction: ${dirLabel}. Click to reverse.`}
        title={`Sorted ${dirLabel}`}
        className="flex items-center self-stretch rounded-r-lg border-l border-slate-200 px-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40"
      >
        <DirIcon size={14} aria-hidden />
      </button>
      {open && (
        <div id={id} role="menu" aria-label={`${label} by`} onKeyDown={onMenuKey}
          className="absolute left-0 top-full z-30 mt-1 w-48 rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
          {options.map((o, i) => (
            <button
              key={o.value}
              ref={el => { itemRefs.current[i] = el }}
              type="button"
              role="menuitemradio"
              aria-checked={o.value === value}
              onClick={() => { onChange(o.value, o.value === value ? dir : o.defaultDir); setOpen(false); buttonRef.current?.focus() }}
              className={cn('flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-slate-50 focus:bg-slate-50 focus:outline-none',
                o.value === value ? 'font-medium text-purple-accent' : 'text-slate-700')}
            >
              <span className="w-3" aria-hidden>{o.value === value && <Check size={12} />}</span>{o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
