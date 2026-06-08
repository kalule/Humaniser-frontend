import client from './client'

export interface AdminStats {
  totalUsers: number
  newUsersToday: number
  wordsToday: number
  totalWordsThisMonth: number
  activeSubscriptions: number
  usersByPlan: {
    free: number
    pro: number
    unlimited: number
  }
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

export const adminApi = {
  getStats: () => client.get<AdminStats>('/api/v1/admin/stats'),
  getUsage: () => client.get<AdminStats>('/api/v1/admin/usage'),
}
