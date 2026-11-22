import { describe, expect, it } from 'vitest'
import { sectionCheckLink, sectionFromLink } from './citationCheckView'

describe('section check link (research-platform W5)', () => {
  it('round-trips the project, section and label', () => {
    const link = sectionCheckLink('p-1', '2.0', '2.0 Literature Review & Gaps')
    expect(link.startsWith('/app/citation-check?')).toBe(true)
    expect(sectionFromLink(new URLSearchParams(link.split('?')[1]))).toEqual({ projectId: 'p-1', sectionCode: '2.0', label: '2.0 Literature Review & Gaps' })
  })

  it('is null on the page opened on its own, and names the section when no label came', () => {
    expect(sectionFromLink(new URLSearchParams(''))).toBeNull()
    expect(sectionFromLink(new URLSearchParams('projectId=p&section=5.1'))?.label).toBe('Section 5.1')
  })
})
