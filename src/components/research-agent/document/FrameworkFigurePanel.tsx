import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { getFrameworkFigure } from '../../../api/frameworkFigure'
import type { FigureEdge, FigureNode, FrameworkFigureSpec } from '../../../types/frameworkFigure'

/**
 * PR 8 (2026-11-24): the conceptual framework figure, shown after the framework section. It is built on the server from the
 * Study Variables table and the hypotheses (the same spec the exported document draws as a PNG). The student can rename a
 * box, relabel, retype, remove or add an arrow; saving stores the edited copy on the project's sectionContent, and Reset
 * goes back to the computed figure.
 */

interface Props {
  projectId: string
  /** The saved copy (sectionContent.frameworkDiagram), or empty. */
  stored: string | undefined
  /** Changes when the text the figure is computed from changes (5.7 and 4.4), so the computed figure is fetched again. */
  sourceKey: string
  onSave: (json: string) => Promise<boolean>
  /**
   * Why there is no figure (null once there is one). The reason is a working note, not manuscript text, so it is shown
   * in the Agent panel rather than in the document (2026-11-28 UX pass: diagnostics stay out of the page body).
   */
  onNoFigure?: (reason: string | null) => void
}

const parseStored = (raw: string | undefined): FrameworkFigureSpec | null => {
  if (!raw) return null
  try {
    const spec = JSON.parse(raw) as FrameworkFigureSpec
    return Array.isArray(spec?.nodes) && spec.nodes.length > 0 ? spec : null
  } catch { return null }
}

type Pt = { x: number; y: number }
const center = (n: FigureNode): Pt => ({ x: n.x + n.w / 2, y: n.y + n.h / 2 })
const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

/** Where the line from the box's centre towards `to` leaves the box (same rule as the server renderer). */
export const anchor = (n: FigureNode, to: Pt): Pt => {
  const c = center(n)
  const dx = to.x - c.x, dy = to.y - c.y
  if (dx === 0 && dy === 0) return c
  const sx = Math.abs(dx) < 1e-6 ? Infinity : (n.w / 2) / Math.abs(dx)
  const sy = Math.abs(dy) < 1e-6 ? Infinity : (n.h / 2) / Math.abs(dy)
  const s = Math.min(sx, sy)
  return { x: c.x + dx * s, y: c.y + dy * s }
}

/** Endpoints of an arrow, or null when a box it names is gone. */
export const edgePoints = (e: FigureEdge, byId: Map<string, FigureNode>): { from: Pt; to: Pt } | null => {
  const a = byId.get(e.from)
  if (!a) return null
  if (e.kind === 'moderation' && e.targetEdge) {
    const [f, t] = e.targetEdge.split('->')
    const tf = byId.get(f), tt = byId.get(t)
    if (tf && tt) {
      const m = mid(anchor(tf, center(tt)), anchor(tt, center(tf)))
      return { from: anchor(a, m), to: m }
    }
  }
  const b = byId.get(e.to)
  if (!b) return null
  return { from: anchor(a, center(b)), to: anchor(b, center(a)) }
}

/** Splits a label into lines of at most `max` characters (whole words). */
export const wrapLabel = (text: string, max = 22): string[] => {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word
    if (next.length <= max || !line) line = next
    else { lines.push(line); line = word }
  }
  if (line) lines.push(line)
  return lines.length <= 6 ? lines : [...lines.slice(0, 5), lines.slice(5).join(" ")]
}

const EDGE_KINDS: { value: string; label: string }[] = [
  { value: 'association', label: 'Association' },
  { value: 'mediation', label: 'Mediation path' },
  { value: 'moderation', label: 'Moderation' },
  { value: 'control', label: 'Control (dashed)' },
]

export const FigureSvg = memo(function FigureSvg({ spec }: { spec: FrameworkFigureSpec }) {
  const byId = useMemo(() => new Map(spec.nodes.map(n => [n.id, n])), [spec.nodes])
  const font = 22
  return (
    <svg role="img" aria-label={spec.caption} viewBox={`0 0 ${spec.width} ${spec.height}`} className="w-full h-auto"
      style={{ background: 'white', maxHeight: 520 }}>
      <defs>
        <marker id="fw-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#111" />
        </marker>
      </defs>
      {spec.edges.map((e, i) => {
        const p = edgePoints(e, byId)
        if (!p) return null
        const m = mid(p.from, p.to)
        return (
          <g key={`e${i}`}>
            <line x1={p.from.x} y1={p.from.y} x2={p.to.x} y2={p.to.y} stroke="#111" strokeWidth={2.2}
              strokeDasharray={e.kind === 'control' ? '10 7' : undefined} markerEnd="url(#fw-arrow)" />
            {e.label && (
              <g>
                <rect x={m.x - (e.label.length * font * 0.32 + 6)} y={m.y - font * 0.9} width={e.label.length * font * 0.64 + 12} height={font * 1.25} fill="white" />
                <text x={m.x} y={m.y + font * 0.25} textAnchor="middle" fontSize={font * 0.9} fontWeight={700} fill="#111">{e.label}</text>
              </g>
            )}
          </g>
        )
      })}
      {spec.nodes.map(n => {
        const lines = wrapLabel(n.label, n.role === 'control' ? 60 : 22)
        const lh = font * 1.2
        const top = n.y + n.h / 2 - (lines.length * lh) / 2 + font * 0.85
        return (
          <g key={n.id}>
            <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={8} fill="#F4F4F4" stroke="#111" strokeWidth={2.2}
              strokeDasharray={n.role === 'control' ? '10 7' : undefined} />
            {lines.map((l, i) => (
              <text key={i} x={n.x + n.w / 2} y={top + i * lh} textAnchor="middle" fontSize={font} fill="#111">{l}</text>
            ))}
          </g>
        )
      })}
    </svg>
  )
})

export const FrameworkFigurePanel = memo(function FrameworkFigurePanel({ projectId, stored, sourceKey, onSave, onNoFigure }: Props) {
  const saved = useMemo(() => parseStored(stored), [stored])
  const [computed, setComputed] = useState<FrameworkFigureSpec | null>(null)
  const [reason, setReason] = useState<string | null>(null)
  const [loading, setLoading] = useState(!saved)
  const [draft, setDraft] = useState<FrameworkFigureSpec | null>(null)
  const [saving, setSaving] = useState(false)
  const [newEdge, setNewEdge] = useState<{ from: string; to: string }>({ from: '', to: '' })

  useEffect(() => {
    if (saved) { setLoading(false); return }
    let live = true
    setLoading(true)
    getFrameworkFigure(projectId)
      .then(r => { if (live) { setComputed(r.figure); setReason(r.figure ? null : r.reason) } })
      .catch(() => { if (live) { setComputed(null); setReason('The figure could not be loaded. Try again later.') } })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [projectId, saved, sourceKey])

  const shown = draft ?? saved ?? computed
  const editing = draft !== null
  const missingReason = !loading && !shown ? reason : null
  useEffect(() => { onNoFigure?.(missingReason) }, [onNoFigure, missingReason])
  useEffect(() => () => onNoFigure?.(null), [onNoFigure])

  const startEdit = useCallback(() => { if (shown) setDraft(structuredClone(shown)) }, [shown])
  const update = useCallback((fn: (s: FrameworkFigureSpec) => FrameworkFigureSpec) => setDraft(d => (d ? fn(d) : d)), [])

  const save = useCallback(async () => {
    if (!draft) return
    setSaving(true)
    const ok = await onSave(JSON.stringify({ ...draft, edited: true }))
    setSaving(false)
    if (ok) setDraft(null)
  }, [draft, onSave])

  const reset = useCallback(async () => {
    setSaving(true)
    const ok = await onSave('')
    setSaving(false)
    if (ok) setDraft(null)
  }, [onSave])

  if (loading) return null
  // No figure: nothing in the document; the reason goes to the Agent panel (onNoFigure). Without that callback (other
  // hosts) it is still said here, so it never silently disappears.
  if (!shown) {
    return reason && !onNoFigure ? (
      <p className="m-0 mb-6 text-[12px] leading-[1.45]" style={{ color: 'var(--text-muted)' }} data-testid="framework-figure-none">
        Conceptual framework figure: {reason}
      </p>
    ) : null
  }

  const label = (id: string) => shown.nodes.find(n => n.id === id)?.label ?? id
  const inputStyle = { border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }

  return (
    <figure aria-label="Conceptual framework figure" className="m-0 mb-8 rounded-[10px] p-3"
      style={{ border: '0.5px solid var(--border-strong)' }}>
      <div className="flex items-center gap-2 mb-2">
        <span className="flex-1 text-[11px] font-semibold tracking-[0.08em]" style={{ color: 'var(--text-secondary)' }}>
          FIGURE · {saved && !editing ? 'YOUR EDITED COPY' : 'BUILT FROM STUDY VARIABLES AND HYPOTHESES'}
        </span>
        {!editing && (
          <button type="button" onClick={startEdit}
            className="dm-action inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold hover:bg-slate-50"
            style={{ color: 'var(--color-purple-text)' }} aria-label="Edit the framework figure">
            <Pencil size={11} aria-hidden="true" /> Edit
          </button>
        )}
        {!editing && saved && (
          <button type="button" onClick={() => { void reset() }} disabled={saving}
            className="dm-action inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] hover:bg-slate-50"
            style={{ color: 'var(--text-secondary)' }} aria-label="Reset the figure to the computed one">
            <RotateCcw size={11} aria-hidden="true" /> Reset
          </button>
        )}
      </div>
      <FigureSvg spec={shown} />
      <figcaption className="mt-2 text-[12px] leading-[1.45]" style={{ color: 'var(--text-secondary)' }}>
        <em>{shown.caption}.</em> <span style={{ color: 'var(--text-muted)' }}>Note. {shown.note} The exported document numbers this figure.</span>
      </figcaption>

      {editing && draft && (
        <div className="mt-3 flex flex-col gap-3" data-testid="framework-figure-editor">
          <fieldset className="m-0 p-0 border-0">
            <legend className="text-[12px] font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Boxes</legend>
            <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
              {draft.nodes.map(n => (
                <label key={n.id} className="flex flex-col gap-0.5 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                  {n.role}
                  <input value={n.label} aria-label={`Label of ${n.role} box`} className="rounded-md px-2 py-1 text-[12px]" style={inputStyle}
                    onChange={ev => { const v = ev.target.value; update(s => ({ ...s, nodes: s.nodes.map(x => (x.id === n.id ? { ...x, label: v } : x)) })) }} />
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="m-0 p-0 border-0">
            <legend className="text-[12px] font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Arrows</legend>
            <ul className="m-0 p-0 list-none flex flex-col gap-1">
              {draft.edges.map((e, i) => (
                <li key={`${e.from}-${e.to}-${i}`} className="flex flex-wrap items-center gap-1.5 text-[12px]" style={{ color: 'var(--text-primary)' }}>
                  <span className="min-w-0 truncate">{label(e.from)} → {e.targetEdge ? `arrow ${e.targetEdge.split('->').map(label).join(' → ')}` : label(e.to)}</span>
                  <select value={e.kind} aria-label="Arrow type" className="rounded-md px-1 py-0.5 text-[12px]" style={inputStyle}
                    onChange={ev => { const v = ev.target.value; update(s => ({ ...s, edges: s.edges.map((x, j) => (j === i ? { ...x, kind: v } : x)) })) }}>
                    {EDGE_KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
                  </select>
                  <input value={e.label ?? ''} placeholder="H1" aria-label="Hypothesis label" className="w-16 rounded-md px-1.5 py-0.5 text-[12px]" style={inputStyle}
                    onChange={ev => { const v = ev.target.value; update(s => ({ ...s, edges: s.edges.map((x, j) => (j === i ? { ...x, label: v || null } : x)) })) }} />
                  <button type="button" aria-label="Remove this arrow" className="dm-action rounded p-1 hover:bg-slate-50"
                    onClick={() => update(s => ({ ...s, edges: s.edges.filter((_, j) => j !== i) }))}>
                    <Trash2 size={12} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px]">
              <select value={newEdge.from} aria-label="New arrow from" className="rounded-md px-1 py-0.5" style={inputStyle}
                onChange={ev => setNewEdge(x => ({ ...x, from: ev.target.value }))}>
                <option value="">From…</option>
                {draft.nodes.filter(n => n.role !== 'control').map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
              </select>
              <select value={newEdge.to} aria-label="New arrow to" className="rounded-md px-1 py-0.5" style={inputStyle}
                onChange={ev => setNewEdge(x => ({ ...x, to: ev.target.value }))}>
                <option value="">To…</option>
                {draft.nodes.filter(n => n.role !== 'control').map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
              </select>
              <button type="button" disabled={!newEdge.from || !newEdge.to || newEdge.from === newEdge.to}
                className="dm-action inline-flex items-center gap-1 rounded-md px-2 py-0.5 hover:bg-slate-50 disabled:opacity-50" style={inputStyle}
                onClick={() => { update(s => ({ ...s, edges: [...s.edges, { from: newEdge.from, to: newEdge.to, kind: 'association', label: null }] })); setNewEdge({ from: '', to: '' }) }}>
                <Plus size={12} aria-hidden="true" /> Add arrow
              </button>
            </div>
          </fieldset>
          <div className="flex gap-2">
            <button type="button" onClick={() => { void save() }} disabled={saving}
              className="dm-action rounded-md px-3 py-1.5 text-[12px] font-semibold disabled:opacity-60"
              style={{ background: 'var(--color-purple)', color: 'white' }}>
              {saving ? 'Saving…' : 'Save figure'}
            </button>
            <button type="button" onClick={() => setDraft(null)} className="dm-action rounded-md px-3 py-1.5 text-[12px]" style={inputStyle}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </figure>
  )
})

interface FormatProps {
  value: string | undefined
  onChange: (value: 'structured' | 'single') => void
}

/** PR 8: the abstract's format. Structured (four labelled parts) unless the institution asks for one paragraph. */
export const AbstractFormatToggle = memo(function AbstractFormatToggle({ value, onChange }: FormatProps) {
  const single = value === 'single'
  const opt = (active: boolean) => (active
    ? { background: 'var(--color-purple)', color: 'white' }
    : { border: '1px solid var(--border-strong)', color: 'var(--text-primary)' })
  return (
    <div role="group" aria-label="Abstract format" className="mb-6 flex flex-wrap items-center gap-2 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
      <span>Abstract format:</span>
      <button type="button" aria-pressed={!single} onClick={() => onChange('structured')} className="dm-action rounded-md px-2 py-0.5" style={opt(!single)}>
        Structured
      </button>
      <button type="button" aria-pressed={single} onClick={() => onChange('single')} className="dm-action rounded-md px-2 py-0.5" style={opt(single)}>
        One paragraph
      </button>
      <span style={{ color: 'var(--text-muted)' }}>Applies the next time the abstract is written.</span>
    </div>
  )
})
