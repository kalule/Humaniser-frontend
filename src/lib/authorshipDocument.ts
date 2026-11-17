// Authorship Evidence: which document the editor has open, so that the AI tools it calls can be recorded against
// that document. Only the editor sets it, only while it is open, and it is sent only with the editor's own
// workbench calls. The server checks that the document belongs to the caller before linking anything to it.

export const AUTHORSHIP_DOCUMENT_HEADER = 'X-Authorship-Document'

let current: string | null = null

export function setAuthorshipDocument(documentId: string | null | undefined): void {
  current = documentId ?? null
}

export function authorshipDocument(): string | null {
  return current
}

/** The header to add to a request, or nothing. Only the editor's workbench calls carry it. */
export function authorshipHeader(url: string | undefined): Record<string, string> {
  return current && url?.includes('/api/v1/workbench/') ? { [AUTHORSHIP_DOCUMENT_HEADER]: current } : {}
}
