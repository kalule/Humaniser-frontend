import client from './client'
import type { CheckoutResponse, PortalResponse, SubscriptionDto } from '../types'

export const subscriptionApi = {
  createCheckout: (priceId: string, successUrl: string, cancelUrl: string) =>
    client.post<CheckoutResponse>('/api/v1/subscription/checkout', {
      priceId,
      successUrl,
      cancelUrl,
    }),

  getPortalUrl: () =>
    client.post<PortalResponse>('/api/v1/subscription/portal'),

  getStatus: () =>
    client.get<SubscriptionDto>('/api/v1/subscription/status'),
}
