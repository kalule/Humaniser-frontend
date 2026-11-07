import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { DeepResearchReport } from '../../api/deepResearch'
import { DeepResearchReportView } from './DeepResearchReportView'

const report: DeepResearchReport = {
  sessionId: 's', researchQuestion: 'Does LMS usability influence satisfaction?', evidenceStrength: 'Moderate',
  bottomLine: [{ text: 'Higher usability went with higher satisfaction.', sourceIds: ['a'] }],
  bottomLineNote: null,
  sections: [
    { questionId: 'q1', heading: 'How is usability defined?', sufficiency: 'Sufficient', caveats: ['Evidence is from outside the target region.'],
      claims: [
        { text: 'Usability is the ease with which a system is used.', sourceIds: ['a', 'b'] },
        { text: 'An uncited sentence that must never appear.', sourceIds: [] },
        { text: 'A sentence citing a source nobody listed.', sourceIds: ['ghost'] },
      ] },
    { questionId: 'q2', heading: 'Only uncited claims here', sufficiency: 'Insufficient', caveats: [], claims: [{ text: 'Hidden.', sourceIds: [] }] },
  ],
  conflicts: [{ text: 'Found no effect: “No significant relationship was found.”', sourceIds: ['b'] }],
  gaps: [{ questionId: 'q3', question: 'Is there South African evidence?', reason: 'Not reached before the research stopped.' }],
  references: [
    { number: 1, sourceId: 'a', title: 'Usability and satisfaction', authors: ['Smith, J.'], year: 2022, journal: 'J. Ed. Tech', doi: '10.1/a' },
    { number: 2, sourceId: 'b', title: 'A null result', authors: [], year: null, journal: null, doi: null },
  ],
  status: 'Stopped',
}

const render = (over: Partial<DeepResearchReport> = {}) => renderToStaticMarkup(
  <DeepResearchReportView report={{ ...report, ...over }} onOpenSource={() => {}} selectedId={null} onExport={() => {}} exporting={false} onAsk={() => {}} />,
)

describe('DeepResearchReportView', () => {
  const html = render()

  it('leads with the bottom line and the evidence-strength rating', () => {
    expect(html).toContain('Bottom line')
    expect(html).toContain('Evidence strength: Moderate evidence')
    expect(html).toContain('Higher usability went with higher satisfaction.')
  })

  it('puts a citation marker on every claim, each opening the source panel', () => {
    expect(html).toContain('aria-label="Source 1: Usability and satisfaction. Open its checks and supporting quote"')
    expect(html).toContain('[2]')
  })

  it('never renders a sentence without a resolvable citation', () => {
    expect(html).not.toContain('An uncited sentence that must never appear.')
    expect(html).not.toContain('A sentence citing a source nobody listed.')
    expect(html).not.toContain('Only uncited claims here')
  })

  it('has sections for conflicting evidence, gaps and numbered references', () => {
    expect(html).toContain('Conflicting evidence')
    expect(html).toContain('No significant relationship was found.')
    expect(html).toContain('Gaps')
    expect(html).toContain('Not reached before the research stopped.')
    expect(html).toContain('References')
    expect(html).toContain('doi.org/10.1/a')
  })

  it('says why there is no bottom line instead of leaving it blank, and drops empty sections', () => {
    const none = render({ bottomLine: [], bottomLineNote: 'No verified source supports a direct answer to this question yet.', conflicts: [] })
    expect(none).toContain('No verified source supports a direct answer to this question yet.')
    expect(none).not.toContain('report-conflicts')
  })

  it('offers Word export and a follow-up box', () => {
    expect(html).toContain('Export report to Word')
    expect(html).toContain('Ask a follow-up')
    expect(html).toContain('aria-labelledby="report-followup"')
  })
})
