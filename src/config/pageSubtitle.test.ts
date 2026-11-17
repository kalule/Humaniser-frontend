import { describe, expect, it } from 'vitest'
import { resolvePageSubtitle } from './navigation'

describe('resolvePageSubtitle', () => {
  it('describes the current Research Library tab', () => {
    expect(resolvePageSubtitle('/app/web-library/collections')).toBe('Organise papers by topic or project')
    expect(resolvePageSubtitle('/app/web-library/collections/abc')).toBe('Organise papers by topic or project')
    expect(resolvePageSubtitle('/app/web-library/find')).toBe('Search scholarly databases and save papers')
    expect(resolvePageSubtitle('/app/web-library')).toBe('Every paper you have saved or imported')
  })

  it('adds nothing elsewhere, where the sidebar already describes the tool', () => {
    expect(resolvePageSubtitle('/app/humaniser')).toBeNull()
    expect(resolvePageSubtitle('/app/web-libraryx')).toBeNull()
  })
})
