import type {
  RiskOfBiasDomain, RiskOfBiasRating, RiskOfBiasRecord,
  RiskOfBiasDomainRobinsI, RobinsIRatingValue, RobinsIRecord,
} from '../types/systematicReview'

// Risk-of-bias figures in the style of robvis (McGuinness & Higgins, MIT-licensed R package):
// a traffic-light plot (study x domain) and a summary bar plot (per-domain proportions).
// This module holds the pure parts: judgement mapping, colours, symbols and proportions.

/** A tool-neutral judgement level, which fixes the colour. Labels stay tool-specific. */
export type RobLevel = 'low' | 'some' | 'high' | 'critical' | 'noinfo' | 'na'

export type RobColourScheme = 'cochrane' | 'colourblind'

export const ROB_LEVEL_ORDER: RobLevel[] = ['low', 'some', 'high', 'critical', 'noinfo', 'na']

export const ROB_COLOURS: Record<RobColourScheme, Record<RobLevel, string>> = {
  cochrane: {
    low: '#02C100', some: '#E2DF07', high: '#BF0000', critical: '#820000', noinfo: '#4EA1F7', na: '#cccccc',
  },
  colourblind: {
    low: '#fed98e', some: '#fe9929', high: '#d95f0e', critical: '#993404', noinfo: '#ffffff', na: '#cccccc',
  },
}

export const ROB_SYMBOLS: Record<RobLevel, string> = {
  low: '+', some: '−', high: '×', critical: '!', noinfo: '?', na: '',
}

export interface RobSwatch {
  fill:       string
  stroke:     string | null
  symbol:     string
  symbolFill: string
}

function luminance(hex: string): number {
  const v = hex.replace('#', '')
  const full = v.length === 3 ? v.split('').map(c => c + c).join('') : v
  const [r, g, b] = [0, 2, 4].map(i => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Fill, border and a symbol colour with enough contrast for the fill. */
export function robSwatch(level: RobLevel, scheme: RobColourScheme): RobSwatch {
  const fill = ROB_COLOURS[scheme][level]
  // White "no information" in the colour-blind scheme would vanish without a border.
  const stroke = scheme === 'colourblind' && level === 'noinfo' ? '#808080' : null
  const symbolFill = luminance(fill) > 0.4 ? '#1a1a1a' : '#ffffff'
  return { fill, stroke, symbol: ROB_SYMBOLS[level], symbolFill }
}

// ── Tool mappings ────────────────────────────────────────────────────────────

export function mapRob2Rating(rating: RiskOfBiasRating): RobLevel {
  switch (rating) {
    case 'Low':          return 'low'
    case 'SomeConcerns': return 'some'
    case 'High':         return 'high'
    default:             return 'na'
  }
}

/** ROBINS-I on the RoB colour scale: Moderate is yellow, Serious red, Critical dark red. */
export function mapRobinsIRating(rating: RobinsIRatingValue): RobLevel {
  switch (rating) {
    case 'Low':           return 'low'
    case 'Moderate':      return 'some'
    case 'Serious':       return 'high'
    case 'Critical':      return 'critical'
    case 'NoInformation': return 'noinfo'
    default:              return 'na'
  }
}

export const ROB2_DOMAINS: { domain: RiskOfBiasDomain; label: string }[] = [
  { domain: 'RandomizationProcess',                label: 'Bias arising from the randomization process' },
  { domain: 'DeviationsFromIntendedInterventions', label: 'Bias due to deviations from intended interventions' },
  { domain: 'MissingOutcomeData',                  label: 'Bias due to missing outcome data' },
  { domain: 'MeasurementOfTheOutcome',             label: 'Bias in measurement of the outcome' },
  { domain: 'SelectionOfReportedResult',           label: 'Bias in selection of the reported result' },
]

export const ROBINS_I_DOMAINS: { domain: RiskOfBiasDomainRobinsI; label: string }[] = [
  { domain: 'ConfoundingBias',                     label: 'Bias due to confounding' },
  { domain: 'SelectionOfParticipants',             label: 'Bias due to selection of participants' },
  { domain: 'ClassificationOfInterventions',       label: 'Bias in classification of interventions' },
  { domain: 'DeviationsFromIntendedInterventions', label: 'Bias due to deviations from intended interventions' },
  { domain: 'MissingData',                         label: 'Bias due to missing data' },
  { domain: 'MeasurementOfOutcomes',               label: 'Bias in measurement of outcomes' },
  { domain: 'SelectionOfReportedResult',           label: 'Bias in selection of the reported result' },
]

export const ROB2_LEVEL_LABELS: Partial<Record<RobLevel, string>> = {
  low: 'Low', some: 'Some concerns', high: 'High', na: 'Not assessed',
}

export const ROBINS_I_LEVEL_LABELS: Partial<Record<RobLevel, string>> = {
  low: 'Low', some: 'Moderate', high: 'Serious', critical: 'Critical', noinfo: 'No information', na: 'Not assessed',
}

// ── Figure data ──────────────────────────────────────────────────────────────

export interface RobFigureDomain {
  code:  string   // "D1"
  label: string
}

export interface RobFigureStudy {
  id:         string
  label:      string   // "Smith 2020"
  fullTitle:  string
  judgements: RobLevel[]   // aligned with RobFigureData.domains
  overall:    RobLevel
}

export interface RobFigureData {
  toolName:    string
  domains:     RobFigureDomain[]
  studies:     RobFigureStudy[]
  levelLabels: Partial<Record<RobLevel, string>>
}

/** "Author Year" in the robvis style, from the record's author string and date. */
export function studyLabel(authors: string, publicationDate: string, title: string): string {
  const first = (authors ?? '').split(/[;,]| and /)[0]?.trim() ?? ''
  // "Smith J" / "J. Smith" / "John Smith": take the longest alphabetic token as the surname.
  const tokens = first.split(/\s+/).map(t => t.replace(/[^\p{L}'-]/gu, '')).filter(t => t.length > 1)
  const surname = tokens.sort((a, b) => b.length - a.length)[0] ?? ''
  const year = (publicationDate ?? '').match(/\b(1[89]\d{2}|20\d{2})\b/)?.[1] ?? ''
  if (surname && year) return `${surname} ${year}`
  if (surname) return surname
  return title.trim() || 'Untitled study'
}

interface GenericRecord<D extends string, R extends string> {
  paperId:         string
  title:           string
  authors:         string
  publicationDate: string
  overall:         R
  ratings:         { domain: D; rating: R }[]
}

function buildFigure<D extends string, R extends string>(
  records: GenericRecord<D, R>[],
  domains: { domain: D; label: string }[],
  map: (r: R) => RobLevel,
  toolName: string,
  levelLabels: Partial<Record<RobLevel, string>>,
): RobFigureData {
  const studies: RobFigureStudy[] = []
  for (const r of records) {
    const judgements = domains.map(d => {
      const rating = r.ratings.find(x => x.domain === d.domain)
      return rating ? map(rating.rating) : 'na'
    })
    const overall = map(r.overall)
    // A study with no judgement anywhere has nothing to plot.
    if (overall === 'na' && judgements.every(j => j === 'na')) continue
    studies.push({ id: r.paperId, label: studyLabel(r.authors, r.publicationDate, r.title), fullTitle: r.title, judgements, overall })
  }
  disambiguateLabels(studies)
  return {
    toolName,
    domains: domains.map((d, i) => ({ code: `D${i + 1}`, label: d.label })),
    studies,
    levelLabels,
  }
}

/** Two "Smith 2020" rows become "Smith 2020a" / "Smith 2020b", as reference lists do. */
function disambiguateLabels(studies: RobFigureStudy[]): void {
  const groups = new Map<string, RobFigureStudy[]>()
  for (const s of studies) groups.set(s.label, [...(groups.get(s.label) ?? []), s])
  for (const group of groups.values()) {
    if (group.length < 2) continue
    group.forEach((s, i) => { s.label = `${s.label}${String.fromCharCode(97 + (i % 26))}` })
  }
}

export function buildRob2FigureData(records: RiskOfBiasRecord[]): RobFigureData {
  return buildFigure(records, ROB2_DOMAINS, mapRob2Rating, 'RoB 2', ROB2_LEVEL_LABELS)
}

export function buildRobinsIFigureData(records: RobinsIRecord[]): RobFigureData {
  return buildFigure(records, ROBINS_I_DOMAINS, mapRobinsIRating, 'ROBINS-I', ROBINS_I_LEVEL_LABELS)
}

/** True when at least one record has any non-pending judgement. */
export function hasAnyRating(records: { overall: string; ratings: { rating: string }[] }[]): boolean {
  return records.some(r => r.overall !== 'Pending' || r.ratings.some(x => x.rating !== 'Pending'))
}

// ── Summary proportions ──────────────────────────────────────────────────────

export interface RobSummarySegment {
  level:      RobLevel
  count:      number
  proportion: number
}

export interface RobSummaryRow {
  code:     string
  label:    string
  total:    number
  segments: RobSummarySegment[]   // ROB_LEVEL_ORDER order, zero-count levels omitted
}

/**
 * Per-domain (then Overall) proportion of studies at each judgement. Every study counts equally:
 * robvis can weight by meta-analysis weights, but the review has no per-study weight, so this is
 * the unweighted summary. Proportions in a row sum to 1.
 */
export function summariseRob(data: RobFigureData): RobSummaryRow[] {
  const row = (code: string, label: string, levels: RobLevel[]): RobSummaryRow => {
    const total = levels.length
    const segments = ROB_LEVEL_ORDER
      .map(level => {
        const count = levels.filter(l => l === level).length
        return { level, count, proportion: total === 0 ? 0 : count / total }
      })
      .filter(s => s.count > 0)
    return { code, label, total, segments }
  }
  return [
    ...data.domains.map((d, i) => row(d.code, d.label, data.studies.map(s => s.judgements[i]))),
    row('Overall', 'Overall risk of bias', data.studies.map(s => s.overall)),
  ]
}

/** Levels that actually occur in the figure, in legend order. */
export function levelsPresent(data: RobFigureData): RobLevel[] {
  const seen = new Set<RobLevel>()
  for (const s of data.studies) { s.judgements.forEach(j => seen.add(j)); seen.add(s.overall) }
  return ROB_LEVEL_ORDER.filter(l => seen.has(l))
}

/** Rounds proportions to whole percentages that still sum to 100 (largest-remainder method). */
export function roundedPercents(proportions: number[]): number[] {
  const raw = proportions.map(p => p * 100)
  const floors = raw.map(Math.floor)
  let remainder = Math.round(raw.reduce((a, b) => a + b, 0)) - floors.reduce((a, b) => a + b, 0)
  const order = raw.map((v, i) => ({ i, frac: v - Math.floor(v) })).sort((a, b) => b.frac - a.frac)
  for (const { i } of order) {
    if (remainder <= 0) break
    floors[i] += 1
    remainder -= 1
  }
  return floors
}

// ── Loading every page ───────────────────────────────────────────────────────

/** The RoB endpoints page at most 100 rows, so a figure over every study walks the pages. */
export async function fetchAllPages<T>(
  fetchPage: (page: number, pageSize: number) => Promise<{ items: T[]; total: number }>,
  pageSize = 100,
  maxPages = 50,
): Promise<T[]> {
  const all: T[] = []
  for (let page = 1; page <= maxPages; page++) {
    const res = await fetchPage(page, pageSize)
    all.push(...res.items)
    if (res.items.length === 0 || all.length >= res.total) break
  }
  return all
}

// ── Legend layout ────────────────────────────────────────────────────────────

export interface RobLegendItem {
  level: RobLevel
  label: string
  x:     number   // swatch centre
  y:     number   // row centre
}

/** Flows legend entries left to right, wrapping onto new rows within `width`. */
export function layoutLegend(
  levels: RobLevel[],
  labels: Partial<Record<RobLevel, string>>,
  x0: number,
  y0: number,
  width: number,
  fontSize = 11,
): { items: RobLegendItem[]; height: number } {
  const swatch = 16
  const gap = 18
  const rowH = 22
  const items: RobLegendItem[] = []
  let x = x0
  let row = 0
  for (const level of levels) {
    const label = labels[level] ?? level
    const w = swatch + 6 + label.length * fontSize * 0.56
    if (x > x0 && x + w > x0 + width) { row += 1; x = x0 }
    items.push({ level, label, x: x + swatch / 2, y: y0 + row * rowH + rowH / 2 })
    x += w + gap
  }
  return { items, height: levels.length === 0 ? 0 : (row + 1) * rowH }
}
