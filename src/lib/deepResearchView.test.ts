import { describe, expect, it } from 'vitest'
import type { EvidenceQuestion, EvidenceSource } from '../api/deepResearch'
import {
  answeredCount, applyFilter, bySourceYearDesc, citationCheckChip, countSources, coverageChip, mergeSourceRows, needsFollowUp,
  evidenceAgainst, prefillFrom, questionRows, questionSegments, regionLabel, relationshipLabel, sessionStatusChip, shortQuestion, statusBanner, verificationChecks,
} from './deepResearchView'

const Q1 = 'q1', Q2 = 'q2', Q3 = 'q3'

const row = (over: Partial<EvidenceSource>): EvidenceSource => ({
  id: 's', questionId: Q1, title: 'A paper', authors: ['A'], year: 2024, journal: null, doi: '10.1/x',
  polarity: 'Supports', strength: 'Moderate', geography: 'Unknown', decision: 'Accepted', decidedBy: 'Humaniser',
  exclusionReason: null, quote: null, verification: 'Verified', foundVia: [], ...over,
})

// The shape of the real session that prompted this: five papers accepted across two questions (seven rows), the
// rest rejected for both questions.
const rows: EvidenceSource[] = [
  row({ id: 'a', questionId: Q1, title: 'Rewired Leadership', year: 2025 }),
  row({ id: 'a', questionId: Q2, title: 'Rewired Leadership', year: 2025 }),
  row({ id: 'b', questionId: Q1, title: 'Discourses of AI', year: 2022, polarity: 'Background', quote: 'a passage' }),
  row({ id: 'b', questionId: Q2, title: 'Discourses of AI', year: 2022, polarity: 'Background', quote: 'a passage' }),
  row({ id: 'c', questionId: Q2, title: 'Religious education', polarity: 'Background', quote: 'another' }),
  row({ id: 'd', questionId: Q2, title: 'Smart campus', polarity: 'Background' }),
  row({ id: 'e', questionId: Q2, title: 'Counselor type' }),
  row({ id: 'x', questionId: Q1, title: 'Off topic', decision: 'Rejected', exclusionReason: 'off topic' }),
  row({ id: 'x', questionId: Q2, title: 'Off topic', decision: 'Rejected', exclusionReason: 'off topic' }),
  row({ id: 'y', questionId: Q1, title: 'Never reviewed', decision: 'Pending' }),
]

const questions: EvidenceQuestion[] = [
  { id: Q1, type: 'Definition', question: 'How is usability of learning management systems operationally defined?', status: 'Resolved', sufficiency: 'Sufficient', reasons: [] },
  { id: Q2, type: 'Definition', question: 'What dimensions constitute student satisfaction?', status: 'Researching', sufficiency: 'Insufficient', reasons: [] },
  { id: Q3, type: 'Gap', question: 'Have studies examined this in South Africa?', status: 'Open', sufficiency: 'Insufficient', reasons: [] },
]

describe('merging source rows', () => {
  const groups = mergeSourceRows(rows)

  it('shows one card per source, not one per question link (the 7-vs-5 mismatch)', () => {
    expect(rows.filter(r => r.decision === 'Accepted')).toHaveLength(7)
    expect(groups.filter(g => g.bucket === 'used')).toHaveLength(5)
  })

  it('counts found, used, left out and not-yet-reviewed from the same list', () => {
    expect(countSources(groups)).toEqual({ found: 7, used: 5, excluded: 1, unassessed: 1 })
  })

  it('keeps the exclusion reason for a left-out source', () => {
    expect(groups.find(g => g.id === 'x')?.exclusionReason).toBe('off topic')
    expect(groups.find(g => g.id === 'y')?.bucket).toBe('unassessed')
  })

  it('is used if accepted for any question, even when another question rejected it', () => {
    const mixed = mergeSourceRows([row({ id: 'm', questionId: Q1, decision: 'Rejected', exclusionReason: 'x' }), row({ id: 'm', questionId: Q2 })])
    expect(mixed[0].bucket).toBe('used')
  })

  it('prefers a known region and remembers a student decision', () => {
    const g = mergeSourceRows([row({ id: 'r', geography: 'Unknown' }), row({ id: 'r', questionId: Q2, geography: 'Target', decidedBy: 'You' })])[0]
    expect(g.geography).toBe('Target')
    expect(g.decidedBy).toBe('You')
  })

  it('sorts newest first and filters by question', () => {
    const used = applyFilter(groups, 'used').sort(bySourceYearDesc)
    expect(used[0].id).toBe('a')
    expect(applyFilter(groups, { questionId: Q1 }).map(g => g.id).sort()).toEqual(['a', 'b'])
    expect(applyFilter(groups, 'excluded').map(g => g.id).sort()).toEqual(['x', 'y'])
  })
})

describe('questions', () => {
  const rowsByQ = questionRows(questions, mergeSourceRows(rows))

  it('tells apart never searched, no sources, none relevant, and needs more', () => {
    expect(rowsByQ[0].label).toBe('Well supported')
    expect(rowsByQ[2].state).toBe('not-searched')
    const none = questionRows([{ ...questions[1] }], mergeSourceRows([]))[0]
    expect(none.state).toBe('no-sources')
    const irrelevant = questionRows([{ ...questions[1] }], mergeSourceRows([row({ id: 'z', questionId: Q2, decision: 'Rejected' })]))[0]
    expect(irrelevant.state).toBe('none-relevant')
    expect(rowsByQ[1].state).toBe('needs-more')
  })

  it('counts evidence per question from real links', () => {
    expect(rowsByQ[0].used).toHaveLength(2)
    expect(rowsByQ[1].used).toHaveLength(5)
    expect(rowsByQ[2].used).toHaveLength(0)
  })

  it('counts only fully answered questions', () => {
    expect(answeredCount(questions)).toBe(1)
  })
})

describe('labels say only what was checked', () => {
  it('never presents a matched DOI as relevance', () => {
    const chip = citationCheckChip('Verified')
    expect(chip.label).toBe('DOI matched')
    expect(chip.label).not.toMatch(/verified|relevant|supports/i)
    expect(chip.hint).toMatch(/exists, not that it answers/i)
    expect(chip.tone).toBe('neutral')
  })

  it('flags real problems and is honest when nothing was checked', () => {
    expect(citationCheckChip('Retracted').tone).toBe('danger')
    expect(citationCheckChip('MetadataMismatch').tone).toBe('warning')
    expect(citationCheckChip('Unverifiable').label).toBe('Could not check')
    expect(citationCheckChip('Unverified').label).toBe('Not checked')
  })

  it('names the question a source relates to, or says Background', () => {
    expect(relationshipLabel({ polarity: 'Supports', questionId: Q1 }, questions).label).toMatch(/^Supports: How is usability/)
    expect(relationshipLabel({ polarity: 'Background', questionId: Q2 }, questions).label).toMatch(/^Background for:/)
    expect(relationshipLabel({ polarity: 'Supports', questionId: 'gone' }, questions).label).toBe('Supports')
  })

  it('shows a region only when it is known', () => {
    expect(regionLabel('Unknown')).toBeNull()
    expect(regionLabel('Target')).toBe('Your study region')
  })

  it('shortens long questions without cutting words mid-way off the end', () => {
    expect(shortQuestion('x'.repeat(100), 20).length).toBeLessThanOrEqual(20)
    expect(shortQuestion('short')).toBe('short')
  })
})

describe('status banner and follow-up', () => {
  const base = { isFinished: true, completionNote: 'The research reached its limit before every question was answered. Everything found so far is kept.' }

  it('states only what is known and the answered count', () => {
    const b = statusBanner({ ...base, status: 'Stopped' }, 1, 7)
    expect(b.title).toBe('Research stopped before every question was answered')
    expect(b.detail).toContain('1 of 7 questions answered.')
    expect(b.detail).toContain('Everything found so far is kept.')
    expect(b.role).toBe('status')
  })

  it('uses distinct wording and an alert role for failures', () => {
    expect(statusBanner({ ...base, status: 'Cancelled' }, 0, 3).title).toBe('You stopped this research')
    const failed = statusBanner({ ...base, status: 'Failed' }, 0, 3)
    expect(failed.tone).toBe('danger')
    expect(failed.role).toBe('alert')
    expect(statusBanner({ ...base, status: 'Completed' }, 3, 3).tone).toBe('success')
  })

  it('does not invent a stop reason it was not given', () => {
    const b = statusBanner({ isFinished: true, completionNote: null, status: 'Stopped' }, 0, 0)
    expect(b.detail).toBeNull()
  })

  it('offers a follow-up only when the session did not complete, carrying the unanswered questions', () => {
    expect(needsFollowUp('Stopped')).toBe(true)
    expect(needsFollowUp('Failed')).toBe(true)
    expect(needsFollowUp('Completed')).toBe(false)
    const p = prefillFrom({ projectId: 'p', researchQuestion: 'my question', mode: 'EvidenceForClaim', result: { questions } as never })
    expect(p.question).toBe('my question')
    expect(p.unanswered).toEqual([questions[1].question, questions[2].question])
  })
})

describe('what the agent read', () => {
  it('labels a source with no coverage field (older sessions) as abstract-level', () => {
    const [g] = mergeSourceRows([row({ id: 'z' })])
    expect(g.coverage).toBe('Abstract')
    expect(coverageChip(g.coverage, g.studyDesign).label).toBe('Abstract only')
    expect(coverageChip(g.coverage, g.studyDesign).tone).toBe('warning')
  })

  it('shows a full-text read with the design it found', () => {
    const [g] = mergeSourceRows([row({ id: 'z', coverage: 'FullText', studyDesign: 'Experimental' })])
    expect(coverageChip(g.coverage, g.studyDesign).label).toBe('Full text · experiment')
  })

  it('does not call a source full-text because a rejected link was', () => {
    const [g] = mergeSourceRows([
      row({ id: 'z', questionId: Q1, decision: 'Accepted', coverage: 'Abstract' }),
      row({ id: 'z', questionId: Q2, decision: 'Rejected', coverage: 'FullText', studyDesign: 'Experimental' }),
    ])
    expect(g.coverage).toBe('Abstract')
  })
})

describe('results screen helpers', () => {
  it('only ticks the record checks when the record was really verified', () => {
    const ok = verificationChecks('Verified', true, 'Abstract')
    expect(ok.map(c => c.state)).toEqual(['ok', 'ok', 'ok', 'ok'])
    expect(ok[3].label).toBe('Quote found in the abstract')
    expect(verificationChecks('Verified', true, 'FullText')[3].label).toBe('Quote found in the paper')

    const unchecked = verificationChecks('Unverifiable', false, 'Abstract')
    expect(unchecked.some(c => c.state === 'ok')).toBe(false)
    expect(unchecked[0].state).toBe('warn')
    expect(verificationChecks('Retracted', true, 'Abstract')[0].state).toBe('fail')
  })

  it('segments questions by how far each got', () => {
    expect(questionSegments([
      { sufficiency: 'Sufficient', status: 'Resolved' }, { sufficiency: 'Insufficient', status: 'Exhausted' },
      { sufficiency: 'PartiallySufficient', status: 'Researching' }, { sufficiency: 'Insufficient', status: 'Open' },
    ])).toEqual(['done', 'partial', 'partial', 'pending'])
  })

  it('lists accepted sources that disagree or found no effect, and no others', () => {
    const groups = mergeSourceRows([
      row({ id: 'a', polarity: 'Contradicts' }), row({ id: 'b', polarity: 'Supports' }),
      row({ id: 'c', polarity: 'Null' }), row({ id: 'd', polarity: 'Contradicts', decision: 'Rejected' }),
    ])
    expect(evidenceAgainst(groups).map(g => g.id).sort()).toEqual(['a', 'c'])
  })

  it('names the session status plainly', () => {
    expect(sessionStatusChip('Cancelled').label).toBe('Stopped by you')
    expect(sessionStatusChip('Stopped').tone).toBe('warning')
  })
})
