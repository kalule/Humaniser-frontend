// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { ResearchDocument } from '../../types/webLibrary'

const doc = (patch: Partial<ResearchDocument> & { id: string }): ResearchDocument => ({
  title: 'Untitled', authors: [], docType: 'Journal Article', tags: [], folderId: null,
  createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', ...patch,
})

// Newest first by createdAt, which is the page's default sort.
const DOCS = [
  doc({ id: 'p1', title: 'Love and AIDS in South Africa', authors: ['Mark Hunter'], year: 2010, abstract: 'An ethnography.', createdAt: '2026-11-03T00:00:00Z', canonicalWorkId: 'w1' }),
  doc({ id: 'p2', title: 'AIDS and the Politics of Knowledge', authors: ['Jeremy Youde'], year: 2016, doi: '10.4324/1', createdAt: '2026-11-02T00:00:00Z' }),
  doc({ id: 'p3', title: 'Schooling and HIV', authors: ['Jane Nakato'], year: 2021, abstract: 'Enrolment fell.', createdAt: '2026-11-01T00:00:00Z' }),
]

// Only the HTTP layer is replaced; the real store, page and components run.
vi.mock('../../api/webLibrary', () => ({
  webLibraryApi: {
    getDocuments: vi.fn(async () => DOCS),
    getFolders: vi.fn(async () => []),
    getCollections: vi.fn(async () => []),
    saveDocument: vi.fn(async (d: ResearchDocument) => d),
  },
}))
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))

const { default: WebLibraryPage } = await import('./WebLibraryPage')

const renderPage = async () => {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={[{ pathname: '/app/web-library', state: { fromTabBar: true } }]}>
      <WebLibraryPage />
    </MemoryRouter>,
  )
  await screen.findByText('Love and AIDS in South Africa')
  return user
}

const panel = () => screen.queryByRole('complementary', { name: /./ })
const panelTitle = () => panel() && within(panel()!).getByRole('heading', { level: 2 }).textContent

beforeEach(() => {
  // jsdom implements neither; the page only uses them for scrolling and layout hints.
  Element.prototype.scrollIntoView = vi.fn()
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia
})
afterEach(() => cleanup())

describe('Saved Sources details panel', () => {
  it('opens on row click and shows the saved record', async () => {
    const user = await renderPage()
    expect(panel()).toBeNull()

    await user.click(screen.getByText('AIDS and the Politics of Knowledge'))

    expect(panelTitle()).toBe('AIDS and the Politics of Knowledge')
    expect(within(panel()!).getByText('Paper 2 of 3')).toBeTruthy()
    expect(within(panel()!).getByText('Imported or uploaded')).toBeTruthy()
  })

  it('moves between papers with the arrow keys and stops at the ends', async () => {
    const user = await renderPage()
    await user.click(screen.getByText('Love and AIDS in South Africa'))

    await user.keyboard('{ArrowDown}')
    expect(panelTitle()).toBe('AIDS and the Politics of Knowledge')
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(panelTitle()).toBe('Schooling and HIV')
    await user.keyboard('{ArrowUp}')
    expect(panelTitle()).toBe('AIDS and the Politics of Knowledge')
  })

  it('Esc closes the panel first and only then clears the selection', async () => {
    const user = await renderPage()
    await user.click(screen.getByRole('button', { name: 'Select Schooling and HIV' }))
    await user.click(screen.getByText('Love and AIDS in South Africa'))
    expect(screen.getByText('1 selected')).toBeTruthy()

    await user.keyboard('{Escape}')
    expect(panel()).toBeNull()
    expect(screen.getByText('1 selected')).toBeTruthy()

    await user.keyboard('{Escape}')
    expect(screen.queryByText('1 selected')).toBeNull()
  })

  it('ignores arrow keys while typing in the search box', async () => {
    const user = await renderPage()
    await user.click(screen.getByText('Love and AIDS in South Africa'))
    await user.click(screen.getByRole('textbox', { name: 'Search saved papers' }))

    await user.keyboard('{ArrowDown}')
    expect(panelTitle()).toBe('Love and AIDS in South Africa')
  })

  it('closes when the open paper is filtered out of the list', async () => {
    const user = await renderPage()
    await user.click(screen.getByText('Love and AIDS in South Africa'))

    await user.type(screen.getByRole('textbox', { name: 'Search saved papers' }), 'youde')

    expect(screen.queryByText('Love and AIDS in South Africa')).toBeNull()
    await waitFor(() => expect(panel()).toBeNull())
  })
})

describe('Saved Sources selection', () => {
  it('shows the bulk bar only while papers are selected, and select-all covers the visible list', async () => {
    const user = await renderPage()
    expect(screen.queryByRole('button', { name: 'Clear selection' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Select all' }))
    expect(screen.getByText('3 selected')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Add to collection/ })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Clear selection' }))
    expect(screen.queryByText(/selected$/)).toBeNull()
  })

  it('selecting with the checkbox does not open the details panel', async () => {
    const user = await renderPage()
    await user.click(screen.getByRole('button', { name: 'Select Schooling and HIV' }))
    expect(screen.getByText('1 selected')).toBeTruthy()
    expect(panel()).toBeNull()
  })
})
