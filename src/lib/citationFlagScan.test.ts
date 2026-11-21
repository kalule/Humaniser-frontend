import { describe, expect, it, vi } from 'vitest'
import type { CitationFlag } from '../types/research'
import { citationFlagsBySection } from './citationFlagScan'

const flag = (sectionCode: string, id = `${sectionCode}-f`) => ({ id, sectionCode, status: 'Open', mismatchTypes: ['ClaimContentMismatch'] } as unknown as CitationFlag)
const CODES = Array.from({ length: 26 }, (_, i) => `c${i}`)

describe('Download step citation-flag scan', () => {
  it('makes one request for every chapter instead of one per chapter', async () => {
    const source = {
      getSectionCitationFlags: vi.fn().mockResolvedValue([flag('c1'), flag('c1', 'second'), flag('c5')]),
      getCitationFlags: vi.fn(),
    }

    const bySection = await citationFlagsBySection('p1', CODES, source)

    expect(source.getSectionCitationFlags).toHaveBeenCalledTimes(1)
    expect(source.getCitationFlags).not.toHaveBeenCalled()
    expect(bySection.get('c1')).toHaveLength(2)
    expect(bySection.get('c5')).toHaveLength(1)
    expect(bySection.get('c0')).toEqual([])
    expect(bySection.size).toBe(26)
  })

  it('ignores flags for sections it was not asked about', async () => {
    const source = { getSectionCitationFlags: vi.fn().mockResolvedValue([flag('other')]), getCitationFlags: vi.fn() }
    const bySection = await citationFlagsBySection('p1', ['c0'], source)
    expect([...bySection.keys()]).toEqual(['c0'])
    expect(bySection.get('c0')).toEqual([])
  })

  it('falls back to per-chapter requests when the all-sections request fails', async () => {
    const source = {
      getSectionCitationFlags: vi.fn().mockRejectedValue(new Error('404')),
      getCitationFlags: vi.fn(async (_p: string, code: string) => (code === 'c2' ? [flag('c2')] : [])),
    }

    const bySection = await citationFlagsBySection('p1', ['c1', 'c2'], source)

    expect(source.getCitationFlags).toHaveBeenCalledTimes(2)
    expect(bySection.get('c2')).toHaveLength(1)
  })
})
