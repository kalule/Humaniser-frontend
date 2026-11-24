// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Editor } from '@tiptap/core'
import type { ProjectSection, ResearchProject, SectionStatus } from '../../../types/research'

// The agent's stream for one section, as the live draft store would report it.
const stream = { text: '', words: 0 }
vi.mock('../../../lib/liveDraftStore', () => ({
  followDraft: vi.fn(), forgetDraft: vi.fn(),
  useLiveDraft: () => ({ text: stream.text, words: stream.words, sourcesRead: 3, activities: [], streamEnded: false }),
}))
vi.mock('../../../api/research', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../api/research')>()
  return { ...actual, researchApi: { ...actual.researchApi, getSectionCitationFlags: vi.fn().mockResolvedValue([]), getLiterature: vi.fn().mockResolvedValue([]),
    getBibliography: vi.fn().mockResolvedValue({ entries: [] }) } }
})
vi.mock('../../../api/proposalJourney', () => ({
  proposalJourneyApi: { current: vi.fn().mockResolvedValue({ summary: { designRequired: false }, readiness: null }) },
}))

const { useResearchStore } = await import('../../../store/researchStore')
const { DocumentModeView } = await import('./DocumentModeView')

beforeAll(() => {
  const rect = { x: 0, y: 0, top: 0, left: 0, bottom: 10, right: 10, width: 10, height: 10, toJSON: () => ({}) }
  Range.prototype.getBoundingClientRect = () => rect as DOMRect
  Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList
  document.elementFromPoint = () => null
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false })) as typeof window.matchMedia
})

let order = 0
const section = (code: string, status: SectionStatus, content = '', extra: Partial<ProjectSection> = {}): ProjectSection => ({
  code, displayCode: code, title: `Title ${code}`, order: order++, content, status, wordCount: content.split(' ').length,
  generatedAt: null, lastEditedAt: null, citationsPendingVerification: false, generationError: null,
  hasUnusedMethodologyAnchor: false, isUnderReferenced: false, citationTarget: 0, resolvedCitationCount: 0,
  citationShortfallRetryAttempted: false, citationTargetResolution: 'exempt', methodologyReviewAdvisory: null,
  requiresReReview: false, reReviewReason: null, isApplicableForMethodology: true, notApplicableReason: null,
  isMethodologyStale: false, methodologyStaleReason: null, lockedBy: null, ...extra,
} as ProjectSection)

const project = {
  id: 'p1', title: 'T', documentType: 'Proposal', documentMode: 'PROPOSAL', generatorMode: 'GENERATOR',
  citationStyle: 'harvard', confirmedMethodology: { id: 'm' }, researchState: 'Proposal', sectionContent: {},
} as unknown as ResearchProject

// Like the server: a save returns the section with the saved text (approved sections stay approved for a small edit).
const saveSection = vi.fn(async (projectId: string, code: string, content: string) => {
  useResearchStore.setState(st => ({ sections: { ...st.sections, [projectId]: st.sections[projectId].map(x => (x.code === code ? { ...x, content } : x)) } }))
})
const idleRun = { status: 'NotStarted', completedCount: 0, totalCount: 0, currentSection: null, wordsWritten: 0, failedCount: 0 }

function seed(sections: ProjectSection[]) {
  act(() => {
    useResearchStore.setState({
      sections: { p1: sections }, saveSection, loadSections: vi.fn().mockResolvedValue(undefined),
      getGenerationStatus: vi.fn().mockResolvedValue(idleRun), setContent: vi.fn(), syncProject: vi.fn().mockResolvedValue(undefined),
    })
  })
}

const region = (code: string) => screen.getByRole('region', { name: new RegExp(`^${code.replace('.', '\\.')} `) })
const editorOf = (code: string) => (region(code).querySelector('.ProseMirror') as unknown as { editor: Editor } | null)?.editor ?? null

afterEach(() => { cleanup(); vi.clearAllMocks(); stream.text = ''; stream.words = 0 })

describe('editing one section while the agent streams into another', () => {
  it('keeps B editable, focused and saving while A streams read-only, and A opens for editing when it lands', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const b = section('1.2', 'Draft', 'Background draft text.')
      seed([section('1.0', 'Generating', '', { lockedBy: 'job-1' }), b])
      render(<MemoryRouter><DocumentModeView project={project} onOpenGuided={vi.fn()} /></MemoryRouter>)

      // A (1.0) is being written: no editor, a read-only notice and its own Stop.
      expect(editorOf('1.0')).toBeNull()
      expect(within(region('1.0')).getByText('Read-only while writing')).toBeTruthy()
      expect(within(region('1.0')).getByRole('button', { name: /Stop writing 1\.0/ })).toBeTruthy()

      // The student types into B.
      await waitFor(() => expect(editorOf('1.2')).not.toBeNull())
      const editorB = editorOf('1.2')!
      expect(editorB.isEditable).toBe(true)
      act(() => { editorB.chain().focus('end').insertContent(' Added by the student.').run() })

      // The agent streams more of A and a poll replaces every section object meanwhile.
      stream.text = 'Load-shedding has'; stream.words = 2
      await act(async () => { seed(useResearchStore.getState().sections.p1.map(s => ({ ...s }))) })
      stream.text = 'Load-shedding has cut output across Gauteng.'; stream.words = 6
      await act(async () => { seed(useResearchStore.getState().sections.p1.map(s => ({ ...s }))) })

      // B's editor is the same instance, still focused, with the student's text, and it saved.
      expect(editorOf('1.2')).toBe(editorB)
      expect(editorB.isFocused || document.activeElement === editorB.view.dom).toBe(true)
      expect(editorB.getText()).toBe('Background draft text. Added by the student.')
      await act(async () => { await vi.advanceTimersByTimeAsync(1500) })
      expect(saveSection).toHaveBeenCalledWith('p1', '1.2', expect.stringContaining('Added by the student.'))
      expect(saveSection.mock.calls.every(c => c[1] === '1.2')).toBe(true)

      // A lands: it becomes an editable section with the streamed text; B is untouched.
      const now = useResearchStore.getState().sections.p1
      await act(async () => {
        seed(now.map(s => (s.code === '1.0' ? { ...s, status: 'Draft' as const, lockedBy: null, content: 'Load-shedding has cut output across Gauteng.' } : s)))
      })
      await waitFor(() => expect(editorOf('1.0')?.isEditable).toBe(true))
      expect(editorOf('1.0')!.getText()).toBe('Load-shedding has cut output across Gauteng.')
      expect(editorOf('1.2')!.getText()).toBe('Background draft text. Added by the student.')
    } finally {
      vi.useRealTimers()
    }
  })
})
