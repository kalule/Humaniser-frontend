import { describe, expect, it } from 'vitest'
import type { ProjectSection, SectionStatus } from '../types/research'
import { documentCounts, outlineProgress } from './documentOutline'

const sec = (code: string, status: SectionStatus, content = '', applicable = true) =>
  ({ code, status, content, isApplicableForMethodology: applicable }) as unknown as ProjectSection

describe('documentCounts: one source of truth for the outline and the agent panel', () => {
  const sections = [
    sec('0.0', 'Approved', 'Abstract'),
    sec('1.0', 'Approved', 'Intro'),
    sec('1.2', 'Draft', 'Background'),
    sec('2.0', 'Generating', 'partial'),
    sec('3.1', 'NotStarted', ''),
    sec('3.2', 'NotStarted', 'interrupted text'),
    sec('4.4', 'NotStarted', '', false), // not applicable to the methodology
    sec('defence', 'NotStarted', ''),    // opens its own tool
  ]

  it('counts the same total the outline shows, with drafted and writing beside it', () => {
    expect(documentCounts(sections)).toEqual({ total: 6, approved: 2, drafted: 4, writing: 1 })
  })

  it('outlineProgress is derived from it, so the two cannot disagree', () => {
    const c = documentCounts(sections)
    expect(outlineProgress(sections)).toEqual({ approved: c.approved, total: c.total })
  })
})
