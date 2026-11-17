import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { researchApi } from '../../api/research'
import { MAX_SAVED_SOURCES_PER_REQUEST } from '../../lib/savedSources'
import type { SavedSourceProjectImportResult } from '../../types/research'
import { SavedSourcePicker } from './SavedSourcePicker'

/** One sentence for what an import did; exported for testing. */
export function savedSourceImportSummary(r: SavedSourceProjectImportResult): string {
  const parts: string[] = []
  if (r.added) parts.push(`${r.added} added`)
  if (r.included) parts.push(`${r.included} already in the project, now included`)
  if (r.alreadyIncluded) parts.push(`${r.alreadyIncluded} already included`)
  if (r.withoutAbstract.length) parts.push(`${r.withoutAbstract.length} left out (no abstract)`)
  if (r.notFound) parts.push(`${r.notFound} no longer in your library`)
  return parts.length ? `Saved sources: ${parts.join(', ')}.` : 'Nothing was added.'
}

/**
 * Adds papers from Saved Sources to a research project as included literature, so section generation and
 * the bibliography use them. The papers stay in Saved Sources; the project gets its own row for each.
 */
export function AddSavedSourcesToProject({ projectId, onImported }: { projectId: string; onImported?: (result: SavedSourceProjectImportResult) => void }) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const add = async () => {
    if (!selected.length || busy) return
    setBusy(true)
    try {
      const result = await researchApi.importSavedSources(projectId, selected)
      const changed = result.added + result.included
      ;(changed > 0 ? toast.success : toast)(savedSourceImportSummary(result), { duration: 7000 })
      setSelected([])
      onImported?.(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : (err as { message?: string } | undefined)?.message
      toast.error(message ?? 'Could not add your saved sources. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-slate-800">Add from Saved Sources</p>
          <p className="mt-0.5 text-[12px] text-slate-500">Papers you add are included in this project and can be cited when sections are written. They stay in Saved Sources.</p>
        </div>
        <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} className="shrink-0 text-[12px] font-medium text-purple-accent hover:underline">
          {open ? 'Hide' : 'Choose papers'}
        </button>
      </div>
      {open && (
        <div className="mt-3 space-y-3">
          <SavedSourcePicker selectedIds={selected} onChange={setSelected} requireText max={MAX_SAVED_SOURCES_PER_REQUEST} disabled={busy} listClassName="max-h-72" />
          <div className="flex justify-end">
            <button
              type="button" onClick={add} disabled={!selected.length || busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-purple-accent px-3 py-1.5 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy ? <><Loader2 size={12} className="animate-spin" /> Adding…</> : `Add ${selected.length || ''} to project`.replace('  ', ' ')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
