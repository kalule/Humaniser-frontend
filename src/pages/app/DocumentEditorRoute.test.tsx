import { describe, expect, it, vi } from 'vitest'

const route = vi.hoisted(() => ({ documentId: undefined as string | undefined }))
vi.mock('react-router-dom', () => ({ useParams: () => ({ documentId: route.documentId }) }))
vi.mock('./DocumentEditorPage', () => ({ default: () => null }))
import DocumentEditorRoute from './DocumentEditorRoute'

describe('document editor instance ownership', () => {
  it('uses a different React instance key for each document, resetting editor content and AI state together', () => {
    route.documentId = 'united-nations'
    const first = DocumentEditorRoute()
    route.documentId = 'apartheid'
    const second = DocumentEditorRoute()
    expect(first.key).toBe('united-nations')
    expect(second.key).toBe('apartheid')
    expect(first.key).not.toBe(second.key)
    expect(first.props.documentId).toBe('united-nations')
    expect(second.props.documentId).toBe('apartheid')
  })

  it('keeps the same instance during autosaves and uses an explicit new-document ID for the literal /editor/new route', () => {
    route.documentId = 'existing'
    expect(DocumentEditorRoute().key).toBe(DocumentEditorRoute().key)
    route.documentId = undefined
    const fresh = DocumentEditorRoute()
    expect(fresh.key).toBe('new')
    expect(fresh.props.documentId).toBe('new')
  })
})
