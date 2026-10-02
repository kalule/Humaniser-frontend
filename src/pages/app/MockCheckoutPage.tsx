import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { AlertTriangle, Check, Loader2, ShieldOff, X } from 'lucide-react'
import { subscriptionApi } from '../../api/subscription'
import type { MockPaymentOutcome } from '../../types'

// Mock/test checkout — stands in for a real Stripe Checkout hosted page. It shows plan/price/
// interval/what the user receives, requires no card details ever, and lets the user pick a
// simulated outcome (the equivalent of choosing a Stripe test card). The backend, not this
// page, decides what actually happens — see SubscriptionController.ConfirmMockPayment.
export function MockCheckoutPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const [pendingOutcome, setPendingOutcome] = useState<MockPaymentOutcome | null>(null)

  const { data: session, isLoading, isError } = useQuery({
    queryKey: ['mock-checkout-session', sessionId],
    queryFn: () => subscriptionApi.getMockSession(sessionId!).then((r) => r.data),
    enabled: !!sessionId,
  })

  const confirmMutation = useMutation({
    mutationFn: (outcome: MockPaymentOutcome) => {
      setPendingOutcome(outcome)
      return subscriptionApi.confirmMockPayment(sessionId!, outcome).then((r) => r.data)
    },
    onSuccess: (data) => {
      const checkout = data.status === 'Succeeded' ? 'success' : data.status === 'Failed' ? 'failed' : 'cancelled'
      navigate(`/app/billing?checkout=${checkout}`, { replace: true })
    },
    onSettled: () => setPendingOutcome(null),
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--surface-page)' }}>
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-purple)' }} />
      </div>
    )
  }

  if (isError || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--surface-page)' }}>
        <div className="text-center">
          <p className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
            This checkout session could not be found.
          </p>
          <button
            type="button"
            onClick={() => navigate('/app/billing')}
            className="btn-primary text-sm"
          >
            Back to Billing
          </button>
        </div>
      </div>
    )
  }

  const isTopUp = session.purchaseType === 'TopUp'
  const { plan, topUpPackage } = session
  const alreadyResolved = session.status !== 'Pending'

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: 'var(--surface-page)' }}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md rounded-xl border p-6"
        style={{ background: 'var(--surface-card)', borderColor: 'var(--border-hairline)' }}
      >
        {/* Test-mode banner */}
        <div className="flex items-center gap-2 px-3 py-2 mb-5 rounded-lg text-xs font-medium bg-amber-50 border border-amber-200 text-amber-800">
          <AlertTriangle size={14} className="shrink-0" />
          Test payment — Stripe is not connected yet. No real charge will occur.
        </div>

        <h1 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
          {isTopUp ? 'Confirm your top-up' : 'Confirm your subscription'}
        </h1>
        <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
          Review your order below, then simulate a test payment outcome.
        </p>

        {/* Order summary */}
        <div
          className="rounded-lg border p-4 mb-5"
          style={{ borderColor: 'var(--border-hairline)', background: 'var(--surface-page)' }}
        >
          {isTopUp && topUpPackage ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{topUpPackage.name}</span>
                <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                  {topUpPackage.currency} {topUpPackage.price.toFixed(2)}
                </span>
              </div>
              <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>{topUpPackage.description}</p>
              <p className="text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                What you get — never expires
              </p>
              <ul className="space-y-1.5">
                <li className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <Check size={12} className="mt-0.5 shrink-0" style={{ color: 'var(--color-purple)' }} />
                  +{topUpPackage.wordAmount.toLocaleString()} words
                </li>
                <li className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <Check size={12} className="mt-0.5 shrink-0" style={{ color: 'var(--color-purple)' }} />
                  +{topUpPackage.creditAmount.toLocaleString()} credits
                </li>
              </ul>
            </>
          ) : plan ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{plan.name} plan</span>
                <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                  {plan.currency} {plan.price.toFixed(2)} / {plan.billingInterval === 'Annual' ? 'year' : 'month'}
                </span>
              </div>
              <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>{plan.description}</p>
              <p className="text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                What you get
              </p>
              <ul className="space-y-1.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <Check size={12} className="mt-0.5 shrink-0" style={{ color: 'var(--color-purple)' }} />
                    {f}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>

        {alreadyResolved ? (
          <div className="text-center py-3">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              This checkout session was already resolved (status: {session.status}).
            </p>
            <button type="button" onClick={() => navigate('/app/billing')} className="btn-primary text-sm mt-4">
              Back to Billing
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => confirmMutation.mutate('Succeeded')}
              disabled={confirmMutation.isPending}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white inline-flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: 'var(--color-purple)' }}
            >
              {confirmMutation.isPending && pendingOutcome === 'Succeeded' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Check size={14} />
              )}
              Simulate Successful Payment
            </button>
            <button
              type="button"
              onClick={() => confirmMutation.mutate('Failed')}
              disabled={confirmMutation.isPending}
              className="w-full py-2.5 rounded-lg text-sm font-medium border inline-flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)', background: 'var(--surface-card)' }}
            >
              {confirmMutation.isPending && pendingOutcome === 'Failed' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ShieldOff size={14} />
              )}
              Simulate Failed Payment
            </button>
            <button
              type="button"
              onClick={() => confirmMutation.mutate('Cancelled')}
              disabled={confirmMutation.isPending}
              className="w-full py-2.5 rounded-lg text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ color: 'var(--text-muted)' }}
            >
              {confirmMutation.isPending && pendingOutcome === 'Cancelled' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <X size={14} />
              )}
              Cancel
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}

export default MockCheckoutPage
