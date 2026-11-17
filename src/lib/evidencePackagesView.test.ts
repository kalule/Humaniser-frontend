import { describe, expect, it } from 'vitest'
import { groupPackages, questionSummary, scopeDetails } from './evidencePackagesView'
import type { DeepResearchSessionSummary } from '../api/deepResearch'

const run = (id: string, question: string, createdAt: string, projectId = 'p1'): DeepResearchSessionSummary => ({
  id, projectId, researchQuestion: question, mode: 'TopicExploration', status: 'Completed', isFinished: true,
  canResume: false, message: '', acceptedSources: 3, createdAt, updatedAt: createdAt,
})

describe('groupPackages', () => {
  it('folds repeated runs of a question into one package, numbered oldest first', () => {
    const groups = groupPackages([
      run('a', 'Should universities ban generative AI in student assessment?', '2026-10-24T10:00:00Z'),
      run('b', 'Does microfinance increase women’s income?', '2026-11-10T10:00:00Z'),
      run('c', 'should universities ban generative AI in student assessment', '2026-11-07T10:00:00Z'),
      run('d', 'Should universities ban generative AI in student assessment?', '2026-10-24T11:00:00Z', 'p2'),
    ])
    expect(groups.map(g => g.runs.map(r => r.session.id))).toEqual([['b'], ['a', 'c'], ['d']])
    const ban = groups[1]
    expect(ban.latest.session.id).toBe('c')
    expect(ban.latest.runNumber).toBe(2)
  })
})

describe('questionSummary', () => {
  it('counts answered and partly answered questions', () => {
    expect(questionSummary([{ sufficiency: 'Sufficient' }, { sufficiency: 'PartiallySufficient' }, { sufficiency: 'Insufficient' }, { sufficiency: 'Sufficient' }]))
      .toEqual({ answered: 2, partly: 1, total: 4 })
  })
})

describe('scopeDetails', () => {
  const scope = { topic: 'Does microfinance increase women’s income', relationship: null, concepts: [], population: [], geography: [], timePeriod: null, academicField: null, minYear: null, maxYear: null }
  it('is empty when the scope only repeats the question', () => {
    expect(scopeDetails({ researchQuestion: 'Does microfinance increase women’s income?', scope })).toEqual([])
  })
  it('keeps the parts that add something', () => {
    expect(scopeDetails({ researchQuestion: 'Does microfinance increase women’s income?', scope: { ...scope, geography: ['Kenya'], minYear: 2010 } }))
      .toEqual([{ label: 'Geography', value: 'Kenya' }, { label: 'Period', value: '2010–now' }])
  })
})
