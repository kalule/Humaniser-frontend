import type { SystematicReviewDetail } from '../types/systematicReview'

/**
 * A completed pipeline step whose inputs have grown since it ran.
 *
 * Steps here keep their green tick and their old numbers once they have run, so a fetch that adds
 * papers leaves Deduplication & filters reading "423 ready · 1138 removed" while the review actually
 * holds 1,896 records. That is how a live review looked broken on 2026-09-05: the corpus had been
 * repaired, but every downstream count still described the corpus before the repair, and nothing in
 * the UI said the step was merely out of date rather than finished.
 *
 * Deliberately advisory. Nothing is auto-invalidated and no PRISMA history is discarded — the
 * numbers a completed run produced remain exactly what that run produced. This only says "there is
 * newer input than this ran over", the same distinction the research dashboard's validation panel
 * already draws with its Current / OutOfDate freshness.
 */
export interface StepStaleness {
  /** Papers fetched since Deduplication & filters last ran. */
  dedupPending: number
  /** Papers made ready by dedup since Title & abstract screening last ran. */
  screeningPending: number
}

export function computeStepStaleness(detail: SystematicReviewDetail): StepStaleness {
  const dedup = detail.latestDedupeRun

  // Compared against what the run itself recorded seeing, not against a timestamp: a re-run over an
  // unchanged corpus should never read as stale, and clock skew should never make it read as fresh.
  const dedupPending = dedup ? Math.max(0, detail.paperCount - dedup.fetchedRecordCount) : 0

  const screeningPending = dedup && detail.screeningSummary
    ? Math.max(0, dedup.readyForScreeningCount - detail.screeningSummary.total)
    : 0

  return { dedupPending, screeningPending }
}
