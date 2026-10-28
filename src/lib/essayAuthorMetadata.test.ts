import { describe, expect, it } from 'vitest'
import { formatEssayInTextCitation, formatEssayNarrativeCitation, formatEssayReferenceListEntry } from './citationFormat'
import { orderEssayReferences } from './essayReferenceOrder'

describe('canonical author metadata (synthetic fixtures)', () => {
  const reference = { title: 'Synthetic study', year: 2024, authors: 'TD', authorDetails: [
    { family: 'Smithies', given: 'TD' }, { family: 'de la Cruz', given: 'Ana' },
    { family: 'Wang', given: 'Li' }, { family: 'Dlamini', given: 'Z' },
  ] }
  it('renders family names rather than initials', () => {
    expect(formatEssayInTextCitation(reference, 'Apa7', 0)).toBe('(Smithies et al., 2024)')
    expect(formatEssayNarrativeCitation(reference, 'Harvard', 0)).toBe('Smithies et al. (2024)')
  })
  it('preserves all structured authors and their order in the bibliography', () => {
    expect(formatEssayReferenceListEntry(reference, 'Apa7', 0)).toContain('Smithies, T. D., de la Cruz, A., Wang, L., & Dlamini, Z.')
  })
  it('sorts by the same structured surname used in the citation', () => {
    const refs = orderEssayReferences([{ ...reference, sourceId: 'S1' }, { title: 'A', authors: 'Zulu Z.', year: 2024, sourceId: 'S2' }], 'Harvard', '[S1] [S2]')
    expect(refs[0].sourceId).toBe('S1')
  })
  it('handles the narrow legacy MEDLINE shape without losing a multiword family', () => {
    expect(formatEssayInTextCitation({ title: 'Synthetic', authors: 'Smithies TD', year: 2024 }, 'Harvard', 0)).toBe('(Smithies, 2024)')
    expect(formatEssayInTextCitation({ ...reference, authorDetails: [{ family: 'de la Cruz', given: 'Ana' }] }, 'Apa7', 0)).toBe('(de la Cruz, 2024)')
  })
  it('uses Chicago author-date grouping for three authors', () => {
    expect(formatEssayInTextCitation({ ...reference, authorDetails: reference.authorDetails.slice(0, 3) }, 'Chicago', 0)).toBe('(Smithies, de la Cruz, and Wang, 2024)')
  })
})
