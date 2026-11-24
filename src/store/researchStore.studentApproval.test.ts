import { describe, expect, it, vi } from 'vitest'
import type { ProjectSection, ResearchProject } from '../types/research'

const mocks = vi.hoisted(() => ({ approveSection: vi.fn() }))
vi.mock('../api/research', () => ({ researchApi: { approveSection: mocks.approveSection } }))

describe('approveSection records the student approval', () => {
  it('writes the approved version to sectionContent.studentApproved and syncs the project', async () => {
    const { useResearchStore } = await import('./researchStore')
    const syncProject = vi.fn().mockResolvedValue(undefined)
    useResearchStore.setState({
      projects: [{ id: 'p1', sectionContent: { studentApproved: JSON.stringify({ '1.0': '' }) } } as unknown as ResearchProject],
      sections: { p1: [] },
      syncProject,
    })
    mocks.approveSection.mockResolvedValue({ code: '1.2', status: 'Approved', generatedAt: '2026-11-24T08:00:00Z' } as ProjectSection)

    await useResearchStore.getState().approveSection('p1', '1.2')

    const content = useResearchStore.getState().projects.find(p => p.id === 'p1')!.sectionContent
    expect(JSON.parse(content.studentApproved)).toEqual({ '1.0': '', '1.2': '2026-11-24T08:00:00Z' })
    expect(syncProject).toHaveBeenCalledWith('p1')
  })
})
