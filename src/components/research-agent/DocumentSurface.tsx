import { forwardRef, useEffect, useImperativeHandle, useReducer, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3, Pilcrow,
  List, ListOrdered, Quote,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Undo2, Redo2, MoreHorizontal,
  Sparkles, RefreshCw, ThumbsUp, Loader2, Check,
  CheckCircle2, ShieldCheck,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import type { SectionStatus } from '../../types/research'

interface DocumentSurfaceProps {
  sectionCode:       string
  sectionTitle:      string
  sectionDescription:string
  content:           string
  status:            SectionStatus | 'NotStarted'
  wordCount:         number
  aiDetectionScore?: number
  isGenerating:      boolean
  isSaving:          boolean
  hasContent:        boolean
  citationLabel:     string
  onContentChange:   (content: string) => void
  onSave:            () => void
  onGenerate:        (wordCount: number) => void
  onRegenerate:      () => void
  onApprove:         () => void
  onCitationInserted?: (text: string) => void
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

function plainToHtml(text: string): string {
  if (!text.trim()) return ''
  // If it already contains HTML tags, use as-is
  if (/<[^>]+>/.test(text)) return text
  return text
    .split(/\n\n+/)
    .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('')
}

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
        'flex items-center justify-center w-7 h-7 rounded transition-colors',
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

function TDivider() {
  return <div className="w-px h-4 bg-slate-200 mx-0.5 shrink-0" />
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
  isSaving,
  hasContent,
  citationLabel,
  onContentChange,
  onSave,
  onGenerate,
  onRegenerate,
  onApprove,
  onCitationInserted,
}, ref) {
  const saveTimerRef       = useRef<ReturnType<typeof setTimeout>>()
  // Suppresses onUpdate callbacks that originate from programmatic editor mutations
  // (setContent, setEditable) so they are never mistaken for user keystrokes.
  const isProgrammatic     = useRef(false)
  // TipTap v3 compares ALL options on every re-render via its internal onRender effect,
  // and calls setOptions (→ view.updateState) when any option value changes. Locking the
  // initial content via useRef makes compareOptions always see the same value so TipTap
  // never calls setOptions for content changes. Our sync effect below owns all updates.
  const initialContent     = useRef(plainToHtml(content))
  // Track the last content value we pushed into the editor so the sync effect can skip
  // redundant calls without comparing editor.getText() (plain text) against `content`
  // (which may be HTML), which would always differ and cause unnecessary setContent calls.
  const lastSetContent     = useRef(content)

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({
        placeholder: 'Press / for commands, or start writing here…',
        emptyEditorClass: 'tiptap-is-empty',
      }),
      CitationFlash,
    ],
    content: initialContent.current,
    editable: !isGenerating,
    onUpdate: ({ editor }) => {
      if (isProgrammatic.current) return
      const text = editor.getText({ blockSeparator: '\n\n' })
      onContentChange(text)
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => onSave(), 1000)
    },
  })

  // Sync external content into editor (e.g. after AI generation, tab switch).
  // `editor` must be in deps: if TipTap initializes after `content` has already
  // updated to the generated value, this effect needs to re-run when it becomes ready.
  // We compare against `lastSetContent` (what we last pushed in) rather than
  // `editor.getText()` (plain text) vs `content` (possibly HTML) to avoid a false
  // "they differ" that would call setContent on every render.
  // Cleanup resets lastSetContent so a React StrictMode remount always re-pushes content.
  useEffect(() => {
    if (!editor || isGenerating) return
    if (content === lastSetContent.current) return
    const prev = lastSetContent.current
    lastSetContent.current = content
    isProgrammatic.current = true
    editor.commands.setContent(plainToHtml(content), { emitUpdate: false })
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
  const wordCount      = editor?.getText().trim().split(/\s+/).filter(Boolean).length ?? 0
  const isApproved     = status === 'Approved'

  // ── Word Count Modal ────────────────────────────────────────────────────────
  const [showWCModal,     setShowWCModal]     = useState(false)
  const [targetWordCount, setTargetWordCount] = useState(500)
  const [wcInputValue,    setWcInputValue]    = useState('500')

  // ── Toolbar overflow ("More formatting") ───────────────────────────────────
  const [showMoreFormatting, setShowMoreFormatting] = useState(false)

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
              <h2 className="text-[15px] font-bold text-slate-800">
                {sectionCode}: {sectionTitle}
              </h2>
              {sectionDescription && (
                <p className="text-[11px] text-slate-500 mt-0.5 truncate">{sectionDescription}</p>
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

          {/* Formatting toolbar — 5 core controls by default; the rest live behind
              "More formatting" so the toolbar matches the light-editing workflow here
              rather than a full authoring surface. */}
          {!isGenerating && (
            <div className="flex items-center gap-0.5 px-3 py-2 border-b border-slate-100 bg-white flex-wrap">
              <TBtn onClick={() => editor?.chain().focus().undo().run()} disabled={!canUndo} title="Undo (Ctrl+Z)">
                <Undo2 size={13} />
              </TBtn>
              <TBtn onClick={() => editor?.chain().focus().redo().run()} disabled={!canRedo} title="Redo (Ctrl+Y)">
                <Redo2 size={13} />
              </TBtn>

              <TDivider />

              <span className="inline-flex items-center px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-medium text-slate-600 bg-slate-50 mr-1.5 whitespace-nowrap">
                {citationLabel}
              </span>

              <TDivider />

              <TBtn onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')} title="Bold (Ctrl+B)">
                <Bold size={13} />
              </TBtn>
              <TBtn onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')} title="Italic (Ctrl+I)">
                <Italic size={13} />
              </TBtn>
              <TBtn onClick={() => editor?.chain().focus().toggleUnderline().run()} active={editor?.isActive('underline')} title="Underline (Ctrl+U)">
                <UnderlineIcon size={13} />
              </TBtn>

              <TDivider />

              <TBtn onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')} title="Bullet List">
                <List size={13} />
              </TBtn>
              <TBtn onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive('orderedList')} title="Numbered List">
                <ListOrdered size={13} />
              </TBtn>

              <TDivider />

              <div className="relative">
                <TBtn onClick={() => setShowMoreFormatting(v => !v)} active={showMoreFormatting} title="More formatting">
                  <MoreHorizontal size={13} />
                </TBtn>

                {showMoreFormatting && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowMoreFormatting(false)} />
                    <div
                      className="absolute left-0 top-full mt-1 z-20 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 flex flex-wrap items-center gap-0.5"
                      style={{ width: 232 }}
                    >
                      <TBtn onClick={() => editor?.chain().focus().toggleStrike().run()} active={editor?.isActive('strike')} title="Strikethrough">
                        <Strikethrough size={13} />
                      </TBtn>
                      <TBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} active={editor?.isActive('heading', { level: 1 })} title="Heading 1">
                        <Heading1 size={13} />
                      </TBtn>
                      <TBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} active={editor?.isActive('heading', { level: 2 })} title="Heading 2">
                        <Heading2 size={13} />
                      </TBtn>
                      <TBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} active={editor?.isActive('heading', { level: 3 })} title="Heading 3">
                        <Heading3 size={13} />
                      </TBtn>
                      <TBtn onClick={() => editor?.chain().focus().setParagraph().run()} active={editor?.isActive('paragraph')} title="Paragraph">
                        <Pilcrow size={13} />
                      </TBtn>

                      <TDivider />

                      <TBtn onClick={() => editor?.chain().focus().toggleBlockquote().run()} active={editor?.isActive('blockquote')} title="Blockquote">
                        <Quote size={13} />
                      </TBtn>

                      <TDivider />

                      <TBtn onClick={() => editor?.chain().focus().setTextAlign('left').run()} active={editor?.isActive({ textAlign: 'left' })} title="Align Left">
                        <AlignLeft size={13} />
                      </TBtn>
                      <TBtn onClick={() => editor?.chain().focus().setTextAlign('center').run()} active={editor?.isActive({ textAlign: 'center' })} title="Align Center">
                        <AlignCenter size={13} />
                      </TBtn>
                      <TBtn onClick={() => editor?.chain().focus().setTextAlign('right').run()} active={editor?.isActive({ textAlign: 'right' })} title="Align Right">
                        <AlignRight size={13} />
                      </TBtn>
                      <TBtn onClick={() => editor?.chain().focus().setTextAlign('justify').run()} active={editor?.isActive({ textAlign: 'justify' })} title="Justify">
                        <AlignJustify size={13} />
                      </TBtn>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Scrollable editor body ──────────────────────────────────────── */}
        <div className="doc-editor-scroll">

          {/* Generating skeleton */}
          {isGenerating && (
            <div className="doc-generating" style={{ padding: '32px 64px' }}>
              <div className="generating-indicator">
                <span className="generating-dot" />
                <span className="generating-dot" />
                <span className="generating-dot" />
                <span className="generating-label">Writing {sectionTitle}…</span>
              </div>
              <div className="skeleton-lines">
                {[92, 87, 95, 60, 89, 91, 83, 97, 55].map((w, i) => (
                  <div key={i} className={`skeleton-line${i === 4 ? ' skeleton-gap' : ''}`} style={{ width: `${w}%` }} />
                ))}
              </div>
            </div>
          )}

          {/* TipTap editor */}
          {!isGenerating && (
            <div style={{ padding: '32px 64px' }}>
              <EditorContent editor={editor} className="tiptap-doc-editor" />
            </div>
          )}

          {/* Page footer — inside scroll so it lives below the content */}
          <div className="doc-page-footer" style={{ padding: '0 64px 24px' }}>
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
