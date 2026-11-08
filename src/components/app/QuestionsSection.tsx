import { rateQuestion, questionAnchor, type QuestionRow, type SourceGroup } from '../../lib/deepResearchView'
import type { EvidenceQuestion } from '../../api/deepResearch'
import { HintChip, SourceRow, prettyType } from './resultsBlocks'

/**
 * The questions the research asked, each with how well it is supported and the sources accepted for it. It is part of the
 * page (not the side panel); a source opened from here shows its verification card in the panel.
 */
export function QuestionsSection({ qRows, questions, numbers, selectedId, onSelect }: {
  qRows: QuestionRow[]
  questions: EvidenceQuestion[]
  numbers: Map<string, number>
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const researched = qRows.filter(r => r.state !== 'not-searched')
  const planned = qRows.filter(r => r.state === 'not-searched')
  const numberOf = (r: QuestionRow) => questions.findIndex(q => q.id === r.question.id) + 1
  const row = (g: SourceGroup, questionId: string) => (
    <SourceRow key={g.id} source={g} questionId={questionId} cite={numbers.get(g.id)} selected={selectedId === g.id} onSelect={() => onSelect(g.id)} />
  )
  return (
    <section aria-labelledby="questions-heading" className="space-y-3">
      <h3 id="questions-heading" tabIndex={-1} className="scroll-mt-20 text-[15px] font-semibold text-slate-900 outline-none">Questions ({questions.length})</h3>
      {researched.map(r => {
        const rating = rateQuestion(r)
        return (
          <section key={r.question.id} id={questionAnchor(r.question.id)} tabIndex={-1} aria-label={`Question ${numberOf(r)}`}
            className="scroll-mt-20 rounded-2xl border border-slate-200 bg-white p-4 outline-none focus-visible:ring-2 focus-visible:ring-purple-accent">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[12px] font-semibold tracking-wide text-purple-deep">QUESTION {numberOf(r)} · {prettyType(r.question.type)}</p>
              <span className="shrink-0"><HintChip label={rating.label} hint={rating.reason} tone={rating.tone} /></span>
            </div>
            <h4 className="mt-1 text-[15px] font-semibold text-slate-900">{r.question.question}</h4>
            <p className="mt-0.5 text-[12px] tabular-nums text-slate-600">{r.used.length} source{r.used.length === 1 ? '' : 's'} accepted{rating.cap ? ` · ${rating.cap}` : ''}</p>
            {r.question.reasons.length > 0 && r.state !== 'supported' && (
              <ul className="mt-2 list-disc pl-4 text-[12px] text-slate-600">{r.question.reasons.slice(0, 2).map((x, i) => <li key={i}>{x}</li>)}</ul>
            )}
            {r.used.length === 0
              ? <p className="mt-3 text-[12px] text-slate-600">No source has been accepted for this question.</p>
              : <ul className="mt-3 grid gap-2 md:grid-cols-2">{r.used.map(g => row(g, r.question.id))}</ul>}
          </section>
        )
      })}
      {planned.length > 0 && (
        <section className="rounded-2xl border border-dashed border-purple-200 bg-purple-tint/50 p-4">
          <h4 className="mb-1 text-[14px] font-semibold text-slate-900">{planned.length} question{planned.length === 1 ? '' : 's'} still to research</h4>
          <ul>
            {planned.map(r => (
              <li key={r.question.id} id={questionAnchor(r.question.id)} tabIndex={-1} className="scroll-mt-20 border-t border-purple-100 py-2 outline-none first:border-t-0">
                <span className="text-[13px] text-slate-800">
                  <span className="font-semibold">Question {numberOf(r)}</span>{' '}
                  <span className="ml-1 rounded-full border border-purple-200 bg-white px-2 py-0.5 text-[12px] text-purple-deep">{r.question.type}</span>
                  <span className="mt-0.5 block text-[13px] text-slate-700">{r.question.question}</span>
                </span>
                <span className="text-[12px] text-slate-600">Planned, not yet researched</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {researched.length === 0 && planned.length === 0 && <p className="text-[13px] text-slate-700">No questions were planned for this session.</p>}
    </section>
  )
}
