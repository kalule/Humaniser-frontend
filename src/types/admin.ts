export type Role = 'Admin' | 'User'
export type AccountStatus = 'Active' | 'Suspended'

export interface PagedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface AdminUserListItem {
  id: string
  email: string
  name?: string
  role: Role
  accountStatus: AccountStatus
  plan: string
  subscriptionStatus?: string
  wordsUsed: number
  wordsLimit: number
  isEmailVerified: boolean
  lastLoginAt?: string
  createdAt: string
}

export interface AdminSubscription {
  id: string
  userId: string
  userEmail?: string
  plan: string
  status: string
  provider: string
  providerSubscriptionId?: string
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  createdAt: string
}

export interface AdminPayment {
  id: string
  userId: string
  userEmail?: string
  provider: string
  providerPaymentId: string
  amount: number
  currency: string
  status: string
  failureReason?: string
  createdAt: string
}

export interface AdminUserDetail {
  id: string
  email: string
  name?: string
  role: Role
  accountStatus: AccountStatus
  plan: string
  wordsUsed: number
  wordsLimit: number
  creditsUsed: number
  creditsLimit: number
  isEmailVerified: boolean
  lastLoginAt?: string
  createdAt: string
  subscriptions: AdminSubscription[]
  recentPayments: AdminPayment[]
  historyCount: number
  researchProjectCount: number
}

export interface AdminPlan {
  id: string
  tier: string
  name: string
  description: string
  billingInterval: string
  price: number
  currency: string
  isActive: boolean
  features: string[]
}

export interface UpdatePlanRequest {
  name?: string
  description?: string
  price?: number
  isActive?: boolean
  features?: string[]
}

export interface AuditLogEntry {
  id: string
  adminUserId: string
  adminEmail?: string
  action: string
  targetType: string
  targetId?: string
  details?: string
  createdAt: string
}

export interface EntitlementMatrixEntry {
  plan: string
  feature: string
  hasAccess: boolean
}
