import type { ResearchSpecification } from '../types/proposalWorkflow'
export type DetailRecord = Record<string, unknown>
export function replaceDesignDetail(spec: ResearchSpecification, path: (string | number)[], value: unknown): ResearchSpecification {
  const next = structuredClone(spec)
  let node = next as unknown as DetailRecord
  for (const key of path.slice(0, -1)) node = node[key] as DetailRecord
  node[path[path.length - 1]] = value
  return next
}
// Input shapes mirror API contracts; these are incomplete proposed values, never methodological decisions.
export const detailTemplates: Record<string, DetailRecord> = {
  subject: { kind: 'Unknown', confirmed: false, experiment: null },
  experiment: { experimentalUnit: '', conditions: [], independentRepetitions: null, independenceRationale: '', telemetrySourceIds: [], allocationPlan: '' },
  feasibility: { access: '', time: '', budget: '', tools: '', ability: '' },
  qualitative: { focus:'',livedExperience:false,developsTheory:false,collections:[],recruitment:'',qualityPractices:[],qualityRationale:'',claimsUniversalChecklist:false,caseBoundary:'' },
  mixed: { timing:'',priority:'',quantitativeSampling:'',qualitativeSampling:'',jointInterpretation:'' },
  safeguards: { schemaVersion: 1, inference: '', causalIdentification: '', qualitative: null, mixed: null, constraints: null, characteristics: null, ethicsDecisions: [], frameworkRelationships: [] },
  constraints: { populationAccess: false, dataAvailable: false, instrumentsAvailable: false, permissionsResolved: false, monthsAvailable: 0, monthsRequired: 0, recruitableCompleted: 0, requiredTools: [], availableTools: [], requiredSkills: [], availableSkills: [], permittedAcademicLevels: [], idealDesign: '', feasibleDesign: '', changesResearchQuestion: false, tradeoffDecision: '' },
  characteristics: { humanParticipants: false, minorsOrVulnerable: false, sensitiveData: false, healthData: false, identifiableData: false, secondaryData: false, recordings: false, institutionalAccess: false, crossBorder: false, retentionMonths: null },
  designMetadata: { method: '', primaryAnalysisId: null, estimand: '', assumptionProvenance: '', qualitativeAdequacy: null, parameters: null, sensitivity: [] },
  parameters: { alpha: null, power: null, effect: null, proportion1: null, proportion2: null, allocationRatio: null, attritionRate: null, nonresponseRate: null, effectEvidenceIds: [], effectJustification: '', approximationAcknowledged: false, knownDifferenceVariance: false, assumptions: [], predictorCount: null, effectIsPlanningAssumption: false },
  qualitativeAdequacy: { rationale: '', stoppingRule: '', reviewMilestones: '' },
  methodology: { observations: '', longitudinal: false, groupCount: 0, collection: '', available: false, frameAccessible: false, participantCharacteristics: [] },
  adjustment: {selection:'',postTreatment:false,actsAsMediator:false,pValuePolicyPermits:false,policyJustification:''},
  measurement: { instrumentIds: [], scoring: '', scoredScale: '', requiresInstrument: false, canonicalOutcomeName: '' },
}
export const detailChoices: Record<string, string[]> = {
  accessStatus: ['NotDecided','Proposed','Confirmed'],
  verification: ['SelfReported','Verified'],
  'sampling.designMetadata.method': ['ProportionPrecision','TwoIndependentMeans','Qualitative','ExternalReviewed','Correlation','Regression','Cluster','Mediation','TwoProportions','PairedMeans','Moderation','RepeatedMeasures','Multilevel','Survival','SEM'],
  intent: ['Describe','Explore','Compare','Associate','Predict','Explain','Evaluate','EstimateEffect','UnderstandExperience','DevelopTheory','AssessImplementation','ValidateInstrument','InvestigateHistory','SynthesizeEvidence'],
  kind: ['Variable','Phenomenon','Experience','Process','Meaning','Context'],
  analysisMethod: ['DescriptiveProportion','DescriptiveSummary','Correlation','TwoIndependentMeans','Regression','Mediation','ThematicAnalysis','PhenomenologicalAnalysis','GroundedTheoryCoding','CaseStudyAnalysis','TwoProportions','PairedMeans','Moderation'],
  Quantitative: ['Descriptive','CrossSectional','Correlational','Comparative','Cohort','CaseControl','Experimental','QuasiExperimental'],
  Qualitative: ['QualitativeDescriptive','Phenomenology','GroundedTheory','CaseStudy'],
  MixedMethods: ['Convergent','ExplanatorySequential','ExploratorySequential'],
  measurementScale: ['Nominal','Binary','Ordinal','Continuous','Count'], scoredScale: ['Nominal','Binary','Ordinal','Continuous','Count'], scoreScale: ['Nominal','Binary','Ordinal','Continuous','Count'],
  variableRole: ['Predictor','Outcome','Mediator','Moderator','Covariate','Confounder'], priority: ['Primary','Secondary'],
  observations: ['Independent','Paired','Repeated','Clustered'], collection: ['Questionnaire','Assessment','Interview','Observation','Documents','AdministrativeRecords','InstrumentedTelemetry'],
  mechanism: ['Uncertain','MCAR','MAR','MNAR'], strategy: ['ReportOnly','CompleteCase','MultipleImputation','Likelihood','QualitativeIncompleteAccounts'],
  inference: ['SampleOnly','Population','Causal'], samplingStrategy: ['Probability','Census','Convenience','Purposive','Theoretical','CaseSelection'], quantitativeSampling: ['Probability','Census','Convenience','Purposive','Theoretical','CaseSelection'], qualitativeSampling: ['Probability','Census','Convenience','Purposive','Theoretical','CaseSelection'],
  recruitment: ['Probability','Census','Convenience','Purposive','Theoretical','CaseSelection'], selection: ['TheoryPrespecified','VerifiedEvidence','PValueScreening'],
  timing: ['Concurrent','QuantitativeThenQualitative','QualitativeThenQuantitative'], priorityMixed: ['Equal','Quantitative','Qualitative'],
  type: ['Consent','AssentGuardianConsent','VulnerabilityProtection','SensitiveDataProtection','HealthDataProtection','Privacy','DatasetPermission','RecordingConsent','InstitutionalPermission','CrossBorderTransfer','Retention','Withdrawal'],
}
export function choicesForDetail(record: DetailRecord, path: (string | number)[], key: string): string[] | undefined {
  if (key === 'kind' && path.includes('subject')) return ['Unknown','HumanParticipants','SoftwareSystemExperiment','SecondaryData']
  if (key === 'type') return path.includes('ethicsDecisions') ? detailChoices.type : undefined
  if (key === 'method' && path[0] === 'analyses') return path.includes('design') ? detailChoices.analysisMethod : undefined
  return (key === 'design' ? detailChoices[String(record.$family)] : undefined) ?? detailChoices[[...path,key].join('.')] ?? (key === 'priority' && path.includes('mixed') ? detailChoices.priorityMixed : detailChoices[key])
}
export const detailLabel = (key: string) => key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase())
export const protectedDetail = (key: string) => key === '$family' || ['id','schemaVersion','version','evidenceNeeds','evidenceDecisions','claimsValidated','claimsReliability'].includes(key) || /EvidenceIds$|^evidenceIds$/.test(key)

// Shape checks only. Compatibility, adequacy and readiness remain server decisions.
export function designDetailErrors(spec: ResearchSpecification): string[] {
  const errors: string[] = []
  const population = spec.study?.populationDescription
  if (population) for (const characteristic of population.recordedCharacteristics) {
    if (!characteristic.name.trim()) errors.push('Name each recorded population characteristic.')
    if (spec.study?.eligibility?.some(rule => rule.field.trim().toLowerCase() === characteristic.name.trim().toLowerCase())) errors.push(`${characteristic.name.trim()} cannot be both recorded-only and eligibility-defining.`)
  }
  const walk = (value: unknown, path: (string | number)[]) => {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) { value.forEach((v,i) => walk(v,[...path,i])); return }
    const record = value as DetailRecord
    for (const [key,item] of Object.entries(record)) {
      if (protectedDetail(key)) continue
      const full = [...path,key]
      const choices = choicesForDetail(record,path,key)
      const optional = ['variableRole','measurementScale','scoreScale','verification'].includes(key) || key === 'intent' && path[0] === 'objectives'
      if (choices && !(optional && item == null) && !choices.includes(String(item ?? ''))) errors.push(`Choose ${detailLabel(key).toLowerCase()} in ${detailLabel(String(path[0]))}.`)
      if (key === 'collections' && Array.isArray(item) && item.some(v => !detailChoices.collection.includes(String(v)))) errors.push('Choose supported collection techniques for qualitative safeguards.')
      if (typeof item === 'number' && !Number.isFinite(item)) errors.push(`${detailLabel(key)} must be a finite number.`)
      if (path.includes('parameters') || path.includes('sensitivity')) {
        if (['alpha','power','allocationRatio','attritionRate','nonresponseRate'].includes(key) && (typeof item !== 'number' || !Number.isFinite(item))) errors.push(`Enter ${detailLabel(key).toLowerCase()} for sample planning.`)
      }
      if (['fromConstructId','toConstructId'].includes(key) && !item) errors.push('Choose both constructs for the framework relationship.')
      walk(item,full)
    }
  }
  walk(spec,[])
  return [...new Set(errors)]
}

