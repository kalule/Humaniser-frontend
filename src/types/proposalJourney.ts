import type { ProposalDesignReadiness } from './proposalWorkflow'
import type { GenerationStatus } from './research'
export type WritingExperience = 'Guided' | 'FirstDraft'
export interface ProposalJourneySummary {
  projectId: string; stage: string; nextAction: string; allowedActions: string[]
  designRequired: boolean; acceptedRevisionId: string | null; writingMode: WritingExperience | null
  affectedSections: number; hasContent: boolean
}
export interface ProposalJourneyView { summary: ProposalJourneySummary; readiness: ProposalDesignReadiness | null; generation: GenerationStatus | null }
