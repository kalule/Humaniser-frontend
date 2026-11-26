import { useEffect, useState } from 'react'
import { literatureReviewApi } from '../../api/literatureReview'
import type { PoolSource } from '../../lib/literatureReview'
import { Chip, Notice } from './ui'

/**
 * Evidence levels (server flag LiteratureReviewStudio:EvidenceLevels): what each source was read from. While the flag is off the
 * server sends no textLevel and nothing here renders.
 */
const WEAK = new Set(['AbstractOnly', 'TitleOnly'])

export function TextLevelBadge({ source }: { source: PoolSource | undefined }) {
  if (!source?.textLevel || !WEAK.has(source.textLevel)) return null
  return <Chip className="ml-1 border-amber-300 bg-amber-50 text-amber-950">{source.textLevel === 'TitleOnly' ? 'Title only' : 'Abstract only'}</Chip>
}

/** "N of M sources are abstract-only. Claims about them are limited." with where to add full texts. */
export function TextLevelSummary({ reviewId, pool, refreshKey }: { reviewId: string; pool?: PoolSource[]; refreshKey?: unknown }) {
  const [loaded, setLoaded] = useState<PoolSource[] | null>(null)
  useEffect(() => {
    if (pool) return
    literatureReviewApi.sources(reviewId).then(setLoaded).catch(() => setLoaded(null))
  }, [reviewId, pool, refreshKey])
  const sources = pool ?? loaded ?? []
  if (!sources.some(s => s.textLevel)) return null
  const weak = sources.filter(s => s.textLevel && WEAK.has(s.textLevel)).length
  if (weak === 0) return null
  return (
    <Notice tone="warning" role="status">
      {weak} of {sources.length} sources are abstract-only. Claims about them are limited.{' '}
      To read one in full, open it in the extraction table below (Extract step) and upload its PDF or fetch the open-access full text.
    </Notice>
  )
}
