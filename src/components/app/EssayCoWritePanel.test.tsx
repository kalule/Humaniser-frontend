import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement, ReactNode } from 'react'
import type { CoWriteSession, CoWriteSectionResponse } from '../../types/workbench'

// Exercise async completion after the setup/cleanup/setup sequence used by
// StrictMode, without adding a DOM dependency to the Node test suite.
const hooks = vi.hoisted(() => ({
  states: [] as unknown[], cursor: 0,
  setup: null as null | (() => void | (() => void)),
}))
vi.mock('react', async original => ({
  ...await original<typeof import('react')>(),
  useState: (initial: unknown) => {
    const index = hooks.cursor++
    if (!(index in hooks.states)) hooks.states[index] = typeof initial === 'function' ? initial() : initial
    return [hooks.states[index], (value: unknown) => {
      hooks.states[index] = typeof value === 'function' ? value(hooks.states[index]) : value
    }]
  },
  useRef: (initial: unknown) => {
    const index = hooks.cursor++
    return hooks.states[index] ??= { current: initial }
  },
  useEffect: (setup: () => void | (() => void)) => { hooks.setup = setup },
  useMemo: (compute: () => unknown) => compute(),
}))
vi.mock('../../api/workbench', () => ({ workbenchApi: { draftCoWriteSection: vi.fn() } }))
import { workbenchApi } from '../../api/workbench'
import { EssayCoWritePanel, isRepeatWarning } from './EssayCoWritePanel'

const session: CoWriteSession = {
  sessionId: 'session', title: 'Essay', question: 'Question?', thesis: '', citationStyle: 'Harvard',
  sections: [{ id: 'intro', kind: 'intro', heading: 'Introduction', claim: '', reasoning: '', qualification: '', evidenceIds: [], words: 120, status: 'ready' }],
  passages: [], references: [],
}
const response: CoWriteSectionResponse = {
  sectionId: 'intro', text: 'Generated introduction.', sourceIds: [], evidenceIds: [], warnings: [], wordCount: 2,
}
function render() {
  hooks.cursor = 0
  return EssayCoWritePanel({ session, open: true, editor: null, onInsertHtml: vi.fn(), onFinish: vi.fn(), onClose: vi.fn() })
}
function find(node: ReactNode, predicate: (element: ReactElement<Record<string, unknown>>) => boolean): ReactElement<Record<string, unknown>> | undefined {
  if (Array.isArray(node)) {
    for (const child of node) { const result = find(child, predicate); if (result) return result }
  } else if (node && typeof node === 'object' && 'props' in node) {
    const element = node as ReactElement<Record<string, unknown>>
    return predicate(element) ? element : find(element.props.children as ReactNode, predicate)
  }
}
function mountWithEffectReplay() {
  const tree = render()
  const cleanup = hooks.setup!()
  if (typeof cleanup === 'function') cleanup()
  const unmount = hooks.setup!()
  const button = find(tree, element => element.type === 'button' && Array.isArray(element.props.children) && element.props.children.includes('Write this section'))!
  return { unmount, write: button.props.onClick as () => Promise<void> }
}

describe('EssayCoWritePanel request completion', () => {
  beforeEach(() => { hooks.states = []; hooks.cursor = 0; vi.clearAllMocks() })

  it('shows a completed suggestion and clears loading after StrictMode effect replay', async () => {
    vi.mocked(workbenchApi.draftCoWriteSection).mockResolvedValue(response)
    const { write } = mountWithEffectReplay()
    await write()
    const tree = render()
    expect(find(tree, element => element.props.children === response.text)).toBeDefined()
    expect(find(tree, element => element.props.role === 'status')).toBeUndefined()
  })

  it('shows request errors and clears loading after StrictMode effect replay', async () => {
    vi.mocked(workbenchApi.draftCoWriteSection).mockRejectedValue(new Error('Draft failed'))
    await mountWithEffectReplay().write()
    const tree = render()
    expect(find(tree, element => element.props.role === 'alert')?.props.children).toBe('Draft failed')
    expect(find(tree, element => element.props.role === 'status')).toBeUndefined()
  })

  it('ignores a response after a real unmount', async () => {
    let complete!: (result: CoWriteSectionResponse) => void
    vi.mocked(workbenchApi.draftCoWriteSection).mockReturnValue(new Promise(resolve => { complete = resolve }))
    const { write, unmount } = mountWithEffectReplay()
    const pending = write()
    if (typeof unmount === 'function') unmount()
    const before = [...hooks.states]
    complete(response)
    await pending
    expect(hooks.states).toEqual(before)
  })
})

describe('repeat warning', () => {
  it('is recognised so the panel can offer a one-click rewrite, and other warnings are not', () => {
    expect(isRepeatWarning('This repeats wording already in the essay ("remote work flexibility is the strongest"). Ask for a version that adds a new point instead.')).toBe(true)
    expect(isRepeatWarning('2 sentence(s) cite more than 2 sources together, so a reader cannot tell which source supports which claim.')).toBe(false)
  })
})
