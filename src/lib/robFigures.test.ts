import { describe, expect, it } from 'vitest'
import {
  buildRob2FigureData, buildRobinsIFigureData, fetchAllPages, hasAnyRating, layoutLegend, mapRob2Rating,
  mapRobinsIRating, robSwatch, roundedPercents, studyLabel, summariseRob, ROB_COLOURS,
} from './robFigures'
import { truncateText, wrapText, estimateTextWidth } from './svgText'
import type { RiskOfBiasRecord, RobinsIRecord } from '../types/systematicReview'

const base = {
  journal: '', doi: '', source: 'PubMed', typeBadge: '', citations: 0, abstract: '',
  fullTextStatus: 'PdfUploaded', useAbstractFallback: false,
} as const

function rob2(id: string, authors: string, date: string, ratings: RiskOfBiasRecord['ratings'][number]['rating'][], overall: RiskOfBiasRecord['overall']): RiskOfBiasRecord {
  const domains = ['RandomizationProcess', 'DeviationsFromIntendedInterventions', 'MissingOutcomeData', 'MeasurementOfTheOutcome', 'SelectionOfReportedResult'] as const
  return {
    ...base, paperId: id, title: `Trial ${id} of something long`, authors, publicationDate: date, overall,
    ratings: ratings.map((rating, i) => ({ id: `${id}-${i}`, domain: domains[i], rating, aiRationale: null, isManualOverride: false })),
  } as RiskOfBiasRecord
}

describe('colour and judgement mapping', () => {
  it('maps RoB 2 ratings onto the Cochrane levels', () => {
    expect(mapRob2Rating('Low')).toBe('low')
    expect(mapRob2Rating('SomeConcerns')).toBe('some')
    expect(mapRob2Rating('High')).toBe('high')
    expect(mapRob2Rating('Pending')).toBe('na')
  })

  it('maps ROBINS-I Moderate to yellow, Serious to red, Critical to dark red', () => {
    expect(robSwatch(mapRobinsIRating('Low'), 'cochrane').fill).toBe('#02C100')
    expect(robSwatch(mapRobinsIRating('Moderate'), 'cochrane').fill).toBe('#E2DF07')
    expect(robSwatch(mapRobinsIRating('Serious'), 'cochrane').fill).toBe('#BF0000')
    expect(robSwatch(mapRobinsIRating('Critical'), 'cochrane').fill).toBe('#820000')
    expect(robSwatch(mapRobinsIRating('NoInformation'), 'cochrane').fill).toBe('#4EA1F7')
    expect(robSwatch(mapRobinsIRating('Pending'), 'cochrane').fill).toBe('#cccccc')
  })

  it('uses the colour-blind palette, with a grey border on white "no information"', () => {
    expect(ROB_COLOURS.colourblind).toMatchObject({ low: '#fed98e', some: '#fe9929', high: '#d95f0e', critical: '#993404', noinfo: '#ffffff' })
    expect(robSwatch('noinfo', 'colourblind').stroke).toBe('#808080')
    expect(robSwatch('noinfo', 'cochrane').stroke).toBeNull()
  })

  it('gives each level a symbol and a contrasting symbol colour', () => {
    expect(robSwatch('low', 'cochrane').symbol).toBe('+')
    expect(robSwatch('high', 'cochrane').symbol).toBe('×')
    expect(robSwatch('critical', 'cochrane').symbol).toBe('!')
    expect(robSwatch('noinfo', 'cochrane').symbol).toBe('?')
    expect(robSwatch('high', 'cochrane').symbolFill).toBe('#ffffff')
    expect(robSwatch('some', 'cochrane').symbolFill).toBe('#1a1a1a')
    expect(robSwatch('low', 'colourblind').symbolFill).toBe('#1a1a1a')
  })
})

describe('figure data', () => {
  const records = [
    rob2('a', 'Smith J, Jones K', '2020-03-01', ['Low', 'Low', 'SomeConcerns', 'High', 'Low'], 'High'),
    rob2('b', 'Smith A', '2020', ['Low', 'SomeConcerns', 'Low', 'Low', 'Low'], 'SomeConcerns'),
    rob2('c', 'Lee', '2019-01-01', ['High', 'Low', 'Low', 'Low', 'Pending'], 'High'),
    rob2('d', 'Unrated', '2021', ['Pending', 'Pending', 'Pending', 'Pending', 'Pending'], 'Pending'),
  ]

  it('builds Author Year labels, disambiguates them and drops studies with no judgement', () => {
    const data = buildRob2FigureData(records)
    expect(data.domains.map(d => d.code)).toEqual(['D1', 'D2', 'D3', 'D4', 'D5'])
    expect(data.studies.map(s => s.label)).toEqual(['Smith 2020a', 'Smith 2020b', 'Lee 2019'])
    expect(data.studies[2].judgements[4]).toBe('na')
    expect(studyLabel('', '', 'Some title')).toBe('Some title')
    expect(hasAnyRating(records)).toBe(true)
    expect(hasAnyRating([records[3]])).toBe(false)
  })

  it('summarises per-domain proportions that sum to 1, plus an Overall row', () => {
    const rows = summariseRob(buildRob2FigureData(records))
    expect(rows.map(r => r.code)).toEqual(['D1', 'D2', 'D3', 'D4', 'D5', 'Overall'])
    const d1 = rows[0]
    expect(d1.total).toBe(3)
    expect(d1.segments).toEqual([
      { level: 'low', count: 2, proportion: 2 / 3 },
      { level: 'high', count: 1, proportion: 1 / 3 },
    ])
    const d5 = rows[4]
    expect(d5.segments.map(s => s.level)).toEqual(['low', 'na'])
    for (const r of rows) expect(r.segments.reduce((s, x) => s + x.proportion, 0)).toBeCloseTo(1)
    expect(rows[5].segments).toEqual([
      { level: 'some', count: 1, proportion: 1 / 3 },
      { level: 'high', count: 2, proportion: 2 / 3 },
    ])
  })

  it('rounds percentages so they still add to 100', () => {
    expect(roundedPercents([1 / 3, 1 / 3, 1 / 3])).toEqual([34, 33, 33])
    expect(roundedPercents([2 / 3, 1 / 3])).toEqual([67, 33])
  })

  it('builds ROBINS-I data over its 7 domains with tool labels', () => {
    const rec = {
      ...base, paperId: 'x', title: 'Cohort', authors: 'Garcia M', publicationDate: '2018', overall: 'Serious',
      ratings: [{ id: 'r', domain: 'ConfoundingBias', rating: 'Moderate', aiRationale: null, isManualOverride: false }],
    } as RobinsIRecord
    const data = buildRobinsIFigureData([rec])
    expect(data.domains).toHaveLength(7)
    expect(data.studies[0].judgements[0]).toBe('some')
    expect(data.studies[0].judgements[1]).toBe('na')
    expect(data.studies[0].overall).toBe('high')
    expect(data.levelLabels.some).toBe('Moderate')
    expect(data.levelLabels.high).toBe('Serious')
  })
})

describe('helpers', () => {
  it('walks every page', async () => {
    const pages = [[1, 2], [3, 4], [5]]
    const got = await fetchAllPages(async p => ({ items: pages[p - 1] ?? [], total: 5 }), 2)
    expect(got).toEqual([1, 2, 3, 4, 5])
  })

  it('wraps and truncates text to width', () => {
    const lines = wrapText('Bias due to deviations from intended interventions', 120, 11)
    expect(lines.length).toBeGreaterThan(1)
    for (const l of lines) expect(estimateTextWidth(l, 11)).toBeLessThanOrEqual(120)
    const t = truncateText('A very long study title that will not fit', 80, 11)
    expect(t.endsWith('…')).toBe(true)
    expect(estimateTextWidth(t, 11)).toBeLessThanOrEqual(80)
  })

  it('wraps legend entries within the width', () => {
    const { items, height } = layoutLegend(['low', 'some', 'high', 'critical', 'noinfo', 'na'],
      { low: 'Low', some: 'Moderate', high: 'Serious', critical: 'Critical', noinfo: 'No information', na: 'Not assessed' }, 0, 0, 200)
    expect(new Set(items.map(i => i.y)).size).toBeGreaterThan(1)
    expect(height).toBeGreaterThan(22)
  })
})
