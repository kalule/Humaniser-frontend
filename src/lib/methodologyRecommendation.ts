export type ResearchApproach = 'Qualitative' | 'Quantitative' | 'Mixed Methods' | 'Undetermined'
export type ConfidenceLabel = 'High' | 'Moderate' | 'Low'

export interface MethodologyRecommendation {
  approach: ResearchApproach
  design?: string
  dataCollection: string[]
  analysis: string[]
  timeFrame: 'Cross-sectional' | 'Longitudinal' | 'Unspecified'
  rationale: string
  signals: string[]
  assumptions: string[]
  missingInformation: string[]
  confidence: ConfidenceLabel
  confidenceReason: string
  alternative?: string
  clarificationQuestion?: string
  // 2-3 short, clickable answers to clarificationQuestion — clicking one re-runs the
  // recommendation with that answer as confirmed intent, instead of leaving the student to type
  // a free-text reply into a plain question with no way to act on it.
  clarificationOptions?: string[]
  inputFingerprint: string
  version: 'methodology-recommendation-v1'
}

export interface RecommendationInput {
  title: string
  topic?: string
  context?: string
}

const includesAny = (text: string, terms: string[]) => terms.filter(term => text.includes(term))

// Stable, non-cryptographic fingerprint used only to deduplicate/stale-check recommendations.
export function methodologyInputFingerprint(input: RecommendationInput): string {
  const canonical = [input.title, input.topic, input.context]
    .map(value => (value ?? '').trim().toLowerCase().replace(/\s+/g, ' '))
    .join('|')
  let hash = 2166136261
  for (let i = 0; i < canonical.length; i += 1) {
    hash ^= canonical.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return `v1-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

export function recommendMethodology(input: RecommendationInput): MethodologyRecommendation {
  const text = `${input.title} ${input.topic ?? ''} ${input.context ?? ''}`.toLowerCase()
  const fingerprint = methodologyInputFingerprint(input)
  const experienceSignals = includesAny(text, ['experience', 'perception', 'perspective', 'lived experience', 'meaning', 'how do', 'why do'])
  const relationshipSignals = includesAny(text, ['relationship', 'association', 'correlation', 'predict', 'related to'])
  const quantitativeSignals = includesAny(text, ['questionnaire', 'survey', 'numerical', 'statistical', 'regression', 'measure'])
  const qualitativeSignals = includesAny(text, ['interview', 'focus group', 'observation', 'thematic analysis', 'phenomenolog'])
  const explicitIntegration = includesAny(text, ['mixed methods', 'integrate quantitative and qualitative', 'integrate survey and interview', 'survey and interviews', 'questionnaire and interviews'])
  const impactSignals = includesAny(text, ['impact', 'effect'])

  const common = {
    inputFingerprint: fingerprint,
    version: 'methodology-recommendation-v1' as const,
    timeFrame: 'Unspecified' as const,
    missingInformation: ['Research questions or objectives', 'Whether data collection occurs once or over time'],
  }

  if (explicitIntegration.length > 0 && (quantitativeSignals.length > 0 || text.includes('survey')) && (qualitativeSignals.length > 0 || text.includes('interview'))) {
    return { ...common, approach: 'Mixed Methods', design: 'Unspecified', dataCollection: ['Questionnaire', 'Interview'], analysis: ['Descriptive statistics', 'Thematic analysis'], rationale: 'The stated intent uses both numerical and qualitative evidence and explicitly indicates that the strands will be combined.', signals: explicitIntegration, assumptions: ['Both strands will address the same research problem and their findings will be integrated.'], confidence: 'High', confidenceReason: 'Both evidence types and an integration intent are explicit.', alternative: 'Use a single approach if one strand is only preparatory and will not be analysed or integrated.' }
  }

  if (relationshipSignals.length > 0) {
    return { ...common, approach: 'Quantitative', design: 'Correlational', dataCollection: ['Questionnaire'], analysis: ['Descriptive statistics', 'Regression'], rationale: 'The wording suggests examining an association between measurable constructs.', signals: relationshipSignals, assumptions: ['The constructs will be measured numerically.', '“Relationship” is associative and does not establish causation.'], confidence: quantitativeSignals.length ? 'High' : 'Moderate', confidenceReason: quantitativeSignals.length ? 'The title and stated methods both support numerical association testing.' : 'The relationship wording is informative, but the intended measures are not yet confirmed.', alternative: 'Mixed Methods may fit if interviews will explain the quantitative findings and both strands will be integrated.' }
  }

  if (experienceSignals.length > 0 || qualitativeSignals.length > 0) {
    const signals = [...experienceSignals, ...qualitativeSignals]
    return { ...common, approach: 'Qualitative', dataCollection: ['Interview'], analysis: ['Thematic analysis'], rationale: 'The wording centres meaning, perspectives, or experiences rather than numerical measurement.', signals, assumptions: ['The aim is to understand participants’ accounts in depth.'], confidence: signals.length > 1 ? 'High' : 'Moderate', confidenceReason: 'Experience-oriented wording supports qualitative inquiry, subject to the research questions.', alternative: 'A quantitative survey may fit if the intent is to measure prevalence rather than explore meaning.' }
  }

  if (impactSignals.length > 0) {
    return { ...common, approach: 'Undetermined', dataCollection: [], analysis: [], rationale: '“Impact” or “effect” alone does not establish whether the study will measure an association, test a causal intervention, or explore experiences.', signals: impactSignals, assumptions: [], confidence: 'Low', confidenceReason: 'The title states an outcome claim but not the evidence or design needed to assess it.', clarificationQuestion: 'Do you mainly want to measure a relationship, test an intervention, or explore participants’ experiences?', clarificationOptions: ['Measure a relationship numerically', 'Test an intervention experimentally', 'Explore participants’ experiences'], alternative: 'A non-experimental quantitative design may fit if the intent is to measure an association.' }
  }

  return { ...common, approach: 'Undetermined', dataCollection: [], analysis: [], rationale: 'The available wording does not yet distinguish numerical measurement from exploration of experiences.', signals: [], assumptions: [], confidence: 'Low', confidenceReason: 'The research intent and intended evidence are not explicit.', clarificationQuestion: 'Do you mainly want to measure relationships, explore participants’ experiences, or combine both?', clarificationOptions: ['Measure the relationship numerically', 'Explore participants’ experiences in depth', 'Do both, connecting the findings'] }
}
