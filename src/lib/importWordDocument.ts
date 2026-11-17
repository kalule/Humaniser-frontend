import { extractTextFromFile } from './fileExtract'
import type { WorkspaceDocument } from '../types/library'

// Shared by the creation card's "Import from Word" button and the sidebar's global "New" menu's
// "Import document" quick action — both just extract text and hand it to createDocument, only
// differing in which extra fields (documentType/citationStyle) they attach.
export async function importDocumentFromFile(
  file: File,
  createDocument: (patch: Partial<WorkspaceDocument> & { importedFileName?: string }) => Promise<WorkspaceDocument>,
  extraPatch: Partial<WorkspaceDocument> = {},
): Promise<WorkspaceDocument> {
  const content = await extractTextFromFile(file)
  return createDocument({
    title: file.name.replace(/\.[^.]+$/, '') || 'Untitled document',
    content,
    // So that, with recording on, this document's history says it was imported rather than typed here.
    importedFileName: file.name,
    ...extraPatch,
  })
}
