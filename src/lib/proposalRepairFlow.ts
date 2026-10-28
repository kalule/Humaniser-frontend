import type { RepairReport } from '../types/research'

export type AfterRepair = 'skipped' | 'confirm-warnings' | 'download'

/**
 * What the Download step does once a repair run returns. A document with blocking issues left is never downloaded
 * silently: the student must confirm. A skipped run (strict-workflow or non-proposal project) changes nothing and
 * does not download on its own either, because the student asked for a fix, not for the unrepaired file.
 */
export function nextActionAfterRepair(report: Pick<RepairReport, 'skipped' | 'blockingRemaining'>): AfterRepair {
  if (report.skipped) return 'skipped'
  return report.blockingRemaining > 0 ? 'confirm-warnings' : 'download'
}
