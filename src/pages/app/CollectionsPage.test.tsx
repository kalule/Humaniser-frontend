// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { Collection } from '../../types/webLibrary'

const COLLECTIONS: Collection[] = [
  { id: 'c1', name: 'Aids in South Africa', paperCount: 7, createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-16T09:00:00Z',
    previewTitles: ['Love in the Time of AIDS', 'AIDS and the Politics of Knowledge', 'Schooling and HIV'], yearFrom: 2004, yearTo: 2019 },
  { id: 'c2', name: 'Anxiety', description: 'Exercise trials', paperCount: 0, createdAt: '2026-09-30T00:00:00Z', updatedAt: '2026-09-30T00:00:00Z', previewTitles: [] },
]

const api = vi.hoisted(() => ({
  getCollections: vi.fn(),
  createCollection: vi.fn(),
  duplicateCollection: vi.fn(),
  getCollectionDetail: vi.fn(),
}))
vi.mock('../../api/webLibrary', () => ({ webLibraryApi: api }))
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))

const { default: CollectionsPage } = await import('./CollectionsPage')
const { useWebLibraryStore } = await import('../../store/webLibraryStore')

const renderPage = async () => {
  const user = userEvent.setup()
  render(<MemoryRouter><CollectionsPage /></MemoryRouter>)
  await screen.findByText('Aids in South Africa')
  return user
}
const cardNames = () => screen.getAllByRole('article').map(a => within(a).getByRole('heading').textContent)

beforeEach(() => {
  useWebLibraryStore.setState({ collections: [], collectionsLoaded: false })
  api.getCollections.mockResolvedValue(COLLECTIONS)
  api.createCollection.mockImplementation(async (name: string, description?: string) =>
    ({ id: 'new', name, description, paperCount: 0, createdAt: '', updatedAt: new Date().toISOString() }))
  api.duplicateCollection.mockImplementation(async () => {
    const copy = { ...COLLECTIONS[0], id: 'c3', name: 'Aids in South Africa (copy)' }
    // Like the real server, the reload after duplicating includes the copy.
    api.getCollections.mockResolvedValue([...COLLECTIONS, copy])
    return copy
  })
  api.getCollectionDetail.mockResolvedValue({ ...COLLECTIONS[0], papers: [
    { id: 'p1', title: 'AIDS, South Africa, and the Politics of Knowledge', authors: ['Jeremy Youde'], year: 2016, docType: 'Book', tags: [], folderId: null, createdAt: '', updatedAt: '' },
    { id: 'p2', title: 'Trashed one', authors: [], docType: 'Journal Article', tags: [], folderId: '__trash__', createdAt: '', updatedAt: '' },
  ] })
})
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('Collections cards', () => {
  it('show a preview, year range, an unambiguous date, and an explainer above the grid', async () => {
    await renderPage()
    const card = screen.getAllByRole('article')[0]
    expect(within(card).getByText('Love in the Time of AIDS')).toBeTruthy()
    expect(within(card).getByText('and 4 more')).toBeTruthy()
    expect(within(card).getByText('2004–2019')).toBeTruthy()
    expect(within(card).getByText('Updated 16 Nov 2026')).toBeTruthy()
    expect(screen.getByText(/A paper can belong to many collections/)).toBeTruthy()
    expect(within(screen.getAllByRole('article')[1]).getByText(/No papers yet/)).toBeTruthy()
  })

  it('the card menu works from the keyboard and closes with Esc, returning focus', async () => {
    const user = await renderPage()
    const trigger = screen.getByRole('button', { name: 'Actions for Anxiety' })
    trigger.focus()
    await user.keyboard('{Enter}')
    const items = within(screen.getByRole('menu')).getAllByRole('menuitem')
    expect(items.map(i => i.textContent)).toEqual(['Rename', 'Edit description', 'Duplicate', 'Cite all papers…', 'Delete'])
    expect(document.activeElement).toBe(items[0])
    await user.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(items[1])
    await user.keyboard('{ArrowUp}{ArrowUp}')
    expect(document.activeElement).toBe(items[4])
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('Duplicate asks the server and the copy appears', async () => {
    const user = await renderPage()
    await user.click(screen.getByRole('button', { name: 'Actions for Aids in South Africa' }))
    await user.click(screen.getByRole('menuitem', { name: 'Duplicate' }))
    expect(api.duplicateCollection).toHaveBeenCalledWith('c1')
    expect(await screen.findByText('Aids in South Africa (copy)')).toBeTruthy()
  })

  it('Cite all lists formatted references and leaves out papers in Trash', async () => {
    const user = await renderPage()
    await user.click(screen.getByRole('button', { name: 'Actions for Aids in South Africa' }))
    await user.click(screen.getByRole('menuitem', { name: 'Cite all papers…' }))
    const dialog = await screen.findByRole('dialog')
    await waitFor(() => expect(within(dialog).getByText(/Youde/)).toBeTruthy())
    expect(within(dialog).queryByText(/Trashed one/)).toBeNull()
    expect(within(dialog).getByText(/1 paper is in Trash and left out/)).toBeTruthy()
  })

  it('the sort direction toggle reverses the order', async () => {
    const user = await renderPage()
    expect(cardNames()).toEqual(['Aids in South Africa', 'Anxiety'])
    await user.click(screen.getByRole('button', { name: /Sort direction/ }))
    expect(cardNames()).toEqual(['Anxiety', 'Aids in South Africa'])
  })
})

describe('Create collection dialog', () => {
  it('validates the name without changing what was typed, then creates', async () => {
    const user = await renderPage()
    await user.click(screen.getByRole('button', { name: 'Create collection' }))
    const name = await screen.findByRole('textbox', { name: 'Name' }) as HTMLInputElement

    await user.click(screen.getByRole('button', { name: 'Create' }))
    expect(screen.getByRole('alert').textContent).toBe('Give the collection a name.')
    expect(api.createCollection).not.toHaveBeenCalled()

    await user.type(name, ' anxiety ')
    expect(name.value).toBe(' anxiety ')
    expect(screen.getByRole('alert').textContent).toBe('You already have a collection called "anxiety".')
    expect(name.getAttribute('aria-invalid')).toBe('true')

    await user.clear(name)
    await user.type(name, 'HIV and schooling')
    await user.type(screen.getByRole('textbox', { name: /Description/ }), 'Chapter 2')
    await user.click(screen.getByRole('button', { name: 'Create' }))
    expect(api.createCollection).toHaveBeenCalledWith('HIV and schooling', 'Chapter 2')
  })

  it('rejects a name over the server limit', async () => {
    const user = await renderPage()
    await user.click(screen.getByRole('button', { name: 'Create collection' }))
    await user.click(await screen.findByRole('textbox', { name: 'Name' }))
    await user.paste('x'.repeat(201))
    expect(screen.getByRole('alert').textContent).toBe('Names can be up to 200 characters.')
  })
})
