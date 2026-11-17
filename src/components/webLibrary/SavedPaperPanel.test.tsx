import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

// CitePopover portals into document.body, which a Node static render doesn't have.
vi.mock('./CitePopover', () => ({ CitePopover: () => <button>Cite</button> }))
import { SavedPaperPanel } from './SavedPaperPanel'
import { BulkActionBar } from './BulkActionBar'
import { matchesSavedSourceFilter, savedSourceOrigin, stepPaper } from '../../lib/savedSources'
import type { RowActionHandlers } from './libraryRowActions'
import type { ResearchDocument } from '../../types/webLibrary'

const doc = (patch: Partial<ResearchDocument> & { id: string }): ResearchDocument => ({
  title: 'Untitled', authors: [], docType: 'Journal Article', tags: [], folderId: null,
  createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', ...patch,
})

const noop = () => {}
const handlers: RowActionHandlers = {
  onOpenPdfViewer: noop, onDownload: noop, onAddToCollection: noop, onDetails: noop, onMoveToFolder: noop, onTrash: noop,
}

const fromSearch = doc({
  id: 'a', title: 'AIDS, South Africa, and the Politics of Knowledge', authors: ['Jeremy Youde'], year: 2016,
  journal: 'Routledge eBooks', doi: '10.4324/9781315566290', abstract: 'Through an in-depth examination of the interactions.',
  canonicalWorkId: 'w-1', citationCount: 48,
})
const imported = doc({ id: 'b', title: 'Field notes', isFullText: true, filePath: 'blob:x' })

describe('SavedPaperPanel', () => {
  it('shows the saved record: metadata, real abstract, source, position and actions', () => {
    const html = renderToStaticMarkup(
      <SavedPaperPanel doc={fromSearch} position={3} total={22} folderName="Chapter 2" inTrash={false} handlers={handlers} onClose={noop} onPrev={noop} onNext={noop} />,
    )
    expect(html).toContain('Paper 3 of 22')
    expect(html).toContain('AIDS, South Africa, and the Politics of Knowledge')
    expect(html).toContain('Jeremy Youde')
    expect(html).toContain('href="https://doi.org/10.4324/9781315566290"')
    expect(html).toContain('Through an in-depth examination')
    expect(html).toContain('Saved from Find Papers')
    expect(html).toContain('Chapter 2')
    for (const action of ['Cite', 'Add to collection', 'Move to folder', 'Full record', 'Move to Trash']) expect(html).toContain(action)
    expect(html).toContain('aria-label="Previous paper"')
    expect(html).toContain('aria-label="Close paper details"')
  })

  it('works for an imported paper, never claims full text, and offers trash actions in Trash', () => {
    const html = renderToStaticMarkup(
      <SavedPaperPanel doc={imported} position={1} total={1} inTrash handlers={{ ...handlers, onRestore: noop, onDeleteForever: noop }} onClose={noop} />,
    )
    expect(html).toContain('Imported or uploaded')
    expect(html).toContain('No abstract is saved for this paper')
    expect(html).not.toContain('Full text')
    expect(html).not.toContain('Full record')
    expect(html).toContain('Restore')
    expect(html).toContain('Delete permanently')
    // At either end of the list the step buttons are disabled.
    expect(html).toMatch(/disabled=""[^>]*aria-label="Previous paper"/)
  })
})

describe('arrow-key stepping', () => {
  const ids = ['a', 'b', 'c']
  it('moves one paper at a time and stops at the ends', () => {
    expect(stepPaper(ids, 'a', 1)).toBe('b')
    expect(stepPaper(ids, 'c', 1)).toBe('c')
    expect(stepPaper(ids, 'a', -1)).toBe('a')
    expect(stepPaper(ids, null, 1)).toBe('a')
    expect(stepPaper(ids, null, -1)).toBe('c')
    expect(stepPaper(ids, 'gone', 1)).toBe('a')
    expect(stepPaper([], 'a', 1)).toBeNull()
  })
})

describe('saved-paper search and filters', () => {
  it('matches title/author/DOI terms and the toolbar filters', () => {
    expect(matchesSavedSourceFilter(fromSearch, { query: 'youde 2016' })).toBe(true)
    expect(matchesSavedSourceFilter(fromSearch, { query: '10.4324/9781315566290' })).toBe(true)
    expect(matchesSavedSourceFilter(imported, { withAbstractOnly: true })).toBe(false)
    expect(matchesSavedSourceFilter(imported, { withDoiOnly: true })).toBe(false)
    expect(matchesSavedSourceFilter(fromSearch, { yearFrom: 2017 })).toBe(false)
    expect(matchesSavedSourceFilter(fromSearch, { docType: 'Book' })).toBe(false)
    expect(savedSourceOrigin(fromSearch)).toBe('search')
    expect(savedSourceOrigin(imported)).toBe('imported')
  })
})

describe('BulkActionBar', () => {
  it('names the selection and offers the bulk actions, with a clear-selection control', () => {
    const html = renderToStaticMarkup(<BulkActionBar count={4} onAddToCollection={noop} onExport={noop} onTrash={noop} onClear={noop} />)
    expect(html).toContain('4 selected')
    expect(html).toContain('Add to collection')
    expect(html).toContain('Export')
    expect(html).toContain('Move to Trash')
    expect(html).toContain('aria-label="Clear selection"')
  })

  it('says what the destructive action really does in Trash', () => {
    const html = renderToStaticMarkup(<BulkActionBar count={2} onExport={noop} onTrash={noop} onClear={noop} trashLabel="Delete permanently" />)
    expect(html).toContain('Delete permanently')
    expect(html).not.toContain('Add to collection')
  })
})
