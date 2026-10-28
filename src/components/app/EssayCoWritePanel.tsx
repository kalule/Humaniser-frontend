import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { AlertTriangle, BookOpen, Check, ChevronDown, ChevronRight, CircleDashed, Loader2, RefreshCw, SkipForward, Sparkles, X } from 'lucide-react'
import type { Editor } from '@tiptap/core'
import { workbenchApi } from '../../api/workbench'
import type { CoWriteSection, CoWriteSectionResponse, CoWriteSession } from '../../types/workbench'
import { cn } from '../../lib/utils'
import {
  displayText, groundingFor, isFinished, nextPendingSection, sectionHtml, wordCount, type CoWriteProgress,
} from '../../lib/essayCoWrite'

interface Props {
  session: CoWriteSession
  /** When false the panel renders nothing but keeps its progress, so hiding it never loses work. */
  open: boolean
  editor: Editor | null
  /** Appends the accepted section to the document. */
  onInsertHtml: (html: string) => void
  /** Adds the reference list and ends the session. */
  onFinish: () => void
  onClose: () => void
}

/** The backend reports copied wording as "This repeats wording already in the essay (...)". */
export const isRepeatWarning = (warning: string) => warning.startsWith('This repeats wording')
const REPEAT_FIX = 'Rewrite this so it adds a new point and does not repeat wording already in the essay.'

const STATUS_NOTE: Record<CoWriteSection['status'], string | null> = {
  ready: null,
  limited: 'Limited evidence: the paragraph will say what the sources do not establish.',
  no_evidence: 'No source evidence was found for this part. Skip it, or add your own sources.',
}

/**
 * Section-by-section writing. The essay has been researched and outlined; the student writes it one section at a time. Each suggestion shows
 * its citations and the passages behind them, and is accepted into the document, rewritten, retried with different sources, or skipped.
 */
export function EssayCoWritePanel({ session, open, editor, onInsertHtml, onFinish, onClose }: Props) {
  const [progress, setProgress] = useState<CoWriteProgress>({})
  const [activeId, setActiveId] = useState<string>(() => nextPendingSection(session, {})?.id ?? session.sections[0]?.id ?? '')
  const [suggestion, setSuggestion] = useState<CoWriteSectionResponse | null>(null)
  const [usedSources, setUsedSources] = useState<string[]>([])
  const [instruction, setInstruction] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openSource, setOpenSource] = useState<string | null>(null)
  const mounted = useRef(true)
  useEffect(() => {
    // StrictMode replays setup after cleanup in development. Restore the flag so
    // completed requests can still show their suggestion and clear the spinner.
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const active = session.sections.find(s => s.id === activeId) ?? null
  const finished = isFinished(session, progress)
  const doneCount = Object.keys(progress).length
  const shownText = useMemo(() => (suggestion ? displayText(suggestion.text, session) : ''), [suggestion, session])

  const reset = (nextId: string) => {
    setActiveId(nextId); setSuggestion(null); setUsedSources([]); setInstruction(''); setError(null); setOpenSource(null)
  }

  const write = async (excludeSourceIds: string[], withInstruction?: string) => {
    if (!active || loading) return
    setLoading(true); setError(null)
    try {
      const response = await workbenchApi.draftCoWriteSection({
        sessionId: session.sessionId, sectionId: active.id, excludeSourceIds, instruction: withInstruction?.trim() || undefined,
        acceptedText: editor?.getText() ?? '',
      })
      if (!mounted.current) return
      setSuggestion(response.text ? response : null)
      if (!response.text) setError(response.warnings[0] ?? 'Nothing could be written for this section.')
      setUsedSources(prev => Array.from(new Set([...prev, ...response.sourceIds])))
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : 'The section could not be written. Please try again.')
    } finally {
      if (mounted.current) setLoading(false)
    }
  }

  const accept = () => {
    if (!active || !suggestion) return
    onInsertHtml(sectionHtml(active, suggestion.text, session, progress))
    const next = { ...progress, [active.id]: 'accepted' as const }
    setProgress(next)
    reset(nextPendingSection(session, next, active.id)?.id ?? active.id)
    toast.success(`${active.heading} added. Edit it in the document, then continue.`)
  }

  const skip = () => {
    if (!active) return
    const next = { ...progress, [active.id]: 'skipped' as const }
    setProgress(next)
    reset(nextPendingSection(session, next, active.id)?.id ?? active.id)
  }

  const grounding = suggestion ? groundingFor(session, suggestion.sourceIds, suggestion.evidenceIds) : []

  if (!open) return null

  return (
    <aside role="complementary" aria-label="Write with AI, section by section"
      className="fixed bottom-4 right-4 top-20 z-40 flex w-[420px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_48px_rgba(15,23,42,0.18)]">
      <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[13px] font-bold text-slate-800"><Sparkles size={14} className="text-purple-accent" />Write with AI</p>
          <p className="mt-0.5 truncate text-[11px] text-slate-500" title={session.question}>{doneCount} of {session.sections.length} sections done · {session.question}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Hide the writing panel" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={15} /></button>
      </header>

      <nav aria-label="Essay outline" className="max-h-40 shrink-0 space-y-0.5 overflow-y-auto border-b border-slate-100 px-2 py-2">
        {session.sections.map(section => {
          const state = progress[section.id]
          return (
            <button key={section.id} type="button" disabled={loading} onClick={() => reset(section.id)} aria-current={section.id === activeId ? 'step' : undefined}
              className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] transition-colors',
                section.id === activeId ? 'bg-purple-tint text-purple-text' : 'text-slate-600 hover:bg-slate-50')}>
              {state === 'accepted' ? <Check size={13} className="shrink-0 text-emerald-600" />
                : state === 'skipped' ? <SkipForward size={13} className="shrink-0 text-slate-400" />
                : <CircleDashed size={13} className="shrink-0 text-slate-300" />}
              <span className="min-w-0 flex-1 truncate">{section.heading}</span>
              {section.status !== 'ready' && !state && <AlertTriangle size={12} className="shrink-0 text-amber-500" aria-label={section.status === 'limited' ? 'Limited evidence' : 'No evidence'} />}
            </button>
          )
        })}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {finished ? (
          <div className="space-y-3 py-6 text-center">
            <Check size={28} className="mx-auto text-emerald-600" />
            <p className="text-[14px] font-semibold text-slate-800">Every section is done</p>
            <p className="text-[12px] text-slate-500">Add the reference list to finish, then read the essay through and edit it in the document.</p>
            <button type="button" onClick={onFinish} className="rounded-xl bg-purple-accent px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-purple-deep">Add references and finish</button>
          </div>
        ) : active && (
          <div className="space-y-3">
            <div>
              <p className="text-[13px] font-semibold text-slate-800">{active.heading}</p>
              {active.claim && active.kind === 'body' && <p className="mt-0.5 text-[12px] text-slate-500">{active.claim}</p>}
              <p className="mt-1 text-[11px] text-slate-400">About {active.words} words{active.evidenceIds.length > 0 ? ` · ${active.evidenceIds.length} passage${active.evidenceIds.length === 1 ? '' : 's'} to draw on` : ''}</p>
            </div>
            {STATUS_NOTE[active.status] && (
              <p role="note" className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{STATUS_NOTE[active.status]}</p>
            )}

            {!suggestion && !loading && (
              <button type="button" onClick={() => write([])} disabled={active.status === 'no_evidence' && active.kind === 'body'}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-accent px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-purple-deep disabled:cursor-not-allowed disabled:bg-purple-accent/40">
                <Sparkles size={14} />Write this section
              </button>
            )}
            {loading && <p role="status" className="flex items-center gap-2 rounded-lg bg-purple-tint px-3 py-3 text-[12px] text-purple-text"><Loader2 size={14} className="animate-spin" />Writing from this section's sources…</p>}
            {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</p>}

            {suggestion && !loading && (
              <div className="space-y-3 rounded-xl border border-purple-200 bg-purple-50/40 p-3">
                <p className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-purple-text">
                  <span>AI suggestion · {wordCount(suggestion.text)} words</span>
                  {suggestion.needsReview && <span className="rounded-full bg-amber-100 px-2 py-0.5 normal-case tracking-normal text-amber-900">Needs your check</span>}
                </p>
                <p className="whitespace-pre-line text-[13px] leading-6 text-slate-800">{shownText}</p>
                {suggestion.warnings.map(w => (
                  <div key={w} role="note" className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-amber-50/70 px-2.5 py-1.5 text-[11px] text-amber-800">
                    <AlertTriangle size={12} className="shrink-0" />
                    <span className="min-w-0 flex-1">{w}</span>
                    {isRepeatWarning(w) && (
                      <button type="button" onClick={() => void write([], REPEAT_FIX)} className="shrink-0 rounded-md border border-amber-300 bg-white px-2 py-0.5 font-medium text-amber-900 hover:bg-amber-100">
                        Rewrite with a new point
                      </button>
                    )}
                  </div>
                ))}
                {grounding.length > 0 && (
                  <div className="space-y-1 border-t border-purple-100 pt-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Check the sources</p>
                    {grounding.map(g => (
                      <div key={g.sourceId} className="text-[12px]">
                        <button type="button" onClick={() => setOpenSource(openSource === g.sourceId ? null : g.sourceId)} aria-expanded={openSource === g.sourceId}
                          className="flex w-full items-start gap-1.5 text-left text-slate-700 hover:text-purple-text">
                          {openSource === g.sourceId ? <ChevronDown size={13} className="mt-0.5 shrink-0" /> : <ChevronRight size={13} className="mt-0.5 shrink-0" />}
                          <span><BookOpen size={12} className="mr-1 inline text-slate-400" />{g.reference?.title ?? g.sourceId}{g.reference?.year ? ` (${g.reference.year})` : ''}</span>
                        </button>
                        {openSource === g.sourceId && g.passages.map(p => (
                          <blockquote key={p.id} className="ml-5 mt-1 border-l-2 border-slate-300 pl-2 text-[12px] italic text-slate-500">{p.text}</blockquote>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2 border-t border-purple-100 pt-3">
                  <button type="button" onClick={accept} className="flex items-center gap-1.5 rounded-lg bg-purple-accent px-3 py-2 text-[12px] font-semibold text-white hover:bg-purple-deep"><Check size={13} />Accept</button>
                  <button type="button" onClick={() => write(usedSources)} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-700 hover:bg-slate-50"><RefreshCw size={13} />Different sources</button>
                  <button type="button" onClick={skip} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-medium text-slate-500 hover:bg-slate-100"><SkipForward size={13} />Skip</button>
                </div>
                <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (instruction.trim()) void write([], instruction) }}>
                  <input value={instruction} onChange={e => setInstruction(e.target.value)} placeholder="Ask for a change: shorter, more cautious, focus on…" aria-label="Ask for a change"
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-[12px] text-slate-700 focus:border-purple-accent focus:outline-none" />
                  <button type="submit" disabled={!instruction.trim()} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40">Rewrite</button>
                </form>
              </div>
            )}

            {!suggestion && !loading && (
              <button type="button" onClick={skip} className="flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-slate-700"><SkipForward size={13} />Skip this section</button>
            )}
          </div>
        )}
      </div>

      <footer className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-2.5">
        <p className="text-[11px] text-slate-500">Edit anything in the document as you go.</p>
        {!finished && doneCount > 0 && <button type="button" onClick={onFinish} className="text-[12px] font-semibold text-purple-text hover:underline">Finish now</button>}
      </footer>
    </aside>
  )
}
