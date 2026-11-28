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
 * Since 2026-11-27 only the server writes it (silent study decisions, planned from the topic); the
 * client reads it for the Review card. Sections marked "may be out of date" (STALE_KEY) keep their
 * mark until the student approves, marks the section reviewed, or rewrites it.
 */

export const DESIGN_CONTRACT_KEY = 'designContract'
export const STALE_KEY = 'designContractStale'
export const EDITED_AFTER_APPROVAL_KEY = 'editedAfterApproval'
/** The student's instruction for the next section the paused run drafts; read and cleared by the server (AgentNextInstruction). */
export const AGENT_NEXT_INSTRUCTION_KEY = 'agentNextInstruction'

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
  group:       'Design' | 'Variables' | 'Sample' | 'Delivery'
}

export const CONTRACT_FIELDS: readonly ContractFieldDef[] = [
  { key: 'designType', group: 'Design', label: 'Design type', placeholder: 'e.g. Explanatory sequential mixed methods, cross-sectional survey',
    sections: ['0.0', '3.3', '5.2', '5.6', '5.8', '5.10', '5.12'] },
  { key: 'studySetting', group: 'Design', label: 'Study setting or data source', placeholder: 'e.g. The city or region studied; or the corpus or dataset analysed',
    sections: ['1.2', '5.1', '5.3'] },
  { key: 'strands', group: 'Design', label: 'Strands and order', placeholder: 'e.g. Survey first, then interviews with a subset of respondents',
    sections: ['5.2', '5.6', '5.8', '5.10', '6.1', '6.2'] },
  { key: 'dataSources', group: 'Design', label: 'Data collection mode', placeholder: 'e.g. Online questionnaire; semi-structured interviews; existing records',
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
  { key: 'populationDefinition', group: 'Sample', label: 'Population and unit definition', placeholder: 'Who or what is studied, and how a unit qualifies',
    sections: ['1.2', '5.3', '5.4'] },
  { key: 'samplingMethod', group: 'Sample', label: 'Sampling method', placeholder: 'e.g. Purposive sampling; stratified random sampling',
    sections: ['5.4', '5.6', '5.10'] },
  { key: 'samplingFrame', group: 'Sample', label: 'Sampling frame (needed for probability sampling)', placeholder: 'The list the sample is drawn from',
    sections: ['5.3', '5.4', '5.6'] },
  { key: 'sampleSize', group: 'Sample', label: 'Sample size', placeholder: 'e.g. 384 respondents; 12 interviews',
    sections: ['0.0', '5.5', '5.6', '5.10', '6.1', '6.2'] },
  { key: 'sampleSizeBasis', group: 'Sample', label: 'Sample size basis', placeholder: 'e.g. Power analysis inputs; precision formula; saturation',
    sections: ['5.5'] },
  { key: 'analysisApproach', group: 'Delivery', label: 'Analysis approach', placeholder: 'e.g. Multiple regression; reflexive thematic analysis',
    sections: ['5.10', '5.12'] },
  { key: 'software', group: 'Delivery', label: 'Analysis software', placeholder: 'e.g. SPSS for the survey, NVivo for interviews',
    sections: ['5.9', '5.10', '6.2'] },
  { key: 'dataCollector', group: 'Delivery', label: 'Who collects the data', placeholder: 'e.g. The researcher, personally',
    sections: ['5.8', '5.9', '5.10', '5.11', '6.2'] },
  { key: 'ethicsStatus', group: 'Delivery', label: 'Ethics status', placeholder: 'e.g. To be submitted to the faculty ethics committee',
    sections: ['5.11', '6.1'] },
  { key: 'projectLength', group: 'Delivery', label: 'Project length', placeholder: 'e.g. 12 months',
    sections: ['6.1', '6.2'] },
]

// The key decisions used to be set by the student in a "Study decisions" card (with "Use suggested defaults"). They are
// now planned by the server from the topic before drafting (silent study decisions: the server's StudyDecisionService
// writes this contract and keeps it as the single methodology source), so this module only reads the contract and keeps
// the review marks.

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

/**
 * Sections whose text restates another section (2026-11-28 UX pass): when the student changes the research questions,
 * objectives or hypotheses, the framework table, the later objectives and the analysis plan may no longer match.
 */
export const SECTION_DEPENDENTS: Readonly<Record<string, readonly string[]>> = {
  '4.1': ['3.3', '4.2', '4.3', '4.4', '5.10'],
  '4.2': ['4.3'],
  '4.3': ['3.3', '5.10'],
  '4.4': ['3.3', '5.7', '5.10'],
}

/**
 * Marks every drafted section that depends on `changed` (see SECTION_DEPENDENTS) as possibly out of date, with the
 * changed section's label as the reason. Like propagateStale it merges, never touches text, and returns `previous`
 * itself when nothing new was added (so callers can skip the save).
 */
export function propagateSectionChange(
  previous: StaleMarks, changed: string, changedLabel: string, sections: readonly Pick<ProjectSection, 'code' | 'content' | 'status'>[],
): StaleMarks {
  const dependents = SECTION_DEPENDENTS[changed]
  if (!dependents) return previous
  const byCode = new Map(sections.map(s => [s.code, s]))
  let next = previous
  for (const code of dependents) {
    const s = byCode.get(code)
    if (!s || !hasText(s) || (previous[code] ?? []).includes(changedLabel)) continue
    if (next === previous) next = { ...previous }
    next[code] = [...(next[code] ?? []), changedLabel]
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
