import { describe, expect, it } from 'vitest'
import { isEmptyDraftDocument } from './library'
import type { WorkspaceDocument } from './library'

function doc(overrides: Partial<WorkspaceDocument> = {}): WorkspaceDocument {
  return {
    id: '1',
    title: 'Untitled document',
    content: '',
    type: 'doc',
    isPdf: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('isEmptyDraftDocument', () => {
  it('flags a freshly-created, untouched document', () => {
    expect(isEmptyDraftDocument(doc())).toBe(true)
  })

  it('flags a document whose content is whitespace-only', () => {
    expect(isEmptyDraftDocument(doc({ content: '   \n  ' }))).toBe(true)
  })

  it('flags a document with no content field at all', () => {
    expect(isEmptyDraftDocument(doc({ content: undefined }))).toBe(true)
  })

  it('does not flag a document once it has real content', () => {
    expect(isEmptyDraftDocument(doc({ content: '{"type":"doc","content":[{"type":"paragraph"}]}' }))).toBe(false)
  })

  it('does not flag a renamed document even with no content yet', () => {
    expect(isEmptyDraftDocument(doc({ title: 'My essay' }))).toBe(false)
  })
})
