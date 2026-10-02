import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

const DISMISSED_KEY = 'announcement_v3_dismissed'

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
          <div className="bg-[#ede9fe] border-b border-violet-200 text-[#5b21b6] text-sm text-center py-2.5 px-4 relative flex items-center justify-center gap-2 flex-wrap">
            <span>✨ Five focused AI writing tools, one clean workspace</span>
            <Link
              to="/features"
              className="inline-flex items-center gap-1 font-semibold text-[#4c1d95] underline underline-offset-2 hover:text-[#1a1a18] transition-colors whitespace-nowrap"
            >
              Explore all tools <ArrowRight size={13} />
            </Link>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss announcement"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#7c3aed] hover:text-[#4c1d95] transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
