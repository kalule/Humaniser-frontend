// @vitest-environment jsdom
import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { EssayQuestionCheckResult } from '../../api/essayQuestionCheck'

const check = vi.fn<(r: unknown) => Promise<EssayQuestionCheckResult>>()
const createDocument = vi.fn()

vi.mock('../../api/essayQuestionCheck', () => ({ essayQuestionCheckApi: { check: (r: unknown) => check(r) } }))
vi.mock('../../store/libraryStore', () => ({
  useLibraryStore: (pick: (s: unknown) => unknown) => pick({ createDocument }),
}))

const { CreationCard } = await import('./CreationCard')

const warn: EssayQuestionCheckResult = {
  available: true, overallPercent: 74, classification: 'Good', gate: 'Warn', canOverride: true, gateReasons: ['NEEDS_REFINEMENT'], promptVersion: 'v',
  assessment: {
    specificityScore: 4, academicDepthScore: 4, searchabilityScore: 4, researchabilityScore: 3, scopeFeasibilityScore: 3,
    conceptualClarityScore: 4, answerabilityScore: 4, criticalFlags: [], critique: 'A well-defined empirical question.',
    questionInterpretation: '', questionType: 'Empirical', commandWords: ['evaluate'], academicDiscipline: 'Psychology',
    centralConcepts: [], missingContext: [], suggestedPromptMode: 'Rewrites',
    suggestedPrompts: ['Rewrite one.', 'Rewrite two.', 'Rewrite three.'], searchKeywords: [],
    essayReadiness: 'NeedsRefinement', readinessExplanation: '', requiresClarification: false, clarificationQuestion: null,
  },
}

afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('CreationCard question check', () => {
  // Regression: under StrictMode's mount, unmount, remount the card believed it was closed and stayed on
  // "Checking questionâ€¦" forever after the check returned.
  it('shows the check result after the request finishes, under StrictMode', async () => {
    check.mockResolvedValue(warn)
    render(<StrictMode><MemoryRouter><CreationCard onClose={() => {}} /></MemoryRouter></StrictMode>)

    fireEvent.change(screen.getByLabelText(/Your essay question/), { target: { value: 'Evaluate the relationship between short-form video and sleep.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Write essay' }))

    expect(await screen.findByText('A well-defined empirical question.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Write anyway' })).toBeTruthy()
    expect(screen.queryByText('Checking questionâ€¦')).toBeNull()
    expect(createDocument).not.toHaveBeenCalled()
  })

  it('a suggestion replaces the question and clears the result', async () => {
    check.mockResolvedValue(warn)
    render(<StrictMode><MemoryRouter><CreationCard onClose={() => {}} /></MemoryRouter></StrictMode>)
    fireEvent.change(screen.getByLabelText(/Your essay question/), { target: { value: 'Short video and sleep' } })
    fireEvent.click(screen.getByRole('button', { name: 'Write essay' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Rewrite two.' }))

    await waitFor(() => expect((screen.getByLabelText(/Your essay question/) as HTMLTextAreaElement).value).toBe('Rewrite two.'))
    expect(screen.getByRole('button', { name: 'Write essay' })).toBeTruthy()
  })
})
