import { describe, expect, it } from 'vitest'
import {
  extractSurnamesFromAuthors,
  formatEssayInTextCitation,
  formatEssayNarrativeCitation,
  formatEssayReferenceListEntry,
  groupConsecutiveAuthorDateCitations,
  formatInTextCitation,
  parseBibliographyEntries,
  type ParsedReference,
} from './citationFormat'

describe('groupConsecutiveAuthorDateCitations', () => {
  it('groups consecutive Harvard citations deterministically', () => {
    expect(groupConsecutiveAuthorDateCitations('(Chan & Hu, 2023)(Lo, 2023)(Fan et al., 2024)'))
      .toBe('(Chan & Hu, 2023; Lo, 2023; Fan et al., 2024)')
  })

  it('does not merge ordinary parenthetical prose', () => {
    expect(groupConsecutiveAuthorDateCitations('(important)(but uncertain)')).toBe('(important)(but uncertain)')
  })
})

describe('same-year citation suffixes', () => {
  it('preserves a bibliography year suffix when inserting an in-text citation', () => {
    const [reference] = parseBibliographyEntries("1. Smith, J. (2021a). A study. Journal.")
    expect(reference.year).toBe('2021a')
    expect(formatInTextCitation(reference, 'apa7', 0)).toBe('(Smith, 2021a)')
  })
})

// Regression coverage for the surname-extraction bug confirmed live in a generated essay:
// extractSurname's old "longest token wins" heuristic misread the given name as the surname
// whenever it was longer than the actual surname — "Rahul Rao" -> "(Rahul, 2020)", "Philipp A.
// Trotter" -> "(Philipp, 2016)", "Joanne Sharp" -> "(Joanne, 2013)". Multi-author sources only
// looked correct by coincidence (the real surname happened to be the longer token in those
// specific names), not because they went through a different or safer path.
describe('extractSurnamesFromAuthors — single-author "Given Surname" order', () => {
  it('extracts the surname from a two-word name, not the longer given name', () => {
    expect(extractSurnamesFromAuthors('Rahul Rao')).toEqual(['Rao'])
  })

  it('extracts the surname from a three-word name with a middle initial', () => {
    expect(extractSurnamesFromAuthors('Philipp A. Trotter')).toEqual(['Trotter'])
  })

  it('extracts the surname even when the given name is longer than the surname', () => {
    expect(extractSurnamesFromAuthors('Joanne Sharp')).toEqual(['Sharp'])
  })

  it('keeps a comma-form surname and initials as one author', () => {
    expect(extractSurnamesFromAuthors('Smith, J.')).toEqual(['Smith'])
  })

  it('keeps each comma-form author intact in a multi-author byline', () => {
    expect(extractSurnamesFromAuthors('Smith, J., Jones, A., & Patel, R.'))
      .toEqual(['Smith', 'Jones', 'Patel'])
  })

  it('still handles a bare single-word name (unaffected by this fix)', () => {
    expect(extractSurnamesFromAuthors('Smith')).toEqual(['Smith'])
  })
})

describe('essay citation quality regression', () => {
  it('renders a grammatical narrative citation', () => {
    expect(formatEssayNarrativeCitation({ title: 'A Study', authors: 'Jane Smith', year: 2023 }, 'Harvard', 0))
      .toBe('Smith (2023)')
  })

  // Regression coverage for the title-as-author bug confirmed live: a no-author source's
  // narrative citation rendered as the bare unquoted title glued onto the following sentence
  // ("The Red Sea from Byzantium to the Caliphate: AD 500-1000 (2013) The economic stimulus...")
  // — indistinguishable from a real author name in running prose.
  it('quotes and truncates a long no-author title instead of dumping it bare', () => {
    expect(formatEssayNarrativeCitation(
      { title: 'The Red Sea from Byzantium to the Caliphate: AD 500-1000', year: 2013 }, 'Harvard', 0,
    )).toBe('"The Red Sea from Byzantium to the Caliph…" (2013)')
  })

  it('quotes a short no-author title in full, without truncation', () => {
    expect(formatEssayNarrativeCitation({ title: 'Anonymous Evidence', year: 2024 }, 'Harvard', 0))
      .toBe('"Anonymous Evidence" (2024)')
  })

  it('prefers DOI over a temporary PDF URL and renders article metadata', () => {
    const rendered = formatEssayReferenceListEntry({
      title: 'A Study', authors: 'Jane Smith', year: 2023, venue: 'Journal of Education',
      volume: '12', issue: '2', pages: '10-20', doi: 'https://doi.org/10.1234/study',
      url: 'https://provider.example/pdfft?token=temporary',
    }, 'Harvard', 0)
    expect(rendered).toContain('Journal of Education, 12(2), pp. 10-20')
    expect(rendered).toContain('doi:10.1234/study')
    expect(rendered).not.toContain('pdfft')
  })

  it('keeps missing authors explicitly incomplete', () => {
    expect(formatEssayReferenceListEntry({ title: 'Anonymous Evidence', year: 2024 }, 'Harvard', 0))
      .toContain('author not available')
  })
})

// Regression coverage for a live UNMATCHED-citation incident: a project's own literature stored
// a source's Authors as "Sadeghi D." (surname-first, no comma) — the old "no comma → assume
// Given [Middle] Surname order, take the last word" heuristic extracted "D" as the surname
// instead of "Sadeghi", so the in-editor citation popover showed "(Sadeghi, 2026)" as UNMATCHED
// even though the source genuinely exists (confirmed live via a direct DB query). This is a
// separate reimplementation from the backend's ExtractSurname/IsInitialToken (ResearchService.cs)
// — this file needed its own copy of the initial-token filter.
describe('extractSurnamesFromAuthors — surname-first, no comma (trailing initial misread as surname)', () => {
  it('extracts the surname, not the trailing initial, from "Surname Initial." format', () => {
    expect(extractSurnamesFromAuthors('Sadeghi D.')).toEqual(['Sadeghi'])
  })

  it('still extracts the correct surname in "Given Middle. Surname" order (unaffected by this fix)', () => {
    expect(extractSurnamesFromAuthors('Frank B. Hu')).toEqual(['Hu'])
  })
})

// Regression coverage for item #53 (docs/OPEN_ITEMS.md), ported to this file: OpenAlex-sourced
// author metadata can carry a Unicode hyphen variant (e.g. "Shira Zelber‐Sagi" using U+2010
// HYPHEN) in a hyphenated surname, while a drafting model naturally writes a plain ASCII hyphen
// when citing it in prose ("(Zelber-Sagi, 2011)") — visually identical, two different
// characters, so the match silently failed and a genuinely-existing source showed as UNMATCHED.
// The backend fix (ResearchService.UnicodeHyphenVariants) only touched the C# resolver; this
// file is a separate, independent reimplementation for the in-editor citation-click popover and
// needed its own copy of the same normalization.
describe('extractSurnamesFromAuthors — Unicode hyphen normalization', () => {
  it('normalizes a Unicode hyphen variant in a hyphenated surname to the plain ASCII form', () => {
    expect(extractSurnamesFromAuthors('Shira Zelber‐Sagi')).toEqual(['Zelber-Sagi'])
  })
})

describe('extractSurnamesFromAuthors — multi-author', () => {
  it('extracts each surname in order from a real multi-author byline', () => {
    expect(extractSurnamesFromAuthors('Vibeke Bjornlund, Henning Bjørnlund, André van Rooyen'))
      .toEqual(['Bjornlund', 'Bjørnlund', 'Rooyen'])
  })
})

describe('formatEssayInTextCitation — the Write With AI essay path', () => {
  const meta = (authors: string, year: number) => ({ title: 'A Study', authors, year })

  it('renders a single-author in-text citation with the surname, not the given name', () => {
    expect(formatEssayInTextCitation(meta('Rahul Rao', 2020), 'Harvard', 0)).toBe('(Rao, 2020)')
    expect(formatEssayInTextCitation(meta('Philipp A. Trotter', 2016), 'Harvard', 0)).toBe('(Trotter, 2016)')
    expect(formatEssayInTextCitation(meta('Joanne Sharp', 2013), 'Harvard', 0)).toBe('(Sharp, 2013)')
  })

  it('renders a multi-author in-text citation as "First et al."', () => {
    expect(formatEssayInTextCitation(
      meta('Vibeke Bjornlund, Henning Bjørnlund, André van Rooyen', 2022), 'Harvard', 0,
    )).toBe('(Bjornlund et al., 2022)')
  })
})

describe('formatInTextCitation — the Proposal Studio compiled-bibliography path', () => {
  const ref = (raw: string): ParsedReference =>
    parseBibliographyEntries(`1. ${raw}`)[0]

  it('renders a single-author reference with the surname, not the given name', () => {
    expect(formatInTextCitation(ref("Rahul Rao (2020) 'A Study'."), 'harvard', 0))
      .toBe('(Rao, 2020)')
  })

  it('renders a multi-author reference as "First et al."', () => {
    expect(formatInTextCitation(
      ref("Vibeke Bjornlund, Henning Bjørnlund, André van Rooyen (2022) 'A Study'."), 'harvard', 0,
    )).toBe('(Bjornlund et al., 2022)')
  })
})
