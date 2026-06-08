import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { X, Sparkles, ArrowRight } from 'lucide-react'
import { useRateLimitStore } from '../../store/rateLimitStore'

export function PreviewLimitModal() {
  const { previewLimitModal, hidePreviewLimitModal } = useRateLimitStore()

  return (
    <AnimatePresence>
      {previewLimitModal && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={hidePreviewLimitModal}
            aria-hidden="true"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="preview-limit-title"
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 px-4"
          >
            <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl shadow-black/50 p-6">
              {/* Close */}
              <button
                type="button"
                onClick={hidePreviewLimitModal}
                aria-label="Close"
                className="absolute right-4 top-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              >
                <X size={16} />
              </button>

              {/* Icon */}
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center mb-4">
                <Sparkles size={24} className="text-indigo-400" />
              </div>

              {/* Content */}
              <h2 id="preview-limit-title" className="text-lg font-bold text-white mb-2">
                You've used your free previews
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed mb-6">
                {previewLimitModal.message ||
                  'Sign up free for 500 words/month — no credit card required.'}
              </p>

              {/* CTAs */}
              <div className="flex flex-col gap-3">
                <Link
                  to={previewLimitModal.signUpUrl}
                  onClick={hidePreviewLimitModal}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  Create Free Account
                  <ArrowRight size={15} />
                </Link>
                <Link
                  to={previewLimitModal.upgradeUrl}
                  onClick={hidePreviewLimitModal}
                  className="flex items-center justify-center w-full py-2.5 rounded-xl text-sm text-slate-400 hover:text-white transition-colors"
                >
                  View Pricing →
                </Link>
              </div>

              <p className="text-center text-xs text-slate-600 mt-4">
                Free plan · 500 words/month · No credit card
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
