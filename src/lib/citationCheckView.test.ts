import { describe, expect, it } from 'vitest'
import type { CitationCard, CitationCheckReport, CitationCheckSummary, CitationVerdict } from '../types/citationCheck'
import {
  attentionLine, canStart, checkableTotal, diffFieldLabel, evidenceLabel, failureMeta, filterCards, filterCounts, flagMeta,
  headline, isDocx, isTerminal, limitNote, lockedNote, matchesFilter, needsAttention, progress, queueNotice, resolutionMeta,
  extraNote, resolutionBadge, retentionNote, scoreTone, stageLabel, startHint, summaryChips, verdictMeta, wordCount,
} from './citationCheckView'

const summary = (o: Partial<CitationCheckSummary> = {}): CitationCheckSummary => ({
  total: 0, checked: 0, supported: 0, partiallySupported: 0, notSupported: 0, contradicted: 0, cannotVerify: 0, locked: 0,
  integrityScore: null, orphanCitations: 0, ambiguousCitations: 0, unusedReferences: 0, sourcesNotFound: 0, metadataMismatches: 0, ...o,
})

const verdict = (v: string, o: Partial<CitationVerdict> = {}): CitationVerdict => ({
  verdict: v, failureType: 'None', confidence: 'High', evidenceLevel: 'FullText', claimText: 'A claim.', evidenceQuote: null,
  evidenceChunkId: null, reasoning: 'Because.', suggestedRewrite: null, quoteVerified: false, note: null, ...o,
})

const card = (o: Partial<CitationCard> = {}): CitationCard => ({
  id: 'c', ordinal: 0, markerText: '(Smith, 2020)', markerOffset: 0, markerLength: 13, locked: false, resolutionState: 'Verified',
  resolutionNote: null, referenceEntry: 'ref', flags: [], metadataDiffs: [], verdict: verdict('Supported'), ...o,
})

const report = (o: Partial<CitationCheckReport> = {}): CitationCheckReport => ({
  runId: 'r', status: 'Completed', stage: 'Done', citationCount: 10, citationsDone: 10, limitReached: false, fullCheckLimit: null,
  error: null, warnings: [], unusedReferences: [], summary: summary({ total: 10, checked: 10, supported: 8, integrityScore: 80 }),
  cards: [], createdAt: '2026-11-01T00:00:00Z', deleteAfter: '2026-12-01T00:00:00Z', ...o,
})

describe('wording rules', () => {
  it('never calls a source that could not be found fake or fabricated', () => {
    const all = [resolutionMeta('NotFound'), flagMeta('SourceNotFound'), verdictMeta('CannotVerify')]
    for (const m of all) expect(`${m.label} ${m.hint ?? ''}`).not.toMatch(/fake|fabricat|made.?up|invented/i)
    expect(resolutionMeta('NotFound').label).toBe('Could not verify this source exists')
  })

  it('treats "could not verify" as neutral and says it does not count against the writer', () => {
    expect(verdictMeta('CannotVerify').tone).toBe('neutral')
    expect(verdictMeta('CannotVerify').hint).toMatch(/does not count against you/)
  })

  it('degrades unseen values to a neutral label instead of throwing', () => {
    expect(verdictMeta('SomethingNew')).toEqual({ label: 'Unknown result', tone: 'neutral' })
    expect(verdictMeta(null).tone).toBe('neutral')
    expect(resolutionMeta('Weird').tone).toBe('neutral')
    expect(flagMeta('NewFlag')).toEqual({ label: 'NewFlag', tone: 'neutral' })
    expect(failureMeta('NewPattern')).toEqual({ label: 'NewPattern', explanation: '' })
    expect(diffFieldLabel('volume')).toBe('volume')
    expect(stageLabel('Mystery')).toBe('Working')
  })

  it('has no failure pattern for "none" or nothing, and plain-language text for each known one', () => {
    expect(failureMeta('None')).toBeNull()
    expect(failureMeta(null)).toBeNull()
    for (const f of ['OutcomePredictorInversion', 'DesignTypeMismatch', 'HedgeInversion', 'PopulationBleed', 'CrossDomainBleed']) {
      const m = failureMeta(f)!
      expect(m.label.length).toBeGreaterThan(5)
      expect(m.explanation.length).toBeGreaterThan(20)
    }
  })

  it('labels the evidence honestly, including abstract-only', () => {
    expect(evidenceLabel('FullText')).toBe('Checked against the full text')
    expect(evidenceLabel('AbstractOnly')).toBe('Checked against the abstract only')
  })

  it('maps each verdict to a tone a writer can read at a glance', () => {
    expect(['Supported', 'PartiallySupported', 'NotSupported', 'Contradicted'].map(v => verdictMeta(v).tone)).toEqual(['success', 'warning', 'danger', 'danger'])
  })
})

describe('progress', () => {
  it('shows an honest fraction only while judging, and says how many are done', () => {
    const p = progress(report({ status: 'Running', stage: 'Judging', citationCount: 10, citationsDone: 4 }))
    expect(p).toMatchObject({ done: 4, total: 10, fraction: 0.4, indeterminate: false, label: 'Checking each citation (4 of 10)' })
  })

  it('is indeterminate before judging: no invented percentage while reading or finding sources', () => {
    for (const stage of ['Queued', 'Parsing', 'Resolving']) {
      const p = progress(report({ status: stage === 'Queued' ? 'Queued' : 'Running', stage, citationsDone: 0 }))
      expect(p.indeterminate).toBe(true)
      expect(p.fraction).toBe(0)
    }
    expect(progress(report({ status: 'Running', stage: 'Resolving' })).label).toBe('Finding your sources')
  })

  it('counts only the citations the plan allows, so a free user never sees "3 of 20"', () => {
    const r = report({ status: 'Running', stage: 'Judging', citationCount: 20, fullCheckLimit: 5, citationsDone: 3 })
    expect(checkableTotal(r)).toBe(5)
    expect(progress(r)).toMatchObject({ done: 3, total: 5, fraction: 0.6 })
  })

  it('a limit above the citation count does not inflate the total', () => {
    expect(checkableTotal({ citationCount: 3, fullCheckLimit: 5 })).toBe(3)
    expect(checkableTotal({ citationCount: 3, fullCheckLimit: null })).toBe(3)
  })

  it('never reports more done than the total, and is complete when finished', () => {
    expect(progress(report({ status: 'Running', stage: 'Judging', citationCount: 4, citationsDone: 9 })).done).toBe(4)
    expect(progress(report({ status: 'Completed' }))).toMatchObject({ fraction: 1, indeterminate: false, label: 'Done' })
    expect(progress(report({ status: 'Failed', stage: 'Failed' }))).toMatchObject({ fraction: 1, label: 'Stopped' })
  })

  it('handles a draft with no citations without dividing by zero', () => {
    const p = progress(report({ status: 'Running', stage: 'Judging', citationCount: 0, citationsDone: 0 }))
    expect(p.fraction).toBe(0)
    expect(Number.isNaN(p.fraction)).toBe(false)
  })

  it('knows which statuses are final', () => {
    expect(['Completed', 'Failed'].map(isTerminal)).toEqual([true, true])
    expect(['Queued', 'Running', undefined, 'Mystery'].map(isTerminal)).toEqual([false, false, false, false])
  })

  it('warns about a stuck queue only after 90 seconds and only while queued', () => {
    expect(queueNotice('Queued', 89_000)).toBeNull()
    expect(queueNotice('Queued', 91_000)).toMatch(/taking longer than usual/)
    expect(queueNotice('Running', 600_000)).toBeNull()
    expect(queueNotice(undefined, 600_000)).toBeNull()
  })
})

describe('attention and filters', () => {
  it('flags problem verdicts, missing or unresolved sources and differing reference details', () => {
    expect(needsAttention(card({ verdict: verdict('NotSupported') }))).toBe(true)
    expect(needsAttention(card({ verdict: verdict('Contradicted') }))).toBe(true)
    expect(needsAttention(card({ verdict: verdict('PartiallySupported') }))).toBe(true)
    expect(needsAttention(card({ verdict: verdict('CannotVerify'), flags: ['OrphanCitation'] }))).toBe(true)
    expect(needsAttention(card({ verdict: verdict('CannotVerify'), flags: ['SourceNotFound'] }))).toBe(true)
    expect(needsAttention(card({ flags: ['AmbiguousReference'] }))).toBe(true)
    expect(needsAttention(card({ resolutionState: 'MetadataMismatch' }))).toBe(true)
  })

  it('does not flag a clean supported citation, a plain "could not verify", or a citation still being checked', () => {
    expect(needsAttention(card())).toBe(false)
    expect(needsAttention(card({ verdict: verdict('CannotVerify'), resolutionState: 'Unchecked' }))).toBe(false)
    expect(needsAttention(card({ verdict: null, resolutionState: 'Pending' }))).toBe(false)
  })

  it('never flags a locked card, whatever the server put on it', () => {
    expect(needsAttention(card({ locked: true, flags: ['OrphanCitation'], verdict: verdict('Contradicted') }))).toBe(false)
  })

  const cards = [
    card({ id: 'a', ordinal: 0 }),
    card({ id: 'b', ordinal: 1, verdict: verdict('Contradicted') }),
    card({ id: 'c', ordinal: 2, verdict: verdict('CannotVerify'), resolutionState: 'Unchecked' }),
    card({ id: 'd', ordinal: 3, verdict: verdict('Supported'), flags: ['MetadataMismatch'], resolutionState: 'MetadataMismatch' }),
    card({ id: 'e', ordinal: 4, locked: true, verdict: null, resolutionState: 'Locked' }),
    card({ id: 'f', ordinal: 5, verdict: null, resolutionState: 'Pending' }),
  ]

  it('splits cards into non-overlapping groups plus "all"', () => {
    const ids = (f: Parameters<typeof filterCards>[1]) => filterCards(cards, f).map(c => c.id)
    expect(ids('all')).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
    expect(ids('attention')).toEqual(['b', 'd'])
    expect(ids('supported')).toEqual(['a'])           // 'd' is supported but has a reference problem, so it is in attention only
    expect(ids('unverified')).toEqual(['c'])
    expect(ids('locked')).toEqual(['e'])
  })

  it('keeps document order within a filter', () => {
    expect(filterCards([...cards].reverse(), 'all').map(c => c.id)).toEqual(['f', 'e', 'd', 'c', 'b', 'a'])   // order is the caller's; the filter never reorders
  })

  it('counts each filter, and a pending card appears only under "all"', () => {
    expect(filterCounts(cards)).toEqual({ all: 6, attention: 2, differs: 0, supported: 1, unverified: 1, locked: 1 })
    expect(matchesFilter(cards[5], 'supported') || matchesFilter(cards[5], 'unverified') || matchesFilter(cards[5], 'attention')).toBe(false)
  })
})

describe('summary chips and score', () => {
  it('leaves out zero counts', () => {
    const chips = summaryChips(summary({ supported: 3, notSupported: 1, cannotVerify: 2 }))
    expect(chips.map(c => c.key)).toEqual(['supported', 'notSupported', 'cannotVerify'])
    expect(summaryChips(summary())).toEqual([])
  })

  it('bands the score and stays neutral when there is none', () => {
    expect([100, 85, 84, 60, 59, 0].map(scoreTone)).toEqual(['success', 'success', 'warning', 'warning', 'danger', 'danger'])
    expect(scoreTone(null)).toBe('neutral')
    expect(scoreTone(undefined)).toBe('neutral')
  })
})

describe('headline and notes', () => {
  it('reports a failure in the server\'s own words, with a fallback', () => {
    expect(headline(report({ status: 'Failed', error: 'The draft has 200 citations; the limit is 150.' }))).toBe('The draft has 200 citations; the limit is 150.')
    expect(headline(report({ status: 'Failed', error: null }))).toBe('The check could not finish.')
  })

  it('shows progress while running', () => {
    expect(headline(report({ status: 'Running', stage: 'Judging', citationCount: 10, citationsDone: 2 }))).toBe('Checking each citation (2 of 10)')
  })

  it('says so plainly when there is nothing to check or nothing could be judged', () => {
    expect(headline(report({ citationCount: 0 }))).toBe('No in-text citations were found in your draft.')
    expect(headline(report({ summary: summary({ total: 3, integrityScore: null }) }))).toMatch(/None of the citations could be judged/)
  })

  it('states the result with correct singular and plural', () => {
    expect(headline(report({ summary: summary({ total: 10, checked: 10, supported: 8, integrityScore: 80 }) }))).toBe('8 of 10 checked citations are fully supported.')
    expect(headline(report({ summary: summary({ total: 1, checked: 1, supported: 1, integrityScore: 100 }) }))).toBe('1 of 1 checked citation is fully supported.')
  })

  it('describes how many need attention', () => {
    expect(attentionLine([card()])).toBeNull()
    expect(attentionLine([card({ verdict: verdict('NotSupported') })])).toBe('1 citation needs your attention.')
    expect(attentionLine([card({ verdict: verdict('NotSupported') }), card({ verdict: verdict('Contradicted') })])).toBe('2 citations need your attention.')
  })

  it('explains locked citations by the plan limit, and says nothing when none are locked', () => {
    expect(lockedNote(report({ fullCheckLimit: 5, summary: summary({ locked: 3 }) }))).toBe('3 more citations found but not checked: your plan checks the first 5 in each run.')
    expect(lockedNote(report({ fullCheckLimit: 5, summary: summary({ locked: 1 }) }))).toMatch(/^1 more citation found/)
    expect(lockedNote(report({ fullCheckLimit: 5, summary: summary({ locked: 0 }) }))).toBeNull()
    expect(lockedNote(report({ fullCheckLimit: null, summary: summary({ locked: 2 }) }))).toBeNull()
  })

  it('tells the writer when the size limit skipped citations', () => {
    expect(limitNote(report({ limitReached: true }))).toMatch(/skipped/)
    expect(limitNote(report({ limitReached: false }))).toBeNull()
  })

  it('states retention in days, rounding up, and tolerates bad dates', () => {
    const now = new Date('2026-11-01T12:00:00Z')
    expect(retentionNote('2026-12-01T12:00:00Z', now)).toBe('Your draft and results are deleted automatically in 30 days. You can delete them now.')
    expect(retentionNote('2026-11-02T00:00:00Z', now)).toMatch(/in 1 day\./)
    expect(retentionNote('2026-10-30T00:00:00Z', now)).toMatch(/due to be deleted/)
    expect(retentionNote('not a date', now)).toMatch(/deleted automatically after a set time/)
  })
})

describe('input rules', () => {
  it('counts words', () => {
    expect(wordCount('')).toBe(0)
    expect(wordCount('  a   b\nc ')).toBe(3)
  })

  it('needs at least 20 words, and says how many more', () => {
    const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ')
    expect(canStart(words(19))).toBe(false)
    expect(canStart(words(20))).toBe(true)
    expect(startHint('')).toMatch(/Paste a draft/)
    expect(startHint(words(15))).toBe('Minimum 20 words required (5 more needed).')
    expect(startHint(words(20))).toBeNull()
  })

  it('accepts only .docx files, in any case', () => {
    expect(['thesis.docx', 'THESIS.DOCX', ' a.docx '].map(isDocx)).toEqual([true, true, true])
    expect(['a.doc', 'a.pdf', 'a.docx.txt', 'docx', ''].map(isDocx)).toEqual([false, false, false, false, false])
  })
})

describe('resolutionBadge', () => {
  it('shows nothing for a clean, pending or locked citation', () => {
    for (const resolutionState of ['Verified', 'Pending', 'Locked']) expect(resolutionBadge({ resolutionState, flags: [] })).toBeNull()
  })

  it('does not repeat what a flag already says', () => {
    expect(resolutionBadge({ resolutionState: 'NotFound', flags: ['SourceNotFound'] })).toBeNull()
    expect(resolutionBadge({ resolutionState: 'MetadataMismatch', flags: ['MetadataMismatch'] })).toBeNull()
    expect(resolutionBadge({ resolutionState: 'None', flags: ['OrphanCitation'] })).toBeNull()
    expect(resolutionBadge({ resolutionState: 'None', flags: ['AmbiguousReference'] })).toBeNull()
  })

  it('still shows the state when nothing else covers it', () => {
    expect(resolutionBadge({ resolutionState: 'Unchecked', flags: [] })?.label).toBe('Could not check this source right now')
    expect(resolutionBadge({ resolutionState: 'NotFound', flags: [] })?.label).toBe('Could not verify this source exists')
    expect(resolutionBadge({ resolutionState: 'MetadataMismatch', flags: [] })?.label).toBe('Source found, details differ')
  })
})

describe('extraNote', () => {
  const v = (o: Partial<CitationVerdict>) => verdict('CannotVerify', o)

  it('never repeats the reasoning: the server uses one sentence for both on a citation it could not judge', () => {
    expect(extraNote(v({ reasoning: 'Could not verify this source exists.', note: 'Could not verify this source exists.' }))).toBeNull()
    expect(extraNote(v({ reasoning: ' same ', note: 'same' }))).toBeNull()
  })

  it('gives a differing note on an unjudged citation', () => {
    expect(extraNote(v({ reasoning: 'Not enough text.', note: 'No open-access full text was found.' }))).toBe('No open-access full text was found.')
  })

  it('has nothing to add when there is no note', () => {
    expect(extraNote(v({ note: null }))).toBeNull()
    expect(extraNote(v({ note: '   ' }))).toBeNull()
  })

  it('on a judged citation, keeps a note only when it explains an abstract-only limit', () => {
    expect(extraNote(verdict('NotSupported', { evidenceLevel: 'AbstractOnly', note: 'Only the abstract was available, so confidence is capped at medium.' }))).toMatch(/abstract/)
    expect(extraNote(verdict('NotSupported', { evidenceLevel: 'FullText', note: 'internal detail' }))).toBeNull()
  })
})

describe('a draft with no reference list', () => {
  it('names the problem accurately, and never says the citation is missing from a list that does not exist', () => {
    const m = flagMeta('NoReferenceList')
    expect(m.label).toBe('No reference list in your draft')
    expect(m.hint).toMatch(/References/)
    expect(m.label).not.toMatch(/Not in your reference list/)
  })

  it('needs attention from the person writing, and is not repeated as a second chip', () => {
    const c = card({ resolutionState: 'None', flags: ['NoReferenceList'], verdict: verdict('CannotVerify') })
    expect(needsAttention(c)).toBe(true)
    expect(resolutionBadge(c)).toBeNull()
  })
})
