import { forwardRef, useEffect, useImperativeHandle, useMemo, useReducer, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'
import TiptapImage from '@tiptap/extension-image'
import { TableKit } from '@tiptap/extension-table'
import { Markdown } from 'tiptap-markdown'
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  ChevronDown, Link as LinkIcon,
  List, ListOrdered, Quote,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Undo2, Redo2,
  Sparkles, RefreshCw, ThumbsUp, Loader2, Check,
  CheckCircle2, ShieldCheck, ImageIcon, Upload, Globe,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { countBodyWords } from '../../lib/wordCount'
import type { SectionStatus, CitationStyle, CitationFlag, FetchedLiterature } from '../../types/research'
import type { ParsedReference } from '../../lib/citationFormat'
import {
  scanTextForCitations, resolveHitAgainstLiterature, resolveIeeeHit, findFlagForHit,
  type CitationHit, type ResolvedCitation,
} from '../../lib/citationMatch'
import { extractSurnamesFromAuthors } from '../../lib/citationFormat'
import { CitationPopover } from './CitationPopover'
import { useUiStore, type DocEditorFontSize } from '../../store/uiStore'
import toast from 'react-hot-toast'

const DOC_EDITOR_FONT_SIZES: DocEditorFontSize[] = [14, 16, 18]

interface DocumentSurfaceProps {
  sectionCode:       string
  sectionTitle:      string
  sectionDescription:string
  content:           string
  status:            SectionStatus | 'NotStarted'
  wordCount:         number
  aiDetectionScore?: number
  isGenerating:      boolean
  // Text streamed so far from ResearchController.StreamSectionDraft while isGenerating is true —
  // empty until the first SSE chunk arrives (or if the stream never connects), in which case the
  // skeleton below is shown instead. Not fed into the TipTap editor itself: `content` syncs into
  // the real editor only once generation finishes (see the content-sync effect's `isGenerating`
  // guard below), so a partial/invalid-Markdown mid-stream string never reaches TipTap's parser.
  streamingContent?: string
  isStalled?:        boolean
  isSaving:          boolean
  hasContent:        boolean
  citationLabel:     string
  citationStyle:     CitationStyle
  literature:        FetchedLiterature[] | null   // null = not yet loaded
  bibliography:      ParsedReference[] | null      // null = not yet compiled (IEEE index source)
  citationFlags?:    CitationFlag[]                // open citation-integrity flags for this section
  // True while this section's claim-support citation check (OpenAlex + Claude comparison) is
  // still running in the background — see ResearchService.CitationsPendingVerification's own
  // doc comment. Deterministic checks (unresolved citations, bibliographic corrections) have
  // already run by the time this is ever true; only claim/journal/author mismatch flags can
  // still land after this clears.
  citationsPendingVerification?: boolean
  onContentChange:   (content: string) => void
  onSave:            () => void
  onGenerate:        (wordCount: number) => void
  onRegenerate:      () => void
  onApprove:         () => void
  onCitationInserted?: (text: string) => void
  onRequestBibliography?: () => void
  onDismissCitationFlag?: (flagId: string) => void
}

export interface DocumentSurfaceHandle {
  insertCitationAtCursor: (text: string) => void
}

function getChapterLabel(code: string): string {
  const n = parseInt(code.split('.')[0], 10)
  return isNaN(n) ? '' : `Chapter ${n}`
}

// ── Citation flash extension ─────────────────────────────────────────────────
// Purely visual decoration for the "just inserted this citation" flash. Deliberately
// NOT a real text selection: if the flash held an actual selection, a keystroke during
// the ~700ms window would replace the inserted citation instead of typing after it.
// Decorations never touch document content, so the plain-text sync via getText() is
// unaffected regardless of when flashRange()/clearFlash() fire.
const citationFlashKey = new PluginKey('citationFlash')

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    citationFlash: {
      flashRange: (range: { from: number; to: number }) => ReturnType
      clearFlash: () => ReturnType
    }
  }
  // tiptap-markdown's own .d.ts doesn't augment Storage — added here so
  // editor.storage.markdown.getMarkdown() below is typed.
  interface Storage {
    markdown: { getMarkdown(): string }
  }
}

const CitationFlash = Extension.create({
  name: 'citationFlash',
  addCommands() {
    return {
      flashRange: (range: { from: number; to: number }) => ({ dispatch, state }) => {
        if (dispatch) dispatch(state.tr.setMeta(citationFlashKey, { range }))
        return true
      },
      clearFlash: () => ({ dispatch, state }) => {
        if (dispatch) dispatch(state.tr.setMeta(citationFlashKey, { range: null }))
        return true
      },
    }
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: citationFlashKey,
        state: {
          init: () => ({ range: null as { from: number; to: number } | null }),
          apply(tr, value) {
            const meta = tr.getMeta(citationFlashKey)
            if (meta !== undefined) return meta
            if (!tr.docChanged || !value.range) return value
            return { range: { from: tr.mapping.map(value.range.from), to: tr.mapping.map(value.range.to) } }
          },
        },
        props: {
          decorations(state) {
            const { range } = citationFlashKey.getState(state) as { range: { from: number; to: number } | null }
            if (!range) return DecorationSet.empty
            return DecorationSet.create(state.doc, [
              Decoration.inline(range.from, range.to, { class: 'citation-flash-highlight' }),
            ])
          },
        },
      }),
    ]
  },
})

// ── Citation click detection ─────────────────────────────────────────────────
// Decorates citation-shaped text (see scanTextForCitations) as clickable spans.
// Reads live style/data through a ref rather than TipTap options so DocumentSurface
// can update it every render without recreating the extension/editor; callers must
// dispatch a transaction after mutating the ref for decorations() to recompute.
interface CitationLinkData {
  style:            CitationStyle
  knownMlaSurnames: Set<string>
  literature:       FetchedLiterature[]
  bibliography:     ParsedReference[]
  citationFlags:    CitationFlag[]
}

const citationLinkKey = new PluginKey('citationLink')

const CitationLink = Extension.create<{ dataRef: { current: CitationLinkData } }>({
  name: 'citationLink',
  addOptions() {
    return {
      dataRef: {
        current: {
          style: 'apa7' as CitationStyle, knownMlaSurnames: new Set<string>(),
          literature: [], bibliography: [], citationFlags: [],
        },
      },
    }
  },
  addProseMirrorPlugins() {
    const { dataRef } = this.options
    return [
      new Plugin({
        key: citationLinkKey,
        props: {
          decorations(state) {
            const { style, knownMlaSurnames, literature, bibliography, citationFlags } = dataRef.current
            const decos: Decoration[] = []
            state.doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return
              for (const hit of scanTextForCitations(node.text, style, knownMlaSurnames)) {
                // Only resolve to check for a citation-integrity flag when there are flags to
                // find at all — skips the resolve cost entirely for sections with none.
                const resolved = citationFlags.length === 0 ? null
                  : style === 'ieee'
                    ? resolveIeeeHit(hit, bibliography, literature)
                    : resolveHitAgainstLiterature(hit, style, literature)
                const flagged = resolved?.matchedSource
                  && citationFlags.some(f => f.status === 'Open' && f.doi.toLowerCase() === (resolved.doi ?? '').toLowerCase())

                decos.push(Decoration.inline(pos + hit.from, pos + hit.to, {
                  class: flagged ? 'citation-ref citation-ref--flagged' : 'citation-ref',
                  'data-citation-inner': hit.inner,
                }))
              }
            })
            return DecorationSet.create(state.doc, decos)
          },
        },
      }),
    ]
  },
})

// ── Toolbar button ──────────────────────────────────────────────────────────

function TBtn({
  onClick, active, disabled, title, children,
}: {
  onClick:   () => void
  active?:   boolean
  disabled?: boolean
  title?:    string
  children:  React.ReactNode
}) {
  return (
    <button
      onMouseDown={e => { e.preventDefault(); if (!disabled) onClick() }}
      disabled={disabled}
      title={title}
      className={cn(
        'flex items-center justify-center w-9 h-9 rounded-lg transition-colors',
        disabled
          ? 'text-slate-300 cursor-not-allowed'
          : active
          ? 'bg-slate-800 text-white'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
      )}
    >
      {children}
    </button>
  )
}

// No margin of its own — spacing comes from the toolbar row's flex `gap`,
// same as between any two buttons, so it isn't double-spaced against them.
function TDivider() {
  return <div className="w-px h-6 bg-slate-200 shrink-0" />
}

// AI generation sometimes prepends a redundant "# Section Title" heading line
// despite the prompt instructing prose only — the backend already strips this
// for .docx export (see ResearchService.StripLeadingHeadings). Mirrored here so
// the live editor doesn't show a heading that duplicates the card header title
// above it, and so a subsequent auto-save drops it from storage too.
function stripLeadingHeadingLines(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  let i = 0
  while (i < lines.length) {
    if (lines[i].trimStart().startsWith('#')) {
      i++
      while (i < lines.length && lines[i].trim() === '') i++
    } else break
  }
  return lines.slice(i).join('\n').replace(/^\n+/, '')
}

// ── Component ───────────────────────────────────────────────────────────────

export const DocumentSurface = forwardRef<DocumentSurfaceHandle, DocumentSurfaceProps>(function DocumentSurface({
  sectionCode,
  sectionTitle,
  sectionDescription,
  content,
  status,
  wordCount: _wordCount,
  aiDetectionScore,
  isGenerating,
  streamingContent,
  isStalled,
  isSaving,
  hasContent,
  citationLabel,
  citationStyle,
  literature,
  bibliography,
  citationFlags,
  citationsPendingVerification,
  onContentChange,
  onSave,
  onGenerate,
  onRegenerate,
  onApprove,
  onCitationInserted,
  onRequestBibliography,
  onDismissCitationFlag,
}, ref) {
  const docEditorFontSize    = useUiStore(s => s.docEditorFontSize)
  const setDocEditorFontSize = useUiStore(s => s.setDocEditorFontSize)
  const saveTimerRef       = useRef<ReturnType<typeof setTimeout>>()
  // Suppresses onUpdate callbacks that originate from programmatic editor mutations
  // (setContent, setEditable) so they are never mistaken for user keystrokes.
  const isProgrammatic     = useRef(false)
  // TipTap v3 compares ALL options on every re-render via its internal onRender effect,
  // and calls setOptions (→ view.updateState) when any option value changes. Locking the
  // initial content via useRef makes compareOptions always see the same value so TipTap
  // never calls setOptions for content changes. Our sync effect below owns all updates.
  const initialContent     = useRef(stripLeadingHeadingLines(content))
  // Track the last content value we pushed into the editor so the sync effect can skip
  // redundant setContent calls. Compared against the raw `content` prop (pre-strip) —
  // this only needs to detect "did the prop change", not mirror what was rendered.
  const lastSetContent     = useRef(content)
  // Stable ref so CitationLink's decorations() (created once, at editor init) always
  // reads the latest style/known-surnames/literature/flags — see the CitationLink doc comment above.
  const citationLinkDataRef = useRef<CitationLinkData>({
    style: citationStyle, knownMlaSurnames: new Set(),
    literature: [], bibliography: [], citationFlags: [],
  })

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({
        placeholder: 'Press / for commands, or start writing here…',
        emptyEditorClass: 'tiptap-is-empty',
      }),
      CitationFlash,
      CitationLink.configure({ dataRef: citationLinkDataRef }),
      // allowBase64: the embedded data-URI images this app inserts (see
      // handleImageFile below) get stripped by the default parse rule
      // (`img[src]:not([src^="data:"])`) every time content round-trips
      // through the Markdown extension's HTML re-parse.
      TiptapImage.configure({ allowBase64: true }),
      // GFM Markdown tables (`| Col | Col |` + `|---|---|` separator row) are valid CommonMark-
      // adjacent syntax that markdown-it (tiptap-markdown's underlying parser) already renders
      // correctly into real <table>/<tr>/<th>/<td> HTML — but without this extension the editor's
      // own ProseMirror schema has no node type to hold that HTML back into, so it silently
      // collapsed into flattened, delimiter-less text (every generated Section 5.7 "Study
      // Variables" table hit exactly this). tiptap-markdown ships its own markdown serialize/parse
      // rule for a node literally named "table" (see its src/extensions/nodes/table.js) and
      // matches it onto whichever extension the app registers under that name — so no extra glue
      // code is needed here beyond registering TableKit. resizable: false — keeps this the plain
      // read/generate/edit table AI content arrives as, not a spreadsheet-editing surface; add
      // column resize UI only if a real need for it shows up.
      TableKit.configure({ table: { resizable: false } }),
      // Serializes/parses editor content as Markdown instead of HTML — matches the
      // backend's existing convention (ProjectSection.Content is fed straight into
      // Pandoc for .docx export and into LLM prompts as Markdown; see
      // ResearchService.StripLeadingHeadings). `html: false` keeps marks without a
      // Markdown equivalent (e.g. underline) from round-tripping as raw HTML.
      // `breaks: true` matches legacy plain-text content's convention of a bare
      // newline as a line break within a paragraph, not a new paragraph.
      Markdown.configure({ html: false, breaks: true, transformCopiedText: false }),
    ],
    content: initialContent.current,
    editable: !isGenerating,
    onUpdate: ({ editor }) => {
      if (isProgrammatic.current) return
      const markdown = editor.storage.markdown.getMarkdown()
      onContentChange(markdown)
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => onSave(), 1000)
    },
  })

  // Sync external content into editor (e.g. after AI generation, tab switch).
  // `editor` must be in deps: if TipTap initializes after `content` has already
  // updated to the generated value, this effect needs to re-run when it becomes ready.
  // We compare against `lastSetContent` (what we last pushed in) rather than
  // `editor.storage.markdown.getMarkdown()` to avoid reserializing on every render.
  // Cleanup resets lastSetContent so a React StrictMode remount always re-pushes content.
  useEffect(() => {
    if (!editor || isGenerating) return
    if (content === lastSetContent.current) return
    const prev = lastSetContent.current
    lastSetContent.current = content
    isProgrammatic.current = true
    editor.commands.setContent(stripLeadingHeadingLines(content), { emitUpdate: false })
    isProgrammatic.current = false
    return () => { lastSetContent.current = prev }
  }, [content, isGenerating, editor])

  // Sync editable state; wrap in isProgrammatic so any transaction TipTap dispatches
  // during setEditable is not mistaken for a user edit.
  useEffect(() => {
    if (!editor) return
    isProgrammatic.current = true
    editor.setEditable(!isGenerating)
    isProgrammatic.current = false
  }, [isGenerating, editor])

  // editor.can().undo()/redo() aren't reactive on their own — force a re-render on every
  // transaction so the toolbar buttons' disabled state stays in sync with history state.
  const [, forceRerender] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    if (!editor) return
    editor.on('transaction', forceRerender)
    return () => { editor.off('transaction', forceRerender) }
  }, [editor])
  const canUndo = editor?.can().undo() ?? false
  const canRedo = editor?.can().redo() ?? false

  // ── Clickable citations ─────────────────────────────────────────────────────
  // MLA has no year marker, so decoration is gated on the surname actually
  // appearing in this project's literature — see scanTextForCitations.
  const knownMlaSurnames = useMemo(
    () => new Set((literature ?? []).map(l => extractSurnamesFromAuthors(l.authors)[0]).filter((s): s is string => !!s)),
    [literature],
  )

  // Push the latest style/surnames/literature/flags into the ref CitationLink's decorations()
  // reads, then dispatch a no-op transaction so ProseMirror recomputes them immediately —
  // decorations() only re-runs on a new editor state, not on plain prop changes.
  useEffect(() => {
    citationLinkDataRef.current = {
      style: citationStyle, knownMlaSurnames,
      literature: literature ?? [], bibliography: bibliography ?? [], citationFlags: citationFlags ?? [],
    }
    if (!editor) return
    isProgrammatic.current = true
    editor.view.dispatch(editor.state.tr.setMeta('citationDataRefresh', true))
    isProgrammatic.current = false
  }, [citationStyle, knownMlaSurnames, literature, bibliography, citationFlags, editor])

  const [activeCitation, setActiveCitation] = useState<{
    hit:    CitationHit
    style:  CitationStyle
    anchor: { x: number; y: number }
  } | null>(null)

  // Decorated citation spans carry their matched text in data-citation-inner (see
  // CitationLink) — a plain DOM listener is simpler than ProseMirror's handleClick
  // here since we just need the element, not a hit-tested doc position.
  useEffect(() => {
    if (!editor) return
    const dom = editor.view.dom
    const handleClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest('[data-citation-inner]') as HTMLElement | null
      if (!el) return
      const inner = el.getAttribute('data-citation-inner')
      if (inner === null) return
      const from = editor.view.posAtDOM(el, 0)
      const to   = from + (el.textContent?.length ?? 0)
      const rect = el.getBoundingClientRect()
      setActiveCitation({
        hit:    { from, to, inner },
        style:  citationLinkDataRef.current.style,
        anchor: { x: rect.left, y: rect.bottom },
      })
      if (citationLinkDataRef.current.style === 'ieee' && !bibliography) onRequestBibliography?.()
    }
    dom.addEventListener('click', handleClick)
    return () => dom.removeEventListener('click', handleClick)
  }, [editor, bibliography, onRequestBibliography])

  const citationPopoverData: ResolvedCitation | 'loading' | null = (() => {
    if (!activeCitation) return null
    if (activeCitation.style === 'ieee') {
      if (!bibliography) return 'loading'
      return resolveIeeeHit(activeCitation.hit, bibliography, literature ?? [])
        ?? { displayTitle: `[${activeCitation.hit.inner}]`, matchedSource: false }
    }
    if (!literature) return 'loading'
    return resolveHitAgainstLiterature(activeCitation.hit, activeCitation.style, literature)
      ?? { displayTitle: `(${activeCitation.hit.inner})`, matchedSource: false }
  })()

  // Best-effort: when the resolved citation's source carries an open integrity flag, surface it
  // in the popover. Disambiguates by proximity when the same source is cited more than once in
  // this section (see findFlagForHit) using the text immediately around the clicked occurrence.
  const activeCitationFlag = (() => {
    if (!activeCitation || !editor || !citationFlags?.length) return undefined
    if (citationPopoverData === 'loading' || !citationPopoverData?.matchedSource) return undefined
    const docSize = editor.state.doc.content.size
    const from = Math.max(0, activeCitation.hit.from - 300)
    const to   = Math.min(docSize, activeCitation.hit.to + 300)
    const surrounding = editor.state.doc.textBetween(from, to, ' ')
    return findFlagForHit(citationPopoverData.doi, surrounding, citationFlags)
  })()

  const handleRemoveCitation = () => {
    if (!editor || !activeCitation) return
    editor.chain().focus().deleteRange({ from: activeCitation.hit.from, to: activeCitation.hit.to }).run()
    setActiveCitation(null)
  }

  useImperativeHandle(ref, () => ({
    insertCitationAtCursor: (text: string) => {
      if (!editor) return
      const { selection, doc } = editor.state
      // A selection at/near doc start with no prior interaction reads as "never focused" —
      // fall back to appending at the end of the document rather than inserting at position 0.
      const untouched = selection.from <= 1 && selection.to <= 1
      const insertPos = untouched ? doc.content.size - 1 : selection.to
      const precedingChar = doc.textBetween(Math.max(0, insertPos - 1), insertPos)
      const insertText = (precedingChar && !/\s/.test(precedingChar) ? ' ' : '') + text

      editor.chain().focus().insertContentAt(insertPos, insertText).run()
      const to = insertPos + insertText.length
      editor.commands.flashRange({ from: insertPos, to })
      setTimeout(() => editor.commands.clearFlash(), 700)
      onCitationInserted?.(text)
    },
  }), [editor, onCitationInserted])

  const chapterLabel   = getChapterLabel(sectionCode)
  // Computed from the raw markdown `content` prop (not editor.getText()) so a trailing
  // "### References (N)" heading — a real Heading node once parsed into the editor, with
  // no surviving "#" markers in getText() — can still be detected and excluded. `content`
  // stays in sync with every keystroke via onContentChange, so this doesn't lag typing.
  const wordCount      = countBodyWords(content)
  const isApproved     = status === 'Approved'

  // ── Word Count Modal ────────────────────────────────────────────────────────
  const [showWCModal,     setShowWCModal]     = useState(false)
  const [targetWordCount, setTargetWordCount] = useState(500)
  const [wcInputValue,    setWcInputValue]    = useState('500')

  // ── Text Style dropdown (Zone 2 — replaces separate H1/H2/H3/paragraph buttons) ──
  const [textStyleMenuOpen, setTextStyleMenuOpen] = useState(false)

  // ── Image insert ─────────────────────────────────────────────────────────────
  // Embedded as a base64 data URI directly in the saved Markdown (matches the
  // pattern already used in DocumentEditorPage.tsx) — the .docx export renderer
  // (MarkdownDocxRenderer.DocxImage) decodes and embeds these as real OpenXML
  // pictures. Restricted to png/jpeg/gif — the only types that renderer handles.
  const MAX_IMAGE_BYTES = 3 * 1024 * 1024
  const [imageMenuOpen, setImageMenuOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageFile = (file: File | undefined) => {
    if (!file || !editor) return
    if (!['image/png', 'image/jpeg', 'image/gif'].includes(file.type)) {
      toast.error('Please use a PNG, JPEG, or GIF image')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('Image too large — please use one under 3 MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') editor.chain().focus().setImage({ src: reader.result }).run()
    }
    reader.readAsDataURL(file)
  }

  // ── Link insert (Zone 5) — StarterKit bundles the Link mark by default ──────
  const handleSetLink = () => {
    if (!editor) return
    const existingUrl = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Link URL', existingUrl ?? '')
    if (url === null) return
    if (url === '') { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  // ── Text Style dropdown options (Zone 2) ─────────────────────────────────────
  const textStyleOptions = [
    { label: 'Normal Text', active: !!editor?.isActive('paragraph'), action: () => editor?.chain().focus().setParagraph().run() },
    { label: 'Heading 1',   active: !!editor?.isActive('heading', { level: 1 }), action: () => editor?.chain().focus().toggleHeading({ level: 1 }).run() },
    { label: 'Heading 2',   active: !!editor?.isActive('heading', { level: 2 }), action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: 'Heading 3',   active: !!editor?.isActive('heading', { level: 3 }), action: () => editor?.chain().focus().toggleHeading({ level: 3 }).run() },
  ]
  const currentTextStyleLabel = textStyleOptions.find(o => o.active)?.label ?? 'Normal Text'

  const WC_PRESETS = [
    { label: 'Short',    sub: '300 words',  words: 300  },
    { label: 'Standard', sub: '500 words',  words: 500  },
    { label: 'Long',     sub: '750 words',  words: 750  },
    { label: 'Extended', sub: '1500 words', words: 1500 },
  ]

  const approxPages  = (targetWordCount / 275).toFixed(1)
  const isValidWC    = targetWordCount >= 100 && targetWordCount <= 5000

  const handlePresetSelect = (words: number) => {
    setTargetWordCount(words)
    setWcInputValue(String(words))
  }

  const handleWcInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setWcInputValue(raw)
    const parsed = parseInt(raw, 10)
    if (!isNaN(parsed)) {
      setTargetWordCount(Math.min(5000, Math.max(100, parsed)))
    }
  }

  const handleWcInputBlur = () => {
    const parsed = parseInt(wcInputValue, 10)
    const clamped = isNaN(parsed) ? 100 : Math.min(5000, Math.max(100, parsed))
    setTargetWordCount(clamped)
    setWcInputValue(String(clamped))
  }

  return (
    <div className="doc-surface-wrapper">
      {/* ── Citation reference popover — opens when a resolved in-text citation is clicked */}
      {activeCitation && citationPopoverData && (
        <CitationPopover
          anchor={activeCitation.anchor}
          data={citationPopoverData}
          flag={activeCitationFlag}
          onClose={() => setActiveCitation(null)}
          onRemove={handleRemoveCitation}
          onDismissFlag={activeCitationFlag && onDismissCitationFlag
            ? () => { onDismissCitationFlag(activeCitationFlag.id); setActiveCitation(null) }
            : undefined}
        />
      )}

      {/* ── Word Count Modal — inlined JSX (never a component def inside render) */}
      {showWCModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-[15px] font-bold text-slate-800">{chapterLabel || 'Section'}</h3>
              <button
                onClick={() => setShowWCModal(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-6">
              <p className="text-[13px] font-semibold text-slate-700 mb-4">Target Word Count</p>

              {/* Preset tiles */}
              <div className="grid grid-cols-4 gap-2 mb-5">
                {WC_PRESETS.map(p => (
                  <button
                    key={p.words}
                    onClick={() => handlePresetSelect(p.words)}
                    className={cn(
                      'flex flex-col items-center py-3 px-2 rounded-xl border-2 text-center transition-all',
                      targetWordCount === p.words
                        ? 'border-violet-500 bg-violet-50'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                    )}
                  >
                    <span className={cn(
                      'text-[13px] font-semibold',
                      targetWordCount === p.words ? 'text-violet-700' : 'text-slate-700',
                    )}>
                      {p.label}
                    </span>
                    <span className={cn(
                      'text-[11px] mt-0.5',
                      targetWordCount === p.words ? 'text-violet-500' : 'text-slate-400',
                    )}>
                      {p.sub}
                    </span>
                  </button>
                ))}
              </div>

              {/* Custom word count */}
              <div className="mb-3">
                <p className="text-[11px] font-medium text-slate-500 mb-1.5">Custom word count</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={100}
                    max={5000}
                    value={wcInputValue}
                    onChange={handleWcInputChange}
                    onBlur={handleWcInputBlur}
                    className={cn(
                      'w-24 text-center border rounded-lg px-2 py-1.5 text-[13px] text-slate-800 outline-none transition-colors',
                      !isValidWC
                        ? 'border-red-300 focus:border-red-400'
                        : 'border-slate-200 focus:border-violet-400',
                    )}
                  />
                  <span className="text-[12px] text-slate-500">words</span>
                </div>
              </div>

              {/* Pages estimate */}
              <p className="text-[12px] text-slate-500">≈ {approxPages} pages (double-spaced)</p>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/60">
              <button
                onClick={() => setShowWCModal(false)}
                className="px-5 py-2 rounded-lg text-[13px] text-slate-600 hover:bg-slate-100 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!isValidWC) return
                  setShowWCModal(false)
                  onGenerate(targetWordCount)
                }}
                disabled={!isValidWC}
                className={cn(
                  'flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-[13px] font-semibold transition-colors shadow-md',
                  isValidWC
                    ? 'bg-purple-accent hover:bg-purple-deep shadow-violet-200'
                    : 'bg-slate-300 shadow-slate-200 cursor-not-allowed',
                )}
              >
                <Sparkles size={14} /> Start Generation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── White document card (fills remaining height, scrolls internally) ── */}
      <div className="doc-page-surface">

        {/* ── Sticky top: card header + toolbar ──────────────────────────── */}
        <div className="doc-card-sticky">

          {/* Card header row — the single canonical title/description for this section */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
            <div className="min-w-0">
              {chapterLabel && (
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                  {chapterLabel}
                </p>
              )}
              <h2 className="text-[20px] font-bold text-slate-800">
                {sectionCode}: {sectionTitle}
              </h2>
              {sectionDescription && (
                <p className="text-[14px] text-slate-500 mt-1 truncate">{sectionDescription}</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isGenerating ? (
                <button disabled className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-white text-[13px] font-semibold opacity-80 cursor-not-allowed">
                  <Loader2 size={13} className="animate-spin" /> Generating…
                </button>
              ) : hasContent ? (
                <>
                  <button
                    onMouseDown={e => { e.preventDefault(); onRegenerate() }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-[12px] font-medium hover:bg-slate-50 transition-colors"
                  >
                    <RefreshCw size={12} /> Regenerate
                  </button>
                  <button
                    onMouseDown={e => { e.preventDefault(); onApprove() }}
                    disabled={isApproved}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors',
                      isApproved
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 cursor-default'
                        : 'bg-emerald-500 hover:bg-emerald-600 text-white',
                    )}
                  >
                    <ThumbsUp size={12} />
                    {isApproved ? 'Approved' : 'Approve'}
                  </button>
                </>
              ) : (
                <button
                  onMouseDown={e => { e.preventDefault(); setShowWCModal(true) }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-[13px] font-semibold transition-colors"
                >
                  <Sparkles size={13} /> Generate Entire Section
                </button>
              )}
            </div>
          </div>

          {/* Formatting toolbar — a single sticky row, grouped into zones by vertical
              dividers. No floating/bubble menu — everything lives here so nothing can
              ever render on top of the document body (flex-wrap reflows onto a second
              in-flow line on narrow widths rather than overlaying anything). */}
          {!isGenerating && (
            <div className="flex items-center justify-between gap-1 px-1 py-2 border-b border-slate-100 bg-white flex-nowrap overflow-x-auto">
              <div className="flex items-center gap-0.5 flex-nowrap shrink-0">
                {/* Zone 1 — History */}
                <TBtn onClick={() => editor?.chain().focus().undo().run()} disabled={!canUndo} title="Undo (Ctrl+Z)">
                  <Undo2 size={18} />
                </TBtn>
                <TBtn onClick={() => editor?.chain().focus().redo().run()} disabled={!canRedo} title="Redo (Ctrl+Y)">
                  <Redo2 size={18} />
                </TBtn>

                <TDivider />

                {/* Zone 2 — Hierarchy: single Text Style dropdown (replaces separate
                    H1/H2/H3/Paragraph buttons), label tracks the cursor's block type */}
                <div className="relative">
                  <button
                    onMouseDown={e => { e.preventDefault(); setTextStyleMenuOpen(v => !v) }}
                    title="Text style"
                    className="flex items-center gap-0.5 h-9 px-1.5 text-[13px] font-medium rounded-lg hover:bg-slate-100 text-slate-700 transition-colors whitespace-nowrap"
                  >
                    <span>{currentTextStyleLabel}</span>
                    <ChevronDown size={13} className="text-slate-400 shrink-0" />
                  </button>
                  {textStyleMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setTextStyleMenuOpen(false)} />
                      <div className="absolute left-0 top-full mt-1 w-36 bg-white border border-slate-200 rounded-xl shadow-xl z-40 py-1 overflow-hidden">
                        {textStyleOptions.map(opt => (
                          <button
                            key={opt.label}
                            onMouseDown={e => { e.preventDefault(); setTextStyleMenuOpen(false); opt.action() }}
                            className={cn(
                              'w-full text-left px-3 py-2 text-[13px] transition-colors',
                              opt.active ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-600 hover:bg-slate-50',
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <TDivider />

                {/* Zone 3 — Typography */}
                <TBtn onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')} title="Bold (Ctrl+B)">
                  <Bold size={18} />
                </TBtn>
                <TBtn onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')} title="Italic (Ctrl+I)">
                  <Italic size={18} />
                </TBtn>
                <TBtn onClick={() => editor?.chain().focus().toggleUnderline().run()} active={editor?.isActive('underline')} title="Underline (Ctrl+U)">
                  <UnderlineIcon size={18} />
                </TBtn>
                <TBtn onClick={() => editor?.chain().focus().toggleStrike().run()} active={editor?.isActive('strike')} title="Strikethrough (Ctrl+Shift+S)">
                  <Strikethrough size={18} />
                </TBtn>

                <TDivider />

                {/* Zone 4 — Alignment & Lists */}
                <TBtn onClick={() => editor?.chain().focus().setTextAlign('left').run()} active={editor?.isActive({ textAlign: 'left' })} title="Align Left (Ctrl+Shift+L)">
                  <AlignLeft size={18} />
                </TBtn>
                <TBtn onClick={() => editor?.chain().focus().setTextAlign('center').run()} active={editor?.isActive({ textAlign: 'center' })} title="Align Center (Ctrl+Shift+E)">
                  <AlignCenter size={18} />
                </TBtn>
                <TBtn onClick={() => editor?.chain().focus().setTextAlign('right').run()} active={editor?.isActive({ textAlign: 'right' })} title="Align Right (Ctrl+Shift+R)">
                  <AlignRight size={18} />
                </TBtn>
                <TBtn onClick={() => editor?.chain().focus().setTextAlign('justify').run()} active={editor?.isActive({ textAlign: 'justify' })} title="Justify (Ctrl+Shift+J)">
                  <AlignJustify size={18} />
                </TBtn>
                <TBtn onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')} title="Bullet List (Ctrl+Shift+8)">
                  <List size={18} />
                </TBtn>
                <TBtn onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive('orderedList')} title="Numbered List (Ctrl+Shift+7)">
                  <ListOrdered size={18} />
                </TBtn>

                <TDivider />

                {/* Zone 5 — Insert */}
                <TBtn onClick={() => editor?.chain().focus().toggleBlockquote().run()} active={editor?.isActive('blockquote')} title="Blockquote (Ctrl+Shift+B)">
                  <Quote size={18} />
                </TBtn>
                <div className="relative">
                  <TBtn onClick={() => setImageMenuOpen(v => !v)} active={imageMenuOpen} title="Insert image">
                    <ImageIcon size={18} />
                  </TBtn>
                  {imageMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setImageMenuOpen(false)} />
                      <div className="absolute left-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-40 py-1 overflow-hidden">
                        <button
                          onMouseDown={e => { e.preventDefault(); setImageMenuOpen(false); fileInputRef.current?.click() }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                        >
                          <Upload size={13} className="text-slate-400" />
                          Upload from computer
                        </button>
                        <button
                          onMouseDown={e => {
                            e.preventDefault()
                            setImageMenuOpen(false)
                            const url = window.prompt('Image URL')
                            if (url) editor?.chain().focus().setImage({ src: url }).run()
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                        >
                          <Globe size={13} className="text-slate-400" />
                          By URL
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <TBtn onClick={handleSetLink} active={editor?.isActive('link')} title="Insert Link (Ctrl+K)">
                  <LinkIcon size={18} />
                </TBtn>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif"
                  className="hidden"
                  onChange={e => { handleImageFile(e.target.files?.[0]); e.target.value = '' }}
                />
              </div>

              {/* Zone 6 — Metadata (right-aligned): body text size + citation style.
                  Only ever sets --editor-font-size on the document body wrapper —
                  never touches toolbar/sidebar font sizes. */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center rounded-lg border border-slate-200 overflow-hidden">
                  {DOC_EDITOR_FONT_SIZES.map((size, i) => (
                    <button
                      key={size}
                      onMouseDown={e => { e.preventDefault(); setDocEditorFontSize(size) }}
                      title={`${size === 14 ? 'Small' : size === 18 ? 'Large' : 'Default'} text (${size}px)`}
                      aria-pressed={docEditorFontSize === size}
                      className={cn(
                        'w-9 h-9 flex items-center justify-center font-medium transition-colors',
                        i > 0 && 'border-l border-slate-200',
                        docEditorFontSize === size ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100',
                      )}
                      style={{ fontSize: size === 14 ? 12 : size === 18 ? 20 : 16 }}
                    >
                      A
                    </button>
                  ))}
                </div>

                <span className="inline-flex items-center px-1.5 h-9 rounded-lg border border-slate-200 text-[11px] font-medium text-slate-600 bg-slate-50 whitespace-nowrap">
                  {citationLabel}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── Scrollable editor body ──────────────────────────────────────── */}
        <div className="doc-editor-scroll">

          {/* Generating skeleton */}
          {isGenerating && (
            <div className="doc-generating" style={{ padding: '28px 48px' }}>
              <div className="generating-indicator">
                <span className="generating-dot" />
                <span className="generating-dot" />
                <span className="generating-dot" />
                <span className="generating-label">Writing {sectionTitle}…</span>
              </div>
              {isStalled && (
                <p className="text-[12px] text-amber-600 -mt-2 mb-4">
                  This is taking longer than usual. It should recover automatically within a
                  few minutes — no need to leave this page.
                </p>
              )}
              {streamingContent ? (
                <div className="streaming-preview" data-testid="streaming-preview">
                  {streamingContent}
                  <span className="streaming-cursor" />
                </div>
              ) : (
                <div className="skeleton-lines">
                  {[92, 87, 95, 60, 89, 91, 83, 97, 55].map((w, i) => (
                    <div key={i} className={`skeleton-line${i === 4 ? ' skeleton-gap' : ''}`} style={{ width: `${w}%` }} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TipTap editor */}
          {!isGenerating && (
            <div style={{ padding: '28px 48px', '--editor-font-size': `${docEditorFontSize}px` } as React.CSSProperties}>
              <EditorContent editor={editor} className="tiptap-doc-editor" />
            </div>
          )}

          {/* Page footer — inside scroll so it lives below the content */}
          <div className="doc-page-footer" style={{ padding: '0 48px 24px' }}>
            <span className="doc-word-count">{wordCount} words</span>

            {aiDetectionScore !== undefined && aiDetectionScore >= 0 && (
              <span className={`doc-ai-badge ${
                aiDetectionScore < 25 ? 'doc-ai-safe'
                : aiDetectionScore < 60 ? 'doc-ai-warn'
                : 'doc-ai-danger'
              }`}>
                <ShieldCheck size={12} />
                AI score {aiDetectionScore}%
              </span>
            )}

            {isApproved && (
              <span className="doc-approved-badge">
                <CheckCircle2 size={12} /> Approved
              </span>
            )}

            {citationsPendingVerification && (
              <span
                className="flex items-center gap-1 text-[11px] text-slate-400"
                title="Checking each citation's claim, journal, and authors against the real source — mismatches (if any) will appear as flags in a few seconds."
              >
                <Loader2 size={10} className="animate-spin" /> Verifying citations…
              </span>
            )}

            <div className="ml-auto">
              {isSaving ? (
                <span className="flex items-center gap-1 text-[11px] text-slate-400">
                  <Loader2 size={10} className="animate-spin" /> Saving…
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] text-emerald-500">
                  <Check size={10} /> Auto-saved
                </span>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
})
