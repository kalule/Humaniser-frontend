import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { deepResearchApi } from '../../api/deepResearch'
import { WATCH_EVENT, finishedNotice, unwatchSession, watchedSessionIds } from '../../lib/deepResearchWatch'

const POLL_MS = 12_000

/**
 * Mounted once in the app shell. While the student has Deep Research sessions in progress it checks them
 * every few seconds, wherever they are in the app, and tells them when one ends: an in-app message with a
 * link, a browser notification and a tab-title marker when the tab is in the background. It renders nothing.
 */
export function DeepResearchWatcher() {
  const navigate = useNavigate()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const originalTitle = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const restoreTitle = () => {
      if (originalTitle.current !== null && !document.hidden) {
        document.title = originalTitle.current
        originalTitle.current = null
      }
    }
    document.addEventListener('visibilitychange', restoreTitle)

    const announce = (id: string, session: Parameters<typeof finishedNotice>[0]) => {
      const notice = finishedNotice(session)
      const open = () => navigate(`/app/deep-research?session=${id}`)

      toast.custom(t => (
        <div className={`max-w-sm rounded-xl border border-slate-200 bg-white shadow-lg p-3 flex gap-3 ${t.visible ? 'animate-enter' : 'animate-leave'}`}>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-slate-800">{notice.title}</p>
            <p className="text-[12px] text-slate-500 mt-0.5 line-clamp-2">{notice.body}</p>
            <button onClick={() => { toast.dismiss(t.id); open() }} className="text-[12px] font-medium text-purple-accent hover:underline mt-1">
              View
            </button>
          </div>
        </div>
      ), { duration: 12_000 })

      if (document.hidden) {
        if (originalTitle.current === null) originalTitle.current = document.title
        document.title = `${notice.tone === 'success' ? '✓' : '•'} ${notice.title}`
        try {
          if ('Notification' in window && Notification.permission === 'granted') {
            const n = new Notification(notice.title, { body: notice.body, tag: `deep-research-${id}` })
            n.onclick = () => { window.focus(); open(); n.close() }
          }
        } catch { /* some browsers only allow notifications from a service worker */ }
      }
    }

    const check = async () => {
      const ids = watchedSessionIds()
      for (const id of ids) {
        try {
          const session = await deepResearchApi.get(id)
          if (cancelled) return
          if (session.isFinished) {
            unwatchSession(id)
            announce(id, session)
          }
        } catch (err) {
          // A session that no longer exists will never finish; stop waiting for it. Anything else is retried next time.
          const status = (err as { response?: { status?: number } } | undefined)?.response?.status
          if (status === 404) unwatchSession(id)
        }
      }
      schedule()
    }

    const schedule = () => {
      if (cancelled) return
      if (timer.current) clearTimeout(timer.current)
      if (watchedSessionIds().length > 0) timer.current = setTimeout(() => void check(), POLL_MS)
    }

    // Wake up when a session is added to the watch list, from this tab or another.
    const onWatchChange = () => schedule()
    window.addEventListener(WATCH_EVENT, onWatchChange)
    window.addEventListener('storage', onWatchChange)
    schedule()

    return () => {
      cancelled = true
      if (timer.current) clearTimeout(timer.current)
      document.removeEventListener('visibilitychange', restoreTitle)
      window.removeEventListener(WATCH_EVENT, onWatchChange)
      window.removeEventListener('storage', onWatchChange)
    }
  }, [navigate])

  return null
}
