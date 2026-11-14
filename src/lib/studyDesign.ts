// Pure logic for the Study Design sample-size tab. No number is computed here: every figure shown comes from the
// server's calculation result. This file only describes the forms, turns what was typed into a request, and maps
// the server's typed errors back onto fields.

export type CalculatorId =
  | 'correlation_pearson' | 'ttest_independent' | 'ttest_paired' | 'anova_oneway' | 'regression_r2' | 'chi_square'
  | 'proportion_cochran' | 'yamane'

export type EffectBasis = 'literature' | 'pilot' | 'smallestEffectOfInterest' | 'benchmark'

export interface FieldDef {
  key: string
  label: string
  help: string
  /** A whole-number field. Everything else is a decimal. */
  whole?: boolean
  placeholder?: string
  options?: { value: string; label: string }[]
  optional?: boolean
  /** Decimal fraction that students usually think of as a percentage; the form shows the percentage beside it. */
  fraction?: boolean
}

export interface EffectDef {
  key: string
  symbol: string
  name: string
  help: string
  benchmarks: { label: 'Small' | 'Medium' | 'Large'; value: number }[]
}

export interface CalculatorDef {
  id: CalculatorId
  group: 'test' | 'estimate' | 'ruleOfThumb'
  label: string
  useWhen: string
  effect?: EffectDef
  fields: FieldDef[]
}

const alpha: FieldDef = { key: 'alpha', label: 'Significance level (α)', help: 'The chance of a false positive you will accept. 0.05 is common.', placeholder: '0.05', fraction: true }
const power: FieldDef = { key: 'power', label: 'Power', help: 'The chance of detecting the effect if it exists. Enter 0.80 for 80%.', placeholder: '0.80', fraction: true }
const tails: FieldDef = {
  key: 'tails', label: 'Direction of the test', help: 'Two-tailed unless your hypothesis states a direction and you registered it in advance.',
  options: [{ value: '2', label: 'Two-tailed (no direction assumed)' }, { value: '1', label: 'One-tailed (direction stated in advance)' }],
}
const margin: FieldDef = { key: 'marginOfError', label: 'Margin of error', help: 'How far the estimate may be from the true value. Enter 0.05 for ±5 percentage points.', placeholder: '0.05', fraction: true }
const population: FieldDef = { key: 'populationSize', label: 'Population size', help: 'The number of people in the group you are sampling from.', whole: true, placeholder: '1000' }

const conventions = (small: number, medium: number, large: number): EffectDef['benchmarks'] =>
  [{ label: 'Small', value: small }, { label: 'Medium', value: medium }, { label: 'Large', value: large }]

export const CALCULATORS: CalculatorDef[] = [
  {
    id: 'correlation_pearson', group: 'test', label: 'Relationship between two measures', useWhen: 'You will test a Pearson correlation between two numeric variables.',
    effect: { key: 'effectSizeR', symbol: 'r', name: 'Expected correlation', help: 'The size of correlation you expect, between 0.01 and 0.99.', benchmarks: conventions(0.1, 0.3, 0.5) },
    fields: [alpha, power, tails],
  },
  {
    id: 'ttest_independent', group: 'test', label: 'Difference between two groups', useWhen: 'You will compare the means of two separate groups with a t-test.',
    effect: { key: 'effectSizeD', symbol: 'd', name: 'Expected standardised difference', help: 'The difference between the group means divided by the standard deviation.', benchmarks: conventions(0.2, 0.5, 0.8) },
    fields: [alpha, power, tails],
  },
  {
    id: 'ttest_paired', group: 'test', label: 'Before and after, or matched pairs', useWhen: 'The same people are measured twice, or participants are matched in pairs.',
    effect: { key: 'effectSizeDz', symbol: 'dz', name: 'Expected standardised difference', help: 'The mean change divided by the standard deviation of the changes.', benchmarks: conventions(0.2, 0.5, 0.8) },
    fields: [alpha, power, tails],
  },
  {
    id: 'anova_oneway', group: 'test', label: 'Difference among three or more groups', useWhen: 'You will compare the means of several groups with a one-way ANOVA.',
    effect: { key: 'effectSizeF', symbol: 'f', name: 'Expected effect size', help: "Cohen's f, between 0.01 and 2.", benchmarks: conventions(0.1, 0.25, 0.4) },
    fields: [{ key: 'groups', label: 'Number of groups', help: 'From 2 to 20.', whole: true, placeholder: '3' }, alpha, power],
  },
  {
    id: 'regression_r2', group: 'test', label: 'Several predictors of one outcome', useWhen: 'You will fit a multiple regression and test whether the model explains any variance.',
    effect: { key: 'effectSizeF2', symbol: 'f²', name: 'Expected effect size', help: "Cohen's f², which is R² ÷ (1 − R²).", benchmarks: conventions(0.02, 0.15, 0.35) },
    fields: [{ key: 'predictors', label: 'Number of predictors', help: 'From 1 to 50.', whole: true, placeholder: '5' }, alpha, power],
  },
  {
    id: 'chi_square', group: 'test', label: 'Association between categories', useWhen: 'You will run a chi-square test on counts in categories.',
    effect: { key: 'effectSizeW', symbol: 'w', name: 'Expected effect size', help: "Cohen's w, between 0.01 and 2.", benchmarks: conventions(0.1, 0.3, 0.5) },
    fields: [{ key: 'df', label: 'Degrees of freedom', help: '(rows − 1) × (columns − 1). A 2 × 2 table has 1.', whole: true, placeholder: '1' }, alpha, power],
  },
  {
    id: 'proportion_cochran', group: 'estimate', label: 'Estimate a percentage', useWhen: 'Your aim is descriptive: what share of a population holds a view or has a characteristic.',
    fields: [
      { key: 'confidence', label: 'Confidence level', help: 'Enter 0.95 for 95%.', placeholder: '0.95', fraction: true },
      { key: 'proportion', label: 'Expected proportion', help: 'Your best guess of the share. Use 0.5 if you have no estimate; it gives the largest sample.', placeholder: '0.5', fraction: true },
      margin,
      { ...population, optional: true, help: 'Optional. If you give it, the finite population correction is applied.' },
    ],
  },
  {
    id: 'yamane', group: 'ruleOfThumb', label: "Yamane's formula", useWhen: 'Only if your department asks for it. It is a rough rule of thumb.',
    fields: [population, margin],
  },
]

export const GROUP_LABELS: Record<CalculatorDef['group'], string> = {
  test: 'Test a hypothesis',
  estimate: 'Describe a population',
  ruleOfThumb: 'Rules of thumb',
}

export const BASIS_OPTIONS: { value: EffectBasis; label: string; prompt: string }[] = [
  { value: 'literature', label: 'Previous studies', prompt: 'Which studies, and what did they find? Give the citation and the reported value.' },
  { value: 'pilot', label: 'My pilot data', prompt: 'What did the pilot show? Give the sample size and the estimate.' },
  { value: 'smallestEffectOfInterest', label: 'Smallest effect that would matter', prompt: 'Why would a smaller effect not matter for this study?' },
  { value: 'benchmark', label: 'Conventional benchmark (no estimate available)', prompt: 'Say that no estimate was found and where you looked. The result will be marked as based on a convention.' },
]

export const calculatorById = (id: string): CalculatorDef | undefined => CALCULATORS.find(c => c.id === id)

export interface AdjustmentValues {
  nonResponseRate: string
  unusableRate: string
  clusterSize: string
  icc: string
  accessiblePopulation: string
  nPerSubgroup: string
  subgroups: { name: string; share: string }[]
}

export const emptyAdjustments = (): AdjustmentValues =>
  ({ nonResponseRate: '', unusableRate: '', clusterSize: '', icc: '', accessiblePopulation: '', nPerSubgroup: '', subgroups: [] })

/**
 * A typed value as the server should see it. A comma decimal ("0,05", usual in South Africa) is read as a decimal
 * point. Anything that is not a number is sent as typed, so the server answers with its own typed error for that
 * field instead of this file guessing.
 */
export function toWire(raw: string): number | string | undefined {
  const text = raw.trim()
  if (text === '') return undefined
  const normalised = text.replace(/\s/g, '').replace(',', '.')
  return /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(normalised) ? Number(normalised) : text
}

export interface FormState {
  calculator: CalculatorId
  values: Record<string, string>
  basis: EffectBasis | ''
  justification: string
  adjustments: AdjustmentValues
}

export interface CalculateRequest {
  calculator: CalculatorId
  inputs: Record<string, unknown>
  label?: string
  makePrimary?: boolean
}

export function buildRequest(form: FormState): CalculateRequest {
  const def = calculatorById(form.calculator)!
  const inputs: Record<string, unknown> = {}
  for (const field of def.fields) {
    const value = toWire(form.values[field.key] ?? '')
    if (value !== undefined) inputs[field.key] = value
  }
  if (def.effect) {
    const effect = toWire(form.values[def.effect.key] ?? '')
    if (effect !== undefined) inputs[def.effect.key] = effect
    if (form.basis) inputs.effectSizeBasis = form.basis
    if (form.justification.trim()) inputs.effectSizeJustification = form.justification.trim()
  }
  const a = form.adjustments
  const adjustments: Record<string, unknown> = {}
  for (const key of ['nonResponseRate', 'unusableRate', 'clusterSize', 'icc', 'accessiblePopulation'] as const) {
    const value = toWire(a[key])
    if (value !== undefined) adjustments[key] = value
  }
  const rows = a.subgroups.filter(s => s.name.trim() !== '' || s.share.trim() !== '')
  if (rows.length > 0 || a.nPerSubgroup.trim() !== '') {
    const shares: Record<string, unknown> = {}
    rows.forEach((s, i) => { shares[s.name.trim() || `Subgroup ${i + 1}`] = toWire(s.share) ?? '' })
    adjustments.subgroupRequirement = { nPerSubgroup: toWire(a.nPerSubgroup), shares }
  }
  if (Object.keys(adjustments).length > 0) inputs.adjustments = adjustments
  return { calculator: form.calculator, inputs }
}

export interface ApiFieldError { field: string; code: string; message: string }

/** The first message per field, keyed the way the form names its inputs. */
export function fieldErrors(details: ApiFieldError[] | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const d of details ?? []) {
    const key = d.field.replace(/^adjustments\./, '').replace(/^subgroupRequirement\.shares$/, 'subgroups').replace(/^subgroupRequirement\.nPerSubgroup$/, 'nPerSubgroup').replace(/^subgroupRequirement$/, 'subgroups')
    if (!(key in out)) out[key] = d.message
  }
  return out
}

export interface CalculationNote { code: string; text: string }
export interface AdjustmentResult {
  nRequired: number
  designEffect: number
  nAfterDesignEffect: number
  subgroupRows: { subgroup: string; share: number; nTotalNeeded: number }[]
  nCompletedAfterSubgroups: number
  bindingConstraint: 'overall' | 'subgroup'
  nonResponseRate: number
  unusableRate: number
  nToInvite: number
  groups?: number | null
  nToInvitePerGroup?: number | null
}
export interface CalculationResult {
  calculator: CalculatorId | 'adjustments'
  formulaVersion: string
  formulaName: string
  inputs: Record<string, unknown>
  result: Record<string, unknown>
  steps: { label: string; value: string }[]
  assumptions: CalculationNote[]
  warnings: CalculationNote[]
  crossChecks: { method: string; n: number; note: string }[]
  adjustments?: AdjustmentResult | null
  effectSizeBasis?: EffectBasis | null
  effectSizeJustification?: string | null
}

const whole = (value: unknown): string => typeof value === 'number' ? value.toLocaleString('en-ZA').replace(/,/g, ' ') : '—'

/** The headline of a result: the number a student needs and what it counts. Read from the result, never computed. */
export function headline(r: CalculationResult): { value: string; unit: string; detail?: string } {
  const x = r.result
  switch (r.calculator) {
    case 'ttest_independent': return { value: whole(x.nPerGroup), unit: 'participants per group', detail: `${whole(x.nTotal)} in total` }
    case 'anova_oneway': return { value: whole(x.nPerGroup), unit: 'participants per group', detail: `${whole(x.nTotal)} in total` }
    case 'ttest_paired': return { value: whole(x.nPairs), unit: 'pairs of observations' }
    case 'regression_r2':
    case 'chi_square': return { value: whole(x.nTotal), unit: 'participants in total' }
    default: return { value: whole(x.n), unit: 'completed responses' }
  }
}

export const percent = (fraction: number): string => `${Math.round(fraction * 1000) / 10}%`

/** "= 20%" beside a decimal field, or nothing when the value is not a plain fraction. */
export function asPercentHint(raw: string): string | null {
  const value = toWire(raw)
  return typeof value === 'number' && value > 0 && value < 1 ? `= ${percent(value)}` : null
}

export const INPUT_LABELS: Record<string, string> = {
  effectSizeR: 'Expected correlation (r)', effectSizeD: 'Standardised difference (d)', effectSizeDz: 'Standardised difference (dz)',
  effectSizeF: 'Effect size (f)', effectSizeF2: 'Effect size (f²)', effectSizeW: 'Effect size (w)',
  alpha: 'Significance level (α)', power: 'Power', tails: 'Tails', groups: 'Groups', predictors: 'Predictors', df: 'Degrees of freedom',
  confidence: 'Confidence level', proportion: 'Expected proportion', marginOfError: 'Margin of error', populationSize: 'Population size',
  effectSizeBasis: 'Effect size based on',
  'adjustments.nonResponseRate': 'Non-response rate', 'adjustments.unusableRate': 'Unusable responses', 'adjustments.clusterSize': 'Average cluster size',
  'adjustments.icc': 'Intraclass correlation', 'adjustments.accessiblePopulation': 'People you can reach',
  'adjustments.subgroupRequirement.nPerSubgroup': 'Minimum per subgroup',
}

const BASIS_LABEL: Record<string, string> = Object.fromEntries(BASIS_OPTIONS.map(b => [b.value, b.label]))

/** The inputs the calculation used, as rows for display. Unknown keys are skipped, not guessed at. */
export function inputRows(r: CalculationResult): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = []
  for (const [key, value] of Object.entries(r.inputs)) {
    const label = INPUT_LABELS[key]
    if (!label) continue
    if (key === 'effectSizeBasis') rows.push({ label, value: BASIS_LABEL[String(value)] ?? String(value) })
    else if (typeof value === 'number') rows.push({ label, value: String(value) })
  }
  return rows
}

// ---- Design advisor ---------------------------------------------------------------------------------------------

/** One item per non-blank line. A leading "1.", "RQ2:" or bullet is dropped so pasted lists come out clean. */
export function splitLines(text: string): string[] {
  return text.split(/\r?\n/)
    .map(line => line.replace(/^\s*(?:[-*•]|\(?\d{1,2}[.):]|(?:RQ|O|H)\s*\d{1,2}\s*[.):])\s*/i, '').trim())
    .filter(line => line.length > 0)
}

/** "CrossSectionalSurvey" -> "Cross-sectional survey". Display only; the value sent to the server is unchanged. */
export function designLabel(design: string): string {
  const special: Record<string, string> = { CrossSectionalSurvey: 'Cross-sectional survey', QuasiExperimental: 'Quasi-experimental' }
  if (special[design]) return special[design]
  const words = design.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** "objective 2" -> "Objective 2"; "resources" -> "Your resources". */
export function whereLabel(where: string): string {
  return where === 'resources' ? 'Your resources' : where.charAt(0).toUpperCase() + where.slice(1)
}
