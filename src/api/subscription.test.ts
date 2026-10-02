import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  get: vi.fn(() => Promise.resolve({ data: {} })),
  post: vi.fn(() => Promise.resolve({ data: {} })),
}))

vi.mock('./client', () => ({
  default: { get: mocks.get, post: mocks.post },
}))

// Confirms the frontend hits the real backend routes with the plan-based checkout contract
// (planDefinitionId, never a hardcoded/raw priceId) — this is the seam that broke silently
// before (the old client called "/subscription/checkout", the backend only ever exposed
// "/subscription/create-checkout"), so pinning the exact paths here catches that class of
// drift without needing a live backend.
describe('subscriptionApi', () => {
  it('getPlans hits the public plans endpoint', async () => {
    const { subscriptionApi } = await import('./subscription')
    await subscriptionApi.getPlans()
    expect(mocks.get).toHaveBeenCalledWith('/api/v1/subscription/plans')
  })

  it('createCheckout posts planDefinitionId, not a raw price string', async () => {
    const { subscriptionApi } = await import('./subscription')
    await subscriptionApi.createCheckout('plan-123', 'https://a.test/success', 'https://a.test/cancel')
    expect(mocks.post).toHaveBeenCalledWith('/api/v1/subscription/create-checkout', {
      planDefinitionId: 'plan-123',
      successUrl: 'https://a.test/success',
      cancelUrl: 'https://a.test/cancel',
    })
  })

  it('confirmMockPayment posts the chosen outcome for the given session', async () => {
    const { subscriptionApi } = await import('./subscription')
    await subscriptionApi.confirmMockPayment('mock_sess_1', 'Succeeded')
    expect(mocks.post).toHaveBeenCalledWith('/api/v1/subscription/mock/confirm', {
      sessionId: 'mock_sess_1',
      outcome: 'Succeeded',
    })
  })

  it('cancelSubscription and getPayments hit their respective routes', async () => {
    const { subscriptionApi } = await import('./subscription')
    await subscriptionApi.cancelSubscription()
    expect(mocks.post).toHaveBeenCalledWith('/api/v1/subscription/cancel')

    await subscriptionApi.getPayments()
    expect(mocks.get).toHaveBeenCalledWith('/api/v1/subscription/payments')
  })

  it('getTopUps hits the public topups endpoint', async () => {
    const { subscriptionApi } = await import('./subscription')
    await subscriptionApi.getTopUps()
    expect(mocks.get).toHaveBeenCalledWith('/api/v1/subscription/topups')
  })

  it('createTopUpCheckout posts topUpPackageId, not a raw price string', async () => {
    const { subscriptionApi } = await import('./subscription')
    await subscriptionApi.createTopUpCheckout('pkg-1', 'https://a.test/success', 'https://a.test/cancel')
    expect(mocks.post).toHaveBeenCalledWith('/api/v1/subscription/topup-checkout', {
      topUpPackageId: 'pkg-1',
      successUrl: 'https://a.test/success',
      cancelUrl: 'https://a.test/cancel',
    })
  })
})
