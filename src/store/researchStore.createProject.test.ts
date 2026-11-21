import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ResearchProject } from '../types/research'

// The Automated proposal flow creates its project with the topic, level and citation style in the single create call,
// instead of creating an empty project and patching the topic in afterwards.

const mocks = vi.hoisted(() => ({ create: vi.fn() }))

vi.mock('../api/research', () => ({ researchApi: { create: mocks.create } }))

const { useResearchStore } = await import('./researchStore')

const created = { id: 'p-1', title: 'Load-shedding and small retailers', generatedTitles: [] } as unknown as ResearchProject

describe('researchStore.createProject', () => {
  beforeEach(() => {
    mocks.create.mockReset()
    mocks.create.mockResolvedValue(created)
    useResearchStore.setState({ projects: [] })
  })

  it('sends topic, level and citation style in the create call', async () => {
    await useResearchStore.getState().createProject({
      generatorMode: 'AGENT', documentMode: 'PROPOSAL', title: 'Load-shedding and small retailers',
      topic: 'Load-shedding and small retailers', academicLevel: 'MASTERS', citationStyle: 'apa7',
    })

    expect(mocks.create).toHaveBeenCalledTimes(1)
    expect(mocks.create).toHaveBeenCalledWith({
      generatorMode: 'AGENT', documentMode: 'PROPOSAL',
      topic: 'Load-shedding and small retailers', academicLevel: 'MASTERS', citationStyle: 'apa7',
    })
    expect(useResearchStore.getState().projects[0].id).toBe('p-1')
  })

  it('still creates a bare project when no topic is given', async () => {
    await useResearchStore.getState().createProject({ generatorMode: 'GENERATOR', documentMode: 'PROPOSAL' })

    expect(mocks.create).toHaveBeenCalledWith({ generatorMode: 'GENERATOR', documentMode: 'PROPOSAL', topic: undefined, academicLevel: undefined, citationStyle: undefined })
  })
})
