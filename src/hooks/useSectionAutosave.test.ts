// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { MIN_SAVING_MS, SAVE_DEBOUNCE_MS, useSectionAutosave, type SaveFailure } from './useSectionAutosave'

function deferred() {
  let resolve!: () => void, reject!: (e: unknown) => void
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })

describe('useSectionAutosave', () => {
  it('saves once after typing stops, then shows Saved and keeps it', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useSectionAutosave({ save, onError: () => 'retry' }))
    act(() => { result.current.schedule('a'); result.current.schedule('ab') })
    expect(result.current.state).toBe('pending')
    await advance(SAVE_DEBOUNCE_MS - 1)
    expect(save).not.toHaveBeenCalled()
    await advance(1)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith('ab')
    expect(result.current.state).toBe('saving')
    await advance(MIN_SAVING_MS)
    expect(result.current.state).toBe('saved')
    await advance(60_000)
    expect(result.current.state).toBe('saved')
  })

  it('never has two saves in flight, and saves the newest text last', async () => {
    const first = deferred()
    const save = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined)
    const { result } = renderHook(() => useSectionAutosave({ save, onError: () => 'retry' }))
    act(() => result.current.schedule('one'))
    await advance(SAVE_DEBOUNCE_MS)
    act(() => { result.current.schedule('two'); result.current.schedule('three') })
    await advance(SAVE_DEBOUNCE_MS)
    expect(save).toHaveBeenCalledTimes(1)
    await act(async () => { first.resolve(); await Promise.resolve() })
    await advance(MIN_SAVING_MS)
    expect(save.mock.calls.map(c => c[0])).toEqual(['one', 'three'])
    expect(result.current.state).toBe('saved')
  })

  it('flush saves immediately and reports nothing left unsaved', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useSectionAutosave({ save, onError: () => 'retry' }))
    act(() => result.current.schedule('text'))
    expect(result.current.hasUnsaved()).toBe(true)
    await act(async () => { const done = result.current.flush(); await vi.advanceTimersByTimeAsync(MIN_SAVING_MS); await done })
    expect(save).toHaveBeenCalledWith('text')
    expect(result.current.hasUnsaved()).toBe(false)
  })

  it('keeps a failed edit for retry and reports it as unsaved', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined)
    const { result } = renderHook(() => useSectionAutosave({ save, onError: (): SaveFailure => 'retry' }))
    act(() => result.current.schedule('draft'))
    await advance(SAVE_DEBOUNCE_MS)
    expect(result.current.state).toBe('error')
    expect(result.current.hasUnsaved()).toBe(true)
    act(() => result.current.retry())
    await advance(MIN_SAVING_MS)
    expect(save.mock.calls.map(c => c[0])).toEqual(['draft', 'draft'])
    expect(result.current.state).toBe('saved')
  })

  it('drops an edit the server refuses outright', async () => {
    const onIdle = vi.fn()
    const save = vi.fn().mockRejectedValue({ code: 'SECTION_GENERATING' })
    const { result } = renderHook(() => useSectionAutosave({ save, onError: () => 'discard', onIdle }))
    act(() => result.current.schedule('late edit'))
    await advance(SAVE_DEBOUNCE_MS)
    expect(result.current.state).toBe('idle')
    expect(result.current.hasUnsaved()).toBe(false)
    expect(onIdle).toHaveBeenCalled()
  })

  it('sends pending text when the editor unmounts', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result, unmount } = renderHook(() => useSectionAutosave({ save, onError: () => 'retry' }))
    act(() => result.current.schedule('scrolled away'))
    unmount()
    await advance(0)
    expect(save).toHaveBeenCalledWith('scrolled away')
  })
})
