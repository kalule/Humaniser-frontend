import { describe, expect, it } from 'vitest'
import type { WriteWithAiResponse } from '../types/workbench'
import { assertWritableDraft } from './writeWithAiOutcome'

const empty = (extra: Partial<WriteWithAiResponse> = {}): WriteWithAiResponse => ({
  isEssay: true, title: 'Essay', content: '', references: [], wordCount: 0, ...extra,
})

describe('assertWritableDraft', () => {
  it('preserves the server explanation when format repair returns no draft', () => {
    const reason = 'The bounded draft-format repair could not produce a citation-consistent draft.'
    expect(() => assertWritableDraft(empty({ completionStatus: 'Incomplete', completionReason: reason }))).toThrow(reason)
  })

  it('uses the incomplete flag when the reason is missing', () => {
    expect(() => assertWritableDraft(empty({ essayFlags: [
      { code: 'EssayIncomplete', section: 'Essay', message: 'Evidence checking could not finish.', citationSourceIds: [] },
    ] }))).toThrow('Evidence checking could not finish.')
  })

  it('rejects empty results even when the server labels them complete', () => {
    expect(() => assertWritableDraft(empty({ completionStatus: 'Complete', content: '  ',
      sections: { introduction: '', mainBody: ' ', conclusion: '' } }))).toThrow('No draft was returned.')
  })

  it('allows available incomplete drafts to reach the editor', () => {
    expect(() => assertWritableDraft(empty({ completionStatus: 'Incomplete', content: 'Available draft' }))).not.toThrow()
  })
})
