import { describe, expect, it } from 'vitest'
import { parseSseFrames } from './useSectionDraftStream'

function frame(delta: string): string {
  return `data: ${JSON.stringify({ delta })}\n\n`
}

describe('parseSseFrames', () => {
  it('extracts a single complete frame delivered in one chunk', () => {
    const { deltas, remainder } = parseSseFrames('', frame('Hello '))
    expect(deltas).toEqual(['Hello '])
    expect(remainder).toBe('')
  })

  it('extracts multiple frames delivered in one chunk, in order', () => {
    const chunk = frame('Alpha ') + frame('Beta ') + frame('Gamma')
    const { deltas, remainder } = parseSseFrames('', chunk)
    expect(deltas).toEqual(['Alpha ', 'Beta ', 'Gamma'])
    expect(remainder).toBe('')
  })

  it('renders text incrementally across separate reads rather than only at the end', () => {
    // Simulates three separate ReadableStream reads, exactly as they'd arrive over the wire —
    // this is the behavior the whole feature exists for: the caller sees each delta as its own
    // read resolves, not one giant blob after the connection closes.
    let buffer = ''
    const seenAfterEachRead: string[][] = []

    for (const rawChunk of [frame('First. '), frame('Second. '), frame('Third.')]) {
      const { deltas, remainder } = parseSseFrames(buffer, rawChunk)
      buffer = remainder
      seenAfterEachRead.push(deltas)
    }

    expect(seenAfterEachRead).toEqual([['First. '], ['Second. '], ['Third.']])
  })

  it('buffers a frame that straddles two chunks (blank-line separator arrives late)', () => {
    const whole = frame('Split across chunks.')
    const splitPoint = Math.floor(whole.length / 2)
    const firstHalf = whole.slice(0, splitPoint)
    const secondHalf = whole.slice(splitPoint)

    const first = parseSseFrames('', firstHalf)
    // The frame isn't complete yet — nothing to emit, everything carries into the next read.
    expect(first.deltas).toEqual([])
    expect(first.remainder).toBe(firstHalf)

    const second = parseSseFrames(first.remainder, secondHalf)
    expect(second.deltas).toEqual(['Split across chunks.'])
    expect(second.remainder).toBe('')
  })

  it('keeps a trailing partial frame in the remainder instead of dropping or misparsing it', () => {
    const chunk = frame('Complete one. ') + 'data: {"delta":"incomple'
    const { deltas, remainder } = parseSseFrames('', chunk)
    expect(deltas).toEqual(['Complete one. '])
    expect(remainder).toBe('data: {"delta":"incomple')
  })

  it('skips a malformed frame without throwing or losing subsequent valid frames', () => {
    const chunk = 'data: {not json}\n\n' + frame('Still works.')
    const { deltas } = parseSseFrames('', chunk)
    expect(deltas).toEqual(['Still works.'])
  })
})
