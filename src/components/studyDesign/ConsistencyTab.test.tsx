import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ConsistencyFinding } from '../../api/studyDesign'
import { ConsistencyTab, FindingCard } from './ConsistencyTab'

const finding = (over: Partial<ConsistencyFinding> = {}): ConsistencyFinding => ({
  key: 'CE-N-03:abc123abc123', code: 'CE-N-03', severity: 'warning',
  message: '85 ÷ 0.80 is 106.25. A count of people is rounded up, which gives 107; the text says 106.',
  values: [
    { label: 'Written in the text', value: '106', source: 'section 5.5 Sample Size' },
    { label: '85 ÷ 0.80, exactly', value: '106.25', source: 'computed' },
    { label: 'Rounded up to a whole number', value: '107', source: 'computed' },
  ],
  foundInText: true, canDismiss: true, quote: '…approximately 106 participants (85 ÷ 0.80)…', ...over,
})

const html = (f: ConsistencyFinding, onAction: (() => void) | null = () => {}, label = 'Dismiss') =>
  renderToStaticMarkup(<FindingCard finding={f} busy={false} onAction={onAction} actionLabel={label} />)

describe('FindingCard', () => {
  it('shows the message, every value with its source, and the quoted sentence, exactly as the server sent them', () => {
    const out = html(finding())
    expect(out).toContain('85 ÷ 0.80 is 106.25. A count of people is rounded up, which gives 107; the text says 106.')
    for (const text of ['Written in the text', '<strong>106</strong>', '(section 5.5 Sample Size)', '<strong>106.25</strong>', '<strong>107</strong>', '(computed)'])
      expect(out).toContain(text)
    expect(out).toContain('…approximately 106 participants (85 ÷ 0.80)…')
    expect(out).toContain('found in text')
  })

  it('offers Dismiss on a finding read from text, with a name that says which finding', () => {
    const out = html(finding())
    expect(out).toContain('>Dismiss</button>')
    expect(out).toContain('aria-label="Dismiss finding CE-N-03:')
  })

  it('offers no button on a finding that compares stored values, and says why', () => {
    const out = html(finding({ code: 'CE-N-01', canDismiss: false, severity: 'info' }), null)
    expect(out).not.toContain('<button')
    expect(out).toContain('cannot be dismissed')
  })

  it('labels a warning and a note differently, in words and not by colour alone', () => {
    expect(html(finding())).toContain('Check this')
    const note = html(finding({ severity: 'info' }))
    expect(note).toContain('· Note')
    expect(note).not.toContain('Check this')
  })

  it('shows Restore for a dismissed finding', () => {
    expect(html(finding(), () => {}, 'Restore')).toContain('>Restore</button>')
  })

  it('never adds a verdict of its own', () => {
    const out = html(finding()).toLowerCase()
    for (const word of ['consistent', 'approved', 'no problems', 'looks good', 'correct']) expect(out).not.toContain(word)
  })
})

describe('ConsistencyTab', () => {
  it('asks for a project and shows no findings when none is chosen', () => {
    const out = renderToStaticMarkup(<ConsistencyTab projectId="" active />)
    expect(out).toContain('Choose a project above')
    expect(out).not.toContain('Findings')
  })
})
