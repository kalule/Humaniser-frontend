import type { WriteWithAiResponse } from '../types/workbench'

/**
 * An essay draft is sent as soon as it is written ({ draft } stream frame, completionStatus 'Checking'), about a minute and a half
 * before claim checking finishes. The editor shows it read-only; the checked result replaces it.
 */
export function isDraftPreview(result: Pick<WriteWithAiResponse, 'completionStatus'>): boolean {
  return result.completionStatus === 'Checking'
}

/** The run stopped while a draft was still being checked, so the checked version will not arrive: unlock the draft and say so. */
export function checkingDraftEnded(checkingDraft: boolean, busy: boolean): boolean {
  return checkingDraft && !busy
}

export const CHECKING_BANNER = 'Your draft is ready to read. Its citations are being checked against their sources; editing unlocks when that finishes.'
export const CHECK_STOPPED_MESSAGE = 'Checking stopped before it finished. You can edit the draft, but not every citation in it has been verified.'
