import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AgentEvidenceView, type AgentEvidenceViewProps } from './AgentEvidencePanel'
import type { AgentEvidenceProposal, AgentEvidenceState } from '../../types/proposalAgent'

const proposal = (over: Partial<AgentEvidenceProposal>): AgentEvidenceProposal => ({
  id: 'p1', sectionCode: '1.0', claim: 'SMS reminders improved adherence in a randomised trial.', sourceTitle: 'SMS reminders and ART adherence',
  authors: 'Mokoena, Thandi, Smith, John', year: 2021, doi: '10.9999/x', literatureId: null, sourceIncluded: false, coverage: 'Abstract',
  quote: 'A randomised trial of SMS reminders found improved antiretroviral adherence.', start: 0, length: 74, status: 'Proposed',
  evidenceId: null, message: null, ...over,
})

const ready: AgentEvidenceState = {
  status: 'Ready', preparedAt: '2026-11-27T10:00:00Z', searches: 3, papersRead: 4,
  proposals: [
    proposal({}),
    proposal({ id: 'p2', sectionCode: '5.2', sourceIncluded: true, literatureId: 'l1' }),
    proposal({ id: 'p3', sectionCode: '5.2', status: 'Dismissed', claim: 'An off-topic claim.' }),
  ],
  gaps: ['No source found that answers: How adherent are adults in Pretoria clinics?'],
}

const noop = () => {}
const view = (over: Partial<AgentEvidenceViewProps> = {}) => renderToStaticMarkup(
  <AgentEvidenceView state={ready} selected={new Set()} busy={false} staleWarning={null} lastResult={null}
    onToggle={noop} onSelectAllOpen={noop} onPrepare={noop} onConfirm={noop} onConfirmAnyway={noop} onCancelStale={noop} onDismiss={noop} {...over} />,
).replace(/<!-- -->/g, '')

describe('AgentEvidenceView', () => {
  it('groups suggestions by section with the exact passage, its source, and whether that source is in the project', () => {
    const out = view()
    expect(out).toContain('Section 1.0')
    expect(out).toContain('Section 5.2')
    expect(out).toContain('A randomised trial of SMS reminders found improved antiretroviral adherence.')
    expect(out).toContain('(2021) SMS reminders and ART adherence · abstract')
    expect(out).toContain('not yet in your sources')
    expect(out).toContain('Nothing is used as evidence until you confirm it')
    expect(out).toContain('3 searches · 4 papers read · 3 suggestions')
  })

  it('lists what the agent could not find as gaps', () => {
    expect(view()).toContain('How adherent are adults in Pretoria clinics?')
  })

  it('says how many paid source checks confirming runs and how many sources it adds', () => {
    const out = view({ selected: new Set(['p1', 'p2']) })
    expect(out).toContain('Add 2 as evidence')
    expect(out).toContain('2 source checks, uses credits')
    expect(out).toContain('adds 1 source to your project')
  })

  it('never offers a dismissed suggestion for confirmation', () => {
    const out = view({ selected: new Set(['p3']) })
    expect(out).toContain('Dismissed')
    expect(out).not.toContain('Add 1 as evidence')
    expect(out).toMatch(/<input type="checkbox"[^>]*disabled=""[^>]*aria-label="Select: An off-topic claim\."/)
  })

  it('asks again before making existing evidence stale', () => {
    const out = view({ staleWarning: 'Including 1 new source(s) changes the source corpus, so 3 existing evidence binding(s) would need reviewing again. Confirm to continue.' })
    expect(out).toContain('role="alert"')
    expect(out).toContain('3 existing evidence binding(s) would need reviewing again')
    expect(out).toContain('Add them anyway')
  })

  it('shows that it is still looking without offering a second run', () => {
    const out = view({ state: { ...ready, status: 'Running' } })
    expect(out).toContain('Finding evidence…')
    expect(out).toMatch(/<button[^>]*disabled=""[^>]*>Finding evidence…/)
  })
})
