import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkspaceDocument } from '../types/library'
import type { SaveDocumentPayload } from '../api/library'

const mocks = vi.hoisted(() => ({ saveDocument: vi.fn() }))

vi.mock('../api/library', () => ({
  libraryApi: { saveDocument: mocks.saveDocument },
}))

function doc(overrides: Partial<WorkspaceDocument> = {}): WorkspaceDocument {
  return {
    id: 'doc-1',
    title: 'Generated Paper',
    content: 'v1',
    type: 'doc',
    isPdf: false,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    ...overrides,
  }
}

// PR20 — the real regression risk this covers: updateDocument's field list is an explicit
// whitelist, not a blind spread of the patch (see libraryStore.ts:72-93). A backend-only test of
// SaveDocumentAsync's write-once logic (LibraryGenerationAuditLinkTests.cs) proves the server
// preserves an omitted field, but says nothing about whether the FRONTEND's merge-then-forward
// actually carries the previously-known value along on a normal edit, rather than sending
// `undefined` because it wasn't re-derived from the patch. This is that specific interaction.
describe('libraryStore.updateDocument — workbenchGenerationAuditId write-once forwarding', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.saveDocument.mockReset()
  })

  it('sends the correlation ID on the stamping call itself (handleAiGenerated\'s save)', async () => {
    const { useLibraryStore } = await import('./libraryStore')
    useLibraryStore.setState({ documents: [doc({ workbenchGenerationAuditId: undefined })], hasLoaded: true })
    mocks.saveDocument.mockResolvedValue(doc({ workbenchGenerationAuditId: 'audit-123' }))

    await useLibraryStore.getState().updateDocument('doc-1', { workbenchGenerationAuditId: 'audit-123' })

    const sent = mocks.saveDocument.mock.calls[0][0] as SaveDocumentPayload
    expect(sent.workbenchGenerationAuditId).toBe('audit-123')
  })

  it('carries the previously-known correlation ID forward on a later edit that never mentions it', async () => {
    const { useLibraryStore } = await import('./libraryStore')
    // Simulates state after the stamping call above + the server's response round-tripping back
    // through LibraryDocumentDto (see LibraryService.cs's ToDto) into the local store.
    useLibraryStore.setState({ documents: [doc({ workbenchGenerationAuditId: 'audit-123' })], hasLoaded: true })
    mocks.saveDocument.mockResolvedValue(doc({ content: 'v2 after editing', workbenchGenerationAuditId: 'audit-123' }))

    // A normal content edit — the patch object genuinely does not set this field at all, exactly
    // like every debouncedSave(content) / title-update call site in DocumentEditorPage.tsx.
    await useLibraryStore.getState().updateDocument('doc-1', { content: 'v2 after editing' })

    const sent = mocks.saveDocument.mock.calls[0][0] as SaveDocumentPayload
    expect(sent.content).toBe('v2 after editing')
    expect(sent.workbenchGenerationAuditId).toBe('audit-123')
  })

  it('never sends a correlation ID for a document that never had one (manual document)', async () => {
    const { useLibraryStore } = await import('./libraryStore')
    useLibraryStore.setState({ documents: [doc({ workbenchGenerationAuditId: undefined })], hasLoaded: true })
    mocks.saveDocument.mockResolvedValue(doc())

    await useLibraryStore.getState().updateDocument('doc-1', { title: 'Hand-typed title' })

    const sent = mocks.saveDocument.mock.calls[0][0] as SaveDocumentPayload
    expect(sent.workbenchGenerationAuditId).toBeUndefined()
  })
})
