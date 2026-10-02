import client from './client'
import type {
  CheckoutResponse,
  ConfirmMockPaymentResponse,
  MockCheckoutSessionDto,
  MockPaymentOutcome,
  PaymentDto,
  PlanDefinitionDto,
  PortalResponse,
  SubscriptionStatusResponse,
  TopUpPackageDto,
} from '../types'

export const subscriptionApi = {
  getPlans: () => client.get<PlanDefinitionDto[]>('/api/v1/subscription/plans'),

  createCheckout: (planDefinitionId: string, successUrl: string, cancelUrl: string) =>
    client.post<CheckoutResponse>('/api/v1/subscription/create-checkout', {
      planDefinitionId,
      successUrl,
      cancelUrl,
    }),

  getMockSession: (sessionId: string) =>
    client.get<MockCheckoutSessionDto>(`/api/v1/subscription/mock/session/${sessionId}`),

  confirmMockPayment: (sessionId: string, outcome: MockPaymentOutcome) =>
    client.post<ConfirmMockPaymentResponse>('/api/v1/subscription/mock/confirm', {
      sessionId,
      outcome,
    }),

  getPortalUrl: () =>
    client.post<PortalResponse>('/api/v1/subscription/portal'),

  cancelSubscription: () =>
    client.post<void>('/api/v1/subscription/cancel'),

  getStatus: () =>
    client.get<SubscriptionStatusResponse>('/api/v1/subscription/status'),

  getPayments: () =>
    client.get<PaymentDto[]>('/api/v1/subscription/payments'),

  getTopUps: () =>
    client.get<TopUpPackageDto[]>('/api/v1/subscription/topups'),

  createTopUpCheckout: (topUpPackageId: string, successUrl: string, cancelUrl: string) =>
    client.post<CheckoutResponse>('/api/v1/subscription/topup-checkout', {
      topUpPackageId,
      successUrl,
      cancelUrl,
    }),
}
