import { describe, expect, it } from 'vitest'
import { decisionForKey, decisionOptions, exclusionReasonError, progressLines, rankingSummary } from './screeningLedger'
import type { RankingStatus, ScreeningProgress } from '../types/screeningLedger'

const progress = (over: Partial<ScreeningProgress> = {}): ScreeningProgress => ({
  stage: 'TitleAbstract', uniqueRecords: 100, screened: 40, unscreened: 55, unresolved: 3, relevantIdentified: 12,
  needsReassessment: 0, recentWindow: 20, recentRelevant: 0, stateCounts: {}, includedReports: 0, includedStudies: 0,
  latestStop: null, conflicts: 2, awaitingOtherReviewers: 0, myDecisions: 40, recordsSinceLastRelevant: 25,
  withoutAbstract: 0, requiredReviewers: 1, agreement: null, ...over,
})

const ranking = (state: RankingStatus['state']): RankingStatus => ({
  state, runId: null, rankedAt: null, relevantLabels: 1, irrelevantLabels: 1, canTrain: true, message: null,
  modelName: 'elas_u4', asReviewVersion: '3.0.8', seed: 1, trainedOnLabels: 2, serviceAvailable: true,
})

describe('screening ledger UI rules', () => {
  it('offers full-text-unavailable only at the full-text stage', () => {
    expect(decisionOptions('TitleAbstract').map(o => o.decision)).toEqual(['Include', 'Exclude', 'Uncertain'])
    expect(decisionOptions('FullText').map(o => o.decision)).toContain('FullTextUnavailable')
    expect(decisionForKey('TitleAbstract', 'n')).toBeNull()
    expect(decisionForKey('FullText', 'N')).toBe('FullTextUnavailable')
  })

  it('says a title/abstract include means getting the full text, not inclusion in the review', () => {
    expect(decisionOptions('TitleAbstract')[0].hint).toMatch(/full text/i)
    expect(decisionOptions('TitleAbstract')[0].hint).toMatch(/not yet included/i)
  })

  it('requires a reason for exclusions only', () => {
    expect(exclusionReasonError('Exclude', null, '  ')).not.toBeNull()
    expect(exclusionReasonError('Exclude', 'crit-1', '')).toBeNull()
    expect(exclusionReasonError('Exclude', null, 'Wrong population')).toBeNull()
    expect(exclusionReasonError('Uncertain', null, '')).toBeNull()
  })

  it('never reports recall, even after a long run of irrelevant records', () => {
    const lines = progressLines(progress()).join(' ')
    expect(lines).not.toMatch(/\d+\s*%\s*recall|recall (achieved|reached)/i)
    expect(lines).toContain('Recall is unknown while records remain unscreened.')
    expect(lines).toContain('25 records decided since the last include.')
    expect(progressLines(progress({ unscreened: 0 })).join(' ')).not.toContain('Recall is unknown')
  })

  it('describes ranking freshness without implying a probability of eligibility', () => {
    for (const s of ['none', 'queued', 'running', 'fresh', 'stale', 'invalidated', 'not_trainable', 'failed'] as const) {
      expect(rankingSummary(ranking(s)).text).not.toMatch(/probab|likel|chance|%/i)
    }
    expect(rankingSummary(ranking('failed')).text).toMatch(/random order/)
  })
})
