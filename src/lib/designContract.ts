import type { ProjectSection } from '../types/research'

/**
 * The proposal's design contract: one record of the design decisions every section must state the
 * same way (design, strands, data sources, variables, sample size, software, who collects data, ...).
 *
 * Stored on the project's synced `sectionContent` map (key DESIGN_CONTRACT_KEY, a JSON string), the
 * same place the wizard keeps its setup answers, so no migration is needed and Guided, Document and
 * the server all read one copy. The server's StudySpecBuilder reads it as Confirmed facts, so every
 * drafting or rewriting prompt (parallel workers included) is given the same values.
 *
 * Editing a field never rewrites text. It marks the drafted sections that state that field as
 * "may be out of date" (STALE_KEY) and records which fields changed; the mark clears when the
 * student approves, marks the section reviewed, or rewrites it.
 */

export const DESIGN_CONTRACT_KEY = 'designContract'
export const STALE_KEY = 'designContractStale'
export const EDITED_AFTER_APPROVAL_KEY = 'editedAfterApproval'

export type ContractFieldKey =
  | 'designType' | 'studySetting' | 'strands' | 'dataSources' | 'unitOfAnalysis'
  | 'independentVariables' | 'dependentVariables' | 'moderators' | 'mediators' | 'controls'
  | 'samplingMethod' | 'sampleSize' | 'sampleSizeBasis' | 'samplingFrame' | 'populationDefinition'
  | 'analysisApproach' | 'software' | 'dataCollector' | 'ethicsStatus' | 'projectLength'

export type DesignContract = Partial<Record<ContractFieldKey, string>>

export interface ContractFieldDef {
  key:         ContractFieldKey
  label:       string
  placeholder: string
  /** Sections that state this decision and so may be out of date when it changes. */
  sections:    readonly string[]
  /** Comma-separated list (variables): compared as a set, not as text. */
  list?:       boolean
  /**
   * A key decision: must be set before the agent drafts anything after 1.1 Background, because several
   * chapters state it and a guessed default drifts between them. Same list as the server's
   * StudyDecisionGate.KeyFields. (Named isKey: `key` is the field's id.)
   */
  isKey?:      boolean
  group:       'Design' | 'Variables' | 'Sample' | 'Delivery'
}

export const CONTRACT_FIELDS: readonly ContractFieldDef[] = [
  { key: 'designType', group: 'Design', isKey: true, label: 'Design type', placeholder: 'e.g. Explanatory sequential mixed methods, cross-sectional survey',
    sections: ['0.0', '3.3', '5.2', '5.6', '5.8', '5.10', '5.12'] },
  { key: 'studySetting', group: 'Design', isKey: true, label: 'Study setting or data source', placeholder: 'e.g. The city or region studied; or the corpus or dataset analysed',
    sections: ['1.2', '5.1', '5.3'] },
  { key: 'strands', group: 'Design', label: 'Strands and order', placeholder: 'e.g. Survey first, then interviews with a subset of respondents',
    sections: ['5.2', '5.6', '5.8', '5.10', '6.1', '6.2'] },
  { key: 'dataSources', group: 'Design', isKey: true, label: 'Data collection mode', placeholder: 'e.g. Online questionnaire; semi-structured interviews; existing records',
    sections: ['5.8', '5.9', '5.10', '6.1', '6.2'] },
  { key: 'unitOfAnalysis', group: 'Design', label: 'Unit of analysis', placeholder: 'e.g. The organisation, reported by one respondent each; or the individual participant',
    sections: ['3.3', '5.3', '5.7'] },
  { key: 'independentVariables', group: 'Variables', label: 'Independent variables', list: true, placeholder: 'Comma-separated',
    sections: ['3.3', '4.1', '4.3', '4.4', '5.7', '5.10'] },
  { key: 'dependentVariables', group: 'Variables', label: 'Dependent variables', list: true, placeholder: 'Comma-separated',
    sections: ['3.3', '4.1', '4.3', '4.4', '5.7', '5.10'] },
  { key: 'moderators', group: 'Variables', label: 'Moderators', list: true, placeholder: 'Comma-separated, or leave empty',
    sections: ['3.3', '4.4', '5.7', '5.10'] },
  { key: 'mediators', group: 'Variables', label: 'Mediators', list: true, placeholder: 'Comma-separated, or leave empty',
    sections: ['3.3', '4.4', '5.7', '5.10'] },
  { key: 'controls', group: 'Variables', label: 'Control variables', list: true, placeholder: 'Comma-separated, or leave empty',
    sections: ['5.7', '5.10'] },
  { key: 'populationDefinition', group: 'Sample', isKey: true, label: 'Population and unit definition', placeholder: 'Who or what is studied, and how a unit qualifies',
    sections: ['1.2', '5.3', '5.4'] },
  { key: 'samplingMethod', group: 'Sample', isKey: true, label: 'Sampling method', placeholder: 'e.g. Purposive sampling; stratified random sampling',
    sections: ['5.4', '5.6', '5.10'] },
  { key: 'samplingFrame', group: 'Sample', isKey: true, label: 'Sampling frame (needed for probability sampling)', placeholder: 'The list the sample is drawn from',
    sections: ['5.3', '5.4', '5.6'] },
  { key: 'sampleSize', group: 'Sample', isKey: true, label: 'Sample size', placeholder: 'e.g. 384 respondents; 12 interviews',
    sections: ['0.0', '5.5', '5.6', '5.10', '6.1', '6.2'] },
  { key: 'sampleSizeBasis', group: 'Sample', isKey: true, label: 'Sample size basis', placeholder: 'e.g. Power analysis inputs; precision formula; saturation',
    sections: ['5.5'] },
  { key: 'analysisApproach', group: 'Delivery', isKey: true, label: 'Analysis approach', placeholder: 'e.g. Multiple regression; reflexive thematic analysis',
    sections: ['5.10', '5.12'] },
  { key: 'software', group: 'Delivery', isKey: true, label: 'Analysis software', placeholder: 'e.g. SPSS for the survey, NVivo for interviews',
    sections: ['5.9', '5.10', '6.2'] },
  { key: 'dataCollector', group: 'Delivery', isKey: true, label: 'Who collects the data', placeholder: 'e.g. The researcher, personally',
    sections: ['5.8', '5.9', '5.10', '5.11', '6.2'] },
  { key: 'ethicsStatus', group: 'Delivery', label: 'Ethics status', placeholder: 'e.g. To be submitted to the faculty ethics committee',
    sections: ['5.11', '6.1'] },
  { key: 'projectLength', group: 'Delivery', label: 'Project length', placeholder: 'e.g. 12 months',
    sections: ['6.1', '6.2'] },
]

/** The key decisions, in the order the Study decisions card lists them. */
export const KEY_FIELDS: readonly ContractFieldDef[] = CONTRACT_FIELDS.filter(f => f.isKey)
/** Everything else: optional, under "More decisions". */
export const MORE_FIELDS: readonly ContractFieldDef[] = CONTRACT_FIELDS.filter(f => !f.isKey)

/**
 * True when the sampling method draws units by chance, so it needs a sampling frame. Same rule as the server's
 * StudyDecisionGate.IsProbabilitySampling: "non-probability" never counts.
 */
export function isProbabilitySampling(method: string | null | undefined): boolean {
  if (!method?.trim()) return false
  const t = method.replace(/\bnon[-\s]?probability\b/gi, ' ')
  return /\bprobability\b|\brandom(?:ly|ised|ized)?\b|\bstratified\b|\bcluster\s+sampl\w*|\bsystematic\s+sampl\w*|\bmulti[-\s]?stage\b/i.test(t)
}

/** The key decisions this contract needs: the sampling frame only for probability sampling (design-aware). */
export const requiredKeyFields = (contract: DesignContract): ContractFieldDef[] =>
  KEY_FIELDS.filter(f => f.key !== 'samplingFrame' || isProbabilitySampling(contract.samplingMethod))

export const missingKeyDecisions = (contract: DesignContract): ContractFieldKey[] =>
  requiredKeyFields(contract).filter(f => !contract[f.key]?.trim()).map(f => f.key)

export const keyDecisionsSet = (contract: DesignContract) => missingKeyDecisions(contract).length === 0

/** What the project already says about its method (setup answers and the confirmed methodology). */
export interface DecisionSources {
  methodologyType?:    string | null
  methodologySubType?: string | null
  researchDesign?:     string | null
  dataCollection?:     string | null
  /** The setting the student entered (location step or project field); never guessed. */
  studyLocation?:      string | null
  /** The population the student entered; never guessed. */
  studyPopulation?:    string | null
}

type Approach = 'quantitative' | 'qualitative' | 'mixed'

function approachOf(src: DecisionSources): Approach {
  const t = `${src.methodologyType ?? ''} ${src.methodologySubType ?? ''} ${src.researchDesign ?? ''}`.toLowerCase()
  if (t.includes('mixed')) return 'mixed'
  if (t.includes('qualitative') || t.includes('case study') || t.includes('phenomenolog') || t.includes('grounded')) return 'qualitative'
  return 'quantitative'
}

type SuggestedKey = 'designType' | 'dataSources' | 'samplingMethod' | 'sampleSize' | 'sampleSizeBasis'
  | 'analysisApproach' | 'software' | 'dataCollector'
type KeyDecisions = Record<SuggestedKey, string> & Partial<Record<'studySetting' | 'populationDefinition', string>>

// Generic planning defaults by approach, never topic terms. The sampling method is non-probability so a default can never
// claim random sampling without a frame (PR 2); a student who has a frame changes it and is then asked for the frame.
const SUGGESTED: Record<Approach, Omit<KeyDecisions, 'dataCollector' | 'studySetting' | 'populationDefinition'>> = {
  quantitative: {
    designType:       'Cross-sectional survey',
    dataSources:      'Structured questionnaire',
    samplingMethod:   'Non-probability purposive sampling of eligible respondents',
    sampleSize:       '384 respondents',
    sampleSizeBasis:  'Cochran formula: 95% confidence, 5% margin of error, p = 0.5',
    analysisApproach: 'Descriptive statistics, correlation and multiple regression',
    software:         'SPSS',
  },
  qualitative: {
    designType:       'Qualitative case study',
    dataSources:      'Semi-structured interviews',
    samplingMethod:   'Purposive sampling',
    sampleSize:       '12 to 15 participants',
    sampleSizeBasis:  'Data saturation and information power, reviewed after each interview',
    analysisApproach: 'Reflexive thematic analysis',
    software:         'NVivo',
  },
  mixed: {
    designType:       'Explanatory sequential mixed methods (survey, then interviews)',
    dataSources:      'Structured questionnaire; semi-structured interviews',
    samplingMethod:   'Non-probability purposive sampling for the survey; interviewees chosen from survey respondents who agree to be contacted',
    sampleSize:       '384 survey respondents; 12 interviews with a subset',
    sampleSizeBasis:  'Survey: Cochran formula, 95% confidence, 5% margin of error; interviews: data saturation',
    analysisApproach: 'Descriptive statistics and multiple regression for the survey; reflexive thematic analysis for the interviews, integrated in a joint display',
    software:         'SPSS for the survey, NVivo for the interviews',
  },
}

const usable = (v: string | null | undefined) => {
  const t = v?.trim()
  return t && !['unspecified', 'other', 'not sure'].includes(t.toLowerCase()) ? t : undefined
}

/**
 * Suggested values for the key decisions, from what the project already says about its method.
 * These are the planning defaults drafting used to fall back on silently; "Use suggested defaults"
 * writes them into the decisions so they are visible and editable.
 */
export function suggestedDecisions(src: DecisionSources): KeyDecisions {
  const base = SUGGESTED[approachOf(src)]
  return {
    ...base,
    designType:    usable(src.researchDesign) ?? usable(src.methodologySubType) ?? base.designType,
    dataSources:   usable(src.dataCollection) ?? base.dataSources,
    dataCollector: 'The researcher, personally',
    // Setting and population are the student's own: suggested only when the project already states them, never invented,
    // so "Use suggested defaults" leaves them for the student when nothing is recorded.
    studySetting:         usable(src.studyLocation),
    populationDefinition: usable(src.studyPopulation),
  }
}

/** The contract with every empty key decision filled from the suggestions. Values already set are never changed. */
export function withSuggestedDefaults(contract: DesignContract, suggestions: Partial<DesignContract>): DesignContract {
  const next: DesignContract = { ...contract }
  for (const f of KEY_FIELDS) {
    const v = suggestions[f.key]?.trim()
    if (!next[f.key]?.trim() && v) next[f.key] = v
  }
  return next
}

export const CONTRACT_FIELD = Object.fromEntries(CONTRACT_FIELDS.map(f => [f.key, f])) as Record<ContractFieldKey, ContractFieldDef>

type ContentMap = Record<string, string> | undefined | null

function readJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object' ? parsed as T : fallback
  } catch {
    return fallback
  }
}

const clean = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

export function readContract(content: ContentMap): DesignContract {
  const raw = readJson<Record<string, unknown>>(content?.[DESIGN_CONTRACT_KEY], {})
  const out: DesignContract = {}
  for (const f of CONTRACT_FIELDS) {
    const v = clean(raw[f.key])
    if (v) out[f.key] = v
  }
  return out
}

export const serializeContract = (contract: DesignContract): string => {
  const out: DesignContract = {}
  for (const f of CONTRACT_FIELDS) { const v = clean(contract[f.key]); if (v) out[f.key] = v }
  return JSON.stringify(out)
}

/** A list field as a normalised set of items ("ICT adoption, Firm size" -> ["ict adoption", "firm size"]). */
export const listItems = (value: string | undefined): string[] =>
  (value ?? '').split(/[,;\n]/).map(s => s.trim()).filter(Boolean)

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

function sameValue(f: ContractFieldDef, a: string | undefined, b: string | undefined): boolean {
  if (f.list) {
    const x = new Set(listItems(a).map(norm)), y = new Set(listItems(b).map(norm))
    return x.size === y.size && [...x].every(i => y.has(i))
  }
  return norm(a ?? '') === norm(b ?? '')
}

/** Fields whose value differs between two contracts. */
export function changedFields(before: DesignContract, after: DesignContract): ContractFieldKey[] {
  return CONTRACT_FIELDS.filter(f => !sameValue(f, before[f.key], after[f.key])).map(f => f.key)
}

/** Section code -> labels of the contract fields that changed since that section was last reviewed. */
export type StaleMarks = Record<string, string[]>

export function readStale(content: ContentMap): StaleMarks {
  const raw = readJson<Record<string, unknown>>(content?.[STALE_KEY], {})
  const out: StaleMarks = {}
  for (const [code, labels] of Object.entries(raw)) {
    if (Array.isArray(labels)) {
      const list = labels.filter((l): l is string => typeof l === 'string')
      if (list.length) out[code] = list
    }
  }
  return out
}

/** A section has something to be out of date only once it has text (a queued section reads the new contract when drafted). */
const hasText = (s: Pick<ProjectSection, 'content' | 'status'>) => s.status !== 'Generating' && s.content.trim().length > 0

/**
 * Adds stale marks for every drafted section that states one of the changed fields. Existing marks
 * are kept and merged, so two edits before a review list both fields. Never touches section text.
 */
export function propagateStale(
  previous: StaleMarks, changed: readonly ContractFieldKey[], sections: readonly Pick<ProjectSection, 'code' | 'content' | 'status'>[],
): StaleMarks {
  const next: StaleMarks = { ...previous }
  const byCode = new Map(sections.map(s => [s.code, s]))
  for (const key of changed) {
    const field = CONTRACT_FIELD[key]
    for (const code of field.sections) {
      const s = byCode.get(code)
      if (!s || !hasText(s)) continue
      const labels = new Set(next[code] ?? [])
      labels.add(field.label)
      next[code] = [...labels]
    }
  }
  return next
}

export function clearStale(previous: StaleMarks, code: string): StaleMarks {
  if (!(code in previous)) return previous
  const next = { ...previous }
  delete next[code]
  return next
}

/** Codes of sections the student edited after approving them (cleared by approving again). */
export function readEditedAfterApproval(content: ContentMap): string[] {
  const raw = readJson<unknown>(content?.[EDITED_AFTER_APPROVAL_KEY], [])
  return Array.isArray(raw) ? raw.filter((c): c is string => typeof c === 'string') : []
}

export const serializeCodes = (codes: readonly string[]) => JSON.stringify([...new Set(codes)])
