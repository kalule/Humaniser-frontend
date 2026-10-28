import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Info } from 'lucide-react'
import { researchApi } from '../../api/research'
import type { QualityFlag } from '../../types/research'

// Plain-language names for the issue codes. Anything unlisted falls back to a spaced-out code.
const NOTE_TITLES: Record<string, string> = {
  ClaimStrengthExceedsSourceDesign: 'Wording stronger than the source supports',
  OverstatedGapClaim: 'Gap stated too strongly',
  GapLanguageInBackground: 'Gap stated in the Background',
  LiteratureReviewShape: 'Reads like a list of studies',
  PreSubmissionChecks: 'Check before you submit',
  ImplausibleReferenceMetadata: 'Reference details look wrong',
}

export const noteTitle = (code: string) =>
  NOTE_TITLES[code] ?? code.replace(/([a-z])([A-Z])/g, '$1 $2')

interface ReviewNotesListProps {
  notes:     QualityFlag[]
  busyId?:   string | null
  onDismiss: (id: string) => void
  onRestore: (id: string) => void
  /** Dismissed notes start collapsed; exposed so the collapsed state can be rendered in tests. */
  showDismissed?: boolean
  onToggleDismissed?: () => void
}

/**
 * Review notes are advice, not errors: a neutral "Review note" label, no red, and nothing here edits
 * the section or gates approval/export.
 */
export function ReviewNotesList({
  notes, busyId = null, onDismiss, onRestore, showDismissed = false, onToggleDismissed,
}: ReviewNotesListProps) {
  const active = notes.filter(n => !n.dismissed)
  const dismissed = notes.filter(n => n.dismissed)
  if (notes.length === 0) return null

  return (
    <section aria-label="Review notes" className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
      {active.length > 0 && (
        <ul className="space-y-2">
          {active.map(n => (
            <li key={n.id} className="flex items-start gap-2">
              <Info size={14} className="mt-0.5 shrink-0 text-slate-500" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-800">
                  <span className="mr-2 rounded bg-slate-200 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                    Review note
                  </span>
                  {noteTitle(n.code)}
                </p>
                <p className="mt-0.5 text-slate-600">{n.message}</p>
              </div>
              <button
                type="button"
                disabled={busyId === n.id}
                onClick={() => onDismiss(n.id)}
                className="shrink-0 rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:bg-white disabled:opacity-50"
              >
                Dismiss
              </button>
            </li>
          ))}
        </ul>
      )}

      {dismissed.length > 0 && (
        <div className={active.length > 0 ? 'mt-2 border-t border-slate-200 pt-2' : ''}>
          <button
            type="button"
            onClick={onToggleDismissed}
            aria-expanded={showDismissed}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
          >
            {showDismissed ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Dismissed ({dismissed.length})
          </button>
          {showDismissed && (
            <ul className="mt-1 space-y-1">
              {dismissed.map(n => (
                <li key={n.id} className="flex items-start gap-2 text-slate-500">
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{noteTitle(n.code)}</span>
                    <span className="ml-2">{n.message}</span>
                  </div>
                  <button
                    type="button"
                    disabled={busyId === n.id}
                    onClick={() => onRestore(n.id)}
                    className="shrink-0 rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:bg-white disabled:opacity-50"
                  >
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

interface ReviewNotesPanelProps {
  projectId:   string
  sectionCode: string
  /** Changes whenever the section is regenerated, so the notes are re-read for the new draft. */
  refreshKey?: string | number | boolean | null
}

/** Loads and manages one section's review notes. Renders nothing when there are none. */
export function ReviewNotesPanel({ projectId, sectionCode, refreshKey }: ReviewNotesPanelProps) {
  const [notes, setNotes] = useState<QualityFlag[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showDismissed, setShowDismissed] = useState(false)

  const load = useCallback(() => {
    let cancelled = false
    researchApi.getQualityFlags(projectId, sectionCode)
      .then(r => { if (!cancelled) setNotes(r) })
      // Advice must never get in the way: a failed read just shows no notes.
      .catch(() => { if (!cancelled) setNotes([]) })
    return () => { cancelled = true }
  }, [projectId, sectionCode])

  useEffect(() => load(), [load, refreshKey])

  const change = async (id: string, dismissed: boolean) => {
    setBusyId(id)
    try {
      await researchApi.setQualityFlagDismissed(projectId, sectionCode, id, dismissed)
      setNotes(prev => prev.map(n => (n.id === id ? { ...n, dismissed } : n)))
    } catch {
      load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <ReviewNotesList
      notes={notes}
      busyId={busyId}
      onDismiss={id => change(id, true)}
      onRestore={id => change(id, false)}
      showDismissed={showDismissed}
      onToggleDismissed={() => setShowDismissed(v => !v)}
    />
  )
}
