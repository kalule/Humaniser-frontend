import { describe, expect, it } from 'vitest'
import type { CitationCard, CitationVerdict } from '../types/citationCheck'
import { chipFlags, needsReferenceEntry, primaryBadge } from './citationCheckActions'
import { flagMeta, needsAttention, resolutionBadge } from './citationCheckView'

const verdict = (v: string): CitationVerdict => ({
  verdict: v, failureType: 'None', confidence: 'High', evidenceLevel: 'FullText', claimText: 'c', evidenceQuote: null,
  evidenceChunkId: null, reasoning: 'r', suggestedRewrite: null, quoteVerified: false, note: null,
})

const mismatch = (o: Partial<CitationCard> = {}): CitationCard => ({
  id: 'c', ordinal: 0, markerText: 'Bender et al. (2019)', markerOffset: 0, markerLength: 20, locked: false, resolutionState: 'None',
  resolutionNote: null, referenceEntry: null, flags: ['YearMismatch'], metadataDiffs: [], verdict: verdict('CannotVerify'),
  citedLabel: 'Bender (2019)', citedAuthors: 'Bender', citedYear: '2019', ...o,
})

// "Bender et al. (2019)" cited, "Bender ... (2021)" listed: the writer asked "why is a real paper not found?" The answer must be on the card.
describe('a year that does not match the reference list', () => {
  it('is named as that, not as a missing reference', () => {
    const b = primaryBadge(mismatch())!
    expect(b.label).toBe("Year doesn't match")
    expect(b.label).not.toMatch(/missing/i)
    expect(b.tone).toBe('warning')
    expect(b.hint).toMatch(/different year/)
  })

  it('needs the writer\'s attention', () => {
    expect(needsAttention(mismatch())).toBe(true)
  })

  it('is not repeated as a second chip, and has no leftover resolution chip', () => {
    expect(chipFlags(mismatch())).toEqual([])
    expect(resolutionBadge(mismatch())).toBeNull()
  })

  it('is not offered "Add entry to References": the list already has the author, so the fix is the year', () => {
    expect(needsReferenceEntry(mismatch())).toBe(false)
  })

  it('has a label for the flag in its own right', () => {
    expect(flagMeta('YearMismatch').label).toBe('Year does not match your list')
  })
})
