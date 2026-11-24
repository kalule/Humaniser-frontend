// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../store/authStore', () => ({
  useAuthStore: (select?: (s: { user: unknown }) => unknown) => {
    const state = { user: { name: 'Ada Lovelace', email: 'ada@example.com' } }
    return select ? select(state) : state
  },
}))
vi.mock('../../config/features', async importOriginal => {
  const actual = await importOriginal<typeof import('../../config/features')>()
  return { ...actual, useIsToolEnabled: () => () => true }
})

const { ToolSidebar } = await import('./ToolSidebar')

afterEach(cleanup)

describe('ToolSidebar (icon-only rail)', () => {
  it('names every icon for screen readers and marks the current page', () => {
    render(<MemoryRouter initialEntries={['/app/account']}><ToolSidebar /></MemoryRouter>)
    const rail = screen.getByRole('complementary', { name: 'Tools' })
    for (const link of Array.from(rail.querySelectorAll('a'))) expect(link.getAttribute('aria-label')).toMatch(/\w/)
    expect(screen.getByRole('img', { name: 'HumaniseAI' })).toBeTruthy()
  })

  it('shows a tooltip on keyboard focus and on hover, and hides it on blur or Escape', () => {
    render(<MemoryRouter><ToolSidebar /></MemoryRouter>)
    const settings = screen.getByRole('link', { name: 'Settings' })
    fireEvent.focus(settings)
    expect(screen.getByRole('tooltip').textContent).toBe('Settings')
    fireEvent.blur(settings)
    expect(screen.queryByRole('tooltip')).toBeNull()

    const firstTool = screen.getByRole('complementary', { name: 'Tools' }).querySelectorAll('a')[0]
    fireEvent.mouseEnter(firstTool)
    const tip = screen.getByRole('tooltip')
    expect(tip.textContent).toContain(firstTool.getAttribute('aria-label')!)
    expect(firstTool.getAttribute('aria-describedby')).toBe('rail-tooltip')
    fireEvent.keyDown(firstTool, { key: 'Escape' })
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
})
