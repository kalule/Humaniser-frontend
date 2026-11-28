import { describe, expect, it } from 'vitest'
import { propagateSectionChange } from './designContract'
import type { SectionStatus } from '../types/research'

const s = (code: string, content = 'Text.', status: SectionStatus = 'Approved') => ({ code, content, status })

describe('propagateSectionChange (2026-11-28: editing 4.x marks the sections that restate it)', () => {
  it('marks drafted dependents of the research questions with that section as the reason', () => {
    const next = propagateSectionChange({}, '4.1', '4.1 Research Questions',
      [s('3.3'), s('4.2'), s('4.3', ''), s('5.10'), s('5.1')])
    expect(next).toEqual({ '3.3': ['4.1 Research Questions'], '4.2': ['4.1 Research Questions'], '5.10': ['4.1 Research Questions'] })
  })

  it('keeps existing reasons, and returns the same object when nothing is new (no save needed)', () => {
    const prev = { '3.3': ['Design type'] }
    const once = propagateSectionChange(prev, '4.3', '4.3 Specific Objectives', [s('3.3'), s('5.10')])
    expect(once['3.3']).toEqual(['Design type', '4.3 Specific Objectives'])
    expect(propagateSectionChange(once, '4.3', '4.3 Specific Objectives', [s('3.3'), s('5.10')])).toBe(once)
  })

  it('ignores sections nothing depends on and sections still being written', () => {
    const prev = {}
    expect(propagateSectionChange(prev, '1.0', '1 Introduction', [s('3.3')])).toBe(prev)
    expect(propagateSectionChange(prev, '4.4', '4.4 Hypotheses', [s('3.3', 'Partial', 'Generating')])).toBe(prev)
  })
})
