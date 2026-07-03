import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import { Node as TipTapNode, mergeAttributes } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import {
  ChevronLeft, Cloud, CloudOff, Loader2, AlignLeft, AlignCenter,
  AlignRight, AlignJustify, Bold, Italic, Underline as UnderlineIcon,
  Strikethrough, List, ListOrdered, Redo, Undo, Minus,
  Highlighter, PanelLeft, Sparkles, Wand2, CheckCircle, FilePlus,
  Quote, BookOpen, Download, Search, X, ChevronDown,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useLibraryStore } from '../../store/libraryStore'
import { useCitationStore } from '../../store/citationStore'
import { useCitation } from '../../hooks/useCitation'
import type { CitationDto, FormatStyle } from '../../types/citation'
import toast from 'react-hot-toast'

// ── Citation TipTap Node ──────────────────────────────────────────────────────

const CitationNode = TipTapNode.create({
  name: 'citation',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes() {
    return {
      citationId: { default: null },
      label:      { default: '' },
    }
  },
  parseHTML() {
    return [{ tag: 'cite[data-citation-id]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['cite', mergeAttributes({ 'data-citation-id': HTMLAttributes.citationId, style: 'color:#4f46e5;font-style:normal;' }), HTMLAttributes.label]
  },
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('cite')
      dom.setAttribute('data-citation-id', node.attrs.citationId ?? '')
      dom.setAttribute('contenteditable', 'false')
      dom.style.cssText = 'color:#4f46e5;background:#eef2ff;border-radius:3px;padding:0 4px;font-style:normal;white-space:nowrap;cursor:default;user-select:none;font-size:0.9em;'
      dom.textContent = node.attrs.label as string
      return {
        dom,
        update(updated) {
          if (updated.type.name !== 'citation') return false
          dom.textContent = updated.attrs.label as string
          return true
        },
      }
    }
  },
})

// ── Citation helpers ──────────────────────────────────────────────────────────

const FORMAT_LABELS: Record<FormatStyle, string> = {
  apa7:    'APA 7',
  harvard: 'Harvard',
  ieee:    'IEEE',
  mla:     'MLA 9',
}
const FORMAT_STYLES = Object.keys(FORMAT_LABELS) as FormatStyle[]

function inlineCiteLabel(cit: CitationDto, style: FormatStyle, orderIndex: number): string {
  const year    = cit.publicationYear ?? 'n.d.'
  const a0last  = cit.authors[0]?.lastName ?? 'Unknown'
  const a1last  = cit.authors[1]?.lastName
  const authorPart =
    cit.authors.length === 0 ? 'Unknown'
    : cit.authors.length === 1 ? a0last
    : cit.authors.length === 2 ? `${a0last} & ${a1last}`
    : `${a0last} et al.`

  switch (style) {
    case 'apa7':    return `(${authorPart}, ${year})`
    case 'harvard': return `(${authorPart}, ${year})`
    case 'mla':     return `(${a0last})`
    case 'ieee':    return `[${orderIndex + 1}]`
  }
}

function refFormatted(cit: CitationDto, style: FormatStyle): string {
  const map: Record<FormatStyle, string | null> = {
    apa7:    cit.cachedApa7,
    harvard: cit.cachedHarvard,
    ieee:    cit.cachedIeee,
    mla:     cit.cachedMla,
  }
  return map[style] ?? cit.title
}

function scanCitedIds(editorJson: any): string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  function walk(nodes: any[]) {
    for (const n of nodes ?? []) {
      if (n.type === 'citation' && n.attrs?.citationId && !seen.has(n.attrs.citationId)) {
        seen.add(n.attrs.citationId)
        ids.push(n.attrs.citationId)
      }
      if (n.content) walk(n.content)
    }
  }
  walk(editorJson?.content ?? [])
  return ids
}

function getWordCount(text: string): number {
  const t = text.trim()
  return t === '' ? 0 : t.split(/\s+/).length
}

function exportAsWord(title: string, bodyHtml: string, refs: { label: string; text: string }[]) {
  const refsHtml = refs.length === 0 ? '' : `
    <h2 style="font-size:14pt;font-weight:700;margin:2em 0 0.5em">References</h2>
    <ol style="padding-left:1.5em;font-size:11pt;line-height:1.5">
      ${refs.map(r => `<li style="margin-bottom:0.5em">${r.text}</li>`).join('')}
    </ol>`
  const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='utf-8'><title>${title}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.15; margin: 2.54cm; color: #1a1a1a; }
  h1 { font-size: 20pt; } h2 { font-size: 15pt; } h3 { font-size: 12pt; }
  cite { color: #4f46e5; font-style: normal; }
</style></head>
<body>${bodyHtml}${refsHtml}</body></html>`
  const blob = new Blob([html], { type: 'application/msword' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${title}.doc`
  a.click()
  URL.revokeObjectURL(a.href)
}

// ── Editor CSS ────────────────────────────────────────────────────────────────

const EDITOR_STYLES = `
  .tiptap-paper .ProseMirror {
    outline: none;
    min-height: 720px;
    font-size: 11pt;
    line-height: 1.15;
    font-family: 'Arial', sans-serif;
    color: #1a1a1a;
  }
  .tiptap-paper .ProseMirror p { margin: 0 0 0.5em 0; }
  .tiptap-paper .ProseMirror h1 { font-size: 20pt; font-weight: 700; margin: 0.67em 0; }
  .tiptap-paper .ProseMirror h2 { font-size: 15pt; font-weight: 700; margin: 0.83em 0; }
  .tiptap-paper .ProseMirror h3 { font-size: 12pt; font-weight: 700; margin: 1em 0; }
  .tiptap-paper .ProseMirror ul, .tiptap-paper .ProseMirror ol { padding-left: 1.5em; margin: 0.5em 0; }
  .tiptap-paper .ProseMirror li + li { margin-top: 0.25em; }
  .tiptap-paper .ProseMirror blockquote { border-left: 3px solid #ddd; padding-left: 1em; color: #555; margin: 0.5em 0; }
  .tiptap-paper .ProseMirror hr { border: none; border-top: 1px solid #ccc; margin: 1em 0; }
  .tiptap-paper .ProseMirror p.is-editor-empty:first-child::before {
    color: #aaa; content: attr(data-placeholder); float: left; height: 0; pointer-events: none;
  }
  .tiptap-paper mark { background: #ffee88; border-radius: 2px; padding: 0 1px; }
`

// ── Debounce ──────────────────────────────────────────────────────────────────

function useDebounce<T extends (...args: any[]) => void>(fn: T, ms: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  return useCallback((...args: Parameters<T>) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => fn(...args), ms)
  }, [fn, ms])
}

// ── Toolbar helpers ───────────────────────────────────────────────────────────

function TBtn({ onClick, active, disabled, title, children }: {
  onClick: () => void; active?: boolean; disabled?: boolean; title?: string; children: React.ReactNode
}) {
  return (
    <button
      onMouseDown={e => { e.preventDefault(); onClick() }}
      disabled={disabled}
      title={title}
      className={cn(
        'h-7 min-w-[28px] px-1 rounded flex items-center justify-center text-[13px] transition-colors',
        active   ? 'bg-slate-200 text-slate-900' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        disabled && 'opacity-30 cursor-not-allowed',
      )}
    >
      {children}
    </button>
  )
}
function TDivider() { return <div className="w-px h-5 bg-slate-200 mx-1 shrink-0" /> }

// ── Cite Panel (right sidebar) ────────────────────────────────────────────────

function CitePicker({
  citations, style, onInsert, onClose,
}: {
  citations:  CitationDto[]
  style:      FormatStyle
  onInsert:   (cit: CitationDto) => void
  onClose:    () => void
}) {
  const [search, setSearch] = useState('')
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return q
      ? citations.filter(c =>
          c.title.toLowerCase().includes(q) ||
          c.authors.some(a => a.lastName.toLowerCase().includes(q)) ||
          String(c.publicationYear ?? '').includes(q)
        )
      : citations
  }, [citations, search])

  return (
    <div className="w-72 shrink-0 bg-white border-l border-slate-200 flex flex-col h-full">
      {/* Header */}
      <div className="h-10 flex items-center gap-2 px-3 border-b border-slate-100 shrink-0">
        <BookOpen size={14} className="text-violet-500" />
        <span className="text-[13px] font-semibold text-slate-700 flex-1">Reference Manager</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
          <X size={14} />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-slate-100 shrink-0">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search citations…"
            className="w-full pl-7 pr-3 py-1.5 text-[12px] rounded-lg bg-slate-50 border border-slate-200 outline-none focus:border-violet-300 text-slate-700 placeholder-slate-400"
          />
        </div>
      </div>

      {/* Citation list */}
      <div className="flex-1 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-center px-4">
            <p className="text-[12px] text-slate-500">
              {citations.length === 0
                ? 'No saved citations. Add citations from the Citations tool first.'
                : 'No citations match your search.'}
            </p>
          </div>
        ) : (
          filtered.map((cit, idx) => {
            const firstAuthor = cit.authors[0]
            const authorStr = firstAuthor
              ? `${firstAuthor.lastName}${cit.authors.length > 1 ? ' et al.' : ''}`
              : 'Unknown'
            const label = inlineCiteLabel(cit, style, idx)
            return (
              <button
                key={cit.id}
                onClick={() => onInsert(cit)}
                className="w-full text-left px-3 py-2.5 hover:bg-violet-50 border-b border-slate-50 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] text-slate-800 font-medium leading-snug line-clamp-2">{cit.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{authorStr} · {cit.publicationYear ?? 'n.d.'}</p>
                    {cit.journalName && (
                      <p className="text-[11px] text-slate-400 italic truncate">{cit.journalName}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-[11px] text-violet-600 bg-violet-50 group-hover:bg-violet-100 px-1.5 py-0.5 rounded font-mono transition-colors">
                    {label}
                  </span>
                </div>
              </button>
            )
          })
        )}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-2 border-t border-slate-100 shrink-0">
        <p className="text-[10px] text-slate-400 text-center">
          Click a citation to insert it at your cursor. Add new citations from the Citations page.
        </p>
      </div>
    </div>
  )
}

// ── Main editor page ──────────────────────────────────────────────────────────

type SyncState = 'saved' | 'saving' | 'error' | 'unsaved'

export default function DocumentEditorPage() {
  const { documentId } = useParams<{ documentId: string }>()
  const navigate = useNavigate()
  const { documents, createDocument, updateDocument } = useLibraryStore()
  const { citations } = useCitationStore()
  useCitation() // ensure citations are fetched from API on editor mount

  const [syncState,      setSyncState]      = useState<SyncState>('saved')
  const [showOutline,    setShowOutline]     = useState(true)
  const [showCitePanel,  setShowCitePanel]   = useState(false)
  const [docTitle,       setDocTitle]        = useState('Untitled document')
  const [titleEditing,   setTitleEditing]    = useState(false)
  const [fileMenuOpen,   setFileMenuOpen]    = useState(false)
  const [styleMenuOpen,  setStyleMenuOpen]   = useState(false)
  const [citationStyle,  setCitationStyle]   = useState<FormatStyle>('apa7')
  const [editorVersion,  setEditorVersion]   = useState(0) // bump to re-derive citedIds

  const doc = documents.find(d => d.id === documentId)

  useEffect(() => {
    if (documentId === 'new') {
      const newDoc = createDocument({ title: 'Untitled document' })
      navigate(`/app/editor/${newDoc.id}`, { replace: true })
      return
    }
    if (!documentId) return
    if (!doc) {
      toast.error('Document not found')
      navigate('/app/library')
    } else {
      setDocTitle(doc.title)
    }
  }, [documentId, doc])

  // ── Save ──────────────────────────────────────────────────────────────────────

  const save = useCallback((content: string) => {
    if (!documentId) return
    setSyncState('saving')
    try {
      updateDocument(documentId, { content })
      setSyncState('saved')
    } catch {
      setSyncState('error')
    }
  }, [documentId, updateDocument])

  const debouncedSave = useDebounce(save, 800)

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (syncState === 'unsaved') { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [syncState])

  // ── Editor ────────────────────────────────────────────────────────────────────

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: false }),
      Placeholder.configure({ placeholder: 'Start typing your document…' }),
      CitationNode,
    ],
    content: doc?.content
      ? (() => { try { return JSON.parse(doc.content!) } catch { return doc.content } })()
      : '',
    onUpdate: ({ editor }) => {
      setSyncState('unsaved')
      debouncedSave(JSON.stringify(editor.getJSON()))
      setEditorVersion(v => v + 1)
    },
  })

  // Ctrl+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (editor) save(JSON.stringify(editor.getJSON()))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [save, editor])

  // ── Citation style → update all inline labels ─────────────────────────────────

  useEffect(() => {
    if (!editor) return
    const { tr, doc: prosedoc } = editor.state
    let changed = false
    prosedoc.descendants((node, pos) => {
      if (node.type.name === 'citation') {
        const cit = citations.find(c => c.id === node.attrs.citationId)
        if (!cit) return
        // We need the order index; scan up to find it
        const allIds = scanCitedIds(editor.getJSON())
        const idx = allIds.indexOf(node.attrs.citationId)
        const newLabel = inlineCiteLabel(cit, citationStyle, idx)
        if (newLabel !== node.attrs.label) {
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, label: newLabel })
          changed = true
        }
      }
    })
    if (changed) editor.view.dispatch(tr)
  }, [citationStyle, editor])

  // ── Derived ───────────────────────────────────────────────────────────────────

  const citedIds = useMemo(() => {
    if (!editor) return []
    return scanCitedIds(editor.getJSON())
  }, [editor, editorVersion])

  const citedRefs = useMemo(() =>
    citedIds
      .map(id => citations.find(c => c.id === id))
      .filter((c): c is CitationDto => Boolean(c)),
    [citedIds, citations]
  )

  const wordCount = useMemo(() => {
    if (!editor) return 0
    return getWordCount(editor.getText())
  }, [editor, editorVersion])

  const headings = useMemo(() => {
    if (!editor) return []
    return editor.getJSON().content?.flatMap(node => {
      if (node.type === 'heading') {
        const text = node.content?.map((c: any) => c.text ?? '').join('') ?? ''
        return [{ text, level: node.attrs?.level ?? 1 }]
      }
      return []
    }) ?? []
  }, [editor, editorVersion])

  // ── Helpers ───────────────────────────────────────────────────────────────────

  const handleNewDocument = useCallback(() => {
    if (syncState === 'unsaved' && editor) save(JSON.stringify(editor.getJSON()))
    const newDoc = createDocument({ title: 'Untitled document' })
    navigate(`/app/editor/${newDoc.id}`)
  }, [syncState, editor, save, createDocument, navigate])

  const handleTitleSave = () => {
    if (!documentId) return
    updateDocument(documentId, { title: docTitle || 'Untitled document' })
    setTitleEditing(false)
  }

  const insertCitation = useCallback((cit: CitationDto) => {
    if (!editor) return
    const allIds = scanCitedIds(editor.getJSON())
    const existingIdx = allIds.indexOf(cit.id)
    const idx = existingIdx >= 0 ? existingIdx : allIds.length
    const label = inlineCiteLabel(cit, citationStyle, idx)
    editor.chain().focus().insertContent({
      type: 'citation',
      attrs: { citationId: cit.id, label },
    }).run()
    toast.success(`Citation inserted: ${label}`)
  }, [editor, citationStyle])

  const handleExport = () => {
    if (!editor) return
    const refs = citedRefs.map((c, i) => ({
      label: inlineCiteLabel(c, citationStyle, i),
      text:  refFormatted(c, citationStyle),
    }))
    exportAsWord(docTitle, editor.getHTML(), refs)
    toast.success('Exported as Word document')
  }

  const syncDisplay: Record<SyncState, { label: string; icon: React.ReactNode; color: string }> = {
    saved:   { label: 'All changes saved', icon: <span className="w-2 h-2 rounded-full bg-emerald-400" />,                      color: 'text-emerald-400' },
    saving:  { label: 'Saving…',           icon: <Loader2 size={12} className="animate-spin text-slate-400" />,                 color: 'text-slate-400'  },
    unsaved: { label: 'Unsaved changes',   icon: <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />,          color: 'text-amber-400'  },
    error:   { label: 'Save failed',       icon: <CloudOff size={13} className="text-red-400" />,                               color: 'text-red-400'    },
  }
  const sync = syncDisplay[syncState]

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#f8f9fa]">
      <style dangerouslySetInnerHTML={{ __html: EDITOR_STYLES }} />

      {/* ── Top bar ───────────────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-white border-b border-slate-200">

        {/* Row 1: navigation + title + actions */}
        <div className="h-12 flex items-center px-4 gap-2">
          <button
            onClick={() => { if (editor && syncState === 'unsaved') save(JSON.stringify(editor.getJSON())); navigate('/app/library') }}
            title="Back to Library"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors shrink-0"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={handleNewDocument}
            title="New document"
            className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-[12px] text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors border border-slate-200 shrink-0"
          >
            <FilePlus size={13} /> New
          </button>

          {/* Title */}
          {titleEditing ? (
            <input
              autoFocus value={docTitle}
              onChange={e => setDocTitle(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') handleTitleSave() }}
              className="text-[15px] font-semibold text-slate-800 outline-none border-b border-slate-300 bg-transparent px-0.5 min-w-0 max-w-[220px]"
            />
          ) : (
            <button onClick={() => setTitleEditing(true)} className="text-[15px] font-semibold text-slate-800 hover:text-slate-900 truncate max-w-[220px]">
              {docTitle || 'Untitled document'}
            </button>
          )}

          {/* Sync */}
          <div className={cn('flex items-center gap-1 text-[12px] font-medium shrink-0', sync.color)}>
            {sync.icon} {sync.label}
          </div>

          <div className="flex-1" />

          {/* Word count */}
          <span className="text-[12px] text-slate-400 shrink-0">{wordCount.toLocaleString()} words</span>

          {/* Export */}
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-[12px] font-medium hover:bg-slate-50 transition-colors shrink-0"
          >
            <Download size={13} /> Export
          </button>

          {/* AI badges — not yet implemented for documents opened directly in the editor */}
          <button
            onClick={() => toast('AI Writer — coming soon')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/60 text-white text-[12px] font-medium cursor-not-allowed transition-colors shrink-0"
          >
            <Sparkles size={12} /> Write with AI
          </button>
          <button
            onClick={() => toast('Write On — coming soon')}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sky-500/60 text-white text-[12px] font-medium cursor-not-allowed transition-colors shrink-0"
          >
            <Wand2 size={12} /> Write On
          </button>
          <button
            onClick={() => toast('Review On — coming soon')}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-500/60 text-white text-[12px] font-medium cursor-not-allowed transition-colors shrink-0"
          >
            <CheckCircle size={12} /> Review On
          </button>
        </div>

        {/* Row 2: menu bar */}
        <div className="h-8 flex items-center px-4 gap-0.5 border-t border-slate-100">
          {/* File */}
          <div className="relative">
            <button onClick={() => setFileMenuOpen(v => !v)}
              className="h-7 px-2.5 rounded text-[12px] text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors">
              File
            </button>
            {fileMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setFileMenuOpen(false)} />
                <div className="absolute left-0 top-full mt-0.5 w-52 bg-white border border-slate-200 rounded-xl shadow-xl z-20 py-1 overflow-hidden">
                  {[
                    { label: 'New document',  shortcut: '',       action: () => { setFileMenuOpen(false); handleNewDocument() },                                                                          icon: <FilePlus size={13} /> },
                    { label: 'Save now',       shortcut: 'Ctrl+S', action: () => { setFileMenuOpen(false); if (editor) save(JSON.stringify(editor.getJSON())) },                                          icon: <Cloud size={13} /> },
                    { label: 'Export as Word', shortcut: '',       action: () => { setFileMenuOpen(false); handleExport() },                                                                               icon: <Download size={13} /> },
                    { label: 'Go to Library', shortcut: '',       action: () => { setFileMenuOpen(false); if (editor && syncState === 'unsaved') save(JSON.stringify(editor.getJSON())); navigate('/app/library') }, icon: <ChevronLeft size={13} /> },
                  ].map(({ label, shortcut, action, icon }) => (
                    <button key={label} onClick={action}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors">
                      <span className="text-slate-400">{icon}</span>
                      <span className="flex-1 text-left">{label}</span>
                      {shortcut && <span className="text-[11px] text-slate-400">{shortcut}</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {['Edit', 'View', 'Insert', 'Format', 'Tools'].map(item => (
            <button key={item} onClick={() => toast(`${item} menu — coming soon`)}
              className="h-7 px-2.5 rounded text-[12px] text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors">
              {item}
            </button>
          ))}
        </div>

        {/* Row 3: formatting toolbar */}
        {editor && (
          <div className="h-9 flex items-center px-4 gap-0.5 border-t border-slate-100 overflow-x-auto">
            <TBtn onClick={() => editor.chain().focus().undo().run()} title="Undo" disabled={!editor.can().undo()}><Undo size={14} /></TBtn>
            <TBtn onClick={() => editor.chain().focus().redo().run()} title="Redo" disabled={!editor.can().redo()}><Redo size={14} /></TBtn>
            <TDivider />

            {/* Heading style */}
            <select
              value={editor.isActive('heading', { level: 1 }) ? '1' : editor.isActive('heading', { level: 2 }) ? '2' : editor.isActive('heading', { level: 3 }) ? '3' : '0'}
              onChange={e => {
                const l = parseInt(e.target.value)
                if (l === 0) editor.chain().focus().setParagraph().run()
                else editor.chain().focus().setHeading({ level: l as 1|2|3 }).run()
              }}
              className="h-7 pl-2 pr-6 rounded text-[12px] text-slate-600 hover:bg-slate-100 outline-none border border-transparent hover:border-slate-200 appearance-none bg-white cursor-pointer"
            >
              <option value="0">Normal text</option>
              <option value="1">Heading 1</option>
              <option value="2">Heading 2</option>
              <option value="3">Heading 3</option>
            </select>
            <TDivider />

            <TBtn onClick={() => editor.chain().focus().toggleBold().run()}      active={editor.isActive('bold')}      title="Bold (Ctrl+B)"><Bold size={14} /></TBtn>
            <TBtn onClick={() => editor.chain().focus().toggleItalic().run()}    active={editor.isActive('italic')}    title="Italic (Ctrl+I)"><Italic size={14} /></TBtn>
            <TBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline (Ctrl+U)"><UnderlineIcon size={14} /></TBtn>
            <TBtn onClick={() => editor.chain().focus().toggleStrike().run()}    active={editor.isActive('strike')}    title="Strikethrough"><Strikethrough size={14} /></TBtn>
            <TBtn onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} title="Highlight"><Highlighter size={14} /></TBtn>
            <TDivider />

            <TBtn onClick={() => editor.chain().focus().setTextAlign('left').run()}    active={editor.isActive({ textAlign: 'left' })}    title="Align left"><AlignLeft size={14} /></TBtn>
            <TBtn onClick={() => editor.chain().focus().setTextAlign('center').run()}  active={editor.isActive({ textAlign: 'center' })}  title="Align center"><AlignCenter size={14} /></TBtn>
            <TBtn onClick={() => editor.chain().focus().setTextAlign('right').run()}   active={editor.isActive({ textAlign: 'right' })}   title="Align right"><AlignRight size={14} /></TBtn>
            <TBtn onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} title="Justify"><AlignJustify size={14} /></TBtn>
            <TDivider />

            <TBtn onClick={() => editor.chain().focus().toggleBulletList().run()}  active={editor.isActive('bulletList')}  title="Bullet list"><List size={14} /></TBtn>
            <TBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list"><ListOrdered size={14} /></TBtn>
            <TDivider />
            <TBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule"><Minus size={14} /></TBtn>

            <div className="ml-auto flex items-center gap-1">
              {/* Citation style selector */}
              <div className="relative">
                <button
                  onClick={() => setStyleMenuOpen(v => !v)}
                  className="flex items-center gap-1 h-7 px-2 rounded text-[12px] text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors border border-slate-200"
                >
                  {FORMAT_LABELS[citationStyle]} <ChevronDown size={11} />
                </button>
                {styleMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setStyleMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-0.5 w-32 bg-white border border-slate-200 rounded-xl shadow-xl z-20 py-1 overflow-hidden">
                      {FORMAT_STYLES.map(s => (
                        <button key={s} onClick={() => { setCitationStyle(s); setStyleMenuOpen(false) }}
                          className={cn('w-full text-left px-3 py-1.5 text-[12px] transition-colors',
                            s === citationStyle ? 'text-violet-600 bg-violet-50 font-medium' : 'text-slate-600 hover:bg-slate-50')}>
                          {FORMAT_LABELS[s]}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Cite button */}
              <button
                onClick={() => setShowCitePanel(v => !v)}
                className={cn(
                  'flex items-center gap-1 h-7 px-2.5 rounded text-[12px] font-medium transition-colors',
                  showCitePanel
                    ? 'bg-violet-600 text-white'
                    : 'text-violet-600 bg-violet-50 hover:bg-violet-100 border border-violet-200',
                )}
              >
                <Quote size={13} /> Cite
              </button>

              {/* Outline toggle */}
              <button
                onClick={() => setShowOutline(v => !v)}
                className={cn('h-7 px-2 rounded flex items-center gap-1 text-[12px] transition-colors', showOutline ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:bg-slate-100')}
              >
                <PanelLeft size={14} /> Outline
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Body: outline + canvas + cite panel ──────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Outline */}
        {showOutline && (
          <div className="hidden md:block bg-white border-r border-slate-200 overflow-y-auto py-4 px-3 w-48 shrink-0">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mb-3 px-2">Outline</p>
            {headings.length === 0 ? (
              <p className="text-[12px] text-slate-400 px-2">Add headings to create an outline.</p>
            ) : (
              <div className="space-y-0.5">
                {headings.map((h, i) => (
                  <p key={i} style={{ paddingLeft: `${(h.level - 1) * 12}px` }}
                    className="text-[12px] text-slate-600 hover:text-slate-900 py-1 px-2 rounded hover:bg-slate-100 cursor-pointer truncate transition-colors">
                    {h.text}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Scrollable paper canvas */}
        <div className="flex-1 overflow-y-auto flex flex-col items-center py-8 px-4 bg-[#f0f2f5]">
          {/* Ruler */}
          <div className="w-[816px] max-w-full h-6 bg-white border-x border-t border-slate-200 rounded-t-sm flex items-center px-24 shrink-0">
            <div className="flex-1 border-t border-slate-300 relative">
              {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map(v => (
                <span key={v} style={{ left: `${(v / 6.5) * 100}%` }}
                  className="absolute -top-3 -translate-x-1/2 text-[9px] text-slate-400 select-none">{v}</span>
              ))}
            </div>
          </div>

          {/* Paper */}
          <div
            className="tiptap-paper w-[816px] max-w-full bg-white shadow-lg border-x border-slate-200"
            style={{ padding: '96px 96px 60px' }}
          >
            <EditorContent editor={editor} />

            {/* References section — auto-generated */}
            {citedRefs.length > 0 && (
              <div className="mt-12 pt-6 border-t border-slate-200">
                <h2 className="text-[14pt] font-bold text-slate-900 mb-4">References</h2>
                <ol className="space-y-2 text-[10pt] text-slate-700 leading-relaxed list-decimal pl-5">
                  {citedRefs.map((cit, i) => (
                    <li key={cit.id} className="pl-1">
                      <span dangerouslySetInnerHTML={{ __html: refFormatted(cit, citationStyle) }} />
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>

          <div className="h-16" />
        </div>

        {/* Citation panel */}
        {showCitePanel && (
          <CitePicker
            citations={citations}
            style={citationStyle}
            onInsert={insertCitation}
            onClose={() => setShowCitePanel(false)}
          />
        )}
      </div>
    </div>
  )
}
