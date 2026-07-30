import { CheckCircle2, Lightbulb } from 'lucide-react'
import { Modal } from '../ui/Modal'
import type { ReviewDocumentResponse } from '../../types/workbench'

interface ReviewResultsModalProps {
  isOpen: boolean
  onClose: () => void
  result: ReviewDocumentResponse | null
}

export function ReviewResultsModal({ isOpen, onClose, result }: ReviewResultsModalProps) {
  if (!result) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="AI Review" size="md">
      <p className="text-[13px] text-slate-700 leading-relaxed mb-5">{result.overallAssessment}</p>

      {result.strengths.length > 0 && (
        <div className="mb-4">
          <h3 className="text-[12px] font-semibold text-emerald-500 mb-2">Strengths</h3>
          <ul className="space-y-1.5">
            {result.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] text-slate-700">
                <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.suggestions.length > 0 && (
        <div>
          <h3 className="text-[12px] font-semibold text-amber-500 mb-2">Suggestions</h3>
          <ul className="space-y-1.5">
            {result.suggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] text-slate-700">
                <Lightbulb size={14} className="text-amber-500 mt-0.5 shrink-0" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  )
}
