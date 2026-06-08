import { motion, AnimatePresence } from 'framer-motion'
import { Upload, Loader2 } from 'lucide-react'

interface DropOverlayProps {
  isDragging: boolean
  isProcessing: boolean
}

export function DropOverlay({ isDragging, isProcessing }: DropOverlayProps) {
  const baseOverlay =
    'absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 pointer-events-none'

  return (
    <AnimatePresence>
      {isProcessing ? (
        <motion.div
          key="processing"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className={baseOverlay}
          style={{ background: 'rgba(15, 23, 42, 0.92)' }}
        >
          <Loader2 size={28} className="text-indigo-400 animate-spin" />
          <p className="text-slate-300 font-medium text-[14px]">Reading file…</p>
        </motion.div>
      ) : isDragging ? (
        <motion.div
          key="dragging"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className={baseOverlay}
          style={{ background: 'rgba(15, 23, 42, 0.88)' }}
        >
          {/* Dashed border inset so it doesn't bleed past the card's rounded corners */}
          <div className="absolute inset-3 rounded-xl border-2 border-dashed border-indigo-500/60" />

          <motion.div
            animate={{ y: [-4, 4, -4] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            className="relative z-10 w-16 h-16 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center"
          >
            <Upload size={26} className="text-indigo-400" />
          </motion.div>

          <div className="relative z-10 text-center">
            <p className="text-slate-100 font-semibold text-[15px]">Drop to upload</p>
            <p className="text-slate-400 text-[13px] mt-0.5">.txt · .docx</p>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
