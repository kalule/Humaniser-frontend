import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { bySourceYearDesc, hasEvidence, questionAnchor, stepTitle, verdictLabel, verdictOf, type SourceGroup } from '../../lib/deepResearchView'
import type { EvidenceQuestion } from '../../api/deepResearch'
import { CHIP_TONES, SourceRow } from './resultsBlocks'
import { cn } from '../../lib/utils'

const VERDICT_TONE = { Answered: 'success', Partial: 'warning', NoEvidence: 'neutral', NotResearched: 'neutral', OffTopic: 'danger' } as const

/**
 * Evidence by question. Each question with accepted evidence gets a collapsible card with the server's verdict and its
 * sources. Every question without accepted evidence is listed once, together, with a single action — not repeated as an
 * empty card per question.
 */
export function QuestionsSection({ questions, groups, numbers, selectedId, onSelect, emptyAction }: {
  questions: EvidenceQuestion[]
  groups: SourceGroup[]
  numbers: Map<string, number>
  selectedId: string | null
  onSelect: (id: string) => void
  /** The one action for the questions with no accepted evidence (research them, or retry an off-topic run). */
  emptyAction?: ReactNode
}) {
  const withEvidence = questions.filter(hasEvidence)
  const without = questions.filter(q => !hasEvidence(q))
  const usedFor = (q: EvidenceQuestion) =>
    groups.filter(g => g.links.some(l => l.questionId === q.id && l.decision === 'Accepted')).sort(bySourceYearDesc)

  return (
    <section aria-labelledby="questions-heading" className="space-y-3">
      <h3 id="questions-heading" tabIndex={-1} className="scroll-mt-20 text-[15px] font-semibold text-slate-900 outline-none">Evidence by question</h3>

      {withEvidence.map(q => {
        const used = usedFor(q)
        const v = verdictOf(q)
        return (
          <details key={q.id} id={questionAnchor(q.id)} tabIndex={-1} open
            className="group scroll-mt-20 rounded-2xl border border-slate-200 bg-white outline-none focus-visible:ring-2 focus-visible:ring-purple-accent">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3 rounded-2xl p-4 outline-none focus-visible:ring-2 focus-visible:ring-purple-accent [&::-webkit-details-marker]:hidden">
              <span className="min-w-0">
                <span className="block text-[12px] font-semibold uppercase tracking-wide text-purple-deep">{stepTitle(q)}</span>
                <span className="mt-0.5 block text-[15px] font-semibold text-slate-900">{q.question}</span>
                <span className="mt-0.5 block text-[12px] tabular-nums text-slate-600">
                  {q.acceptedSources ?? used.length} source{(q.acceptedSources ?? used.length) === 1 ? '' : 's'} accepted
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className={cn('rounded-full border px-2 py-0.5 text-[12px] font-medium', CHIP_TONES[VERDICT_TONE[v]])}>{verdictLabel(q)}</span>
                <ChevronDown size={16} aria-hidden="true" className="text-slate-500 transition-transform group-open:rotate-180" />
              </span>
            </summary>
            <div className="px-4 pb-4">
              {v !== 'Answered' && q.reasons.length > 0 && (
                <ul className="mb-2 list-disc pl-4 text-[12px] text-slate-600">{q.reasons.slice(0, 2).map((x, i) => <li key={i}>{x}</li>)}</ul>
              )}
              <ul className="grid gap-2 md:grid-cols-2">
                {used.map(g => <SourceRow key={g.id} source={g} questionId={q.id} cite={numbers.get(g.id)} selected={selectedId === g.id} onSelect={() => onSelect(g.id)} />)}
              </ul>
            </div>
          </details>
        )
      })}

      {without.length > 0 && (
        <section aria-labelledby="not-researched-heading" className="rounded-2xl border border-dashed border-purple-200 bg-purple-tint/40 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 id="not-researched-heading" className="text-[14px] font-semibold text-slate-900">
                {without.length} question{without.length === 1 ? '' : 's'} not researched
              </h4>
              <p className="text-[12px] text-slate-600">No relevant source was accepted for {without.length === 1 ? 'it' : 'these'} yet.</p>
            </div>
            {emptyAction}
          </div>
          <ul className="mt-2">
            {without.map(q => (
              <li key={q.id} id={questionAnchor(q.id)} tabIndex={-1} className="scroll-mt-20 border-t border-purple-100 py-2 outline-none first:border-t-0">
                <span className="text-[12px] font-semibold uppercase tracking-wide text-purple-deep">{stepTitle(q)}</span>
                <span className="ml-2 text-[12px] text-slate-600">{verdictLabel(q)}</span>
                <span className="mt-0.5 block text-[13px] text-slate-800">{q.question}</span>
                {verdictOf(q) === 'OffTopic' && q.offTopicQuery && (
                  <span className="mt-0.5 block break-words text-[12px] text-slate-600">Search used: <code className="font-mono">{q.offTopicQuery}</code></span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {questions.length === 0 && <p className="text-[13px] text-slate-700">No questions were planned for this session.</p>}
    </section>
  )
}
