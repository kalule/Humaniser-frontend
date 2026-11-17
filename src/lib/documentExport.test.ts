import { describe, expect, it } from 'vitest'
import { buildExportReferences, documentWordCount, exportFileName, isDocumentEmpty, isExportable } from './documentExport'

const para = (...children: unknown[]) => ({ type: 'paragraph', content: children })
const text = (t: string) => ({ type: 'text', text: t })
const doc = (...content: unknown[]) => JSON.stringify({ type: 'doc', content })

describe('exportFileName', () => {
  it('uses the document title and the format extension', () => {
    expect(exportFileName('Telemedicine barriers', 'docx')).toBe('Telemedicine barriers.docx')
    expect(exportFileName('Telemedicine barriers', 'pdf')).toBe('Telemedicine barriers.pdf')
  })
  it('strips characters that are illegal in file names', () => {
    expect(exportFileName('a/b\\c:d*e?f"g<h>i|j', 'pdf')).toBe('abcdefghij.pdf')
  })
  it('falls back for untitled, blank and reserved names', () => {
    expect(exportFileName('Untitled document', 'docx')).toBe('HumaniseAI document.docx')
    expect(exportFileName('   ', 'docx')).toBe('HumaniseAI document.docx')
    expect(exportFileName(undefined, 'pdf')).toBe('HumaniseAI document.pdf')
    expect(exportFileName('CON', 'pdf')).toBe('HumaniseAI document.pdf')
  })
  it('trims trailing dots and over-long titles', () => {
    expect(exportFileName('Report v2...', 'docx')).toBe('Report v2.docx')
    expect(exportFileName('x'.repeat(300), 'docx').length).toBe(120 + '.docx'.length)
  })
})

describe('empty-document detection (drives the disabled Download button)', () => {
  it('treats missing, blank and whitespace-only documents as empty', () => {
    expect(isDocumentEmpty(undefined)).toBe(true)
    expect(isDocumentEmpty('')).toBe(true)
    expect(isDocumentEmpty(doc(para()))).toBe(true)
    expect(isDocumentEmpty(doc(para(text('   '))))).toBe(true)
  })
  it('is not empty once there is text', () => {
    expect(isDocumentEmpty(doc(para(text('Hello world'))))).toBe(false)
    expect(documentWordCount(doc(para(text('Hello world'))))).toBe(2)
  })
  it('does not count bibliography blocks as writing', () => {
    expect(isDocumentEmpty(doc({ type: 'citationReference', attrs: { label: 'Smith (2020). Title.', source: { id: 's1' } } }))).toBe(true)
  })
  it('counts plain-text legacy content', () => {
    expect(isDocumentEmpty('<p>Legacy body</p>')).toBe(false)
  })
})

describe('isExportable', () => {
  it('allows written documents and rejects uploaded files', () => {
    expect(isExportable({ isPdf: false, type: 'doc', filePath: undefined })).toBe(true)
    expect(isExportable({ isPdf: true, type: 'pdf', filePath: 'blob:x' })).toBe(false)
    expect(isExportable({ isPdf: false, type: 'docx', filePath: 'https://x/y.docx' })).toBe(false)
  })
})

describe('buildExportReferences', () => {
  const source = { id: 'library:1', title: 'Rural access to care', authors: 'Smith, J.', year: 2020, journal: 'Journal of Health' }
  const cite = (id: string, src?: unknown) => ({
    type: 'citation', attrs: { occurrenceId: id, label: '(Smith, 2020)', items: [{ sourceId: 'library:1', source: src }] },
  })

  it('lists each cited source once, in order of first appearance', () => {
    const refs = buildExportReferences(doc(para(text('A '), cite('a', source), text(' B '), cite('b', source))), [], 'apa7')
    expect(refs).toHaveLength(1)
    expect(refs[0]).toContain('Rural access to care')
  })
  it('does not repeat sources already present as bibliography blocks in the body', () => {
    const refs = buildExportReferences(
      doc(para(cite('a', source)), { type: 'citationReference', attrs: { label: 'Smith (2020).', source } }), [], 'apa7')
    expect(refs).toEqual([])
  })
  it('returns nothing for a document without citations or with unreadable content', () => {
    expect(buildExportReferences(doc(para(text('No citations'))), [], 'apa7')).toEqual([])
    expect(buildExportReferences('not json', [], 'apa7')).toEqual([])
    expect(buildExportReferences(undefined, [], 'apa7')).toEqual([])
  })
})
