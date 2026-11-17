import { describe, expect, it } from 'vitest'
import { docTypeLabel, isAbandonedBlankDraft, wordCountLabel } from './documentRow'

const emptyParagraphDoc = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] })
const writtenDoc = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Some words here' }] }] })

describe('docTypeLabel', () => {
  it('prefers the creation-card genre', () => {
    expect(docTypeLabel({ documentType: 'Essay', type: 'doc' })).toBe('Essay')
    expect(docTypeLabel({ documentType: 'LiteratureReview', type: 'doc' })).toBe('Lit review')
    expect(docTypeLabel({ documentType: 'ResearchPaper', type: 'doc' })).toBe('Paper')
  })
  it('falls back to the file type so no row is without a label', () => {
    expect(docTypeLabel({ type: 'doc' })).toBe('Document')
    expect(docTypeLabel({ type: 'pdf', isPdf: true })).toBe('PDF')
    expect(docTypeLabel({ type: 'docx' })).toBe('Word file')
    expect(docTypeLabel({ documentType: 'Other', type: 'md' })).toBe('Markdown')
  })
})

describe('wordCountLabel', () => {
  it('always yields a label, including zero', () => {
    expect(wordCountLabel(0)).toBe('0 words')
    expect(wordCountLabel(1)).toBe('1 word')
    expect(wordCountLabel(1907)).toBe(`${(1907).toLocaleString()} words`)
  })
})

describe('isAbandonedBlankDraft (hidden from the Documents list, never deleted)', () => {
  it('flags untitled documents with no words, including an empty editor document', () => {
    expect(isAbandonedBlankDraft({ title: 'Untitled document', content: undefined })).toBe(true)
    expect(isAbandonedBlankDraft({ title: 'Untitled document', content: '' })).toBe(true)
    expect(isAbandonedBlankDraft({ title: 'Untitled document', content: emptyParagraphDoc })).toBe(true)
  })
  it('keeps anything the user has named or written in', () => {
    expect(isAbandonedBlankDraft({ title: 'Untitled document', content: writtenDoc })).toBe(false)
    expect(isAbandonedBlankDraft({ title: 'My essay', content: undefined })).toBe(false)
  })
  it('never hides uploaded files', () => {
    expect(isAbandonedBlankDraft({ title: 'Untitled document', filePath: 'blob:x' })).toBe(false)
    expect(isAbandonedBlankDraft({ title: 'Untitled document', isPdf: true })).toBe(false)
  })
})
