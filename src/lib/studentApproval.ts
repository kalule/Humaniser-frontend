import type { ProjectSection } from '../types/research'

/**
 * Which approvals the student made. The server's Approved status does not say who approved: the
 * automatic whole-proposal run (Research:AutonomousProposal:AutoApprove) approves its own drafts
 * too. The Document view shows a section as Approved only when the student approved this version
 * of it; one the run approved shows as Ready for review until the student approves it.
 *
 * Stored on the project's synced sectionContent (key STUDENT_APPROVED_KEY) as
 * { code: generatedAt at approval, '' when the section was never generated }, written by the store's
 * approveSection, so Guided and Document approvals both count. A rewrite changes generatedAt, so
 * a section the student approved and the run later redrafted and re-approved needs their approval again.
 */
export const STUDENT_APPROVED_KEY = 'studentApproved'

export type StudentApprovals = Record<string, string>

export function readStudentApprovals(content: Record<string, string> | undefined | null): StudentApprovals {
  const raw = content?.[STUDENT_APPROVED_KEY]
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: StudentApprovals = {}
    for (const [code, stamp] of Object.entries(parsed)) if (typeof stamp === 'string') out[code] = stamp
    return out
  } catch {
    return {}
  }
}

export const recordStudentApproval = (
  approvals: StudentApprovals, section: Pick<ProjectSection, 'code' | 'generatedAt'>,
): StudentApprovals => ({ ...approvals, [section.code]: section.generatedAt ?? '' })

/** True when the student approved this version of the section (the server may also have approved it). */
export const isStudentApproved = (approvals: StudentApprovals, section: Pick<ProjectSection, 'code' | 'generatedAt'>) =>
  section.code in approvals && approvals[section.code] === (section.generatedAt ?? '')
