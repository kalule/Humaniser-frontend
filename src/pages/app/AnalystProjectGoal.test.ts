import { describe, expect, it } from 'vitest'
import type { ProjectHypothesis } from '../../types/research'
import { projectHypothesisGoal } from './AnalystPage'

const h = (over: Partial<ProjectHypothesis>): ProjectHypothesis => ({
  id: 'h1', number: 1, nullHypothesis: '', alternativeHypothesis: '', dependentVariable: '', independentVariable: '',
  plannedStatisticalTest: '', significanceLevel: '0.05', ...over,
} as ProjectHypothesis)

describe('projectHypothesisGoal (research-platform W1.5)', () => {
  it('states the hypothesis with its variables and planned test', () => {
    expect(projectHypothesisGoal(h({
      alternativeHypothesis: 'Study hours predict exam scores.', dependentVariable: 'exam_score', independentVariable: 'study_hours',
      plannedStatisticalTest: 'Linear regression',
    }))).toBe('Test H1: Study hours predict exam scores. (outcome: exam_score, predictor: study_hours; planned test: Linear regression)')
  })

  it('falls back to the null hypothesis and leaves out what is missing', () => {
    expect(projectHypothesisGoal(h({ number: 2, nullHypothesis: 'There is no difference between groups.' })))
      .toBe('Test H2: There is no difference between groups.')
    expect(projectHypothesisGoal(h({ number: 3, alternativeHypothesis: 'Groups differ.', plannedStatisticalTest: 't-test' })))
      .toBe('Test H3: Groups differ. (planned test: t-test)')
  })

  it('gives nothing for a hypothesis with no text', () => {
    expect(projectHypothesisGoal(h({}))).toBe('')
  })
})
