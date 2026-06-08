import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

const DISMISSED_KEY = 'announcement_v1_dismissed'

export function AnnouncementBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISSED_KEY) !== 'true') setVisible(true)
    } catch {
      setVisible(true)
    }
  }, [])

  const dismiss = () => {
    try { localStorage.setItem(DISMISSED_KEY, 'true') } catch { /* ignore */ }
    setVisible(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') dismiss()
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
          onKeyDown={handleKeyDown}
          role="banner"
        >
          <div className="bg-indigo-600 text-white text-sm text-center py-2 px-4 relative flex items-center justify-center gap-2 flex-wrap">
            <span>✨ AI Detector now live — check your human score for free</span>
            <Link
              to="/app/detector"
              className="inline-flex items-center gap-1 font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity whitespace-nowrap"
            >
              Try it free <ArrowRight size={13} />
            </Link>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss announcement"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:opacity-70 transition-opacity"
            >
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
