import type { ResearchSpecification } from './proposalWorkflow'

export type DesignAction = 'Start' | 'View' | 'ProvideInput' | 'Accept' | 'Revise' | 'Cancel' | 'Restart'
export interface DesignMethodology { family: string; design: string; intent: string; rationale: string; paradigm: string; samplingStrategy: string }
export interface DesignCandidate { id: string; methodology: DesignMethodology; rationale: string; strengths: string[]; limitations: string[]; assumptions: string[]; comparison: { dimension: string; assessment: string; reason: string }[] }
export interface DesignQuestion { id: string; question: string; reason: string; field: string | null; valueType: string; answerable: boolean; maxLength: number | null }
export interface DesignInputValue { specification?: ResearchSpecification; text?: string; populationAccess?: boolean; dataAvailable?: boolean; permissionsResolved?: boolean }
export interface DesignEvidence { needId: string; type: string; label: string; reason: string; status: string; mandatory: boolean; evidenceCount: number; contradictionPresent: boolean; limitations: string[]; updatedAt: string | null; researchStatus: string }
export interface ResearchDesignView {
  draft?: ResearchSpecification | null
  subject?: NonNullable<ResearchSpecification['study']>['subject']
  projectId: string; runId: string | null; status: string; currentStage: string
  progress: { stage: string; phase: string; startedAt: string | null; elapsedSeconds: number | null; revalidating: boolean }
  researchSummary: { title: string; problem: string; field: string; academicLevel: string }
  methodology?: DesignMethodology | null; recommendedDesign?: DesignCandidate | null; alternativeDesigns: DesignCandidate[]
  researchQuestions: ResearchSpecification['questions']; objectives: ResearchSpecification['objectives']
  alignment: { questionId: string; objectiveId: string | null; constructIds: string[]; dataRequired: string; dataSourceIds: string[]; collectionMethods: string[]; instrumentIds: string[]; analysisIds: string[]; expectedOutput: string }[]
  population: { target: string; accessible: string | null; geography: string; unitOfAnalysis: string; temporalScope: string }
  sampling: ResearchSpecification['sampling']
  sampleAdequacy: { status: string; completed: number | null; invited: number | null; assumptions: string[]; approximation: boolean; perGroup: number | null; requirement: { method: string; analysisId: string | null; reason: string; requiredInputs: string[] } | null; calculatorVersion: string }
  constructs: { id: string; name: string; definition: string; kind: string; role: string; scale: string; unit: string; operationalisation: string | null }[]
  instruments: { id: string; name: string; version: string | null; context: string | null; claimsValidated: boolean; permissionResolved: boolean | null }[]
  dataCollection: ResearchSpecification['dataSources']; analysisPlan: ResearchSpecification['analyses']
  qualitativePlan?: { focus: string; livedExperience: boolean; developsTheory: boolean; collections: string[]; recruitment: string; qualityPractices: string[]; qualityRationale: string; claimsUniversalChecklist: boolean; caseBoundary: string } | null
  mixedMethodsPlan?: { timing: string; priority: string; quantitativeSampling: string; qualitativeSampling: string; jointInterpretation: string } | null
  feasibility?: { populationAccess: boolean; dataAvailable: boolean; instrumentsAvailable: boolean; permissionsResolved: boolean; monthsAvailable: number; monthsRequired: number; recruitableCompleted: number; requiredTools: string[]; availableTools: string[]; requiredSkills: string[]; availableSkills: string[]; permittedAcademicLevels: string[]; idealDesign: string; feasibleDesign: string; changesResearchQuestion: boolean; tradeoffDecision: string } | null
  ethics: { type: string; plan: string }[]; evidence: DesignEvidence[]
  findings: { ruleId: string; severity: string; category: string; message: string; expected: string; repairGuidance: string; componentIds: string[]; canAutoResolve: boolean }[]
  questions: DesignQuestion[]; readiness: { status: string; blockers: number; major: number; minor: number; warnings: number; canAccept: boolean }
  allowedActions: DesignAction[]; version: string; canonicalRevision: string | null; updatedAt: string; attention: string | null; budget: { status: string; consumedCredits: number }
}
export interface DesignVersionCommand { idempotencyKey: string; expectedVersion: string; expectedSpecificationRevision: string | null }
export interface DesignStartCommand { idempotencyKey: string; expectedSpecificationRevision: string | null }
export interface DesignInputCommand { idempotencyKey: string; expectedVersion: string; questionId: string; value: DesignInputValue }
export interface DesignCommandResult { view: ResearchDesignView; idempotencyHit: boolean; backgroundWork: boolean }
export interface DesignHistory { items: { runId: string; status: string; createdAt: string; completedAt: string | null; canonicalRevision: string | null; title: string }[]; nextCursor: string | null }
