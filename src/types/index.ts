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
  /** AI Detector's own monthly cap, independent of the shared credit balance. */
  detectorChecksUsed?: number
  detectorChecksLimit?: number
  /** Rollover top-up balance, on top of wordsLimit/creditsLimit — never expires. */
  bonusWords?: number
  bonusCredits?: number
  isEmailVerified: boolean
  role?: 'Admin' | 'User'
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
  /** 'auto' asks the backend to detect the input's own register (RegisterDetector) instead of a fixed tone. */
  tone: Tone | 'auto'
  strength: Strength
  integrityMode?: boolean
  preserveLength?: boolean
  // Optional academic-quality passes — see EditorPage.tsx's ENHANCE_OPTIONS. None permit new
  // facts/sources/claims; that constraint is unconditional server-side regardless of these flags.
  reduceRepetition?: boolean
  improveCriticalAnalysis?: boolean
  improveArgumentFlow?: boolean
  calibrateCausalClaims?: boolean
  improveParagraphCoherence?: boolean
  /** Spelling preference. Omitted or 'preserve' keeps the author's own variant. */
  englishVariant?: EnglishVariant
}

export type EnglishVariant = 'preserve' | 'en-GB' | 'en-US' | 'en-ZA'

export type Tone = 'casual' | 'professional' | 'academic' | 'conversational'

export type Strength = 'light' | 'balanced' | 'aggressive' | 'maximum' | 'medium' | 'heavy'

export interface HumaniseResponse {
  job?: import('../api/humaniseJobs').HumaniseJobResult
  humanisedText: string
  wordCount: number
  processingTimeMs: number
  usage: UsageStatsSimple
  historyId: string
  /** Verifiable facts about the revision — the API no longer returns any AI-detection estimate. */
  revision: RevisionSummary
  /** Mechanical diff of hedges/degree words, numbers, and quotations between input and output. */
  preservation: ClaimPreservationCheck
  citationIntegrity: CitationIntegrityCheck
  /** Only set when the request's tone was 'auto' — the register RegisterDetector picked. */
  resolvedTone?: Tone
  /** 'unchanged' is a valid result: the text already read well. 'needs_review': see paragraphReviews. */
  outcome?: HumaniseOutcome
  paragraphReviews?: HumaniseParagraphReview[]
}

export type HumaniseOutcome = 'changed' | 'unchanged' | 'needs_review'

/** A paragraph the server restored to the original wording or flagged for the author to check. index is 0-based. */
export interface HumaniseParagraphReview {
  index: number
  status: 'restored_original' | 'flagged'
  codes: string[]
  notes: string[]
}

/** All zero when the result was served from cache, except the word counts. */
export interface RevisionSummary {
  originalWordCount: number
  outputWordCount: number
  lengthRatioPercent: number
  fillerSentencesBefore: number
  fillerSentencesAfter: number
  passesUsed: number
  restorationPassApplied: boolean
}

/** Mechanical claim-content diff — not a meaning check, just presence/absence of specific items. */
export interface ClaimPreservationCheck {
  droppedQualifiers: string[]
  droppedNumbers: string[]
  addedNumbers: string[]
  alteredQuotations: string[]
  issueCount: number
  hasIssues: boolean
}

/** Mechanical post-generation citation-marker diff — not a correctness check, just presence/absence. */
export interface CitationIntegrityCheck {
  originalCitationCount: number
  preservedCount: number
  droppedCitations: string[]
  addedCitations: string[]
  hasMismatch: boolean
}

export interface UsageStatsSimple {
  wordsUsed: number
  wordsLimit: number
  wordsRemaining: number
  creditsUsed: number
  creditsLimit: number
  creditsRemaining: number
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

// Shape of GET /api/v1/subscription/status — note the subscription itself is nested, not the
// top-level payload.
export interface SubscriptionStatusResponse {
  plan: Plan
  hasActiveSubscription: boolean
  subscription: SubscriptionDto | null
}

export interface CheckoutResponse {
  url: string
  sessionId: string
  provider: string
}

export interface PortalResponse {
  url: string
}

// Source of truth for pricing — never hardcode prices in the frontend; fetch from
// GET /api/v1/subscription/plans instead.
export interface PlanDefinitionDto {
  id: string
  tier: Plan
  name: string
  description: string
  billingInterval: 'Monthly' | 'Annual'
  price: number
  currency: string
  features: string[]
}

export interface PaymentDto {
  id: string
  provider: string
  amount: number
  currency: string
  status: 'Pending' | 'Succeeded' | 'Failed' | 'Cancelled'
  failureReason?: string | null
  createdAt: string
}

export interface MockCheckoutSessionDto {
  sessionId: string
  purchaseType: 'Subscription' | 'TopUp'
  plan?: PlanDefinitionDto | null
  topUpPackage?: TopUpPackageDto | null
  status: string
}

export interface TopUpPackageDto {
  id: string
  name: string
  description: string
  wordAmount: number
  creditAmount: number
  price: number
  currency: string
}

export interface CreateTopUpCheckoutRequest {
  topUpPackageId: string
  successUrl: string
  cancelUrl: string
}

export type MockPaymentOutcome = 'Succeeded' | 'Failed' | 'Cancelled'

export interface ConfirmMockPaymentResponse {
  status: string
  failureReason?: string | null
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
