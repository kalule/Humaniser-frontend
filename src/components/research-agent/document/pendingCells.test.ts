// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import { sectionEditorExtensions } from './sectionEditorExtensions'
import { countUncostedRows, PendingCells } from './pendingCells'

const budget = [
  '| Category | Item | Unit | Quantity | Unit Cost | Line Total | Basis |',
  '| --- | --- | --- | --- | --- | --- | --- |',
  '| Data Collection | Pilot study recruitment | retailer | 10 | Not yet costed | Not yet costed | For recruitment of a small sample |',
  '| Data Analysis | Statistical software licence | month | 3 | ZAR 400.00 | ZAR 1200.00 | Subscription |',
  '| Subtotal | | | | | ZAR 1200.00 | Sum of costed items only |',
].join('\n')

const editors: Editor[] = []
afterEach(() => { editors.splice(0).forEach(e => e.destroy()) })

describe('pending budget cells', () => {
  it('counts rows still waiting for a cost, once per row', () => {
    expect(countUncostedRows(budget)).toBe(1)
    expect(countUncostedRows('No table here. Not yet costed.')).toBe(0)
  })

  it('marks "Not yet costed" cells and short cells without changing the stored text', () => {
    const editor = new Editor({ extensions: [...sectionEditorExtensions(), PendingCells], content: budget })
    editors.push(editor)
    const html = editor.view.dom.innerHTML
    expect(html.match(/dm-cell-pending/g)?.length).toBe(2)
    expect(html).toMatch(/class="[^"]*dm-cell-short[^"]*"[^>]*>\s*<p>month/)
    expect((editor.storage as unknown as { markdown: { getMarkdown(): string } }).markdown.getMarkdown()).toContain('Not yet costed')
  })
})
