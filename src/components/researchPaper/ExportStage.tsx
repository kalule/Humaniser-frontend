import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { researchPaperApi } from '../../api/researchPaper'
import { Loading, Notice, Panel } from '../literatureReview/ui'
import { btn } from '../literatureReview/styles'
import { errorMessage, type Integrity, type Paper } from '../../lib/researchPaper'

type Format = 'docx' | 'pdf' | 'ris' | 'bibtex'
const EXT: Record<Format, string> = { docx: 'docx', pdf: 'pdf', ris: 'ris', bibtex: 'bib' }

/**
 * Stage 7: Word or PDF with a title page, headings, page numbers and references in the paper's citation style, with
 * optional appendices; or the references alone as RIS or BibTeX. A paper that is not ready exports only as a marked draft.
 */
export function ExportStage({ paper }: { paper: Paper }) {
  const [integrity, setIntegrity] = useState<Integrity | null>(null)
  const [opts, setOpts] = useState({ searchLog: true, synthesis: true, aiStatement: true })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { researchPaperApi.integrity(paper.id).then(setIntegrity).catch(() => setIntegrity(null)) }, [paper.id])

  const download = async (format: Format, draft = false) => {
    setBusy(true); setError(null)
    try {
      const blob = await researchPaperApi.exportFile(paper.id, { format, draft, ...(format === 'docx' || format === 'pdf' ? opts : {}) })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${paper.title.replace(/[^\w\- ]+/g, ' ').trim().slice(0, 80) || 'Research paper'}${draft ? ' (draft)' : ''}.${EXT[format]}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) { setError(errorMessage(e, 'The file could not be created.')) } finally { setBusy(false) }
  }

  if (!integrity) return <Panel><Loading /></Panel>
  const ready = integrity.readiness.ready
  return (
    <div className="space-y-4">
      {paper.studentMode ? <Notice tone="info">Before you submit: read the whole paper, check its references against your sources, and follow your institution's rules on declaring AI use. The AI-use statement appendix lists what the studio did.</Notice> : null}
      <Panel title="Export" id="rp-export" description={ready ? 'The paper passed its check.' : 'The paper is not ready: it can be exported only as a draft, marked as not yet verified.'}>
        {!ready ? <Notice tone="warning">{integrity.readiness.reasons.join(' ') || 'Check the paper first.'}</Notice> : null}
        <fieldset className="mt-3 space-y-1.5">
          <legend className="text-[14px] font-medium text-slate-900">Appendices</legend>
          {([['searchLog', 'Search and screening log'], ['synthesis', 'Synthesis table'], ['aiStatement', 'Statement on the use of AI']] as const).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 text-[14px] text-slate-900">
              <input type="checkbox" checked={opts[k]} onChange={e => setOpts(o => ({ ...o, [k]: e.target.checked }))} /> {label}
            </label>
          ))}
        </fieldset>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={btn.primary} disabled={busy} onClick={() => void download('docx', !ready)}><Download size={16} aria-hidden /> Word{ready ? '' : ' (draft)'}</button>
          <button type="button" className={btn.secondary} disabled={busy} onClick={() => void download('pdf', !ready)}><Download size={16} aria-hidden /> PDF{ready ? '' : ' (draft)'}</button>
        </div>
      </Panel>
      <Panel title="References for your reference manager" id="rp-refs" description="The cited sources, from their stored details only.">
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn.secondary} disabled={busy} onClick={() => void download('ris')}><Download size={16} aria-hidden /> RIS</button>
          <button type="button" className={btn.secondary} disabled={busy} onClick={() => void download('bibtex')}><Download size={16} aria-hidden /> BibTeX</button>
        </div>
      </Panel>
      {error ? <Notice tone="error">{error}</Notice> : null}
    </div>
  )
}
