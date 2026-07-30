import { useState } from 'react'
import { motion } from 'framer-motion'
import { Loader2, Trash2, X } from 'lucide-react'

export default function ConfirmActionModal({ title, message, confirmLabel, onClose, onConfirm }: {
  title:        string
  message:      string
  confirmLabel: string
  onClose:      () => void
  onConfirm:    () => Promise<void>
}) {
  const [loading, setLoading] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="relative bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm p-6"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors">
          <X size={16} />
        </button>
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-50 mb-4">
          <Trash2 size={20} className="text-red-500" />
        </div>
        <h3 className="text-[17px] font-bold text-slate-900 mb-1">{title}</h3>
        <p className="text-[13px] text-slate-500 mb-5">{message}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-[13px] text-slate-500 hover:text-slate-800 border border-slate-200 rounded-xl transition-colors">
            Cancel
          </button>
          <button
            onClick={async () => { setLoading(true); await onConfirm() }}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[13px] font-semibold transition-colors disabled:opacity-60"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
