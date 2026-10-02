import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { X, Zap, RefreshCw } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import { useAuthStore } from '../../store/authStore'

export function WordLimitModal() {
  const { showWordLimitModal, wordLimitDetails, closeWordLimitModal } = useUiStore()
  const user = useAuthStore((s) => s.user)

  if (!showWordLimitModal || !wordLimitDetails) return null

  const { used, limit, resetDate } = wordLimitDetails
  const percent = Math.min(100, Math.round((used / limit) * 100))
  const resetFormatted = new Date(resetDate).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) closeWordLimitModal()
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.97 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Close */}
          <button
            type="button"
            onClick={closeWordLimitModal}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>

          {/* Header bar */}
          <div className="h-1.5 w-full bg-slate-800">
            <div
              className="h-full bg-gradient-to-r from-rose-500 to-orange-500 transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>

          <div className="px-6 py-6">
            {/* Icon */}
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center mb-4">
              <Zap size={24} className="text-rose-400" />
            </div>

            <h2 className="text-lg font-bold text-white mb-1">Monthly word limit reached</h2>
            <p className="text-slate-400 text-sm mb-5">
              You've used <span className="text-white font-semibold">{used.toLocaleString()}</span> of{' '}
              <span className="text-white font-semibold">{limit.toLocaleString()}</span> words on your{' '}
              <span className="text-indigo-400 font-semibold">{user?.plan ?? 'Free'}</span> plan.
            </p>

            {/* Reset notice */}
            <div className="flex items-center gap-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 mb-5">
              <RefreshCw size={15} className="text-slate-400 shrink-0" />
              <p className="text-slate-400 text-xs">
                Your words reset on <span className="text-white">{resetFormatted}</span>. Come back then for
                another {limit.toLocaleString()} free words.
              </p>
            </div>

            {/* Plans */}
            <div className="space-y-2 mb-5">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Upgrade to continue</p>

              {[
                { name: 'Starter', words: '50,000', price: '$10', highlight: true },
                { name: 'Professional', words: 'Unlimited', price: '$20', highlight: false },
              ].map((plan) => (
                <div
                  key={plan.name}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                    plan.highlight
                      ? 'bg-indigo-500/10 border-indigo-500/30'
                      : 'bg-slate-800/40 border-slate-700/40'
                  }`}
                >
                  <div>
                    <span
                      className={`text-sm font-semibold ${plan.highlight ? 'text-indigo-300' : 'text-slate-200'}`}
                    >
                      {plan.name}
                      {plan.highlight && (
                        <span className="ml-2 text-xs bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded-full">
                          Popular
                        </span>
                      )}
                    </span>
                    <p className="text-xs text-slate-500">{plan.words} words/month</p>
                  </div>
                  <span className="text-sm font-bold text-white">
                    {plan.price}
                    <span className="text-xs text-slate-500 font-normal">/mo</span>
                  </span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  closeWordLimitModal()
                  useUiStore.getState().openTopUpModal()
                }}
                className="block w-full text-center py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 text-white font-semibold text-sm transition-opacity"
              >
                Buy a one-time top-up
              </button>
              <Link
                to="/pricing"
                onClick={closeWordLimitModal}
                className="block w-full text-center py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800/60 font-medium text-sm transition-colors"
              >
                See all plans
              </Link>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}
