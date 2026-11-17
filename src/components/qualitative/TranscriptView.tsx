import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { errorMessage, qualApi, type QualAvailability, type QualStudy, type QualTranscript } from '../../api/qualitativeAnalysis'
import { Skeleton } from '../ui/Skeleton'
import { useConfirm } from '../ui/ConfirmDialog'
import { CodingPanel } from './CodingPanel'
import { ReviewPanel } from './ReviewPanel'
import { DangerButton, Notice } from './ui'

/** One transcript: the de-identification review until it is confirmed, then the coding screen. */
export function TranscriptView({ studyId, transcriptId, features }: { studyId: string; transcriptId: string; features: QualAvailability }) {
  const navigate = useNavigate()
  const [study, setStudy] = useState<QualStudy | null>(null)
  const [transcript, setTranscript] = useState<QualTranscript | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const { confirm: ask, dialog } = useConfirm()

  const load = () => {
    setFailed(null)
    Promise.all([qualApi.getStudy(studyId), qualApi.getTranscript(transcriptId)])
      .then(([s, t]) => { setStudy(s); setTranscript(t) })
      .catch(e => setFailed(errorMessage(e, 'This transcript could not be loaded.')))
  }
  useEffect(load, [studyId, transcriptId])

  const remove = async () => {
    if (!transcript) return
    if (!(await ask({ title: `Delete “${transcript.label}”?`, message: 'Everything coded in it is deleted too. This cannot be undone.', confirmLabel: 'Delete transcript', tone: 'danger' }))) return
    setDeleting(true)
    try { await qualApi.deleteTranscript(transcript.id); navigate(`/app/qualitative-analysis/${studyId}`) }
    catch (e) { setFailed(errorMessage(e, 'The transcript could not be deleted.')); setDeleting(false) }
  }

  if (failed) return <Notice tone="error">{failed} <Link to={`/app/qualitative-analysis/${studyId}`} className="font-semibold underline">Back to the study</Link></Notice>
  if (!study || !transcript) return <Skeleton lines={8} tone="light" />

  return (
    <>
      {dialog}
      <nav aria-label="Breadcrumb" className="text-[13px] text-slate-700">
        <Link to="/app/qualitative-analysis" className="underline">Studies</Link> / <Link to={`/app/qualitative-analysis/${studyId}`} className="underline">{study.title}</Link> / <span>{transcript.label}</span>
      </nav>
      <div className="mt-1 flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-[20px] font-semibold text-slate-900 [overflow-wrap:anywhere]">{transcript.label}</h2>
        {study.myRole === 'Owner' && <DangerButton onClick={remove} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete transcript'}</DangerButton>}
      </div>
      {transcript.status === 'Ready'
        ? <CodingPanel study={study} transcript={transcript} features={features} onTranscriptChange={setTranscript} />
        : <ReviewPanel transcriptId={transcript.id} onConfirmed={load} />}
    </>
  )
}
