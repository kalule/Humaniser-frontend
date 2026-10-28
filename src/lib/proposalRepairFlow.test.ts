import { describe, expect, it } from 'vitest'
import { nextActionAfterRepair } from './proposalRepairFlow'

describe('nextActionAfterRepair', () => {
  it('downloads straight away when nothing blocking remains', () => {
    expect(nextActionAfterRepair({ skipped: false, blockingRemaining: 0 })).toBe('download')
  })
  it('asks for confirmation when blocking issues remain', () => {
    expect(nextActionAfterRepair({ skipped: false, blockingRemaining: 2 })).toBe('confirm-warnings')
  })
  it('never downloads on its own after a skipped run', () => {
    expect(nextActionAfterRepair({ skipped: true, blockingRemaining: 0 })).toBe('skipped')
    expect(nextActionAfterRepair({ skipped: true, blockingRemaining: 3 })).toBe('skipped')
  })
})
