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
    label: 'Planning or designing the study',
    backendState: 'Proposal',
  },
  {
    value: 'CollectingOrReadyForAnalysis',
    label: 'Collecting data or ready for analysis',
    backendState: 'DataAvailable',
  },
  {
    value: 'ResultsAvailable',
    label: 'Results available — link your analysis',
    backendState: 'AnalysisCompleted',
  },
  {
    value: 'LiteratureReviewOnly',
    label: 'Literature review only',
    backendState: 'LiteratureOnly',
  },
]

export function toResearchState(choice: ResearchStageChoice): ResearchState {
  return RESEARCH_STAGE_OPTIONS.find(option => option.value === choice)!.backendState
}
