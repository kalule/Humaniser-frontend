import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Editor } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'
import { closeHistory } from '@tiptap/pm/history'
import type { Transaction } from '@tiptap/pm/state'
import { AlertCircle, ArrowLeftRight, Bookmark, Check, ExternalLink, Pencil, Scissors, Trash2, X, Loader2 } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { citationApi } from '../../api/citation'
import { useCitationStore } from '../../store/citationStore'
import { useWebLibraryStore } from '../../store/webLibraryStore'
import type { FormatStyle, SaveCitationRequest } from '../../types/citation'
import { citationItems, sourceFromCitation, refreshCitationLabels, replaceCitationItems, updateSharedSource, linkSavedSource, type CitationAttrs, type CitationItem, type EditorSource } from '../../lib/editorCitations'
import { citationPopoverContentHeight, citationPopoverPosition, safeSourceUrl } from '../../lib/citationPopover'
import { saveCitationToLibrary } from '../../lib/citationLibrarySave'

const PANEL_WIDTH = 448
const actionClass = 'inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-violet-50 hover:text-violet-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500 disabled:cursor-not-allowed disabled:opacity-40'
const fieldClass = 'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500'

function savePayload(source: EditorSource): SaveCitationRequest {
  return {
    itemType: source.itemType || 'other', title: source.title,
    authors: source.authorDetails?.map(a => ({ firstName: a.given || '', middleInitial: '', lastName: a.family || a.name || '' })) ?? (source.authors || '').split(';').filter(Boolean).map(name => {
      const parts = name.trim().split(/\s+/); return { firstName: parts.slice(0, -1).join(' '), middleInitial: '', lastName: parts.at(-1) || '' }
    }),
    publicationYear: source.year ?? null, journalName: source.itemType?.toLowerCase().includes('book') ? null : source.venue ?? null,
    volume: source.volume ?? null, issue: source.issue ?? null, pages: source.pages ?? null,
    doi: source.doi ?? null, url: source.url ?? null, publisher: source.itemType?.toLowerCase().includes('book') ? source.venue ?? null : null,
    cachedApa7: null, cachedHarvard: null, cachedIeee: null, cachedMla: null, cachedChicago: null, cachedVancouver: null,
  }
}

function SourceEditor({ item, onApply, onCancel }: { item: CitationItem; onApply: (source: EditorSource, locator: string) => Promise<void>; onCancel: () => void }) {
  const [source, setSource] = useState<EditorSource>(item.source ?? { id: item.sourceId, title: '' })
  const [locator, setLocator] = useState(item.locator ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return <form className="space-y-3 rounded-xl border border-violet-100 bg-violet-50/40 p-4" onSubmit={async event => {
    event.preventDefault(); setBusy(true); setError('')
    try { await onApply({ ...source, rawReference: undefined }, locator); onCancel() }
    catch { setError('Could not save source changes. Your edits are still here. Try again.') }
    finally { setBusy(false) }
  }}>
    <h3 className="text-sm font-semibold text-slate-900">Edit citation</h3>
    <label className="block text-xs font-medium text-slate-600">Page or locator · this occurrence only<input autoFocus className={fieldClass} value={locator} placeholder="e.g. p. 24 or pp. 24–26" onChange={e => setLocator(e.target.value)} /></label>
    <fieldset className="space-y-3 border-t border-violet-100 pt-3" disabled={busy}>
      <legend className="pt-3 text-xs font-semibold text-violet-700">Shared source metadata</legend>
      <p className="text-xs leading-5 text-slate-500">Updates every occurrence and bibliography entry for this source in this document{source.libraryId ? ', and the saved citation in your library' : ''}.</p>
      <label className="block text-xs text-slate-600">Source type<select className={fieldClass} value={source.itemType ?? 'other'} onChange={e => setSource({ ...source, itemType: e.target.value })}>{source.itemType && !['article', 'book', 'report', 'thesis', 'website', 'other'].includes(source.itemType) && <option value={source.itemType}>{source.itemType}</option>}<option value="other">Unspecified / other</option><option value="article">Article</option><option value="book">Book</option><option value="report">Report</option><option value="thesis">Thesis</option><option value="website">Website</option></select></label>
      <label className="block text-xs text-slate-600">Title<input required className={fieldClass} value={source.title} onChange={e => setSource({ ...source, title: e.target.value })} /></label>
      <label className="block text-xs text-slate-600">Authors · separate authors with semicolons<input className={fieldClass} value={source.authors ?? ''} onChange={e => setSource({ ...source, authors: e.target.value, authorDetails: undefined })} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-slate-600">Year<input className={fieldClass} type="number" min="1" max={new Date().getFullYear() + 1} value={source.year ?? ''} onChange={e => setSource({ ...source, year: e.target.value ? Number(e.target.value) : null, yearLabel: null })} /></label>
        <label className="text-xs text-slate-600">Year suffix<input className={fieldClass} pattern="[a-z]?" maxLength={1} value={source.yearLabel?.match(/[a-z]$/)?.[0] ?? ''} onChange={e => setSource({ ...source, yearLabel: e.target.value ? `${source.year ?? 'n.d.'}${e.target.value}` : null })} /></label>
      </div>
      <label className="block text-xs text-slate-600">Journal / publisher<input className={fieldClass} value={source.venue ?? ''} onChange={e => setSource({ ...source, venue: e.target.value })} /></label>
      <label className="block text-xs text-slate-600">DOI<input className={fieldClass} value={source.doi ?? ''} onChange={e => setSource({ ...source, doi: e.target.value })} /></label>
      <label className="block text-xs text-slate-600">Source URL<input className={fieldClass} value={source.url ?? ''} onChange={e => setSource({ ...source, url: e.target.value })} /></label>
    </fieldset>
    {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    <div className="flex justify-end gap-2"><button type="button" className={actionClass} onClick={onCancel} disabled={busy}>Cancel</button><button type="submit" disabled={busy} className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50">{busy ? 'Saving…' : 'Apply changes'}</button></div>
  </form>
}

export function EssayCitationPopover({ editor, style }: { editor: Editor | null; style: FormatStyle }) {
  const [active, setActive] = useState<{ id: string; pos: number; attrs: CitationAttrs } | null>(null)
  const [position, setPosition] = useState({ left: 8, top: 8, maxHeight: 500 })
  const [editing, setEditing] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string[]>([])
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const panel = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const sourceList = useRef<HTMLDivElement>(null)
  const header = useRef<HTMLElement>(null)
  const footer = useRef<HTMLElement>(null)
  const activeRef = useRef(active); activeRef.current = active
  const pendingSaves = useRef(new Set<string>())
  const { citations, isLoading, setCitations } = useCitationStore()
  const webDocuments = useWebLibraryStore(s => s.documents)

  const close = useCallback((restore = true) => {
    const current = activeRef.current
    setActive(null); setEditing(null); setError(null)
    if (restore && editor && current) {
      const dom = editor.view.nodeDOM(current.pos) as HTMLElement | null
      dom?.focus({ preventScroll: true })
    }
  }, [editor])

  useEffect(() => {
    if (!editor) return
    const select = () => {
      const selection = editor.state.selection
      if (selection instanceof NodeSelection && selection.node.type.name === 'citation') {
        const attrs = selection.node.attrs as CitationAttrs
        setActive({ id: attrs.occurrenceId, pos: selection.from, attrs })
        setEditing(null); setExpanded([]); setError(null)
      } else close(false)
    }
    const update = ({ transaction }: { transaction: Transaction }) => {
      if (transaction.getMeta('activateCitation') !== undefined) { select(); return }
      const current = activeRef.current
      if (!current) return
      let found = false
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'citation' && node.attrs.occurrenceId === current.id) {
          found = true; setActive({ id: current.id, pos, attrs: node.attrs as CitationAttrs })
        }
      })
      if (!found) close(false)
    }
    editor.on('selectionUpdate', select); editor.on('transaction', update)
    return () => { editor.off('selectionUpdate', select); editor.off('transaction', update) }
  }, [editor, close])

  // Escape returns focus; clicking in the document leaves its newly chosen selection intact.
  useEffect(() => {
    if (!active) return
    const outside = (event: PointerEvent) => {
      const target = event.target as HTMLElement
      if (!panel.current?.contains(target) && !target.closest('cite.essay-citation')) close(false)
    }
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() }
      if (event.key === 'Tab' && window.innerWidth < 640 && panel.current) {
        const elements = Array.from(panel.current.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input,select,textarea'))
        const first = elements[0]; const last = elements.at(-1)
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', key, true)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', key, true) }
  }, [Boolean(active), close])

  useLayoutEffect(() => {
    if (!active || !editor) return
    const positionPanel = () => {
      const current = activeRef.current
      if (!current || !panel.current) return
      const dom = editor.view.nodeDOM(current.pos) as HTMLElement | null
      if (!dom) return
      const contentHeight = citationPopoverContentHeight(header.current?.offsetHeight ?? 0, sourceList.current?.scrollHeight ?? 0, footer.current?.offsetHeight ?? 0)
      const next = citationPopoverPosition(dom.getBoundingClientRect(), window.innerWidth, window.innerHeight, contentHeight, PANEL_WIDTH)
      setPosition(previous => previous.left === next.left && previous.top === next.top && previous.maxHeight === next.maxHeight ? previous : next)
    }
    positionPanel()
    const observer = new ResizeObserver(positionPanel)
    if (panel.current) observer.observe(panel.current)
    if (sourceList.current) observer.observe(sourceList.current)
    window.addEventListener('scroll', positionPanel, true); window.addEventListener('resize', positionPanel)
    return () => { observer.disconnect(); window.removeEventListener('scroll', positionPanel, true); window.removeEventListener('resize', positionPanel) }
  }, [active?.id, editor, editing])

  useEffect(() => { if (active) panel.current?.querySelector<HTMLButtonElement>('[aria-label="Close citation details"]')?.focus({ preventScroll: true }) }, [active?.id])

  if (!active || !editor) return null
  const items = citationItems(active.attrs, citations)
  const commitItems = (next: CitationItem[], split = false) => {
    const current = activeRef.current
    if (!current) return
    editor.view.dispatch(closeHistory(replaceCitationItems(editor.state.tr, current.pos, next, style, split)))
    if (!next.length || split) { close(false); editor.view.focus() }
  }
  const applySource = async (itemIndex: number, source: EditorSource, locator: string) => {
    const occurrenceId = active.id
    if (source.libraryId) {
      const saved = await citationApi.update(source.libraryId, savePayload(source))
      useCitationStore.getState().setCitations(useCitationStore.getState().citations.map(c => c.id === saved.id ? saved : c))
    }
    const tr = updateSharedSource(editor.state.tr, source)
    tr.doc.descendants((node, pos) => {
      if (node.type.name !== 'citation' || node.attrs.occurrenceId !== occurrenceId) return
      const next = citationItems(node.attrs, citations).map((entry, index) => index === itemIndex && entry.sourceId === source.id ? { ...entry, source, locator } : entry)
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, items: next })
    })
    editor.view.dispatch(closeHistory(refreshCitationLabels(tr, style)))
  }
  const saveSource = async (item: CitationItem) => {
    if (!item.source || pendingSaves.current.has(item.sourceId)) return
    const occurrenceId = active.id
    pendingSaves.current.add(item.sourceId); setSaving(item.sourceId); setError(null)
    try {
      const saved = await saveCitationToLibrary(savePayload(item.source), item.source.libraryId, citationApi)
      if (!useCitationStore.getState().citations.some(c => c.id === saved.id)) useCitationStore.getState().addCitation(saved)
      // Update by source ID, never by the currently open card: rapid switching is safe.
      const tr = linkSavedSource(editor.state.tr, item.sourceId, saved.id)
      if (tr.docChanged) editor.view.dispatch(tr)
    } catch { if (activeRef.current?.id === occurrenceId) setError('Could not save this source. Please try Save again.') }
    finally { pendingSaves.current.delete(item.sourceId); setSaving(current => current === item.sourceId ? null : current) }
  }

  const single = items.length === 1
  const toggleNarrative = () => {
    const current = activeRef.current
    const node = current ? editor.state.doc.nodeAt(current.pos) : null
    if (!current || !node) return
    const tr = editor.state.tr.setNodeMarkup(current.pos, undefined, { ...node.attrs, narrative: !node.attrs.narrative })
    editor.view.dispatch(closeHistory(refreshCitationLabels(tr, style)))
  }
  const narrativeButton = <button type="button" className={actionClass + (active.attrs.narrative ? ' bg-violet-50 !text-violet-700' : '')} aria-pressed={Boolean(active.attrs.narrative)}
    title={active.attrs.narrative ? 'Switch back to a bracketed citation' : 'Write the author into the sentence: Author (Year)'} onClick={toggleNarrative}>
    <ArrowLeftRight size={13} />Narrative
  </button>

  return createPortal(<motion.div ref={panel} role="dialog" aria-modal={window.innerWidth < 640 ? true : undefined} aria-label="Citation details"
    className="essay-citation-popover fixed z-[80] flex w-[448px] max-w-[calc(100vw-16px)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-[0_10px_40px_rgba(15,23,42,0.16)]"
    style={{ left: position.left, top: position.top, maxHeight: position.maxHeight }}
    initial={reduceMotion ? false : { opacity: 0, y: 4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.12, ease: 'easeOut' }}>
    <button aria-label="Close citation details" className={actionClass + ' absolute right-2 top-2 z-10 !p-1.5 text-slate-400'} onClick={() => close()}><X size={15} /></button>
    <div className="min-h-0 flex-auto overflow-y-auto overscroll-contain">
    <div ref={sourceList} className="divide-y divide-slate-100">
      {items.length === 0 && <p className="p-4 pr-10 text-sm text-slate-500">This citation has no sources. Remove it and insert a source from Cite.</p>}
      {items.map((item, itemIndex) => {
        const cardKey = `${active.id}:${itemIndex}`
        const stored = item.source
        const libraryRecord = citations.find(c => c.id === stored?.libraryId || `library:${c.id}` === item.sourceId)
        const webRecord = webDocuments.find(d => d.id === stored?.documentId || (stored?.canonicalId && d.canonicalWorkId === stored.canonicalId) || (stored?.doi && d.doi?.toLowerCase() === stored.doi.toLowerCase()))
        const source = stored ?? (libraryRecord ? sourceFromCitation(libraryRecord) : undefined)
        const description = source?.abstract || source?.summary || webRecord?.abstract || webRecord?.tldr
        const descriptionLabel = source?.abstract ? 'Abstract' : 'AI-generated summary'
        const url = source ? safeSourceUrl(source.url, source.doi) : null
        const saved = Boolean(libraryRecord || webRecord)
        const isExpanded = expanded.includes(cardKey)
        const choices = citations.map(c => sourceFromCitation(c))
        editor.state.doc.descendants(node => {
          if (node.type.name === 'citationReference' && node.attrs.source && !choices.some(choice => choice.id === node.attrs.source.id)) choices.push(node.attrs.source)
        })
        const cited = source?.citationCount ?? webRecord?.citationCount
        const authors = source?.authors || source?.authorDetails?.map(a => a.name || [a.given, a.family].filter(Boolean).join(' ')).join(', ')
        const venue = source?.venue
        const year = source?.yearLabel || source?.year
        return <article key={cardKey} className="p-4">
          {editing === cardKey ? <SourceEditor key={cardKey} item={{ ...item, source }} onCancel={() => setEditing(null)} onApply={(next, locator) => applySource(itemIndex, next, locator)} /> : <>
            {source ? <>
              <div className="mb-2 flex flex-wrap items-center gap-1.5 pr-8 text-[10px] font-semibold uppercase tracking-wide">
                <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-600">{source.itemType || webRecord?.docType || 'Source'}</span>
                {cited != null && <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-600" title="Stored source metadata; retrieval year unavailable">Cited by {cited}</span>}
              </div>
              {source.rawReference && <p className="mb-2 text-xs text-amber-700">Linked bibliography entry · structured metadata unavailable. Use Edit to add source details.</p>}
              <h3 className="text-[15px] font-semibold leading-snug text-slate-900">{source.title}</h3>
              <p className="mt-1.5 text-[13px] leading-5 text-slate-600">{authors || 'Authors unavailable'}</p>
              <p className="mt-0.5 text-[13px] leading-5">{venue && <span className="font-medium text-emerald-700">{venue}</span>}{venue && year && <span className="text-slate-400"> · </span>}{year && <span className="text-slate-400">{year}</span>}{!venue && !year && <span className="text-slate-400">Publication details unavailable</span>}</p>
              {item.locator && <p className="mt-1.5 text-xs text-violet-600">This citation: {item.locator}</p>}
              {description
                ? <blockquote className="mt-3 border-l-2 border-slate-200 pl-3" title={descriptionLabel}>
                    <p id={`description-${cardKey}`} className="whitespace-pre-line text-[13px] leading-5 text-slate-500">
                      {isExpanded || description.length <= 220 ? description : `${description.slice(0, 220).trimEnd()}… `}
                      {description.length > 220 && <button className="rounded font-semibold text-slate-900 hover:underline focus-visible:outline focus-visible:outline-2" aria-expanded={isExpanded} aria-controls={`description-${cardKey}`} onClick={() => setExpanded(current => isExpanded ? current.filter(id => id !== cardKey) : [...current, cardKey])}>{isExpanded ? 'See less' : 'See more'}</button>}
                    </p>
                  </blockquote>
                : <p className="mt-3 text-xs text-slate-400">No abstract or summary stored for this source.</p>}
            </> : <div className="flex gap-3 pr-8">
              <AlertCircle size={18} className="mt-0.5 shrink-0 text-amber-500" />
              <div className="min-w-0">
                <p className="text-sm font-semibold">Source details unavailable</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{item.originalLabel || item.sourceId} was added before sources were linked to citations, so there is nothing to show yet. {choices.length > 0 ? 'Pick the matching saved source, or enter its details.' : 'Enter its details with Edit.'}</p>
                {isLoading
                  ? <p role="status" className="mt-2 flex gap-2 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" />Loading saved sources…</p>
                  : choices.length > 0 && <label className="mt-3 block text-xs text-slate-600">Link a saved source<select aria-label={`Link source for ${item.originalLabel || item.sourceId}`} className={fieldClass} value="" onChange={event => {
                    const chosen = choices.find(c => c.id === event.target.value)
                    if (chosen) commitItems(items.map((entry, index) => index === itemIndex ? { ...entry, sourceId: chosen.id, source: chosen } : entry))
                  }}><option value="">Choose the correct source…</option>{choices.map(choice => <option key={choice.id} value={choice.id}>{choice.title}</option>)}</select></label>}
                <button className="mt-2 text-xs text-violet-600 hover:underline" onClick={async () => { try { setCitations(await citationApi.getLibrary()); setError(null) } catch { setError('Could not load saved sources. Retry loading sources.') } }}>Retry loading sources</button>
              </div>
            </div>}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-1 border-t border-slate-100 pt-2">
              <div className="-ml-2 flex gap-0.5">
                <button className={actionClass} disabled={saving === item.sourceId} onClick={() => setEditing(cardKey)}><Pencil size={13} />Edit</button>
                {single && narrativeButton}
                <button className={actionClass + ' hover:!bg-red-50 hover:!text-red-600'} onClick={() => commitItems(items.filter((_entry, index) => index !== itemIndex))}><Trash2 size={13} />Remove</button>
              </div>
              <div className="-mr-2 flex gap-0.5">{url ? <a className={actionClass} href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} />View</a> : <button className={actionClass} disabled title="No valid HTTP/HTTPS URL or DOI is stored for this source"><ExternalLink size={13} />View</button>}<button className={actionClass} disabled={!source || saved || saving === item.sourceId || Boolean(source?.rawReference)} title={saved ? 'Already in your source library' : source?.rawReference ? 'Add structured source details with Edit before saving' : 'Save to your citation library'} onClick={() => void saveSource({ ...item, source })}>{saved ? <Check size={13} /> : <Bookmark size={13} />}{saved ? 'Saved' : saving === item.sourceId ? 'Saving…' : 'Save'}</button></div>
            </div>
          </>}
        </article>
      })}
    </div>
    </div>
    {error && <p role="alert" className="shrink-0 border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">{error}</p>}
    {!single && <footer ref={footer} className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-slate-50/70 px-4 py-2.5 text-xs text-slate-500"><span>{items.length} citations</span><span className="flex gap-1">{items.length > 1 && narrativeButton}{items.length > 1 && <button className={actionClass} onClick={() => commitItems(items, true)}><Scissors size={13} />Split</button>}{items.length === 0 && <button className={actionClass} onClick={() => commitItems([])}>Remove empty citation</button>}</span></footer>}
  </motion.div>, document.body)
}
