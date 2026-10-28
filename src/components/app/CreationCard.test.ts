import { describe, expect, it } from 'vitest'
import { deriveTitleFromPrompt } from './CreationCard'

describe('deriveTitleFromPrompt', () => {
  it('falls back to "Untitled document" for an empty prompt', () => {
    expect(deriveTitleFromPrompt('')).toBe('Untitled document')
  })

  it('falls back to "Untitled document" for a whitespace-only prompt', () => {
    expect(deriveTitleFromPrompt('   \n  ')).toBe('Untitled document')
  })

  it('uses the first line of a short prompt as-is', () => {
    expect(deriveTitleFromPrompt('Social media and adolescent mental health')).toBe(
      'Social media and adolescent mental health',
    )
  })

  it('uses only the first line of a multi-line prompt', () => {
    expect(deriveTitleFromPrompt('A literature review on anxiety\nFocus on adolescents 13-18')).toBe(
      'A literature review on anxiety',
    )
  })

  it('keeps a typical research-question prompt whole instead of clipping it at 60 characters', () => {
    const q = 'To what extent can artificial intelligence improve the quality of education in South African universities?'
    expect(deriveTitleFromPrompt(q)).toBe(q)
  })

  it('cuts a very long prompt at a word boundary with an ellipsis', () => {
    const long = 'A literature review on the relationship between social media use and anxiety in adolescents aged 13 to 18 across low- and middle-income countries with attention to measurement differences'
    const result = deriveTitleFromPrompt(long)
    expect(result.endsWith('…')).toBe(true)
    expect(result.length).toBeLessThanOrEqual(121)
    expect(long.startsWith(result.slice(0, -1))).toBe(true)
    // the cut lands between words: what follows the kept text is a space or the punctuation we trimmed
    expect(long.slice(result.length - 1)).toMatch(/^[\s,;:.\-–—]/)
  })

  it('trims leading/trailing whitespace from the first line', () => {
    expect(deriveTitleFromPrompt('   My essay topic   \nmore text')).toBe('My essay topic')
  })
})
