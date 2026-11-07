import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { DeepResearchReport, DeepResearchSession, EvidenceSource } from '../../api/deepResearch'
import { DeepResearchResults, SourceDetail, SourceRow } from './DeepResearchResults'
import { DeepResearchReportView } from './DeepResearchReportView'
import { CitationPreview, ClampedTitle, DisagreesBadge, QuestionProgress, SourcesSummary, StrengthMeter } from './deepResearchParts'
import { mergeSourceRows, previewQuote, sourceStrength, sourcesSummaryLine, strengthLevel } from '../../lib/deepResearchView'

const row = (over: Partial<EvidenceSource>): EvidenceSource => ({
  id: 's', questionId: 'q1', title: 'A paper', authors: ['A'], year: 2024, journal: 'J', doi: '10.1/x',
  polarity: 'Supports', strength: 'Moderate', geography: 'Unknown', decision: 'Accepted', decidedBy: 'Humaniser',
  exclusionReason: null, quote: null, verification: 'Verified', foundVia: [], ...over,
})

const session: DeepResearchSession = {
  id: 'sess', projectId: 'p', researchQuestion: 'Does LMS usability influence satisfaction', mode: 'EvidenceForClaim', status: 'Completed',
  isFinished: true, completionNote: 'Done.', createdAt: '', updatedAt: '',
  progress: { phase: 'Complete', message: '', evidenceQuestions: 3, questionsAnswered: 1, sourcesDiscovered: 3, sourcesRelevant: 1, sourcesVerified: 3, searchesRun: 2 },
  result: {
    evidenceStrength: 'Moderate', keyFindings: [], gapCandidates: [], limitations: [], evidenceGaps: [], providerCoverage: [], acceptedSources: 2, contradictorySources: 1,
    questions: [
      { id: 'q1', type: 'Definition', question: 'How is usability defined?', status: 'Resolved', sufficiency: 'Sufficient', reasons: [] },
      { id: 'q2', type: 'Gap', question: 'Is there South African evidence?', status: 'Researching', sufficiency: 'Insufficient', reasons: [] },
      { id: 'q3', type: 'Context', question: 'What platforms are common?', status: 'Open', sufficiency: 'Insufficient', reasons: [] },
    ],
  },
}
const rows = [
  row({ id: 'a', title: 'Shared source', quote: 'Usability is the ease of use of a system.' }),
  row({ id: 'c', title: 'Disagreeing paper', polarity: 'Contradicts', strength: 'Weak' }),
  row({ id: 'b', title: 'Off topic paper', decision: 'Rejected', exclusionReason: 'off topic' }),
]
const report: DeepResearchReport = {
  sessionId: 'sess', researchQuestion: 'q', evidenceStrength: 'Moderate',
  bottomLine: [{ text: 'Usability tracks satisfaction.', sourceIds: ['a'] }], bottomLineNote: null,
  sections: [{ questionId: 'q1', heading: 'How is usability defined?', sufficiency: 'Sufficient', claims: [{ text: 'Usability is ease of use.', sourceIds: ['a'] }] }],
  conflicts: [{ text: 'A study found the opposite.', sourceIds: ['c'] }],
  gaps: [{ questionId: 'q3', question: 'What platforms are common?', reason: 'Not reached before the research stopped.' }],
  references: [
    { number: 1, sourceId: 'a', title: 'Shared source', authors: ['A'], year: 2024, journal: 'J', doi: null },
    { number: 2, sourceId: 'c', title: 'Disagreeing paper', authors: ['B'], year: 2023, journal: null, doi: null },
  ],
  status: 'Completed',
}
const noop = async () => {}
const page = (extra: Partial<React.ComponentProps<typeof DeepResearchResults>> = {}, s: DeepResearchSession = session) => renderToStaticMarkup(
  <DeepResearchResults session={s} rows={rows} busyId={null} addedIds={new Set()} onDecide={noop} onAdd={noop} onUse={() => {}}
    onExport={() => {}} exporting={false} onFollowUp={() => {}} onNew={() => {}} {...extra} />,
)
const withReport = { report, onExportReport: () => {} }
const at = (html: string, needle: string) => { const i = html.indexOf(needle); expect(i, `"${needle}" should be on the page`).toBeGreaterThan(-1); return i }

describe('1. order: status, then bottom line and findings, then a one-line sources summary, then the tabs', () => {
  const html = page(withReport)
  it('puts them in that order', () => {
    const status = at(html, 'aria-label="Status"')
    const bottom = at(html, 'Bottom line')
    const findings = at(html, 'Key findings')
    const summary = at(html, 'aria-label="Where the sources went"')
    const tabs = at(html, 'role="tablist"')
    expect(status).toBeLessThan(bottom)
    expect(bottom).toBeLessThan(findings)
    expect(findings).toBeLessThan(summary)
    expect(summary).toBeLessThan(tabs)
  })
  it('says the sources in one line, collapsed, and opens into the funnel', () => {
    expect(sourcesSummaryLine({ found: 150, used: 86 }, 12)).toBe('150 found · 86 accepted · 12 disagree')
    expect(sourcesSummaryLine({ found: 5, used: 2 }, 9)).toBe('5 found · 2 accepted · 2 disagree')    // a subset never exceeds its parent
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('of which disagree with you')
    expect(renderToStaticMarkup(<SourcesSummary counts={{ found: 150, used: 86 }} against={12} defaultOpen />)).toContain('of which disagree with you')
  })
  it('does not repeat the answer inside the Report tab', () => {
    expect(html.match(/Usability tracks satisfaction\./g)).toHaveLength(1)
    expect(html.match(/Key findings/g)).toHaveLength(1)
  })
})

describe('2. the question is clamped to two lines with "show more"', () => {
  const long = 'Does generative AI tool usage influence academic writing Self-Efficacy among postgraduate students at selected public universities in Gauteng'
  it('clamps a long question and offers the rest', () => {
    const html = renderToStaticMarkup(<ClampedTitle text={long} />)
    expect(html).toContain('line-clamp-2')
    expect(html).toContain('Show more')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain(long)                         // the full text is in the page, only visually clamped
  })
  it('leaves a short one alone', () => {
    const html = renderToStaticMarkup(<ClampedTitle text="Does sleep affect exam scores?" />)
    expect(html).not.toContain('line-clamp-2')
    expect(html).not.toContain('Show more')
  })
})

describe('3. tabs are sticky, Report is first and selected by default', () => {
  const html = page(withReport)
  it('is sticky below the header', () => {
    expect(html).toMatch(/role="tablist"[^>]*class="[^"]*\bsticky\b[^"]*\btop-0\b/)
  })
  it('lists the tabs in order with Report first and selected', () => {
    const labels = [...html.matchAll(/role="tab" id="tab-(\w+)"/g)].map(m => m[1])
    expect(labels).toEqual(['report', 'questions', 'against', 'left', 'log'])
    expect(html).toMatch(/id="tab-report"[^>]*aria-selected="true"/)
    expect(html).toMatch(/id="tab-questions"[^>]*aria-selected="false"/)
  })
  it('has one tab stop: only the selected tab is reachable with Tab', () => {
    expect(html).toMatch(/id="tab-report"[^>]*tabindex="0"/)
    expect(html).toMatch(/id="tab-questions"[^>]*tabindex="-1"/)
  })
  it('falls back to Questions when the report cannot be loaded', () => {
    expect(page({ ...withReport, report: null, reportFailed: true })).toMatch(/id="tab-questions"[^>]*aria-selected="true"/)
  })
})

describe('4. the source panel: empty until a source is clicked, a bottom sheet on narrow screens', () => {
  const html = page(withReport)
  it('shows an empty state and none of the per-source sections', () => {
    expect(html).toContain('Select a source to see its verification checks')
    expect(html).not.toContain('Why it is here')
    expect(html).not.toContain('Used for')
    expect(html).not.toContain('Supporting quote')
  })
  it('is hidden on narrow screens until a source is open, and is a labelled landmark', () => {
    expect(html).toMatch(/<aside id="selected-source-panel"[^>]*aria-label="Selected source"[^>]*class="[^"]*max-lg:hidden/)
  })
  it('shows "Why it is here" and "Used for" once a source is selected', () => {
    const [src] = mergeSourceRows([row({ id: 'z', quote: 'A passage.' })])
    const panel = renderToStaticMarkup(<SourceDetail source={src} questions={session.result!.questions} busy={false} added={false} onAdd={() => {}} onUse={() => {}} onExclude={() => {}} onRestore={() => {}} />)
    expect(panel).toContain('Why it is here')
    expect(panel).toContain('Used for')
  })
})

describe('5. the progress bar has a legend, focusable segments, and does not rely on colour', () => {
  const html = renderToStaticMarkup(<QuestionProgress segments={['done', 'partial', 'pending']} answered={1} onSelect={() => {}} />)
  it('has a legend with words', () => {
    expect(html).toContain('Answered')
    expect(html).toContain('Gap: some evidence')
    expect(html).toContain('Gap: not reached')
  })
  it('makes each segment a button that names its question and state', () => {
    expect(html.match(/<button/g)).toHaveLength(3)
    expect(html).toContain('aria-label="Question 1: answered. Go to this question."')
    expect(html).toContain('aria-label="Question 2: started, not enough evidence yet. Go to this question."')
    expect(html).toContain('aria-label="Question 3: not reached. Go to this question."')
  })
  it('shows a symbol and a number in each segment, not only a colour', () => {
    expect(html).toContain('✓')
    expect(html).toContain('◐')
    expect(html).toContain('○')
    expect(html).toContain('border-dashed')               // "not reached" also differs by outline
  })
})

describe('6. a source row has one evidence-strength indicator, details live in the panel', () => {
  const [src] = mergeSourceRows([row({ id: 'z', strength: 'Moderate', coverage: 'Abstract' })])
  const html = renderToStaticMarkup(<ul><SourceRow source={src} selected={false} onSelect={() => {}} /></ul>)
  it('shows the strength once, as steps plus words', () => {
    expect(html).toContain('Moderate evidence')
    expect(html.match(/h-2 w-3/g)).toHaveLength(4)
    expect(html.match(/bg-purple-accent/g)).toHaveLength(3)       // three of four steps filled
  })
  it('does not show the check and coverage badges in the row', () => {
    expect(html).not.toContain('DOI matched')
    expect(html).not.toContain('Abstract only')
  })
  it('maps every strength to a level and a word', () => {
    expect(['Strong', 'Moderate', 'Weak', 'Insufficient', 'Conflicting', ''].map(s => strengthLevel(s).level)).toEqual([4, 3, 2, 1, 2, 0])
    expect(renderToStaticMarkup(<StrengthMeter strength="Weak" />)).toContain('Limited evidence')
    expect(sourceStrength(src)).toBe('Moderate')
  })
})

describe('7. citations are numbered markers that open the panel, with a preview of title and quote', () => {
  it('renders numbered markers that name their source', () => {
    const html = renderToStaticMarkup(<DeepResearchReportView report={report} part="answer" onOpenSource={() => {}} selectedId={null} onExport={() => {}} exporting={false} onAsk={() => {}} />)
    expect(html).toContain('aria-label="Source 1: Shared source. Open its checks and supporting quote"')
    expect(html).toContain('[1]')
  })
  it('previews the title and the supporting quote, and says so when there is no quote', () => {
    const withQuote = renderToStaticMarkup(<CitationPreview id="t" title="Shared source" quote="Usability is the ease of use of a system." />)
    expect(withQuote).toContain('role="tooltip"')
    expect(withQuote).toContain('Shared source')
    expect(withQuote).toContain('Usability is the ease of use of a system.')
    expect(renderToStaticMarkup(<CitationPreview id="t" title="X" quote={null} />)).toContain('No supporting sentence was kept')
  })
  it('takes the preview quote from the source on file', () => {
    expect(previewQuote(mergeSourceRows(rows)[0])).toBe('Usability is the ease of use of a system.')
    expect(previewQuote(undefined)).toBeNull()
  })
})

describe('8. a disagreeing source looks the same everywhere: icon plus the word "Disagrees"', () => {
  it('is one component with an icon and a label', () => {
    const html = renderToStaticMarkup(<DisagreesBadge />)
    expect(html).toContain('Disagrees')
    expect(html).toContain('<svg')
    expect(renderToStaticMarkup(<DisagreesBadge kind="Null" />)).toContain('No effect found')
  })
  it('appears in the report’s conflicting evidence and on the Evidence against rows', () => {
    const rest = renderToStaticMarkup(<DeepResearchReportView report={report} part="rest" onOpenSource={() => {}} selectedId={null} onExport={() => {}} exporting={false} onAsk={() => {}} />)
    expect(rest).toContain('Conflicting evidence')
    expect(rest).toContain('Disagrees')
    const [bad] = mergeSourceRows([row({ id: 'c', polarity: 'Contradicts' })])
    expect(renderToStaticMarkup(<ul><SourceRow source={bad} selected={false} onSelect={() => {}} /></ul>)).toContain('Disagrees')
    const [good] = mergeSourceRows([row({ id: 'g' })])
    expect(renderToStaticMarkup(<ul><SourceRow source={good} selected={false} onSelect={() => {}} /></ul>)).not.toContain('Disagrees')
  })
})

describe('9. text meets WCAG AA contrast', () => {
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }
  it.each([
    ['meta text: slate-600 on white', '#475569', '#ffffff'],
    ['secondary text: slate-700 on slate-100', '#334155', '#f1f5f9'],
    ['icons/placeholder text: slate-500 on white', '#64748b', '#ffffff'],
    ['link: purple-deep on white', '#4c1d95', '#ffffff'],
    ['tag: purple-deep on purple-tint', '#4c1d95', '#ede9fe'],
    ['primary button: white on purple', '#ffffff', '#7c3aed'],
    ['caution tag: amber-800 on amber-50', '#92400e', '#fffbeb'],
    ['disagrees: orange-900 on orange-50', '#7c2d12', '#fff7ed'],
    ['strength chip: emerald-800 on emerald-50', '#065f46', '#ecfdf5'],
  ])('%s is at least 4.5:1', (_name, fg, bg) => expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5))

  it('uses no caption text below 12px and none of the low-contrast greys on the results page', () => {
    const html = page(withReport)
    expect(html).not.toContain('text-[11px]')
    expect(html).not.toContain('text-slate-400')
  })
})

describe('10. the primary action researches the remaining questions; Edit and New are real buttons', () => {
  const stopped: DeepResearchSession = { ...session, status: 'Stopped', completionNote: 'The research reached its limit.' }
  const quote = { canContinue: true, reason: null, answeredQuestions: 1, unansweredQuestions: 2, freshCredits: 14, followUpCredits: 7, depth: 'standard' }
  const html = page({ ...withReport, followUpQuote: quote, onContinue: () => {} }, stopped)
  const filled = /bg-purple-accent hover:bg-purple-deep text-white text-\[13px\] font-semibold shadow/g

  it('leads with "Research the remaining N questions · X credits" and only that is filled', () => {
    expect(html).toContain('Research the remaining 2 questions · 7 credits')
    expect(html.match(filled)).toHaveLength(1)
    expect(html).toMatch(/shadow-purple-400\/20[^>]*>\s*Research the remaining/)
  })
  it('makes Edit question and New research secondary buttons, not links', () => {
    expect(html).toMatch(/<button[^>]*border border-slate-300[^>]*>Edit question<\/button>/)
    expect(html).toMatch(/<button[^>]*border border-slate-300[^>]*>Blank new research<\/button>/)
  })
  it('states what it keeps and what it holds', () => {
    expect(html).toContain('instead of the 14 a fresh run holds')
  })
  it('falls back to the Word export as the filled button when nothing can be continued', () => {
    const done = page(withReport)
    expect(done.match(filled)).toHaveLength(1)
    expect(done).toMatch(/shadow-purple-400\/20[^>]*>\s*Export report \(Word\)/)
  })
})

describe('11. keyboard and screen-reader support', () => {
  const html = page(withReport)
  it('tabs: tablist, selected state, controls and one tab stop', () => {
    expect(html).toContain('role="tablist"')
    expect(html).toMatch(/id="tab-report"[^>]*aria-controls="panel-report"/)
    expect(html).toContain('role="tabpanel" id="panel-report"')
  })
  it('segments: buttons named by question and state, grouped and labelled', () => {
    expect(html).toContain('role="group" aria-label="0 of 3 questions answered. Choose a question to go to it."')
  })
  it('markers are buttons with a name and a pressed state; the preview is a described tooltip', () => {
    expect(html).toMatch(/<button[^>]*aria-pressed="false"[^>]*aria-label="Source 1:/)
    expect(renderToStaticMarkup(<CitationPreview id="t" title="T" quote={null} />)).toContain('role="tooltip"')
  })
  it('panel: a labelled landmark that can take focus, with a Close control and a status region for decisions', () => {
    expect(html).toContain('aria-label="Selected source"')
    expect(html).toContain('tabindex="-1"')
    expect(html).toContain('role="status" aria-live="polite"')
  })
  it('the summary toggle and the title clamp report their expanded state', () => {
    expect(html.match(/aria-expanded="false"/g)!.length).toBeGreaterThanOrEqual(1)
    expect(html).toContain('aria-controls=')
  })
})
