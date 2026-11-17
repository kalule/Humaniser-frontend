import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import {
  creditEstimate, failureMessage, flagLabel, isFullyVerified, matchesFilter, matchesSearch, materialLabel, mergeLabel, originLabel,
  sortStudies, statusLabel, studyLabel, validateName, validateUpload, withCell,
  type EvidenceCell, type MatrixCell, type MatrixStudy,
} from './literatureMatrix'
import { resultMessage } from '../components/literatureMatrix/AddSourcesDialog'
import { StatusChip } from '../components/literatureMatrix/parts'
import { LAUNCH_TOOLS, isToolEnabled } from '../config/features'
import { NAV_SECTIONS, TOOLS, resolvePageTitle, toolForPath } from '../config/navigation'

const cell = (patch: Partial<MatrixCell> = {}): MatrixCell => ({
  columnId: 'c-sample', key: 'sample', value: '412 students', status: 'AbstractOnly', verified: false, edited: false,
  aiValue: '412 students', aiStatus: 'AbstractOnly', confidence: 'high', flag: null, passages: 1, ...patch,
})
const study = (patch: Partial<MatrixStudy> = {}): MatrixStudy => ({
  id: 's1', documentId: 'd1', title: 'Digital learning adoption among university students', authors: ['Jane Nakato', 'Peter Okello'], year: 2021,
  journal: 'Journal of Learning', doi: '10.1000/dl', docType: 'Journal Article', sourceDeleted: false, material: 'Abstract', uploadedFileName: null,
  possibleDuplicateOfId: null, possibleDuplicateReason: null, design: null, notes: null, extractionState: 'Extracted', provenance: [],
  addedAt: '2026-11-15T10:00:00.000Z', extractionError: null, cells: [cell()], themes: [], ...patch,
})

describe('status wording', () => {
  it('never presents "not reported" as a negative finding', () => {
    const text = statusLabel('NotReported').long
    expect(text).toMatch(/material available/)
    expect(text).toMatch(/does not mean the study did not/)
  })

  it('names the abstract as the limit of an abstract-only value', () => {
    expect(statusLabel('AbstractOnly').long).toMatch(/full text was not available/)
  })

  it('shows an unconfirmed value as something to check, whatever its confidence', () => {
    expect(statusLabel('Uncertain').short).toBe('Check this')
    expect(flagLabel('passage_not_found')).toMatch(/not in the text/)
    expect(flagLabel('number_not_in_passage')).toMatch(/number/)
  })

  it('labels the researcher\'s value as theirs', () => {
    expect(statusLabel('UserSupplied').short).toBe('Your value')
  })

  it('says what material is held, and what that means', () => {
    expect(materialLabel('Metadata').long).toMatch(/Nothing can be extracted/)
    expect(materialLabel('Abstract').short).toBe('Abstract only')
  })

  it('renders a chip with words, not colour alone, and marks a verified value', () => {
    const html = renderToStaticMarkup(createElement(StatusChip, { status: 'FullTextVerified', verified: true }))
    expect(html).toContain('Full text')
    expect(html).toContain('verified by you')
    expect(renderToStaticMarkup(createElement(StatusChip, { status: null }))).toContain('Not extracted')
  })
})

describe('study label', () => {
  it.each([
    [['Jane Nakato'], 2021, 'Nakato (2021)'],
    [['Jane Nakato', 'Peter Okello'], 2021, 'Nakato & Okello (2021)'],
    [['Nakato, J.', 'Okello, P.', 'Mensah, A.'], 2019, 'Nakato et al. (2019)'],
    [['Nakato J'], null, 'Nakato (n.d.)'],
    [[], 2020, 'No author listed (2020)'],
  ])('%j %s gives %s', (authors, year, expected) => {
    expect(studyLabel({ authors, year })).toBe(expected)
  })
})

describe('filters, search and sort', () => {
  const rows = [
    study({ id: 'a', authors: ['Zuberi, A.'], year: 2019, addedAt: '2026-11-15T10:00:01Z', material: 'FullText' }),
    study({ id: 'b', authors: ['Achieng, B.'], year: 2023, addedAt: '2026-11-15T10:00:02Z', cells: [cell({ status: 'Uncertain', value: 'about 400' })] }),
    study({ id: 'c', authors: ['Mbeki, C.'], year: null, addedAt: '2026-11-15T10:00:03Z', material: 'Metadata', cells: [], extractionState: 'NotExtracted', possibleDuplicateOfId: 'a' }),
  ]

  it('filters by what needs a person, what is missing and what material is held', () => {
    expect(rows.filter(r => matchesFilter(r, 'needs-check')).map(r => r.id)).toEqual(['b'])
    expect(rows.filter(r => matchesFilter(r, 'not-extracted')).map(r => r.id)).toEqual(['c'])
    expect(rows.filter(r => matchesFilter(r, 'full-text')).map(r => r.id)).toEqual(['a'])
    expect(rows.filter(r => matchesFilter(r, 'duplicates')).map(r => r.id)).toEqual(['c'])
    expect(rows.filter(r => matchesFilter(r, 'all'))).toHaveLength(3)
  })

  it('a row with no values is not "fully verified"; one with every value checked is', () => {
    expect(isFullyVerified(study({ cells: [] }))).toBe(false)
    expect(isFullyVerified(study({ cells: [cell({ verified: true }), cell({ columnId: 'x', value: null, status: 'NotReported' })] }))).toBe(true)
    expect(isFullyVerified(study({ cells: [cell({ verified: true }), cell({ columnId: 'x', verified: false })] }))).toBe(false)
  })

  it('searches titles, authors, values, themes and DOIs, ignoring case', () => {
    expect(matchesSearch(study(), 'OKELLO')).toBe(true)
    expect(matchesSearch(study(), '412')).toBe(true)
    expect(matchesSearch(study({ themes: ['Access'] }), 'access')).toBe(true)
    expect(matchesSearch(study(), '10.1000/dl')).toBe(true)
    expect(matchesSearch(study(), 'nursing')).toBe(false)
    expect(matchesSearch(study(), '  ')).toBe(true)
  })

  it('sorts by study, year (missing years last) and a column', () => {
    expect(sortStudies(rows, 'study', false).map(r => r.id)).toEqual(['b', 'c', 'a'])
    expect(sortStudies(rows, 'year', false).map(r => r.id)).toEqual(['a', 'b', 'c'])
    expect(sortStudies(rows, 'year', true).map(r => r.id)).toEqual(['b', 'a', 'c'])
    // "412 students" < "about 400" < (no value, always last when ascending)
    expect(sortStudies(rows, 'col:sample', false).map(r => r.id)).toEqual(['a', 'b', 'c'])
    expect(sortStudies(rows, 'added', false).map(r => r.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('editing a cell', () => {
  const evidence = (patch: Partial<EvidenceCell> = {}): EvidenceCell => ({
    columnId: 'c-sample', key: 'sample', label: 'Sample', isInterpretation: false, value: '412 undergraduates (Uganda)', status: 'UserSupplied',
    verified: false, verifiedAt: null, researcherValue: '412 undergraduates (Uganda)', researcherEditedAt: '2026-11-15T11:00:00Z',
    aiValue: '412 students', aiStatus: 'AbstractOnly', confidence: 'high', flag: null, aiModel: 'claude-haiku-4-5-20251001', promptVersion: 'lm-v1',
    aiExtractedAt: '2026-11-15T10:00:00Z', passages: [{ text: 'A survey of 412 students', basis: 'Abstract', locator: 'Abstract' }], ...patch,
  })

  it('replaces the cell and keeps the extracted value beside the researcher\'s', () => {
    const next = withCell(study(), evidence())
    expect(next.cells).toHaveLength(1)
    expect(next.cells[0]).toMatchObject({ value: '412 undergraduates (Uganda)', status: 'UserSupplied', edited: true, aiValue: '412 students', passages: 1 })
  })

  it('removes a cell that has nothing left in it', () => {
    expect(withCell(study(), evidence({ status: null, value: null, researcherValue: null, aiValue: null, passages: [] })).cells).toHaveLength(0)
  })
})

describe('messages', () => {
  it('validates the name and the file before any request', () => {
    expect(validateName('  ')).toMatch(/name/)
    expect(validateName('x'.repeat(121))).toMatch(/limit is 120/)
    expect(validateName('Chapter 2')).toBeNull()
    expect(validateUpload(new File(['x'], 'notes.txt'))).toMatch(/PDF or Word/)
    expect(validateUpload(new File([], 'paper.pdf'))).toMatch(/empty/)
    expect(validateUpload(new File(['x'], 'Paper.DOCX'))).toBeNull()
  })

  it('shows the server\'s own validation message, and says nothing was charged when credits run out', () => {
    expect(failureMessage({ code: 'ERROR', message: 'Choose at least one study to extract.' }, 'extract')).toBe('Choose at least one study to extract.')
    expect(failureMessage({ response: { status: 402 } }, 'extract')).toMatch(/Nothing was charged/)
    expect(failureMessage(new Error('x'), 'extract')).toMatch(/Nothing was charged/)
  })

  it('counts credits only for studies that have text to read', () => {
    expect(creditEstimate([study(), study({ id: 'm', material: 'Metadata' }), study({ id: 'f', material: 'FullText' })], 3)).toBe(6)
  })

  it('says how a source was found and why it was merged', () => {
    expect(originLabel({ origin: 'SearchResult', provider: 'OpenAlex', providerRecordId: 'W1', query: 'digital learning', retrievedAt: null, fileName: null, mergedBy: null, addedAt: '' }))
      .toBe('Literature search via OpenAlex for "digital learning"')
    expect(originLabel({ origin: 'Upload', provider: null, providerRecordId: null, query: null, retrievedAt: null, fileName: 'a.pdf', mergedBy: null, addedAt: '' })).toBe('Uploaded file a.pdf')
    expect(mergeLabel('TitleYear')).toBe('same title and year')
  })

  it('reports merges, possible duplicates and why something was not added', () => {
    expect(resultMessage({
      added: 2, merged: 1, flagged: 1, skipped: 1,
      outcomes: [{ outcome: 'skipped', title: 't', studyId: null, rule: null, reason: 'This file is already in the matrix.', otherStudyId: null }],
    })).toBe('2 added, 1 merged with a study already in the matrix, 1 added and marked as a possible duplicate for you to check, 1 not added. This file is already in the matrix.')
  })
})

describe('registration', () => {
  it('has no menu item of its own: it lives under Literature Review, and stays a Beta tool hidden at launch', () => {
    expect(NAV_SECTIONS.flatMap(s => s.items).map(i => i.id)).not.toContain('literature-matrix')
    expect(NAV_SECTIONS.find(s => s.section === 'Find sources')!.items.map(i => i.id)).toEqual(['saved-sources', 'deep-research'])
    expect(TOOLS['literature-matrix']).toMatchObject({ link: '/app/literature-matrix', badge: 'Beta', label: 'Literature Matrix' })
    expect(LAUNCH_TOOLS.has('literature-matrix')).toBe(false)
    expect(isToolEnabled('literature-matrix', true)).toBe(true)
  })

  it('its pages belong to Literature Review for the menu highlight and the header title', () => {
    expect(toolForPath('/app/literature-matrix/abc')?.id).toBe('literature-review')
    expect(resolvePageTitle('/app/literature-matrix')).toBe('Literature Review')
  })
})
