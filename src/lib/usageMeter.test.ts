import { describe, expect, it } from 'vitest'

// Numbers are formatted for the user's locale ("3,706" or "3 706"), so expectations use the same formatter.
const f = (v: number) => v.toLocaleString()
import { isDetectorMeterVisible, isPlanUnlimited, showUsageBar, usagePercent, usageSummaryText } from './usageMeter'

describe('usageSummaryText', () => {
  it('shows "used / limit words" when the plan has a limit', () => {
    expect(usageSummaryText({ key: 'words', used: 3706, limit: 20000, unlimited: false }, false)).toBe(`${f(3706)} / ${f(20000)} words`)
  })

  it('labels unlimited usage as usage with no limit, without a cap number', () => {
    const text = usageSummaryText({ key: 'words', used: 3706, limit: 1_000_000, unlimited: true }, true)
    expect(text).toBe(`${f(3706)} words used this month · no limit`)
    expect(usageSummaryText({ key: 'credits', used: 12, limit: 1_000_000, unlimited: true }, true))
      .toBe(`${f(12)} credits used this month · no limit`)
    expect(text).not.toContain(f(1_000_000))
    expect(text).not.toContain('/')
  })

  it('names the AI Content Check meter and says "fair-use limit" next to its cap on an Unlimited plan', () => {
    const m = { key: 'detector' as const, used: 600, limit: 750, unlimited: false }
    expect(usageSummaryText(m, false)).toBe('AI Content Check scans this month: 600 / 750')
    expect(usageSummaryText(m, true)).toBe('AI Content Check scans this month (fair-use limit): 600 / 750')
  })

  it('never prints the word "Unlimited" beside a number', () => {
    for (const unlimitedPlan of [true, false]) {
      for (const key of ['words', 'credits', 'detector'] as const) {
        const text = usageSummaryText({ key, used: 5, limit: key === 'detector' ? 750 : 1_000_000, unlimited: key !== 'detector' && unlimitedPlan }, unlimitedPlan)
        expect(text).not.toMatch(/unlimited/i)
      }
    }
  })
})

describe('isPlanUnlimited', () => {
  it('is true for the Unlimited plan or a no-cap sized limit, false otherwise', () => {
    expect(isPlanUnlimited('Unlimited', 500)).toBe(true)
    expect(isPlanUnlimited('Pro', 1_000_000)).toBe(true)
    expect(isPlanUnlimited('Pro', 20_000)).toBe(false)
    expect(isPlanUnlimited('Free', undefined)).toBe(false)
    expect(isPlanUnlimited(undefined, null)).toBe(false)
  })
})

describe('bar and threshold rules', () => {
  it('has no bar for an unlimited metric and a 0% value', () => {
    const m = { key: 'words' as const, used: 10, limit: 1_000_000, unlimited: true }
    expect(showUsageBar(m)).toBe(false)
    expect(usagePercent(m)).toBe(0)
  })

  it('has a bar and a real percentage for a limited metric', () => {
    const m = { key: 'words' as const, used: 500, limit: 1000, unlimited: false }
    expect(showUsageBar(m)).toBe(true)
    expect(usagePercent(m)).toBe(50)
  })

  it('shows the AI Content Check meter only above 70% of its limit', () => {
    expect(isDetectorMeterVisible(0, 750)).toBe(false)
    expect(isDetectorMeterVisible(525, 750)).toBe(false)   // exactly 70%
    expect(isDetectorMeterVisible(526, 750)).toBe(true)
    expect(isDetectorMeterVisible(750, 750)).toBe(true)
    expect(isDetectorMeterVisible(5, 0)).toBe(false)
  })
})
