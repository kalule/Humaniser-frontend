import { useAuthStore } from '../store/authStore'
import { useUiStore } from '../store/uiStore'

/**
 * Client-side pre-flight check before a credit-costing action. Returns a function that, given
 * the flat cost of the action, returns true if the user has enough balance to proceed — and as a
 * side effect opens the credit-limit modal (the same one a real 402 from the server opens) when
 * they don't. This is a convenience/UX shortcut only; the server-side reservation in
 * ReserveCreditsAsync is the real gate, so a stale client-side balance can't bypass billing.
 */
export function useCreditGate() {
  const user = useAuthStore((s) => s.user)

  return function hasEnoughCredits(cost: number): boolean {
    if (!user) return true
    if (user.plan === 'Unlimited') return true
    if (user.creditsLimit + (user.bonusCredits ?? 0) - user.creditsUsed >= cost) return true

    useUiStore.getState().openCreditLimitModal({
      used: user.creditsUsed,
      limit: user.creditsLimit,
      resetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
    })
    return false
  }
}
