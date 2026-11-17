import { describe, expect, it } from 'vitest'
import { cautionText, contentLabel, workTypeLabel } from './paperSearchLabels'

describe('paperSearchLabels', () => {
  it('maps provider work types and passes unknown ones through readably', () => {
    expect(workTypeLabel('article')).toBe('Article')
    expect(workTypeLabel('proceedings-article')).toBe('Conference paper')
    expect(workTypeLabel('standard-document')).toBe('Standard document')
    expect(workTypeLabel(undefined)).toBeNull()
    expect(workTypeLabel('  ')).toBeNull()
  })

  it('never calls a PDF link full text, and defaults to metadata only', () => {
    expect(contentLabel('pdf').label).toBe('PDF link')
    expect(contentLabel('pdf').label.toLowerCase()).not.toContain('full text')
    expect(contentLabel('abstract').label).toBe('Abstract')
    expect(contentLabel(undefined).label).toBe('Metadata only')
  })

  it('explains a book review in terms of who the author is', () => {
    expect(cautionText('book-review')).toMatch(/reviewer/)
    expect(cautionText('erratum')).toMatch(/correction/)
    expect(cautionText(undefined)).toBeNull()
  })
})
