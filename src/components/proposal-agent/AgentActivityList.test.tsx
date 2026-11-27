import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AgentActivityView } from './AgentActivityList'
import type { AgentActivity } from '../../types/proposalAgent'

const done: AgentActivity = {
  running: false, path: 'LegacySection', sectionCode: '1.0', startedAt: '2026-11-27T10:00:00Z',
  lines: [
    { kind: 'Found', text: "Found 5 papers on 'sms reminders art adherence'", sectionCode: null, at: null },
    { kind: 'Read', text: "Read 'SMS reminders and antiretroviral adherence'", sectionCode: null, at: null },
    { kind: 'Gap', text: "No evidence found for 'Adherence in Pretoria clinics'", sectionCode: null, at: null },
    { kind: 'Wrote', text: 'Wrote Introduction', sectionCode: '1.0', at: null },
    { kind: 'Checked', text: 'Checked the document', sectionCode: null, at: null },
  ],
}

const html = (activity: AgentActivity | null) => renderToStaticMarkup(<AgentActivityView activity={activity} />).replace(/<!-- -->/g, '')

describe('AgentActivityView', () => {
  it('renders nothing when the agent is off for this project or has nothing to show', () => {
    expect(html(null)).toBe('')
    expect(html({ ...done, lines: [] })).toBe('')
  })

  it('says it is starting while a run has no lines yet', () => {
    expect(html({ ...done, running: true, lines: [] })).toContain('The research agent is starting')
  })

  it('lists every line in the shared wording, counts evidence gaps, and stays collapsed when finished', () => {
    const out = html(done)
    expect(out).toContain("Found 5 papers on &#x27;sms reminders art adherence&#x27;")
    expect(out).toContain('Wrote Introduction')
    expect(out).toContain('Checked the document')
    expect(out).toContain('(5, 1 evidence gap)')
    expect(out).not.toContain('open=""')
  })

  it('opens and announces new lines while the run is working', () => {
    const out = html({ ...done, running: true })
    expect(out).toContain('working (5)')
    expect(out).toContain('open=""')
    expect(out).toContain('aria-live="polite"')
  })
})
