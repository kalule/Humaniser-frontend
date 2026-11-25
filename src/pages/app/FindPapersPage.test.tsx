// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const searchPapers = vi.fn(async (query: string) => ({ query, results: [], page: 1, pageSize: 20, totalReturned: 0 }))

vi.mock('../../api/webLibrary', () => ({
  webLibraryApi: {
    searchPapers: (...args: unknown[]) => searchPapers(...(args as [string])),
    getCollections: vi.fn(async () => []),
  },
}))
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))

const { default: FindPapersPage } = await import('./FindPapersPage')
const { useWebLibraryStore } = await import('../../store/webLibraryStore')

const renderPage = () => {
  const user = userEvent.setup()
  render(<MemoryRouter initialEntries={['/app/literature-search']}><FindPapersPage /></MemoryRouter>)
  return user
}

beforeEach(() => {
  localStorage.clear()
  searchPapers.mockClear()
  useWebLibraryStore.getState().clearSearch()
  useWebLibraryStore.setState({ searchFilters: {}, searchMode: 'topic', searchSort: 'relevance', searchResolvedMode: 'topic' })
})
afterEach(() => cleanup())

describe('Find Papers search', () => {
  it('an example chip fills the input and runs the search', async () => {
    const user = renderPage()
    await user.click(screen.getByRole('button', { name: 'Climate change adaptation' }))

    expect((screen.getByRole('textbox', { name: 'Search scholarly literature' }) as HTMLInputElement).value).toBe('Climate change adaptation')
    expect(searchPapers).toHaveBeenCalledWith('Climate change adaptation', 1, 20, {}, 'topic', 'relevance')
    expect(await screen.findByText('No papers found for "Climate change adaptation"')).toBeTruthy()
  })

  it('Search is disabled only while the box is empty, and Enter submits', async () => {
    const user = renderPage()
    const button = screen.getByRole('button', { name: 'Search' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)

    await user.type(screen.getByRole('textbox', { name: 'Search scholarly literature' }), 'hiv schooling{Enter}')
    expect(button.disabled).toBe(false)
    expect(searchPapers).toHaveBeenCalledWith('hiv schooling', 1, 20, {}, 'topic', 'relevance')
  })

  it('recent searches replace the examples, with no term in both', () => {
    localStorage.setItem('research_library_recent_searches', JSON.stringify(['AI in healthcare']))
    renderPage()
    expect(screen.getByRole('heading', { name: 'Recent searches' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Try an example' })).toBeNull()
    expect(screen.getAllByRole('button', { name: 'AI in healthcare' })).toHaveLength(1)
  })

  it('applying filters re-runs the current search with them, and a chip removes one', async () => {
    // Also guards a real bug: the Filters button sits inside the search form and used to submit it.
    const user = renderPage()
    await user.type(screen.getByRole('textbox', { name: 'Search scholarly literature' }), 'hiv{Enter}')

    await user.click(screen.getByRole('button', { name: 'Filters' }))
    expect(searchPapers).toHaveBeenCalledTimes(1)
    await user.type(screen.getByRole('spinbutton', { name: 'From year' }), '2015')
    await user.click(screen.getByRole('checkbox', { name: /Open access only/ }))
    await user.click(screen.getByRole('button', { name: 'Apply filters' }))

    expect(searchPapers).toHaveBeenLastCalledWith('hiv', 1, 20, { yearFrom: 2015, openAccess: true }, 'topic', 'relevance')
    await user.click(screen.getByRole('button', { name: 'Remove filter: From 2015' }))
    expect(searchPapers).toHaveBeenLastCalledWith('hiv', 1, 20, { openAccess: true }, 'topic', 'relevance')
  })

  it('switching to Author re-runs the search as an author search', async () => {
    const user = renderPage()
    await user.type(screen.getByRole('textbox', { name: 'Search scholarly literature' }), 'Albert Bandura{Enter}')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Search in' }), 'author')
    expect(searchPapers).toHaveBeenLastCalledWith('Albert Bandura', 1, 20, {}, 'author', 'relevance')
  })

  it('selected papers are saved together from the selection bar', async () => {
    const result = (id: string, isSaved = false) => ({
      canonicalId: id, title: `Paper ${id}`, authors: ['A. Author'], year: 2020, isRetracted: false, isSaved, collectionIds: [],
    })
    searchPapers.mockImplementationOnce(async (query: string) => ({
      query, results: [result('a'), result('b'), result('c', true)], page: 1, pageSize: 20, totalReturned: 3,
    }) as never)
    const user = renderPage()
    await user.type(screen.getByRole('textbox', { name: 'Search scholarly literature' }), 'mindfulness{Enter}')

    expect((await screen.findByRole('checkbox', { name: 'Paper c is already in your library' }) as HTMLInputElement).disabled).toBe(true)
    await user.click(screen.getByRole('checkbox', { name: 'Select all unsaved' }))
    expect(screen.getByText('2 papers selected')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Save to library' }))
    expect(await screen.findByRole('button', { name: 'Save 2 to Library' })).toBeTruthy()
  })
})
