import { describe, expect, it } from 'vitest'
import { documentGenreToWriteWithAiDocumentType, formatStyleToEssayCitationStyle } from './draftHandoffMapping'

describe('formatStyleToEssayCitationStyle', () => {
  it('maps each supported style to its EssayCitationStyle equivalent', () => {
    expect(formatStyleToEssayCitationStyle('harvard')).toBe('Harvard')
    expect(formatStyleToEssayCitationStyle('ieee')).toBe('Ieee')
    expect(formatStyleToEssayCitationStyle('chicago')).toBe('Chicago')
    expect(formatStyleToEssayCitationStyle('vancouver')).toBe('Vancouver')
    expect(formatStyleToEssayCitationStyle('apa7')).toBe('Apa7')
  })

  it('degrades mla to Apa7 since EssayCitationStyle has no MLA option', () => {
    expect(formatStyleToEssayCitationStyle('mla')).toBe('Apa7')
  })
})

describe('documentGenreToWriteWithAiDocumentType', () => {
  it('maps the three specific genres straight across', () => {
    expect(documentGenreToWriteWithAiDocumentType('Essay')).toBe('Essay')
    expect(documentGenreToWriteWithAiDocumentType('LiteratureReview')).toBe('LiteratureReview')
    expect(documentGenreToWriteWithAiDocumentType('ResearchPaper')).toBe('ResearchPaper')
  })

  it('maps Other to General writing', () => {
    expect(documentGenreToWriteWithAiDocumentType('Other')).toBe('General')
  })
})
