import { memo } from 'react'
import { Lock } from 'lucide-react'
import type { OutlineChapter } from '../../../lib/documentOutline'
import type { DocumentSectionStatus } from '../../../lib/sectionWorkflow'
import { SectionStatusMark } from './SectionStatusMark'

export interface OutlineRow {
  status:    DocumentSectionStatus
  flagCount: number
  /** The confirmed methodology leaves this section out (e.g. 4.4 for a qualitative study). */
  notApplicable?: boolean
}

interface Props {
  chapters:   OutlineChapter[]
  rows:       Record<string, OutlineRow>
  activeCode: string | null
  progress:   { approved: number; total: number }
  onSelect:   (code: string) => void
  /** Chapter key -> anchor, for locked placeholder chapters. */
  onSelectChapter: (key: string) => void
}

function trailing(row: OutlineRow, wordCount: number) {
  if (row.notApplicable && row.status === 'not_started') return <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Not needed</span>
  if (row.status === 'writing') return <span className="text-[11px] font-semibold" style={{ color: 'var(--color-purple-text)' }}>Writing</span>
  if (row.status === 'locked') return <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Locked</span>
  if (row.flagCount > 0) {
    return (
      <span className="text-[11px] font-semibold rounded-full px-2 py-px" style={{ background: 'var(--color-amber-tint)', color: 'var(--color-amber-text)' }}>
        {row.flagCount} flag{row.flagCount === 1 ? '' : 's'}
      </span>
    )
  }
  if (row.status === 'up_next') return <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>Up next</span>
  if (row.status === 'not_started') return <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Not started</span>
  if (row.status === 'needs_review') return <span className="text-[11px]" style={{ color: 'var(--color-amber-text)' }}>Review</span>
  return <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{wordCount.toLocaleString()}w</span>
}

/** Up/Down/Home/End move focus between outline rows; Tab leaves the outline. */
function onOutlineKeyDown(e: React.KeyboardEvent<HTMLElement>) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[data-outline-item]'))
  const index = items.indexOf(document.activeElement as HTMLElement)
  const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1
    : e.key === 'ArrowDown' ? Math.min(items.length - 1, index + 1) : Math.max(0, index - 1)
  items[next]?.focus()
  e.preventDefault()
}

function DocumentOutlineRailImpl({ chapters, rows, activeCode, progress, onSelect, onSelectChapter }: Props) {
  const pct = progress.total ? Math.round((progress.approved / progress.total) * 100) : 0
  return (
    <nav aria-label="Outline" className="h-full flex flex-col" onKeyDown={onOutlineKeyDown}>
      <div className="px-4 pt-4 pb-3 shrink-0">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-[11px] font-semibold tracking-[0.08em]" style={{ color: 'var(--text-secondary)' }}>OUTLINE</span>
          <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{progress.approved} of {progress.total} approved</span>
        </div>
        <div className="h-1 rounded-full" style={{ background: 'var(--surface-rail)' }}
          role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.approved}
          aria-label={`${progress.approved} of ${progress.total} sections approved`}>
          <div className="h-1 rounded-full" style={{ width: `${pct}%`, background: 'var(--color-green)' }} />
        </div>
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
                  return (
                    <button type="button" data-outline-item onClick={() => onSelect(lead.code)}
                      aria-current={active ? 'location' : undefined}
                      className="dm-outline-item w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] font-semibold hover:bg-slate-50"
                      style={active ? { background: 'var(--color-purple-tint)', color: 'var(--text-primary)' } : { color: 'var(--text-primary)' }}>
                      <SectionStatusMark status={leadRow.status} />
                      <span className="flex-1 min-w-0 truncate">{heading}<span className="sr-only"> ({lead.displayCode || lead.code})</span></span>
                      {trailing(leadRow, lead.wordCount)}
                    </button>
                  )
                })()}
                <ul className="list-none m-0 p-0">
                  {chapter.sections.map(s => {
                    const row = rows[s.code]
                    if (!row || s.code === chapter.leadCode) return null
                    const active = s.code === activeCode
                    return (
                      <li key={s.code}>
                        <button type="button" data-outline-item onClick={() => onSelect(s.code)}
                          aria-current={active ? 'location' : undefined}
                          className="dm-outline-item w-full flex items-center gap-2 rounded-lg pl-4 pr-2 py-1.5 text-left text-[13px] hover:bg-slate-50"
                          style={active ? { background: 'var(--color-purple-tint)', color: 'var(--text-primary)', fontWeight: 600 }
                            : { color: row.status === 'not_started' || row.status === 'up_next' || row.status === 'locked' ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                          <SectionStatusMark status={row.status} />
                          <span className="flex-1 min-w-0 truncate">{s.displayCode || s.code} {s.title}</span>
                          {trailing(row, s.wordCount)}
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
    </nav>
  )
}

export const DocumentOutlineRail = memo(DocumentOutlineRailImpl)
