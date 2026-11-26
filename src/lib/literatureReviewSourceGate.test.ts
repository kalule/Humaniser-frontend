import { describe, expect, it } from 'vitest'
import { gateRefusal } from './literatureReview'

describe('gateRefusal', () => {
  it('reads the source gate codes the server puts on a 409', () => {
    expect(gateRefusal({ code: 'ERROR', message: 'Only 6 sources.', serverCode: 'SOURCE_GATE' })).toBe('SOURCE_GATE')
    expect(gateRefusal({ code: 'ERROR', message: 'These themes rest on fewer than 3 sources.', serverCode: 'THIN_THEMES' })).toBe('THIN_THEMES')
  })
  it('ignores every other error', () => {
    expect(gateRefusal({ code: 'ERROR', message: 'x', serverCode: 'EXPORT_BLOCKED' })).toBeNull()
    expect(gateRefusal(new Error('Network Error'))).toBeNull()
    expect(gateRefusal(null)).toBeNull()
  })
})
