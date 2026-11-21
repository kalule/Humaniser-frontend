// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import { sectionEditorExtensions, stripLeadingHeadingLines } from './sectionEditorExtensions'

const editors: Editor[] = []
afterEach(() => { editors.splice(0).forEach(e => e.destroy()) })

function roundTrip(markdown: string): string {
  const editor = new Editor({ extensions: sectionEditorExtensions(), content: markdown })
  editors.push(editor)
  return (editor.storage as unknown as { markdown: { getMarkdown(): string } }).markdown.getMarkdown()
}

describe('section editor markdown', () => {
  it('keeps citations, emphasis, lists, tables, images and the references block', () => {
    const md = [
      'Load-shedding disrupts **small retailers** (Pillay and Beharry-Ramraj, 2024). Klishi (2024) agrees [3].',
      '',
      '- Spoiled stock',
      '- Shorter hours',
      '',
      '| Variable | Role |',
      '| --- | --- |',
      '| Outage hours | Independent |',
      '',
      '![chart](data:image/png;base64,iVBORw0KGgo=)',
      '',
      '### References (1)',
      '',
      '1. Pillay, K. (2024) *Outages*.',
    ].join('\n')
    const out = roundTrip(md)
    expect(out).toContain('(Pillay and Beharry-Ramraj, 2024)')
    // The shared serialiser (same as Guided) escapes IEEE brackets; the server treats "\[3\]" and
    // "[3]" as the same citation (SectionEditPolicy), so this never reads as a citation change.
    expect(out).toContain('Klishi (2024) agrees \\[3\\].')
    expect(out).toContain('**small retailers**')
    expect(out).toMatch(/- Spoiled stock\n- Shorter hours/)
    expect(out).toMatch(/\| Variable \| Role \|/)
    expect(out).toContain('| Outage hours | Independent |')
    expect(out).toContain('data:image/png;base64,iVBORw0KGgo=')
    expect(out).toContain('### References (1)')
  })

  it('is stable: a second round trip changes nothing', () => {
    const once = roundTrip('First paragraph (Nkohla, 2024).\n\nSecond paragraph with *emphasis*.')
    expect(roundTrip(once)).toBe(once)
  })

  it('drops leading heading lines the same way Guided does', () => {
    expect(stripLeadingHeadingLines('## 1.0 Introduction\n\nBody text.\n\n### References')).toBe('Body text.\n\n### References')
    expect(stripLeadingHeadingLines('Body only.')).toBe('Body only.')
  })
})
