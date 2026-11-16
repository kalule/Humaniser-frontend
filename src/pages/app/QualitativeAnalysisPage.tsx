import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { qualApi, type QualAvailability } from '../../api/qualitativeAnalysis'
import { ComingSoon } from '../../components/app/ToolGate'
import { Skeleton } from '../../components/ui/Skeleton'
import { StudyList } from '../../components/qualitative/StudyList'
import { StudyWorkspace } from '../../components/qualitative/StudyWorkspace'
import { TranscriptView } from '../../components/qualitative/TranscriptView'

type Availability = 'loading' | 'on' | 'off' | 'error'

/**
 * Qualitative Analysis: import interview and focus-group transcripts, remove identifiers, code them, choose verified
 * quotes and, when switched on, review AI code suggestions. The researcher is the analyst: nothing the AI proposes
 * becomes a code until it is accepted. Three views by URL: the list of studies, one study, one transcript.
 */
export default function QualitativeAnalysisPage() {
  const { studyId, transcriptId } = useParams()
  const [availability, setAvailability] = useState<Availability>('loading')
  const [features, setFeatures] = useState<QualAvailability | null>(null)

  const check = () => {
    setAvailability('loading')
    qualApi.availability().then(a => { setFeatures(a); setAvailability(a.enabled ? 'on' : 'off') })
      // Switched off, or a backend without the feature, answers 404: that is "off", not a fault.
      .catch((e: { code?: string; response?: { status?: number } }) => setAvailability(e?.code === 'QUAL_DISABLED' || e?.response?.status === 404 ? 'off' : 'error'))
  }
  useEffect(check, [])

  if (availability === 'loading') return <Frame><Skeleton lines={6} tone="light" /></Frame>
  if (availability === 'off') return <ComingSoon tool="qualitative-analysis" />
  if (availability === 'error' || !features) {
    return (
      <Frame>
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-[14px] text-red-800">
          Qualitative Analysis could not be reached. Check your connection.{' '}
          <button type="button" onClick={check} className="font-semibold underline">Try again</button>
        </div>
      </Frame>
    )
  }

  return (
    <Frame>
      {transcriptId && studyId ? <TranscriptView key={transcriptId} studyId={studyId} transcriptId={transcriptId} features={features} />
        : studyId ? <StudyWorkspace key={studyId} studyId={studyId} features={features} />
        : <StudyList features={features} />}
    </Frame>
  )
}

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="h-full overflow-y-auto bg-white"><div className="px-4 py-6 sm:px-6 sm:py-8"><div className="mx-auto max-w-6xl">{children}</div></div></div>
}
