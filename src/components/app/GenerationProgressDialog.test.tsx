import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

// The dialog portals into document.body; render its children inline so the markup can be asserted
// without a DOM. (Effects don't run in a server render, so this checks structure and copy only.)
vi.mock('react-dom', async importOriginal => ({
  ...(await importOriginal<typeof import('react-dom')>()),
  createPortal: (node: unknown) => node,
}))
vi.stubGlobal('document', { body: {} })

import { GenerationProgressDialog, type GenerationProgressProps } from './GenerationProgressDialog'

const steps = [
  { id: '1.0', label: '1.0 Introduction', sectionKey: '1.0' },
  { id: '1.2', label: '1.2 Background', sectionKey: '1.2' },
  { id: '2.0', label: '2.0 Literature Review', sectionKey: '2.0' },
]

const base: GenerationProgressProps = {
  title: 'Clinician Experiences of AI',
  phase: 'Generating',
  completedCount: 1,
  totalCount: 3,
  currentSection: '1.2',
  wordsWritten: 600,
  failedCount: 0,
  stalled: false,
  targetWords: 500,
  startedAt: null,
  steps,
  sections: [
    { code: '1.0', title: 'Introduction', status: 'Draft', wordCount: 600, generationError: null, content: 'Intro text' },
  ],
  articleView: false,
  onToggleArticleView: () => {},
  onStop: () => {},
  onDone: () => {},
  onOpenDocument: () => {},
}

const render = (over: Partial<GenerationProgressProps> = {}) =>
  renderToStaticMarkup(<GenerationProgressDialog {...base} {...over} />)

describe('GenerationProgressDialog', () => {
  it('shows a per-section list with the right state for each row while running', () => {
    const html = render()
    expect(html).toContain('role="dialog"')
    expect(html).toContain('Generating proposal…')
    expect(html).toContain('1 of 3 sections complete')
    expect(html).toContain('1.0 Introduction')
    expect(html).toContain('Complete')
    expect(html).toContain('Drafting')
    expect(html).toContain('Queued')
    expect(html).toContain('1 completed')
    expect(html).toContain('1 in progress')
    expect(html).toContain('1 pending')
  })

  it('shows a sections-based percentage on an accessible progress bar', () => {
    const html = render()
    // One saved section out of three = 33%; long sections cannot inflate progress.
    expect(html).toContain('33% complete')
    expect(html).toContain('role="progressbar"')
    expect(html).toContain('aria-valuenow="33"')
    expect(html).toMatch(/600 \/ 1\D?500 words/)
  })

  it('offers Stop (not Done) while running, and hides the clock when the start time is unknown', () => {
    const html = render()
    expect(html).toContain('>Stop<')
    expect(html).not.toContain('>Done<')
    expect(html).not.toContain('Elapsed:')
    expect(html).toContain('Estimating remaining time…')
  })

  it('shows elapsed time once the start is known', () => {
    const html = render({ startedAt: Date.now() - 65_000 })
    expect(html).toMatch(/Elapsed: 1:0\d/)
  })

  it('shows the finished state with Done and Open document instead of Stop', () => {
    const html = render({
      phase: 'Completed', completedCount: 3, currentSection: null, wordsWritten: 1560,
      sections: steps.map(s => ({ code: s.sectionKey!, title: s.label, status: 'Draft' as const, wordCount: 520, generationError: null, content: 'x' })),
    })
    expect(html).toContain('Proposal generated!')
    expect(html).toContain('100% complete')
    expect(html).toContain('3 completed')
    expect(html).toContain('>Done<')
    expect(html).toContain('Continue')
    expect(html).not.toContain('>Stop<')
  })

  it('explains a paused-for-review run and points to the workspace', () => {
    const html = render({ phase: 'NeedsReview' })
    expect(html).toContain('Proposal needs review')
    expect(html).toContain('Review in workspace')
    expect(html).toContain('Generation paused for evidence or consistency review')
  })

  it('warns when the run looks stalled', () => {
    expect(render({ stalled: true })).toContain('taking longer than usual')
  })

  it('offers resume on a paused run and disables it while the request is pending', () => {
    expect(render({ phase: 'NeedsReview', onResume: () => {} })).toContain('Resume generation')
    const pending = render({ phase: 'NeedsReview', onResume: () => {}, resuming: true })
    expect(pending).toContain('Resuming...')
    expect(pending).toContain('disabled=""')
    expect(render({ onResume: () => {} })).not.toContain('Resume generation')
  })

  it.each(['Error', 'Cancelled'] as const)('offers autonomous resume after %s', phase => {
    expect(render({ phase, onResume: () => {} })).toContain('Resume generation')
    expect(render({ phase, onResume: () => {}, resuming: true })).toContain('disabled=""')
  })

  it('reports failed sections without hiding them', () => {
    const html = render({
      sections: [
        { code: '1.0', title: 'Introduction', status: 'Draft', wordCount: 600, generationError: null, content: 'x' },
        { code: '2.0', title: 'Literature Review', status: 'NotStarted', wordCount: 0, generationError: 'no citations', content: '' },
      ],
    })
    expect(html).toContain('Needs retry')
    expect(html).toContain('1 need retry')
  })

  it('switches to the article view when asked', () => {
    const html = render({ articleView: true })
    expect(html).toContain('Intro text')
    expect(html).not.toContain('Drafting')
  })
})

it('offers resume instead of declaring a partial terminal run complete', () => {
  const html = render({ phase: 'Completed', completedCount: 1, onResume: () => {} })
  expect(html).toContain('Generation incomplete')
  expect(html).toContain('33% complete')
  expect(html).toContain('Resume generation')
  expect(html).not.toContain('Proposal generated!')
})

it('reports recorded evidence activity without promising automatic recovery', () => {
  const html = render({ lastActivity: 'Processing evidence', stalled: true })
  expect(html).toContain('Last activity: Processing evidence')
  expect(html).not.toContain('recover automatically within a few minutes')
})
