import type { AiVerdict, Exclusion, Reason, ScreeningState } from './literatureReview'

// Screen step of Literature Review Studio: the list's view (search, filters, sort, page) as it lives in the URL, the
// server query it becomes, range selection, the decision counters and the exclusions CSV. Pure, so it is tested alone.

export type ScreeningSort = 'decision' | 'relevance' | 'year' | 'citations' | 'title'

export interface ScreeningView {
  state: ScreeningState | ''
  search: string
  yearFrom: number | null
  yearTo: number | null
  database: string
  hasAbstract: boolean | null
  verdict: AiVerdict | ''
  sort: ScreeningSort
  page: number
}

export const DEFAULT_VIEW: ScreeningView = {
  state: '', search: '', yearFrom: null, yearTo: null, database: '', hasAbstract: null, verdict: '', sort: 'decision', page: 1,
}

export const SORT_OPTIONS: { value: ScreeningSort; label: string }[] = [
  { value: 'decision', label: 'Needs a decision first' },
  { value: 'relevance', label: 'Relevance (AI verdict, then score)' },
  { value: 'year', label: 'Year, newest first' },
  { value: 'citations', label: 'Most cited' },
  { value: 'title', label: 'Title, A to Z' },
]

export const VERDICT_OPTIONS: { value: AiVerdict; label: string }[] = [
  { value: 'Relevant', label: 'Relevant' },
  { value: 'Uncertain', label: 'Uncertain' },
  { value: 'Excluded', label: 'Not relevant' },
  { value: 'Pending', label: 'Not judged yet' },
]

export const verdictLabel = (v: AiVerdict) => VERDICT_OPTIONS.find(o => o.value === v)?.label ?? v

const STATES: ScreeningState[] = ['NotScreened', 'Included', 'AwaitingFullText', 'PotentiallyRelevant', 'NotRelevant', 'Excluded', 'UnableToAssess', 'Suggested']
const SORTS = SORT_OPTIONS.map(o => o.value)
const VERDICTS = VERDICT_OPTIONS.map(o => o.value)

/** URL keys of the view. "step" and any other key on the page are left alone. */
const KEYS = { state: 'state', search: 'q', yearFrom: 'from', yearTo: 'to', database: 'db', hasAbstract: 'abstract', verdict: 'verdict', sort: 'sort', page: 'page' } as const

const year = (raw: string | null): number | null => {
  const n = raw && /^\d{4}$/.test(raw) ? Number(raw) : NaN
  return n >= 1000 && n <= 2999 ? n : null
}

/** Reads the view from the URL. Anything unknown or malformed falls back to the default, so a hand-edited link never breaks the page. */
export function readView(params: URLSearchParams): ScreeningView {
  const state = params.get(KEYS.state) as ScreeningState | null
  const sort = params.get(KEYS.sort) as ScreeningSort | null
  const verdict = params.get(KEYS.verdict) as AiVerdict | null
  const abstract = params.get(KEYS.hasAbstract)
  const page = Number(params.get(KEYS.page))
  return {
    state: state && STATES.includes(state) ? state : '',
    search: (params.get(KEYS.search) ?? '').slice(0, 200),
    yearFrom: year(params.get(KEYS.yearFrom)),
    yearTo: year(params.get(KEYS.yearTo)),
    database: params.get(KEYS.database) ?? '',
    hasAbstract: abstract === 'yes' ? true : abstract === 'no' ? false : null,
    verdict: verdict && VERDICTS.includes(verdict) ? verdict : '',
    sort: sort && SORTS.includes(sort) ? sort : 'decision',
    page: Number.isInteger(page) && page > 1 ? page : 1,
  }
}

/** Writes the view into a copy of the URL's params, leaving out defaults so a plain link stays plain. */
export function writeView(params: URLSearchParams, view: ScreeningView): URLSearchParams {
  const next = new URLSearchParams(params)
  const set = (key: string, value: string | null) => { if (value) next.set(key, value); else next.delete(key) }
  set(KEYS.state, view.state || null)
  set(KEYS.search, view.search.trim() || null)
  set(KEYS.yearFrom, view.yearFrom?.toString() ?? null)
  set(KEYS.yearTo, view.yearTo?.toString() ?? null)
  set(KEYS.database, view.database || null)
  set(KEYS.hasAbstract, view.hasAbstract === null ? null : view.hasAbstract ? 'yes' : 'no')
  set(KEYS.verdict, view.verdict || null)
  set(KEYS.sort, view.sort === 'decision' ? null : view.sort)
  set(KEYS.page, view.page > 1 ? String(view.page) : null)
  return next
}

/** True when anything but the state tab, sort and page narrows the list. */
export const isFiltered = (v: ScreeningView) =>
  !!v.search.trim() || v.yearFrom !== null || v.yearTo !== null || !!v.database || v.hasAbstract !== null || !!v.verdict

/** The view without its state and page: selection is kept only while this stays the same. */
export const filterKey = (v: ScreeningView) =>
  JSON.stringify([v.search.trim().toLowerCase(), v.yearFrom, v.yearTo, v.database, v.hasAbstract, v.verdict, v.state])

export interface ScreeningQuery {
  state?: string; search?: string; yearFrom?: number; yearTo?: number; database?: string; hasAbstract?: boolean; verdict?: string; sort?: string
  page: number; pageSize: number
}

export function toQuery(v: ScreeningView, pageSize: number): ScreeningQuery {
  const q: ScreeningQuery = { page: v.page, pageSize }
  if (v.state) q.state = v.state
  if (v.search.trim()) q.search = v.search.trim()
  if (v.yearFrom !== null) q.yearFrom = v.yearFrom
  if (v.yearTo !== null) q.yearTo = v.yearTo
  if (v.database) q.database = v.database
  if (v.hasAbstract !== null) q.hasAbstract = v.hasAbstract
  if (v.verdict) q.verdict = v.verdict
  if (v.sort !== 'decision') q.sort = v.sort
  return q
}

/** The ids from the anchor to the target in the order shown (both included), for Shift+click. Empty when either is not shown. */
export function rangeBetween(order: readonly string[], anchor: string, target: string): string[] {
  const a = order.indexOf(anchor)
  const b = order.indexOf(target)
  if (a < 0 || b < 0) return []
  return order.slice(Math.min(a, b), Math.max(a, b) + 1)
}

export interface Counters { included: number; needsFullText: number; excluded: number; undecided: number; notScreened: number; suggested: number }

/** The decision counters: excluded covers the reviewer's exclusions and the AI's "not relevant"; undecided waits on the reviewer. */
export function counters(counts: Partial<Record<ScreeningState, number>>): Counters {
  const n = (s: ScreeningState) => counts[s] ?? 0
  return {
    included: n('Included'),
    needsFullText: n('AwaitingFullText'),
    excluded: n('Excluded') + n('NotRelevant'),
    undecided: n('PotentiallyRelevant') + n('UnableToAssess'),
    notScreened: n('NotScreened'),
    suggested: n('Suggested'),
  }
}

export const OTHER_REASON = 'OTHER'
/** The exclude reasons offered first, in this order; the server's other reasons follow and "Other" comes last. */
const PREFERRED_REASONS = ['TOPIC', 'POPULATION', 'SETTING', 'OPINION', 'NO_ABSTRACT', 'DUPLICATE']

export function orderExcludeReasons(reasons: readonly Reason[]): Reason[] {
  const rank = (code: string) => code === OTHER_REASON ? Number.MAX_SAFE_INTEGER : (PREFERRED_REASONS.indexOf(code) + 1 || PREFERRED_REASONS.length + 1)
  return reasons.filter(r => r.code !== 'NEEDS_FULLTEXT').sort((a, b) => rank(a.code) - rank(b.code))
}

const DECIDED_BY: Record<Exclusion['decidedBy'], string> = { Student: 'Reviewer', AI: 'AI screening', DateRange: 'Date range' }

/**
 * CSV of the records set aside, for the methods section. Quotes every field and neutralises a leading =, +, - or @ so a
 * spreadsheet never runs a title as a formula. Starts with a byte order mark so Excel reads it as UTF-8.
 */
export function exclusionsCsv(rows: readonly Exclusion[]): string {
  const cell = (value: string) => {
    const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
    return `"${safe.replace(/"/g, '""')}"`
  }
  const lines = [['Title', 'Year', 'DOI', 'Reason', 'Decided by'], ...rows.map(r => [r.title, r.year, r.doi, r.reason, DECIDED_BY[r.decidedBy] ?? r.decidedBy])]
  return '﻿' + lines.map(l => l.map(cell).join(',')).join('\r\n') + '\r\n'
}
