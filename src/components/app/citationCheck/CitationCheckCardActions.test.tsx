import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import type { CitationCard, CitationCheckReport, CitationVerdict } from '../../../types/citationCheck'
import { CitationCardView } from './CitationCheckCardView'
import { CitationCheckReportView } from './CitationCheckReportView'

const verdict = (v: string, o: Partial<CitationVerdict> = {}): CitationVerdict => ({
  verdict: v, failureType: 'None', confidence: 'High', evidenceLevel: 'FullText', claimText: 'A claim.', evidenceQuote: null,
  evidenceChunkId: null, reasoning: 'Because.', suggestedRewrite: null, quoteVerified: false, note: null, ...o,
})

const card = (o: Partial<CitationCard> = {}): CitationCard => ({
  id: 'c1', ordinal: 0, markerText: '(Smith, 2020)', markerOffset: 0, markerLength: 13, locked: false, resolutionState: 'Verified',
  resolutionNote: null, referenceEntry: null, flags: [], metadataDiffs: [], verdict: verdict('Supported'), ...o,
})

const html = (c: CitationCard, onAdd?: (c: CitationCard) => void) =>
  renderToStaticMarkup(<MemoryRouter><CitationCardView card={c} onAddReference={onAdd} /></MemoryRouter>)

const orphan = (o: Partial<CitationCard> = {}) => card({
  markerText: 'Venter and Dlamini (2024)', citedLabel: 'Venter and Dlamini (2024)', citedAuthors: 'Venter and Dlamini', citedYear: '2024',
  resolutionState: 'None', flags: ['OrphanCitation'], verdict: verdict('CannotVerify', { reasoning: 'No entry.', note: 'No entry.' }), ...o,
})

describe('View Source', () => {
  it('links to the source in a new tab, safely', () => {
    const out = html(card({ sourceUrl: 'https://doi.org/10.1016/j.lindif.2023.102274' }))
    expect(out).toContain('href="https://doi.org/10.1016/j.lindif.2023.102274"')
    expect(out).toContain('target="_blank"')
    expect(out).toContain('rel="noopener noreferrer"')
    expect(out).toContain('View Source')
  })

  it('sits in the card header, before the badges', () => {
    const out = html(card({ sourceUrl: 'https://doi.org/10.1/abcd.1234' }))
    expect(out.indexOf('View Source')).toBeGreaterThan(-1)
    expect(out.indexOf('View Source')).toBeLessThan(out.indexOf('Supported'))
  })

  it('shows no link when there is no resolved source', () => {
    for (const sourceUrl of [null, undefined, '']) expect(html(card({ sourceUrl }))).not.toContain('View Source')
  })

  it('never renders a link for anything but https, whatever the response contained', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'http://doi.org/10.1/x', '//evil.example', 'vbscript:x']) {
      const out = html(card({ sourceUrl: bad }))
      expect(out, bad).not.toContain('View Source')
      expect(out, bad).not.toContain('<a ')
      expect(out.toLowerCase(), bad).not.toContain('javascript:')
    }
  })

  it('escapes a hostile value even when it is a valid https URL', () => {
    const out = html(card({ sourceUrl: 'https://doi.org/10.1/x"><script>alert(1)</script>' }))
    expect(out).not.toContain('<script>')
  })

  it('is not offered on a locked card', () => {
    expect(html(card({ locked: true, sourceUrl: 'https://doi.org/10.1/abcd.1234', verdict: null, resolutionState: 'Locked' }))).not.toContain('View Source')
  })
})

describe('card title', () => {
  it('names the one work, so a two-work marker gives two distinguishable cards', () => {
    const a = html(card({ markerText: '(Smith & Lee, 2020; Jones, 2019)', citedLabel: 'Smith and Lee (2020)' }))
    const b = html(card({ markerText: '(Smith & Lee, 2020; Jones, 2019)', citedLabel: 'Jones (2019)' }))
    expect(a).toContain('Smith and Lee (2020)')
    expect(b).toContain('Jones (2019)')
    expect(a).not.toContain('(Smith &amp; Lee, 2020; Jones, 2019)')
  })

  it('falls back to the marker text when the server sent no label', () => {
    expect(html(card({ markerText: '(Smith, 2020)', citedLabel: null }))).toContain('(Smith, 2020)')
  })
})

describe('Missing reference', () => {
  it('shows an amber "Missing reference" badge instead of "Could not verify"', () => {
    const out = html(orphan())
    expect(out).toContain('Missing reference')
    expect(out).toContain('bg-amber-50')
    expect(out).not.toContain('Could not verify')
  })

  it('offers "+ Add entry to References" when the writer can act on it', () => {
    expect(html(orphan(), () => {})).toContain('Add entry to References')
  })

  it('explains in its tooltip that only one line is added and nothing else changes', () => {
    expect(html(orphan(), () => {})).toContain('Nothing else in your draft changes')
  })

  it('does not offer it without a handler, without a flag, without authors and year, or on a locked card', () => {
    expect(html(orphan())).not.toContain('Add entry to References')
    expect(html(card(), () => {})).not.toContain('Add entry to References')
    expect(html(orphan({ citedAuthors: null }), () => {})).not.toContain('Add entry to References')
    expect(html(orphan({ citedYear: null }), () => {})).not.toContain('Add entry to References')
    expect(html(orphan({ locked: true }), () => {})).not.toContain('Add entry to References')
  })

  it('does not offer it when the reference exists but could not be matched uniquely or the source was not found', () => {
    expect(html(orphan({ flags: ['AmbiguousReference'] }), () => {})).not.toContain('Add entry to References')
    expect(html(card({ flags: ['SourceNotFound'], citedAuthors: 'Smith', citedYear: '2020', verdict: verdict('CannotVerify') }), () => {})).not.toContain('Add entry to References')
  })

  it('also offers it when the whole draft has no reference list', () => {
    expect(html(orphan({ flags: ['NoReferenceList'] }), () => {})).toContain('Add entry to References')
  })

  it('puts the action in its own row at the bottom of the card, after everything else', () => {
    const out = html(orphan({ referenceEntry: 'some entry' }), () => {})
    expect(out.indexOf('Add entry to References')).toBeGreaterThan(out.indexOf('Reference entry'))
    expect(out).toContain('border-t')
  })
})

describe('a source that could not be found', () => {
  // A listed paper that no database has (here, an invented one) used to say it three times: "Could not verify", "Source not found", and the sentence.
  const notFound = () => html(card({
    flags: ['SourceNotFound'], resolutionState: 'NotFound',
    verdict: verdict('CannotVerify', { reasoning: 'Could not verify this source exists.', note: 'Could not verify this source exists.' }),
  }))

  it('says it once as the main badge and once in the sentence, with no third repetition', () => {
    const out = notFound()
    expect(out.split('Source not found').length - 1).toBe(1)                    // the badge, not also a chip
    expect(out.split('Could not verify this source exists').length - 1).toBe(1)  // the sentence, not also the resolution chip
    expect(out).not.toContain('>Could not verify<')                               // not also a generic verdict badge
  })

  it('uses the careful words, never "fake" or "fabricated"', () => {
    expect(notFound()).not.toMatch(/fake|fabricat|made.?up|invented/i)
  })

  it('offers no "Add entry to References": the entry is already there, the source is what was not found', () => {
    expect(html(card({ flags: ['SourceNotFound'], citedAuthors: 'Venter', citedYear: '2024', verdict: verdict('CannotVerify') }), () => {})).not.toContain('Add entry to References')
  })
})

describe('what a writer never sees', () => {
  const everything = () => {
    const cards = [
      card(), orphan(), orphan({ flags: ['NoReferenceList'] }),
      card({ flags: ['SourceNotFound'], verdict: verdict('CannotVerify', { reasoning: 'x', note: 'Could not verify this source exists.' }) }),
      card({ locked: true, verdict: null, resolutionState: 'Locked' }),
      card({ verdict: verdict('CannotVerify', { reasoning: 'The checker could not produce a reliable judgment for this citation this time. Running the check again may help.', note: 'The checker could not produce a reliable judgment for this citation this time. Running the check again may help.' }) }),
    ]
    const report: CitationCheckReport = {
      runId: 'r', status: 'Completed', stage: 'Done', citationCount: 6, citationsDone: 6, limitReached: false, fullCheckLimit: 5, error: null, warnings: [], unusedReferences: [],
      summary: { total: 6, checked: 1, supported: 1, partiallySupported: 0, notSupported: 0, contradicted: 0, cannotVerify: 4, locked: 1, integrityScore: 100, orphanCitations: 1, ambiguousCitations: 0, unusedReferences: 0, sourcesNotFound: 1, metadataMismatches: 0 },
      cards, createdAt: '', deleteAfter: '2026-12-01T00:00:00Z',
    }
    return renderToStaticMarkup(<MemoryRouter><CitationCheckReportView report={report} lostMessage={null} queuedForMs={0} onRetry={() => {}} onAddReference={() => {}} /></MemoryRouter>)
  }

  it('is never offered a "Truncate" button: a quote that is too long is the checker\'s problem and is handled for them', () => {
    // What a person can read, not the markup: Tailwind's own "truncate" CSS class is on some labels and is not a button.
    const visibleText = everything().replace(/<[^>]*>/g, ' ')
    expect(visibleText).not.toMatch(/truncate/i)
    expect(everything()).not.toMatch(/<button[^>]*>[^<]*truncat/i)
  })

  it('never sees internal field names or limits', () => {
    const out = everything()
    for (const internal of ['evidence_quote', 'evidence_chunk_id', 'failure_type', '300 characters', 'schema', 'JSON']) expect(out, internal).not.toContain(internal)
  })
})

// The request was for darker secondary text. This pins it: a light grey on a white card is what made the first version hard to read.
describe('text contrast', () => {
  const files = [
    './CitationCheckCardView.tsx', './CitationCheckReportView.tsx', '../../../pages/app/CitationCheckPage.tsx',
  ]
  const light = /\btext-(?:gray|slate|neutral|zinc|stone)-(?:50|100|200|300|400)\b|\btext-gray-500\b/

  for (const file of files) {
    it(`${file.split('/').pop()} uses no light-grey text classes`, () => {
      const source = readFileSync(new URL(file, import.meta.url), 'utf8')
      const offenders = source.split('\n').map((l, i) => ({ l, n: i + 1 })).filter(x => light.test(x.l) && !x.l.trimStart().startsWith('//'))
      expect(offenders.map(o => `${file}:${o.n}  ${o.l.trim().slice(0, 100)}`)).toEqual([])
    })
  }

  // The colours actually used for secondary and body text, against a white card, must clear WCAG AA (4.5:1) for small text.
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const contrast = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
  }

  it.each([
    ['slate-600 (captions)', '#475569'], ['slate-700 (secondary)', '#334155'], ['slate-800 (body)', '#1e293b'], ['slate-900 (titles)', '#0f172a'],
  ])('%s on white clears 4.5:1', (_name, hex) => expect(contrast(hex, '#ffffff')).toBeGreaterThanOrEqual(4.5))

  it('also clears it on the pale grey used behind quotes and suggested wordings (slate-50)', () => {
    expect(contrast('#475569', '#f8fafc')).toBeGreaterThanOrEqual(4.5)
  })
})
