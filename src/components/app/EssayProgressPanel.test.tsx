// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { EssayProgressPanel, type EssayProgressPanelProps } from './EssayProgressPanel'
import type { EssayCoverageState } from '../../lib/essayProgress'

afterEach(cleanup)

const base: EssayProgressPanelProps = {
  topic: 'Do four-day weeks reduce burnout?',
  academicLevel: 'Undergraduate',
  wordCount: 1500,
  phase: 1,
  detail: 'Checking 18 sources against your question…',
  elapsedText: '1:05',
  parts: [],
  coverage: {},
  sources: [],
}

const parts = [
  { id: 'C1', label: 'Effect on burnout' },
  { id: 'C2', label: 'Effect on productivity' },
  { id: 'C3', label: 'Limits of the pilot evidence' },
  { id: 'C4', label: 'Sector differences' },
]

function renderPanel(overrides: Partial<EssayProgressPanelProps> = {}) {
  return render(<EssayProgressPanel {...base} {...overrides} />)
}

const sources = (n: number) => Array.from({ length: n }, (_, i) => ({ sourceId: `S${i + 1}`, title: `Study ${i + 1}`, firstAuthor: 'Smith', year: 2020 + (i % 5) }))

describe('EssayProgressPanel', () => {
  it('keeps the three plain phases and shows the status line under the current one', () => {
    renderPanel()
    for (const label of ['Understanding your question', 'Finding and checking sources', 'Writing your essay'])
      expect(screen.getByText(label)).toBeTruthy()
    expect(screen.getByText('Checking 18 sources against your question…')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('Finding and checking sources. Checking 18 sources against your question…')
  })

  it('maps each coverage state to its own text and icon', () => {
    const coverage: Record<string, EssayCoverageState> = { C1: 'supported', C2: 'partial', C3: 'unsupported' }
    renderPanel({ parts, coverage })
    const expectRow = (id: string, text: string, icon: string) => {
      const row = screen.getByTestId(`part-${id}`)
      expect(row.tagName).toBe('LI')
      expect(within(row).getByText(text)).toBeTruthy()
      expect(row.querySelector(`svg[data-state="${icon}"]`)).not.toBeNull()
    }
    expectRow('C1', 'Evidence found', 'supported')
    expectRow('C2', 'Some evidence found', 'partial')
    expectRow('C3', 'Little evidence found so far', 'unsupported')
    expectRow('C4', 'Not checked yet', 'unknown') // no coverage row yet
  })

  it('shows "Evidence found" only for parts whose state is supported', () => {
    renderPanel({ parts, coverage: { C1: 'partial', C2: 'unknown', C3: 'unsupported' } })
    expect(screen.queryByText('Evidence found')).toBeNull()
    expect(screen.queryByText(/evidence found for/)).toBeNull()
    expect(document.querySelector('svg[data-state="supported"]')).toBeNull()
  })

  it('counts only supported parts in the summary', () => {
    renderPanel({ parts, coverage: { C1: 'supported', C2: 'supported', C3: 'partial' } })
    expect(screen.getByText('Parts of your question · evidence found for 2 of 4')).toBeTruthy()
  })

  it('leaves the checklist out when the server sent no parts', () => {
    renderPanel({ parts: [] })
    expect(screen.queryByText(/Parts of your question/)).toBeNull()
  })

  it('never uses red for thin evidence', () => {
    const { container } = renderPanel({ parts, coverage: { C1: 'unsupported', C2: 'unsupported', C3: 'unsupported', C4: 'unsupported' } })
    expect(container.innerHTML).not.toMatch(/text-red|bg-red|border-red/)
  })

  it('lists up to six sources without "+N more"', () => {
    renderPanel({ sources: sources(6) })
    expect(screen.getByText('6 sources checked and accepted so far')).toBeTruthy()
    expect(within(screen.getByRole('list', { name: 'Sources accepted so far' })).getAllByRole('listitem')).toHaveLength(6)
    expect(screen.queryByText(/more$/)).toBeNull()
  })

  it('caps the list at the latest six and says how many more', () => {
    renderPanel({ sources: sources(9) })
    const items = within(screen.getByRole('list', { name: 'Sources accepted so far' })).getAllByRole('listitem')
    expect(items).toHaveLength(6)
    expect(items[0].textContent).toContain('Study 4')
    expect(items[5].textContent).toContain('Study 9')
    expect(screen.getByText('+3 more')).toBeTruthy()
  })

  it('makes no time promise and no early-draft claim', () => {
    const { container } = renderPanel()
    expect(container.textContent).toContain('You can close this window; writing continues in the editor.')
    expect(container.textContent).not.toMatch(/minutes|as soon as it is written/)
  })
})
