import { describe, expect, it } from 'vitest'
import { formatEssayInTextCitation } from './citationFormat'
import { orderEssayReferences } from './essayReferenceOrder'

// Defect group B, essay audit 2026-09-28: the Harvard reference list came out in retrieval order
// (the order sources happened to be numbered S1..Sn), not alphabetically as Harvard requires.
const refs = [
  { sourceId: 'S1', title: 'Skills or Degree?', authors: 'Bone, M., Stephany, F.', year: 2023 },
  { sourceId: 'S2', title: 'Overeducation among recruits', authors: 'Jackson, D.', year: 2020 },
  { sourceId: 'S3', title: 'Degree apprentices in Scotland', authors: 'Smith, S., Fabian, K., Zarb, A.', year: 2026 },
  { sourceId: 'S4', title: 'Community college premiums', authors: 'Corral, D.', year: 2025 },
  { sourceId: 'S5', title: 'An anonymous report', authors: null, year: 2024 },
]

describe('orderEssayReferences', () => {
  it('sorts author-date styles alphabetically by first author surname, author-less works by title', () => {
    const ordered = orderEssayReferences(refs, 'Harvard', '')
    expect(ordered.map(r => r.sourceId)).toEqual(['S5', 'S1', 'S4', 'S2', 'S3'])
  })

  it('orders numbered styles by first citation in the text', () => {
    const ordered = orderEssayReferences(refs, 'Ieee', 'A [S3] then [N:S1] and [S3] again, then [S2].')
    expect(ordered.map(r => r.sourceId).slice(0, 3)).toEqual(['S3', 'S1', 'S2'])
  })

  it('adds a/b year suffixes when two works share author and year', () => {
    const ordered = orderEssayReferences([
      { sourceId: 'S1', title: 'Zeta paper', authors: 'Jackson, D.', year: 2020 },
      { sourceId: 'S2', title: 'Alpha paper', authors: 'Jackson, D.', year: 2020 },
    ], 'Harvard', '')

    expect(ordered.map(r => [r.sourceId, r.yearLabel])).toEqual([['S2', '2020a'], ['S1', '2020b']])
    expect(formatEssayInTextCitation(ordered[0], 'Harvard', 0)).toBe('(Jackson, 2020a)')
  })

  it('leaves the year untouched when there is no collision', () => {
    const ordered = orderEssayReferences(refs, 'Harvard', '')
    expect(ordered.every(r => r.yearLabel == null)).toBe(true)
  })
})
