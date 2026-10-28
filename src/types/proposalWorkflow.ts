export interface ResearchSpecification {
  study?: StudySpecification | null
  title: string; problem: string; field: string; academicLevel: string; geography: string
  population: string; unitOfAnalysis: string; temporalScope: string; framework: string
  contribution: string; limitations: string; scopeLimits: string; citationStyle: string
  institutionRequirements: string; universityTemplateId: string | null; methodologyVersion: number
  mixedMethodIntegration: string; totalWords: number
  hypothesisApplicability: string; hypothesisRationale: string
  hypotheses: { id: string; nullHypothesis: string; alternativeHypothesis: string; objectiveIds: string[]; constructIds: string[]; plannedTest: string; significanceLevel: number }[]
  questions: { id: string; text: string }[]
  objectives: { id: string; text: string; type: string; questionIds: string[]; constructIds: string[]; dataSourceIds: string[]; analysisIds: string[] }[]
  constructs: { id: string; name: string; definition: string; role: string; scale: string; unit: string }[]
  dataSources: { id: string; name: string; collectionMethod: string; literatureId: string | null }[]
  analyses: { id: string; method: string; assumptions: string[]; missingDataHandling: string; strand: string }[]
  sampling: { design: string; confidence: number; margin: number | null; proportion: number | null; populationSize: number | null; effectSize: number | null; power: number | null; designEffect: number; responseRate: number; frame: string; rationale: string }
}
export interface StudySpecification {
  populationDescription?: PopulationDescription | null
  subject?: { kind: 'Unknown' | 'HumanParticipants' | 'SoftwareSystemExperiment' | 'SecondaryData'; confirmed: boolean; experiment: { experimentalUnit: string; conditions: string[]; independentRepetitions: number | null; independenceRationale: string; telemetrySourceIds: string[]; allocationPlan: string } | null } | null
  design?: { $family: string } | null
  schemaVersion: 2
  methodologySubtype: string
  samplePlan: { minimum: number; maximum: number; initialTarget: number; adaptiveStoppingRule: string; reviewTranscriptCount: number } | null
  eligibility: EligibilityPredicate[]
  eligibilityPlan?: EligibilityPlan | null
  instruments: { id: string; text: string; questionIds: string[]; analysisIds: string[] }[]
  budget: { currency: string; items: { id: string; description: string; quantity: number; unitPrice: number }[]; contingencyRate: number } | null
  timeline: { id: string; name: string; startMonth: number; durationMonths: number; dependencies: string[]; participantFacing: boolean; approval: boolean }[]
  dataLifecycle: { asset: string; storageLocations: string[]; accessRoles: string[]; retentionMonths: number; retentionTrigger: string; identityState: string; withdrawalRule: string }[]
  decisions: Record<string, string>
  unresolvedNeeds: { key: string; reason: string; owner: string }[]
}
export interface EligibilityPredicate {
  field: string; operator: string; value: string; unit: string; exclusion: boolean
  details?: { group?: string | null; operationalDefinition?: string | null; screeningMethod?: string | null; verification?: 'SelfReported' | 'Verified' | null; requiresRecordAccess: boolean; rationale?: string | null } | null
}
export interface EligibilityPlan {
  allInclusionRequired: boolean | null; anyExclusionSufficient: boolean | null
  alternativeRoutes: string[]; exclusionRule: string | null; unknownHandling: string | null
  groupLogic?: string | null
  screeningProcedures: string | null; verification: 'SelfReported' | 'Verified' | null
  recordAccessAuthorised: boolean | null; includesUnexposedParticipants: boolean | null; accommodations: string[]
}
export interface PopulationDescription {
  accessStatus: 'NotDecided' | 'Proposed' | 'Confirmed'
  samplingFrameDocumented: boolean | null
  recordedCharacteristics: { name: string; categoryLabels: string[] }[]
}
export interface ProposalFinding { key: string; status: string; severity: string; message: string; sectionCode: string | null; observed?: string; expected?: string; repairClass?: string }
export interface ProposalDesignReadiness {
  mode: 'CanonicalResearchDesign' | 'LegacyAcceptedSpecification' | 'LegacyCompatibility' | 'DesignRequired'
  canGenerate: boolean
  acceptedRevisionId: string | null
  acceptedVersion: number | null
  boundRevisionId: string | null
  validationFingerprint: string | null
  findings: ProposalFinding[]
  sections: { code: string; affected: boolean; generatedRevisionId: string | null; contentVersion: string; reason: string | null }[]
  allowedActions: string[]
}
export interface ProposalRepairPreview {
  sectionCode: string; specificationId: string; contentVersion: string
  originalContent: string; suggestedContent: string | null; findings: ProposalFinding[]; requiresManualResolution: boolean
}
export interface SectionContract { code: string; title: string; order: number; targetWords: number; minWords: number; maxWords: number; required: boolean; dependencies: string[]; requiresEvidence: boolean }
export interface EvidenceBinding {
  id: string; sectionCode: string; claim: string; literatureId: string; coverage: string; start: number; length: number
  quote: string; sourceHash: string; corpusHash: string; purpose: string; status: string; message: string
}
export interface GapDossier { gap: string; type: string; scope: string; evidenceIds: string[]; counterEvidenceIds: string[]; searchQueryIds: string[]; coverageLimitations: string; counterEvidenceAssessment: string }
export interface WorkflowState {
  accepted: { id: string; version: number; hash: string; specification: ResearchSpecification } | null
  importedDraft: ResearchSpecification; policyVersion: string; enforcementMode: string; fingerprint: string
  contracts: SectionContract[]; findings: ProposalFinding[]; evidence: EvidenceBinding[]
  gaps: { id: string; status: string; message: string; dossier: GapDossier }[]
  reviews: { id: string; status: string; fingerprint: string; findings: ProposalFinding[] }[]
}
export interface WorkflowHistory {
  revisions: { id: string; version: number; createdReason: string; specificationSchemaVersion: number; createdAt: string }[]
  artifacts: { id: string; kind: string; status: string; sectionCode: string; createdAt: string; fingerprint: string }[]
  sections: { sectionCode: string; contentVersion: string; status: string; content: string }[]
}
export interface WorkflowSource { id: string; title: string; authors: string; year: number; isRetracted: boolean }
