import { describe, expect, it } from 'vitest'
import { locate, needleFor, reviewItems } from './claimReviewHighlights'
import type { WriteWithAiResponse } from '../types/workbench'

describe('claim review highlights', () => {
  it('searches the longest stretch of the sentence between source tokens', () => {
    expect(needleFor('Four-day weeks reduced burnout in most pilot firms [S1], although stress rose for some staff [S2, S3].'))
      .toBe('Four-day weeks reduced burnout in most pilot firms')
    expect(needleFor('Short [S1].')).toBeNull()
    expect(needleFor(null)).toBeNull()
  })

  it('finds the text across differences in whitespace', () => {
    const text = 'As shown,  four-day weeks\nreduced burnout in most pilot firms (Smith, 2020).'
    const range = locate(text, 'four-day weeks reduced burnout in most pilot firms')
    expect(range).not.toBeNull()
    expect(text.slice(...range!)).toBe('four-day weeks\nreduced burnout in most pilot firms')
    expect(locate(text, 'not in this text at all, anywhere')).toBeNull()
  })

  it('makes one item per sentence with the reasons combined, using the essay wording of each claim', () => {
    const span = 'Four-day weeks caused lower burnout in every organisation studied [S1].'
    const result = {
      claimAudit: { claims: [
        { id: 'C1', text: 'Four-day weeks caused lower burnout.', originalSpan: span },
        { id: 'C2', text: 'In every organisation studied.', originalSpan: span },
      ] },
      evidenceIssues: [
        { passageId: 'C1', claim: 'Four-day weeks caused lower burnout.', sourceIds: ['S1'], category: 'causal_overstatement', severity: 'major', explanation: 'x', correctiveAction: 'y' },
        { passageId: 'C2', claim: 'In every organisation studied.', sourceIds: ['S1'], category: 'population_mismatch', severity: 'major', explanation: 'x', correctiveAction: 'y' },
      ],
    } as unknown as Pick<WriteWithAiResponse, 'evidenceIssues' | 'claimAudit'>

    const items = reviewItems(result)
    expect(items).toHaveLength(1)
    expect(items[0].needle).toBe('Four-day weeks caused lower burnout in every organisation studied')
    expect(items[0].message).toContain('more strongly than the source')
    expect(items[0].message).toContain('different population')
  })

  it('has nothing to highlight when every claim passed', () => {
    expect(reviewItems({ evidenceIssues: [], claimAudit: undefined })).toEqual([])
  })
})
