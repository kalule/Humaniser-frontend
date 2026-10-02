import { useEffect, useState } from 'react'
import { ArrowLeft, Download, Loader2 } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { researchLibraryApi } from '../../api/researchLibrary'
import { PdfDocumentViewer } from '../../components/pdf/PdfDocumentViewer'

export default function WebLibraryPdfViewerPage() {
  const { workId = '' } = useParams()
  const navigate = useNavigate()
  const [blob, setBlob] = useState<Blob | null>(null)
  const [title, setTitle] = useState('Paper')
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    void Promise.all([researchLibraryApi.getPaper(workId), researchLibraryApi.getPdfBlob(workId, controller.signal)])
      .then(([paper, pdf]) => { setTitle(paper.title); setBlob(pdf); void researchLibraryApi.recordAccess(workId) })
      .catch(() => { if (!controller.signal.aborted) setError('The PDF is unavailable or could not be loaded.') })
    return () => controller.abort()
  }, [workId])
  const download = () => { if (!blob) return; const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${title.replace(/[^a-z0-9._-]+/gi, '-').slice(0, 100) || 'paper'}.pdf`; a.click(); URL.revokeObjectURL(url) }
  return <div className="flex h-full min-h-0 flex-col bg-white"><header className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-4 py-3"><button onClick={() => navigate(-1)} className="rounded-lg p-2 hover:bg-slate-100" aria-label="Back"><ArrowLeft size={18} /></button><h1 className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{title}</h1>{blob && <button onClick={download} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"><Download size={14} />Download</button>}</header><main className="min-h-0 flex-1">{!blob && !error && <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-violet-600" /></div>}{error && <div className="p-10 text-center text-sm text-red-600">{error}</div>}{blob && <PdfDocumentViewer file={blob} title={title} />}</main></div>
}
