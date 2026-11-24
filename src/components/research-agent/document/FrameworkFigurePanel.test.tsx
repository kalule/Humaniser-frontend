// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AbstractFormatToggle, FrameworkFigurePanel, anchor, edgePoints, wrapLabel } from './FrameworkFigurePanel'
import type { FrameworkFigureSpec } from '../../../types/frameworkFigure'

vi.mock('../../../api/frameworkFigure', () => ({ getFrameworkFigure: vi.fn() }))
import { getFrameworkFigure } from '../../../api/frameworkFigure'

const spec: FrameworkFigureSpec = {
  version: 'framework-figure.v1', width: 1000, height: 300, edited: false,
  caption: 'Conceptual framework: Alpha index and Bravo level',
  note: 'Arrows show proposed associations, not causal effects: the design cannot establish cause.',
  nodes: [
    { id: 'p1', label: 'Alpha index', role: 'predictor', x: 70, y: 100, w: 270, h: 96 },
    { id: 'o1', label: 'Bravo level', role: 'outcome', x: 660, y: 100, w: 270, h: 96 },
  ],
  edges: [{ from: 'p1', to: 'o1', kind: 'association', label: 'H1' }],
}

describe('framework figure geometry', () => {
  it('anchors an arrow on the box edge facing the other box', () => {
    const p = spec.nodes[0]
    expect(anchor(p, { x: 1000, y: 148 })).toEqual({ x: 340, y: 148 })
    const pts = edgePoints(spec.edges[0], new Map(spec.nodes.map(n => [n.id, n])))!
    expect(pts.from.x).toBe(340)
    expect(pts.to.x).toBe(660)
  })

  it('drops an arrow whose box was removed and wraps long labels', () => {
    expect(edgePoints({ from: 'p1', to: 'gone', kind: 'association' }, new Map([[spec.nodes[0].id, spec.nodes[0]]]))).toBeNull()
    expect(wrapLabel('A rather long construct name for one box', 22)).toEqual(['A rather long', 'construct name for one', 'box'])
  })
})

describe('FrameworkFigurePanel', () => {
  beforeEach(() => vi.mocked(getFrameworkFigure).mockReset())
  afterEach(cleanup)

  it('shows the computed figure with its caption and non-causal note', async () => {
    vi.mocked(getFrameworkFigure).mockResolvedValue({ stored: false, figure: spec, reason: null })
    render(<FrameworkFigurePanel projectId="p" stored={undefined} sourceKey="k" onSave={vi.fn()} />)
    expect(await screen.findByRole('img', { name: spec.caption })).toBeTruthy()
    expect(screen.getByText(/not causal effects/)).toBeTruthy()
    expect(screen.getByText('H1')).toBeTruthy()
  })

  it('saves an edited copy and never refetches when one is stored', async () => {
    const onSave = vi.fn().mockResolvedValue(true)
    render(<FrameworkFigurePanel projectId="p" stored={JSON.stringify(spec)} sourceKey="k" onSave={onSave} />)
    expect(getFrameworkFigure).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Edit the framework figure' }))
    fireEvent.change(screen.getAllByRole('textbox', { name: 'Label of outcome box' })[0], { target: { value: 'Bravo score' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save figure' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    const saved = JSON.parse(onSave.mock.calls[0][0]) as FrameworkFigureSpec
    expect(saved.edited).toBe(true)
    expect(saved.nodes.find(n => n.id === 'o1')!.label).toBe('Bravo score')
  })

  it('explains why there is no figure for a design with nothing to draw', async () => {
    vi.mocked(getFrameworkFigure).mockResolvedValue({ stored: false, figure: null, reason: 'This design has no measured variables to draw.' })
    render(<FrameworkFigurePanel projectId="p" stored={undefined} sourceKey="k" onSave={vi.fn()} />)
    expect((await screen.findByTestId('framework-figure-none')).textContent).toContain('no measured variables')
  })

  it('resets a stored copy to the computed figure', async () => {
    const onSave = vi.fn().mockResolvedValue(true)
    render(<FrameworkFigurePanel projectId="p" stored={JSON.stringify({ ...spec, edited: true })} sourceKey="k" onSave={onSave} />)
    fireEvent.click(screen.getByRole('button', { name: 'Reset the figure to the computed one' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(''))
  })
})

describe('AbstractFormatToggle', () => {
  it('is structured unless set to one paragraph', () => {
    const onChange = vi.fn()
    render(<AbstractFormatToggle value={undefined} onChange={onChange} />)
    expect(screen.getByRole('button', { name: 'Structured' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'One paragraph' }))
    expect(onChange).toHaveBeenCalledWith('single')
  })
})
