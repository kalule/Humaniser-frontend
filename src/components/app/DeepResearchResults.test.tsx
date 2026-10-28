import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { DeepResearchSession, EvidenceSource } from '../../api/deepResearch'
import { DeepResearchResults } from './DeepResearchResults'

const row = (over: Partial<EvidenceSource>): EvidenceSource => ({
  id: 's', questionId: 'q1', title: 'A paper', authors: ['A'], year: 2024, journal: 'J', doi: '10.1/x',
  polarity: 'Supports', strength: 'Moderate', geography: 'Unknown', decision: 'Accepted', decidedBy: 'Humaniser',
  exclusionReason: null, quote: null, verification: 'Verified', foundVia: [], ...over,
})

const session = (status: DeepResearchSession['status']): DeepResearchSession => ({
  id: 'sess', projectId: 'p', researchQuestion: 'Does LMS usability influence satisfaction', mode: 'EvidenceForClaim', status,
  isFinished: true, completionNote: 'The research reached its limit before every question was answered. Everything found so far is kept.',
  progress: { phase: 'Stopped', message: '', evidenceQuestions: 3, questionsAnswered: 1, sourcesDiscovered: 3, sourcesRelevant: 1, sourcesVerified: 3, searchesRun: 2 },
  createdAt: '', updatedAt: '',
  result: {
    evidenceStrength: 'Insufficient', keyFindings: [], gapCandidates: [], limitations: [], evidenceGaps: [], providerCoverage: [],
    acceptedSources: 1, contradictorySources: 0,
    questions: [
      { id: 'q1', type: 'Definition', question: 'How is usability defined?', status: 'Resolved', sufficiency: 'Sufficient', reasons: [] },
      { id: 'q2', type: 'Gap', question: 'Is there South African evidence?', status: 'Researching', sufficiency: 'Insufficient', reasons: [] },
      { id: 'q3', type: 'Context', question: 'What platforms are common?', status: 'Open', sufficiency: 'Insufficient', reasons: [] },
    ],
  },
})

const rows = [
  row({ id: 'a', questionId: 'q1', title: 'Shared source', quote: 'Usability is the ease of use of a system.' }),
  row({ id: 'a', questionId: 'q2', title: 'Shared source', quote: 'Usability is the ease of use of a system.' }),   // the same source linked to a second question
  row({ id: 'b', questionId: 'q1', title: 'Off topic paper', decision: 'Rejected', exclusionReason: 'off topic' }),
  row({ id: 'c', questionId: 'q1', title: 'Disagreeing paper', polarity: 'Contradicts' }),
]

const noop = async () => {}
const render = (status: DeepResearchSession['status']) => renderToStaticMarkup(
  <DeepResearchResults session={session(status)} rows={rows} busyId={null} addedIds={new Set()}
    onDecide={noop} onAdd={noop} onUse={() => {}} onExport={() => {}} exporting={false} onFollowUp={() => {}} onNew={() => {}} />,
)

describe('DeepResearchResults (stopped session)', () => {
  const html = render('Stopped')

  it('leads with how many questions were answered and explains the stop', () => {
    expect(html).toContain('1 of 3 questions answered')
    expect(html).toContain('The research reached its limit before every question was answered.')
    expect(html).toContain('Stopped at limit')
    expect(html).toContain('role="status"')
  })

  it('describes the progress bar to assistive tech, question by question', () => {
    expect(html).toContain('Question 1: answered')
    expect(html).toContain('Question 2: started, not enough evidence yet')
    expect(html).toContain('Question 3: not reached')
  })

  it('offers one filled primary action: a prefilled follow-up run', () => {
    expect(html).toContain('Start new research from this')
    expect(html.match(/bg-purple-accent hover:bg-purple-deep text-white text-\[13px\] font-semibold shadow/g)).toHaveLength(1)
  })

  it('counts a source linked to two questions once', () => {
    expect(html).toContain('Where the 3 sources went')
    expect(html).toContain('Accepted as evidence')
    expect(html).toContain('Evidence against (1)')
    expect(html).toContain('Left out (1)')
  })

  it('shows each question with its type, status and accepted sources, and says which were never searched', () => {
    expect(html).toContain('QUESTION 1 · DEFINITION')
    expect(html).toContain('Well supported')
    expect(html).toContain('1 question still to research')
    expect(html).toContain('Planned, not yet researched')
    expect(html).toContain('QUESTION 2 · GAP')
  })

  it('does not use the labels that overstated what was checked', () => {
    expect(html).not.toContain('Chosen by Humaniser')
    expect(html).not.toContain('Region unclear')
    expect(html).not.toMatch(/>Verified</)
    expect(html).toContain('DOI matched')
    expect(html).toContain('Abstract only')
  })

  it('makes sources selectable and starts with nothing selected', () => {
    expect(html).toContain('aria-pressed="false"')
    expect(html).toContain('Select a source to see its verification checks')
    expect(html).toContain('role="tablist"')
  })

  it('has no "Ask" box, because nothing answers it', () => {
    expect(html).not.toContain('Ask about this evidence')
  })
})

describe('DeepResearchResults (other states)', () => {
  it('a completed session leads with the download, and a failed one raises an alert', () => {
    const done = render('Completed')
    expect(done).toContain('Complete')
    expect(done).not.toContain('Start new research from this')
    expect(done).toContain('Download evidence package')
    expect(render('Failed')).toContain('role="alert"')
  })
})
