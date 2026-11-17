import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import type { CitationCard, CitationVerdict } from '../../../types/citationCheck'
import { CitationCardView } from './CitationCheckCardView'
import { chipFlags, linkNote, primaryBadge } from '../../../lib/citationCheckActions'
import { flagMeta, needsAttention, resolutionBadge, summaryChips, matchesFilter } from '../../../lib/citationCheckView'
import { dismissalKey, loadDismissed, overstatementMessage, saveDismissed, visibleOverstatement } from '../../../lib/citationCheckOverstatement'

const verdict = (v: string, note: string | null = null): CitationVerdict => ({
  verdict: v, failureType: 'None', confidence: 'High', evidenceLevel: 'FullText', claimText: 'Claim text.', evidenceQuote: null,
  evidenceChunkId: null, reasoning: 'Because.', suggestedRewrite: null, quoteVerified: false, note,
})

const card = (o: Partial<CitationCard> = {}): CitationCard => ({
  id: 'c1', ordinal: 0, markerText: '(Bender et al., 2019)', markerOffset: 0, markerLength: 20, locked: false, resolutionState: 'Verified',
  resolutionNote: null, referenceEntry: null, flags: [], metadataDiffs: [], verdict: verdict('Supported'), citedLabel: 'Bender (2019)', ...o,
})

const html = (c: CitationCard, extra: { dismissed?: Set<string>; onDismiss?: () => void } = {}) =>
  renderToStaticMarkup(
    <MemoryRouter><CitationCardView card={c} dismissedOverstatements={extra.dismissed} onDismissOverstatement={extra.onDismiss} /></MemoryRouter>)

const LINK_NOTE = 'Judged against Bender (2021) from your reference list, because the year in your text (2019) does not match it. Fix the year to make this a clean check.'
const judgedLink = (v = 'Supported') => card({ flags: ['YearMismatch'], verdict: verdict(v, LINK_NOTE) })

describe('a year-linked citation that was judged (D1)', () => {
  it('shows the verdict as the main badge and the year problem beside it', () => {
    expect(primaryBadge(judgedLink('NotSupported'))!.label).toBe('Not supported')
    expect(chipFlags(judgedLink())).toEqual(['YearMismatch'])
  })

  it('says which entry it was judged against, in its own visible line', () => {
    expect(linkNote(judgedLink())).toBe(LINK_NOTE)
    expect(html(judgedLink())).toContain('Judged against Bender (2021)')
  })

  it('is not a clean verification: it needs attention and is not in the Supported group', () => {
    expect(needsAttention(judgedLink('Supported'))).toBe(true)
    expect(matchesFilter(judgedLink('Supported'), 'supported')).toBe(false)
    expect(matchesFilter(judgedLink('Supported'), 'attention')).toBe(true)
  })

  it('still reads "Year doesn\'t match" when nothing could be judged', () => {
    const c = card({ flags: ['YearMismatch'], verdict: verdict('CannotVerify') })
    expect(primaryBadge(c)!.label).toBe("Year doesn't match")
    expect(chipFlags(c)).toEqual([])
    expect(linkNote(c)).toBeNull()
  })

  it('shows the note once, not twice', () => {
    const out = html(judgedLink())
    expect(out.split('Judged against Bender (2021)').length - 1).toBe(1)
  })
})

describe('reason codes for a citation that could not be checked', () => {
  const unchecked = (flag: string) => card({ resolutionState: 'Unchecked', flags: [flag], verdict: verdict('CannotVerify') })

  it.each(['LookupFailed', 'ReferenceUnsearchable', 'CheckFailed'])('%s has its own plain-words chip and replaces the generic one', flag => {
    expect(flagMeta(flag).label).not.toBe(flag)
    expect(chipFlags(unchecked(flag))).toEqual([flag])
    expect(resolutionBadge(unchecked(flag))).toBeNull()
  })

  it('never calls an unchecked source fake or not found', () => {
    for (const f of ['LookupFailed', 'ReferenceUnsearchable', 'CheckFailed'])
      expect(html(unchecked(f))).not.toMatch(/fake|fabricat|not found/i)
  })

  it('an unsearchable reference asks the writer to act; a service failure does not', () => {
    expect(needsAttention(unchecked('ReferenceUnsearchable'))).toBe(true)
    expect(needsAttention(unchecked('LookupFailed'))).toBe(false)
    expect(needsAttention(unchecked('CheckFailed'))).toBe(false)
  })
})

describe('the strong-wording warning (D2)', () => {
  const warn = { phrase: 'completely eliminated', suggestion: 'Consider "reduced" or "substantially reduced".', severity: 'Standard', rulesVersion: 'overstatement-v1' }

  it('quotes the matched phrase and offers a calmer wording', () => {
    const out = html(card({ overstatement: warn }))
    expect(out).toContain('completely eliminated')
    expect(out).toContain('substantially reduced')
    expect(out).toContain('Strongly worded')
  })

  it('is stronger when the source could not be found, and still only a warning', () => {
    const c = card({ overstatement: { ...warn, severity: 'Elevated' }, flags: ['SourceNotFound'], verdict: verdict('CannotVerify') })
    expect(html(c)).toContain('Strongly worded and unsupported')
    expect(overstatementMessage({ ...warn, severity: 'Elevated' })).toMatch(/could not be found or checked/)
    expect(primaryBadge(c)!.label).toBe('Source not found')
  })

  it('offers Dismiss only when it can be handled, and a dismissed one disappears', () => {
    const c = card({ overstatement: warn })
    expect(html(c)).not.toContain('Dismiss')
    expect(html(c, { onDismiss: () => {} })).toContain('Dismiss')
    expect(html(c, { dismissed: new Set([dismissalKey(c, warn)]) })).not.toContain('Strongly worded')
  })

  it('a dismissal for an older rules version does not silence a newer one', () => {
    const c = card({ overstatement: { ...warn, rulesVersion: 'overstatement-v2' } })
    expect(visibleOverstatement(c, new Set([dismissalKey(c, warn)]))).not.toBeNull()
  })

  it('a locked card shows nothing', () => {
    expect(visibleOverstatement(card({ locked: true, overstatement: warn }), new Set())).toBeNull()
  })

  it('dismissals persist per run, and bad stored data is ignored', () => {
    const data = new Map<string, string>()
    const store = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) }
    saveDismissed('run-1', new Set(['a@v1']), store)
    expect([...loadDismissed('run-1', store)]).toEqual(['a@v1'])
    expect(loadDismissed('run-2', store).size).toBe(0)
    data.set('cc-overstatement-dismissed:run-3', '{not json')
    expect(loadDismissed('run-3', store).size).toBe(0)
    data.set('cc-overstatement-dismissed:run-4', '[1,"x",null]')
    expect([...loadDismissed('run-4', store)]).toEqual(['x'])
  })

  it('works when storage is unavailable', () => {
    expect(loadDismissed('r', null).size).toBe(0)
    expect(() => saveDismissed('r', new Set(['a']), null)).not.toThrow()
  })
})

describe('summary chips', () => {
  const base = { total: 3, checked: 3, supported: 1, partiallySupported: 0, notSupported: 0, contradicted: 0, cannotVerify: 0, locked: 0, integrityScore: 100,
    orphanCitations: 0, ambiguousCitations: 0, unusedReferences: 0, sourcesNotFound: 0, metadataMismatches: 0 }

  it('adds year and wording counts only when present, and tolerates an older server without them', () => {
    expect(summaryChips(base).map(c => c.key)).toEqual(['supported'])
    expect(summaryChips({ ...base, yearMismatches: 1, overstatedClaims: 2 }).map(c => c.key)).toEqual(['supported', 'yearMismatch', 'overstated'])
  })
})
