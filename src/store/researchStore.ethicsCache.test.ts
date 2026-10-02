import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EthicsChecklist, ProjectSection } from '../types/research'

// Ethics section load delay fix, Fix 3 — the checklist cache and its explicit invalidation
// triggers. Follows this repo's own convention (see researchStore.thesisFoundation.test.ts): no
// React component tests exist anywhere in this codebase, so the store's cache/invalidation
// wiring is what's covered here, not EthicsManager's rendered tree.

const mocks = vi.hoisted(() => ({
  getEthicsChecklist:     vi.fn(),
  getSections:            vi.fn(),
  generateSection:        vi.fn(),
  saveSection:            vi.fn(),
  approveSection:         vi.fn(),
  regenerateSection:      vi.fn(),
  confirmSectionFix:      vi.fn(),
  restoreSectionVersion:  vi.fn(),
  getSectionVersions:     vi.fn(),
  generateHypothesisProse: vi.fn(),
}))

vi.mock('../api/research', () => ({
  researchApi: {
    getEthicsChecklist: mocks.getEthicsChecklist,
    getSections: mocks.getSections,
    generateSection: mocks.generateSection,
    saveSection: mocks.saveSection,
    approveSection: mocks.approveSection,
    regenerateSection: mocks.regenerateSection,
    confirmSectionFix: mocks.confirmSectionFix,
    restoreSectionVersion: mocks.restoreSectionVersion,
    getSectionVersions: mocks.getSectionVersions,
    generateHypothesisProse: mocks.generateHypothesisProse,
  },
}))

function checklist(overrides: Partial<EthicsChecklist> = {}): EthicsChecklist {
  return {
    classification: {
      dataCollectionMethods: ['Survey'],
      involvesVulnerablePopulation: false,
      participantsIdentifiable: false,
      involvesSensitiveTopics: false,
      isConfirmedByStudent: true,
      isStale: false,
      classifiedAt: new Date(0).toISOString(),
    },
    documents: [],
    ...overrides,
  }
}

function section(code: string, overrides: Partial<ProjectSection> = {}): ProjectSection {
  return {
    code,
    displayCode: code,
    title: `Section ${code}`,
    content: 'updated content',
    status: 'Draft',
    wordCount: 2,
    ...overrides,
  } as ProjectSection
}

describe('researchStore — Ethics checklist cache (Fix 3)', () => {
  beforeEach(() => {
    vi.resetModules()
    Object.values(mocks).forEach(m => m.mockReset())
  })

  it('loadEthicsChecklist fetches and stores the result keyed by projectId', async () => {
    const { useResearchStore } = await import('./researchStore')
    mocks.getEthicsChecklist.mockResolvedValue(checklist())

    await useResearchStore.getState().loadEthicsChecklist('proj-1')

    expect(mocks.getEthicsChecklist).toHaveBeenCalledWith('proj-1')
    expect(useResearchStore.getState().ethicsChecklist['proj-1']).toEqual(checklist())
  })

  it('setEthicsChecklist writes a checklist directly without calling the API', async () => {
    const { useResearchStore } = await import('./researchStore')

    useResearchStore.getState().setEthicsChecklist('proj-1', checklist())

    expect(mocks.getEthicsChecklist).not.toHaveBeenCalled()
    expect(useResearchStore.getState().ethicsChecklist['proj-1']).toEqual(checklist())
  })

  it('a cached entry survives an unrelated section mutation (different project)', async () => {
    const { useResearchStore } = await import('./researchStore')
    useResearchStore.setState({ ethicsChecklist: { 'proj-1': checklist() } })
    mocks.saveSection.mockResolvedValue(section('5.3'))

    await useResearchStore.getState().saveSection('proj-2', '5.3', 'x')

    expect(useResearchStore.getState().ethicsChecklist['proj-1']).toEqual(checklist())
  })

  it('generateSection on a relevant code (5.3) invalidates the cache', async () => {
    const { useResearchStore } = await import('./researchStore')
    useResearchStore.setState({ ethicsChecklist: { 'proj-1': checklist() }, sections: { 'proj-1': [] } })
    mocks.generateSection.mockResolvedValue(section('5.3'))

    await useResearchStore.getState().generateSection('proj-1', '5.3')

    expect(useResearchStore.getState().ethicsChecklist['proj-1']).toBeUndefined()
  })

  it('generateSection on an irrelevant code (1.0) leaves the cache untouched', async () => {
    const { useResearchStore } = await import('./researchStore')
    useResearchStore.setState({ ethicsChecklist: { 'proj-1': checklist() }, sections: { 'proj-1': [] } })
    mocks.generateSection.mockResolvedValue(section('1.0'))

    await useResearchStore.getState().generateSection('proj-1', '1.0')

    expect(useResearchStore.getState().ethicsChecklist['proj-1']).toEqual(checklist())
  })

  it('saveSection on a relevant code (5.4) invalidates the cache', async () => {
    const { useResearchStore } = await import('./researchStore')
    useResearchStore.setState({ ethicsChecklist: { 'proj-1': checklist() } })
    mocks.saveSection.mockResolvedValue(section('5.4'))

    await useResearchStore.getState().saveSection('proj-1', '5.4', 'edited')

    expect(useResearchStore.getState().ethicsChecklist['proj-1']).toBeUndefined()
  })

  it('approveSection on a relevant code (5.8) invalidates the cache', async () => {
    const { useResearchStore } = await import('./researchStore')
    useResearchStore.setState({ ethicsChecklist: { 'proj-1': checklist() } })
    mocks.approveSection.mockResolvedValue(section('5.8'))

    await useResearchStore.getState().approveSection('proj-1', '5.8')

    expect(useResearchStore.getState().ethicsChecklist['proj-1']).toBeUndefined()
  })

  it('regenerateSection on a relevant code (5.11) invalidates the cache', async () => {
    const { useResearchStore } = await import('./researchStore')
    useResearchStore.setState({ ethicsChecklist: { 'proj-1': checklist() }, sections: { 'proj-1': [] } })
    mocks.regenerateSection.mockResolvedValue(section('5.11'))

    await useResearchStore.getState().regenerateSection('proj-1', '5.11')

    expect(useResearchStore.getState().ethicsChecklist['proj-1']).toBeUndefined()
  })

  it('confirmSectionFix on a relevant code (5.3) invalidates the cache', async () => {
    const { useResearchStore } = await import('./researchStore')
    useResearchStore.setState({ ethicsChecklist: { 'proj-1': checklist() } })
    mocks.confirmSectionFix.mockResolvedValue(section('5.3'))

    await useResearchStore.getState().confirmSectionFix('proj-1', '5.3', 'fixed content')

    expect(useResearchStore.getState().ethicsChecklist['proj-1']).toBeUndefined()
  })

  it('restoreSectionVersion on a relevant code (5.4) invalidates the cache', async () => {
    const { useResearchStore } = await import('./researchStore')
    useResearchStore.setState({ ethicsChecklist: { 'proj-1': checklist() } })
    mocks.restoreSectionVersion.mockResolvedValue(section('5.4'))
    mocks.getSectionVersions.mockResolvedValue([])

    await useResearchStore.getState().restoreSectionVersion('proj-1', '5.4', 2)

    expect(useResearchStore.getState().ethicsChecklist['proj-1']).toBeUndefined()
  })

  it('patchSection (local, no API call) on a relevant code (5.11) invalidates the cache', async () => {
    const { useResearchStore } = await import('./researchStore')
    useResearchStore.setState({ ethicsChecklist: { 'proj-1': checklist() } })

    useResearchStore.getState().patchSection('proj-1', section('5.11'))

    expect(useResearchStore.getState().ethicsChecklist['proj-1']).toBeUndefined()
  })

  it('patchSection on an irrelevant code (6.1) leaves the cache untouched', async () => {
    const { useResearchStore } = await import('./researchStore')
    useResearchStore.setState({ ethicsChecklist: { 'proj-1': checklist() } })

    useResearchStore.getState().patchSection('proj-1', section('6.1'))

    expect(useResearchStore.getState().ethicsChecklist['proj-1']).toEqual(checklist())
  })

  it('generateHypothesisProse (section 4.4, not a relevant code) leaves the cache untouched', async () => {
    const { useResearchStore } = await import('./researchStore')
    useResearchStore.setState({ ethicsChecklist: { 'proj-1': checklist() }, sections: { 'proj-1': [] } })
    mocks.generateHypothesisProse.mockResolvedValue(section('4.4'))

    await useResearchStore.getState().generateHypothesisProse('proj-1')

    expect(useResearchStore.getState().ethicsChecklist['proj-1']).toEqual(checklist())
  })
})
