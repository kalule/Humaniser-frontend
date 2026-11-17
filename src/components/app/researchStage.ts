import type { ResearchState } from '../../types/workbench'

export type ResearchStageChoice =
  | 'PlanningOrDesigning'
  | 'CollectingOrReadyForAnalysis'
  | 'ResultsAvailable'
  | 'LiteratureReviewOnly'

export const RESEARCH_STAGE_OPTIONS: ReadonlyArray<{
  value: ResearchStageChoice
  label: string
  backendState: ResearchState
}> = [
  {
    value: 'PlanningOrDesigning',
    label: 'Research proposal / protocol',
    backendState: 'Proposal',
  },
  {
    value: 'CollectingOrReadyForAnalysis',
    label: 'Study in progress ? data collection or analysis pending',
    backendState: 'DataAvailable',
  },
  {
    value: 'ResultsAvailable',
    label: 'Results available — link your analysis',
    backendState: 'AnalysisCompleted',
  },
  {
    value: 'LiteratureReviewOnly',
    label: 'Literature-based paper ? synthesize published research',
    backendState: 'LiteratureOnly',
  },
]

export function toResearchState(choice: ResearchStageChoice): ResearchState {
  return RESEARCH_STAGE_OPTIONS.find(option => option.value === choice)!.backendState
}
