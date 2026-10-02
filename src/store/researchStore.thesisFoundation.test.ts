import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ResearchProject, ThesisChapterPlan, CanonicalResearchPlan, UniversityTemplateSummary } from '../types/research'

// Thesis Foundation (Phase 1) — store-layer coverage for the new researchStore actions backing
// ResearchDashboardPage's "Thesis Structure" tab. Follows this repo's own convention (see
// webLibraryStore.test.ts/libraryStore.test.ts): no React component tests exist anywhere in this
// codebase, so the store's API-wiring is what's covered, not the rendered component tree.

const mocks = vi.hoisted(() => ({
  setResearchState:           vi.fn(),
  getThesisChapterPlan:       vi.fn(),
  getCanonicalResearchPlans:  vi.fn(),
  listUniversityTemplates:    vi.fn(),
  setUniversityTemplate:      vi.fn(),
}))

vi.mock('../api/research', () => ({
  researchApi: {
    setResearchState: mocks.setResearchState,
    getThesisChapterPlan: mocks.getThesisChapterPlan,
    getCanonicalResearchPlans: mocks.getCanonicalResearchPlans,
    listUniversityTemplates: mocks.listUniversityTemplates,
    setUniversityTemplate: mocks.setUniversityTemplate,
  },
}))

function project(overrides: Partial<ResearchProject> = {}): ResearchProject {
  return {
    id: 'proj-1',
    title: 'Test Project',
    academicLevel: 'MASTERS',
    fieldInterest: 'Education',
    selectedTopic: null,
    suggestedTopics: [],
    generatedTitles: [],
    currentStep: 0,
    sectionContent: {},
    documentMode: 'PROPOSAL',
    generatorMode: 'GENERATOR',
    citationStyle: 'harvard',
    progressPct: 0,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    researchState: 'Proposal',
    universityTemplateId: null,
    ...overrides,
  } as ResearchProject
}

describe('researchStore — Thesis Foundation (Phase 1)', () => {
  beforeEach(() => {
    vi.resetModules()
    Object.values(mocks).forEach(m => m.mockReset())
  })

  it('setResearchState replaces the matching project with the server response', async () => {
    const { useResearchStore } = await import('./researchStore')
    useResearchStore.setState({ projects: [project({ id: 'proj-1', researchState: 'Proposal' })] })
    mocks.setResearchState.mockResolvedValue(project({ id: 'proj-1', researchState: 'DataCollection' }))

    await useResearchStore.getState().setResearchState('proj-1', 'DataCollection')

    expect(mocks.setResearchState).toHaveBeenCalledWith('proj-1', 'DataCollection')
    expect(useResearchStore.getState().projects[0].researchState).toBe('DataCollection')
  })

  it('setResearchState leaves state untouched and rethrows on failure (e.g. ANALYSIS_NOT_VERIFIED)', async () => {
    const { useResearchStore } = await import('./researchStore')
    useResearchStore.setState({ projects: [project({ id: 'proj-1', researchState: 'Proposal' })] })
    const apiError = { code: 'ANALYSIS_NOT_VERIFIED', message: 'Analysis cannot be marked complete...' }
    mocks.setResearchState.mockRejectedValue(apiError)

    await expect(useResearchStore.getState().setResearchState('proj-1', 'AnalysisCompleted'))
      .rejects.toEqual(apiError)
    expect(useResearchStore.getState().projects[0].researchState).toBe('Proposal')
  })

  it('loadThesisChapterPlan populates the plan and toggles isLoadingChapterPlan', async () => {
    const { useResearchStore } = await import('./researchStore')
    const plan: ThesisChapterPlan = {
      researchState: 'AnalysisCompleted',
      chapters: [
        { sectionCode: '6.0', title: 'Results', displayOrder: 26, status: 'NotStarted', currentWordCount: 0, targetWordCount: 400, locked: false, lockedReason: null },
      ],
    }
    mocks.getThesisChapterPlan.mockResolvedValue(plan)

    const promise = useResearchStore.getState().loadThesisChapterPlan('proj-1')
    expect(useResearchStore.getState().isLoadingChapterPlan).toBe(true)
    await promise

    expect(useResearchStore.getState().isLoadingChapterPlan).toBe(false)
    expect(useResearchStore.getState().thesisChapterPlan['proj-1']).toEqual(plan)
  })

  it('loadThesisChapterPlan clears isLoadingChapterPlan even when the request fails', async () => {
    const { useResearchStore } = await import('./researchStore')
    mocks.getThesisChapterPlan.mockRejectedValue(new Error('network error'))

    await expect(useResearchStore.getState().loadThesisChapterPlan('proj-1')).rejects.toThrow()
    expect(useResearchStore.getState().isLoadingChapterPlan).toBe(false)
  })

  it('loadCanonicalResearchPlans populates the versioned snapshot list', async () => {
    const { useResearchStore } = await import('./researchStore')
    const plans: CanonicalResearchPlan[] = [{
      id: 'plan-1', version: 1, titleSnapshot: 'My Thesis',
      researchQuestions: [], objectives: [],
      studyDesignSnapshot: '', samplingStrategySnapshot: '',
      methodologyType: 'Qualitative', methodologySubType: '',
      createdReason: 'ThesisTransition', createdAt: new Date(0).toISOString(),
    }]
    mocks.getCanonicalResearchPlans.mockResolvedValue(plans)

    await useResearchStore.getState().loadCanonicalResearchPlans('proj-1')

    expect(useResearchStore.getState().canonicalResearchPlans['proj-1']).toEqual(plans)
  })

  it('loadUniversityTemplates populates the shared template list', async () => {
    const { useResearchStore } = await import('./researchStore')
    const templates: UniversityTemplateSummary[] = [
      { id: 'tmpl-1', name: 'UNISA', isIllustrative: false, citationStyle: 'harvard', sectionCount: 0 },
    ]
    mocks.listUniversityTemplates.mockResolvedValue(templates)

    await useResearchStore.getState().loadUniversityTemplates()

    expect(useResearchStore.getState().universityTemplates).toEqual(templates)
  })

  it('setUniversityTemplate replaces the matching project with the server response', async () => {
    const { useResearchStore } = await import('./researchStore')
    useResearchStore.setState({ projects: [project({ id: 'proj-1', universityTemplateId: null })] })
    mocks.setUniversityTemplate.mockResolvedValue(project({ id: 'proj-1', universityTemplateId: 'tmpl-1' }))

    await useResearchStore.getState().setUniversityTemplate('proj-1', 'tmpl-1')

    expect(mocks.setUniversityTemplate).toHaveBeenCalledWith('proj-1', 'tmpl-1')
    expect(useResearchStore.getState().projects[0].universityTemplateId).toBe('tmpl-1')
  })

  it('setUniversityTemplate(null) clears the assignment', async () => {
    const { useResearchStore } = await import('./researchStore')
    useResearchStore.setState({ projects: [project({ id: 'proj-1', universityTemplateId: 'tmpl-1' })] })
    mocks.setUniversityTemplate.mockResolvedValue(project({ id: 'proj-1', universityTemplateId: null }))

    await useResearchStore.getState().setUniversityTemplate('proj-1', null)

    expect(mocks.setUniversityTemplate).toHaveBeenCalledWith('proj-1', null)
    expect(useResearchStore.getState().projects[0].universityTemplateId).toBeNull()
  })
})
