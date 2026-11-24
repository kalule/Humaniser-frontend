import { describe, expect, it } from 'vitest'
import { DOCUMENT_STATUS_LABELS, hasSectionBody, withApprovalSource, withReviewMarks, type DocumentSectionStatus } from './sectionWorkflow'
import { isStudentApproved, readStudentApprovals, recordStudentApproval, STUDENT_APPROVED_KEY } from './studentApproval'

const none = { stale: false, editedAfterApproval: false }

describe('status transitions with review marks', () => {
  it('editing an approved section shows "Edited after approval"; approving again returns it to Approved', () => {
    expect(withReviewMarks('approved', none)).toBe('approved')
    expect(withReviewMarks('approved', { stale: false, editedAfterApproval: true })).toBe('edited_after_approval')
    // A material edit demotes it server-side (Edited -> needs_review); the mark still says why.
    expect(withReviewMarks('needs_review', { stale: false, editedAfterApproval: true })).toBe('edited_after_approval')
    // Approve clears the mark.
    expect(withReviewMarks('approved', none)).toBe('approved')
  })

  it('a contract change marks a drafted section stale, over any other mark, until reviewed or rewritten', () => {
    expect(withReviewMarks('approved', { stale: true, editedAfterApproval: true })).toBe('stale')
    expect(withReviewMarks('needs_review', { stale: true, editedAfterApproval: false })).toBe('stale')
    expect(withReviewMarks('needs_review', none)).toBe('needs_review')
  })

  it('sections without text never take a review mark', () => {
    for (const status of ['not_started', 'up_next', 'writing', 'locked'] as DocumentSectionStatus[]) {
      expect(withReviewMarks(status, { stale: true, editedAfterApproval: true })).toBe(status)
      expect(hasSectionBody(status)).toBe(false)
    }
  })

  it('every status has a text label (status is never shown by colour alone)', () => {
    const all: DocumentSectionStatus[] = ['not_started', 'up_next', 'writing', 'needs_review', 'approved', 'locked', 'edited_after_approval', 'stale']
    for (const s of all) expect(DOCUMENT_STATUS_LABELS[s]).toMatch(/\w/)
    expect(DOCUMENT_STATUS_LABELS.edited_after_approval).toBe('Edited after approval')
    expect(DOCUMENT_STATUS_LABELS.stale).toBe('May be out of date')
  })
})

describe('approved vs ready for review (status mapping)', () => {
  it('server Approved shows Approved only when the student approved it', () => {
    expect(withApprovalSource('approved', true)).toBe('approved')
    expect(withApprovalSource('approved', false)).toBe('needs_review')
    expect(DOCUMENT_STATUS_LABELS[withApprovalSource('approved', false)]).toBe('Ready for review')
    for (const other of ['needs_review', 'writing', 'not_started', 'locked'] as DocumentSectionStatus[]) {
      expect(withApprovalSource(other, false)).toBe(other)
    }
  })

  it('records the version the student approved, so a later redraft needs approving again', () => {
    const approvals = recordStudentApproval({}, { code: '1.0', generatedAt: '2026-11-24T08:00:00Z' })
    expect(isStudentApproved(approvals, { code: '1.0', generatedAt: '2026-11-24T08:00:00Z' })).toBe(true)
    expect(isStudentApproved(approvals, { code: '1.0', generatedAt: '2026-11-24T09:00:00Z' })).toBe(false)
    expect(isStudentApproved(approvals, { code: '1.2', generatedAt: null })).toBe(false)
    expect(readStudentApprovals({ [STUDENT_APPROVED_KEY]: JSON.stringify(approvals) })).toEqual(approvals)
    expect(readStudentApprovals({ [STUDENT_APPROVED_KEY]: 'not json' })).toEqual({})
  })
})
