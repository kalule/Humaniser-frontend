import client from './client'
import type {
  AdminPayment,
  AdminPlan,
  AdminSubscription,
  AdminUserDetail,
  AdminUserListItem,
  AuditLogEntry,
  EntitlementMatrixEntry,
  PagedResult,
  Role,
  UpdatePlanRequest,
} from '../types/admin'

export interface AdminStats {
  totalUsers: number
  newUsersToday: number
  newUsersThisWeek: number
  wordsToday: number
  totalWordsThisMonth: number
  activeSubscriptions: number
  cancelledSubscriptions: number
  usersByPlan: {
    free: number
    pro: number
    unlimited: number
  }
  paymentsByStatus: { status: string; count: number }[]
  recentUsers: AdminUser[]
  signupsByDay: DayCount[]
  toneUsage: ToneCount[]
}

export interface AdminUser {
  id: string
  email: string
  plan: string
  wordsUsed: number
  createdAt: string
  isEmailVerified: boolean
  lastLoginAt?: string
}

export interface DayCount {
  date: string
  count: number
}

export interface ToneCount {
  tone: string
  count: number
}

export interface AdminUsersParams {
  page?: number
  pageSize?: number
  search?: string
  plan?: string
}

export interface AdminSubscriptionsParams {
  page?: number
  pageSize?: number
  status?: string
  plan?: string
}

export interface AdminPaymentsParams {
  page?: number
  pageSize?: number
  status?: string
  userId?: string
  from?: string
  to?: string
}

export interface AdminAuditLogParams {
  page?: number
  pageSize?: number
  adminUserId?: string
  action?: string
}

function toQueryString(params: object): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

export const adminApi = {
  getStats: () => client.get<AdminStats>('/api/v1/admin/stats'),
  getUsage: () => client.get('/api/v1/admin/usage'),

  getUsers: (params: AdminUsersParams = {}) =>
    client.get<PagedResult<AdminUserListItem>>(`/api/v1/admin/users${toQueryString(params)}`),

  getUserDetail: (id: string) => client.get<AdminUserDetail>(`/api/v1/admin/users/${id}`),

  updateUserRole: (id: string, role: Role) =>
    client.put(`/api/v1/admin/users/${id}/role`, { role }),

  updateUserStatus: (id: string, status: 'Active' | 'Suspended') =>
    client.put(`/api/v1/admin/users/${id}/status`, { status }),

  updateUserPlan: (id: string, body: { plan: string; customWordLimit?: number; customCreditLimit?: number }) =>
    client.put(`/api/v1/admin/users/${id}/plan`, body),

  resetUsage: (id: string) => client.post(`/api/v1/admin/users/${id}/reset-usage`),

  getSubscriptions: (params: AdminSubscriptionsParams = {}) =>
    client.get<PagedResult<AdminSubscription>>(`/api/v1/admin/subscriptions${toQueryString(params)}`),

  getPayments: (params: AdminPaymentsParams = {}) =>
    client.get<PagedResult<AdminPayment>>(`/api/v1/admin/payments${toQueryString(params)}`),

  getAdminPlans: () => client.get<AdminPlan[]>('/api/v1/admin/plans'),

  updatePlan: (id: string, body: UpdatePlanRequest) =>
    client.put<AdminPlan>(`/api/v1/admin/plans/${id}`, body),

  getEntitlementMatrix: () => client.get<EntitlementMatrixEntry[]>('/api/v1/admin/entitlements'),

  getAuditLog: (params: AdminAuditLogParams = {}) =>
    client.get<PagedResult<AuditLogEntry>>(`/api/v1/admin/audit-log${toQueryString(params)}`),
}
