import type { FormatStyle } from './citation'

export type DocFileType = 'doc' | 'pdf' | 'md' | 'docx' | 'txt'
export type DocOwnership = 'all' | 'mine' | 'shared'
export type DocViewMode  = 'grid' | 'list'

// New-document creation card's "Document type" choice (prompt #3). Purely descriptive today —
// nothing server-side keys off it — captured so the editor/future prompts can use it, e.g. to
// pre-fill "Create with draft"'s hand-off into WriteWithAiModal's own WriteWithAiDocumentType.
export type DocumentGenre = 'Essay' | 'LiteratureReview' | 'ResearchPaper' | 'ThesisChapter' | 'Other'

export interface WorkspaceFolder {
  id:        string
  name:      string
  createdAt: string
}

export interface WorkspaceDocument {
  id:        string
  title:     string
  content?:  string        // TipTap JSON stringified
  filePath?: string        // URL for uploaded files (PDF/DOCX)
  type:      DocFileType
  folderId?: string | null
  isPdf:     boolean
  createdAt: string
  updatedAt: string
  // PR20 — set once by handleAiGenerated's save call when this document came from Write with AI;
  // undefined for hand-authored/pasted documents. The backend preserves it across every later
  // edit (LibraryService.SaveDocumentAsync only sets it when a save explicitly supplies a value,
  // never clears it) — do not add this to a normal title/content edit payload.
  workbenchGenerationAuditId?: string
  // New-document creation card (prompt #3) — same vocabulary as the editor toolbar's citation
  // selector, set once at creation and editable later from that same toolbar. Undefined for
  // every document created before this field existed.
  citationStyle?: FormatStyle
  documentType?: DocumentGenre
}

// Same predicate as the backend's CleanupEmptyDraftDocumentsAsync (HangfireJobs.cs) — a document
// created by "Blank document"/"New"/the editor/new route and then abandoned before the user typed
// anything. Used to keep these out of "Continue where you left off" even before that job's next
// run sweeps them up; kept in one place so the two definitions can't drift.
export function isEmptyDraftDocument(doc: WorkspaceDocument): boolean {
  return doc.title === 'Untitled document' && !doc.content?.trim()
}
