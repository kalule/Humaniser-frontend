import { describe, expect, it } from 'vitest'
import { checkingDraftEnded, isDraftPreview } from './essayDraftPreview'
import { parseWriteWithAiSseFrames } from '../hooks/useWriteWithAiStream'

describe('essay draft shown before checking finishes', () => {
  it('reads the draft frame separately from the final result', () => {
    const draft = { title: 'T', content: 'C', completionStatus: 'Checking' }
    const result = { title: 'T', content: 'C2', completionStatus: 'Complete' }
    const { events } = parseWriteWithAiSseFrames('', `data: {"stage":"drafting"}\n\ndata: ${JSON.stringify({ draft })}\n\ndata: {"stage":"checking-claims"}\n\ndata: ${JSON.stringify({ result })}\n\n`)
    expect(events.map(e => Object.keys(e)[0])).toEqual(['stage', 'draft', 'stage', 'result'])
    expect('draft' in events[1] && events[1].draft.content).toBe('C')
    expect('result' in events[3] && events[3].result.content).toBe('C2')
  })

  it('treats only a Checking result as a preview', () => {
    expect(isDraftPreview({ completionStatus: 'Checking' })).toBe(true)
    expect(isDraftPreview({ completionStatus: 'Complete' })).toBe(false)
    expect(isDraftPreview({ completionStatus: 'Incomplete' })).toBe(false)
    expect(isDraftPreview({})).toBe(false)
  })

  it('unlocks a draft only when the run stopped while it was still being checked', () => {
    expect(checkingDraftEnded(true, false)).toBe(true)
    expect(checkingDraftEnded(true, true)).toBe(false)
    expect(checkingDraftEnded(false, false)).toBe(false)
  })
})

describe('sources shown while the essay is prepared', () => {
  it('reads the sources frame', () => {
    const sources = [{ sourceId: 'S1', title: 'A study', firstAuthor: 'Smith', year: 2024 }]
    const { events } = parseWriteWithAiSseFrames('', `data: ${JSON.stringify({ sources })}\n\n`)
    expect(events).toEqual([{ sources }])
  })
})

describe('collecting an essay after a reload', () => {
  it('returns the cached early draft with a pending outcome', async () => {
    const { interpretOutcome } = await import('./literatureReviewRecovery')
    const draft = { title: 'T', content: 'C', completionStatus: 'Checking' }
    const out = interpretOutcome({ status: 'pending', stage: 'checking-claims', draftFrame: JSON.stringify({ draft }) })
    expect(out).toMatchObject({ status: 'pending', stage: 'checking-claims', draft: { content: 'C', completionStatus: 'Checking' } })
    expect(interpretOutcome({ status: 'pending', stage: 'drafting', draftFrame: null })).toEqual({ status: 'pending', stage: 'drafting' })
  })
})
