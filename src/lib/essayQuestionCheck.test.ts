import { describe, expect, it } from 'vitest'
import { applySuggestion, bandTone, flagLabels, shouldShowResult } from './essayQuestionCheck'
import type { EssayQuestionCheckResult } from '../api/essayQuestionCheck'

const result = (over: Partial<EssayQuestionCheckResult>): EssayQuestionCheckResult => ({
  available: true, assessment: {} as EssayQuestionCheckResult['assessment'], overallPercent: 60, classification: 'Needs improvement',
  gate: 'Warn', canOverride: true, gateReasons: [], promptVersion: 'v', ...over,
})

describe('essay question check helpers', () => {
  it('replaces the question with a rewrite', () => {
    expect(applySuggestion('Social media and anxiety', 'New question', 'Rewrites')).toBe('New question')
  })

  it('keeps a set question and swaps the angle', () => {
    const once = applySuggestion('Discuss X.', 'Focus on A', 'InterpretationAngles')
    expect(once).toBe('Discuss X.\n\nAngle: Focus on A')
    expect(applySuggestion(once, 'Focus on B', 'InterpretationAngles')).toBe('Discuss X.\n\nAngle: Focus on B')
  })

  it('shows the panel only for a warning or a block', () => {
    expect(shouldShowResult(null)).toBe(false)
    expect(shouldShowResult(result({ available: false }))).toBe(false)
    expect(shouldShowResult(result({ gate: 'Proceed' }))).toBe(false)
    expect(shouldShowResult(result({ gate: 'Warn' }))).toBe(true)
    expect(shouldShowResult(result({ gate: 'Block', canOverride: false }))).toBe(true)
  })

  it('labels known flags and hides unknown codes', () => {
    expect(flagLabels(['NOT_AN_ESSAY_QUESTION', 'SOMETHING_NEW'])).toEqual(['This is a topic rather than a question'])
  })

  it('bands the score', () => {
    expect(bandTone(80)).toBe('good')
    expect(bandTone(60)).toBe('mid')
    expect(bandTone(40)).toBe('poor')
  })
})

describe('question hints for essay planning', () => {
  it('passes cleaned concepts and search terms, or nothing', async () => {
    const { questionHintsFrom } = await import('./essayQuestionCheck')
    const assessment = { centralConcepts: [' burnout ', 'burnout', ''], searchKeywords: [{ term: 'four-day week', type: 'core' }] } as never
    expect(questionHintsFrom(assessment)).toEqual({ concepts: ['burnout'], searchKeywords: ['four-day week'] })
    expect(questionHintsFrom({ centralConcepts: [], searchKeywords: [] } as never)).toBeUndefined()
    expect(questionHintsFrom(null)).toBeUndefined()
  })
})
