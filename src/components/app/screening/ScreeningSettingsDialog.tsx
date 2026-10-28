import { useEffect, useState } from 'react'
import { Loader2, Trash2, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '../../../lib/utils'
import { Modal } from '../../ui/Modal'
import { ledgerErrorMessage, screeningLedgerApi } from '../../../api/screeningLedger'
import type { ReviewMemberRole, ScreeningSettings } from '../../../types/screeningLedger'

interface ScreeningSettingsDialogProps {
  reviewId:  string
  onClose:   () => void
  onChanged: () => void
}

/** Owner-only: who screens, and whether each record needs one or two independent decisions. */
export default function ScreeningSettingsDialog({ reviewId, onClose, onChanged }: ScreeningSettingsDialogProps) {
  const [settings, setSettings] = useState<ScreeningSettings | null>(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<ReviewMemberRole>('Reviewer')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    screeningLedgerApi.getSettings(reviewId).then(setSettings).catch(err => toast.error(ledgerErrorMessage(err, 'Could not load settings.')))
  }, [reviewId])

  const apply = async (action: () => Promise<ScreeningSettings>, ok?: string) => {
    setBusy(true)
    try {
      setSettings(await action())
      if (ok) toast.success(ok)
      onChanged()
    } catch (err) {
      toast.error(ledgerErrorMessage(err, 'That change could not be saved.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} title="Screening settings" size="lg">
      {!settings ? <Loader2 size={16} className="animate-spin text-slate-400" /> : (
        <div className="space-y-5 text-[13px] text-slate-700">
          <section>
            <p className="text-[12px] font-semibold text-slate-600 mb-1.5">Independent reviewers per record</p>
            <div className="flex p-0.5 bg-slate-100 rounded-lg border border-slate-200 w-fit">
              {[1, 2].map(n => (
                <button key={n} disabled={busy} onClick={() => apply(() => screeningLedgerApi.updateSettings(reviewId, { requiredReviewers: n }))}
                  className={cn('px-3 py-1 text-[12px] font-medium rounded-md', settings.requiredReviewers === n ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500')}>
                  {n === 1 ? 'One reviewer' : 'Two, independently'}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              With two, each reviewer decides without seeing the other's decision; disagreements go to the owner or an adjudicator.
              Only agreed or adjudicated decisions train the prioritised order.
            </p>
          </section>

          <section>
            <p className="text-[12px] font-semibold text-slate-600 mb-1.5">Reviewers</p>
            <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg mb-2">
              <li className="px-3 py-2 text-[12px] text-slate-500">You (owner) — screen and adjudicate</li>
              {settings.members.map(m => (
                <li key={m.userId} className="px-3 py-2 flex items-center gap-2 text-[12px]">
                  <span className="flex-1">{m.name ? `${m.name} · ` : ''}{m.email}</span>
                  <span className="text-slate-500">{m.role === 'Adjudicator' ? 'Screens and adjudicates' : 'Screens'}</span>
                  <button disabled={busy} onClick={() => apply(() => screeningLedgerApi.removeMember(reviewId, m.userId), 'Removed. Their decisions stay in the record.')}
                    className="p-1 text-slate-400 hover:text-red-600" aria-label={`Remove ${m.email}`}><Trash2 size={13} /></button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Reviewer's account email"
                className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-[13px] outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
              <select value={role} onChange={e => setRole(e.target.value as ReviewMemberRole)} className="px-2 py-1.5 border border-slate-200 rounded-lg text-[12px]">
                <option value="Reviewer">Screens</option>
                <option value="Adjudicator">Screens and adjudicates</option>
              </select>
              <button disabled={busy || !email.trim()} onClick={() => apply(() => screeningLedgerApi.addMember(reviewId, email.trim(), role), 'Reviewer added').then(() => setEmail(''))}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-lg disabled:opacity-60">
                <UserPlus size={13} /> Add
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">Members can screen only. They open the review from "Shared with me for screening".</p>
          </section>

          <section className="border-t border-slate-100 pt-4">
            <p className="text-[12px] font-semibold text-slate-600 mb-1">Who decides inclusion</p>
            <p className="text-[11px] text-slate-500 mb-2">
              {settings.mode === 'ReviewerLedger'
                ? 'Reviewer-led: reviewers\' recorded decisions decide what goes to full text and into extraction, appraisal and the manuscript. AI verdicts are suggestions only.'
                : 'AI-assisted: AI verdicts with manual overrides decide inclusion (the original workflow).'}
            </p>
            <button disabled={busy} onClick={() => apply(() => screeningLedgerApi.updateSettings(reviewId, { mode: settings.mode === 'ReviewerLedger' ? 'AiAssisted' : 'ReviewerLedger' }))}
              className="px-3 py-1.5 text-[12px] font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
              {settings.mode === 'ReviewerLedger' ? 'Switch back to AI-assisted inclusion' : 'Switch to reviewer-led screening'}
            </button>
          </section>
        </div>
      )}
    </Modal>
  )
}
