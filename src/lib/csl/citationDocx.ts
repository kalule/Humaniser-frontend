import JSZip from 'jszip'
import type { CitationDto, FormatStyle } from '../../types/citation'
import { citationRecordSource } from './citationRecord'
import { renderCslDocument } from './render'

const xml = (text: string) => text.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
}[character]!)).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')

/** A bibliography has no citation order. Numeric styles follow the supplied library order;
 * author/date styles sort and disambiguate the entire bibliography in one CSL registry. */
export async function buildCitationDocx(records: readonly CitationDto[], style: FormatStyle): Promise<ArrayBuffer> {
  if (!records.length) throw new Error('Your library is empty.')
  if (records.some(record => !record.id?.trim())) throw new Error('Reference identity needs review.')
  const sources = records.map(record => citationRecordSource(record, `library:${record.id}`))
  const rendered = renderCslDocument(sources, [], style, sources.map(source => source.id))
  if (rendered.bibliography.length !== records.length) throw new Error('Reference formatting needs review.')
  const paragraphs = rendered.bibliography.map(entry =>
    `<w:p><w:pPr><w:spacing w:after="240"/><w:ind w:left="720" w:hanging="720"/></w:pPr><w:r><w:t xml:space="preserve">${xml(entry.text)}</w:t></w:r></w:p>`).join('')
  const zip = new JSZip()
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`)
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`)
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:spacing w:after="240"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t>References</w:t></w:r></w:p>${paragraphs}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`)
  return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' })
}

export async function downloadCitationDocx(records: readonly CitationDto[], style: FormatStyle): Promise<void> {
  const data = await buildCitationDocx(records, style)
  const url = URL.createObjectURL(new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }))
  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'references.docx'
    anchor.click()
  } finally {
    // Allow the browser to consume the URL before releasing it.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
