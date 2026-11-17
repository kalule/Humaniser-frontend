import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { Sidebar } from './Sidebar'

// Server rendering reads a zustand store's initial state, so the signed-in user is supplied by a mock.
const auth = vi.hoisted(() => ({ user: null as unknown }))
vi.mock('../../store/authStore', () => ({
  useAuthStore: (select?: (s: { user: unknown }) => unknown) => (select ? select({ user: auth.user }) : { user: auth.user }),
}))

const render = (path: string) =>
  renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar mobileOpen={false} onMobileClose={() => {}} />
    </MemoryRouter>,
  )

const sectionButtons = (html: string) =>
  [...html.matchAll(/<button[^>]*aria-expanded="(true|false)"[^>]*aria-controls="sidebar-nav-([a-z0-9-]+)"/g)]
    .map(m => ({ expanded: m[1] === 'true', id: m[2] }))

const g = globalThis as { window?: unknown }
const originalWindow = g.window

afterEach(() => {
  g.window = originalWindow
  auth.user = null
})

describe('Sidebar', () => {
  it('renders collapsible section headers with no storage available', () => {
    g.window = undefined // node: any localStorage access throws, which the sidebar must survive
    const sections = sectionButtons(render('/app/humaniser'))
    expect(sections.length).toBeGreaterThan(0)
    expect(sections.every(s => s.expanded)).toBe(true)
  })

  it('keeps a remembered-collapsed section closed, but forces open the one holding the current page', () => {
    const first = sectionButtons(render('/app/humaniser'))
    const all = Object.fromEntries(first.map(s => [s.id, true]))
    // Section ids are slugs of the section names, which are the storage keys' source; collapse every section.
    const names = [...render('/app/humaniser').matchAll(/aria-controls="sidebar-nav-[a-z0-9-]+"[^>]*>(?:<[^>]+>)*?<span>([^<]+)<\/span>/g)].map(m => m[1])
    expect(names.length).toBe(Object.keys(all).length)
    const store: Record<string, string> = { sidebar_collapsed_sections: JSON.stringify(Object.fromEntries(names.map(n => [n, true]))) }
    g.window = { localStorage: { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v } } }

    const html = render('/app/humaniser')
    const sections = sectionButtons(html)
    const open = sections.filter(s => s.expanded)
    expect(open).toHaveLength(1)
    expect(html).toContain('aria-current="page"')
    expect(html).toMatch(new RegExp(`id="sidebar-nav-${open[0].id}"(?! hidden)`))
  })

  it('labels unlimited usage as having no limit and has no account row in the footer', () => {
    auth.user = { name: 'Admin', email: 'a@example.com', plan: 'Unlimited', wordsUsed: 3854, wordsLimit: 1_000_000, creditsLimit: 1_000_000 }
    const html = render('/app/humaniser')
    expect(html).toContain(`${(3854).toLocaleString()} words used this month · no limit`)
    expect(html).not.toContain('role="progressbar"')
    expect(html).not.toContain('Log out')
  })
})
