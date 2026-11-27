import { useEffect, useState } from 'react'
import { proposalAgentApi } from '../../api/proposalAgent'
import type { AgentActivity as Activity, AgentActivityLine } from '../../types/proposalAgent'

// The research agent's activity, the same wording in every proposal screen: "Found 5 papers on '…'", "Read '…'",
// "Wrote Introduction", "Checked the document". Titles and queries only. Renders nothing when the agent is off for this
// project (the endpoint 404s) or has nothing to show.

const MARK: Record<string, string> = {
  Planned: '◇', Found: '⌕', Read: '▤', Added: '+', Wrote: '✎', Checked: '✓', Rewrote: '↻', Gap: '!', Budget: '⏸',
}

export interface AgentActivityViewProps {
  activity: Activity | null | undefined
  /** Heading shown above the list. */
  title?: string
  defaultOpen?: boolean
}

export function AgentActivityView({ activity, title = 'What the research agent did', defaultOpen = false }: AgentActivityViewProps) {
  if (!activity || activity.lines.length === 0) {
    if (!activity?.running) return null
    return <p className="m-0 text-[12px]" style={{ color: 'var(--text-secondary)' }} role="status">The research agent is starting…</p>
  }
  const gaps = activity.lines.filter(l => l.kind === 'Gap').length
  const summary = activity.running
    ? `${title} · working (${activity.lines.length})`
    : `${title} (${activity.lines.length}${gaps > 0 ? `, ${gaps} evidence gap${gaps === 1 ? '' : 's'}` : ''})`
  return (
    <details className="rounded-[10px] px-3 py-2 text-[12px]" style={{ border: '0.5px solid var(--border-strong)' }} open={defaultOpen || activity.running}>
      <summary className="cursor-pointer select-none font-medium" style={{ color: 'var(--text-primary)' }}>{summary}</summary>
      <ol className="m-0 mt-2 flex list-none flex-col gap-1 p-0" aria-live={activity.running ? 'polite' : undefined}>
        {activity.lines.map((line, i) => <Line key={`${i}|${line.text}`} line={line} />)}
      </ol>
    </details>
  )
}

function Line({ line }: { line: AgentActivityLine }) {
  const gap = line.kind === 'Gap' || line.kind === 'Budget'
  return (
    <li className="flex gap-2" style={{ color: gap ? 'var(--color-warning, #b45309)' : 'var(--text-secondary)' }}>
      <span aria-hidden className="w-3 shrink-0 text-center">{MARK[line.kind] ?? '·'}</span>
      <span className="min-w-0 break-words">{line.text}</span>
    </li>
  )
}

/** Only a well-formed reply renders; anything else (an older API, a proxy page) shows nothing. */
export function asActivity(value: unknown): Activity | null {
  const v = value as Partial<Activity> | null | undefined
  if (!v || typeof v !== 'object' || !Array.isArray(v.lines)) return null
  return { running: v.running === true, path: v.path ?? null, sectionCode: v.sectionCode ?? null, startedAt: v.startedAt ?? null,
    lines: v.lines.filter(l => l && typeof l.text === 'string').map(l => ({ kind: String(l.kind ?? ''), text: l.text, sectionCode: l.sectionCode ?? null, at: l.at ?? null })) }
}

/**
 * Connected: polls every 3 s while a run is in progress (or while `active`, e.g. a generation the page knows is running) and
 * stops when it finishes. Self-contained (no query client), so it can sit inside any proposal screen; a failed request just
 * shows nothing.
 */
export function AgentActivity({ projectId, section, active = false, title, defaultOpen }: {
  projectId: string; section?: string; active?: boolean; title?: string; defaultOpen?: boolean
}) {
  const [activity, setActivity] = useState<Activity | null>(null)
  const running = activity?.running ?? false
  useEffect(() => {
    if (!projectId) return
    const controller = new AbortController()
    let timer: number | undefined
    const load = async () => {
      let next: Activity | null = null
      try { next = asActivity(await proposalAgentApi.activity(projectId, section, controller.signal)) } catch { next = null }
      if (controller.signal.aborted) return
      setActivity(next)
      if (next?.running || active) timer = window.setTimeout(() => void load(), 3000)
    }
    void load()
    return () => { controller.abort(); if (timer) window.clearTimeout(timer) }
  }, [projectId, section, active, running])
  return <AgentActivityView activity={activity} title={title} defaultOpen={defaultOpen} />
}
