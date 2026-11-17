import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { literatureMatrixApi } from '../../api/literatureMatrix'
import { researchApi } from '../../api/research'
import { failureMessage, type HandOffResult, type Matrix, type MatrixStudy } from '../../lib/literatureMatrix'
import { Dialog, ErrorAlert, buttonClass } from './parts'

/**
 * "Use in literature review": the studies with values you checked join a project's literature in Proposal or
 * Thesis Studio, cited by that project's own formatter, with the checked values and passages as their note.
 * Nothing is written for you, and values you have not checked are not sent.
 */
export function HandOffDialog({ matrix, rows, onClose }: { matrix: Matrix; rows: MatrixStudy[]; onClose: () => void }) {
  const [projects, setProjects] = useState<{ id: string; title: string }[] | null>(null)
  const [projectId, setProjectId] = useState(matrix.researchProjectId ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<HandOffResult | null>(null)
  useEffect(() => {
    researchApi.list().then(p => setProjects(p.map(x => ({ id: x.id, title: x.title || 'Untitled project' })))).catch(() => setProjects([]))
  }, [])

  const ready = rows.filter(r => r.cells.some(c => c.verified && c.value !== null))
  const send = async () => {
    setBusy(true)
    setError(null)
    try { setResult(await literatureMatrixApi.handOff(matrix.id, projectId, rows.map(r => r.id))) } catch (e) { setError(failureMessage(e, 'save')) } finally { setBusy(false) }
  }

  if (result) {
    return (
      <Dialog title="Sent to your project" onClose={onClose} footer={<button type="button" className={buttonClass.primary} onClick={onClose}>Done</button>}>
        <p role="status" className="text-[14px] text-slate-800">
          {result.added} added to {result.projectTitle}
          {result.alreadyInProject ? `, ${result.alreadyInProject} already there (marked as included; your own notes on them were kept)` : ''}
          {result.skippedUnverified ? `, ${result.skippedUnverified} not sent because none of their values is checked yet` : ''}.
        </p>
        <p className="mt-2 text-[13px] text-slate-700">They appear in the project's literature as sources you included. No text was written for you.</p>
        <Link to={`/app/research-agent/${result.projectId}`} className={buttonClass.link + ' mt-3 inline-block text-[14px]'}>Open the project</Link>
      </Dialog>
    )
  }

  return (
    <Dialog title="Use in literature review" onClose={onClose}
      footer={<><button type="button" className={buttonClass.secondary} onClick={onClose}>Cancel</button><button type="button" className={buttonClass.primary} disabled={busy || !projectId || ready.length === 0} onClick={send}>{busy ? 'Sending…' : `Send ${ready.length} ${ready.length === 1 ? 'study' : 'studies'}`}</button></>}>
      <div className="space-y-3 text-[14px] text-slate-800">
        <p>
          Each study joins the project's literature as a source you included, with the values you checked and the passages they came from.
          The project's own citation format is used. No paragraphs or summaries are written.
        </p>
        <p className="text-[13px]">{ready.length} of {rows.length} {rows.length === 1 ? 'study has' : 'studies have'} at least one value you checked. Only checked values are sent.</p>
        {projects === null ? <p className="text-[13px] text-slate-600">Loading your projects…</p> : projects.length === 0 ? (
          <p className="text-[13px]">You have no Proposal or Thesis Studio project yet. Create one first, then come back.</p>
        ) : (
          <label className="block text-[13px]">Project
            <select value={projectId} onChange={e => setProjectId(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-2 py-1.5 text-[14px]">
              <option value="">Choose a project</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </label>
        )}
        {error ? <ErrorAlert message={error} /> : null}
      </div>
    </Dialog>
  )
}
