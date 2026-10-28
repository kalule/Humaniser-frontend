import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
import { Wand2, ShieldCheck, Zap, ChevronRight, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useUiStore } from '../../store/uiStore'
import { useAuthStore } from '../../store/authStore'

const STEPS = [
  {
    icon: Wand2,
    iconColor: 'text-indigo-400',
    iconBg: 'bg-indigo-500/10',
    title: 'Welcome to HumaniseAI',
    description:
      'HumaniseAI rewrites AI-generated text so it reads naturally — and passes tools like GPTZero, Turnitin, and Copyleaks.',
    tip: 'Used by students, writers, and professionals across South Africa.',
  },
  {
    icon: Zap,
    iconColor: 'text-purple-400',
    iconBg: 'bg-purple-500/10',
    title: 'Paste → Choose → Humanise',
    description:
      'Paste your AI text on the left. Pick a tone (Casual, Professional, Academic) and strength. Hit Humanise.',
    tip: (
      <>
        <span className="font-medium text-white">Shortcut:</span>{' '}
        <kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-xs font-mono">Ctrl</kbd>
        {' + '}
        <kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-xs font-mono">Enter</kbd>
        {' to humanise instantly.'}
      </>
    ),
  },
  {
    icon: ShieldCheck,
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/10',
    title: "You're on the Free plan",
    description:
      'You have 500 words per month — no credit card needed. Your word count resets on the 1st of every month.',
    tip: 'Need more? Starter plan starts at $10/month with 50,000 words.',
  },
]

export function OnboardingModal() {
  const { showOnboarding, dismissOnboarding } = useUiStore()
  const user = useAuthStore((s) => s.user)
  const [step, setStep] = useState(0)

  // Only show for authenticated users who haven't seen it
  if (!showOnboarding || !user) return null

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1
  const Icon = current.icon

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="onboarding-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        onClick={(e) => {
          if (e.target === e.currentTarget) dismissOnboarding()
        }}
      >
        <motion.div
          key={`onboarding-step-${step}`}
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.97 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Close */}
          <button
            type="button"
            onClick={dismissOnboarding}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close onboarding"
          >
            <X size={16} />
          </button>

          {/* Step indicator */}
          <div className="flex items-center gap-1.5 px-6 pt-6 pb-0">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1 rounded-full transition-all duration-300',
                  i <= step ? 'bg-indigo-500' : 'bg-slate-700',
                  i === step ? 'flex-[2]' : 'flex-1',
                )}
              />
            ))}
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            <div
              className={cn(
                'w-14 h-14 rounded-2xl flex items-center justify-center mb-5',
                current.iconBg,
              )}
            >
              <Icon size={28} className={current.iconColor} />
            </div>

            <h2 className="text-xl font-bold text-white mb-3">{current.title}</h2>
            <p className="text-slate-300 text-sm leading-relaxed mb-4">{current.description}</p>

            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3">
              <p className="text-slate-400 text-xs leading-relaxed">{current.tip}</p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 flex items-center justify-between">
            <button
              type="button"
              onClick={dismissOnboarding}
              className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              Skip
            </button>

            <button
              type="button"
              onClick={() => {
                if (isLast) {
                  dismissOnboarding()
                } else {
                  setStep((s) => s + 1)
                }
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
            >
              {isLast ? "Let's go" : 'Next'}
              {!isLast && <ChevronRight size={16} />}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}
