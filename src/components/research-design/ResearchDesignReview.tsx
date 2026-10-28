import type { ResearchDesignView } from '../../types/researchDesign'
import { evidenceLabel, humanLabel, severityLabel } from '../../lib/researchDesign'

const detailStyle = 'border-t border-border py-4 [&>summary]:cursor-pointer [&>summary]:font-medium [&>summary]:focus-visible:outline-primary'
export function ResearchDesignReview({ view }: { view: ResearchDesignView }) {
  const methodology = view.recommendedDesign?.methodology ?? view.methodology
  const issues = view.findings.filter(f => f.severity !== 'PASS')
  const subject = view.subject ?? view.draft?.study?.subject
  const system = subject?.kind === 'SoftwareSystemExperiment'
  const resolve = (ids: string[], rows: { id: string; name?: string; text?: string; method?: string }[]) => ids.map(id => rows.find(r => r.id === id)).filter(Boolean).map(r => r?.name ?? r?.text ?? r?.method).join(', ')
  return <div className="space-y-4 break-words">
    {methodology && <section aria-labelledby="recommendation-heading">
      <h2 id="recommendation-heading" className="text-lg font-semibold">{view.status === 'Accepted' || view.status === 'AcceptedSpecification' ? 'Accepted approach' : 'Recommended approach'}</h2>
      <p className="mt-2 font-medium">{humanLabel(methodology.family)} · {humanLabel(methodology.design)}</p>
      <h3 className="mt-4 font-medium">Why this fits</h3><p className="mt-1 text-sm text-text-secondary">{view.recommendedDesign?.rationale || methodology.rationale}</p>
    </section>}
    <dl className="grid gap-4 sm:grid-cols-2 text-sm">
      <div><dt className="font-medium">{system ? 'Systems in scope' : 'Population'}</dt><dd className="mt-1 text-text-secondary">{view.population.target || 'Not yet specified'}</dd></div>
      <div><dt className="font-medium">{system ? 'Experimental unit' : 'Sampling'}</dt><dd className="mt-1 text-text-secondary">{system ? subject?.experiment?.experimentalUnit || view.population.unitOfAnalysis || 'Not yet specified' : methodology ? humanLabel(methodology.samplingStrategy) : humanLabel(view.sampling.design)}</dd></div>
      <div><dt className="font-medium">Data collection</dt><dd className="mt-1 text-text-secondary">{view.dataCollection.map(d => d.collectionMethod || d.name).join(', ') || 'Not yet specified'}</dd></div>
      <div><dt className="font-medium">Analysis</dt><dd className="mt-1 text-text-secondary">{view.analysisPlan.map(a => a.method).join(', ') || 'Not yet specified'}</dd></div>
    </dl>
    <details className={detailStyle}><summary>Review full design</summary><div className="space-y-5 pt-4 text-sm">
      <section><h3 className="font-semibold">Research questions</h3><ol className="list-decimal pl-5 space-y-2 mt-2">{view.researchQuestions.map(q => <li key={q.id}>{q.text}</li>)}</ol></section>
      <section><h3 className="font-semibold">Objectives</h3><ol className="list-decimal pl-5 space-y-2 mt-2">{view.objectives.map(o => <li key={o.id}>{o.text}</li>)}</ol></section>
      <section><h3 className="font-semibold">{system ? 'System scope and experiment planning' : 'Population and sampling'}</h3><p>{[view.population.target, view.population.accessible, view.population.geography, view.population.unitOfAnalysis, view.population.temporalScope].filter(Boolean).join(' · ')}</p><p className="mt-2">{view.sampling.frame}</p><p>{view.sampling.rationale}</p>
        {system && <div className="mt-2"><p>Conditions: {subject?.experiment?.conditions.join(', ') || 'Not yet specified'}</p><p>Independent repetitions: {subject?.experiment?.independentRepetitions ?? 'Not yet specified'}</p><p>Independence rationale: {subject?.experiment?.independenceRationale || 'Not yet specified'}</p><p>Repetitions and telemetry counts do not establish sample adequacy.</p></div>}
        <p className="mt-2">Sample planning: {humanLabel(view.sampleAdequacy.status)}</p>{view.sampleAdequacy.completed != null && <p>Planned completed participants: {view.sampleAdequacy.completed}</p>}{view.sampleAdequacy.invited != null && <p>Planned invitations: {view.sampleAdequacy.invited}</p>}
        {view.sampleAdequacy.approximation && <p>This calculation uses an approximation.</p>}{view.sampleAdequacy.requirement && <p>{view.sampleAdequacy.requirement.reason}</p>}
        {view.sampleAdequacy.assumptions.map((a, i) => <p key={i}>{a}</p>)}
      </section>
      {view.constructs.length > 0 && <section><h3 className="font-semibold">What you will study</h3>{view.constructs.map(c => <p className="mt-2" key={c.id}><strong>{c.name}</strong>: {c.definition} {c.operationalisation}</p>)}</section>}
      {view.instruments.length > 0 && <section><h3 className="font-semibold">Measurement</h3>{view.instruments.map(i => <p className="mt-2" key={i.id}>{i.name} {i.version} {i.context}{i.permissionResolved === false ? ' · Permission still needs resolving' : ''}</p>)}</section>}
      <section><h3 className="font-semibold">Data collection and analysis</h3>{view.dataCollection.map(d => <p className="mt-2" key={d.id}>{d.name}: {d.collectionMethod}</p>)}{view.analysisPlan.map(a => <div className="mt-3" key={a.id}><h4 className="font-medium">{a.method}</h4><p>Assumptions: {a.assumptions.join('; ')}</p><p>Missing data: {a.missingDataHandling}</p></div>)}</section>
      {view.qualitativePlan && <section><h3 className="font-semibold">Qualitative approach</h3><p>{view.qualitativePlan.focus}</p><p>{view.qualitativePlan.qualityRationale}</p><p>{view.qualitativePlan.qualityPractices.join('; ')}</p></section>}
      {view.mixedMethodsPlan && <section><h3 className="font-semibold">Combining methods</h3><p>{humanLabel(view.mixedMethodsPlan.timing)} · {humanLabel(view.mixedMethodsPlan.priority)}</p><p>{view.mixedMethodsPlan.jointInterpretation}</p></section>}
      {view.ethics.length > 0 && <section><h3 className="font-semibold">Ethics</h3>{view.ethics.map((e, i) => <p key={i}>{humanLabel(e.type)}: {e.plan}</p>)}</section>}
      {view.feasibility && <section><h3 className="font-semibold">What is achievable</h3><p>{view.feasibility.monthsRequired} months planned · {view.feasibility.monthsAvailable} months available</p><p>{view.feasibility.tradeoffDecision}</p></section>}
    </div></details>
    {view.alternativeDesigns.length > 0 && <details className={detailStyle}><summary>Compare alternatives</summary><div className="pt-3 space-y-5">{view.alternativeDesigns.map(c => <section key={c.id}><h3 className="font-medium">{humanLabel(c.methodology.family)} · {humanLabel(c.methodology.design)}</h3><p className="text-sm mt-1">{c.rationale}</p><p className="text-sm mt-2">Potential advantages: {c.strengths.join('; ')}</p><p className="text-sm">Trade-offs: {c.limitations.join('; ')}</p></section>)}</div></details>}
    {view.alignment.length > 0 && <details className={detailStyle}><summary>Research alignment</summary><div className="pt-3 space-y-4 text-sm">{view.alignment.map((r, i) => <section key={i} className="border-l-2 border-border pl-3 space-y-2"><p><strong>Question:</strong> {view.researchQuestions.find(q => q.id === r.questionId)?.text || 'Question unavailable'}</p><p><strong>Objective:</strong> {view.objectives.find(o => o.id === r.objectiveId)?.text || 'Not yet linked'}</p><p><strong>Data:</strong> {r.dataRequired || resolve(r.dataSourceIds, view.dataCollection) || 'Not yet linked'}</p><p><strong>Analysis:</strong> {resolve(r.analysisIds, view.analysisPlan) || 'Not yet linked'}</p><p><strong>Expected output:</strong> {r.expectedOutput}</p></section>)}</div></details>}
    {view.evidence.length > 0 && <details className={detailStyle}><summary>Evidence supporting the design</summary><div className="pt-3 space-y-4 text-sm">{view.evidence.map(e => <section key={e.needId}><h3 className="font-medium">{e.label}</h3><p className="mt-1 font-medium">{evidenceLabel(e)}</p><p>{e.reason}</p>{e.evidenceCount > 0 && <p>{e.evidenceCount} linked evidence reference{e.evidenceCount === 1 ? '' : 's'}</p>}{e.limitations.map((l, i) => <p key={i} className="mt-1">{l}</p>)}</section>)}</div></details>}
    <section aria-labelledby="issues-heading" className="border-t border-border pt-4"><h2 id="issues-heading" className="font-semibold">Review notes</h2>{issues.length === 0 ? <p className="mt-2 text-sm">{['NotAssessed', 'Stale'].includes(view.readiness.status) ? 'Design checks have not completed yet.' : 'No issues reported.'}</p> : <ul className="mt-3 space-y-4 text-sm">{[...issues].sort((a, b) => ['BLOCKER', 'MAJOR', 'MINOR', 'WARNING'].indexOf(a.severity) - ['BLOCKER', 'MAJOR', 'MINOR', 'WARNING'].indexOf(b.severity)).map((f, i) => <li key={`${f.ruleId}-${i}`}><p className="font-medium">{severityLabel[f.severity] ?? 'Review'} · {humanLabel(f.category)}</p><p>{f.message}</p>{f.repairGuidance && <p className="mt-1 text-text-secondary">{f.repairGuidance}</p>}</li>)}</ul>}</section>
    <p className="text-sm border-t border-border pt-4"><strong>Readiness: </strong>{view.status === 'Accepted' || view.status === 'AcceptedSpecification' ? 'Accepted' : view.readiness.status === 'ReadyForReview' ? 'Ready for your review' : humanLabel(view.readiness.status)}</p>
  </div>
}


