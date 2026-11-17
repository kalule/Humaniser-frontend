import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { DeepResearchSession, EvidenceQuestion, EvidenceSource, FollowUpQuote } from '../../api/deepResearch'
import { DeepResearchResults, SourceDetail } from './DeepResearchResults'
import { mergeSourceRows } from '../../lib/deepResearchView'

// The results page renders what the server decided — verdicts, counts, stance, status reason — and invents none of it.

const row = (over: Partial<EvidenceSource>): EvidenceSource => ({
  id: 's', questionId: 'q1', title: 'A paper', authors: ['A'], year: 2024, journal: 'J', doi: `10.1/${over.id ?? 's'}`,
  polarity: 'Supports', strength: 'Moderate', geography: 'Unknown', decision: 'Accepted', decidedBy: 'Humaniser',
  exclusionReason: null, quote: null, verification: 'Verified', foundVia: [], ...over,
})

const q = (id: string, over: Partial<EvidenceQuestion>): EvidenceQuestion =>
  ({ id, type: 'Definition', question: `Question ${id}?`, status: 'Exhausted', sufficiency: 'Insufficient', reasons: [], ...over })

const questions: EvidenceQuestion[] = [
  q('q1', { type: 'Definition', question: 'What is microfinance?', status: 'Resolved', sufficiency: 'Sufficient', verdict: 'Answered', verdictLabel: 'Answered', shortTitle: 'Definition', acceptedSources: 2 }),
  q('q2', { type: 'Relationship', question: 'What mechanisms link microfinance to women’s income?', verdict: 'Partial', verdictLabel: 'Partly answered', shortTitle: 'Mechanisms', acceptedSources: 1, reasons: ['Needs 2 strong or moderate source(s); has 1.'] }),
  q('q3', { type: 'Effect', question: 'What is the effect of microfinance on women’s income?', verdict: 'NoEvidence', verdictLabel: 'No relevant sources', shortTitle: 'Effect' }),
  q('q4', { type: 'Geography', question: 'What is the impact in South Africa?', verdict: 'NotResearched', verdictLabel: 'Not researched', shortTitle: 'South Africa' }),
]

const session = (status: DeepResearchSession['status'], over: Partial<DeepResearchSession> = {}): DeepResearchSession => ({
  id: 'sess', projectId: 'p', researchQuestion: 'Does microfinance increase women’s income?', mode: 'TopicExploration', status,
  isFinished: true, completionNote: 'The research reached its limit before every question was answered. Everything found so far is kept.',
  statusReason: status === 'Stopped' ? 'Stopped: source limit reached' : null, creditsUsed: 9,
  progress: { phase: 'Stopped', message: '', evidenceQuestions: 4, questionsAnswered: 1, sourcesDiscovered: 5, sourcesRelevant: 3, sourcesVerified: 5, searchesRun: 4 },
  createdAt: '', updatedAt: '',
  result: {
    evidenceStrength: 'Weak', keyFindings: [], gapCandidates: [], evidenceGaps: [], providerCoverage: [],
    limitations: ['Some accepted sources were judged from their abstract only; their strength is capped at Moderate.'],
    acceptedSources: 3, contradictorySources: 1, verdict: 'Partial', verdictLabel: 'Partly answered', questions,
    counts: { found: 5, relevant: 3, accepted: 3, cited: 2, supports: 1, contradicts: 1, noEffect: 1, background: 1, offTopic: 1, leftOut: 1, relevanceUnknown: 0 },
  },
  ...over,
})

const rows = [
  row({ id: 'a', questionId: 'q1', title: 'Defining microfinance', polarity: 'Background', stance: 'Background', relevance: 'Relevant', quote: 'Microfinance is the provision of small loans.' }),
  row({ id: 'a', questionId: 'q2', title: 'Defining microfinance', polarity: 'Supports', stance: 'Supports', relevance: 'Relevant' }),
  row({ id: 'c', questionId: 'q1', title: 'Loans that changed nothing', polarity: 'Null', stance: 'NoEffect', relevance: 'Relevant' }),
  row({ id: 'd', questionId: 'q2', title: 'Microcredit lowered income', polarity: 'Contradicts', stance: 'Contradicts', relevance: 'Relevant' }),
  row({ id: 'o', questionId: 'q1', title: 'ChatGPT and academic writing', decision: 'Rejected', exclusionReason: 'off topic', stance: 'OffTopic', relevance: 'OffTopic', relevanceReason: 'About AI writing tools, not microfinance.' }),
  row({ id: 'l', questionId: 'q3', title: 'Wrong population', decision: 'Rejected', exclusionReason: 'studies a different population', stance: 'NotUsed', relevance: 'Relevant' }),
]

const report = {
  sessionId: 'sess', researchQuestion: 'q', evidenceStrength: 'Weak',
  bottomLine: [{ text: 'Microfinance is the provision of small loans to people without access to banks.', sourceIds: ['a'] }], bottomLineNote: null,
  sections: [{ questionId: 'q1', heading: 'What is microfinance?', sufficiency: 'Sufficient', claims: [{ text: 'Microfinance is the provision of small loans to people without access to banks.', sourceIds: ['a'] }] }],
  conflicts: [{ text: 'Reported findings that disagree: income fell.', sourceIds: ['d'] }],
  noEffect: [{ text: 'Found no effect on: What is microfinance?', sourceIds: ['c'] }],
  gaps: [
    { questionId: 'q2', question: 'What mechanisms link microfinance to women’s income?', reason: 'Partly answered. Needs 2 strong or moderate source(s); has 1.' },
    { questionId: 'q3', question: 'What is the effect of microfinance on women’s income?', reason: 'No verified source answered this question.' },
    { questionId: 'q4', question: 'What is the impact in South Africa?', reason: 'Not reached before the research stopped.' },
  ],
  references: [
    { number: 1, sourceId: 'a', title: 'Defining microfinance', authors: ['A'], year: 2024, journal: 'J', doi: null },
    { number: 2, sourceId: 'd', title: 'Microcredit lowered income', authors: ['B'], year: 2023, journal: null, doi: null },
    { number: 3, sourceId: 'c', title: 'Loans that changed nothing', authors: ['C'], year: 2022, journal: null, doi: null },
  ],
  status: 'Stopped',
}

const quote: FollowUpQuote = { canContinue: true, reason: null, answeredQuestions: 1, unansweredQuestions: 3, freshCredits: 14, followUpCredits: 12, depth: 'standard' }
const noop = async () => {}
const render = (s: DeepResearchSession, extra: Partial<React.ComponentProps<typeof DeepResearchResults>> = {}) => renderToStaticMarkup(
  <DeepResearchResults session={s} rows={rows} busyId={null} addedIds={new Set()} onDecide={noop} onAdd={noop} onUse={() => {}}
    onExport={() => {}} exporting={false} onFollowUp={() => {}} onNew={() => {}} report={report} onExportReport={() => {}} {...extra} />,
)
const at = (html: string, needle: string) => { const i = html.indexOf(needle); expect(i, `"${needle}" should be on the page`).toBeGreaterThan(-1); return i }

describe('a stopped run with partial evidence', () => {
  const html = render(session('Stopped'), { followUpQuote: quote, onContinue: () => {} })

  it('header: status badge with the reason, and the credits used', () => {
    expect(html).toMatch(/data-testid="status-badge"[^>]*>Stopped: source limit reached</)
    expect(html).toContain('9 credits used')
  })

  it('verdict card: the server’s verdict, one-sentence answer with its citation, strength, and the caveats inline', () => {
    const card = html.slice(at(html, 'id="verdict-heading"'), at(html, '<ol aria-label="Questions"'))
    expect(card).toContain('>Partly answered</h3>')
    expect(card).toContain('Microfinance is the provision of small loans')
    expect(card).toMatch(/aria-label="Source 1: Defining microfinance\./)
    expect(card).toContain('Evidence strength: Limited evidence')
    expect(card).toContain('Keep in mind')
    expect(card).toContain('judged from their abstract only')
    expect(html.match(/Keep in mind|Things to keep in mind/g)).toHaveLength(1)        // moved, not repeated at the bottom
  })

  it('progress strip: labelled by question, in order, from the server’s verdicts', () => {
    const strip = html.slice(at(html, '<ol aria-label="Questions"'), at(html, 'id="questions-heading"'))
    const titles = [...strip.matchAll(/<span class="truncate">([^<]+)<\/span>/g)].map(m => m[1])
    expect(titles).toEqual(['Definition', 'Mechanisms', 'Effect', 'South Africa'])
    expect(strip).toContain('aria-label="Mechanisms: Partly answered. Go to this question."')
    expect(strip).toContain('aria-label="Effect: No relevant sources. Go to this question."')
  })

  it('evidence by question: cards only for questions with evidence, the rest in one block with one action', () => {
    expect(html.match(/<details/g)).toHaveLength(2)
    expect(html).toContain('2 questions not researched')
    const block = html.slice(at(html, 'id="not-researched-heading"'), at(html, 'aria-label="Next steps"'))
    expect(block.match(/Research remaining 3 questions/g)).toHaveLength(1)
  })

  it('a question with no relevant sources never shows support', () => {
    const effect = html.slice(at(html, 'id="question-q3"'), at(html, 'id="question-q3"') + 400)
    expect(effect).toContain('No relevant sources')
    expect(effect).not.toMatch(/Some support|Answered|Partly answered/)
  })

  it('contradicting and no-effect evidence are separate sections; a null result is never called a conflict', () => {
    expect(html).toContain('id="report-conflicts"')
    expect(html).toContain('Contradicting evidence')
    expect(html).toContain('id="report-noeffect"')
    expect(html).toContain('No effect found')
    expect(html).not.toContain('Conflicting evidence')
    expect(at(html, 'id="report-conflicts"')).toBeLessThan(at(html, 'id="report-noeffect"'))
  })

  it('gaps: only those not already in the not-researched block', () => {
    const gaps = html.slice(at(html, 'id="report-gaps-list"'), at(html, 'aria-label="Next steps"'))
    expect(gaps).toContain('What mechanisms link microfinance')
    expect(gaps).not.toContain('What is the effect of microfinance')
    expect(gaps).not.toContain('impact in South Africa')
  })

  it('sticky action bar: one filled action, the cost in plain words', () => {
    const bar = html.slice(at(html, 'aria-label="Next steps"'), at(html, 'id="report-followup"'))
    expect(bar).toContain('Research remaining 3 questions')
    expect(bar).toContain('Find gaps (3)')
    expect(bar).toContain('Export report')
    expect(bar).toMatch(/Save sources \(\d+\)/)
    expect(bar).toContain('Uses 12 credits; unused credits are returned.')
    expect(html.match(/data-primary="true"/g)).toHaveLength(1)
  })

  it('sources rail: chips are the server’s counts, citations numbered in report order', () => {
    const chip = (label: string, n: number) => new RegExp(`>${label} <span class="tabular-nums">${n}<`)
    expect(html).toMatch(chip('Cited', 2))
    expect(html).toMatch(chip('Contradicts', 1))
    expect(html).toMatch(chip('No effect', 1))
    expect(html).toMatch(chip('Off-topic', 1))
    expect(html).toMatch(chip('Left out', 1))
    expect(html).toMatch(chip('All', 5))
    expect(html).toContain('5 found · 3 accepted · 2 cited · 1 contradict · 1 found no effect · 1 off-topic · 1 left out')
  })

  it('the off-topic filter lists the off-topic source with why', () => {
    const off = render(session('Stopped'), { initialSourceFilter: 'offTopic' })
    expect(off).toContain('ChatGPT and academic writing')
    expect(off).toContain('About AI writing tools, not microfinance.')
  })

  it('follow-up input is last in the centre column', () => {
    expect(at(html, 'aria-label="Next steps"')).toBeLessThan(at(html, 'id="report-followup"'))
  })
})

describe('a run whose results were off-topic (NeedsReview)', () => {
  const off = session('NeedsReview', {
    statusReason: 'Needs review: results off-topic', creditsUsed: 0,
    completionNote: 'Most searches returned papers about a different subject, so no answer is given. This was our failure: retrying is free.',
    result: {
      ...session('Stopped').result!, verdict: 'NeedsReview', verdictLabel: 'Results look off-topic',
      questions: questions.map(x => ({ ...x, verdict: 'OffTopic' as const, verdictLabel: 'Results off-topic', acceptedSources: 0, offTopicQuery: '"Generative AI tool use" definition' })),
      counts: { found: 30, relevant: 0, accepted: 0, cited: 0, supports: 0, contradicts: 0, noEffect: 0, background: 0, offTopic: 30, leftOut: 0, relevanceUnknown: 0 },
    },
  })
  const retryQuote: FollowUpQuote = { ...quote, canContinue: false, reason: 'The results were off-topic, so this run cannot be continued.', canRetryFree: true }
  const html = render(off, { followUpQuote: retryQuote, onContinue: () => {}, onRetry: () => {}, report: { ...report, bottomLine: [], bottomLineNote: 'The searches returned papers about a different subject.', sections: [], conflicts: [], noEffect: [], references: [] } })

  it('replaces the verdict with "Results look off-topic", the queries used, and a free Retry', () => {
    expect(html).toContain('Results look off-topic')
    expect(html).toContain('&quot;Generative AI tool use&quot; definition')
    expect(html).toContain('Retry search · free')
    expect(html).toContain('Uses no credits: the search failed on our side.')
    expect(html).toMatch(/data-testid="status-badge"[^>]*>Needs review: results off-topic</)
    expect(html).toContain('No credits used')
  })

  it('never offers the paid "Research remaining", exports or saves', () => {
    expect(html).not.toContain('Research remaining')
    expect(html).not.toContain('credits; unused credits are returned')
    expect(html).not.toContain('Export report')
    expect(html).not.toMatch(/Save sources/)
    expect(primaryButtonsText(html)).toEqual(['Retry search · free'])
  })

  it('opens the rail on the off-topic sources', () => {
    expect(html).toMatch(/aria-pressed="true"[^>]*>Off-topic <span class="tabular-nums">30</)
  })

  it('says when the free retry was already used', () => {
    const used = render(off, { followUpQuote: { ...retryQuote, canRetryFree: false }, onRetry: () => {} })
    expect(used).toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>).)*Retry search · free/s)
    expect(used).toContain('This run has already been retried.')
  })
})

describe('other states', () => {
  it('a completed run shows "Complete" and offers no follow-up run', () => {
    const done = render(session('Completed', { statusReason: 'Complete' }))
    expect(done).toMatch(/data-testid="status-badge"[^>]*>Complete</)
    expect(done).not.toContain('Start new research from this')
    expect(done).toContain('Download evidence package')
  })
  it('an empty run (no question answered) says so in the verdict, not with an invented label', () => {
    const empty = session('Stopped', { result: { ...session('Stopped').result!, verdict: 'NoEvidence', verdictLabel: 'Not enough evidence', questions: questions.map(x => ({ ...x, verdict: 'NotResearched' as const })) } })
    const html = render(empty, { report: { ...report, bottomLine: [], bottomLineNote: 'No verified source supports a direct answer to this question yet.', sections: [], conflicts: [], noEffect: [] } })
    expect(html).toContain('>Not enough evidence</h3>')
    expect(html).toContain('No verified source supports a direct answer')
    expect(html).toContain('4 questions not researched')
    expect(html).not.toContain('<details')
  })
})

describe('the source panel', () => {
  const detail = (quotes: (string | null)[]) => {
    const [source] = mergeSourceRows(quotes.map(q => row({ id: 'z', title: 'A very particular paper title', quote: q })))
    return renderToStaticMarkup(<SourceDetail source={source} questions={questions} busy={false} added={false} onAdd={() => {}} onUse={() => {}} onExclude={() => {}} onRestore={() => {}} />)
  }
  it('keeps the selected source title pinned at the top of the panel', () => {
    expect(detail(['A passage.'])).toMatch(/class="[^"]*\bsticky\b[^"]*"[^>]*>\s*<h3[^>]*>A very particular paper title/)
  })
  it('shows overlapping supporting quotes once, keeping the longer one', () => {
    const long = 'Usability was positively associated with satisfaction among first-year students.'
    const out = detail(['Usability was positively associated with satisfaction', long, long])
    expect(out.match(/<blockquote/g)).toHaveLength(1)
    expect(out).toContain(long)
  })
  it('says why an off-topic source is not used', () => {
    const [off] = mergeSourceRows([rows[4]])
    const out = renderToStaticMarkup(<SourceDetail source={off} questions={questions} busy={false} added={false} onAdd={() => {}} onUse={() => {}} onExclude={() => {}} onRestore={() => {}} />)
    expect(out).toContain('Off-topic: not about your question')
    expect(out).toContain('About AI writing tools, not microfinance.')
  })
  it('names the question a source is used for by its short title', () => {
    const [src] = mergeSourceRows([rows[0]])
    expect(renderToStaticMarkup(<SourceDetail source={src} questions={questions} busy={false} added={false} onAdd={() => {}} onUse={() => {}} onExclude={() => {}} onRestore={() => {}} />)).toContain('>Definition</span>')
  })
})

function primaryButtonsText(html: string) {
  return [...html.matchAll(/<button[^>]*data-primary="true"[^>]*>(.*?)<\/button>/gs)].map(m => m[1].replace(/<[^>]+>/g, '').trim())
}
