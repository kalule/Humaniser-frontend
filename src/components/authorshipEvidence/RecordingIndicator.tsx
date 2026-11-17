import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { authorshipEvidenceApi } from '../../api/authorshipEvidence'

type State = 'hidden' | 'on' | 'paused' | 'off'

/**
 * Shown in the editor so recording is never hidden: it says whether this document's writing history is being
 * recorded and links to exactly what is kept. Renders nothing when the feature is switched off on the server.
 */
export function RecordingIndicator({ documentId, onRecordingChange }: {
  documentId: string | undefined
  /** Told whether this document is being recorded, so the editor counts nothing (not even paste lengths) otherwise. */
  onRecordingChange?: (recording: boolean) => void
}) {
  // The state belongs to the document it was fetched for, so another document shows nothing until its own answer arrives.
  const [seen, setSeen] = useState<{ documentId: string | undefined; state: State } | null>(null)
  const state: State = seen && seen.documentId === documentId ? seen.state : 'hidden'

  useEffect(() => { onRecordingChange?.(state === 'on') }, [state, onRecordingChange])

  useEffect(() => {
    let live = true
    const show = (next: State) => { if (live) setSeen({ documentId, state: next }) }
    authorshipEvidenceApi.settings()
      .then(async settings => {
        if (!live) return
        if (!settings.recordingAccepted) { show('off'); return }
        if (!documentId) { show('on'); return }
        const doc = await authorshipEvidenceApi.document(documentId).catch(() => null)
        show(doc?.status === 'Paused' ? 'paused' : 'on')
      })
      .catch(() => show('hidden'))
    return () => { live = false }
  }, [documentId])

  if (state === 'hidden') return null
  const to = documentId && state !== 'off' ? `/app/authorship-evidence/${documentId}` : '/app/authorship-evidence'
  const text = state === 'on' ? 'Writing history: recording' : state === 'paused' ? 'Writing history: off for this document' : 'Writing history: not recorded'
  const title = state === 'on'
    ? 'Saves, word counts and AI tool use in this document are being recorded for you. No keystrokes and no pasted text. Open to see exactly what is kept or to switch it off.'
    : state === 'paused'
      ? 'You switched recording off for this document. Open to switch it back on.'
      : 'Nothing about how you write is being recorded. Open to read what recording would keep.'
  return (
    <Link to={to} title={title}
      className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[12px] font-medium text-slate-800 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-purple-500/40">
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${state === 'on' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {text}
    </Link>
  )
}
