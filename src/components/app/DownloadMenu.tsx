import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Download, Loader2 } from 'lucide-react'
import { EXPORT_FORMATS, type ExportFormat } from '../../lib/documentExport'

interface DownloadMenuProps {
  /** Format currently being generated, if any — shows a spinner and blocks a second download. */
  busyFormat: ExportFormat | null
  disabled?: boolean
  disabledReason?: string
  onDownload: (format: ExportFormat) => void
  /** Button text; defaults to "Download". */
  label?: string
}

// Editor-toolbar Download control: one button, two choices (Word / PDF). Disabled for an empty
// document; while a file is being generated the button shows a spinner.
export function DownloadMenu({ busyFormat, disabled, disabledReason, onDownload, label = 'Download' }: DownloadMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const busy = busyFormat !== null

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        disabled={disabled || busy}
        aria-haspopup="menu"
        aria-expanded={open}
        title={disabled ? disabledReason : undefined}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-[12px] font-medium hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Download size={13} aria-hidden="true" />}
        {busy ? 'Preparing…' : label}
        {!busy && <ChevronDown size={12} aria-hidden="true" />}
      </button>
      {open && !busy && (
        <div role="menu" aria-label="Download as" className="absolute right-0 top-full mt-1 w-44 bg-white border border-[#e0e0da] rounded-xl shadow-lg z-30 overflow-hidden py-1">
          {EXPORT_FORMATS.map(({ format, label }) => (
            <button
              key={format}
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); onDownload(format) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-left text-[#333] hover:bg-[#f5f5f3] focus-visible:bg-[#f5f5f3] outline-none"
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
