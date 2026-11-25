import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { SavedSourcePickerView } from './SavedSourcePicker'
import { TRASH_FOLDER } from '../../lib/savedSources'
import type { ResearchDocument } from '../../types/webLibrary'

const doc = (patch: Partial<ResearchDocument> & { id: string }): ResearchDocument => ({
  title: 'Untitled', authors: [], docType: 'Journal Article', tags: [], folderId: null,
  createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', ...patch,
})

const withAbstract = doc({ id: 'a', title: 'Effects of exercise on anxiety', authors: ['Jane Nakato', 'Peter Okello'], year: 2021, doi: '10.1/x', abstract: 'Exercise reduced anxiety.' })
const detailsOnly = doc({ id: 'b', title: '4. Editor new document', isFullText: true })
const trashed = doc({ id: 'c', title: 'Trashed paper', abstract: 'Text.', folderId: TRASH_FOLDER })

type ViewProps = Parameters<typeof SavedSourcePickerView>[0]
const library: Pick<ViewProps, 'documents' | 'folders' | 'collections' | 'hasLoaded' | 'isLoading'> = {
  documents: [withAbstract, detailsOnly, trashed], folders: [{ id: 'f1', name: 'Testing', createdAt: '' }],
  collections: [{ id: 'c1', name: 'Anxiety', paperCount: 1, createdAt: '', updatedAt: '' }],
  hasLoaded: true, isLoading: false,
}
const render = (props: Partial<ViewProps> = {}) =>
  renderToStaticMarkup(<MemoryRouter><SavedSourcePickerView {...library} {...props} /></MemoryRouter>)

describe('SavedSourcePicker', () => {
  it('lists saved papers with folders and collections to narrow by, and never a trashed one', () => {
    const html = render({ selectedIds: [], onChange: () => {} })
    expect(html).toContain('Effects of exercise on anxiety')
    expect(html).toContain('Jane Nakato et al. · 2021')
    expect(html).toContain('<optgroup label="Folders"><option value="f1">Testing</option>')
    expect(html).toContain('<option value="collection:c1">Anxiety</option>')
    expect(html).not.toContain('Trashed paper')
  })

  it('labels what is held for each paper, ignoring the browser-set full-text flag', () => {
    const html = render({ selectedIds: [], onChange: () => {} })
    expect(html).toContain('>Abstract<')
    expect(html).toContain('>Details only<')
    expect(html).not.toContain('Full text')
  })

  it('blocks a details-only paper when the caller needs text to write from', () => {
    const html = render({ selectedIds: [], onChange: () => {}, requireText: true })
    expect(html).toContain('No abstract, so it cannot be used as evidence.')
    expect(html).toMatch(/<input type="checkbox"[^>]*disabled=""[^>]*aria-label="Use 4\. Editor new document"/)
    expect(html).not.toMatch(/<input type="checkbox"[^>]*disabled=""[^>]*aria-label="Use Effects of exercise on anxiety"/)
    expect(html).toContain('Select shown (1)')
  })

  it('stops further choices at the limit but leaves chosen ones removable', () => {
    const second = doc({ id: 'd', title: 'Second paper', abstract: 'Text.' })
    const html = render({ documents: [withAbstract, second], selectedIds: ['a'], onChange: () => {}, max: 1 })
    expect(html).toContain('1 of 1 selected')
    expect(html).toMatch(/<input type="checkbox"[^>]*disabled=""[^>]*aria-label="Use Second paper"/)
    expect(html).not.toMatch(/<input type="checkbox"[^>]*disabled=""[^>]*aria-label="Use Effects of exercise on anxiety"/)
  })

  it('offers one action per row in pick-one use', () => {
    const html = render({ onPick: () => {}, pickLabel: 'Insert' })
    expect(html).toContain('>Insert</button>')
    expect(html).not.toContain(' selected</span>')
    expect(html).not.toContain('type="checkbox" class="mt-1')
  })

  it('points an empty library at Find Papers', () => {
    const html = render({ documents: [trashed], onPick: () => {} })
    expect(html).toContain('You have no saved sources yet.')
    expect(html).toContain('href="/app/literature-search"')
  })

  it('says so while the library is still loading', () => {
    expect(render({ hasLoaded: false, isLoading: true, onPick: () => {} })).toContain('Loading your saved sources')
  })
})
