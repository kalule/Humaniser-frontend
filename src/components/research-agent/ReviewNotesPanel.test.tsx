import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReviewNotesList, noteTitle } from './ReviewNotesPanel'
import type { QualityFlag } from '../../types/research'

const note = (over: Partial<QualityFlag> = {}): QualityFlag => ({
  id: 'n1', sectionCode: '1.0', code: 'OverstatedGapClaim', severity: 'warning',
  message: 'Scope the gap: no studies exist on this.', dismissed: false, createdAt: '2026-10-16T10:00:00Z', ...over,
})

const render = (notes: QualityFlag[], showDismissed = false) => renderToStaticMarkup(
  <ReviewNotesList notes={notes} onDismiss={() => {}} onRestore={() => {}} showDismissed={showDismissed} onToggleDismissed={() => {}} />,
)

describe('ReviewNotesList', () => {
  it('renders nothing when a section has no notes', () => {
    expect(render([])).toBe('')
  })

  it('labels a note "Review note", shows its message and offers Dismiss', () => {
    const html = render([note()])
    expect(html).toContain('Review note')
    expect(html).toContain('Gap stated too strongly')
    expect(html).toContain('no studies exist on this')
    expect(html).toContain('Dismiss</button>')
  })

  it('never styles a note as an error', () => {
    const html = render([note(), note({ id: 'n2', dismissed: true })], true)
    expect(html).not.toMatch(/red-|rose-|danger|error/i)
  })

  it('collapses dismissed notes behind a count and offers no Restore until expanded', () => {
    const html = render([note({ dismissed: true })])
    expect(html).toContain('Dismissed (1)')
    expect(html).not.toContain('Restore')
    expect(html).not.toContain('no studies exist on this')
  })

  it('offers Restore once the dismissed list is expanded', () => {
    const html = render([note({ dismissed: true })], true)
    expect(html).toContain('Restore</button>')
  })

  it('falls back to a spaced-out code for an unlisted note type', () => {
    expect(noteTitle('SomeNewCheck')).toBe('Some New Check')
  })
})
