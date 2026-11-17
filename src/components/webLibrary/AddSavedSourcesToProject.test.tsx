import { describe, expect, it } from 'vitest'
import { savedSourceImportSummary } from './AddSavedSourcesToProject'

const result = (patch: Partial<Parameters<typeof savedSourceImportSummary>[0]> = {}) =>
  ({ added: 0, included: 0, alreadyIncluded: 0, withoutAbstract: [], notFound: 0, ...patch })

describe('savedSourceImportSummary', () => {
  it('reports every outcome the server returned', () => {
    expect(savedSourceImportSummary(result({ added: 3, included: 1, alreadyIncluded: 2, withoutAbstract: ['A'], notFound: 1 })))
      .toBe('Saved sources: 3 added, 1 already in the project, now included, 2 already included, 1 left out (no abstract), 1 no longer in your library.')
  })

  it('says plainly when nothing changed', () => {
    expect(savedSourceImportSummary(result())).toBe('Nothing was added.')
    expect(savedSourceImportSummary(result({ alreadyIncluded: 2 }))).toBe('Saved sources: 2 already included.')
  })
})
