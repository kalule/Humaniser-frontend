// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { QualAvailability } from '../../api/qualitativeAnalysis'

const createStudy = vi.fn()
vi.mock('../../api/qualitativeAnalysis', async (orig) => ({
  ...(await orig<typeof import('../../api/qualitativeAnalysis')>()),
  qualApi: { listStudies: vi.fn().mockResolvedValue([]), createStudy: (b: unknown) => { createStudy(b); return Promise.resolve({ id: 'study-1' }) } },
}))
vi.mock('../../api/research', () => ({
  researchApi: { list: vi.fn().mockResolvedValue([{ id: 'p1', title: 'Teachers and remote learning' }]) },
}))

const { StudyList } = await import('./StudyList')

const features: QualAvailability = {
  enabled: true, ai: false, agreement: false, audio: false, methods: ['ReflexiveTA'],
  retentionDays: 365, maxTranscriptWords: 60000, maxTranscriptsPerStudy: 60, fileTypes: ['.txt'],
}

afterEach(() => { cleanup(); createStudy.mockClear() })

describe('StudyList project link (research-platform W1.1)', () => {
  it('links the study to the chosen project and fills an empty title from it', async () => {
    render(<MemoryRouter><StudyList features={features} /></MemoryRouter>)
    const select = await screen.findByLabelText('Research project')
    await waitFor(() => expect(screen.getByRole('option', { name: 'Teachers and remote learning' })).toBeTruthy())
    fireEvent.change(select, { target: { value: 'p1' } })
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Teachers and remote learning')

    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Create study' }))
    await waitFor(() => expect(createStudy).toHaveBeenCalledOnce())
    expect(createStudy.mock.calls[0][0]).toMatchObject({ projectId: 'p1', title: 'Teachers and remote learning' })
  })

  it('creates an unlinked study when no project is chosen', async () => {
    render(<MemoryRouter><StudyList features={features} /></MemoryRouter>)
    await screen.findByLabelText('Research project')
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Pilot interviews' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Create study' }))
    await waitFor(() => expect(createStudy).toHaveBeenCalledOnce())
    expect(createStudy.mock.calls[0][0]).toMatchObject({ projectId: null, title: 'Pilot interviews' })
  })
})
