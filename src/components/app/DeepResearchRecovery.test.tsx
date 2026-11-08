import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { DeepResearchSession, EvidenceSource } from '../../api/deepResearch'
import { DeepResearchResults } from './DeepResearchResults'
import { ReportUnavailable } from './deepResearchParts'
import { reportFailureHint } from '../../lib/deepResearch'
import { buildReportLocally, reportToWordHtml } from '../../lib/deepResearchLocalReport'
import { buildCitationIndex, dedupeByDoi, mergeSourceRows, sampleSizeFrom, sourceFacts } from '../../lib/deepResearchView'

const row = (over: Partial<EvidenceSource>): EvidenceSource => ({
  id: 's', questionId: 'q1', title: 'A paper', authors: ['Smith, J.'], year: 2024, journal: 'J', doi: `10.1/${over.id ?? 's'}`,
  polarity: 'Supports', strength: 'Moderate', geography: 'Unknown', decision: 'Accepted', decidedBy: 'Humaniser',
  exclusionReason: null, quote: null, verification: 'Verified', foundVia: [], ...over,
})

const finding = (over: Partial<NonNullable<DeepResearchSession['result']>['keyFindings'][number]> = {}) => ({
  statement: 'Generative AI use is positively associated with self-efficacy.', evidenceQuestionId: 'q1', supportingSourceIds: ['a'], contradictingSourceIds: [] as string[],
  strength: 'Moderate', scope: 'Does X influence Y; population: students; geography: South Africa', caveats: [] as string[], ...over,
})

const session = (over: Partial<DeepResearchSession> = {}, findings = [finding()]): DeepResearchSession => ({
  id: 'sess', projectId: 'p', researchQuestion: 'What is the relationship between AI use and self-efficacy?', mode: 'RelationshipInvestigation', status: 'Stopped',
  isFinished: true, completionNote: 'The research reached its limit.', createdAt: '', updatedAt: '',
  progress: { phase: 'Stopped', message: '', evidenceQuestions: 3, questionsAnswered: 1, sourcesDiscovered: 4, sourcesRelevant: 3, sourcesVerified: 4, searchesRun: 9 },
  result: {
    evidenceStrength: 'Weak', keyFindings: findings, gapCandidates: [], limitations: [], evidenceGaps: [], providerCoverage: [], acceptedSources: 2, contradictorySources: 1,
    questions: [
      { id: 'q1', type: 'Relationship', question: 'Does AI use relate to self-efficacy?', status: 'Resolved', sufficiency: 'Sufficient', reasons: [] },
      { id: 'q2', type: 'Theory', question: 'Which theories apply?', status: 'Researching', sufficiency: 'PartiallySufficient', reasons: ['Only one source so far.'] },
      { id: 'q3', type: 'Context', question: 'What is the regional context?', status: 'Open', sufficiency: 'Insufficient', reasons: [] },
    ],
  },
  ...over,
})

const rows = [
  row({ id: 'a', title: 'AI and writing self-efficacy', quote: 'Generative AI use was positively associated with self-efficacy (n = 412).' }),
  row({ id: 'c', title: 'A null result', polarity: 'Null', quote: 'The relationship was non-significant.' }),
  row({ id: 'u', title: 'Unchecked record', verification: 'Unverifiable', questionId: 'q2' }),
]

describe('1. report load failure: the cause is explained and there is always a way forward', () => {
  it('names the likely cause in words', () => {
    expect(reportFailureHint({ response: { status: 404 } })).toMatch(/older version.*restarting/i)
    expect(reportFailureHint({ response: { status: 400 } })).toMatch(/only once the research has finished/i)
    expect(reportFailureHint({ response: { status: 500 } })).toMatch(/error while building/i)
    expect(reportFailureHint({ code: 'ERR_NETWORK', message: 'Network Error' })).toMatch(/could not be reached/i)
    expect(reportFailureHint(new Error('x'))).toBe('The server did not return the report.')
  })

  it('shows Retry and Generate report, with the hint, as an alert', () => {
    const html = renderToStaticMarkup(<ReportUnavailable hint="The server is older." canGenerate onRetry={() => {}} onGenerate={() => {}} />)
    expect(html).toContain('role="alert"')
    expect(html).toContain('The server is older.')
    expect(html).toContain('Retry')
    expect(html).toContain('Generate report')
    expect(renderToStaticMarkup(<ReportUnavailable canGenerate={false} onRetry={() => {}} onGenerate={() => {}} />)).toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>).)*Generate report/s)
  })

  const errorPage = (extra: Partial<React.ComponentProps<typeof DeepResearchResults>> = {}) => renderToStaticMarkup(
    <DeepResearchResults session={session()} rows={rows} busyId={null} addedIds={new Set()} onDecide={async () => {}} onAdd={async () => {}} onUse={() => {}}
      onExport={() => {}} exporting={false} onFollowUp={() => {}} onNew={() => {}}
      reportFailed reportErrorHint="Older server." onRetryReport={() => {}} onGenerateReport={() => {}} onExportReport={() => {}} {...extra} />,
  )

  it('7. keeps every action on the page in the error state: export, research the rest, download evidence', () => {
    const html = errorPage()
    expect(html).toContain('Retry')
    expect(html).toContain('Generate report')
    expect(html).toContain('Export report (Word)')
    expect(html).toMatch(/Research remaining 3 questions/)                      // visible even with no price, as a disabled chip that says why
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*title="The server could not price a follow-up[^>]*>/)
    expect(html).toContain('Download evidence package')
    expect(html).toContain('Find gaps')
  })

  it('still shows the findings in the error state, so there is something to read', () => {
    const html = errorPage()
    expect(html).toContain('Generative AI use is positively associated with self-efficacy.')
  })

  it('offers the paid-for follow-up as the filled chip once the server prices it', () => {
    const quote = { canContinue: true, reason: null, answeredQuestions: 1, unansweredQuestions: 2, freshCredits: 14, followUpCredits: 7, depth: 'standard' }
    const html = errorPage({ followUpQuote: quote, onContinue: () => {} })
    expect(html).toContain('Research remaining 2 questions · 7 credits')
    expect(html.match(/data-primary="true"/g)).toHaveLength(1)
  })
})

describe('2. Cited N comes from one shared index, never 0 when findings cite sources', () => {
  const groups = dedupeByDoi(mergeSourceRows(rows))

  it('counts the sources the key findings name when there is no report', () => {
    const idx = buildCitationIndex(groups, null, [finding({ supportingSourceIds: ['a'], contradictingSourceIds: ['c'] })])
    expect(idx.ids).toEqual(['a', 'c'])
    expect(idx.numbers.get('a')).toBe(1)
    expect(idx.numbers.get('c')).toBe(2)
    expect(idx.cited.size).toBe(2)
  })
  it('puts the report’s own numbers first and numbers finding-only sources after them', () => {
    const idx = buildCitationIndex(groups, { references: [{ sourceId: 'c', number: 1 }, { sourceId: 'a', number: 2 }] }, [finding({ supportingSourceIds: ['a', 'u'] })])
    expect(idx.numbers.get('c')).toBe(1)
    expect(idx.numbers.get('a')).toBe(2)
    expect(idx.numbers.get('u')).toBe(3)
    expect(idx.ids).toEqual(['c', 'a', 'u'])
  })
  it('resolves a merged duplicate: a finding that names the other record counts the paper once', () => {
    const dup = dedupeByDoi(mergeSourceRows([row({ id: 'x1', doi: '10.9/z' }), row({ id: 'x2', doi: '10.9/z' })]))
    const idx = buildCitationIndex(dup, null, [finding({ supportingSourceIds: ['x2', 'x1'] })])
    expect(idx.ids).toEqual(['x1'])
  })
  it('shows "Cited 2" on the page from the findings alone, and numbers the markers', () => {
    const html = renderToStaticMarkup(
      <DeepResearchResults session={session({}, [finding({ supportingSourceIds: ['a'], contradictingSourceIds: ['c'] })])} rows={rows} busyId={null} addedIds={new Set()}
        onDecide={async () => {}} onAdd={async () => {}} onUse={() => {}} onExport={() => {}} exporting={false} onFollowUp={() => {}} onNew={() => {}} />,
    )
    expect(html).toContain('>Cited 2<')
    expect(html).not.toContain('>Cited 0<')
    expect(html).toMatch(/aria-label="Source 1: AI and writing self-efficacy\./)
    expect(html).toMatch(/aria-label="Source 2: A null result\./)
  })
})

describe('the report built in the browser follows the server’s rules', () => {
  it('keeps cited, verified findings; drops the rest to gaps; numbers references; and states no claim of its own', () => {
    const s = session({}, [finding(), finding({ evidenceQuestionId: 'q2', statement: 'A theory applies.', supportingSourceIds: ['u'] }), finding({ evidenceQuestionId: 'q1', statement: 'Nothing cited.', supportingSourceIds: [] })])
    const r = buildReportLocally(s, rows)
    expect(r.builtLocally).toBe(true)
    expect(r.sections).toHaveLength(1)
    expect(r.sections[0].claims[0].sourceIds).toEqual(['a'])
    expect(r.bottomLine.map(c => c.text)).toEqual(['Generative AI use is positively associated with self-efficacy.'])
    expect(r.references.map(x => x.sourceId)).toEqual(['a', 'c'])
    expect(r.references[0].number).toBe(1)
    // an unverified source cannot be cited, so its question is a gap that says so
    const q2 = r.gaps.find(g => g.questionId === 'q2')!
    expect(q2.reason).toContain('no verified source')
    expect(r.gaps.some(g => g.questionId === 'q3' && g.reason.includes('Not reached'))).toBe(true)
    const all = [...r.bottomLine, ...r.sections.flatMap(x => x.claims), ...r.conflicts]
    expect(all.every(c => c.sourceIds.length > 0)).toBe(true)
  })
  it('reports a null result in the source’s own words', () => {
    const r = buildReportLocally(session(), rows)
    expect(r.conflicts).toHaveLength(1)
    expect(r.conflicts[0].text).toContain('non-significant')
    expect(r.conflicts[0].sourceIds).toEqual(['c'])
  })
  it('gives a stopped run with no citable evidence a report made of gaps, never an empty state', () => {
    const r = buildReportLocally(session({}, []), [])
    expect(r.bottomLine).toEqual([])
    expect(r.bottomLineNote).toMatch(/No verified source/)
    expect(r.gaps.length).toBe(3)
  })
  it('exports a Word-readable file with headings, inline markers and references, escaping markup', () => {
    const r = buildReportLocally(session({ researchQuestion: 'Does <b>AI</b> help & hurt?' }), rows)
    const html = reportToWordHtml(r)
    expect(html).toContain('<h2>Bottom line</h2>')
    expect(html).toContain('<h2>References</h2>')
    expect(html).toContain('self-efficacy. [1]')
    expect(html).toContain('[1] Smith, J. (2024). AI and writing self-efficacy.')
    expect(html).toContain('Does &lt;b&gt;AI&lt;/b&gt; help &amp; hurt?')
    expect(html).not.toContain('<b>AI</b>')
  })
})

describe('6. what a source card shows is only what the data states', () => {
  it('reads a sample size only when the text states one', () => {
    expect(sampleSizeFrom('A survey (n = 1,204) found...')).toBe(1204)
    expect(sampleSizeFrom('Among 412 students, usability...')).toBe(412)
    expect(sampleSizeFrom('N=88')).toBe(88)
    expect(sampleSizeFrom('Usability matters in 2024 for 5 reasons.')).toBeNull()
    expect(sampleSizeFrom('about 5,000,000 respondents')).toBeNull()
    expect(sampleSizeFrom(null)).toBeNull()
  })
  it('states stance, design (full text only), region match, and never invents a sample', () => {
    const [g] = mergeSourceRows([row({ id: 'z', polarity: 'Contradicts', geography: 'Regional', coverage: 'FullText', studyDesign: 'Longitudinal', quote: 'No effect (n = 90).' })])
    expect(sourceFacts(g)).toEqual({ stance: 'disagrees', design: 'longitudinal study', sample: 90, region: { label: 'Nearby region', match: 'near' } })
    const [h] = mergeSourceRows([row({ id: 'y' })])
    expect(sourceFacts(h)).toEqual({ stance: 'supports', design: null, sample: null, region: { label: 'Region not stated', match: 'unknown' } })
  })
})
