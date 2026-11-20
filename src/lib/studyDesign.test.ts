import { describe, expect, it } from 'vitest'
import {
  CALCULATORS, asPercentHint, buildRequest, calculatorById, designLabel, emptyAdjustments, errorSummaryText, fieldErrors, projectOptionLabels, headline, inputRows, splitLines, toWire, whereLabel,
  type CalculationResult, type FormState,
} from './studyDesign'
import { LAUNCH_TOOLS, isToolEnabled } from '../config/features'
import { NAV_SECTIONS, TOOLS, resolvePageTitle, toolForPath } from '../config/navigation'

const form = (patch: Partial<FormState>): FormState =>
  ({ calculator: 'correlation_pearson', values: {}, basis: '', justification: '', adjustments: emptyAdjustments(), ...patch })

describe('toWire', () => {
  it('reads decimals written with a point or a comma', () => {
    expect(toWire('0.05')).toBe(0.05)
    expect(toWire('0,05')).toBe(0.05)
    expect(toWire(' 1 000 ')).toBe(1000)
    expect(toWire('.3')).toBe(0.3)
  })

  it('leaves blanks out and sends anything that is not a number as typed, for the server to reject', () => {
    expect(toWire('')).toBeUndefined()
    expect(toWire('   ')).toBeUndefined()
    expect(toWire('five')).toBe('five')
    expect(toWire('NaN')).toBe('NaN')
    expect(toWire('80%')).toBe('80%')
  })

  it('never divides a percentage by 100', () => {
    expect(toWire('80')).toBe(80)
  })
})

describe('buildRequest', () => {
  it('sends only what was typed: no defaults for alpha, power, tails or the effect size', () => {
    expect(buildRequest(form({}))).toEqual({ calculator: 'correlation_pearson', inputs: {} })
  })

  it('builds the Gauteng correlation request with non-response and a subgroup requirement', () => {
    const request = buildRequest(form({
      values: { effectSizeR: '0,3', alpha: '0.05', power: '0.8', tails: '2' },
      basis: 'benchmark', justification: '  No comparable estimate found.  ',
      adjustments: { ...emptyAdjustments(), nonResponseRate: '0.2', nPerSubgroup: '30', subgroups: [{ name: 'Masters', share: '0.7' }, { name: 'Doctoral', share: '0.3' }] },
    }))
    expect(request).toEqual({
      calculator: 'correlation_pearson',
      inputs: {
        effectSizeR: 0.3, alpha: 0.05, power: 0.8, tails: 2, effectSizeBasis: 'benchmark', effectSizeJustification: 'No comparable estimate found.',
        adjustments: { nonResponseRate: 0.2, subgroupRequirement: { nPerSubgroup: 30, shares: { Masters: 0.7, Doctoral: 0.3 } } },
      },
    })
  })

  it('does not send effect-size fields for calculators that have none', () => {
    const request = buildRequest(form({ calculator: 'yamane', values: { populationSize: '1000', marginOfError: '0.05', effectSizeR: '0.3' }, basis: 'benchmark', justification: 'x' }))
    expect(request.inputs).toEqual({ populationSize: 1000, marginOfError: 0.05 })
  })

  it('drops a blank subgroup row, names an unnamed one, and sends a blank share for the server to reject', () => {
    const request = buildRequest(form({ adjustments: { ...emptyAdjustments(), nPerSubgroup: '30', subgroups: [{ name: '', share: '' }, { name: '', share: '0.4' }, { name: 'Doctoral', share: '' }] } }))
    expect(request.inputs.adjustments).toEqual({ subgroupRequirement: { nPerSubgroup: 30, shares: { 'Subgroup 1': 0.4, Doctoral: '' } } })
  })
})

describe('fieldErrors', () => {
  it('maps server fields, including nested adjustment paths, onto form fields and keeps the first message', () => {
    expect(fieldErrors([
      { field: 'power', code: 'POWER_OUT_OF_RANGE', message: 'Enter power between 0.50 and 0.999, for example 0.80, not 80.' },
      { field: 'power', code: 'X', message: 'second' },
      { field: 'adjustments.nonResponseRate', code: 'RATE_OUT_OF_RANGE', message: 'rate' },
      { field: 'adjustments.subgroupRequirement.shares', code: 'SUBGROUP_SHARES_MUST_SUM_TO_ONE', message: 'sum' },
      { field: 'adjustments.subgroupRequirement.nPerSubgroup', code: 'VALUE_REQUIRED', message: 'required' },
    ])).toEqual({ power: 'Enter power between 0.50 and 0.999, for example 0.80, not 80.', nonResponseRate: 'rate', subgroups: 'sum', nPerSubgroup: 'required' })
    expect(fieldErrors(undefined)).toEqual({})
  })
})

describe('errorSummaryText', () => {
  const chi = calculatorById('chi_square')!
  it('names the field when the server only says the value is required', () => {
    expect(errorSummaryText(chi, 'df', 'This value is required.')).toBe('Degrees of freedom: This value is required.')
    expect(errorSummaryText(chi, 'effectSizeW', 'This value is required.')).toBe('Expected effect size (w): This value is required.')
    expect(errorSummaryText(chi, 'nPerSubgroup', 'required')).toBe('Minimum completed responses per subgroup: This value is required.')
  })
  it('leaves specific messages alone', () => {
    const msg = 'Enter a significance level between 0.001 and 0.20, for example 0.05.'
    expect(errorSummaryText(chi, 'alpha', msg)).toBe(msg)
  })
  it('leaves a required message alone when the field has no known label', () => {
    expect(errorSummaryText(chi, 'mystery', 'This value is required.')).toBe('This value is required.')
  })
})

describe('projectOptionLabels', () => {
  it('leaves unique titles as they are', () => {
    const l = projectOptionLabels([{ id: 'a1', title: 'One', updatedAt: '2026-11-01T10:00:00Z' }, { id: 'b2', title: 'Two' }])
    expect(l.get('a1')).toBe('One')
    expect(l.get('b2')).toBe('Two')
  })
  it('tells apart projects that share a title by their last-updated date', () => {
    const l = projectOptionLabels([{ id: 'a1', title: 'Same', updatedAt: '2026-11-01T10:00:00Z' }, { id: 'b2', title: 'Same', updatedAt: '2026-11-05T08:00:00Z' }])
    expect(l.get('a1')).toBe('Same (updated 2026-11-01)')
    expect(l.get('b2')).toBe('Same (updated 2026-11-05)')
  })
  it('adds a short id only when the date does not separate them', () => {
    const l = projectOptionLabels([{ id: 'aaaa1111', title: 'Same', updatedAt: '2026-11-01T10:00:00Z' }, { id: 'bbbb2222', title: 'Same', updatedAt: '2026-11-01T18:00:00Z' }, { id: 'cccc3333', title: 'Same' }])
    expect(l.get('aaaa1111')).toBe('Same (updated 2026-11-01) #1111')
    expect(l.get('bbbb2222')).toBe('Same (updated 2026-11-01) #2222')
    expect(l.get('cccc3333')).toBe('Same') // already distinct from the dated ones
    expect(new Set(l.values()).size).toBe(3)
  })
})

describe('result display', () => {
  const result = (calculator: CalculationResult['calculator'], values: Record<string, unknown>): CalculationResult =>
    ({ calculator, formulaVersion: 'sd-calc.v1', formulaName: 'x', inputs: {}, result: values, steps: [], assumptions: [], warnings: [], crossChecks: [] })

  it('reads the headline from the result and says what the number counts', () => {
    expect(headline(result('correlation_pearson', { n: 84 }))).toEqual({ value: '84', unit: 'completed responses' })
    expect(headline(result('ttest_independent', { nPerGroup: 64, nTotal: 128 }))).toEqual({ value: '64', unit: 'participants per group', detail: '128 in total' })
    expect(headline(result('ttest_paired', { nPairs: 34 })).unit).toBe('pairs of observations')
    expect(headline(result('regression_r2', { nTotal: 92 })).value).toBe('92')
  })

  it('shows a dash, never a made-up number, when the result has no figure', () => {
    expect(headline(result('correlation_pearson', {})).value).toBe('—')
  })

  it('lists only the inputs it can label', () => {
    const r = { ...result('correlation_pearson', { n: 84 }), inputs: { effectSizeR: 0.3, alpha: 0.05, effectSizeBasis: 'benchmark', somethingNew: 7, 'adjustments.nonResponseRate': 0.2 } }
    expect(inputRows(r)).toEqual([
      { label: 'Expected correlation (r)', value: '0.3' },
      { label: 'Significance level (α)', value: '0.05' },
      { label: 'Effect size based on', value: 'Conventional benchmark (no estimate available)' },
      { label: 'Non-response rate', value: '0.2' },
    ])
  })

  it('shows a decimal as a percentage only when it is a plain fraction', () => {
    expect(asPercentHint('0.2')).toBe('= 20%')
    expect(asPercentHint('0,125')).toBe('= 12.5%')
    expect(asPercentHint('20')).toBeNull()
    expect(asPercentHint('')).toBeNull()
  })
})

describe('calculator definitions', () => {
  it('give every power calculator an effect size with three benchmarks, and the others none', () => {
    for (const c of CALCULATORS) {
      if (c.group === 'test') expect(c.effect?.benchmarks.map(b => b.label)).toEqual(['Small', 'Medium', 'Large'])
      else expect(c.effect).toBeUndefined()
    }
  })

  it('keeps Yamane out of the default groups', () => {
    expect(CALCULATORS.find(c => c.id === 'yamane')?.group).toBe('ruleOfThumb')
    expect(CALCULATORS[0].id).toBe('correlation_pearson')
  })
})

describe('Study Design in the navigation', () => {
  it('is one entry in the Analyze group, before Data Analyst, and hidden at launch', () => {
    expect(NAV_SECTIONS.find(s => s.section === 'Analyse')?.items.map(t => t.id)).toEqual(['study-design', 'qualitative-analysis', 'data-analyst'])
    expect(NAV_SECTIONS.flatMap(s => s.items).filter(t => t.id === 'study-design')).toHaveLength(1)
    expect(LAUNCH_TOOLS.has('study-design')).toBe(false)
    expect(isToolEnabled('study-design')).toBe(import.meta.env.VITE_ENABLE_ALL_TOOLS === 'true')
    expect(isToolEnabled('study-design', true)).toBe(true)
  })

  it('resolves its own route and is not captured by the proposal-studio prefix', () => {
    expect(toolForPath('/app/study-design')?.id).toBe('study-design')
    expect(resolvePageTitle('/app/study-design')).toBe('Study Design')
    expect(toolForPath('/app/research-agent/abc')?.id).toBe('proposal-studio')
    expect(TOOLS['study-design'].link).toBe('/app/study-design')
  })
})

describe('design advisor helpers', () => {
  it('splits pasted lists into items and drops list markers, without touching the wording', () => {
    expect(splitLines('1. What is the relationship between A and B?\n\n  RQ2: Why do students avoid AI tools?\n- To determine the effect of A on B.\n(3) Third item'))
      .toEqual(['What is the relationship between A and B?', 'Why do students avoid AI tools?', 'To determine the effect of A on B.', 'Third item'])
    expect(splitLines('   \n\n')).toEqual([])
    expect(splitLines('2024 cohort students differ by campus')).toEqual(['2024 cohort students differ by campus'])
  })

  it('labels designs and locations for display', () => {
    expect(designLabel('CrossSectionalSurvey')).toBe('Cross-sectional survey')
    expect(designLabel('QuasiExperimental')).toBe('Quasi-experimental')
    expect(designLabel('GroundedTheory')).toBe('Grounded theory')
    expect(designLabel('Correlational')).toBe('Correlational')
    expect(whereLabel('objective 2')).toBe('Objective 2')
    expect(whereLabel('resources')).toBe('Your resources')
  })
})
