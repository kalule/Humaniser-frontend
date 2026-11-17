import { documentWordCount } from './documentExport'

// Rules for what a Documents list row says, kept out of the JSX so they can be tested.

const GENRE_LABEL: Record<string, string> = {
  Essay: 'Essay',
  LiteratureReview: 'Lit review',
  ResearchPaper: 'Paper',
  ThesisChapter: 'Thesis',
}

const FILE_TYPE_LABEL: Record<string, string> = {
  pdf: 'PDF',
  docx: 'Word file',
  md: 'Markdown',
  txt: 'Text',
}

/** Every row carries a type label: the creation-card genre when there is one, otherwise the file type. */
export function docTypeLabel(doc: { documentType?: string; type: string; isPdf?: boolean }): string {
  if (doc.documentType && GENRE_LABEL[doc.documentType]) return GENRE_LABEL[doc.documentType]
  if (doc.isPdf) return 'PDF'
  return FILE_TYPE_LABEL[doc.type] ?? 'Document'
}

/** "0 words", "1 word", "1,234 words" — always shown, so every row has one. */
export function wordCountLabel(words: number): string {
  return words === 1 ? '1 word' : `${words.toLocaleString()} words`
}

/**
 * A document nobody has written in yet: still the default title and no words. These are created the
 * moment "New document" is clicked and abandoned just as often, so the list hides (never deletes) them.
 */
export function isAbandonedBlankDraft(doc: { title: string; content?: string; filePath?: string; isPdf?: boolean }): boolean {
  if (doc.filePath || doc.isPdf) return false
  const title = doc.title?.trim() ?? ''
  return (title === '' || title === 'Untitled document') && documentWordCount(doc.content) === 0
}
