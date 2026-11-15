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

export const isDetectorMeterVisible = (used: number, limit: number) =>
  limit > 0 && (used / limit) * 100 > DETECTOR_METER_THRESHOLD_PCT

const n = (v: number) => v.toLocaleString()

/**
 * One-line summary.
 *  - limited:    "3,706 / 20,000 words"
 *  - unlimited:  "Words used this month: 3,706"   (no bar, no cap)
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
  if (m.unlimited) return `${m.key === 'words' ? 'Words' : 'Credits'} used this month: ${n(m.used)}`
  return `${n(m.used)} / ${n(m.limit)} ${noun}`
}

/** A progress bar only makes sense against a real cap. */
export const showUsageBar = (m: Pick<UsageMetric, 'unlimited'>) => !m.unlimited
