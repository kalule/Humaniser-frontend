import type { ProposalIssue, ProposalIssues } from '../types/research'

/**
 * PR 9 (2026-11-24): the issue report, a separate download, so the exported proposal itself carries no "DRAFT / unresolved
 * issues" banner. Built in the browser from the issue list the Download step already loaded; nothing new is fetched.
 */

const readable = (type: string) => type.replace(/^section_rule_/, '').replace(/_/g, ' ')

const line = (i: ProposalIssue) =>
  `- **${i.sectionKey}** · ${readable(i.type)}: ${i.message}${i.evidence ? `\n  > ${i.evidence.replace(/\s+/g, ' ').slice(0, 300)}` : ''}`

export function buildIssueReport(issues: ProposalIssues, title: string, now: Date = new Date()): string {
  const open = issues.issues.filter(i => !i.dismissed)
  const blocking = open.filter(i => i.severity === 'Blocking')
  const review = open.filter(i => i.severity !== 'Blocking')
  const dismissed = issues.issues.filter(i => i.dismissed)
  const parts = [
    `# Issue report: ${title}`,
    '',
    `Checked ${now.toISOString().slice(0, 10)}. ${open.length} open issue${open.length === 1 ? '' : 's'} (${blocking.length} blocking, ${review.length} to review)` +
      (dismissed.length ? `, ${dismissed.length} dismissed.` : '.'),
    '',
    'This report lists what the automatic checks found. It is not a validation of the proposal.',
  ]
  const group = (heading: string, list: ProposalIssue[]) => {
    if (list.length === 0) return
    parts.push('', `## ${heading} (${list.length})`, '', ...[...list].sort((a, b) => a.sectionKey.localeCompare(b.sectionKey, undefined, { numeric: true })).map(line))
  }
  group('Blocking', blocking)
  group('To review', review)
  group('Dismissed after a repair attempt', dismissed)
  if (issues.notApplicable?.length) parts.push('', `Not applicable to this design: ${issues.notApplicable.map(readable).join(', ')}.`)
  return parts.join('\n') + '\n'
}

/** Saves the report as a Markdown file. */
export function downloadIssueReport(issues: ProposalIssues, title: string): void {
  const blob = new Blob([buildIssueReport(issues, title)], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `issue-report-${new Date().toISOString().slice(0, 10)}.md`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
