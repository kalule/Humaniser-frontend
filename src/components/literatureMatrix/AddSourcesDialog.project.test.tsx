// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Matrix } from '../../lib/literatureMatrix'

const addProject = vi.fn()
vi.mock('../../api/literatureMatrix', () => ({
  literatureMatrixApi: { addProject: (id: string) => { addProject(id); return Promise.resolve({ added: 2, merged: 0, flagged: 0, skipped: 0, outcomes: [] }) } },
}))
vi.mock('../../api/webLibrary', () => ({ webLibraryApi: { getDocuments: vi.fn().mockResolvedValue([]) } }))

const { AddSourcesDialog } = await import('./AddSourcesDialog')

afterEach(() => { cleanup(); addProject.mockClear() })

const matrix = (researchProjectId: string | null) => ({ id: 'm1', researchProjectId, consentAccepted: true } as unknown as Matrix)

describe('AddSourcesDialog project tab (research-platform W1.2)', () => {
  it('opens on the linked project and adds its papers', async () => {
    const onAdded = vi.fn()
    render(<AddSourcesDialog matrix={matrix('p1')} onClose={() => {}} onAdded={onAdded} />)
    expect(screen.getByRole('tab', { name: 'From your project' }).getAttribute('aria-selected')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Add project papers' }))
    await waitFor(() => expect(addProject).toHaveBeenCalledWith('m1'))
    expect(onAdded).toHaveBeenCalledWith('2 added.')
  })

  it('has no project tab when the matrix is not linked', () => {
    render(<AddSourcesDialog matrix={matrix(null)} onClose={() => {}} onAdded={() => {}} />)
    expect(screen.queryByRole('tab', { name: 'From your project' })).toBeNull()
    expect(screen.getByRole('tab', { name: 'Saved Sources' }).getAttribute('aria-selected')).toBe('true')
  })
})
