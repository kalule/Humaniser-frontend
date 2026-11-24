import { describe, expect, it } from 'vitest'
import { CHAPTER_STEPS } from './proposalOutline'
import { PROPOSAL_SECTION_WORD_LIMITS, PROPOSAL_WORD_LIMIT, sectionWordLimit } from './proposalLengthBudget'

describe('proposal length budget', () => {
  it('shares exactly the 10,000-word cap across every chapter section', () => {
    expect(Object.values(PROPOSAL_SECTION_WORD_LIMITS).reduce((a, b) => a + b, 0)).toBe(PROPOSAL_WORD_LIMIT)
    expect(Object.keys(PROPOSAL_SECTION_WORD_LIMITS).sort()).toEqual(CHAPTER_STEPS.map(s => s.sectionKey!).sort())
  })

  it('gives the Literature Review the largest share and falls back to an even share', () => {
    expect(sectionWordLimit('2.0')).toBe(Math.max(...Object.values(PROPOSAL_SECTION_WORD_LIMITS)))
    expect(sectionWordLimit('9.9')).toBe(400)
    expect(sectionWordLimit(null)).toBe(400)
  })
})
