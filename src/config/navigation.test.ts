import { describe, expect, it } from 'vitest'
import { matchEditorDocumentId, resolveEditorHeaderTitle, resolvePageTitle } from './navigation'

describe('matchEditorDocumentId', () => {
  it('extracts the :documentId segment from an editor route', () => {
    expect(matchEditorDocumentId('/app/editor/abc-123')).toBe('abc-123')
  })

  it('returns null for non-editor routes', () => {
    expect(matchEditorDocumentId('/app/library')).toBeNull()
    expect(matchEditorDocumentId('/app/editor')).toBeNull()
    expect(matchEditorDocumentId('/app/editor/abc-123/extra')).toBeNull()
  })
})

describe('resolveEditorHeaderTitle', () => {
  const documents = [
    { id: 'doc-1', title: 'Social media and adolescent mental health' },
    { id: 'doc-2', title: '' },
  ]

  it('shows the document title once the library has loaded', () => {
    expect(resolveEditorHeaderTitle('doc-1', true, documents)).toEqual({
      breadcrumbTitle: 'Social media and adolescent mental health',
      tabTitle: 'Social media and adolescent mental health · HumaniseAI',
    })
  })

  it('falls back to "Untitled document" for a loaded document with an empty title', () => {
    expect(resolveEditorHeaderTitle('doc-2', true, documents)).toEqual({
      breadcrumbTitle: 'Untitled document',
      tabTitle: 'Untitled document · HumaniseAI',
    })
  })

  it('renders a neutral placeholder while the library is still loading, never guessing "Untitled"', () => {
    expect(resolveEditorHeaderTitle('doc-1', false, [])).toEqual({
      breadcrumbTitle: null,
      tabTitle: 'HumaniseAI',
    })
  })

  it('treats editor/new as "Untitled document" without waiting on the library', () => {
    expect(resolveEditorHeaderTitle('new', false, [])).toEqual({
      breadcrumbTitle: 'Untitled document',
      tabTitle: 'Untitled document · HumaniseAI',
    })
    expect(resolveEditorHeaderTitle('new', true, documents)).toEqual({
      breadcrumbTitle: 'Untitled document',
      tabTitle: 'Untitled document · HumaniseAI',
    })
  })
})

describe('resolvePageTitle (unaffected by the editor title resolver)', () => {
  it('still resolves static nav routes exactly as before', () => {
    expect(resolvePageTitle('/app/library')).toBe('Documents')
    expect(resolvePageTitle('/app/humaniser')).toBe('Humaniser')
    expect(resolvePageTitle('/app/account')).toBe('Account Settings')
  })

  it('still falls back to "Dashboard" for unmatched routes', () => {
    expect(resolvePageTitle('/app/some-unknown-route')).toBe('Dashboard')
  })
})
