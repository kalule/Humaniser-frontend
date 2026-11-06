import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SentenceEditor } from './SentenceEditor'

vi.mock('../../api/humanise', () => ({ humaniseApi: { sentenceAlternatives: vi.fn() } }))

// Static render only (there is no DOM test library here): proves the editor renders a result sentence by sentence with the
// right status on each, keeps the layout, and shows nothing for empty text. Click behaviour is covered by the pure
// sentenceEdit tests; it was not exercised in a browser.
const original = 'The Paradox of Choice\nThe rapid advancement of technology has given people many options. This causes decision fatigue.\n\nNothing else changed here.'
const output = 'The Paradox of Choice\nTechnology has expanded the options people have, and this advancement is rapid. This causes decision fatigue.\n\nNothing else changed here.'

const render = (o: string, out: string) =>
  renderToStaticMarkup(<SentenceEditor originalText={o} outputText={out} tone="academic" englishVariant="preserve" onChange={() => {}} />)

describe('SentenceEditor', () => {
  it('renders every sentence as a button and reports how many changed', () => {
    const html = render(original, output)
    expect((html.match(/role="button"/g) ?? []).length).toBe(4)
    expect(html).toContain('1 of 4 sentences changed')
    expect(html).toContain('Technology has expanded the options people have, and this advancement is rapid.')
  })

  it('marks only the reworded sentence as changed', () => {
    const html = render(original, output)
    expect((html.match(/Changed from your text:/g) ?? []).length).toBe(1)
    expect((html.match(/Unchanged from your text:/g) ?? []).length).toBe(3)
  })

  it('shows no review panel until a sentence is picked', () => {
    expect(render(original, output)).not.toContain('Sentence review')
  })

  it('renders nothing for empty text', () => {
    expect(render(original, '')).toBe('')
  })

  it('reports a result identical to the original as no changes', () => {
    expect(render(original, original)).toContain('0 of 4 sentences changed')
  })
})
