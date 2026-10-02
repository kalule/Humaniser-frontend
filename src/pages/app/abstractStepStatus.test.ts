import { describe, expect, it } from 'vitest'
import { isAbstractStepLocked } from './abstractStepStatus'

describe('Abstract StepRail availability', () => {
  describe('Thesis/Dissertation', () => {
    it('is locked until Conclusion and Recommendations are both approved', () => {
      expect(isAbstractStepLocked([], 'Thesis')).toBe(true)
      expect(isAbstractStepLocked([
        { code: '8.0', status: 'Approved' },
        { code: '8.1', status: 'Draft' },
      ], 'Thesis')).toBe(true)
    })

    it('is unlocked once Conclusion and Recommendations are both approved', () => {
      expect(isAbstractStepLocked([
        { code: '8.0', status: 'Approved' },
        { code: '8.1', status: 'Approved' },
      ], 'Thesis')).toBe(false)
      expect(isAbstractStepLocked([
        { code: '8.0', status: 'Approved' },
        { code: '8.1', status: 'Approved' },
      ], 'Dissertation')).toBe(false)
    })
  })

  describe('Proposal', () => {
    const allApprovedExceptDesign = [
      { code: '3.1', status: 'Approved' },
      { code: '3.2', status: 'Approved' },
      { code: '4.2', status: 'Approved' },
      { code: '4.3', status: 'Approved' },
      { code: '5.2', status: 'Draft' },
    ]
    const allApproved = allApprovedExceptDesign.map(s => ({ ...s, status: 'Approved' }))

    it('is locked until Problem Statement, Justification, Objectives, and Study Design are all approved', () => {
      expect(isAbstractStepLocked([], 'Proposal')).toBe(true)
      expect(isAbstractStepLocked(allApprovedExceptDesign, 'Proposal')).toBe(true)
      // Thesis-only prerequisites being approved must not unlock a Proposal-stage Abstract —
      // there is no Conclusion/Recommendations chapter to check yet at this stage.
      expect(isAbstractStepLocked([
        { code: '8.0', status: 'Approved' },
        { code: '8.1', status: 'Approved' },
      ], 'Proposal')).toBe(true)
    })

    it('is unlocked once Problem Statement, Justification, Objectives, and Study Design are all approved', () => {
      expect(isAbstractStepLocked(allApproved, 'Proposal')).toBe(false)
    })
  })
})
