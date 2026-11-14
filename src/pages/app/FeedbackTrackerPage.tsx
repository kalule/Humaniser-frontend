import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { feedbackTrackerApi } from '../../api/feedbackTracker'
import { NewChecklistForm } from '../../components/feedbackTracker/NewChecklistForm'
import { ThreadView } from '../../components/feedbackTracker/ThreadView'
import { ComingSoon } from '../../components/app/ToolGate'
import { Skeleton } from '../../components/ui/Skeleton'
import { failureMessage, type FeedbackThread, type FeedbackThreadSummary } from '../../lib/feedbackTracker'
import { formatShortDate } from '../../lib/utils'

/** Shown before any checklist exists; a checklist carries the server's own value. */
const DEFAULT_RETENTION_DAYS = 180

type Load<T> = { state: 'loading' } | { state: 'ready'; value: T } | { state: 'off' } | { state: 'missing' } | { state: 'error'; message: string }

const status = (e: unknown) => (e as { response?: { status?: number } })?.response?.status
/** A bare 404 (no body) is the server saying the feature is switched off; a 404 with a message is a missing checklist. */
const isOff = (e: unknown) => status(e) === 404

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="h-full overflow-y-auto bg-white"><div className="px-4 py-6 sm:px-6 sm:py-8"><div className="mx-auto max-w-4xl">{children}</div></div></div>
}

/**
 * Feedback Tracker: a supervisor's comments become a checklist, and each later version of the draft is checked
 * against it. `/app/feedback-tracker` lists checklists and starts a new one; `/app/feedback-tracker/:id` is one checklist.
 */
export default function FeedbackTrackerPage() {
  const { id } = useParams<{ id: string }>()
  return id ? <ThreadRoute key={id} id={id} /> : <ListRoute />
}

function ListRoute() {
  const navigate = useNavigate()
  const [list, setList] = useState<Load<FeedbackThreadSummary[]>>({ state: 'loading' })

  const load = useCallback(() => {
    setList({ state: 'loading' })
    feedbackTrackerApi.list()
      .then(value => setList({ state: 'ready', value }))
      .catch(e => setList(isOff(e) ? { state: 'off' } : { state: 'error', message: failureMessage(e, 'load') }))
  }, [])
  useEffect(load, [load])

  if (list.state === 'loading') return <Frame><Skeleton lines={6} tone="light" /></Frame>
  if (list.state === 'off') return <ComingSoon tool="feedback-tracker" />
  if (list.state !== 'ready') {
    return (
      <Frame>
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-[14px] text-red-800">
          {list.state === 'error' ? list.message : 'This could not be loaded.'}{' '}
          <button type="button" onClick={load} className="font-semibold underline">Try again</button>
        </div>
      </Frame>
    )
  }

  const threads = list.value
  return (
    <Frame>
      {/* The app header already shows "Feedback Tracker" as the page's h1. */}
      <p className="max-w-3xl text-[15px] text-slate-800">
        Turn your supervisor's comments into a checklist, then check each new version of your draft against it.
      </p>
      <p className="mt-2 max-w-3xl rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[13px] text-slate-800">
        It restates what your supervisor asked for and adds no feedback of its own. For new feedback on a draft, use <Link to="/app/reviewer" className="font-medium text-purple-deep underline">Reviewer</Link>.
      </p>

      {threads.length > 0 ? (
        <section aria-labelledby="ft-list-title" className="mt-6">
          <h2 id="ft-list-title" className="text-[16px] font-semibold text-slate-900">Your checklists</h2>
          <ul className="mt-2 divide-y divide-slate-200 rounded-xl border border-slate-200">
            {threads.map(t => (
              <li key={t.id}>
                <Link to={`/app/feedback-tracker/${t.id}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-4 py-3 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-accent/40">
                  <span className="min-w-0 text-[15px] font-semibold text-purple-deep underline">{t.title}</span>
                  <span className="text-[13px] text-slate-700">
                    {t.addressedCount} of {t.itemCount} marked done · {t.draftCount} {t.draftCount === 1 ? 'version' : 'versions'} · last used {formatShortDate(t.updatedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="ft-new-title-heading" className="mt-7">
        <h2 id="ft-new-title-heading" className="mb-3 text-[16px] font-semibold text-slate-900">{threads.length > 0 ? 'Start another checklist' : 'Start a checklist'}</h2>
        <NewChecklistForm retentionDays={DEFAULT_RETENTION_DAYS} onCreated={thread => navigate(`/app/feedback-tracker/${thread.id}`, { state: { thread } })} />
      </section>
    </Frame>
  )
}

function ThreadRoute({ id }: { id: string }) {
  const navigate = useNavigate()
  const [thread, setThread] = useState<Load<FeedbackThread>>({ state: 'loading' })

  const load = useCallback(() => {
    setThread({ state: 'loading' })
    feedbackTrackerApi.get(id)
      .then(value => setThread({ state: 'ready', value }))
      .catch(e => {
        if (isOff(e)) setThread({ state: 'off' })
        // A missing or foreign checklist arrives as the server's own "not found" message, with the status stripped by the client.
        else if ((e as { message?: string })?.message?.toLowerCase().includes('not found')) setThread({ state: 'missing' })
        else setThread({ state: 'error', message: failureMessage(e, 'load') })
      })
  }, [id])
  useEffect(load, [load])

  if (thread.state === 'loading') return <Frame><Skeleton lines={8} tone="light" /></Frame>
  if (thread.state === 'off') return <ComingSoon tool="feedback-tracker" />
  if (thread.state === 'missing') {
    return (
      <Frame>
        <div role="alert" className="rounded-lg border border-slate-300 bg-slate-50 p-4 text-[14px] text-slate-900">
          This checklist does not exist, or it was deleted. <Link to="/app/feedback-tracker" className="font-semibold text-purple-deep underline">See your checklists</Link>
        </div>
      </Frame>
    )
  }
  if (thread.state === 'error') {
    return (
      <Frame>
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-[14px] text-red-800">
          {thread.message} <button type="button" onClick={load} className="font-semibold underline">Try again</button>
        </div>
      </Frame>
    )
  }

  return (
    <Frame>
      <ThreadView thread={thread.value} onChange={value => setThread({ state: 'ready', value })} onDeleted={() => navigate('/app/feedback-tracker', { replace: true })} />
    </Frame>
  )
}
