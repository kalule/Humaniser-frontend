import { describe, expect, it } from 'vitest'
import { countBodyWords } from './wordCount'

describe('countBodyWords', () => {
  it('counts all words when there is no references section', () => {
    const content = 'This is a short paragraph with exactly eight words.'
    expect(countBodyWords(content)).toBe(9)
  })

  it('excludes a clearly-headed references section from the count', () => {
    const content = [
      'This body paragraph has five words.',
      '',
      '---',
      '### References (2)',
      '1. Smith, J. (2020). A paper about something.',
      '2. Doe, A. (2021). Another paper about something else.',
    ].join('\n')
    expect(countBodyWords(content)).toBe(6)
  })

  it('does not truncate when "references" appears inside body prose, not as a standalone heading', () => {
    const content = 'The references cited by prior work were inconsistent across studies here today now.'
    expect(countBodyWords(content)).toBe(content.trim().split(/\s+/).length)
  })

  it('matches bibliography and reference list headers, case-insensitively, with or without a count', () => {
    const bibliography = 'Body text here.\n\nBibliography\nSmith 2020.'
    const referenceList = 'Body text here.\n\nreference list (3)\nSmith 2020.'
    expect(countBodyWords(bibliography)).toBe(3)
    expect(countBodyWords(referenceList)).toBe(3)
  })
})
