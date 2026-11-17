import { describe, expect, it } from 'vitest'
import type { CitationCard, CitationVerdict } from '../types/citationCheck'
import { cardTitle, chipFlags, insertReference, needsReferenceEntry, primaryBadge, referenceStub, safeExternalUrl } from './citationCheckActions'

const verdict = (v: string): CitationVerdict => ({
  verdict: v, failureType: 'None', confidence: 'High', evidenceLevel: 'FullText', claimText: 'c', evidenceQuote: null,
  evidenceChunkId: null, reasoning: 'r', suggestedRewrite: null, quoteVerified: false, note: null,
})

const card = (o: Partial<CitationCard> = {}): CitationCard => ({
  id: 'c', ordinal: 0, markerText: '(Smith, 2020)', markerOffset: 0, markerLength: 13, locked: false, resolutionState: 'Verified',
  resolutionNote: null, referenceEntry: null, flags: [], metadataDiffs: [], verdict: verdict('Supported'), ...o,
})

describe('safeExternalUrl', () => {
  it('passes an https link through', () => {
    expect(safeExternalUrl('https://doi.org/10.1016/j.lindif.2023.102274')).toBe('https://doi.org/10.1016/j.lindif.2023.102274')
    expect(safeExternalUrl('https://openalex.org/W2741809807')).toBe('https://openalex.org/W2741809807')
  })

  it('never turns anything but https into a link', () => {
    for (const bad of [
      'javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'vbscript:msgbox(1)',
      'http://doi.org/10.1/x', 'ftp://example.org/x', 'file:///etc/passwd', '//evil.example/x', '/relative/path', 'doi.org/10.1/x', 'not a url', '',
    ]) expect(safeExternalUrl(bad), bad).toBeNull()
  })

  it('treats missing values as no link', () => {
    expect(safeExternalUrl(null)).toBeNull()
    expect(safeExternalUrl(undefined)).toBeNull()
  })
})

describe('cardTitle', () => {
  it('names the one work the card is about, so a two-work marker does not title both cards the same', () => {
    expect(cardTitle({ citedLabel: 'Smith and Lee (2020)', markerText: '(Smith & Lee, 2020; Jones, 2019)' })).toBe('Smith and Lee (2020)')
    expect(cardTitle({ citedLabel: 'Jones (2019)', markerText: '(Smith & Lee, 2020; Jones, 2019)' })).toBe('Jones (2019)')
  })

  it('falls back to the marker text when the server sent no label', () => {
    expect(cardTitle({ markerText: '(Smith, 2020)' })).toBe('(Smith, 2020)')
    expect(cardTitle({ citedLabel: null, markerText: '(Smith, 2020)' })).toBe('(Smith, 2020)')
    expect(cardTitle({ citedLabel: '   ', markerText: '(Smith, 2020)' })).toBe('(Smith, 2020)')
  })
})

describe('primaryBadge', () => {
  it('says "Missing reference" when the citation has no entry in the list, instead of the vaguer "Could not verify"', () => {
    const b = primaryBadge(card({ flags: ['OrphanCitation'], verdict: verdict('CannotVerify') }))!
    expect(b).toMatchObject({ label: 'Missing reference', tone: 'warning' })
  })

  it('says there is no reference list at all when that is the problem', () => {
    expect(primaryBadge(card({ flags: ['NoReferenceList'], verdict: verdict('CannotVerify') }))!.label).toBe('No reference list')
  })

  it('names an ambiguous match', () => {
    expect(primaryBadge(card({ flags: ['AmbiguousReference'], verdict: verdict('CannotVerify') }))!.label).toBe('Ambiguous reference')
  })

  it('lets the verdict speak for everything else', () => {
    expect(primaryBadge(card({ verdict: verdict('Supported') }))!.label).toBe('Supported')
    expect(primaryBadge(card({ flags: ['MetadataMismatch'], verdict: verdict('NotSupported') }))!.label).toBe('Not supported')
  })

  it('says "Source not found" once, as the main badge, in the careful words: we could not find it, not that it does not exist', () => {
    const b = primaryBadge(card({ flags: ['SourceNotFound'], verdict: verdict('CannotVerify') }))!
    expect(b).toMatchObject({ label: 'Source not found', tone: 'warning' })
    expect(b.hint).toMatch(/may still exist/)
    expect(`${b.label} ${b.hint}`).not.toMatch(/fake|fabricat|made.?up|invented/i)
  })

  it('is null for a citation still being checked, so the card can show "Checking…"', () => {
    expect(primaryBadge(card({ verdict: null }))).toBeNull()
  })

  it('reports a reference problem even before a verdict exists', () => {
    expect(primaryBadge(card({ verdict: null, flags: ['OrphanCitation'] }))!.label).toBe('Missing reference')
  })
})

describe('chipFlags and needsReferenceEntry', () => {
  it('leaves out the flags the main badge already states, and keeps the rest', () => {
    expect(chipFlags({ flags: ['OrphanCitation'] })).toEqual([])
    expect(chipFlags({ flags: ['NoReferenceList'] })).toEqual([])
    expect(chipFlags({ flags: ['AmbiguousReference'] })).toEqual([])
    expect(chipFlags({ flags: ['YearMismatch'] })).toEqual([])
    expect(chipFlags({ flags: ['SourceNotFound'] })).toEqual([])
    expect(chipFlags({ flags: ['SourceNotFound', 'MetadataMismatch'] })).toEqual(['MetadataMismatch'])
  })

  it('offers a reference line only where one would fix the problem', () => {
    expect(needsReferenceEntry(card({ flags: ['OrphanCitation'] }))).toBe(true)
    expect(needsReferenceEntry(card({ flags: ['NoReferenceList'] }))).toBe(true)
    expect(needsReferenceEntry(card({ flags: ['AmbiguousReference'] }))).toBe(false)   // an entry exists; the fix is a year letter, not a new line
    expect(needsReferenceEntry(card({ flags: ['SourceNotFound'] }))).toBe(false)       // the entry exists; it is the source we could not find
    expect(needsReferenceEntry(card({ flags: [] }))).toBe(false)
  })

  it('never offers it on a locked card', () => {
    expect(needsReferenceEntry(card({ locked: true, flags: ['OrphanCitation'] }))).toBe(false)
  })
})

describe('referenceStub', () => {
  it('builds a line shaped "names. (year)." with clearly bracketed gaps', () => {
    expect(referenceStub({ citedAuthors: 'Venter and Dlamini', citedYear: '2024' })).toBe('Venter and Dlamini. (2024). [Title of the work]. [Journal or publisher].')
    expect(referenceStub({ citedAuthors: 'Hartmann', citedYear: '2025' })).toBe('Hartmann. (2025). [Title of the work]. [Journal or publisher].')
    expect(referenceStub({ citedAuthors: 'Smith', citedYear: '2020a' })).toBe('Smith. (2020a). [Title of the work]. [Journal or publisher].')
    expect(referenceStub({ citedAuthors: 'Anon', citedYear: 'n.d.' })).toBe('Anon. (n.d.). [Title of the work]. [Journal or publisher].')
  })

  it('cannot build one without both the authors and the year (a numeric citation has neither)', () => {
    expect(referenceStub({ citedAuthors: null, citedYear: '2024' })).toBeNull()
    expect(referenceStub({ citedAuthors: 'Smith', citedYear: null })).toBeNull()
    expect(referenceStub({ citedAuthors: '  ', citedYear: '2024' })).toBeNull()
    expect(referenceStub({})).toBeNull()
  })
})

describe('insertReference', () => {
  const stub = 'Venter and Dlamini. (2024). [Title of the work]. [Journal or publisher].'

  it('adds the line at the end of an existing list whose entries are on consecutive lines, with one line break', () => {
    const draft = 'Body (Smith, 2020).\n\nReferences\n\nSmith, J. (2020). Title. Journal.\nLee, K. (2019). Title. Journal.\n'
    expect(insertReference(draft, stub)).toBe('Body (Smith, 2020).\n\nReferences\n\nSmith, J. (2020). Title. Journal.\nLee, K. (2019). Title. Journal.\n' + stub + '\n')
  })

  it('copies a blank-line-separated list with a blank line, because mixing the two would change how the list is split', () => {
    const draft = 'Body.\n\nReferences\n\nSmith, J. (2020). Title. Journal.\n\nLee, K. (2019). Title. Journal.\n'
    expect(insertReference(draft, stub)).toBe('Body.\n\nReferences\n\nSmith, J. (2020). Title. Journal.\n\nLee, K. (2019). Title. Journal.\n\n' + stub + '\n')
  })

  it('puts the first entry under an empty heading with a blank line', () => {
    expect(insertReference('Body text here.\n\nReferences\n', stub)).toBe('Body text here.\n\nReferences\n\n' + stub + '\n')
  })

  it('creates a References section when the draft has none', () => {
    expect(insertReference('Body text here (Venter and Dlamini, 2024).', stub)).toBe('Body text here (Venter and Dlamini, 2024).\n\nReferences\n\n' + stub + '\n')
  })

  it('recognises the heading variants a writer might use', () => {
    for (const heading of ['Bibliography', 'Works Cited', 'REFERENCES', '## References', '**References**', '7. References', 'References:', 'Reference List']) {
      const out = insertReference(`Body.\n\n${heading}\n\nSmith, J. (2020). Title.\n`, stub)
      expect(out, heading).toBe(`Body.\n\n${heading}\n\nSmith, J. (2020). Title.\n\n${stub}\n`)
      expect((out.match(/References|Bibliography|Works Cited|Reference List/gi) ?? []).length, heading).toBe(1)   // no second heading invented
    }
  })

  it('uses the LAST heading, not an earlier mention of the word', () => {
    const draft = 'References are discussed below.\n\nReferences\n\nSmith, J. (2020). Title.\n'
    expect(insertReference(draft, stub).endsWith('Smith, J. (2020). Title.\n\n' + stub + '\n')).toBe(true)
  })

  it('adding the same line twice changes nothing', () => {
    const once = insertReference('Body.\n\nReferences\n\nSmith, J. (2020). Title.\n', stub)
    expect(insertReference(once, stub)).toBe(once)
  })

  it('keeps Windows line endings', () => {
    const out = insertReference('Body.\r\n\r\nReferences\r\n\r\nSmith, J. (2020). Title.\r\n', stub)
    expect(out).toBe('Body.\r\n\r\nReferences\r\n\r\nSmith, J. (2020). Title.\r\n\r\n' + stub + '\r\n')
    expect(out.replace(/\r\n/g, '')).not.toContain('\n')
  })

  it('does not stack up trailing blank lines', () => {
    const out = insertReference('Body.\n\nReferences\n\nSmith, J. (2020). Title.\n\n\n\n', stub)
    expect(out).not.toMatch(/\n\n\n/)
  })

  it('never touches anything above the end of the draft', () => {
    const draft = 'First paragraph (Smith, 2020).\n\nSecond paragraph.\n\nReferences\n\nSmith, J. (2020). Title.\n'
    expect(insertReference(draft, stub).startsWith(draft.trimEnd())).toBe(true)
  })
})
