import { describe, expect, it } from 'vitest'
import type { CitationFlag } from '../../types/research'
import { getActiveCitationFlags, getFlaggedSourceLabel } from './ReferencesDrawer'

function flag(status: CitationFlag['status'], overrides: Partial<CitationFlag> = {}): CitationFlag {
  return {
    id: `${status}-${Math.random()}`,
    sectionCode: '1.0',
    doi: '10.9999/source',
    citationRawText: '(Zidarić, 2016; Trimadona, 2026)',
    claimSentence: 'A claim with a grouped citation.',
    mismatchTypes: ['TemporallyImpossibleSource'],
    confidence: 100,
    status,
    createdAt: '2026-08-23T00:00:00Z',
    ...overrides,
  }
}

describe('ReferencesDrawer citation issues', () => {
  it('keeps only genuinely open flags in the active count and cards', () => {
    const open = flag('Open')
    expect(getActiveCitationFlags([
      open,
      flag('AutoCorrected'),
      flag('Dismissed'),
      flag('Removed'),
      flag('Superseded'),
    ])).toEqual([open])
  })

  it('attributes a grouped marker to its specifically resolved source', () => {
    const grouped = flag('Open', {
      literatureId: '11111111-1111-1111-1111-111111111111',
      sourceAuthors: 'Zidarić, M.',
      sourceTitle: 'Older writing study',
      sourceYear: 2016,
    })

    expect(getFlaggedSourceLabel(grouped)).toBe('Zidarić, M. (2016)')
    expect(grouped.citationRawText).toBe('(Zidarić, 2016; Trimadona, 2026)')
  })
})
