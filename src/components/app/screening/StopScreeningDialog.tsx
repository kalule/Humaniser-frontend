import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Modal } from '../../ui/Modal'
import { ledgerErrorMessage, screeningLedgerApi } from '../../../api/screeningLedger'
import type { ScreeningProgress, ScreeningStage } from '../../../types/screeningLedger'

interface StopScreeningDialogProps {
  reviewId:  string
  stage:     ScreeningStage
  progress:  ScreeningProgress
  onClose:   () => void
  onStopped: () => void
}

const inputClass = 'w-full px-3 py-1.5 border border-slate-200 rounded-lg text-[13px] outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100'

/**
 * Records a decision to stop screening a stage. Nothing is relabelled: records not yet screened stay unscreened, and the
 * record says so in every export and in the methods text.
 */
export default function StopScreeningDialog({ reviewId, stage, progress, onClose, onStopped }: StopScreeningDialogProps) {
  const [reason, setReason] = useState('')
  const [rule, setRule] = useState('')
  const [sampleSize, setSampleSize] = useState('')
  const [sampleRelevant, setSampleRelevant] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!reason.trim()) { setError('Say why screening is being stopped.'); return }
    const size = sampleSize.trim() ? Number(sampleSize) : null
    const found = sampleRelevant.trim() ? Number(sampleRelevant) : null
    if ((size !== null && (!Number.isInteger(size) || size < 0)) || (found !== null && (!Number.isInteger(found) || found < 0 || size === null || found > size))) {
      setError('The validation sample figures do not add up.')
      return
    }
    setSaving(true)
    try {
      await screeningLedgerApi.stop(reviewId, {
        stage, reason: reason.trim(), stoppingRule: rule.trim() || null, validationNote: note.trim() || null,
        validationSampleSize: size, validationRelevantFound: found,
      })
      onStopped()
    } catch (err) {
      setError(ledgerErrorMessage(err, 'Could not record the stopping decision.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={`Stop ${stage === 'FullText' ? 'full-text' : 'title and abstract'} screening`} size="lg">
      <div className="space-y-3 text-[13px] text-slate-700">
        <p className="bg-amber-tint text-amber-text border border-amber-200 rounded-lg px-3 py-2 text-[12px]">
          {progress.unscreened} records have not been screened{progress.unresolved ? `, ${progress.unresolved} are unresolved` : ''}
          {progress.conflicts ? ` and ${progress.conflicts} disagreements are not adjudicated` : ''}. They will stay exactly as they are:
          not excluded, and listed as unscreened in every export. How many relevant records remain among them is not known.
        </p>
        <label className="block">
          <span className="text-[12px] font-semibold text-slate-600">Why are you stopping? (required)</span>
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} className={inputClass} />
        </label>
        <label className="block">
          <span className="text-[12px] font-semibold text-slate-600">Stopping rule or protocol clause relied on</span>
          <input value={rule} onChange={e => setRule(e.target.value)} placeholder="e.g. Protocol §4.2: stop after 100 consecutive irrelevant records and a validation sample" className={inputClass} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[12px] font-semibold text-slate-600">Validation sample screened (records)</span>
            <input value={sampleSize} onChange={e => setSampleSize(e.target.value)} inputMode="numeric" className={inputClass} />
          </label>
          <label className="block">
            <span className="text-[12px] font-semibold text-slate-600">Relevant records found in it</span>
            <input value={sampleRelevant} onChange={e => setSampleRelevant(e.target.value)} inputMode="numeric" className={inputClass} />
          </label>
        </div>
        <label className="block">
          <span className="text-[12px] font-semibold text-slate-600">Validation or audit notes</span>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} className={inputClass} />
        </label>
        {error && <p className="text-[12px] text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-3 py-1.5 text-[12px] text-slate-600 hover:text-slate-800">Cancel</button>
          <button onClick={submit} disabled={saving} className="flex items-center gap-1.5 px-4 py-1.5 text-[12px] font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-lg disabled:opacity-60">
            {saving && <Loader2 size={12} className="animate-spin" />} Record stopping decision
          </button>
        </div>
      </div>
    </Modal>
  )
}
