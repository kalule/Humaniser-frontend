import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Loader2, UserCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { ledgerErrorMessage, screeningLedgerApi } from '../../../api/screeningLedger'
import type { ScreeningSettings, ScreeningStage } from '../../../types/screeningLedger'
import LedgerScreeningPanel from './LedgerScreeningPanel'
import { useSystematicReviewStore } from '../../../store/systematicReviewStore'

interface LedgerScreeningSectionProps {
  reviewId:  string
  stage:     ScreeningStage
  onChanged?: () => void
  /** The existing AI screening UI. In reviewer-led mode it is shown collapsed, labelled as suggestions. */
  children:  React.ReactNode
}

/**
 * Puts the reviewer screening ledger into a screening step. AI-assisted reviews (the original workflow) keep their UI and
 * get an opt-in. Reviewer-led reviews screen record by record, and the AI output is demoted to suggestions.
 */
export default function LedgerScreeningSection({ reviewId, stage, onChanged, children }: LedgerScreeningSectionProps) {
  const [settings, setSettings] = useState<ScreeningSettings | null>(null)
  const [switching, setSwitching] = useState(false)
  const [showAi, setShowAi] = useState(false)
  const loadDetail = useSystematicReviewStore(s => s.loadDetail)
  const refreshTimer = useRef<number | null>(null)

  // The workspace's step summaries come from the review detail. Refresh it after decisions, at most every few seconds,
  // so screening quickly with the keyboard does not reload the whole review on every key press.
  const changed = useCallback(() => {
    if (refreshTimer.current) window.clearTimeout(refreshTimer.current)
    refreshTimer.current = window.setTimeout(() => {
      loadDetail(reviewId).catch(() => {})
      onChanged?.()
    }, 2500)
  }, [loadDetail, reviewId, onChanged])
  useEffect(() => () => { if (refreshTimer.current) window.clearTimeout(refreshTimer.current) }, [])

  useEffect(() => {
    screeningLedgerApi.getSettings(reviewId).then(setSettings).catch(() => setSettings(null))
  }, [reviewId])

  const switchToLedger = async () => {
    setSwitching(true)
    try {
      setSettings(await screeningLedgerApi.updateSettings(reviewId, { mode: 'ReviewerLedger' }))
      toast.success('Reviewer-led screening is on. Your earlier manual decisions were copied into the record.')
      await loadDetail(reviewId).catch(() => {})
      onChanged?.()
    } catch (err) {
      toast.error(ledgerErrorMessage(err, 'Could not switch modes.'))
    } finally {
      setSwitching(false)
    }
  }

  if (!settings || settings.mode === 'AiAssisted') {
    return (
      <>
        {settings?.access === 'owner' && (
          <div className="flex items-start gap-3 border border-violet-200 bg-violet-50/50 rounded-xl px-4 py-3 mb-6">
            <UserCheck size={16} className="text-violet-600 mt-0.5 shrink-0" />
            <div className="flex-1 text-[12px] text-slate-600 leading-relaxed">
              <p className="font-semibold text-slate-800 text-[13px] mb-0.5">Reviewer-led screening</p>
              Record your own decision on each record, at each stage, with reasons and full history. Independent second reviewers
              and adjudication are supported. Unscreened records can be put in a suggested order learned from your decisions
              (ASReview active learning); the order never excludes anything, and AI verdicts stay as suggestions only.
            </div>
            <button onClick={switchToLedger} disabled={switching}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-lg disabled:opacity-60 shrink-0">
              {switching && <Loader2 size={12} className="animate-spin" />} Switch
            </button>
          </div>
        )}
        {children}
      </>
    )
  }

  return (
    <>
      <LedgerScreeningPanel reviewId={reviewId} stage={stage} onChanged={changed} />
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <button onClick={() => setShowAi(v => !v)} className="w-full flex items-center gap-2 px-4 py-3 hover:bg-slate-50/60 text-left">
          <span className="text-[13px] font-bold text-slate-800">AI suggestions</span>
          <span className="text-[11px] text-slate-400">Not screening decisions. Never counted, exported as decisions, or used to train the order.</span>
          <span className="ml-auto">{showAi ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}</span>
        </button>
        {showAi && <div className="px-4 pb-4 pt-2 border-t border-slate-100">{children}</div>}
      </div>
    </>
  )
}
