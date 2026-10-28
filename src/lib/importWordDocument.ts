import { extractTextFromFile } from './fileExtract'
import type { WorkspaceDocument } from '../types/library'

// Shared by the creation card's "Import from Word" button and the sidebar's global "New" menu's
// "Import document" quick action — both just extract text and hand it to createDocument, only
// differing in which extra fields (documentType/citationStyle) they attach.
export async function importDocumentFromFile(
  file: File,
  createDocument: (patch: Partial<WorkspaceDocument>) => Promise<WorkspaceDocument>,
  extraPatch: Partial<WorkspaceDocument> = {},
): Promise<WorkspaceDocument> {
  const content = await extractTextFromFile(file)
  return createDocument({
    title: file.name.replace(/\.[^.]+$/, '') || 'Untitled document',
    content,
    ...extraPatch,
  })
}
