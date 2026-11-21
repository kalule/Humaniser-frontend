import { describe, expect, it } from 'vitest'
import { hasRealProjectTitle, shouldAutoGenerateTitles, UNTITLED_PROJECT } from './proposalTitle'

describe('proposal title step rules', () => {
  it('treats the placeholder and blanks as "no title"', () => {
    expect(hasRealProjectTitle(UNTITLED_PROJECT)).toBe(false)
    expect(hasRealProjectTitle('   ')).toBe(false)
    expect(hasRealProjectTitle(null)).toBe(false)
    expect(hasRealProjectTitle('Load-shedding and small retailers in Gauteng')).toBe(true)
  })

  it('does not generate titles on mount when the project already has its own title', () => {
    expect(shouldAutoGenerateTitles(0, 'Load-shedding and small retailers in Gauteng', 'Load-shedding')).toBe(false)
  })

  it('does not generate titles on mount when suggestions are already cached', () => {
    expect(shouldAutoGenerateTitles(3, UNTITLED_PROJECT, 'Load-shedding')).toBe(false)
  })

  it('generates on mount only for a project with no title, no cached titles and a topic', () => {
    expect(shouldAutoGenerateTitles(0, UNTITLED_PROJECT, 'Load-shedding')).toBe(true)
    expect(shouldAutoGenerateTitles(0, '', 'Load-shedding')).toBe(true)
    expect(shouldAutoGenerateTitles(0, '', '')).toBe(false)
  })
})
