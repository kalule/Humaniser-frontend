import { describe, expect, it } from 'vitest'
import { Schema } from '@tiptap/pm/model'
import { EditorState } from '@tiptap/pm/state'
import { history, undo, redo, closeHistory } from '@tiptap/pm/history'
import { citationItems, formatCitationGroup, interactiveCitationTokens, refreshCitationLabels, replaceCitationItems, updateSharedSource, linkSavedSource, upgradeLegacyCitations, sourceFromCitation, type CitationItem, type EditorSource } from './editorCitations'
import { safeSourceUrl, citationPopoverContentHeight, citationPopoverPosition } from './citationPopover'
import type { CitationDto } from '../types/citation'

const schema = new Schema({ nodes: {
  doc: { content: 'block+' }, paragraph: { group: 'block', content: 'inline*' }, text: { group: 'inline' },
  citation: { group: 'inline', inline: true, atom: true, attrs: { occurrenceId: { default: '' }, items: { default: [] }, label: { default: '' }, citationId: { default: null }, narrative: { default: false } } },
  citationReference: { group: 'block', atom: true, attrs: { source: {}, label: { default: '' } } },
}, marks: { bold: {} } })
const smith: EditorSource = { id: 'source:1', title: 'First work', authors: 'Jane Smith', authorDetails: [{ given: 'Jane', family: 'Smith' }], year: 2020, yearLabel: '2020b' }
const jones: EditorSource = { id: 'source:2', title: 'Second work', authors: 'Kim Jones', authorDetails: [{ given: 'Kim', family: 'Jones' }], year: 2024 }
const items: CitationItem[] = [{ sourceId: smith.id, source: smith, locator: 'pp. 2–4' }, { sourceId: jones.id, source: jones, locator: 'p. 9' }]
function state() {
  const citation = (occurrenceId: string) => schema.nodes.citation.create({ occurrenceId, items, label: formatCitationGroup(items, 'apa7', [smith.id, jones.id]) }, null, [schema.marks.bold.create()])
  return EditorState.create({ schema, plugins: [history()], doc: schema.nodes.doc.create(null, [
    schema.nodes.paragraph.create(null, [schema.text('Claim '), citation('first'), schema.text('. Again '), citation('second'), schema.text('.')]),
    schema.nodes.citationReference.create({ source: smith, label: 'Old reference' }),
    schema.nodes.citationReference.create({ source: jones, label: 'Other reference' }),
  ]) })
}
const firstPos = 7

describe('essay citation transactions', () => {
  it('formats a grouped citation through the existing formatter, preserving suffix and locators', () => {
    expect(formatCitationGroup(items, 'apa7', [smith.id, jones.id])).toBe('(Smith, 2020b, pp. 2–4; Jones, 2024, p. 9)')
    expect(formatCitationGroup(items, 'ieee', [smith.id, jones.id])).toBe('[1, pp. 2–4, 2, p. 9]')
    expect(formatCitationGroup([items[0]], 'mla', [smith.id])).toBe('(Smith pp. 2–4)')
  })
  it('removes only one source at the selected location, retaining the library snapshot and other occurrences', () => {
    const original = state()
    const next = original.apply(replaceCitationItems(original.tr, firstPos, [items[1]], 'apa7'))
    expect(next.doc.nodeAt(firstPos)!.attrs.items).toEqual([items[1]])
    const occurrences: unknown[] = []
    next.doc.descendants(n => { if (n.type.name === 'citation') occurrences.push(n.attrs.items) })
    expect(occurrences).toEqual([[items[1]], items])
    expect(next.doc.lastChild!.attrs.source).toEqual(smith)
    expect(next.doc.child(1).attrs.source).toEqual(jones)
  })
  it('splits in one undoable transaction, retaining source order, locators and surrounding marks', () => {
    let current = state(); const original = current.doc.toJSON()
    current = current.apply(closeHistory(replaceCitationItems(current.tr, firstPos, items, 'apa7', true)))
    const nodes: { label: string; items: CitationItem[]; marks: string[] }[] = []
    current.doc.descendants(node => { if (node.type.name === 'citation') nodes.push({ label: node.attrs.label, items: node.attrs.items, marks: node.marks.map(mark => mark.type.name) }) })
    expect(nodes.slice(0, 2).map(node => node.label)).toEqual(['(Smith, 2020, pp. 2–4)', '(Jones, 2024, p. 9)'])
    expect(nodes[0].marks).toEqual(['bold'])
    expect(nodes[1].items[0].locator).toBe('p. 9')
    const split = current.doc.toJSON()
    expect(undo(current, tr => { current = current.apply(tr) })).toBe(true)
    expect(current.doc.toJSON()).toEqual(original)
    expect(redo(current, tr => { current = current.apply(tr) })).toBe(true)
    expect(current.doc.toJSON()).toEqual(split)
    expect(schema.nodeFromJSON(JSON.parse(JSON.stringify(split))).toJSON()).toEqual(split)
  })
  it('removes an empty citation without leaving a space before punctuation', () => {
    const current = state().apply(replaceCitationItems(state().tr, firstPos, [], 'apa7'))
    expect(current.doc.firstChild!.firstChild!.text).toBe('Claim. Again ')
    expect(current.doc.firstChild!.lastChild!.text).toBe('.')
  })
  it('updates shared metadata and the bibliography in one undoable document change', () => {
    let current = state()
    const before = current.doc.toJSON()
    const source = { ...smith, title: 'Revised title', year: 2021, yearLabel: '2021a' }
    current = current.apply(closeHistory(refreshCitationLabels(updateSharedSource(current.tr, source), 'apa7')))
    let count = 0
    current.doc.descendants(node => { if (node.type.name === 'citation') { expect(node.attrs.label).toContain('2021'); expect(node.attrs.label).not.toContain('2021a'); expect(node.attrs.items[0].source.title).toBe('Revised title'); count++ } })
    expect(count).toBe(2)
    expect(current.doc.lastChild!.attrs.label).toContain('Revised title')
    undo(current, tr => { current = current.apply(tr) }); expect(current.doc.toJSON()).toEqual(before)
  })
  it('does not substitute another source when an ID cannot be resolved', () => {
    expect(citationItems({ citationId: 'missing', label: '(Smith, 2020)' }, [])).toEqual([{ sourceId: 'library:missing', source: undefined, originalLabel: '(Smith, 2020)' }])
    expect(formatCitationGroup([{ sourceId: 'missing', originalLabel: '(Smith, 2020)' }], 'apa7', [])).toBe('(Smith, 2020)')
  })
  it('resolves an existing library ID when the library finishes loading after the document', () => {
    const record = { id: 'loaded', title: 'Loaded source', authors: [], publicationYear: 2024 } as CitationDto
    const resolved = citationItems({ items: [{ sourceId: 'library:loaded', originalLabel: '(Loaded, 2024)' }] }, [record])
    expect(resolved[0].source!.title).toBe('Loaded source')
    expect(resolved[0].source!.libraryId).toBe('loaded')
  })
  it('attaches a late library-save response by ID without overwriting a newer edit or another source', () => {
    let current = state()
    current = current.apply(updateSharedSource(current.tr, { ...smith, title: 'Edited while save was pending' }))
    current = current.apply(linkSavedSource(current.tr, smith.id, 'saved-library-id'))
    const sources = current.doc.nodeAt(firstPos)!.attrs.items as CitationItem[]
    expect(sources[0].source!.title).toBe('Edited while save was pending')
    expect(sources[0].source!.libraryId).toBe('saved-library-id')
    expect(sources[1].source!.libraryId).toBeUndefined()
    expect(current.doc.child(1).attrs.source.libraryId).toBe('saved-library-id')
  })
  it('imports stable grouped and narrative generation tokens, not displayed author/year matches', () => {
    const refs = [{ sourceId: 'S1', ...smith, authorDetails: [...smith.authorDetails!], url: null, source: 'web' as const }, { sourceId: 'S2', ...jones, authorDetails: [...jones.authorDetails!], url: null, source: 'web' as const }]
    const html = interactiveCitationTokens('Claim[S1] [S2]. [N:S1] agrees.', refs, 'harvard', 'generation-1')
    expect(html.match(/<cite /g)).toHaveLength(2)
    expect(html).toContain('generation-1:S1')
    expect(html).toContain('(Smith, 2020; Jones, 2024)')
    expect(html).toContain('Smith (2020)')
    expect(html.replace(/<[^>]*>/g, '')).not.toContain('[S1]')
  })
  it('upgrades old drafts as unresolved and leaves links, ordinary parentheses and bibliography text intact', () => {
    const result = upgradeLegacyCitations({ type: 'doc', content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Claim (Smith, 2020; Jones, 2024). Context (see figure).' }, { type: 'text', text: '(Smith, 2020)', marks: [{ type: 'link', attrs: { href: 'https://example.org' } }] }] },
      { type: 'heading', content: [{ type: 'text', text: 'REFERENCES' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Smith (2020). Full reference.' }] },
    ] }, [])
    const citation = result.content![0].content![1]
    expect(citation.type).toBe('citation')
    expect(citation.attrs!.items).toHaveLength(2)
    expect(citation.attrs!.items[0].source).toBeUndefined()
    expect(result.content![0].content!.at(-1)!.marks![0].type).toBe('link')
    expect(result.content![2].type).toBe('citationReference')
    expect(result.content![2].attrs!.source.rawReference).toBe('Smith (2020). Full reference.')
    expect(upgradeLegacyCitations(result, [])).toEqual(result)
  })
})

describe('CSL editor context', () => {
  it('preserves book publisher metadata through library import and bibliography rendering', () => {
    const source = sourceFromCitation({ id: 'book', title: 'Assessment Handbook', authors: [],
      itemType: 'Book', publicationYear: 2024, publisher: 'Example University Press', journalName: null } as CitationDto)
    expect(source.publisher).toBe('Example University Press')
    expect(source.venue).toBeNull()
    const original = EditorState.create({ schema, doc: schema.nodes.doc.create(null, [
      schema.nodes.paragraph.create(null, schema.nodes.citation.create({ occurrenceId: 'book',
        items: [{ sourceId: source.id, source }], label: 'Old' })),
      schema.nodes.citationReference.create({ source, label: 'Old' }),
    ]) })
    const next = original.apply(refreshCitationLabels(original.tr, 'apa7'))
    expect(next.doc.lastChild!.attrs.label).toContain('Example University Press')
    expect(next.doc.lastChild!.attrs.label).toContain('Assessment Handbook')
  })

  it('flags a mismatched source snapshot rather than displaying a different paper under that ID', () => {
    expect(formatCitationGroup([{ sourceId: 'wrong-id', source: smith }], 'apa7', []))
      .toBe('[Citation source identity needs review]')
  })
  it('renumbers and reorders bibliography rows together without changing prose or source snapshots', () => {
    const cite = (source: EditorSource) => schema.nodes.citation.create({ occurrenceId: source.id,
      items: [{ sourceId: source.id, source }], label: 'Old' })
    const original = EditorState.create({ schema, doc: schema.nodes.doc.create(null, [
      schema.nodes.paragraph.create(null, [schema.text('First '), cite(jones), schema.text('. Then '), cite(smith), schema.text('.')]),
      schema.nodes.citationReference.create({ source: smith, label: 'Old' }),
      schema.nodes.citationReference.create({ source: jones, label: 'Old' }),
    ]) })
    const next = original.apply(refreshCitationLabels(original.tr, 'ieee'))
    const labels: string[] = []
    next.doc.descendants(node => { if (node.type.name === 'citation') labels.push(node.attrs.label) })
    expect(labels).toEqual(['[1]', '[2]'])
    expect(next.doc.child(1).attrs.source).toEqual(jones)
    expect(next.doc.child(1).attrs.label).toMatch(/^\[1\]/)
    expect(next.doc.lastChild!.attrs.source).toEqual(smith)
    expect(next.doc.firstChild!.firstChild!.text).toBe('First ')
    expect(refreshCitationLabels(next.tr, 'ieee').docChanged).toBe(false)
  })

  it('preserves raw legacy references and ordinary text between structured reference groups', () => {
    const raw = { id: 'legacy', title: 'Verbatim reference', rawReference: 'Verbatim reference' }
    const original = EditorState.create({ schema, doc: schema.nodes.doc.create(null, [
      schema.nodes.citationReference.create({ source: smith, label: 'Old' }),
      schema.nodes.citationReference.create({ source: raw, label: 'Verbatim reference' }),
      schema.nodes.paragraph.create(null, schema.text('My annotation.')),
      schema.nodes.citationReference.create({ source: jones, label: 'Old' }),
    ]) })
    const next = original.apply(refreshCitationLabels(original.tr, 'apa7'))
    expect(next.doc.child(1).toJSON()).toEqual(original.doc.child(1).toJSON())
    expect(next.doc.child(2).toJSON()).toEqual(original.doc.child(2).toJSON())
    expect(next.doc.child(0).attrs.source).toEqual(smith)
    expect(next.doc.child(3).attrs.source).toEqual(jones)
  })

  it('keeps mixed unknown clusters as explicit review items after refresh', () => {
    const original = EditorState.create({ schema, doc: schema.nodes.doc.create(null, [
      schema.nodes.paragraph.create(null, schema.nodes.citation.create({
        items: [{ sourceId: smith.id, source: smith, originalLabel: '[S1]' }, { sourceId: 'missing', originalLabel: '[S99]' }], label: 'Old',
      })),
    ]) })
    const next = original.apply(refreshCitationLabels(original.tr, 'apa7'))
    expect(next.doc.firstChild!.firstChild!.attrs.label).toBe('[Citation needs review: S1, S99]')
  })
})

describe('citation popover safety and positioning', () => {
  it('includes the source list when choosing placement, even when the rendered flex body was collapsed', () => {
    const naturalHeight = citationPopoverContentHeight(54, 310, 40)
    const position = citationPopoverPosition({ left: 820, top: 568, bottom: 588 }, 1536, 720, naturalHeight)
    expect(naturalHeight).toBe(406)
    expect(position.top).toBe(154)
    expect(position.maxHeight - 54 - 40).toBeGreaterThanOrEqual(310)
  })
  it('recomputes room for an expanded source list instead of retaining the previously capped panel height', () => {
    const anchor = { left: 300, top: 100, bottom: 120 }
    const initial = citationPopoverPosition(anchor, 1280, 800, citationPopoverContentHeight(54, 220, 40))
    const expanded = citationPopoverPosition(anchor, 1280, 800, citationPopoverContentHeight(54, 900, 40))
    expect(expanded.maxHeight).toBeGreaterThan(initial.maxHeight)
    expect(expanded.top + expanded.maxHeight).toBeLessThanOrEqual(792)
  })
  it('allows HTTP/HTTPS and DOI destinations, rejecting executable URLs and credentials', () => {
    expect(safeSourceUrl('javascript:alert(1)')).toBeNull()
    expect(safeSourceUrl('data:text/html,x')).toBeNull()
    expect(safeSourceUrl('https://user:secret@example.org')).toBeNull()
    expect(safeSourceUrl(null, 'doi:10.1234/paper')).toBe('https://doi.org/10.1234/paper')
    expect(safeSourceUrl('https://example.org/paper')).toBe('https://example.org/paper')
  })
  it('flips at viewport edges, clamps horizontally and recomputes after scrolling', () => {
    const bottom = citationPopoverPosition({ left: 1150, top: 650, bottom: 670 }, 1280, 720, 440)
    expect(bottom.left).toBe(752); expect(bottom.top).toBeLessThan(650)
    expect(bottom.top + bottom.maxHeight).toBeLessThanOrEqual(712)
    const scrolled = citationPopoverPosition({ left: 1150, top: 100, bottom: 120 }, 1280, 720, 440)
    expect(scrolled.top).toBe(128)
  })
  it('clamps against the panel width it is given', () => {
    const narrow = citationPopoverPosition({ left: 1150, top: 650, bottom: 670 }, 1280, 720, 300, 448)
    expect(narrow.left).toBe(1280 - 448 - 8)
  })
  it('uses a bounded bottom sheet on small screens', () => {
    const mobile = citationPopoverPosition({ left: 320, top: 500, bottom: 520 }, 375, 667, 900)
    expect(mobile.left).toBe(8); expect(mobile.top + mobile.maxHeight).toBe(659)
    expect(mobile.maxHeight).toBeLessThan(667 * 0.8)
  })
})
