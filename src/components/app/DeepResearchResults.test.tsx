import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { DeepResearchSession, EvidenceSource } from '../../api/deepResearch'
import { DeepResearchResults, SourceDetail } from './DeepResearchResults'
import { mergeSourceRows } from '../../lib/deepResearchView'

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
    // the one accepted source is abstract-only, so nothing counts as answered yet
    expect(html).toContain('0 of 3 questions answered')
    expect(html).toContain('The research reached its limit before every question was answered.')
    expect(html).toContain('Stopped at limit')
    expect(html).toContain('role="status"')
  })

  it('describes the progress bar to assistive tech, question by question', () => {
    expect(html).toContain('Question 1: started, not enough evidence yet')
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
    expect(html).toContain('Some support')                // one abstract-only source can never be "Well supported"
    expect(html).not.toContain('>Well supported<')
    expect(html).toContain('Abstract-only sources')       // and the reason is visible, not only in the tooltip
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

describe('DeepResearchResults (funnel, source panel, follow-up)', () => {
  const html = render('Stopped')

  it('draws "disagree with you" as a subset of "accepted", not a third pool', () => {
    expect(html).toContain('of which disagree with you')
    expect(html).toContain('Accepted as evidence')
    expect(html).not.toMatch(/>Disagree with you</)
  })

  const detail = (quotes: (string | null)[]) => {
    const [source] = mergeSourceRows(quotes.map(q => row({ id: 'z', title: 'A very particular paper title', quote: q })))
    return renderToStaticMarkup(<SourceDetail source={source} questions={[]} busy={false} added={false} onAdd={() => {}} onUse={() => {}} onExclude={() => {}} onRestore={() => {}} />)
  }

  it('keeps the selected source title pinned at the top of the panel', () => {
    const out = detail(['A passage.'])
    expect(out).toMatch(/class="[^"]*\bsticky\b[^"]*"[^>]*>\s*<h3[^>]*>A very particular paper title/)
  })

  it('shows overlapping supporting quotes once, keeping the longer one', () => {
    const long = 'Usability was positively associated with satisfaction among first-year students.'
    const out = detail(['Usability was positively associated with satisfaction', long, long])
    expect(out.match(/<blockquote/g)).toHaveLength(1)
    expect(out).toContain(long)
    expect(out).toContain('Supporting quote<')
  })

  it('offers "Continue" with the price against a fresh run only when the server says it can be continued', () => {
    const quote = { canContinue: true, reason: null, answeredQuestions: 1, unansweredQuestions: 2, freshCredits: 14, followUpCredits: 7, depth: 'standard' }
    const withQuote = renderToStaticMarkup(
      <DeepResearchResults session={session('Stopped')} rows={rows} busyId={null} addedIds={new Set()} onDecide={noop} onAdd={noop} onUse={() => {}}
        onExport={() => {}} exporting={false} onFollowUp={() => {}} onNew={() => {}} followUpQuote={quote} onContinue={() => {}} />,
    )
    expect(withQuote).toContain('Continue with the 2 unanswered questions')
    expect(withQuote).toContain('7 credits')
    expect(withQuote).toContain('instead of the 14 a fresh run holds')
    expect(withQuote.match(/bg-purple-accent hover:bg-purple-deep text-white text-\[13px\] font-semibold shadow/g)).toHaveLength(1)   // still one primary: Continue
    expect(html).not.toContain('Continue with the')
    expect(renderToStaticMarkup(
      <DeepResearchResults session={session('Stopped')} rows={rows} busyId={null} addedIds={new Set()} onDecide={noop} onAdd={noop} onUse={() => {}}
        onExport={() => {}} exporting={false} onFollowUp={() => {}} onNew={() => {}} followUpQuote={{ ...quote, canContinue: false }} onContinue={() => {}} />,
    )).not.toContain('Continue with the')
  })
})

describe('DeepResearchResults (honest status, hierarchy, no duplicate findings)', () => {
  const doneSession = (): DeepResearchSession => ({ ...session('Completed'), completionNote: 'Every key question has enough evidence.' })
  const report = {
    sessionId: 'sess', researchQuestion: 'q', evidenceStrength: 'Moderate', bottomLine: [], bottomLineNote: 'No verified source supports a direct answer to this question yet.',
    sections: [], conflicts: [], gaps: [], references: [], status: 'Completed',
  }
  const withFindings = (s: DeepResearchSession): DeepResearchSession => ({
    ...s, result: { ...s.result!, keyFindings: [{ statement: ' \u00b7 Usability tracks satisfaction.', evidenceQuestionId: 'q1', supportingSourceIds: ['a'], contradictingSourceIds: [], strength: 'Moderate', scope: '', caveats: ['Evidence is from outside the target region.', 'Published in 2024.'] }] },
  })
  const view = (s: DeepResearchSession, extra: Partial<React.ComponentProps<typeof DeepResearchResults>> = {}) => renderToStaticMarkup(
    <DeepResearchResults session={s} rows={rows} busyId={null} addedIds={new Set()} onDecide={noop} onAdd={noop} onUse={() => {}}
      onExport={() => {}} exporting={false} onFollowUp={() => {}} onNew={() => {}} {...extra} />,
  )

  it('1. never says every key question has enough evidence while questions are unanswered', () => {
    const html = view(doneSession())
    expect(html).not.toContain('Every key question has enough evidence')
    expect(html).toContain('Completed with gaps')
    expect(html).toContain('0 of 3 answered, 3 have gaps')
    expect(html).not.toMatch(/>Complete</)
  })

  it('2. shows why a label is capped, in the tooltip and in a short visible note', () => {
    const html = view(doneSession())
    expect(html).toContain('Abstract-only sources')
    expect(html).toContain('Some support')
  })

  it('3. lists "Based on" one link per line, tags findings Q<number>, and has no stray separators', () => {
    const html = view(withFindings(doneSession()))
    expect(html).toContain('Q1 \u00b7 Definition')
    expect(html).not.toContain('How is usability defined?</span>')              // the tag, not the whole question
    expect(html).toMatch(/Based on<\/p><ul[^>]*><li><button[^>]*>Shared source<\/button><\/li><\/ul>/)
    expect(html).toContain('>Usability tracks satisfaction.<')                  // the leading " · " is gone
    expect(html).not.toMatch(/Limited evidence · <|· <\/p>/)
  })

  it('4. colours a caveat only when it gives a reason, and writes the reason next to it', () => {
    const html = view(withFindings(doneSession()))
    expect(html).toContain('Region mismatch')
    const plain = html.slice(html.indexOf('Published in 2024.') - 120, html.indexOf('Published in 2024.') + 30)
    expect(plain).not.toContain('amber')                                         // no reason, so no colour
  })

  it('5. makes Export report (Word) the primary action and the evidence package secondary', () => {
    const html = view(doneSession(), { onExportReport: () => {} })
    const primary = /bg-purple-accent hover:bg-purple-deep text-white text-\[13px\] font-semibold shadow/g
    expect(html.match(primary)).toHaveLength(1)
    expect(html).toMatch(/shadow-purple-400\/20[^>]*>\s*Export report \(Word\)/)
    expect(html).toMatch(/border border-slate-200 bg-white text-slate-700[^>]*title="A JSON file[^>]*>\s*Download evidence package/)
  })

  it('6. shows the findings once: the report replaces the findings block, which stays only as a fallback', () => {
    const s = withFindings(doneSession())
    const without = view(s)
    const withReport = view(s, { report, onExportReport: () => {} })
    expect(without).toContain('Key findings')
    expect(withReport).not.toContain('Key findings')
    expect(withReport).not.toContain('Usability tracks satisfaction.')            // lives in the Report tab, with citations
    expect(withReport).toContain('Bottom line')
  })
})
