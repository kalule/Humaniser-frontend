// What the sidebar usage meter says. Kept as pure functions so the wording rules (limit vs. no limit,
// "fair use" next to any numeric cap on an Unlimited plan, when the AI Content Check meter appears)
// are tested rather than living in JSX.

export type UsageKey = 'words' | 'credits' | 'detector'

export interface UsageMetric {
  key: UsageKey
  used: number
  limit: number
  /** This metric has no cap (an Unlimited plan, or a limit so large it is effectively none). */
  unlimited: boolean
}

/** AI Content Check scans are capped even on the Unlimited plan, so the meter is only shown once it matters. */
export const DETECTOR_METER_THRESHOLD_PCT = 70

export const usagePercent = (m: Pick<UsageMetric, 'used' | 'limit' | 'unlimited'>) =>
  m.unlimited || m.limit <= 0 ? 0 : (m.used / m.limit) * 100

/** Limits at or above this are the backend's stand-in for "no cap". */
export const UNLIMITED_LIMIT_THRESHOLD = 1_000_000

/**
 * Whether the account has no word/credit cap. Driven by the signed-in user's `plan` (from the auth
 * store's UserDto) with the limit as a fallback, since the backend encodes "no cap" as a huge limit.
 */
export const isPlanUnlimited = (plan: string | undefined | null, limit: number | undefined | null) =>
  plan === 'Unlimited' || (limit ?? 0) >= UNLIMITED_LIMIT_THRESHOLD

export const isDetectorMeterVisible = (used: number, limit: number) =>
  limit > 0 && (used / limit) * 100 > DETECTOR_METER_THRESHOLD_PCT

const n = (v: number) => v.toLocaleString()

/**
 * One-line summary.
 *  - limited:    "3,706 / 20,000 words"
 *  - unlimited:  "3,706 words used this month · no limit"   (no bar, no cap)
 *  - AI Content Check (always capped): "AI Content Check scans this month: 640 / 750", plus
 *    " (fair-use limit)" when the plan badge says Unlimited so a numeric cap never sits next to
 *    "Unlimited" without saying why.
 */
export function usageSummaryText(m: UsageMetric, planIsUnlimited: boolean): string {
  if (m.key === 'detector') {
    const suffix = planIsUnlimited ? ' (fair-use limit)' : ''
    return `AI Content Check scans this month${suffix}: ${n(m.used)} / ${n(m.limit)}`
  }
  const noun = m.key === 'words' ? 'words' : 'credits'
  if (m.unlimited) return `${n(m.used)} ${noun} used this month · no limit`
  return `${n(m.used)} / ${n(m.limit)} ${noun}`
}

/** A progress bar only makes sense against a real cap. */
export const showUsageBar = (m: Pick<UsageMetric, 'unlimited'>) => !m.unlimited
