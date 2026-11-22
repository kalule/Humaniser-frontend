import type { ProposalIssue } from '../types/research'

/**
 * Notes, not defects: the proposal can be submitted as it is, and the student only needs to know. They are listed
 * apart and never counted as open issues (proposal fix spec 2026-11-22, R13).
 */
const INFORMATIONAL_TYPES = new Set([
  'section_rule_abstract_optional',
  'section_rule_abstract_not_required',
  'quality_br58', // appendices: advice on what an interview study usually attaches
])

export function isInformational(issue: ProposalIssue): boolean {
  return issue.severity !== 'Blocking' && INFORMATIONAL_TYPES.has(issue.type)
}

export interface IssueGroup {
  type: string
  issues: ProposalIssue[]
}

export interface TriagedIssues {
  blocking: IssueGroup[]
  review: IssueGroup[]
  notes: ProposalIssue[]
  /** Open issues only: blocking plus to-review. Notes are excluded. */
  openCount: number
}

/**
 * Splits issues by severity and groups repeats of one check ("Nearly the same sentence appears in N sections",
 * five times) into a single entry, keeping first-seen order. Nothing is dropped: a group holds every issue.
 */
export function triageIssues(issues: ProposalIssue[]): TriagedIssues {
  const group = (list: ProposalIssue[]): IssueGroup[] => {
    const byType = new Map<string, IssueGroup>()
    for (const issue of list) {
      const g = byType.get(issue.type)
      if (g) g.issues.push(issue)
      else byType.set(issue.type, { type: issue.type, issues: [issue] })
    }
    return [...byType.values()]
  }
  const notes = issues.filter(isInformational)
  const open = issues.filter(i => !isInformational(i))
  const blocking = group(open.filter(i => i.severity === 'Blocking'))
  const review = group(open.filter(i => i.severity !== 'Blocking'))
  return { blocking, review, notes, openCount: open.length }
}
