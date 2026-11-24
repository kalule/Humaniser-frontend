// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { CitationCard } from './CitationCard'
import type { CitationCardEntry } from '../../../lib/citationCard'

const base: CitationCardEntry = {
  clause: 'Klishi, 2024', title: 'Retail costs', authors: 'Lindiwe Klishi', year: 2024, sourceExists: true, ambiguous: false,
  fullTextPinned: false, support: 'not_supported', note: null, journal: 'Journal of Retail', doi: '10.1/klishi',
  evidenceLevel: 'Observational study', verification: 'mismatch', passage: { quote: 'Costs fell in 2023.', location: 'p. 4' },
  qualityFlags: ['Retracted'],
}

describe('CitationCard source details (PR 10)', () => {
  afterEach(cleanup)

  it('shows authors, journal, DOI, evidence level, the verification status and the supporting passage', () => {
    render(<CitationCard entries={[base]} swapTo={[]} canSwap={false} onSwap={vi.fn()} onClose={vi.fn()} style={{}}
      onPointerEnter={vi.fn()} onPointerLeave={vi.fn()} />)
    const meta = screen.getByTestId('citation-source-meta').textContent
    expect(meta).toContain('Lindiwe Klishi')
    expect(meta).toContain('Journal of Retail · DOI 10.1/klishi')
    expect(meta).toContain('Evidence: Observational study')
    expect(screen.getByText('Mismatch')).toBeTruthy()
    expect(screen.getByText('Retracted')).toBeTruthy()
    expect(screen.getByText(/Costs fell in 2023\./).textContent).toContain('(p. 4)')
  })

  it('shows no source details for a citation that matches no source', () => {
    render(<CitationCard entries={[{ ...base, sourceExists: false, verification: 'unchecked', passage: null }]} swapTo={[]} canSwap={false}
      onSwap={vi.fn()} onClose={vi.fn()} style={{}} onPointerEnter={vi.fn()} onPointerLeave={vi.fn()} />)
    expect(screen.queryByTestId('citation-source-meta')).toBeNull()
    expect(screen.queryByText('Unchecked')).toBeNull()
  })
})
