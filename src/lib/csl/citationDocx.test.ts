import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import mammoth from 'mammoth'
import { FORMAT_STYLES, type CitationDto } from '../../types/citation'
import { buildCitationDocx } from './citationDocx'

const record = { id: 'one', title: 'Assessment & learning <today>', authors: [{ firstName: 'Jane', middleInitial: '', lastName: 'Smith' }],
  itemType: 'Book', publicationYear: 2024, journalName: null, publisher: 'Example Press',
  volume: null, issue: null, pages: null, doi: null, url: null, cachedApa7: 'STALE' } as CitationDto

describe('CSL bibliography DOCX export', () => {
  it.each(FORMAT_STYLES)('creates a readable real DOCX for %s from metadata', async style => {
    const data = await buildCitationDocx([record], style)
    const extracted = await mammoth.extractRawText({ buffer: Buffer.from(data) })
    expect(extracted.value).toContain('References')
    expect(extracted.value.toLowerCase()).toContain('assessment & learning <today>')
    expect(extracted.value).toContain('Example Press')
    expect(extracted.value).not.toContain('STALE')
    const zip = await JSZip.loadAsync(data)
    const document = await zip.file('word/document.xml')!.async('string')
    expect(document).toContain('w:hanging="720"')
    expect(document).toContain('&amp;')
    expect(document).not.toContain('<today>')
  })

  it('sorts and disambiguates all bibliography entries together', async () => {
    const data = await buildCitationDocx([{ ...record, title: 'Zebra learning' }, { ...record, id: 'two', title: 'Alpha learning' }], 'apa7')
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(data) })
    expect(value.indexOf('Alpha learning')).toBeLessThan(value.indexOf('Zebra learning'))
    expect(value).toContain('(2024a)')
    expect(value).toContain('(2024b)')
  })

  it('rejects an invalid library atomically rather than exporting partial references', async () => {
    await expect(buildCitationDocx([], 'apa7')).rejects.toThrow('empty')
    await expect(buildCitationDocx([record, record], 'apa7')).rejects.toThrow('duplicate')
    await expect(buildCitationDocx([record, { ...record, id: 'two', title: ' ' }], 'apa7')).rejects.toThrow('bibliography source')
    await expect(buildCitationDocx([{ ...record, id: '' }], 'apa7')).rejects.toThrow('identity')
  })
})
