// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, waitFor } from '@testing-library/react'

const { useResearchStore } = await import('../../../store/researchStore')
const { SectionEditor } = await import('./SectionEditor')

beforeAll(() => {
  const rect = { x: 0, y: 0, top: 0, left: 0, bottom: 10, right: 10, width: 10, height: 10, toJSON: () => ({}) }
  Range.prototype.getBoundingClientRect = () => rect as DOMRect
  Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList
  document.elementFromPoint = () => null
})

const saveSection = vi.fn().mockResolvedValue(undefined)
afterEach(() => { cleanup(); vi.clearAllMocks() })

const TABLE = [
  'This study is anchored by a lens (Debnath, 2026).',
  '',
  '| Construct | Role | Theory element | Research question(s) |',
  '|---|---|---|---|',
  '| Leadership Styles | Explanatory | The consistent patterns (Awaale, 2024). | Not yet defined |',
  '| Perceived Employee Productivity | Outcome | Assessments (Sukmawati, 2017). | Not yet defined |',
  '',
  'Closing paragraph.',
].join('\n')

function view(content: string, editable: boolean) {
  return (
    <SectionEditor projectId="p" code="3.3" content={content} editable={editable} label="3.3 Conceptual Framework"
      onDemoted={() => {}} registerFlush={() => {}} />
  )
}

describe('a section with a table is not saved just by showing it', () => {
  it('mount, new text from the run, then editable', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      act(() => { useResearchStore.setState({ sections: { p: [] }, saveSection }) })
      const { rerender, container } = render(view('Draft text.', false))
      await waitFor(() => expect(container.querySelector('.ProseMirror')).not.toBeNull())
      rerender(view(TABLE, false))
      rerender(view(TABLE, true))
      await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
      expect(saveSection).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  // Live 2026-11-28 (3.3): an empty paragraph added below the table saved three blank lines.
  it('an empty paragraph added below the table is not saved; a real edit is', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      act(() => { useResearchStore.setState({ sections: { p: [] }, saveSection }) })
      const { container } = render(view(TABLE.replace('\n\nClosing paragraph.', ''), true))
      await waitFor(() => expect(container.querySelector('table')).not.toBeNull())
      const editor = (container.querySelector('.ProseMirror') as unknown as { editor: { commands: { insertContentAt: (pos: number, c: unknown) => boolean }; state: { doc: { content: { size: number } } } } }).editor
      act(() => { editor.commands.insertContentAt(editor.state.doc.content.size, { type: 'paragraph' }) })
      await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
      expect(saveSection).not.toHaveBeenCalled()

      act(() => { editor.commands.insertContentAt(editor.state.doc.content.size - 1, 'New words.') })
      await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
      expect(saveSection).toHaveBeenCalledWith('p', '3.3', expect.stringContaining('New words.'))
    } finally {
      vi.useRealTimers()
    }
  })

  it('mounted straight on a table', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      act(() => { useResearchStore.setState({ sections: { p: [] }, saveSection }) })
      const { container } = render(view(TABLE, true))
      await waitFor(() => expect(container.querySelector('table')).not.toBeNull())
      await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
      expect(saveSection).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})
