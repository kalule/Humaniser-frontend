import { useEffect, useMemo, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { ChevronLeft, ChevronRight, Loader2, Minus, Plus } from 'lucide-react'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

interface Props { file: Blob | string; title: string }

export function PdfDocumentViewer({ file, title }: Props) {
  const [pages, setPages] = useState(0)
  const [page, setPage] = useState(1)
  const [scale, setScale] = useState(1.1)
  const objectUrl = useMemo(() => typeof file === 'string' ? file : URL.createObjectURL(file), [file])

  useEffect(() => () => { if (typeof file !== 'string') URL.revokeObjectURL(objectUrl) }, [file, objectUrl])

  return (
    <section className="flex h-full min-h-0 flex-col bg-slate-100" aria-label={`PDF viewer: ${title}`}>
      <div className="flex shrink-0 items-center justify-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
        <button aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded p-1.5 hover:bg-slate-100 disabled:opacity-40"><ChevronLeft size={16} /></button>
        <span className="min-w-20 text-center text-xs text-slate-600">{page} / {pages || '—'}</span>
        <button aria-label="Next page" disabled={!pages || page >= pages} onClick={() => setPage(p => p + 1)} className="rounded p-1.5 hover:bg-slate-100 disabled:opacity-40"><ChevronRight size={16} /></button>
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <button aria-label="Zoom out" onClick={() => setScale(s => Math.max(.6, s - .15))} className="rounded p-1.5 hover:bg-slate-100"><Minus size={15} /></button>
        <span className="w-11 text-center text-xs text-slate-600">{Math.round(scale * 100)}%</span>
        <button aria-label="Zoom in" onClick={() => setScale(s => Math.min(2.5, s + .15))} className="rounded p-1.5 hover:bg-slate-100"><Plus size={15} /></button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <Document file={objectUrl} loading={<div className="flex justify-center py-20"><Loader2 className="animate-spin text-violet-600" /></div>} error={<p className="py-20 text-center text-sm text-red-600">This PDF could not be displayed.</p>} onLoadSuccess={({ numPages }) => { setPages(numPages); setPage(p => Math.min(p, numPages)) }}>
          <div className="mx-auto w-fit overflow-hidden rounded shadow-lg"><Page pageNumber={page} scale={scale} renderTextLayer renderAnnotationLayer /></div>
        </Document>
      </div>
    </section>
  )
}
