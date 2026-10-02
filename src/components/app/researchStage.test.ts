import { describe, expect, it } from 'vitest'
import { RESEARCH_STAGE_OPTIONS, toResearchState } from './researchStage'

describe('research-stage choices', () => {
  it('maps the four UI choices onto behavior-preserving backend states', () => {
    expect(RESEARCH_STAGE_OPTIONS.map(option => [option.value, option.backendState])).toEqual([
      ['PlanningOrDesigning', 'Proposal'],
      ['CollectingOrReadyForAnalysis', 'DataAvailable'],
      ['ResultsAvailable', 'AnalysisCompleted'],
      ['LiteratureReviewOnly', 'LiteratureOnly'],
    ])
  })

  it('uses the analysis-completed backend branch for results linkage', () => {
    expect(toResearchState('ResultsAvailable')).toBe('AnalysisCompleted')
  })
})
