import { describe, expect, it } from 'vitest'
import {
  changedFields, clearStale, DESIGN_CONTRACT_KEY, propagateStale, readContract, readEditedAfterApproval, readStale,
  serializeCodes, serializeContract, STALE_KEY, EDITED_AFTER_APPROVAL_KEY,
} from './designContract'

const section = (code: string, content = 'Some text.', status: 'Draft' | 'Approved' | 'NotStarted' | 'Generating' | 'Edited' = 'Draft') =>
  ({ code, content, status })

describe('design contract storage', () => {
  it('round-trips through sectionContent and drops empty and unknown fields', () => {
    const raw = serializeContract({ software: '  SPSS ', sampleSize: '', designType: 'Survey' })
    expect(JSON.parse(raw)).toEqual({ designType: 'Survey', software: 'SPSS' })
    expect(readContract({ [DESIGN_CONTRACT_KEY]: JSON.stringify({ software: 'SPSS', bogus: 'x', sampleSize: 3 }) })).toEqual({ software: 'SPSS' })
  })

  it('reads nothing from a missing or malformed value', () => {
    expect(readContract(undefined)).toEqual({})
    expect(readContract({ [DESIGN_CONTRACT_KEY]: 'not json' })).toEqual({})
    expect(readStale({ [STALE_KEY]: '[1,2]' })).toEqual({})
    expect(readEditedAfterApproval({ [EDITED_AFTER_APPROVAL_KEY]: '{"a":1}' })).toEqual([])
    expect(readEditedAfterApproval({ [EDITED_AFTER_APPROVAL_KEY]: serializeCodes(['5.6', '5.6', '5.9']) })).toEqual(['5.6', '5.9'])
  })
})

describe('changedFields', () => {
  it('ignores case and spacing, and compares variable lists as sets', () => {
    expect(changedFields({ software: 'SPSS' }, { software: ' spss ' })).toEqual([])
    expect(changedFields({ controls: 'Firm size, Sector' }, { controls: 'sector; firm size' })).toEqual([])
    expect(changedFields({ controls: 'Firm size' }, { controls: 'Firm size, Firm age' })).toEqual(['controls'])
    expect(changedFields({ software: 'SPSS' }, {})).toEqual(['software'])
  })
})

describe('stale propagation from contract edits', () => {
  const sections = [
    section('5.5'), section('5.6'), section('5.9', 'x', 'Approved'), section('5.10'),
    section('6.2', ''),                       // not drafted: reads the new contract when drafted
    section('5.8', 'partial', 'Generating'),   // being written: not marked while streaming
  ]

  it('marks every drafted section that states the changed field, with the field label', () => {
    const marks = propagateStale({}, ['software'], sections)
    expect(Object.keys(marks).sort()).toEqual(['5.10', '5.9'])
    expect(marks['5.9']).toEqual(['Analysis software'])
  })

  it('never marks undrafted or streaming sections', () => {
    const marks = propagateStale({}, ['sampleSize', 'dataCollector'], sections)
    expect(marks['6.2']).toBeUndefined()
    expect(marks['5.8']).toBeUndefined()
    expect(marks['5.5']).toEqual(['Sample size'])
  })

  it('merges with earlier marks so two edits before a review list both fields', () => {
    const first = propagateStale({}, ['software'], sections)
    const second = propagateStale(first, ['dataCollector', 'software'], sections)
    expect(second['5.9']).toEqual(['Analysis software', 'Who collects the data'])
    expect(second['5.10']).toEqual(['Analysis software', 'Who collects the data'])
  })

  it('clearing one section leaves the others marked', () => {
    const marks = propagateStale({}, ['software'], sections)
    const cleared = clearStale(marks, '5.9')
    expect(cleared['5.9']).toBeUndefined()
    expect(cleared['5.10']).toEqual(['Analysis software'])
    expect(clearStale(cleared, 'nope')).toBe(cleared)
  })
})
