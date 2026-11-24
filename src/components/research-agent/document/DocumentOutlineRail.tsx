import { memo, useState } from 'react'
import { ChevronDown, ChevronRight, Lock } from 'lucide-react'
import type { OutlineChapter } from '../../../lib/documentOutline'
import { DOCUMENT_STATUS_LABELS, LEGEND_STATES, shortLockLabel, type DocumentSectionStatus } from '../../../lib/sectionWorkflow'
import { SectionStatusMark } from './SectionStatusMark'

export interface OutlineRow {
  status:    DocumentSectionStatus
  flagCount: number
  /** The confirmed methodology leaves this section out (e.g. 4.4 for a qualitative study). */
  notApplicable?: boolean
  /** Why a locked section is locked (its tooltip); the row shows a short version. */
  lockedReason?: string | null
}

export interface OutlineProgress {
  approved: number
  /** Drafted and waiting for the student: ready for review, edited after approval, may be out of date. */
  review:   number
  total:    number
}

interface Props {
  chapters:   OutlineChapter[]
  rows:       Record<string, OutlineRow>
  activeCode: string | null
  progress:   OutlineProgress
  onSelect:   (code: string) => void
  /** Chapter key -> anchor, for locked placeholder chapters. */
  onSelectChapter: (key: string) => void
}

function trailing(code: string, row: OutlineRow, wordCount: number) {
  if (row.notApplicable && row.status === 'not_started') return <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Not needed</span>
  if (row.status === 'writing') return <span className="text-[11px] font-semibold" style={{ color: 'var(--color-purple-text)' }}>Writing</span>
  if (row.status === 'locked') return <span className="text-[11px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{shortLockLabel(code)}</span>
  if (row.flagCount > 0) {
    return (
      <span className="text-[11px] font-semibold rounded-full px-2 py-px" style={{ background: 'var(--color-amber-tint)', color: 'var(--color-amber-text)' }}>
        {row.flagCount} flag{row.flagCount === 1 ? '' : 's'}
      </span>
    )
  }
  if (row.status === 'up_next') return <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>Up next</span>
  if (row.status === 'not_started') return <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Not started</span>
  if (row.status === 'needs_review') {
    return <span className="text-[11px] font-semibold rounded-full px-2 py-px" style={{ background: 'var(--color-purple-tint)', color: 'var(--color-purple-text)' }}>Review</span>
  }
  return <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{wordCount.toLocaleString()}w</span>
}

/** Row colours: the section being written is highlighted, sections without text are quieter. */
function rowStyle(status: DocumentSectionStatus, active: boolean): React.CSSProperties {
  if (status === 'writing') return { background: 'var(--color-purple-tint)', color: 'var(--text-primary)', boxShadow: 'inset 2px 0 0 var(--color-purple)' }
  if (active) return { background: 'var(--color-purple-tint)', color: 'var(--text-primary)' }
  const quiet = status === 'not_started' || status === 'up_next' || status === 'locked'
  return { color: quiet ? 'var(--text-secondary)' : 'var(--text-primary)' }
}

/** The tooltip and the extra screen-reader words for a locked row. */
const lockedNote = (row: OutlineRow) => row.status === 'locked' && row.lockedReason ? row.lockedReason : undefined

/** Up/Down/Home/End move focus between outline rows; Tab leaves the outline. */
function onOutlineKeyDown(e: React.KeyboardEvent<HTMLElement>) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[data-outline-item]'))
  const index = items.indexOf(document.activeElement as HTMLElement)
  if (index < 0) return
  const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1
    : e.key === 'ArrowDown' ? Math.min(items.length - 1, index + 1) : Math.max(0, index - 1)
  items[next]?.focus()
  e.preventDefault()
}

const LEGEND_KEY = 'dm.outlineLegend.open'
const readLegend = () => { try { return localStorage.getItem(LEGEND_KEY) !== 'closed' } catch { return true } }

/** Every outline state, with its mark and label. */
function Legend() {
  const [open, setOpen] = useState(readLegend)
  const toggle = () => setOpen(o => { try { localStorage.setItem(LEGEND_KEY, o ? 'closed' : 'open') } catch { /* convenience only */ } return !o })
  return (
    <div className="shrink-0 px-4 py-2.5" style={{ borderTop: '0.5px solid var(--border-hairline)' }}>
      <button type="button" onClick={toggle} aria-expanded={open} aria-controls="outline-legend"
        className="dm-action inline-flex items-center gap-1 text-[11px] font-semibold tracking-[0.06em]" style={{ color: 'var(--text-secondary)' }}>
        {open ? <ChevronDown size={11} aria-hidden="true" /> : <ChevronRight size={11} aria-hidden="true" />} KEY
      </button>
      {open && (
        <ul id="outline-legend" aria-label="Status key" className="list-none m-0 mt-1.5 p-0 grid grid-cols-2 gap-x-3 gap-y-1">
          {LEGEND_STATES.map(status => (
            <li key={status} className="flex items-center gap-1.5 text-[11px] leading-tight min-w-0" style={{ color: 'var(--text-secondary)' }}>
              <span aria-hidden="true" className="inline-flex"><SectionStatusMark status={status} size={8} /></span>
              <span className="truncate">{DOCUMENT_STATUS_LABELS[status]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function DocumentOutlineRailImpl({ chapters, rows, activeCode, progress, onSelect, onSelectChapter }: Props) {
  const total = Math.max(progress.total, 1)
  const approvedPct = (progress.approved / total) * 100
  const reviewPct = (progress.review / total) * 100
  const toGo = Math.max(0, progress.total - progress.approved - progress.review)
  const summary = `${progress.approved} approved · ${progress.review} to review · ${toGo} to go`
  return (
    <nav aria-label="Outline" className="h-full flex flex-col" onKeyDown={onOutlineKeyDown}>
      <div className="px-4 pt-4 pb-3 shrink-0">
        <div className="text-[11px] font-semibold tracking-[0.08em] mb-2" style={{ color: 'var(--text-secondary)' }}>OUTLINE</div>
        <div className="h-1.5 rounded-full flex overflow-hidden" style={{ background: 'var(--surface-rail)' }}
          role="img" aria-label={`${summary}, of ${progress.total} sections`}>
          <div style={{ width: `${approvedPct}%`, background: 'var(--color-green)' }} />
          <div style={{ width: `${reviewPct}%`, background: 'var(--color-purple)' }} />
        </div>
        <div className="mt-1.5 text-[12px]" style={{ color: 'var(--text-secondary)' }}>{summary}</div>
      </div>

      <div className="flex-1 overflow-y-auto dm-scroll px-2.5 pb-6">
        {chapters.map(chapter => (
          <div key={chapter.key} className="mt-2">
            {chapter.lockedReason ? (
              <button type="button" data-outline-item onClick={() => onSelectChapter(chapter.key)}
                aria-label={`${chapter.title}, locked. ${chapter.lockedReason}`}
                className="dm-outline-item w-full text-left rounded-lg px-2 py-1.5 hover:bg-slate-50">
                <span className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  <Lock size={12} aria-hidden="true" /> {chapter.title}
                </span>
                <span className="block text-[12px] leading-[1.45] pl-[18px]" style={{ color: 'var(--text-muted)' }}>{chapter.lockedReason}</span>
              </button>
            ) : (
              <>
                {(() => {
                  const heading = chapter.number !== null ? `${chapter.number}  ${chapter.title}` : chapter.title
                  const lead = chapter.leadCode ? chapter.sections.find(s => s.code === chapter.leadCode) : undefined
                  const leadRow = lead ? rows[lead.code] : undefined
                  if (!lead || !leadRow) {
                    return <div className="text-[12px] font-semibold px-2 py-1.5" style={{ color: 'var(--text-primary)' }}>{heading}</div>
                  }
                  // The chapter heading is the N.0 section's row, so "1.0 Introduction" is not listed twice.
                  const active = lead.code === activeCode
                  const note = lockedNote(leadRow)
                  return (
                    <button type="button" data-outline-item onClick={() => onSelect(lead.code)}
                      aria-current={active ? 'location' : undefined} title={note}
                      className="dm-outline-item w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] font-semibold hover:bg-slate-50"
                      style={{ ...rowStyle(leadRow.status, active), ...(leadRow.status === 'writing' || active ? {} : { color: 'var(--text-primary)' }) }}>
                      <SectionStatusMark status={leadRow.status} />
                      <span className="flex-1 min-w-0 truncate">{heading}<span className="sr-only"> ({lead.displayCode || lead.code}){note ? `. ${note}` : ''}</span></span>
                      {trailing(lead.code, leadRow, lead.wordCount)}
                    </button>
                  )
                })()}
                <ul className="list-none m-0 p-0">
                  {chapter.sections.map(s => {
                    const row = rows[s.code]
                    if (!row || s.code === chapter.leadCode) return null
                    const active = s.code === activeCode
                    const note = lockedNote(row)
                    return (
                      <li key={s.code}>
                        <button type="button" data-outline-item onClick={() => onSelect(s.code)}
                          aria-current={active ? 'location' : undefined} title={note}
                          className="dm-outline-item w-full flex items-center gap-2 rounded-lg pl-4 pr-2 py-1.5 text-left text-[13px] hover:bg-slate-50"
                          style={{ ...rowStyle(row.status, active), ...(active ? { fontWeight: 600 } : {}) }}>
                          <SectionStatusMark status={row.status} />
                          <span className="flex-1 min-w-0 truncate">{s.displayCode || s.code} {s.title}{note && <span className="sr-only">. {note}</span>}</span>
                          {trailing(s.code, row, s.wordCount)}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </div>
        ))}
      </div>
      <Legend />
    </nav>
  )
}

export const DocumentOutlineRail = memo(DocumentOutlineRailImpl)
