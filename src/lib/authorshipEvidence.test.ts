import { describe, expect, it } from 'vitest'
import { usageInstant } from './authorshipEvidence'

describe('usageInstant', () => {
  it('sends midday UTC for an earlier day', () => {
    expect(usageInstant('2026-11-10', new Date('2026-11-17T03:44:00Z'))).toBe('2026-11-10T12:00:00.000Z')
  })

  it('sends now for today before midday UTC, so the entry is not in the future', () => {
    expect(usageInstant('2026-11-17', new Date('2026-11-17T03:44:00Z'))).toBe('2026-11-17T03:44:00.000Z')
  })

  it('sends midday UTC for today after midday UTC', () => {
    expect(usageInstant('2026-11-17', new Date('2026-11-17T18:00:00Z'))).toBe('2026-11-17T12:00:00.000Z')
  })
})
