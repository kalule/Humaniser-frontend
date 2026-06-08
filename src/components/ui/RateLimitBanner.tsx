import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Zap, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useRateLimitStore } from '../../store/rateLimitStore'

export function RateLimitBanner() {
  const { planLimit, clearPlanLimit } = useRateLimitStore()
  const [secondsLeft, setSecondsLeft] = useState(0)

  useEffect(() => {
    if (!planLimit) return
    setSecondsLeft(planLimit.retryAfterSeconds)
  }, [planLimit])

  useEffect(() => {
    if (secondsLeft <= 0) {
      if (planLimit) clearPlanLimit()
      return
    }
    const timer = setInterval(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearInterval(timer)
  }, [secondsLeft, planLimit, clearPlanLimit])

  const dismiss = useCallback(() => {
    clearPlanLimit()
    setSecondsLeft(0)
  }, [clearPlanLimit])

  return (
    <AnimatePresence>
      {planLimit && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div
            className={cn(
              'flex items-center justify-between gap-3 px-4 py-2.5 text-sm',
              planLimit.upgradeRequired
                ? 'bg-amber-500/10 border-b border-amber-500/20 text-amber-300'
                : 'bg-slate-800 border-b border-slate-700 text-slate-300',
            )}
          >
            <div className="flex items-center gap-2">
              <Zap size={14} className="shrink-0" />
              <span>
                Rate limit reached.{' '}
                {secondsLeft > 0 ? (
                  <span>
                    Try again in{' '}
                    <span className="font-semibold tabular-nums">{secondsLeft}s</span>
                  </span>
                ) : (
                  'You can try again now.'
                )}
              </span>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {planLimit.upgradeRequired && (
                <Link
                  to={planLimit.upgradeUrl}
                  className="text-xs font-semibold text-amber-400 hover:text-amber-300 underline underline-offset-2 transition-colors"
                >
                  Upgrade for more →
                </Link>
              )}
              <button
                type="button"
                onClick={dismiss}
                aria-label="Dismiss"
                className="p-1 rounded hover:bg-white/10 transition-colors text-current opacity-60 hover:opacity-100"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Countdown progress strip */}
          {secondsLeft > 0 && planLimit.retryAfterSeconds > 0 && (
            <motion.div
              className="h-0.5 bg-amber-500/40 origin-left"
              initial={{ scaleX: 1 }}
              animate={{ scaleX: secondsLeft / planLimit.retryAfterSeconds }}
              transition={{ duration: 1, ease: 'linear' }}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
