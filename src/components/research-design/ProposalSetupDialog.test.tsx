import { describe, expect, it } from 'vitest'
import { START_MODES } from './ProposalSetupDialog'

describe('ProposalSetupDialog', () => {
  it('offers exactly a manual proposal and an automated proposal, with no study-design step', () => {
    expect(START_MODES.map(m => m.value)).toEqual(['manual', 'automated'])
    expect(START_MODES.some(m => /design/i.test(m.title + m.hint))).toBe(false)
  })
})
