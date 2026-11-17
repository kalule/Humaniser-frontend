import { useEffect, useRef } from 'react'
import { ChevronDown, ChevronUp, ExternalLink, FolderInput, FolderPlus, Info, RotateCcw, Trash2, X, XCircle } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { ResearchDocument } from '../../types/webLibrary'
import { savedSourceOrigin, savedSourceText } from '../../lib/savedSources'
import { getPrimaryRowActions, type RowActionHandlers } from './libraryRowActions'
import { CitePopover } from './CitePopover'
import { formatLibraryDate } from '../../lib/researchLabels'

interface Props {
  doc: ResearchDocument
  /** 1-based position in the current list, for "3 of 22". */
  position: number
  total: number
  folderName?: string
  inTrash: boolean
  handlers: RowActionHandlers
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
}

/**
 * The selected saved paper, read from the saved record itself — so it works for imported and uploaded
 * papers too, not just ones found through Find Papers. Inline column on wide screens, a drawer on
 * narrow ones. Keyboard handling (arrows, Esc) lives with the list that owns the selection.
 */
export function SavedPaperPanel({ doc, position, total, folderName, inTrash, handlers, onClose, onPrev, onNext }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const { open } = getPrimaryRowActions(doc, handlers)
  const hasAbstract = savedSourceText(doc) === 'abstract'
  const origin = savedSourceOrigin(doc)
  const doi = doc.doi?.trim()

  // On a narrow screen the panel covers the list; move focus into it so keyboard users land there.
  useEffect(() => {
    if (window.matchMedia?.('(max-width: 1023px)').matches) headingRef.current?.focus()
  }, [doc.id])

  const actionBtn = 'flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40'

  return (
    <>
      <button aria-label="Close paper details" tabIndex={-1} onClick={onClose} className="fixed inset-0 z-40 bg-slate-950/30 lg:hidden" />
      <aside
        aria-labelledby="saved-paper-title"
        className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col bg-white shadow-2xl lg:static lg:z-auto lg:w-[400px] lg:max-w-none lg:shrink-0 lg:border-l lg:border-slate-200 lg:shadow-none"
      >
        <header className="flex items-center gap-1 border-b border-slate-200 px-4 py-2.5">
          <p className="flex-1 text-[12px] text-slate-600">Paper {position} of {total}</p>
          <button onClick={onPrev} disabled={!onPrev} aria-label="Previous paper" title="Previous paper (↑)" className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30"><ChevronUp size={16} /></button>
          <button onClick={onNext} disabled={!onNext} aria-label="Next paper" title="Next paper (↓)" className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30"><ChevronDown size={16} /></button>
          <button onClick={onClose} aria-label="Close paper details" title="Close (Esc)" className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"><X size={16} /></button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <div>
            <div className="mb-2 flex flex-wrap gap-1.5 text-[11px]">
              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700">{doc.docType}</span>
              <span className={cn('rounded px-1.5 py-0.5 font-medium', hasAbstract ? 'bg-green-tint text-green-text' : 'bg-slate-100 text-slate-600')}>{hasAbstract ? 'Abstract' : 'Details only'}</span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">{origin === 'search' ? 'From Find Papers' : 'Imported'}</span>
            </div>
            <h2 id="saved-paper-title" ref={headingRef} tabIndex={-1} className="text-[17px] font-semibold leading-snug text-slate-900 outline-none">{doc.title}</h2>
            <p className="mt-2 text-[13px] text-slate-700">{doc.authors.length ? doc.authors.join(', ') : 'No author recorded'}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={open.onClick} disabled={open.disabled} title={open.disabledReason} className="flex items-center gap-1.5 rounded-lg bg-purple-accent px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-purple-deep disabled:opacity-50">
              {open.icon} {open.label}
            </button>
            <CitePopover paper={doc} />
            <button onClick={() => handlers.onAddToCollection(doc)} className={actionBtn}><FolderPlus size={13} /> Add to collection</button>
            <button onClick={() => handlers.onMoveToFolder(doc)} className={actionBtn}><FolderInput size={13} /> Move to folder</button>
            {doc.canonicalWorkId && (
              <button onClick={() => handlers.onDetails(doc)} className={actionBtn} title="Publisher metadata, topics and PDF availability"><Info size={13} /> Full record</button>
            )}
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
            <dt className="text-slate-600">Year</dt><dd className="text-slate-900">{doc.year ?? 'Not recorded'}</dd>
            <dt className="text-slate-600">Journal</dt><dd className="text-slate-900">{doc.journal || 'Not recorded'}</dd>
            <dt className="text-slate-600">DOI</dt>
            <dd className="min-w-0 text-slate-900">
              {doi
                ? <a href={`https://doi.org/${doi}`} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 text-purple-accent hover:underline"><span className="truncate">{doi}</span><ExternalLink size={11} className="shrink-0" /></a>
                : 'Not recorded'}
            </dd>
            {doc.citationCount != null && <><dt className="text-slate-600">Cited by</dt><dd className="text-slate-900">{doc.citationCount.toLocaleString()}</dd></>}
            <dt className="text-slate-600">Source</dt><dd className="text-slate-900">{origin === 'search' ? 'Saved from Find Papers' : 'Imported or uploaded'}</dd>
            <dt className="text-slate-600">Folder</dt><dd className="text-slate-900">{folderName ?? 'No folder'}</dd>
            <dt className="text-slate-600">Added</dt><dd className="text-slate-900">{formatLibraryDate(doc.createdAt)}</dd>
            {doc.tags.length > 0 && <><dt className="text-slate-600">Tags</dt><dd className="text-slate-900">{doc.tags.join(', ')}</dd></>}
          </dl>

          <section>
            <h3 className="mb-1.5 text-[13px] font-semibold text-slate-900">Abstract</h3>
            {hasAbstract
              ? <p className="whitespace-pre-line text-[13px] leading-6 text-slate-700">{doc.abstract}</p>
              : <p className="text-[13px] text-slate-600">No abstract is saved for this paper. Writing tools can cite it, but can't draw on its content.</p>}
          </section>
        </div>

        <footer className="flex flex-wrap gap-2 border-t border-slate-200 px-5 py-3">
          {inTrash ? (
            <>
              {handlers.onRestore && <button onClick={() => handlers.onRestore!(doc)} className={actionBtn}><RotateCcw size={13} /> Restore</button>}
              {handlers.onDeleteForever && <button onClick={() => handlers.onDeleteForever!(doc)} className={cn(actionBtn, 'text-red-600 hover:bg-red-50')}><XCircle size={13} /> Delete permanently</button>}
            </>
          ) : (
            <button onClick={() => handlers.onTrash(doc)} className={cn(actionBtn, 'text-red-600 hover:bg-red-50')}><Trash2 size={13} /> Move to Trash</button>
          )}
        </footer>
      </aside>
    </>
  )
}
