import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { Check, Loader2, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import type { ApiError } from '../../../types'
import type { FetchedLiterature, SectionStatus } from '../../../types/research'
import { useResearchStore } from '../../../store/researchStore'
import { useSectionAutosave, type SaveFailure, type SaveState } from '../../../hooks/useSectionAutosave'
import { sectionEditorExtensions, stripLeadingHeadingLines } from './sectionEditorExtensions'
import { describeCitation, swapCitationText, type CitationCardEntry, type CitationContext } from '../../../lib/citationCard'
import { CitationDecorations, citationAt, citationDecorationsKey, type LocatedCitation } from './citationDecorations'
import { CitationCard } from './CitationCard'
import { PendingCells } from './pendingCells'
import { CitationDataContext } from './citationDataContext'

export interface SectionEditorProps {
  projectId: string
  code:      string
  content:   string
  editable:  boolean
  label:     string
  /** An approved section lost its approval through a material edit. */
  onDemoted: (code: string) => void
  /** Lets the view save this section before approving, exporting or switching view. */
  registerFlush: (code: string, flush: (() => Promise<boolean>) | null) => void
  /** The section's claim-support check has not finished yet (cards say "being checked"). */
  citationsPending?: boolean
}

interface OpenCard { at: LocatedCitation; entries: CitationCardEntry[]; top: number; left: number; viaKeyboard: boolean }

const EMPTY_CITATION_CONTEXT: CitationContext = { style: 'harvard', literature: [], bibliography: [], flags: [], pending: false }
const CLOSE_DELAY_MS = 200

const SAVE_TEXT: Record<Exclude<SaveState, 'idle' | 'error'>, string> = {
  pending: 'Saving…',
  saving:  'Saving…',
  saved:   'Saved',
}

const statusOf = (projectId: string, code: string): SectionStatus | undefined =>
  useResearchStore.getState().sections[projectId]?.find(s => s.code === code)?.status

/**
 * One editor per section, mounted only while the section is near the viewport. Reads and writes
 * the same section record Guided uses, as the same markdown, and only writes after the student
 * types, so viewing a section never changes what is stored or exported.
 */
export function SectionEditor({ projectId, code, content, editable, label, onDemoted, registerFlush, citationsPending = false }: SectionEditorProps) {
  // ── Citations: resolved to pinned sources when shown; the stored text is never changed by this.
  const citationData = useContext(CitationDataContext)
  const citationCtx = useMemo<CitationContext>(() => citationData
    ? { ...citationData, flags: citationData.flags.filter(f => f.sectionCode === code && f.status === 'Open'), pending: citationsPending }
    : { ...EMPTY_CITATION_CONTEXT, pending: citationsPending }, [citationData, code, citationsPending])
  const citationRef = useRef<CitationContext>(citationCtx)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [card, setCard] = useState<OpenCard | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelClose = () => { if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null } }
  const scheduleClose = () => { cancelClose(); closeTimer.current = setTimeout(() => setCard(null), CLOSE_DELAY_MS) }

  const initial = useRef(stripLeadingHeadingLines(content))
  // The markdown this editor last produced or loaded; store updates equal to it are our own echo.
  const lastKnown = useRef(content)
  const programmatic = useRef(false)
  const editorRef = useRef<ReturnType<typeof useEditor>>(null)

  // Show the stored text again, dropping local edits the server refused.
  const resyncFromStore = useCallback(() => {
    const stored = useResearchStore.getState().sections[projectId]?.find(s => s.code === code)?.content
    const editor = editorRef.current
    if (stored === undefined || !editor) return
    lastKnown.current = stored
    programmatic.current = true
    editor.commands.setContent(stripLeadingHeadingLines(stored), { emitUpdate: false })
    programmatic.current = false
  }, [projectId, code])

  const save = useCallback(async (markdown: string) => {
    const store = useResearchStore.getState()
    const before = statusOf(projectId, code)
    await store.saveSection(projectId, code, markdown)
    // A save returns the text it was given; if the student typed on meanwhile, put the newer
    // local text back so word counts and the other view do not step backwards.
    if (lastKnown.current !== markdown) useResearchStore.getState().updateSectionContent(projectId, code, lastKnown.current)
    if (before === 'Approved' && statusOf(projectId, code) !== 'Approved') onDemoted(code)
  }, [projectId, code, onDemoted])

  const onError = useCallback((err: unknown): SaveFailure => {
    const apiErr = err as ApiError | undefined
    if (apiErr?.code === 'SECTION_GENERATING') {
      toast.error(`${code} is being written, so your edit was not saved. You can edit it when the draft is finished.`)
      resyncFromStore()
      useResearchStore.getState().loadSections(projectId).then(resyncFromStore, () => {})
      return 'discard'
    }
    if (apiErr?.code === 'SECTION_EDIT_CONFLICT') {
      toast.error(`${code} changed elsewhere while you were editing, so your last change was not saved. Reloading the current text.`)
      useResearchStore.getState().loadSections(projectId).then(resyncFromStore, () => {})
      return 'discard'
    }
    return 'retry'
  }, [projectId, code, resyncFromStore])

  const autosave = useSectionAutosave({ save, onError })
  const { schedule, flush, hasUnsaved } = autosave

  const extensions = useMemo(() => [...sectionEditorExtensions(), CitationDecorations(citationRef), PendingCells], [])

  // Opens the card for the citation at `pos`, anchored under `rect` (viewport coordinates).
  const openCardAt = useCallback((pos: number, rect: { bottom: number; left: number }, viaKeyboard: boolean) => {
    const editor = editorRef.current
    const wrapper = wrapperRef.current
    if (!editor || !wrapper) return false
    const at = citationAt(editor.state.doc, pos, citationRef.current)
    if (!at) return false
    const box = wrapper.getBoundingClientRect()
    const entries = describeCitation({ from: 0, to: at.text.length, inner: at.inner }, at.surrounding, citationRef.current)
    cancelClose()
    setCard({ at, entries, top: rect.bottom - box.top + 6, left: Math.max(0, Math.min(rect.left - box.left, box.width - 360)), viaKeyboard })
    return true
  }, [])

  const editor = useEditor({
    extensions,
    content: initial.current,
    editable,
    editorProps: {
      attributes: { 'aria-label': `${label} text`, role: 'textbox', 'aria-multiline': 'true' },
      handleDOMEvents: {
        mouseover: (view, event) => {
          const el = (event.target as HTMLElement | null)?.closest?.('.dm-cite')
          if (!el) return false
          openCardAt(view.posAtDOM(el, 0) + 1, el.getBoundingClientRect(), false)
          return false
        },
        mouseout: (_view, event) => {
          if ((event.target as HTMLElement | null)?.closest?.('.dm-cite')) scheduleClose()
          return false
        },
      },
      handleKeyDown: (_view, event) => {
        if (event.key === 'Escape') { setCard(null); return false }
        return false
      },
    },
    onSelectionUpdate: ({ editor: e }) => {
      // Keyboard route: moving the caret into a citation opens its card; out of it closes it.
      const { from, empty } = e.state.selection
      if (!empty) return
      let coords: { bottom: number; left: number }
      try { coords = e.view.coordsAtPos(from) } catch { coords = { bottom: 0, left: 0 } } // never let the card break typing
      if (!openCardAt(from, coords, true)) setCard(c => (c?.viaKeyboard ? null : c))
    },
    onUpdate: ({ editor: e }) => {
      if (programmatic.current) return
      const markdown = (e.storage as unknown as { markdown: { getMarkdown(): string } }).markdown.getMarkdown()
      lastKnown.current = markdown
      schedule(markdown)
    },
  })

  editorRef.current = editor

  // New sources, flags or a finished claim check: redraw the citation marks.
  useEffect(() => {
    citationRef.current = citationCtx
    if (editor && !editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta(citationDecorationsKey, 'refresh'))
  }, [citationCtx, editor])

  useEffect(() => () => cancelClose(), [])

  // Swapping edits the text like typing does, so it autosaves, and as a citation change it sends
  // an approved section back for review (server rule).
  const handleSwap = useCallback((entryIndex: number, source: FetchedLiterature) => {
    const current = card
    const ed = editorRef.current
    if (!current || !ed) return
    const next = swapCitationText(current.at.text, entryIndex, source, citationRef.current.style)
    if (!next) return
    ed.chain().focus().insertContentAt({ from: current.at.from, to: current.at.to }, next).run()
    setCard(null)
    toast.success(`Citation changed to ${source.authors.split(',')[0]} (${source.year}).`)
  }, [card])

  const swapSources = useMemo(
    () => (citationData?.literature ?? []).filter(l => l.includedByStudent),
    [citationData],
  )

  // Text that changed elsewhere (Guided, a rewrite, a reload) flows in, unless the student has
  // edits here the server has not confirmed yet; those win until they are saved.
  useEffect(() => {
    if (!editor || content === lastKnown.current || hasUnsaved()) return
    lastKnown.current = content
    programmatic.current = true
    editor.commands.setContent(stripLeadingHeadingLines(content), { emitUpdate: false })
    programmatic.current = false
  }, [editor, content, hasUnsaved])

  useEffect(() => {
    if (!editor) return
    programmatic.current = true
    editor.setEditable(editable)
    programmatic.current = false
  }, [editor, editable])

  // Resolves true when everything typed here is saved.
  const flushAndReport = useCallback(async () => { await flush(); return !hasUnsaved() }, [flush, hasUnsaved])
  useEffect(() => {
    registerFlush(code, flushAndReport)
    return () => registerFlush(code, null)
  }, [code, registerFlush, flushAndReport])

  return (
    <div ref={wrapperRef} className="relative">
      <EditorContent editor={editor} className="dm-prose dm-editor" />
      {card && (
        <CitationCard entries={card.entries} swapTo={swapSources}
          canSwap={editable && citationRef.current.style !== 'ieee'} onSwap={handleSwap}
          onClose={() => { setCard(null); editorRef.current?.commands.focus() }}
          onPointerEnter={cancelClose} onPointerLeave={() => { if (!card.viaKeyboard) scheduleClose() }}
          style={{ top: card.top, left: card.left }} />
      )}
      <div className="h-5 flex justify-end items-center text-[11px]" aria-live="polite" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        {autosave.state === 'error' ? (
          <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--color-red-text)' }}>
            <AlertCircle size={11} aria-hidden="true" /> Not saved
            <button type="button" onClick={autosave.retry} className="dm-action font-semibold underline">Retry</button>
          </span>
        ) : autosave.state !== 'idle' && (
          <span className="inline-flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
            {autosave.state === 'saved'
              ? <Check size={11} aria-hidden="true" style={{ color: 'var(--color-green)' }} />
              : <Loader2 size={11} className="animate-spin" aria-hidden="true" />}
            {SAVE_TEXT[autosave.state]}
          </span>
        )}
      </div>
    </div>
  )
}
