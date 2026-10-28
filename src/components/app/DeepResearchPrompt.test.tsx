import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DeepResearchPrompt } from './DeepResearchPrompt'
import { DEEP_RESEARCH_CREDITS, DEEP_RESEARCH_EXAMPLES, DEEP_RESEARCH_MODES } from '../../lib/deepResearch'

const render = (over: Partial<Parameters<typeof DeepResearchPrompt>[0]> = {}) => renderToStaticMarkup(
  <DeepResearchPrompt
    question="Should universities ban generative AI in student assessment?" onQuestion={() => {}}
    mode="EvidenceForClaim" onMode={() => {}} onExample={() => {}} canStart busy={false} onStart={() => {}} {...over}
  />,
)

describe('DeepResearchPrompt', () => {
  it('offers every real research mode as a chip, with the chosen one selected', () => {
    const html = render()
    for (const m of DEEP_RESEARCH_MODES) expect(html).toContain(m.label)
    expect(html.match(/role="radio"/g)).toHaveLength(DEEP_RESEARCH_MODES.length)
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1)
  })

  it('shows what the run costs before it starts', () => {
    const html = render()
    expect(html).toContain(`${DEEP_RESEARCH_CREDITS.reserved} credits reserved`)
    expect(html).toContain(`At least ${DEEP_RESEARCH_CREDITS.minCharged} are charged`)
  })

  it('lists the example questions', () => {
    const html = render()
    for (const ex of DEEP_RESEARCH_EXAMPLES) expect(html).toContain(ex.question.replace(/'/g, '&#x27;'))
  })

  it('disables Start research until the question is valid, and says why when it is too short', () => {
    expect(render({ canStart: false })).toMatch(/<button[^>]*disabled[^>]*>.*Start research/s)
    expect(render({ question: 'Too short', canStart: false })).toContain('Add a little more detail')
  })

  it('does not promise a quote for every source', () => {
    expect(render()).not.toMatch(/every source is checked|backed by a quote/i)
  })

  it('renders the project and region options inside the card', () => {
    expect(render({ options: <span>PROJECT-OPTIONS</span> })).toContain('PROJECT-OPTIONS')
  })
})
