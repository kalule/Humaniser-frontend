import { useCallback, useEffect, useState } from 'react'
import { literatureReviewApi } from '../api/literatureReview'
import type { SourceCheck } from '../lib/literatureReview'

/** The review's source check, or null while the server flag (LiteratureReviewStudio:SourceGate) is off or the call fails. */
export function useSourceCheck(reviewId: string, refreshKey: unknown = null) {
  const [check, setCheck] = useState<SourceCheck | null>(null)
  const load = useCallback(() => { literatureReviewApi.sourceCheck(reviewId).then(setCheck).catch(() => setCheck(null)) }, [reviewId])
  useEffect(() => { load() }, [load, refreshKey])
  return { check: check?.enabled ? check : null, reload: load }
}
