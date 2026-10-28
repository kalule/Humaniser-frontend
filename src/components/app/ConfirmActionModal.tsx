import { useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Loader2, Trash2, X } from 'lucide-react'

export default function ConfirmActionModal({ title, subject, message, confirmLabel, tone = 'destructive', icon, children, onClose, onConfirm }: {
  title:        string
  /** The thing being acted on (e.g. a document's title). Shown in its own tinted box, clamped to two
   *  lines, so a long name never turns the heading into a wall of bold text. */
  subject?:     string
  message:      string
  confirmLabel: string
  /** 'destructive' (default, unchanged) for genuinely irreversible actions — red icon/button.
   *  'reversible' for actions like "Move to Trash" that can be undone — purple, matching the
   *  rest of the app's non-destructive primary actions instead of borrowing the delete-forever
   *  red for something recoverable. */
  tone?:        'destructive' | 'reversible'
  /** Overrides the default Trash2 icon — e.g. RefreshCw for a regenerate confirmation, which
   *  isn't a deletion at all. */
  icon?:        ReactNode
  /** Optional extra content between the message and the buttons — e.g. a preview of what's
   *  being replaced, or a cost note — for confirmations that need more than one line of text
   *  without forking a parallel modal component. */
  children?:    ReactNode
  onClose:      () => void
  onConfirm:    () => Promise<void>
}) {
  const [loading, setLoading] = useState(false)
  const isReversible = tone === 'reversible'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="relative bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-6"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors">
          <X size={16} />
        </button>
        <div className={isReversible ? 'flex items-center justify-center w-12 h-12 rounded-full bg-purple-tint mb-4' : 'flex items-center justify-center w-12 h-12 rounded-full bg-red-50 mb-4'}>
          {icon ?? <Trash2 size={20} className={isReversible ? 'text-purple-accent' : 'text-red-500'} />}
        </div>
        <h3 className="text-[17px] font-bold text-slate-900 mb-2">{title}</h3>
        {subject && (
          <p
            title={subject}
            className="mb-2 px-3 py-2 rounded-xl bg-purple-tint/50 border border-purple-tint text-[13px] font-medium text-purple-deep line-clamp-2 break-words"
          >
            {subject}
          </p>
        )}
        <p className={children ? 'text-[13px] text-slate-500 mb-3' : 'text-[13px] text-slate-500 mb-5'}>{message}</p>
        {children && <div className="mb-5">{children}</div>}
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-[13px] text-slate-600 hover:text-purple-deep hover:bg-purple-tint/40 hover:border-purple-tint border border-slate-200 rounded-xl transition-colors">
            Cancel
          </button>
          <button
            onClick={async () => { setLoading(true); await onConfirm() }}
            disabled={loading}
            className={
              isReversible
                ? 'flex items-center gap-2 px-5 py-2 rounded-xl bg-purple-accent hover:bg-purple-deep text-white text-[13px] font-semibold transition-colors disabled:opacity-60'
                : 'flex items-center gap-2 px-5 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[13px] font-semibold transition-colors disabled:opacity-60'
            }
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
