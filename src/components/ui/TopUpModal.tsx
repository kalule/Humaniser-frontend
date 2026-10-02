import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useMutation, useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { X, Zap, Loader2 } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import { subscriptionApi } from '../../api/subscription'
import { currencySymbol } from '../../lib/currency'

// One-time top-up purchase — separate from the recurring plan cards on /pricing. Adds to the
// user's rollover Bonus balance (never expires, never reset monthly) rather than changing their
// plan tier. See SubscriptionController.CreateTopUpCheckout / ITopUpService on the backend.
export function TopUpModal() {
  const { showTopUpModal, closeTopUpModal } = useUiStore()

  const { data: packages, isLoading } = useQuery({
    queryKey: ['topups'],
    queryFn: () => subscriptionApi.getTopUps().then((r) => r.data),
    enabled: showTopUpModal,
  })

  const checkoutMutation = useMutation({
    mutationFn: (topUpPackageId: string) =>
      subscriptionApi
        .createTopUpCheckout(
          topUpPackageId,
          `${window.location.origin}/app/billing?checkout=success`,
          `${window.location.origin}/app/billing?checkout=cancelled`,
        )
        .then((r) => r.data),
    onSuccess: (d) => { window.location.href = d.url },
    onError: () => toast.error('Failed to start checkout'),
  })

  if (!showTopUpModal) return null

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) closeTopUpModal()
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.97 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
        >
          <button
            type="button"
            onClick={closeTopUpModal}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>

          <div className="px-6 py-6">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-4">
              <Zap size={24} className="text-indigo-400" />
            </div>

            <h2 className="text-lg font-bold text-white mb-1">Buy a one-time top-up</h2>
            <p className="text-slate-400 text-sm mb-5">
              Extra words and credits on top of your plan — never expires, and rolls over until you use it.
            </p>

            {isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 size={20} className="animate-spin text-slate-500" />
              </div>
            ) : (
              <div className="space-y-2 mb-2">
                {(packages ?? []).map((pkg) => (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => checkoutMutation.mutate(pkg.id)}
                    disabled={checkoutMutation.isPending}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-700/60 bg-slate-800/40 hover:bg-slate-800/70 transition-colors text-left disabled:opacity-50"
                  >
                    <div>
                      <span className="text-sm font-semibold text-slate-100">{pkg.name}</span>
                      <p className="text-xs text-slate-500">
                        +{pkg.wordAmount.toLocaleString()} words · +{pkg.creditAmount.toLocaleString()} credits
                      </p>
                    </div>
                    <span className="text-sm font-bold text-white inline-flex items-center gap-2">
                      {checkoutMutation.isPending && checkoutMutation.variables === pkg.id && (
                        <Loader2 size={13} className="animate-spin" />
                      )}
                      {currencySymbol(pkg.currency)}{pkg.price.toFixed(0)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}
