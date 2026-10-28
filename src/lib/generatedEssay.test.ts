import { describe, expect, it } from 'vitest'
import type { WriteWithAiResponse, WriteWithAiReference } from '../types/workbench'
import { appendGeneratedReferenceSection, renderGeneratedEssay } from './generatedEssay'
import { interactiveCitationTokens, repairUnresolvedCitationSources } from './editorCitations'
import { buildWordExportHtml } from './wordExport'
import type { JSONContent } from '@tiptap/core'

const refs = [
  { sourceId: 'S1', title: 'Wartime cooperation', authors: 'Benson', year: 2023, source: 'web', url: null },
  { sourceId: 'S2', title: 'International institutions', authors: 'Joachim and Dalmer', authorDetails: [{ family: 'Joachim' }, { family: 'Dalmer' }], year: 2016, source: 'web', url: null },
] satisfies WriteWithAiReference[]
const sections = {
  introduction: 'This essay examines wartime cooperation [S1].',
  mainBody: 'Wartime cooperation\n\nWartime cooperation shaped international institutions [S1].\nThe charter set out common purposes (United Nations, 1945).\n\nAnother paragraph retains <em>emphasis</em> [S2].',
  conclusion: 'Wartime cooperation shaped the eventual institutions [S1].',
}
const result = {
  isEssay: true, title: 'Wartime Cooperation', references: refs, sections,
  content: `INTRODUCTION\n\n${sections.introduction}\n\nMAIN BODY\n\n${sections.mainBody}\n\nCONCLUSION\n\n${sections.conclusion}`,
} as WriteWithAiResponse
const resolve = (text: string) => interactiveCitationTokens(text, refs, 'harvard', 'generation')

describe('initial generated essay representation', () => {
  it('keeps the actual assembled conclusion and reference heading separate in HTML, plain text and export', () => {
    const body = renderGeneratedEssay(result, resolve)
    const assembled = appendGeneratedReferenceSection(body, '<p>A retrieved reference.</p>')
    expect(assembled).toContain('</p>\n\n<h2>REFERENCES</h2>\n<p>')
    const plain = assembled.replace(/<[^>]*>/g, '')
    expect(plain).not.toContain('institutions.REFERENCES')
    expect(plain).toMatch(/\n\nREFERENCES\nA retrieved reference/)
    expect(buildWordExportHtml('Essay', assembled, [])).toContain('</p>\n\n<h2>REFERENCES</h2>')
    expect(appendGeneratedReferenceSection(body, '')).toBe(body)
  })

  it('rejects different prose even when both representations have exactly the same citations', () => {
    expect(() => renderGeneratedEssay({ ...result, sections: {
      ...sections, mainBody: sections.mainBody.replace('shaped international institutions', 'caused a different outcome'),
    } }, resolve)).toThrow(/do not match/)
  })

  it('rejects uncited retrieved works before bibliography insertion', () => {
    expect(() => renderGeneratedEssay({ ...result, references: [...refs, { ...refs[0], sourceId: 'S99' }] }, resolve)).toThrow(/do not match/)
  })

  it('displays the finalized sections with valid citations, headings, line breaks and formatting intact', () => {
    const html = renderGeneratedEssay(result, resolve)
    expect(html).not.toContain('S45')
    expect(html).toContain('(Benson, 2023)')
    expect(html).toContain('(Joachim and Dalmer, 2016)')
    expect(html).toContain('(United Nations, 1945)')
    expect(html).toContain('<h3>Wartime cooperation</h3>')
    expect(html).toContain('<br>The charter')
    expect(html).toContain('<em>emphasis</em>')
    expect(html.indexOf('<h2>INTRODUCTION')).toBeLessThan(html.indexOf('<h2>MAIN BODY'))
    expect(html.indexOf('<h2>MAIN BODY')).toBeLessThan(html.indexOf('<h2>CONCLUSION'))
  })

  it('rejects the original stale-section defect before replacing or saving the document', () => {
    const stale = { ...result, sections: { ...sections, mainBody: sections.mainBody.replace('[S1]', '[S1][S45]') } }
    expect(() => renderGeneratedEssay(stale, resolve)).toThrow(/S45/)
    // Also catches divergence even when the reference happened to be retained.
    expect(() => renderGeneratedEssay({ ...stale, references: [...refs, { ...refs[0], sourceId: 'S45' }] }, resolve)).toThrow(/do not match/)
  })

  it('keeps missing-source problems visible in partial-draft display and exported text without fabricating metadata', () => {
    const html = resolve('A supported claim [S1]. A claim needing review [S45].')
    const exported = buildWordExportHtml('Essay', html, [])
    expect(exported).toContain('(Benson, 2023)')
    expect(exported).toContain('[Citation needs review: S45]')
    expect(exported).toContain('generation:S45')
    expect(exported).toContain('A claim needing review')
    expect(exported).not.toContain('undefined')
  })
})

describe('saved document compatibility', () => {
  const source = { ...refs[0], id: 'generation:S45' }
  const saved: JSONContent = { type: 'doc', content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'My edited heading' }] },
    { type: 'paragraph', content: [
      { type: 'text', text: 'My rewritten claim ', marks: [{ type: 'bold' }] },
      { type: 'citation', attrs: { occurrenceId: 'original', label: '[S45]', items: [{ sourceId: 'generation:S45', originalLabel: '[S45]', locator: 'p. 3' }] } },
    ] },
    { type: 'citationReference', attrs: { source, label: 'My edited bibliography label' } },
  ] }

  it('repairs only an exact source ID already in the saved bibliography, preserving user prose, marks, locators and occurrence IDs', () => {
    const before = JSON.stringify(saved)
    const repaired = repairUnresolvedCitationSources(saved, 'harvard')
    expect(repaired.content![0]).toEqual(saved.content![0])
    expect(repaired.content![1].content![0]).toEqual(saved.content![1].content![0])
    expect(repaired.content![2]).toEqual(saved.content![2])
    const attrs = repaired.content![1].content![1].attrs!
    expect(attrs.items[0].source).toEqual(source)
    expect(attrs.items[0].locator).toBe('p. 3')
    expect(attrs.occurrenceId).toBe('original')
    expect(attrs.label).toBe('(Benson, 2023, p. 3)')
    expect(JSON.stringify(saved)).toBe(before)
    expect(repairUnresolvedCitationSources(repaired, 'harvard')).toEqual(repaired)
  })

  it('does not match a source from another generation or replace edits when no exact source exists', () => {
    const mismatched = { ...saved, content: [saved.content![0], saved.content![1],
      { type: 'citationReference', attrs: { source: { ...source, id: 'another-generation:S45' }, label: 'Other source' } },
    ] }
    const repaired = repairUnresolvedCitationSources(mismatched, 'harvard')
    expect(repaired.content![1].content![0]).toEqual(saved.content![1].content![0])
    expect(repaired.content![1].content![1].attrs!.items[0].source).toBeUndefined()
    expect(repaired.content![1].content![1].attrs!.label).toBe('[Citation needs review: S45]')
  })
})
