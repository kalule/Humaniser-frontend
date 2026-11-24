import { describe, expect, it } from 'vitest'
import { countBodyWords, splitTrailingReferences } from './wordCount'

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

describe('splitTrailingReferences', () => {
  it('splits off the References block so body + tail is the original text', () => {
    const content = 'Body text here.\n\n---\n\n### References (2)\n\n1. A (2020). One.\n2. B (2021). Two.'
    const { body, tail } = splitTrailingReferences(content)
    expect(body).toBe('Body text here.')
    expect(tail.startsWith('\n\n---\n\n### References (2)')).toBe(true)
    expect(body + tail).toBe(content)
  })

  it('recognises a bold References heading', () => {
    const { body } = splitTrailingReferences('Body.\n\n**References**\n\nA (2020). One.')
    expect(body).toBe('Body.')
  })

  it('returns the whole text as body when there is no References block', () => {
    expect(splitTrailingReferences('Just body.')).toEqual({ body: 'Just body.', tail: '' })
  })
})