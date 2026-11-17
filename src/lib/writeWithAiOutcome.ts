import type { WriteWithAiResponse } from '../types/workbench'

/** Reject empty responses before the editor can replace the existing document. */
export function assertWritableDraft(result: WriteWithAiResponse): void {
  if (result.coWrite) return
  const hasDraft = Boolean(result.content?.trim() ||
    Object.values(result.sections ?? {}).some(text => typeof text === 'string' && text.trim()) ||
    Object.values(result.caseSections ?? {}).some(text => typeof text === 'string' && text.trim()) ||
    Object.values(result.researchPaperSections ?? {}).some(text => typeof text === 'string' && text.trim()) ||
    result.literatureReviewSections?.some(section => section.content?.trim()))
  if (hasDraft) return
  const reason = result.completionReason?.trim() ||
    result.essayFlags?.find(flag => flag.code === 'EssayIncomplete')?.message?.trim()
  throw new Error(reason || 'No draft was returned. Please try again.')
}
