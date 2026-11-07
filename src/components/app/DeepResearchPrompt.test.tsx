import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DeepResearchPrompt } from './DeepResearchPrompt'
import { DEEP_RESEARCH_EXAMPLES, DEEP_RESEARCH_MODES } from '../../lib/deepResearch'
import { DEPTH_ORDER, DEPTH_TIERS, startLabel } from '../../lib/deepResearchIntake'

const render = (over: Partial<Parameters<typeof DeepResearchPrompt>[0]> = {}) => renderToStaticMarkup(
  <DeepResearchPrompt
    question="Does sleep influence exam scores in first-year students?" onQuestion={() => {}}
    mode="Auto" onMode={() => {}} depth="standard" onDepth={() => {}}
    onExample={() => {}} canStart busy={false} onStart={() => {}} {...over}
  />,
)

describe('DeepResearchPrompt', () => {
  it('leads with the outcome, not the evidence package', () => {
    const html = render()
    expect(html).toContain('Get a cited answer. Every claim checked against its source.')
    expect(html).not.toMatch(/evidence package you can review/i)
  })

  it('defaults to Auto, and shows the detected kind of research', () => {
    const html = render({ detected: 'RelationshipInvestigation' })
    expect(html).toContain('Auto: Investigate a relationship')
    expect(html).toContain('Change')          // the label itself is the control that opens the modes
    expect(html).toContain('aria-expanded="false"')
    // the eight modes stay behind the control until it is opened
    expect(html).not.toContain('role="radiogroup" aria-label="Kind of research"')
  })

  it('puts the cost and time of the chosen depth on the start button, and follows the depth', () => {
    expect(render({ depth: 'summary' })).toContain(startLabel('summary').replace(/&/g, '&amp;'))
    expect(render({ depth: 'deep' })).toContain(startLabel('deep'))
    expect(render({ depth: 'deep' })).not.toContain(startLabel('summary'))
  })

  it('offers all three depths as a radio group with one selected', () => {
    const html = render({ depth: 'deep' })
    for (const id of DEPTH_ORDER) expect(html).toContain(DEPTH_TIERS[id].label)
    expect(html).toContain('aria-labelledby="deep-research-depth"')
  })

  it('shows the "at least N charged, the rest returned" note next to the button', () => {
    expect(render()).toMatch(/at least 5 charged/)
  })

  it('shows the placeholder of the chosen mode', () => {
    const m = DEEP_RESEARCH_MODES.find(x => x.value === 'TheoreticalFramework')!
    expect(render({ question: '', mode: 'TheoreticalFramework' })).toContain(m.placeholder.replace(/'/g, '&#x27;'))
  })

  it('lists the example questions and the project suggestions', () => {
    const html = render({ suggestions: ['Does X influence Y?'] })
    for (const ex of DEEP_RESEARCH_EXAMPLES) expect(html).toContain(ex.question.replace(/'/g, '&#x27;'))
    expect(html).toContain('Suggested for this project')
    expect(html).toContain('Does X influence Y?')
  })

  it('offers a one-click rewrite for a normative question, and not for an evidence question', () => {
    expect(render({ question: 'Should universities ban generative AI in student assessment?' })).toContain('Ask it as: What does the evidence say about whether')
    expect(render()).not.toContain('Ask it as')
  })

  it('disables Start research until the question is valid, and says why when it is too short', () => {
    expect(render({ canStart: false })).toMatch(/<button[^>]*disabled[^>]*>.*Start research/s)
    expect(render({ question: 'Too short', canStart: false })).toContain('Add a little more detail')
  })

  it('shows a loading state once started', () => {
    const html = render({ busy: true })
    expect(html).toContain('Starting…')
    expect(html).toContain('aria-busy="true"')
  })

  it('does not promise a quote for every source', () => {
    expect(render()).not.toMatch(/every source is checked|backed by a quote/i)
  })

  it('renders the options row inside the card', () => {
    expect(render({ options: <span>PROJECT-OPTIONS</span> })).toContain('PROJECT-OPTIONS')
  })
})
