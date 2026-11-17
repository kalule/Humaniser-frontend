import { useEffect, useRef, useState } from 'react'
import { Download } from 'lucide-react'
import { literatureMatrixApi } from '../../api/literatureMatrix'
import { failureMessage, type Matrix } from '../../lib/literatureMatrix'
import { downloadBlob } from '../../lib/utils'
import { buttonClass } from './parts'

const FORMATS = [
  { format: 'xlsx', label: 'Excel (.xlsx)' },
  { format: 'csv', label: 'CSV (.csv)' },
  { format: 'docx', label: 'Word report (.docx)' },
] as const

/** Downloads the visible columns, with each value's evidence status, its passage and the DOI. */
export function ExportMenu({ matrix, studyIds, disabled, onError }: { matrix: Matrix; studyIds: string[]; disabled?: boolean; onError: (m: string) => void }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [open])

  const download = async (format: string) => {
    setBusy(format)
    setOpen(false)
    try {
      const blob = await literatureMatrixApi.export(matrix.id, format, studyIds)
      downloadBlob(blob, `${matrix.name.replace(/[\\/:*?"<>|]/g, '-').slice(0, 80)} - literature matrix.${format}`)
    } catch (e) {
      onError(failureMessage(e, 'export'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div ref={root} className="relative">
      <button type="button" className={buttonClass.secondary} disabled={disabled || busy !== null} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <Download size={15} />{busy ? 'Exporting…' : studyIds.length > 0 ? `Export ${studyIds.length} selected` : 'Export'}
      </button>
      {open ? (
        <ul role="menu" className="absolute right-0 z-40 mt-1 w-52 rounded-lg border border-slate-200 bg-white py-1 shadow-elevated">
          {FORMATS.map(f => (
            <li key={f.format} role="none">
              <button type="button" role="menuitem" className="block w-full px-3 py-1.5 text-left text-[13px] text-slate-800 hover:bg-slate-50" onClick={() => download(f.format)}>{f.label}</button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
