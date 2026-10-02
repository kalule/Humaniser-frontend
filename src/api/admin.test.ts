import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  get: vi.fn(() => Promise.resolve({ data: {} })),
  post: vi.fn(() => Promise.resolve({ data: {} })),
  put: vi.fn(() => Promise.resolve({ data: {} })),
}))

vi.mock('./client', () => ({
  default: { get: mocks.get, post: mocks.post, put: mocks.put },
}))

describe('adminApi', () => {
  it('getUsers builds the query string from provided params only', async () => {
    const { adminApi } = await import('./admin')
    await adminApi.getUsers({ page: 2, pageSize: 10, search: 'jane' })
    expect(mocks.get).toHaveBeenCalledWith('/api/v1/admin/users?page=2&pageSize=10&search=jane')
  })

  it('getUsers with no params hits the bare endpoint', async () => {
    const { adminApi } = await import('./admin')
    await adminApi.getUsers()
    expect(mocks.get).toHaveBeenCalledWith('/api/v1/admin/users')
  })

  it('updateUserRole and updateUserStatus PUT the expected bodies', async () => {
    const { adminApi } = await import('./admin')
    await adminApi.updateUserRole('u1', 'Admin')
    expect(mocks.put).toHaveBeenCalledWith('/api/v1/admin/users/u1/role', { role: 'Admin' })

    await adminApi.updateUserStatus('u1', 'Suspended')
    expect(mocks.put).toHaveBeenCalledWith('/api/v1/admin/users/u1/status', { status: 'Suspended' })
  })

  it('getSubscriptions and getPayments apply filters', async () => {
    const { adminApi } = await import('./admin')
    await adminApi.getSubscriptions({ status: 'Active', plan: 'Pro' })
    expect(mocks.get).toHaveBeenCalledWith('/api/v1/admin/subscriptions?status=Active&plan=Pro')

    await adminApi.getPayments({ status: 'Failed' })
    expect(mocks.get).toHaveBeenCalledWith('/api/v1/admin/payments?status=Failed')
  })

  it('updatePlan PUTs to the correct plan id', async () => {
    const { adminApi } = await import('./admin')
    await adminApi.updatePlan('plan-1', { price: 199 })
    expect(mocks.put).toHaveBeenCalledWith('/api/v1/admin/plans/plan-1', { price: 199 })
  })

  it('getAuditLog and getEntitlementMatrix hit their routes', async () => {
    const { adminApi } = await import('./admin')
    await adminApi.getAuditLog({ page: 1 })
    expect(mocks.get).toHaveBeenCalledWith('/api/v1/admin/audit-log?page=1')

    await adminApi.getEntitlementMatrix()
    expect(mocks.get).toHaveBeenCalledWith('/api/v1/admin/entitlements')
  })
})
