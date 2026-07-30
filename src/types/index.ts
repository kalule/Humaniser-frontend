// ─── Auth ────────────────────────────────────────────────────────────────────

export interface RegisterRequest {
  email: string
  password: string
  name?: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  expiresAt: string
  user: UserDto
}

export interface UserDto {
  id: string
  email: string
  name?: string
  plan: Plan
  wordsUsed: number
  wordsLimit: number
  creditsUsed: number
  creditsLimit: number
  isEmailVerified: boolean
  role?: string
  createdAt: string
}

// ─── User ─────────────────────────────────────────────────────────────────────

export interface UserProfile extends UserDto {
  wordsRemaining: number
  creditsRemaining: number
  lastLoginAt?: string
  activeSubscription?: SubscriptionDto
}

export interface UsageStats {
  wordsUsedThisMonth: number
  wordsLimit: number
  wordsRemaining: number
  creditsUsed: number
  creditsLimit: number
  creditsRemaining: number
  resetDate: string
  totalWordsAllTime: number
  dailyUsage: DailyUsage[]
  plan: Plan
}

export interface DailyUsage {
  date: string
  wordCount: number
  count: number
}

// ─── Humanise ────────────────────────────────────────────────────────────────

export interface HumaniseRequest {
  text: string
  tone: Tone
  strength: Strength
  integrityMode?: boolean
  preserveLength?: boolean
}

export type Tone = 'casual' | 'professional' | 'academic' | 'conversational'

export type Strength = 'light' | 'balanced' | 'aggressive' | 'maximum' | 'medium' | 'heavy'

export interface HumaniseResponse {
  humanisedText: string
  wordCount: number
  processingTimeMs: number
  usage: UsageStatsSimple
  historyId: string
  originalAiScore: number
  finalAiScore: number
  verificationPassesUsed: number
  metTargetThreshold: boolean
}

export interface UsageStatsSimple {
  wordsUsed: number
  wordsLimit: number
  wordsRemaining: number
  plan: Plan
  resetDate: string
}

// ─── History ─────────────────────────────────────────────────────────────────

export interface HistoryItem {
  id: string
  inputText: string
  outputText: string
  tone: Tone
  strength: Strength
  wordCount: number
  processingTimeMs: number
  createdAt: string
}

export interface PagedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

// ─── Subscription ────────────────────────────────────────────────────────────

export interface SubscriptionDto {
  id: string
  plan: Plan
  status: string
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
}

export interface CheckoutResponse {
  url: string
  sessionId: string
}

export interface PortalResponse {
  url: string
}

// ─── API wrapper ─────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean
  message?: string
  data: T
}

export interface ApiError {
  code: string
  message: string
  details?: unknown
}

// ─── Plan ────────────────────────────────────────────────────────────────────

export type Plan = 'Free' | 'Pro' | 'Unlimited'
