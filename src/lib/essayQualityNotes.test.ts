import { describe, expect, it } from 'vitest'
import { essayQualitySummary, isEssayQualityNote } from './essayQualityNotes'

const flag = (code: string, message = `${code} message`) => ({ code, section: 'Essay', message, citationSourceIds: [] })

describe('essayQualitySummary', () => {
  it('returns null when there are no quality notes', () => {
    expect(essayQualitySummary(undefined)).toBeNull()
    expect(essayQualitySummary([flag('EssayIncomplete'), flag('WeakEvidenceBase')])).toBeNull()
  })

  it('summarises notes by category with the first message in full', () => {
    const summary = essayQualitySummary([
      flag('EssayThesisMissing', 'The introduction does not state the essay\'s position.'),
      flag('EssayStockCloser'),
      flag('EssayContextQualifierMissing'),
      flag('ReferenceContainerMissing'),
      flag('WeakEvidenceBase'),
    ])
    expect(summary).toBe('Review notes (2 structure, 1 evidence fit, 1 references). First: The introduction does not state the essay\'s position.')
  })

  it('leaves other flags to their own toasts', () => {
    expect(isEssayQualityNote(flag('EssayUnsupportedConnectingClaim'))).toBe(true)
    expect(isEssayQualityNote(flag('EssayProcessLanguage'))).toBe(false)
  })
})
