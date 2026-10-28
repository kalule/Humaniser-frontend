import { describe, expect, it } from 'vitest'
import { suggestedCitationStyle } from './disciplineCitationStyle'

describe('suggestedCitationStyle', () => {
  it('suggests the usual style for a subject', () => {
    expect(suggestedCitationStyle('Medicine')).toBe('Vancouver')
    expect(suggestedCitationStyle('Engineering')).toBe('Ieee')
    expect(suggestedCitationStyle('Psychology')).toBe('Apa7')
    expect(suggestedCitationStyle('History')).toBe('Chicago')
  })
  it('suggests nothing for General', () => {
    expect(suggestedCitationStyle('General')).toBeNull()
  })
})
