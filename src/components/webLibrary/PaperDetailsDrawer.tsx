import { useEffect, useRef, useState } from 'react'
import { BookOpen, Check, Copy, ExternalLink, FileText, Loader2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { researchLibraryApi } from '../../api/researchLibrary'
import type { PaperDetails } from '../../types/researchLibrary'

interface Props {
  workId: string | null
  onClose: () => void
  onOpenPdf: (paper: PaperDetails) => void
}

export function PaperDetailsDrawer({ workId, onClose, onOpenPdf }: Props) {
  const [paper, setPaper] = useState<PaperDetails | null>(null)
  const [error, setError] = useState<string | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const drawerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!workId) return
    let active = true
    setPaper(null); setError(null)
    void researchLibraryApi.getPaper(workId).then(value => { if (active) setPaper(value) }).catch(() => { if (active) setError('Paper details could not be loaded.') })
    void researchLibraryApi.recordAccess(workId).catch(() => undefined)
    return () => { active = false }
  }, [workId])

  useEffect(() => {
    if (!workId) return
    const previous = document.activeElement as HTMLElement | null
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'Tab') {
        const focusable = Array.from(drawerRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])') ?? [])
        if (focusable.length === 0) return
        const first = focusable[0]; const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', keydown)
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', keydown); previous?.focus() }
  }, [workId, onClose])

  if (!workId) return null
  const copy = async (label: string, value?: string) => { if (!value) return; await navigator.clipboard.writeText(value); toast.success(`${label} copied`) }

  return (
    <div className="fixed inset-0 z-50" role="presentation">
      <button aria-label="Close paper details" className="absolute inset-0 bg-slate-950/30" onClick={onClose} />
      <aside ref={drawerRef} role="dialog" aria-modal="true" aria-labelledby="paper-details-title" className="absolute inset-y-0 right-0 flex w-full max-w-[640px] flex-col bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div><p className="text-xs font-medium uppercase tracking-wide text-purple-accent">Research Library</p><h2 id="paper-details-title" className="text-base font-semibold text-slate-900">Paper details</h2></div>
          <button ref={closeRef} aria-label="Close" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </header>
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {!paper && !error && <div className="flex justify-center py-24"><Loader2 className="animate-spin text-purple-accent" /></div>}
          {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
          {paper && <div className="space-y-6">
            <div><div className="mb-2 flex flex-wrap gap-2">{paper.type && <span className="rounded-full bg-purple-tint px-2.5 py-1 text-xs text-purple-text">{paper.type}</span>}{paper.openAccess?.isOpenAccess && <span className="rounded-full bg-green-tint px-2.5 py-1 text-xs text-green-text"><Check size={11} className="mr-1 inline" />Open access</span>}</div><h3 className="text-xl font-semibold leading-snug text-slate-900">{paper.title}</h3>{paper.subtitle && <p className="mt-1 text-sm text-slate-600">{paper.subtitle}</p>}<p className="mt-3 text-sm text-slate-600">{paper.authors.map(a => a.name).join(', ') || 'Author information unavailable'}</p></div>
            <div className="flex flex-wrap gap-2">
              {paper.fullText.canOpenInViewer && <button onClick={() => onOpenPdf(paper)} className="flex items-center gap-2 rounded-lg bg-purple-accent px-4 py-2 text-sm font-medium text-white hover:bg-purple-deep"><BookOpen size={15} />Open PDF</button>}
              {!paper.fullText.canOpenInViewer && paper.fullText.landingPageUrl && <a href={paper.fullText.landingPageUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><ExternalLink size={15} />View source</a>}
              {!paper.fullText.canOpenInViewer && !paper.fullText.landingPageUrl && <button disabled title="No lawful full text was found" className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-400"><FileText size={15} />PDF unavailable</button>}
            </div>
            <dl className="grid grid-cols-2 gap-x-5 gap-y-4 rounded-xl border border-slate-200 p-4 text-sm">
              {paper.publicationDate && <div><dt className="text-xs text-slate-400">Published</dt><dd className="mt-1 text-slate-700">{paper.publicationDate}</dd></div>}
              {paper.source?.name && <div><dt className="text-xs text-slate-400">Source</dt><dd className="mt-1 text-slate-700">{paper.source.name}</dd></div>}
              {paper.source?.publisher && <div><dt className="text-xs text-slate-400">Publisher</dt><dd className="mt-1 text-slate-700">{paper.source.publisher}</dd></div>}
              {paper.citationCount != null && <div><dt className="text-xs text-slate-400">Citations</dt><dd className="mt-1 text-slate-700">{paper.citationCount.toLocaleString()}</dd></div>}
              {paper.source?.volume && <div><dt className="text-xs text-slate-400">Volume</dt><dd className="mt-1 text-slate-700">{paper.source.volume}</dd></div>}
              {paper.source?.issue && <div><dt className="text-xs text-slate-400">Issue</dt><dd className="mt-1 text-slate-700">{paper.source.issue}</dd></div>}
            </dl>
            {paper.abstract && <section><h4 className="mb-2 text-sm font-semibold text-slate-900">Abstract</h4><p className="whitespace-pre-line text-sm leading-6 text-slate-600">{paper.abstract}</p></section>}
            {(paper.topics.length > 0 || paper.keywords.length > 0) && <section><h4 className="mb-2 text-sm font-semibold text-slate-900">Topics and keywords</h4><div className="flex flex-wrap gap-2">{[...new Set([...paper.topics, ...paper.keywords])].map(t => <span key={t} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{t}</span>)}</div></section>}
            <section><h4 className="mb-2 text-sm font-semibold text-slate-900">Identifiers</h4><div className="space-y-2">{paper.doi && <button onClick={() => void copy('DOI', paper.doi)} className="flex max-w-full items-center gap-2 text-left text-sm text-purple-accent hover:underline"><Copy size={13} /><span className="truncate">{paper.doi}</span></button>}{paper.openAlexId && <button onClick={() => void copy('OpenAlex ID', paper.openAlexId)} className="flex max-w-full items-center gap-2 text-left text-sm text-purple-accent hover:underline"><Copy size={13} /><span className="truncate">{paper.openAlexId}</span></button>}</div></section>
          </div>}
        </div>
      </aside>
    </div>
  )
}
