import type { AgentActivity as Activity } from '../types/proposalAgent'

/** Only a well-formed reply renders; anything else (an older API, a proxy page) shows nothing. */
export function asActivity(value: unknown): Activity | null {
  const v = value as Partial<Activity> | null | undefined
  if (!v || typeof v !== 'object' || !Array.isArray(v.lines)) return null
  return { running: v.running === true, path: v.path ?? null, sectionCode: v.sectionCode ?? null, startedAt: v.startedAt ?? null,
    lines: v.lines.filter(l => l && typeof l.text === 'string').map(l => ({ kind: String(l.kind ?? ''), text: l.text, sectionCode: l.sectionCode ?? null, at: l.at ?? null })) }
}
