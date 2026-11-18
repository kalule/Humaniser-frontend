import { useState } from 'react'
import { CheckCircle2, Lightbulb, Plus, X } from 'lucide-react'
import { researchPaperApi } from '../../api/researchPaper'
import { Notice, Panel } from '../literatureReview/ui'
import { btn, inputClass } from '../literatureReview/styles'
import { errorMessage, type Paper, type TopicSuggestion } from '../../lib/researchPaper'

/**
 * Stage 1: the topic becomes a problem statement, research questions, objectives, scope and an approach. Suggestions
 * are advice the user chooses to use; nothing is saved until they save. Approving the questions (gate 1) is what lets
 * the search start; editing them afterwards needs a new approval.
 */
export function QuestionStage({ paper, onChanged, onNext }: { paper: Paper; onChanged: (p?: Paper) => void; onNext: () => void }) {
  const [form, setForm] = useState({
    topic: paper.topic, problemStatement: paper.problemStatement ?? '', questions: paper.researchQuestions.length ? paper.researchQuestions : [''],
    objectives: paper.objectives.length ? paper.objectives : [''], scope: paper.scope ?? '', approach: paper.recommendedApproach ?? '', minSources: paper.minSourceTarget,
  })
  const [suggestion, setSuggestion] = useState<TopicSuggestion | null>(null)
  const [busy, setBusy] = useState<'save' | 'suggest' | 'approve' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const dirty = form.topic !== paper.topic || form.problemStatement !== (paper.problemStatement ?? '') || form.scope !== (paper.scope ?? '')
    || form.approach !== (paper.recommendedApproach ?? '') || form.minSources !== paper.minSourceTarget
    || JSON.stringify(form.questions.filter(q => q.trim())) !== JSON.stringify(paper.researchQuestions)
    || JSON.stringify(form.objectives.filter(o => o.trim())) !== JSON.stringify(paper.objectives)

  const save = async () => {
    setBusy('save'); setError(null); setSaved(false)
    try {
      const next = await researchPaperApi.update(paper.id, {
        revision: paper.revision, topic: form.topic, problemStatement: form.problemStatement, researchQuestions: form.questions.filter(q => q.trim()),
        objectives: form.objectives.filter(o => o.trim()), scope: form.scope, recommendedApproach: form.approach, minSourceTarget: form.minSources,
      })
      onChanged(next); setSaved(true)
      return next
    } catch (e) { setError(errorMessage(e, 'The changes could not be saved.')); return null } finally { setBusy(null) }
  }
  const suggest = async () => {
    setBusy('suggest'); setError(null)
    try { setSuggestion(await researchPaperApi.suggestTopic(paper.id)) } catch (e) { setError(errorMessage(e, 'Suggestions are not available right now.')) } finally { setBusy(null) }
  }
  const approve = async () => {
    const current = dirty ? await save() : paper
    if (!current) return
    setBusy('approve'); setError(null)
    try { onChanged(await researchPaperApi.approveQuestion(paper.id, current.revision)); onNext() }
    catch (e) { setError(errorMessage(e, 'The question could not be approved.')) } finally { setBusy(null) }
  }
  const use = (patch: Partial<typeof form>) => setForm(f => ({ ...f, ...patch }))

  const listEditor = (key: 'questions' | 'objectives', label: string, max: number) => (
    <fieldset className="space-y-2">
      <legend className="text-[14px] font-medium text-slate-900">{label}</legend>
      {form[key].map((value, i) => (
        <div key={i} className="flex gap-2">
          <label className="sr-only" htmlFor={`rp-${key}-${i}`}>{label} {i + 1}</label>
          <input id={`rp-${key}-${i}`} value={value} maxLength={400} onChange={e => use({ [key]: form[key].map((v, j) => j === i ? e.target.value : v) } as Partial<typeof form>)} className={inputClass} />
          <button type="button" aria-label={`Remove ${label.toLowerCase()} ${i + 1}`} onClick={() => use({ [key]: form[key].filter((_, j) => j !== i) } as Partial<typeof form>)} className={btn.small}><X size={14} aria-hidden /></button>
        </div>
      ))}
      {form[key].length < max ? <button type="button" onClick={() => use({ [key]: [...form[key], ''] } as Partial<typeof form>)} className={btn.small}><Plus size={14} aria-hidden /> Add</button> : null}
    </fieldset>
  )

  return (
    <div className="space-y-4">
      {paper.studentMode ? <Notice tone="info">A good research question names who, what and where. Write it yourself or use a suggestion as a starting point; the search runs only on the question you approve.</Notice> : null}
      <Panel title="Research question" id="rp-question" description="What the paper sets out to answer."
        actions={<button type="button" onClick={() => void suggest()} disabled={!!busy} className={btn.secondary}><Lightbulb size={16} aria-hidden /> {busy === 'suggest' ? 'Thinking…' : 'Suggest'}</button>}>
        <div className="space-y-4">
          <div>
            <label htmlFor="rp-q-topic" className="block text-[14px] font-medium text-slate-900">Topic</label>
            <textarea id="rp-q-topic" rows={2} value={form.topic} maxLength={1000} onChange={e => use({ topic: e.target.value })} className={inputClass + ' mt-1'} />
          </div>
          <div>
            <label htmlFor="rp-q-problem" className="block text-[14px] font-medium text-slate-900">Problem statement</label>
            <textarea id="rp-q-problem" rows={3} value={form.problemStatement} maxLength={3000} onChange={e => use({ problemStatement: e.target.value })} className={inputClass + ' mt-1'} />
          </div>
          {listEditor('questions', 'Research questions', 5)}
          {listEditor('objectives', 'Objectives', 8)}
          <div>
            <label htmlFor="rp-q-scope" className="block text-[14px] font-medium text-slate-900">Scope</label>
            <textarea id="rp-q-scope" rows={2} value={form.scope} maxLength={2000} onChange={e => use({ scope: e.target.value })} className={inputClass + ' mt-1'} />
          </div>
          <div>
            <label htmlFor="rp-q-approach" className="block text-[14px] font-medium text-slate-900">Approach</label>
            <textarea id="rp-q-approach" rows={2} value={form.approach} maxLength={3000} onChange={e => use({ approach: e.target.value })} className={inputClass + ' mt-1'} />
          </div>
          <div className="max-w-xs">
            <label htmlFor="rp-q-min" className="block text-[14px] font-medium text-slate-900">Fewest sources to rest on</label>
            <input id="rp-q-min" type="number" min={3} max={200} value={form.minSources} onChange={e => use({ minSources: Number(e.target.value) })} className={inputClass + ' mt-1'} />
          </div>
        </div>
      </Panel>

      {suggestion ? (
        <Panel title="Suggestions" id="rp-suggest" description={suggestion.notice}>
          {suggestion.droppedStatements > 0 ? <Notice tone="info">{suggestion.droppedStatements} suggested line{suggestion.droppedStatements === 1 ? ' was' : 's were'} left out because {suggestion.droppedStatements === 1 ? 'it' : 'they'} stated findings or statistics that have not been checked.</Notice> : null}
          <dl className="mt-3 space-y-3 text-[14px]">
            {suggestion.problemStatement ? <Suggested label="Problem statement" value={suggestion.problemStatement} onUse={() => use({ problemStatement: suggestion.problemStatement! })} /> : null}
            {suggestion.researchQuestions.length ? <Suggested label="Research questions" value={suggestion.researchQuestions.join(' · ')} onUse={() => use({ questions: suggestion.researchQuestions })} /> : null}
            {suggestion.objectives.length ? <Suggested label="Objectives" value={suggestion.objectives.join(' · ')} onUse={() => use({ objectives: suggestion.objectives })} /> : null}
            {suggestion.scope ? <Suggested label="Scope" value={suggestion.scope} onUse={() => use({ scope: suggestion.scope! })} /> : null}
            {suggestion.recommendedApproach ? <Suggested label="Approach" value={suggestion.recommendedApproach} onUse={() => use({ approach: suggestion.recommendedApproach! })} /> : null}
          </dl>
        </Panel>
      ) : null}

      {error ? <Notice tone="error">{error}</Notice> : null}
      {saved && !dirty ? <Notice tone="success" role="status">Saved.</Notice> : null}
      {paper.questionApproved && !dirty
        ? <Notice tone="success" role="status"><CheckCircle2 size={14} className="mr-1 inline" aria-hidden />Approved. The search runs on these questions; changing them needs a new approval.</Notice>
        : paper.questionApprovedAt ? <Notice tone="warning">The questions changed after you approved them. Approve them again before searching.</Notice> : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void save()} disabled={!dirty || !!busy} className={btn.secondary}>{busy === 'save' ? 'Saving…' : 'Save'}</button>
        <button type="button" onClick={() => void approve()} disabled={!!busy || form.questions.every(q => !q.trim())} className={btn.primary}>{busy === 'approve' ? 'Approving…' : paper.questionApproved && !dirty ? 'Continue to sources' : 'Approve the question'}</button>
      </div>
    </div>
  )
}

function Suggested({ label, value, onUse }: { label: string; value: string; onUse: () => void }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <dt className="text-[13px] font-medium text-slate-700">{label}</dt>
      <dd className="mt-1 flex flex-wrap items-start justify-between gap-2 text-slate-900"><span className="min-w-0 flex-1">{value}</span><button type="button" onClick={onUse} className={btn.small}>Use</button></dd>
    </div>
  )
}
