// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Editor } from '@tiptap/core'
import type { FetchedLiterature } from '../../../types/research'
import type { SectionCheckVerdict } from '../../../lib/citationCard'

const paraphrase = vi.fn()
vi.mock('../../../api/paraphrase', () => ({ paraphraseApi: { paraphrase: (...a: unknown[]) => paraphrase(...a) } }))

const { useResearchStore } = await import('../../../store/researchStore')
const { SectionEditor } = await import('./SectionEditor')
const { CitationDataContext } = await import('./citationDataContext')

beforeAll(() => {
  const rect = { x: 0, y: 0, top: 0, left: 0, bottom: 10, right: 10, width: 10, height: 10, toJSON: () => ({}) }
  Range.prototype.getBoundingClientRect = () => rect as DOMRect
  Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList
  document.elementFromPoint = () => null
})

const lit = (id: string, authors: string, year: number, extra: Partial<FetchedLiterature> = {}): FetchedLiterature => ({
  id, title: `Title ${id}`, authors, year, doi: `10.1/${id}`, harvardCitation: '', apaCitation: '', source: 'OpenAlex',
  includedByStudent: true, citationCount: 0, citedInSections: [], hasFullText: true, ...extra,
})
const klishi = lit('klishi', 'Lindiwe Klishi', 2024)
const nkohla = lit('nkohla', 'Thabo Nkohla', 2023, { hasFullText: false, url: 'https://papers.ssrn.com/x' })

const verdict = (marker: string, author: string, year: string, claim: string, v: string, failureType: string | null = null): SectionCheckVerdict =>
  ({ markerText: marker, citedAuthors: author, citedYear: year, claimText: claim, verdict: v, failureType, reasoning: 'Because.', flags: [] })

const saveSection = vi.fn().mockResolvedValue(undefined)

function renderEditor(content: string, checks?: Record<string, SectionCheckVerdict[]>, onCheckClaim = vi.fn()) {
  act(() => { useResearchStore.setState({ sections: { p: [] }, saveSection }) })
  const view = render(
    <CitationDataContext.Provider value={{ style: 'harvard', literature: [klishi, nkohla], bibliography: [], flags: [], checks }}>
      <SectionEditor projectId="p" code="1.0" content={content} editable label="1.0 Introduction"
        onDemoted={() => {}} registerFlush={() => {}} onCheckClaim={onCheckClaim} />
    </CitationDataContext.Provider>,
  )
  const editor = () => (view.container.querySelector('.ProseMirror') as unknown as { editor: Editor }).editor
  return { ...view, editor, onCheckClaim }
}

const dots = (container: HTMLElement) => Array.from(container.querySelectorAll('.dm-cite')).map(el => el.getAttribute('data-verdict'))

afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('citation verdict dots', () => {
  const text = 'Outages raise costs (Klishi, 2024).\n\nFirms adapt slowly (Nkohla, 2023).'
  const checks = { '1.0': [
    verdict('(Klishi, 2024)', 'Klishi', '2024', 'Outages raise costs', 'Supported'),
    verdict('(Nkohla, 2023)', 'Nkohla', '2023', 'Firms adapt slowly', 'NotSupported', 'PopulationBleed'),
  ] }

  it('shows each citation’s verdict from the section check, with a text label', async () => {
    const { container } = renderEditor(text, checks)
    await waitFor(() => expect(dots(container)).toEqual(['supports', 'not_supported']))
    expect(container.querySelector('.dm-cite')?.getAttribute('aria-label')).toBe('(Klishi, 2024). Supports the claim.')
  })

  it('is "not checked" without a check, and the card flags abstract-only, off-population and non-peer-reviewed sources', async () => {
    const { container } = renderEditor(text, checks)
    await waitFor(() => expect(container.querySelectorAll('.dm-cite')).toHaveLength(2))
    fireEvent.mouseOver(container.querySelectorAll('.dm-cite')[1])
    const card = await screen.findByRole('group', { name: 'Citation details' })
    expect(card.textContent).toContain('Claim: not supported')
    expect(card.textContent).toContain('Abstract only')
    expect(card.textContent).toContain('Different population, place or field')
    expect(card.textContent).toContain('May not be peer reviewed')
    expect(card.textContent).toContain('The source studied a different population.')
  })

  it('editing the text around a citation marks it unchecked; other paragraphs keep their verdict', async () => {
    const { container, editor } = renderEditor(text, checks)
    await waitFor(() => expect(dots(container)).toEqual(['supports', 'not_supported']))
    act(() => { editor().chain().insertContentAt(1, 'Rolling ').run() })
    await waitFor(() => expect(dots(container)).toEqual(['unchecked', 'not_supported']))
    fireEvent.mouseOver(container.querySelector('.dm-cite')!)
    const card = await screen.findByRole('group', { name: 'Citation details' })
    expect(card.textContent).toContain('Claim: not checked')
    expect(card.textContent).toContain('changed since it was checked')
  })

  it('a new check result applies again after edits', async () => {
    const { container, editor, rerender } = renderEditor(text, checks)
    act(() => { editor().chain().insertContentAt(1, 'Rolling ').run() })
    await waitFor(() => expect(dots(container)[0]).toBe('unchecked'))
    const fresh = { '1.0': [verdict('(Klishi, 2024)', 'Klishi', '2024', 'Rolling outages raise costs', 'PartiallySupported')] }
    rerender(
      <CitationDataContext.Provider value={{ style: 'harvard', literature: [klishi, nkohla], bibliography: [], flags: [], checks: fresh }}>
        <SectionEditor projectId="p" code="1.0" content={text} editable label="1.0 Introduction" onDemoted={() => {}} registerFlush={() => {}} />
      </CitationDataContext.Provider>,
    )
    await waitFor(() => expect(dots(container)[0]).toBe('partly'))
  })

  it('Remove takes a cited source out of the text, which autosaves', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const { container } = renderEditor('Outages raise costs (Klishi, 2024; Nkohla, 2023).')
      await waitFor(() => expect(container.querySelector('.dm-cite')).not.toBeNull())
      fireEvent.mouseOver(container.querySelector('.dm-cite')!)
      fireEvent.click(await screen.findByRole('button', { name: 'Remove Nkohla, 2023 from this citation' }))
      await act(async () => { await vi.advanceTimersByTimeAsync(1500) })
      expect(saveSection).toHaveBeenLastCalledWith('p', '1.0', expect.stringContaining('Outages raise costs (Klishi, 2024).'))
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('selection menu', () => {
  it('appears only for selected text, and a rewrite is a suggestion the student accepts', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      paraphrase.mockResolvedValue({ paraphrasedText: 'Power cuts increase costs' })
      const { editor } = renderEditor('Outages raise costs (Klishi, 2024).')
      await waitFor(() => expect(editor()).toBeTruthy())
      expect(screen.queryByRole('toolbar', { name: 'Edit selected text' })).toBeNull()
      act(() => { editor().chain().focus().setTextSelection({ from: 1, to: 20 }).run() })
      const menu = await screen.findByRole('toolbar', { name: 'Edit selected text' })
      await act(async () => { fireEvent.click(within(menu).getByRole('button', { name: 'Shorten' })) })
      expect(paraphrase).toHaveBeenCalledWith(expect.objectContaining({ text: 'Outages raise costs', length: 2 }))
      const card = await screen.findByRole('dialog', { name: 'Shorten suggestion' })
      expect(card.textContent).toContain('Power cuts increase costs')
      expect(saveSection).not.toHaveBeenCalled() // nothing changes until Accept
      await act(async () => { fireEvent.click(within(card).getByRole('button', { name: 'Accept' })) })
      await act(async () => { await vi.advanceTimersByTimeAsync(1500) })
      expect(saveSection).toHaveBeenLastCalledWith('p', '1.0', expect.stringContaining('Power cuts increase costs (Klishi, 2024).'))
    } finally {
      vi.useRealTimers()
    }
  })

  it('Reject leaves the text as it was', async () => {
    paraphrase.mockResolvedValue({ paraphrasedText: 'Something else' })
    const { editor } = renderEditor('Outages raise costs (Klishi, 2024).')
    await waitFor(() => expect(editor()).toBeTruthy())
    act(() => { editor().chain().focus().setTextSelection({ from: 1, to: 20 }).run() })
    await act(async () => { fireEvent.click(within(await screen.findByRole('toolbar', { name: 'Edit selected text' })).getByRole('button', { name: 'Rewrite' })) })
    await act(async () => { fireEvent.click(within(await screen.findByRole('dialog', { name: 'Rewrite suggestion' })).getByRole('button', { name: 'Reject' })) })
    expect(editor().getText()).toBe('Outages raise costs (Klishi, 2024).')
  })

  it('Add citation inserts a pinned source before the closing full stop', async () => {
    const { editor } = renderEditor('Firms adapt slowly.')
    await waitFor(() => expect(editor()).toBeTruthy())
    act(() => { editor().chain().focus().setTextSelection({ from: 1, to: 20 }).run() })
    fireEvent.click(within(await screen.findByRole('toolbar', { name: 'Edit selected text' })).getByRole('button', { name: /Add citation/ }))
    fireEvent.click(screen.getByRole('button', { name: /Nkohla \(2023\)/ }))
    expect(editor().getText()).toBe('Firms adapt slowly (Nkohla, 2023).')
  })

  it('Check claim runs the section check', async () => {
    const { editor, onCheckClaim } = renderEditor('Firms adapt slowly.')
    await waitFor(() => expect(editor()).toBeTruthy())
    act(() => { editor().chain().focus().setTextSelection({ from: 1, to: 10 }).run() })
    fireEvent.click(within(await screen.findByRole('toolbar', { name: 'Edit selected text' })).getByRole('button', { name: /Check claim/ }))
    expect(onCheckClaim).toHaveBeenCalledWith('1.0')
  })
})

const { within } = await import('@testing-library/react')
