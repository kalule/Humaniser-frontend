import { useEffect, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { systematicReviewApi } from '../../api/systematicReview'

/**
 * Looks for free, legal full texts (Unpaywall, OpenAlex, Europe PMC) for papers that still need one. No credits and no
 * model call. A copy is only used if it carries the paper's own title; an uploaded PDF is never replaced.
 */
export default function OpenAccessFinder({ reviewId, onFound }: { reviewId: string; onFound: () => void }) {
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!running) return
    let cancelled = false
    let timer: number | null = null
    const poll = async () => {
      try {
        const s = await systematicReviewApi.getOpenAccessLookupStatus(reviewId)
        if (cancelled) return
        if (s.isRunning) { timer = window.setTimeout(poll, 3000); return }
        setRunning(false)
        toast.success(s.foundAutomatically > 0
          ? `${s.foundAutomatically} open-access cop${s.foundAutomatically === 1 ? 'y' : 'ies'} in use; ${s.stillWithoutFullText} paper${s.stillWithoutFullText === 1 ? '' : 's'} still need a PDF.`
          : 'No free copies were found for the remaining papers.')
        onFound()
      } catch {
        if (!cancelled) timer = window.setTimeout(poll, 5000)
      }
    }
    poll()
    return () => { cancelled = true; if (timer) clearTimeout(timer) }
  }, [running, reviewId, onFound])

  const start = async () => {
    try {
      setRunning(true)
      await systematicReviewApi.findOpenAccess(reviewId)
    } catch {
      setRunning(false)
      toast.error('Could not start the open-access search.')
    }
  }

  return (
    <button onClick={start} disabled={running}
      title="Searches Unpaywall, OpenAlex and Europe PMC for free, legal copies. No credits."
      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-amber-accent/40 text-amber-text text-[12px] font-semibold hover:bg-amber-tint/60 transition-colors whitespace-nowrap disabled:opacity-70">
      {running ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
      {running ? 'Searching…' : 'Find free copies'}
    </button>
  )
}
