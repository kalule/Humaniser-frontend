import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import type { CitationCard, CitationCheckReport, CitationCheckSummary, CitationVerdict } from '../../../types/citationCheck'
import { CitationCheckReportView } from './CitationCheckReportView'
import { CitationCardView } from './CitationCheckCardView'

// Renders the real components to HTML (no DOM library needed) and asserts on what a writer would actually see.

const summary = (o: Partial<CitationCheckSummary> = {}): CitationCheckSummary => ({
  total: 0, checked: 0, supported: 0, partiallySupported: 0, notSupported: 0, contradicted: 0, cannotVerify: 0, locked: 0,
  integrityScore: null, orphanCitations: 0, ambiguousCitations: 0, unusedReferences: 0, sourcesNotFound: 0, metadataMismatches: 0, ...o,
})

const verdict = (v: string, o: Partial<CitationVerdict> = {}): CitationVerdict => ({
  verdict: v, failureType: 'None', confidence: 'High', evidenceLevel: 'FullText', claimText: 'Sleep supports memory.',
  evidenceQuote: null, evidenceChunkId: null, reasoning: 'The passage says so.', suggestedRewrite: null, quoteVerified: false, note: null, ...o,
})

const card = (o: Partial<CitationCard> = {}): CitationCard => ({
  id: 'c1', ordinal: 0, markerText: '(Smith, 2020)', markerOffset: 0, markerLength: 13, locked: false, resolutionState: 'Verified',
  resolutionNote: null, referenceEntry: 'Smith, J. (2020). Sleep and memory.', flags: [], metadataDiffs: [], verdict: verdict('Supported'), ...o,
})

const report = (o: Partial<CitationCheckReport> = {}): CitationCheckReport => ({
  runId: 'r', status: 'Completed', stage: 'Done', citationCount: 2, citationsDone: 2, limitReached: false, fullCheckLimit: null, error: null,
  warnings: [], unusedReferences: [], summary: summary({ total: 2, checked: 2, supported: 1, notSupported: 1, integrityScore: 50 }),
  cards: [card({ id: 'a' }), card({ id: 'b', ordinal: 1, markerText: '(Lee, 2019)', verdict: verdict('NotSupported') })],
  createdAt: '2026-11-01T00:00:00Z', deleteAfter: '2026-12-01T00:00:00Z', ...o,
})

const view = (r: CitationCheckReport, extra: Partial<{ lostMessage: string | null; queuedForMs: number }> = {}) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <CitationCheckReportView report={r} lostMessage={extra.lostMessage ?? null} queuedForMs={extra.queuedForMs ?? 0} onRetry={() => {}} />
    </MemoryRouter>,
  )

const cardHtml = (c: CitationCard) => renderToStaticMarkup(<MemoryRouter><CitationCardView card={c} /></MemoryRouter>)

describe('CitationCardView', () => {
  it('shows a verified quote with where it came from', () => {
    const html = cardHtml(card({ verdict: verdict('Supported', { evidenceQuote: 'higher screen time was associated with poorer sleep', quoteVerified: true }) }))
    expect(html).toContain('“higher screen time was associated with poorer sleep”')
    expect(html).toContain('From the source')
    expect(html).toContain('Checked against the full text')
  })

  it('shows no quote block when the server sent none, rather than an empty or invented one', () => {
    const html = cardHtml(card({ verdict: verdict('NotSupported', { evidenceQuote: null }) }))
    expect(html).not.toContain('<blockquote')
    expect(html).not.toContain('From the source')
  })

  it('escapes quote text from third-party papers instead of rendering it as markup', () => {
    const html = cardHtml(card({ verdict: verdict('Supported', { evidenceQuote: '<script>alert(1)</script><img src=x onerror=alert(2)>', quoteVerified: true }) }))
    expect(html).not.toContain('<script>')
    expect(html).not.toMatch(/<img[^>]*onerror/i)
    expect(html).toContain('&lt;script&gt;')
  })

  it('escapes the draft-derived text too: the claim, the reasoning, and the reference entry', () => {
    const evil = '<b onmouseover=alert(1)>x</b>'
    const html = cardHtml(card({ referenceEntry: evil, verdict: verdict('Supported', { claimText: evil, reasoning: evil }) }))
    expect(html).not.toContain('<b onmouseover')
    expect(html).toContain('&lt;b onmouseover')
  })

  it('labels abstract-only evidence and explains a named failure pattern in plain words', () => {
    const html = cardHtml(card({ verdict: verdict('PartiallySupported', { failureType: 'DesignTypeMismatch', evidenceLevel: 'AbstractOnly', evidenceQuote: 'We could not determine whether remote work caused the difference.', quoteVerified: true }) }))
    expect(html).toContain('Checked against the abstract only')
    expect(html).toContain('Study design does not support the claim')
    expect(html).toContain('cannot show that one causes the other')
    expect(html).toContain('Partly supported')
  })

  it('offers a suggested wording with a copy button, only when there is one', () => {
    const withRewrite = cardHtml(card({ verdict: verdict('NotSupported', { suggestedRewrite: 'Screen time was associated with poorer sleep.' }) }))
    expect(withRewrite).toContain('A wording the source supports')
    expect(withRewrite).toContain('Screen time was associated with poorer sleep.')
    expect(withRewrite).toContain('Copy')
    expect(cardHtml(card())).not.toContain('A wording the source supports')
  })

  it('says a source could not be found in the careful words, never "fake"', () => {
    const html = cardHtml(card({
      resolutionState: 'NotFound', flags: ['SourceNotFound'],
      verdict: verdict('CannotVerify', { note: 'Could not verify this source exists.' }),
    }))
    expect(html).toContain('Source not found')
    expect(html).toContain('Could not verify')
    expect(html).not.toMatch(/fake|fabricat|made.?up|invented/i)
  })

  it('shows why a citation could not be verified', () => {
    const html = cardHtml(card({ verdict: verdict('CannotVerify', { note: 'This citation has no matching entry in the reference list.' }), flags: ['OrphanCitation'] }))
    expect(html).toContain('has no matching entry in the reference list')
    expect(html).toContain('Missing reference')                       // the main badge says the real reason
    expect(html).not.toContain('Not in your reference list')          // and it is not repeated as a second chip
  })

  it('spells out reference details that differ from the record', () => {
    const html = cardHtml(card({ resolutionState: 'MetadataMismatch', flags: ['MetadataMismatch'], metadataDiffs: [{ field: 'year', inDraft: '2020', inRecord: '2018' }] }))
    expect(html).toContain('Year:')
    expect(html).toContain('your reference says <em>2020</em>; the record says <em>2018</em>')
  })

  it('shows a citation that is still being checked as such, not as a result', () => {
    const html = cardHtml(card({ verdict: null, resolutionState: 'Pending' }))
    expect(html).toContain('Checking…')
    expect(html).not.toContain('Supported')
  })

  it('renders a locked card with nothing about the citation but its position and a way to unlock', () => {
    const html = cardHtml(card({ locked: true, verdict: null, resolutionState: 'Locked', referenceEntry: 'SECRET REFERENCE TEXT', flags: ['SourceNotFound'] }))
    expect(html).toContain('(Smith, 2020)')
    expect(html).toContain('Not checked on your plan')
    expect(html).toContain('href="/app/upgrade"')
    expect(html).not.toContain('SECRET REFERENCE TEXT')
    expect(html).not.toContain('Source not found')
  })

  it('tolerates a verdict value the UI has never seen', () => {
    expect(() => cardHtml(card({ verdict: verdict('BrandNewVerdict', { failureType: 'BrandNewPattern' }) }))).not.toThrow()
    expect(cardHtml(card({ verdict: verdict('BrandNewVerdict') }))).toContain('Unknown result')
  })
})

describe('CitationCardView: no repeated information', () => {
  const occurrences = (html: string, text: string) => html.split(text).length - 1

  it('prints the explanation once on a citation that could not be judged', () => {
    const sentence = 'This citation has no matching entry in the reference list.'
    const html = cardHtml(card({ flags: ['OrphanCitation'], resolutionState: 'None', verdict: verdict('CannotVerify', { reasoning: sentence, note: sentence }) }))
    expect(occurrences(html, sentence)).toBe(1)
  })

  it('shows one chip, not two, when the resolution state and a flag say the same thing', () => {
    const mismatch = cardHtml(card({ resolutionState: 'MetadataMismatch', flags: ['MetadataMismatch'], verdict: verdict('Supported') }))
    expect(occurrences(mismatch, 'Reference details differ')).toBe(1)
    expect(mismatch).not.toContain('Source found, details differ')

    const notFound = cardHtml(card({ resolutionState: 'NotFound', flags: ['SourceNotFound'], verdict: verdict('CannotVerify') }))
    expect(occurrences(notFound, 'Source not found')).toBe(1)
    expect(notFound).not.toContain('Could not verify this source exists</span>')
  })

  it('still says when a source could not be checked right now, since no flag covers that', () => {
    const html = cardHtml(card({ resolutionState: 'Unchecked', flags: [], verdict: verdict('CannotVerify', { reasoning: 'r', note: 'A lookup service did not answer.' }) }))
    expect(html).toContain('Could not check this source right now')
    expect(html).toContain('A lookup service did not answer.')
  })
})

describe('CitationCardView: no reference list', () => {
  it('names the real cause once and prints the actionable sentence once, not "not in your reference list"', () => {
    const sentence = 'Your draft has no reference list, so we cannot tell which paper this citation means. Add a "References" section and check again.'
    const html = cardHtml(card({ resolutionState: 'None', flags: ['NoReferenceList'], verdict: verdict('CannotVerify', { reasoning: sentence, note: sentence }) }))
    expect(html).toContain('No reference list')
    expect(html.split('No reference list').length - 1).toBe(1)        // once: the main badge, not also a chip
    expect(html).not.toContain('Not in your reference list')
    expect(html).not.toContain('Could not verify')                    // the badge names the cause instead of the vaguer label
    expect(html.split('we cannot tell which paper this citation means').length - 1).toBe(1)
  })
})

describe('CitationCheckReportView', () => {
  it('shows the score, the headline, what needs attention, and the counts for a finished check', () => {
    const html = view(report())
    expect(html).toContain('>50<')
    expect(html).toContain('1 of 2 checked citations are fully supported.')
    expect(html).toContain('1 citation needs your attention.')
    expect(html).toContain('1 supported')
    expect(html).toContain('1 not supported')
    expect(html).toContain('left out of the score')
  })

  it('shows a dash, not a made-up score, when nothing could be judged', () => {
    const html = view(report({ summary: summary({ total: 1, cannotVerify: 1, integrityScore: null }), cards: [card({ verdict: verdict('CannotVerify') })] }))
    expect(html).toContain('>–<')
    expect(html).toContain('None of the citations could be judged')
  })

  it('shows progress, not a score, while the check is running', () => {
    const html = view(report({ status: 'Running', stage: 'Judging', citationCount: 10, citationsDone: 4, summary: summary({ total: 10 }) }))
    expect(html).toContain('role="progressbar"')
    expect(html).toContain('Checking each citation (4 of 10)')
    expect(html).toContain('width:40%')
    expect(html).not.toContain('of 100')
  })

  it('shows findings as they arrive, with the unfinished ones marked as still checking', () => {
    const html = view(report({ status: 'Running', stage: 'Judging', cards: [card({ id: 'a' }), card({ id: 'b', ordinal: 1, verdict: null, resolutionState: 'Pending' })] }))
    expect(html).toContain('Supported')
    expect(html).toContain('Checking…')
  })

  it('shows an indeterminate bar, with no invented percentage, before judging starts', () => {
    const html = view(report({ status: 'Running', stage: 'Resolving', citationsDone: 0 }))
    expect(html).toContain('Finding your sources')
    expect(html).not.toContain('width:0%')
    expect(html).not.toMatch(/aria-valuenow/)
  })

  it('reports a failed check in the server\'s words', () => {
    const html = view(report({ status: 'Failed', stage: 'Failed', error: 'The draft has 200 citations; the limit is 150.', cards: [] }))
    expect(html).toContain('The draft has 200 citations; the limit is 150.')
    expect(html).not.toContain('of 100')
  })

  it('tells the writer the connection dropped and offers to try again, without saying the check failed', () => {
    const html = view(report({ status: 'Running', stage: 'Judging' }), { lostMessage: 'We lost touch with your check. It may still be running: reload this page to see where it got to.' })
    expect(html).toContain('We lost touch with your check')
    expect(html).toContain('Try again')
  })

  it('explains locked citations by the plan limit and links to the plans', () => {
    const html = view(report({
      fullCheckLimit: 1, summary: summary({ total: 3, checked: 1, supported: 1, locked: 2, integrityScore: 100 }),
      cards: [card({ id: 'a' }), card({ id: 'b', ordinal: 1, locked: true, verdict: null, resolutionState: 'Locked' }), card({ id: 'c', ordinal: 2, locked: true, verdict: null, resolutionState: 'Locked' })],
    }))
    expect(html).toContain('2 more citations found but not checked: your plan checks the first 1 in each run.')
    expect(html).toContain('See plans')
    expect(html).toContain('Locked')
  })

  it('says so when the size limit skipped citations', () => {
    expect(view(report({ limitReached: true }))).toContain('reached its size limit')
    expect(view(report())).not.toContain('reached its size limit')
  })

  it('warns about a check stuck waiting to start, but only after a while', () => {
    const queued = report({ status: 'Queued', stage: 'Queued', citationsDone: 0 })
    expect(view(queued, { queuedForMs: 10_000 })).not.toContain('taking longer than usual')
    expect(view(queued, { queuedForMs: 120_000 })).toContain('taking longer than usual')
  })

  it('passes the draft\'s own warnings through, and lists references that were never cited', () => {
    const html = view(report({ warnings: ['The draft mixes author-year and numeric citations; both were read.'], unusedReferences: ['Unused, U. (2001). Never cited.'] }))
    expect(html).toContain('mixes author-year and numeric citations')
    expect(html).toContain('1 reference in your list never cited in the text')
    expect(html).toContain('Unused, U. (2001). Never cited.')
  })

  it('offers filters with counts, hiding groups that are empty', () => {
    const html = view(report())
    expect(html).toContain('role="tablist"')
    expect(html).toContain('All')
    expect(html).toContain('Needs attention')
    expect(html).toContain('Supported')
    expect(html).not.toContain('Could not verify <span')   // no such cards, so no such tab
    expect(html).not.toMatch(/Locked <span/)
  })

  it('renders a draft with no citations without crashing', () => {
    const html = view(report({ citationCount: 0, cards: [], summary: summary() }))
    expect(html).toContain('No in-text citations were found in your draft.')
    expect(html).not.toContain('role="tablist"')
  })
})
