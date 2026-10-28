import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { cn } from '../../lib/utils'
import { screeningLedgerApi } from '../../api/screeningLedger'
import type { ScreeningStage, SharedReview } from '../../types/screeningLedger'
import LedgerScreeningPanel from '../../components/app/screening/LedgerScreeningPanel'

/**
 * Screening for a review someone else owns. Membership grants screening only, so this page shows just the screening
 * ledger, never the rest of the owner's workspace.
 */
export default function SharedScreeningPage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [stage, setStage] = useState<ScreeningStage>('TitleAbstract')
  const [review, setReview] = useState<SharedReview | null>(null)

  useEffect(() => {
    screeningLedgerApi.listShared().then(list => setReview(list.find(r => r.reviewId === id) ?? null)).catch(() => {})
  }, [id])

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-white">
      <div className="w-full px-6 py-6">
        <button onClick={() => navigate('/app/systematic-review')} className="flex items-center gap-1 text-[12px] text-slate-500 hover:text-slate-800 mb-3">
          <ArrowLeft size={13} /> Systematic Reviews
        </button>
        <h1 className="text-[20px] font-bold text-slate-900 mb-0.5">{review?.researchQuestion || 'Shared screening'}</h1>
        <p className="text-[12px] text-slate-500 mb-4">
          {review ? `Owned by ${review.ownerEmail}. You can ${review.role === 'Adjudicator' ? 'screen and adjudicate' : 'screen'} records.` : ''}
        </p>
        <div className="flex p-0.5 bg-slate-100 rounded-lg border border-slate-200 w-fit mb-4">
          {(['TitleAbstract', 'FullText'] as ScreeningStage[]).map(s => (
            <button key={s} onClick={() => setStage(s)}
              className={cn('px-3 py-1 text-[12px] font-medium rounded-md', stage === s ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500')}>
              {s === 'TitleAbstract' ? 'Title and abstract' : 'Full text'}
            </button>
          ))}
        </div>
        <LedgerScreeningPanel key={stage} reviewId={id} stage={stage} />
      </div>
    </div>
  )
}
