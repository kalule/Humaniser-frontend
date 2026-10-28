import { describe, expect, it } from 'vitest'
import { renderCslDocument, toCslItem, type CslSource } from './render'

const smith: CslSource = { id: 'S1', title: 'Assessment and anxiety', authorDetails: [{ family: 'Smith', given: 'Jane' }],
  year: 2023, venue: 'Journal of Learning', volume: '12', issue: '2', pages: '10-20', doi: '10.1234/assessment' }
const jones: CslSource = { id: 'S2', title: 'Faculty workload', authorDetails: [{ family: 'Jones', given: 'Kim' }], year: 2024 }

describe('CSL document rendering', () => {
  it.each([
    ['JournalArticle', 'article-journal'], ['journal-article', 'article-journal'],
    ['article-journal', 'article-journal'], ['journal_article', 'article-journal'],
    ['Book', 'book'], ['BookChapter', 'chapter'], ['book_chapter', 'chapter'],
    ['ConferencePaper', 'paper-conference'], ['paper-conference', 'paper-conference'],
    ['WebPage', 'webpage'], [' Report ', 'report'],
    ['constructor', 'document'], ['unrecognized-type', 'document'],
    ['journal', 'article-journal'], ['conference', 'paper-conference'],
  ])('normalizes imported item type %s without changing its meaning', (itemType, expected) => {
    expect(toCslItem({ id: 'import', title: 'Imported work', itemType }).type).toBe(expected)
  })

  it('formats citation clusters and bibliography from the same registry', () => {
    const rendered = renderCslDocument([smith, jones], [
      { id: 'c1', items: [{ sourceId: 'S1', locator: 'p. 14' }, { sourceId: 'S2' }] },
      { id: 'c2', items: [{ sourceId: 'S1' }], narrative: true },
    ], 'apa7')
    expect(rendered.citations.get('c1')).toBe('(Jones, 2024; Smith, 2023, p. 14)')
    expect(rendered.citations.get('c2')).toBe('Smith (2023)')
    expect(rendered.bibliography.map(entry => entry.sourceId)).toEqual(['S2', 'S1'])
    expect(rendered.bibliography[1].text).toContain('https://doi.org/10.1234/assessment')
  })

  it('uses first-citation numbering rather than retrieval or supplied bibliography order', () => {
    const result = renderCslDocument([smith, jones], [
      { id: 'c1', items: [{ sourceId: 'S2' }] }, { id: 'c2', items: [{ sourceId: 'S1' }] },
      { id: 'c3', items: [{ sourceId: 'S2' }] },
    ], 'ieee')
    expect([...result.citations.values()]).toEqual(['[1]', '[2]', '[1]'])
    expect(result.bibliography.map(entry => entry.sourceId)).toEqual(['S2', 'S1'])
  })

  it('retroactively disambiguates earlier citations from complete document context', () => {
    const second = { ...smith, id: 'S3', title: 'Better learning' }
    const result = renderCslDocument([smith, second], [
      { id: 'c1', items: [{ sourceId: 'S1' }] }, { id: 'c2', items: [{ sourceId: 'S3' }] },
    ], 'apa7')
    expect(result.citations.get('c1')).toBe('(Smith, 2023a)')
    expect(result.citations.get('c2')).toBe('(Smith, 2023b)')
    expect(result.bibliography[0].text).toContain('(2023a)')
    expect(result.bibliography[1].text).toContain('(2023b)')
  })

  it.each(['apa7', 'harvard', 'mla', 'ieee', 'chicago', 'vancouver'] as const)('loads an independent %s style', style => {
    const result = renderCslDocument([smith], [{ id: 'c', items: [{ sourceId: 'S1' }] }], style)
    expect(result.citations.get('c')).toBeTruthy()
    expect(result.bibliography[0].text.toLowerCase()).toContain('assessment and anxiety')
  })

  it('validates the entire cluster before rendering, including unknown members of mixed clusters', () => {
    expect(() => renderCslDocument([smith], [{ id: 'c', items: [{ sourceId: 'S1' }, { sourceId: 'S9' }] }], 'apa7')).toThrow('Unverified citation source: S9')
    expect(() => renderCslDocument([smith, smith], [], 'apa7')).toThrow('duplicate')
  })

  it('does not invent missing metadata or a locator from a publication page range', () => {
    const source = { id: 'anon', title: 'Untitled authorship', pages: '1-20' }
    expect(toCslItem(source)).not.toHaveProperty('author')
    expect(toCslItem(source)).not.toHaveProperty('issued')
    const result = renderCslDocument([source], [{ id: 'c', items: [{ sourceId: 'anon' }] }], 'apa7')
    expect(result.citations.get('c')).not.toContain('1–20')
    expect(result.citations.get('c')).not.toContain('Unknown author')
  })

  it('does not mutate source metadata', () => {
    const before = JSON.stringify(smith)
    renderCslDocument([smith], [{ id: 'c', items: [{ sourceId: 'S1' }] }], 'apa7')
    expect(JSON.stringify(smith)).toBe(before)
  })

  it('keeps grouped narrative sources individually named and cited', () => {
    const result = renderCslDocument([smith, jones], [{ id: 'c', narrative: true,
      items: [{ sourceId: 'S1' }, { sourceId: 'S2' }] }], 'apa7')
    expect(result.citations.get('c')).toBe('Smith (2023) and Jones (2024)')
  })

  it('preserves corporate authors and structured surname particles without inventing personal names', () => {
    const organization = { id: 'org', title: 'Education policy', authors: 'United Nations', year: 2024 }
    expect(toCslItem(organization).author).toEqual([{ literal: 'United Nations' }])
    expect(renderCslDocument([organization], [{ id: 'c', items: [{ sourceId: 'org' }] }], 'apa7').citations.get('c')).toBe('(United Nations, 2024)')
    expect(toCslItem({ ...smith, authorDetails: [{ family: 'van der Merwe', given: 'Anna' }] }).author)
      .toEqual([{ family: 'van der Merwe', given: 'Anna' }])
  })

  it('reuses completed context across position changes without leaking mutable state or old occurrence IDs', () => {
    const first = renderCslDocument([smith], [{ id: 'position-7', items: [{ sourceId: 'S1' }] }], 'apa7')
    first.citations.set('position-7', 'Corrupted'); first.bibliography[0].text = 'Corrupted'
    const next = renderCslDocument([smith], [{ id: 'position-12', items: [{ sourceId: 'S1' }] }], 'apa7')
    expect(next.citations.has('position-7')).toBe(false)
    expect(next.citations.get('position-12')).toBe('(Smith, 2023)')
    expect(next.bibliography[0].text).not.toBe('Corrupted')
  })

  it('starts numbering independently for each document and reserves no numbers for uncited rows', () => {
    const result = renderCslDocument([smith, jones], [{ id: 'c', items: [{ sourceId: 'S2' }] }], 'ieee', ['S1', 'S2'])
    expect(result.citations.get('c')).toBe('[1]')
    expect(result.bibliography.map(entry => entry.sourceId)).toEqual(['S2', 'S1'])
    const second = renderCslDocument([smith], [{ id: 'c', items: [{ sourceId: 'S1' }] }], 'ieee')
    expect(second.citations.get('c')).toBe('[1]')
  })
})
