import { describe, expect, it } from 'vitest'
import { parseWriteWithAiSseFrames } from './useWriteWithAiStream'
import type { WriteWithAiResponse } from '../types/workbench'

function stageFrame(stage: string): string {
  return `data: ${JSON.stringify({ stage })}\n\n`
}

function resultFrame(result: Partial<WriteWithAiResponse>): string {
  return `data: ${JSON.stringify({ result })}\n\n`
}

function errorFrame(error: string): string {
  return `data: ${JSON.stringify({ error })}\n\n`
}

const sampleResult: Partial<WriteWithAiResponse> = { title: 'Test Essay', content: 'Body text.', wordCount: 2 }

describe('parseWriteWithAiSseFrames', () => {
  it('extracts a single stage event delivered in one chunk', () => {
    const { events, remainder } = parseWriteWithAiSseFrames('', stageFrame('drafting'))
    expect(events).toEqual([{ stage: 'drafting' }])
    expect(remainder).toBe('')
  })

  it('extracts a sequence of stage events followed by a result event, in order', () => {
    const chunk = stageFrame('drafting') + stageFrame('verifying') + stageFrame('revising') +
      stageFrame('verifying') + resultFrame(sampleResult)
    const { events, remainder } = parseWriteWithAiSseFrames('', chunk)

    expect(events).toEqual([
      { stage: 'drafting' },
      { stage: 'verifying' },
      { stage: 'revising' },
      { stage: 'verifying' },
      { result: sampleResult },
    ])
    expect(remainder).toBe('')
  })

  it('parses an error event distinctly from a stage or result event', () => {
    const { events } = parseWriteWithAiSseFrames('', errorFrame('Generation is taking longer than expected. Please try again.'))
    expect(events).toEqual([{ error: 'Generation is taking longer than expected. Please try again.' }])
  })

  it('surfaces events incrementally across separate reads rather than only at the end', () => {
    let buffer = ''
    const seenAfterEachRead: unknown[][] = []

    for (const rawChunk of [stageFrame('drafting'), stageFrame('verifying'), resultFrame(sampleResult)]) {
      const { events, remainder } = parseWriteWithAiSseFrames(buffer, rawChunk)
      buffer = remainder
      seenAfterEachRead.push(events)
    }

    expect(seenAfterEachRead).toEqual([[{ stage: 'drafting' }], [{ stage: 'verifying' }], [{ result: sampleResult }]])
  })

  it('buffers a frame that straddles two chunks (blank-line separator arrives late)', () => {
    const whole = resultFrame(sampleResult)
    const splitPoint = Math.floor(whole.length / 2)
    const firstHalf = whole.slice(0, splitPoint)
    const secondHalf = whole.slice(splitPoint)

    const first = parseWriteWithAiSseFrames('', firstHalf)
    expect(first.events).toEqual([])
    expect(first.remainder).toBe(firstHalf)

    const second = parseWriteWithAiSseFrames(first.remainder, secondHalf)
    expect(second.events).toEqual([{ result: sampleResult }])
    expect(second.remainder).toBe('')
  })

  it('keeps a trailing partial frame in the remainder instead of dropping or misparsing it', () => {
    const chunk = stageFrame('drafting') + 'data: {"stage":"verif'
    const { events, remainder } = parseWriteWithAiSseFrames('', chunk)
    expect(events).toEqual([{ stage: 'drafting' }])
    expect(remainder).toBe('data: {"stage":"verif')
  })

  it('skips a malformed frame without throwing or losing subsequent valid frames', () => {
    const chunk = 'data: {not json}\n\n' + stageFrame('drafting')
    const { events } = parseWriteWithAiSseFrames('', chunk)
    expect(events).toEqual([{ stage: 'drafting' }])
  })

  it('ignores a frame whose JSON has none of stage/result/error', () => {
    const chunk = 'data: {"unrelated":true}\n\n' + stageFrame('drafting')
    const { events } = parseWriteWithAiSseFrames('', chunk)
    expect(events).toEqual([{ stage: 'drafting' }])
  })
})
