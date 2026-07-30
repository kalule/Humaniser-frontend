import { useEffect, useState } from 'react'
import { useSystematicReviewStore } from '../../store/systematicReviewStore'
import type { ReviewSummary } from '../../types/systematicReview'

interface ReviewSummaryBarProps {
  reviewId: string
}

const CARDS: { key: keyof ReviewSummary; label: string }[] = [
  { key: 'retrieved', label: 'Retrieved' },
  { key: 'ready',     label: 'Ready' },
  { key: 'included',  label: 'Included' },
  { key: 'extracted', label: 'Extracted' },
  { key: 'outcomes',  label: 'Outcomes' },
]

/**
 * Review-wide progress bar — shared across every step from Full Text Screening onward
 * (Data Extraction, Risk of Bias, Evidence Grading, Write SLR), not a one-off for this step.
 */
export default function ReviewSummaryBar({ reviewId }: ReviewSummaryBarProps) {
  const getReviewSummary = useSystematicReviewStore(s => s.getReviewSummary)
  const [summary, setSummary] = useState<ReviewSummary | null>(null)

  useEffect(() => {
    let cancelled = false
    getReviewSummary(reviewId).then(res => { if (!cancelled) setSummary(res) }).catch(() => {})
    return () => { cancelled = true }
  }, [reviewId, getReviewSummary])

  return (
    <div className="grid grid-cols-5 gap-3 px-6 pt-6">
      {CARDS.map(c => (
        <div key={c.key} className="border border-slate-200 rounded-xl px-4 py-3 bg-white">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">{c.label}</p>
          <p className="text-[20px] font-bold text-slate-900">{summary ? summary[c.key] : '—'}</p>
        </div>
      ))}
    </div>
  )
}
