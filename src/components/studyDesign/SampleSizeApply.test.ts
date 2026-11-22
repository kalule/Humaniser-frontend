import { describe, expect, it } from 'vitest'
import { describeApplied } from './SampleSizeTab'

describe('describeApplied (research-platform W4.1)', () => {
  it('names each saved figure and what it replaced', () => {
    expect(describeApplied([
      { factKey: 'SampleSizeTotal', value: '84', previousValue: '200' },
      { factKey: 'RecruitmentTarget', value: '105', previousValue: null },
    ])).toBe('Saved to your project: sample size 84 (was 200), recruitment target 105. Sections that state another figure will be flagged.')
  })

  it('says when nothing changed', () => {
    expect(describeApplied([])).toBe('Nothing was changed.')
  })
})
