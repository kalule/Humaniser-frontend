import { describe, expect, it } from 'vitest'
import { FORMAT_STYLES } from '../../types/citation'
import { paperCitation } from './paperCitation'

const paper = { title: 'Assessment and anxiety', authors: ['Jane Smith', 'Kim Jones'],
  year: 2023, journal: 'Journal of Learning', doi: '10.1234/assessment' }

describe('Web Library CSL preview', () => {
  it.each(FORMAT_STYLES)('renders both copyable labels with the %s preset', style => {
    const rendered = paperCitation(paper, style)!
    expect(rendered.inText).toBeTruthy()
    expect(rendered.reference.toLowerCase()).toContain('assessment and anxiety')
    expect(rendered.reference).toContain('10.1234/assessment')
  })

  it('preserves boundaries between full author names and surname-first names', () => {
    expect(paperCitation(paper, 'apa7')!.inText).toBe('(Smith & Jones, 2023)')
    expect(paperCitation({ ...paper, authors: ['Smith, Jane', 'Jones, Kim'] }, 'apa7')!.inText)
      .toBe('(Smith & Jones, 2023)')
  })

  it('retains a corporate author and does not fabricate missing author or year metadata', () => {
    expect(paperCitation({ title: 'Education policy', authors: ['United Nations'], year: 2024 }, 'apa7')!.inText)
      .toBe('(United Nations, 2024)')
    const anonymous = paperCitation({ title: 'Education policy', authors: [] }, 'apa7')!
    expect(anonymous.inText).toContain('n.d.')
    expect(anonymous.reference).not.toContain('Unknown author')
  })

  it('returns no copyable citation for invalid metadata and isolates numeric previews', () => {
    expect(paperCitation({ title: ' ', authors: [] }, 'apa7')).toBeNull()
    expect(paperCitation(paper, 'ieee')!.inText).toBe('[1]')
    expect(paperCitation({ ...paper, title: 'Another paper' }, 'ieee')!.inText).toBe('[1]')
  })
})
