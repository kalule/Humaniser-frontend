import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { Check, Loader2, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import type { ApiError } from '../../../types'
import type { FetchedLiterature, SectionStatus } from '../../../types/research'
import { useResearchStore } from '../../../store/researchStore'
import { paraphraseApi } from '../../../api/paraphrase'
import { useSectionAutosave, type SaveFailure, type SaveState } from '../../../hooks/useSectionAutosave'
import { sectionEditorExtensions, stripLeadingHeadingLines } from './sectionEditorExtensions'
import {
  describeCitation, findCitations, inTextCitationFor, removeCitationText, swapCitationText,
  type CitationCardEntry, type CitationContext,
} from '../../../lib/citationCard'
import { CitationDecorations, citationAt, citationDecorationsKey, dirtyRanges, type CitationMeta, type LocatedCitation } from './citationDecorations'
import { CitationCard } from './CitationCard'
import { PendingCells } from './pendingCells'
import { CitationDataContext } from './citationDataContext'
import { SelectionMenu, SuggestionCard, type AiEditKind, type Suggestion } from './SelectionMenu'
import { splitTrailingReferences } from '../../../lib/wordCount'

export interface SectionEditorProps {
  projectId: string
  code:      string
  content:   string
  editable:  boolean
  label:     string
  /** An approved section lost its approval through a material edit. */
  onDemoted: (code: string) => void
  /** The student changed the text of a section that was approved (any edit, small ones included). */
  onEditedApproved?: (code: string) => void
  /** The student's edit to this section was saved (any status): sections that restate it may now be out of date. */
  onEdited?: (code: string) => void
  /** Lets the view save this section before approving, exporting or switching view. */
  registerFlush: (code: string, flush: (() => Promise<boolean>) | null) => void
  /** Lets the view select words in this section (a Review issue opened from the list). */
  registerReveal?: (code: string, reveal: ((text: string | null) => boolean) | null) => void
  /** Run the section's claim-source check (selection menu "Check claim"). */
  onCheckClaim?: (code: string) => void
  /** The section's claim-support check has not finished yet (cards say "being checked"). */
  citationsPending?: boolean
}

interface OpenCard { at: LocatedCitation; entries: CitationCardEntry[]; top: number; left: number; viaKeyboard: boolean }
interface MenuAt { from: number; to: number; top: number; left: number }
interface OpenSuggestion extends Suggestion { from: number; to: number; top: number; left: number }

const EMPTY_CITATION_CONTEXT: CitationContext = { style: 'harvard', literature: [], bibliography: [], flags: [], pending: false }
const CLOSE_DELAY_MS = 200

const SAVE_TEXT: Record<Exclude<SaveState, 'idle' | 'error'>, string> = {
  pending: 'Savingâ€¦',
  saving:  'Savingâ€¦',
  saved:   'Saved',
}

// Paraphrase enum values (ParaphraseMode.Academic = 3; ParaphraseLength None/Expand/Shorten = 0/1/2).
const AI_REQUEST: Record<AiEditKind, { mode: number; length: number }> = {
  rewrite: { mode: 3, length: 0 },
  shorten: { mode: 3, length: 2 },
  expand:  { mode: 3, length: 1 },
}

// The document shows one reference list at its end, so each section's own trailing References
// block is kept out of the editor. It stays in the stored text and is put back on every save.
const editorBody = (text: string) => splitTrailingReferences(stripLeadingHeadingLines(text)).body
const referencesTail = (text: string) => splitTrailingReferences(text.replace(/\r\n/g, '\n')).tail

// Blank lines and trailing spaces only. Live 2026-11-28 (3.3): an empty paragraph the editor added below a table
// (a click under it) saved three blank lines and marked the run-approved section "Edited after approval".
// Splitting a paragraph still changes this form (a space becomes a blank line), so it is still saved.
const layoutFree = (text: string) =>
  text.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim()

const statusOf = (projectId: string, code: string): SectionStatus | undefined =>
  useResearchStore.getState().sections[projectId]?.find(s => s.code === code)?.status

/**
 * One editor per section, mounted only while the section is near the viewport. Reads and writes
 * the same section record Guided uses, as the same markdown, and only writes after the student
 * types, so viewing a section never changes what is stored or exported. It is always in place:
 * click (or Tab) into the text to edit, Escape to leave; no toolbar until text is selected.
 */
export function SectionEditor({
  projectId, code, content, editable, label, onDemoted, onEditedApproved, onEdited, registerFlush, registerReveal, onCheckClaim,
  citationsPending = false,
}: SectionEditorProps) {
  // â”€â”€ Citations: resolved to pinned sources when shown; the stored text is never changed by this.
  const citationData = useContext(CitationDataContext)
  const citationCtx = useMemo<CitationContext>(() => citationData
    ? {
        ...citationData,
        flags: citationData.flags.filter(f => f.sectionCode === code && f.status === 'Open'),
        checks: citationData.checks?.[code],
        pending: citationsPending,
      }
    : { ...EMPTY_CITATION_CONTEXT, pending: citationsPending }, [citationData, code, citationsPending])
  const citationRef = useRef<CitationContext>(citationCtx)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [card, setCard] = useState<OpenCard | null>(null)
  const [menu, setMenu] = useState<MenuAt | null>(null)
  const [suggestion, setSuggestion] = useState<OpenSuggestion | null>(null)
  // Read by the editor's key handler, which is created once and would otherwise see stale state.
  const overlayOpen = useRef(false)
  overlayOpen.current = !!card || !!menu
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelClose = () => { if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null } }
  const scheduleClose = () => { cancelClose(); closeTimer.current = setTimeout(() => setCard(null), CLOSE_DELAY_MS) }

  const initial = useRef(editorBody(content))
  // The markdown this editor last produced or loaded; store updates equal to it are our own echo.
  const lastKnown = useRef(content)
  const programmatic = useRef(false)
  const editorRef = useRef<ReturnType<typeof useEditor>>(null)
  // The loaded text as this editor writes it ("| --- |" table rules etc.), blank lines ignored; null until known.
  const loadedForm = useRef<string | null>(null)
  const editedSinceLoad = useRef(false)
  const serialize = (e: { storage: unknown }) =>
    (e.storage as { markdown: { getMarkdown(): string } }).markdown.getMarkdown()

  // Text loaded from the store replaces the document: no citation has been edited since its check.
  const loadText = useCallback((text: string) => {
    const editor = editorRef.current
    if (!editor) return
    lastKnown.current = text
    programmatic.current = true
    editor.commands.setContent(editorBody(text), { emitUpdate: false })
    editor.view.dispatch(editor.state.tr.setMeta(citationDecorationsKey, 'reset-dirty' satisfies CitationMeta))
    programmatic.current = false
    loadedForm.current = layoutFree(serialize(editor))
    editedSinceLoad.current = false
  }, [])

  // Show the stored text again, dropping local edits the server refused.
  const resyncFromStore = useCallback(() => {
    const stored = useResearchStore.getState().sections[projectId]?.find(s => s.code === code)?.content
    if (stored !== undefined) loadText(stored)
  }, [projectId, code, loadText])

  const save = useCallback(async (markdown: string) => {
    const store = useResearchStore.getState()
    const before = statusOf(projectId, code)
    await store.saveSection(projectId, code, markdown)
    // A save returns the text it was given; if the student typed on meanwhile, put the newer
    // local text back so word counts and the other view do not step backwards.
    if (lastKnown.current !== markdown) useResearchStore.getState().updateSectionContent(projectId, code, lastKnown.current)
    if (before === 'Approved') {
      onEditedApproved?.(code)
      if (statusOf(projectId, code) !== 'Approved') onDemoted(code)
    }
    onEdited?.(code)
  }, [projectId, code, onDemoted, onEditedApproved, onEdited])

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
    const at = citationAt(editor.state.doc, pos, citationRef.current, dirtyRanges(editor.state))
    if (!at) return false
    const box = wrapper.getBoundingClientRect()
    const entries = describeCitation({ from: 0, to: at.text.length, inner: at.inner, text: at.text }, at.surrounding, citationRef.current, at.dirty)
    cancelClose()
    setCard({ at, entries, top: rect.bottom - box.top + 6, left: Math.max(0, Math.min(rect.left - box.left, box.width - 360)), viaKeyboard })
    return true
  }, [])

  // The selection menu: only for a non-empty selection inside one paragraph of an editable section.
  const placeMenu = useCallback(() => {
    const editor = editorRef.current
    const wrapper = wrapperRef.current
    // Focus is not required here: onBlur closes the menu when the student leaves the text.
    if (!editor || !wrapper || !editor.isEditable) { setMenu(null); return }
    const { from, to, empty, $from, $to } = editor.state.selection
    if (empty || $from.parent !== $to.parent || !$from.parent.isTextblock || !editor.state.doc.textBetween(from, to).trim()) { setMenu(null); return }
    let coords: { top: number; left: number }
    try { coords = editor.view.coordsAtPos(from) } catch { coords = { top: 0, left: 0 } }
    const box = wrapper.getBoundingClientRect()
    setMenu({ from, to, top: Math.max(-44, coords.top - box.top - 44), left: Math.max(0, Math.min(coords.left - box.left, box.width - 420)) })
  }, [])

  const editor = useEditor({
    extensions,
    content: initial.current,
    editable,
    editorProps: {
      attributes: { 'aria-label': `${label} text. Select text for editing options; Escape leaves the text.`, role: 'textbox', 'aria-multiline': 'true' },
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
      handleKeyDown: (view, event) => {
        if (event.key !== 'Escape') return false
        // First Escape closes what is open; the next leaves the text (focus goes to the section, not lost).
        if (overlayOpen.current) { setCard(null); setMenu(null); return true }
        view.dom.blur()
        wrapperRef.current?.focus({ preventScroll: true })
        return true
      },
    },
    onSelectionUpdate: ({ editor: e }) => {
      // Keyboard route: moving the caret into a citation opens its card; out of it closes it.
      const { from, empty } = e.state.selection
      placeMenu()
      if (!empty) return
      let coords: { bottom: number; left: number }
      try { coords = e.view.coordsAtPos(from) } catch { coords = { bottom: 0, left: 0 } } // never let the card break typing
      if (!openCardAt(from, coords, true)) setCard(c => (c?.viaKeyboard ? null : c))
    },
    onBlur: ({ event }) => {
      // Leaving the text closes the menu, unless focus moved into the menu itself.
      if (!wrapperRef.current?.contains(event.relatedTarget as Node | null)) setMenu(null)
    },
    onUpdate: ({ editor: e }) => {
      if (programmatic.current) return
      const body = serialize(e)
      const markdown = body + referencesTail(lastKnown.current)
      // Nothing but blank lines changed: not an edit, so nothing is saved and an approval is kept.
      if (layoutFree(markdown) === layoutFree(lastKnown.current)) return
      // Not edited since load and only re-formatted by the editor (e.g. "|---|" written as "| --- |"): not an edit either.
      if (!editedSinceLoad.current && loadedForm.current !== null && layoutFree(body) === loadedForm.current) return
      editedSinceLoad.current = true
      lastKnown.current = markdown
      schedule(markdown)
    },
  })

  editorRef.current = editor

  // The first loaded text's own form, once the editor exists (later loads set it in loadText).
  useEffect(() => {
    if (editor && !editor.isDestroyed && loadedForm.current === null && !editedSinceLoad.current)
      loadedForm.current = layoutFree(serialize(editor))
  }, [editor])

  // New sources, flags or a finished claim check: redraw the citation marks. A new check result
  // also means every citation was just checked against the current text.
  const lastChecks = useRef(citationCtx.checks)
  useEffect(() => {
    citationRef.current = citationCtx
    if (!editor || editor.isDestroyed) return
    const freshCheck = citationCtx.checks !== lastChecks.current && !!citationCtx.checks
    lastChecks.current = citationCtx.checks
    editor.view.dispatch(editor.state.tr.setMeta(citationDecorationsKey, (freshCheck ? 'reset-dirty' : 'refresh') satisfies CitationMeta))
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

  const handleRemove = useCallback((entryIndex: number) => {
    const current = card
    const ed = editorRef.current
    if (!current || !ed) return
    const next = removeCitationText(current.at.text, entryIndex, citationRef.current.style)
    if (next === null) return
    if (next === '') {
      // The whole citation goes, with the space before it ("claim (A, 2020)." -> "claim.").
      const before = ed.state.doc.textBetween(Math.max(0, current.at.from - 1), current.at.from)
      ed.chain().focus().deleteRange({ from: before === ' ' ? current.at.from - 1 : current.at.from, to: current.at.to }).run()
    } else {
      ed.chain().focus().insertContentAt({ from: current.at.from, to: current.at.to }, next).run()
    }
    setCard(null)
    toast.success('Citation removed. The sentence now needs another source or rewording.')
  }, [card])

  const swapSources = useMemo(
    () => (citationData?.literature ?? []).filter(l => l.includedByStudent),
    [citationData],
  )

  // â”€â”€ Selection menu actions â”€â”€
  const handleAiEdit = useCallback(async (kind: AiEditKind) => {
    const ed = editorRef.current
    const at = menu
    if (!ed || !at) return
    const original = ed.state.doc.textBetween(at.from, at.to)
    const base = { kind, original, from: at.from, to: at.to, top: at.top + 44, left: at.left, lostCitations: [] as string[] }
    setMenu(null)
    setSuggestion({ ...base, proposed: null, error: null })
    try {
      const res = await paraphraseApi.paraphrase({ text: original, strength: 'medium', includeManifest: false, ...AI_REQUEST[kind] })
      const proposed = res.paraphrasedText.trim()
      const kept = new Set(findCitations(proposed, citationRef.current).map(h => proposed.slice(h.from, h.to)))
      const lost = findCitations(original, citationRef.current).map(h => original.slice(h.from, h.to)).filter(t => !kept.has(t))
      setSuggestion(s => (s && s.from === base.from && s.to === base.to ? { ...s, proposed, lostCitations: lost } : s))
    } catch (err) {
      const message = (err as ApiError | undefined)?.message ?? 'No suggestion could be made. Try again.'
      setSuggestion(s => (s && s.from === base.from ? { ...s, error: message } : s))
    }
  }, [menu])

  const acceptSuggestion = useCallback(() => {
    const ed = editorRef.current
    const s = suggestion
    if (!ed || !s?.proposed) return
    // Only replace the words the suggestion was made for; if they changed meanwhile, do nothing silently.
    if (s.to > ed.state.doc.content.size || ed.state.doc.textBetween(s.from, s.to) !== s.original) {
      toast.error('That text changed while the suggestion was being written, so it was not applied.')
      setSuggestion(null)
      return
    }
    ed.chain().focus().insertContentAt({ from: s.from, to: s.to }, { type: 'text', text: s.proposed }).run()
    setSuggestion(null)
  }, [suggestion])

  const handleCite = useCallback((source: FetchedLiterature) => {
    const ed = editorRef.current
    const at = menu
    if (!ed || !at) return
    const citation = inTextCitationFor(source, citationRef.current.style)
    if (!citation) return
    // After the selected claim, before its closing punctuation: "claim (Klishi, 2024)."
    const selected = ed.state.doc.textBetween(at.from, at.to)
    const trailing = selected.match(/[.,;:!?]+\s*$/)?.[0].length ?? 0
    const insertAt = at.to - trailing
    const spaceBefore = ed.state.doc.textBetween(Math.max(0, insertAt - 1), insertAt) === ' ' ? '' : ' '
    ed.chain().focus().insertContentAt(insertAt, { type: 'text', text: `${spaceBefore}${citation}` }).run()
    setMenu(null)
  }, [menu])

  // Text that changed elsewhere (Guided, a rewrite, a reload) flows in, unless the student has
  // edits here the server has not confirmed yet; those win until they are saved.
  useEffect(() => {
    if (!editor || content === lastKnown.current || hasUnsaved()) return
    loadText(content)
  }, [editor, content, hasUnsaved, loadText])

  useEffect(() => {
    if (!editor) return
    programmatic.current = true
    editor.setEditable(editable)
    programmatic.current = false
    if (!editable) { setMenu(null); setSuggestion(null) }
  }, [editor, editable])

  // Resolves true when everything typed here is saved.
  const flushAndReport = useCallback(async () => { await flush(); return !hasUnsaved() }, [flush, hasUnsaved])
  useEffect(() => {
    registerFlush(code, flushAndReport)
    return () => registerFlush(code, null)
  }, [code, registerFlush, flushAndReport])

  // Select the first occurrence of `text` (a Review issue's evidence); with no text, put the caret at the start.
  const reveal = useCallback((text: string | null): boolean => {
    const ed = editorRef.current
    if (!ed || ed.isDestroyed) return false
    if (!text) { ed.commands.focus('start'); return true }
    let found: { from: number; to: number } | null = null
    const needle = text.trim()
    ed.state.doc.descendants((node, pos) => {
      if (found || !node.isTextblock) return !found
      const at = node.textContent.indexOf(needle)
      if (at >= 0) found = { from: pos + 1 + at, to: pos + 1 + at + needle.length }
      return false
    })
    if (!found) { ed.commands.focus('start'); return false }
    ed.chain().focus().setTextSelection(found).scrollIntoView().run()
    return true
  }, [])
  useEffect(() => {
    if (!registerReveal) return
    registerReveal(code, reveal)
    return () => registerReveal(code, null)
  }, [code, registerReveal, reveal])

  const removable = card && citationRef.current.style !== 'ieee' && card.at.text.startsWith('(')

  return (
    <div ref={wrapperRef} className="relative outline-none" tabIndex={-1}>
      <EditorContent editor={editor} className="dm-prose dm-editor" />
      {card && (
        <CitationCard entries={card.entries} swapTo={swapSources}
          canSwap={editable && citationRef.current.style !== 'ieee'} onSwap={handleSwap}
          onRemove={editable && removable ? handleRemove : undefined}
          onClose={() => { setCard(null); editorRef.current?.commands.focus() }}
          onPointerEnter={cancelClose} onPointerLeave={() => { if (!card.viaKeyboard) scheduleClose() }}
          style={{ top: card.top, left: card.left }} />
      )}
      {menu && !suggestion && editable && (
        <SelectionMenu style={{ top: menu.top, left: menu.left }} busy={false}
          canCite={citationRef.current.style !== 'ieee'} sources={swapSources}
          onAiEdit={kind => { void handleAiEdit(kind) }} onCite={handleCite}
          onCheckClaim={() => { setMenu(null); onCheckClaim?.(code) }} />
      )}
      {suggestion && (
        <SuggestionCard suggestion={suggestion} style={{ top: suggestion.top, left: suggestion.left }}
          onAccept={acceptSuggestion} onReject={() => { setSuggestion(null); editorRef.current?.commands.focus() }} />
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
