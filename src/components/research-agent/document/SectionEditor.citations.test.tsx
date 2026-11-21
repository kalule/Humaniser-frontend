// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { CitationFlag, FetchedLiterature } from '../../../types/research'

const { useResearchStore } = await import('../../../store/researchStore')
const { SectionEditor } = await import('./SectionEditor')
const { CitationDataContext } = await import('./citationDataContext')

beforeAll(() => {
  // jsdom has no layout; ProseMirror asks for rects when placing the caret.
  const rect = { x: 0, y: 0, top: 0, left: 0, bottom: 10, right: 10, width: 10, height: 10, toJSON: () => ({}) }
  Range.prototype.getBoundingClientRect = () => rect as DOMRect
  Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList
  document.elementFromPoint = () => null
})

function lit(id: string, authors: string, year: number, extra: Partial<FetchedLiterature> = {}): FetchedLiterature {
  return { id, title: `Title ${id}`, authors, year, doi: `10.1/${id}`, harvardCitation: '', apaCitation: '', source: 'OpenAlex',
    includedByStudent: true, citationCount: 0, citedInSections: [], ...extra }
}
const klishi = lit('klishi', 'Lindiwe Klishi', 2024, { hasFullText: true })
const nkohla = lit('nkohla', 'Thabo Nkohla', 2023)
const partly: CitationFlag = { id: 'f1', sectionCode: '1.0', doi: '10.1/klishi', citationRawText: '(Klishi, 2024)', claimSentence: '',
  mismatchTypes: ['ClaimPartialMatch'], confidence: 0.7, status: 'Open', createdAt: '' }

const saveSection = vi.fn().mockResolvedValue(undefined)

function renderEditor(content: string, editable = true) {
  act(() => { useResearchStore.setState({ sections: { p: [] }, saveSection }) })
  return render(
    <CitationDataContext.Provider value={{ style: 'harvard', literature: [klishi, nkohla], bibliography: [], flags: [partly] }}>
      <SectionEditor projectId="p" code="1.0" content={content} editable={editable} label="1.0 Introduction"
        onDemoted={() => {}} registerFlush={() => {}} />
    </CitationDataContext.Provider>,
  )
}

afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('inline citations in the Document editor', () => {
  it('marks citations without changing the stored text', async () => {
    const { container } = renderEditor('Outages raise costs (Klishi, 2024).')
    await waitFor(() => expect(container.querySelector('.dm-cite')).not.toBeNull())
    expect(container.querySelector('.dm-cite')?.textContent).toBe('(Klishi, 2024)')
    expect(container.querySelector('.dm-cite--flagged')).not.toBeNull()
    expect(saveSection).not.toHaveBeenCalled()
  })

  it('shows source, full text and claim support on hover', async () => {
    const { container } = renderEditor('Outages raise costs (Klishi, 2024).')
    await waitFor(() => expect(container.querySelector('.dm-cite')).not.toBeNull())
    fireEvent.mouseOver(container.querySelector('.dm-cite')!)
    const card = await screen.findByRole('group', { name: 'Citation details' })
    expect(card.textContent).toContain('Source exists')
    expect(card.textContent).toContain('Full text pinned')
    expect(card.textContent).toContain('Claim: partly supported')
    expect(card.querySelector('a[href="https://doi.org/10.1/klishi"]')).not.toBeNull()
  })

  it('swaps a citation through a normal edit, which autosaves', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const { container } = renderEditor('Outages raise costs (Klishi, 2024).')
      await waitFor(() => expect(container.querySelector('.dm-cite')).not.toBeNull())
      fireEvent.mouseOver(container.querySelector('.dm-cite')!)
      fireEvent.click(await screen.findByRole('button', { name: /Swap citation/ }))
      fireEvent.click(screen.getByRole('button', { name: /Nkohla \(2023\)/ }))
      await act(async () => { await vi.advanceTimersByTimeAsync(1500) })
      expect(saveSection).toHaveBeenCalledWith('p', '1.0', expect.stringContaining('(Nkohla, 2023)'))
    } finally {
      vi.useRealTimers()
    }
  })

  it('offers no swap when the section cannot be edited', async () => {
    const { container } = renderEditor('Outages raise costs (Klishi, 2024).', false)
    await waitFor(() => expect(container.querySelector('.dm-cite')).not.toBeNull())
    fireEvent.mouseOver(container.querySelector('.dm-cite')!)
    await screen.findByRole('group', { name: 'Citation details' })
    expect(screen.queryByRole('button', { name: /Swap citation/ })).toBeNull()
  })

  it('closes on Escape', async () => {
    const { container } = renderEditor('Outages raise costs (Klishi, 2024).')
    await waitFor(() => expect(container.querySelector('.dm-cite')).not.toBeNull())
    fireEvent.mouseOver(container.querySelector('.dm-cite')!)
    const card = await screen.findByRole('group', { name: 'Citation details' })
    fireEvent.keyDown(card, { key: 'Escape' })
    expect(screen.queryByRole('group', { name: 'Citation details' })).toBeNull()
  })
})
