import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { DeepResearchReport, DeepResearchSession, EvidenceSource } from '../../api/deepResearch'
import { DeepResearchResults, SourceDetail, SourceRow } from './DeepResearchResults'
import { DeepResearchReportView } from './DeepResearchReportView'
import { CitationPreview, ClampedTitle, CountsLine, DisagreesBadge, ProgressSteps, StrengthMeter } from './deepResearchParts'
import {
  currentSection, dedupeByDoi, filterSources, findGroup, mergeSourceRows, outlineItems, previewQuote, savableSources, sourceStrength, strengthLevel,
} from '../../lib/deepResearchView'

const row = (over: Partial<EvidenceSource>): EvidenceSource => ({
  id: 's', questionId: 'q1', title: 'A paper', authors: ['A'], year: 2024, journal: 'J', doi: `10.1/${over.id ?? 's'}`,
  polarity: 'Supports', strength: 'Moderate', geography: 'Unknown', decision: 'Accepted', decidedBy: 'Humaniser',
  exclusionReason: null, quote: null, verification: 'Verified', foundVia: [], ...over,
})

const session: DeepResearchSession = {
  id: 'sess', projectId: 'p', researchQuestion: 'Does LMS usability influence satisfaction', mode: 'EvidenceForClaim', status: 'Completed',
  isFinished: true, completionNote: 'Done.', createdAt: '', updatedAt: '',
  progress: { phase: 'Complete', message: '', evidenceQuestions: 3, questionsAnswered: 1, sourcesDiscovered: 3, sourcesRelevant: 1, sourcesVerified: 3, searchesRun: 2 },
  result: {
    evidenceStrength: 'Moderate', keyFindings: [], gapCandidates: [], limitations: [], evidenceGaps: [], providerCoverage: [], acceptedSources: 2, contradictorySources: 1,
    verdict: 'Partial', verdictLabel: 'Partly answered',
    counts: { found: 3, relevant: 2, accepted: 2, cited: 2, supports: 1, contradicts: 1, noEffect: 0, background: 0, offTopic: 0, leftOut: 1, relevanceUnknown: 0 },
    questions: [
      { id: 'q1', type: 'Definition', question: 'How is usability defined?', status: 'Resolved', sufficiency: 'Sufficient', reasons: [], verdict: 'Answered', verdictLabel: 'Answered', shortTitle: 'Definition', acceptedSources: 2 },
      { id: 'q2', type: 'Gap', question: 'Is there South African evidence?', status: 'Researching', sufficiency: 'Insufficient', reasons: [], verdict: 'NoEvidence', verdictLabel: 'No relevant sources', shortTitle: 'Gaps' },
      { id: 'q3', type: 'Context', question: 'What platforms are common?', status: 'Open', sufficiency: 'Insufficient', reasons: [], verdict: 'NotResearched', verdictLabel: 'Not researched', shortTitle: 'Context' },
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
const page = (extra: Partial<React.ComponentProps<typeof DeepResearchResults>> = {}, s: DeepResearchSession = session, r: EvidenceSource[] = rows) => renderToStaticMarkup(
  <DeepResearchResults session={s} rows={r} busyId={null} addedIds={new Set()} onDecide={noop} onAdd={noop} onUse={() => {}}
    onExport={() => {}} exporting={false} onFollowUp={() => {}} onNew={() => {}} {...extra} />,
)
const withReport = { report, onExportReport: () => {} }
const at = (html: string, needle: string) => { const i = html.indexOf(needle); expect(i, `"${needle}" should be on the page`).toBeGreaterThan(-1); return i }
const primaryButtons = (html: string) => [...html.matchAll(/<button[^>]*data-primary="true"[^>]*>(.*?)<\/button>/gs)].map(m => m[1].replace(/<[^>]+>/g, '').trim())

describe('layout: the report is the centre column, the panel is on the right', () => {
  const html = page(withReport)
  it('orders the page: header, verdict, findings, progress steps, evidence by question, action bar, follow-up', () => {
    const header = at(html, 'Your question')
    const verdict = at(html, 'id="verdict-heading"')
    const steps = at(html, '<ol aria-label="Questions"')
    const byQuestion = at(html, 'id="questions-heading"')
    const findings = at(html, 'Key findings')
    const bar = at(html, 'aria-label="Next steps"')
    const followUp = at(html, 'id="report-followup"')
    expect(header).toBeLessThan(verdict)
    expect(verdict).toBeLessThan(findings)
    expect(findings).toBeLessThan(steps)
    expect(steps).toBeLessThan(byQuestion)
    expect(byQuestion).toBeLessThan(bar)
    expect(bar).toBeLessThan(followUp)
  })
  it('puts the panel after the centre column, and makes the action bar sticky', () => {
    expect(at(html, 'aria-label="Next steps"')).toBeLessThan(at(html, 'aria-label="Research panel"'))
    expect(html).toMatch(/data-testid="action-bar"[^>]*class="[^"]*sticky bottom-0/)
  })
  it('shows the verdict and the caveats together, and the server\u2019s counts in one line', () => {
    expect(html).toContain('>Partly answered</h3>')
    expect(html).toContain('Evidence strength: Moderate evidence')
    const line = renderToStaticMarkup(<CountsLine counts={session.result!.counts!} />)
    expect(line).toContain('3 found · 2 accepted · 2 cited · 1 contradict · 1 left out')
    expect(html).toContain('3 found · 2 accepted')
  })
  it('shows each sentence of the report once', () => {
    expect(html.match(/Usability tracks satisfaction\./g)).toHaveLength(1)
    expect(html.match(/Key findings/g)).toHaveLength(1)
  })
  it('lists the references once under the report, and keeps the follow-up box below them', () => {
    expect(html.match(/id="report-refs"/g)).toHaveLength(1)
    expect(at(html, 'aria-label="Next steps"')).toBeLessThan(at(html, 'id="report-refs"'))
    expect(at(html, 'id="report-refs"')).toBeLessThan(at(html, 'id="report-followup"'))
  })
})

describe('the question is shown in full, and only an extreme one is clamped with "show more"', () => {
  const medium = 'Does generative AI tool usage influence academic writing Self-Efficacy among postgraduate students at selected public universities in Gauteng'
  const long = `${medium}, and does that influence differ between full-time and part-time students, between disciplines, and across the first and final years of study?`
  it('shows a normal-length question in full', () => {
    const html = renderToStaticMarkup(<ClampedTitle text={medium} />)
    expect(html).not.toContain('line-clamp-2')
    expect(html).toContain(medium)
  })
  it('clamps an extreme question and offers the rest', () => {
    const html = renderToStaticMarkup(<ClampedTitle text={long} />)
    expect(html).toContain('line-clamp-2')
    expect(html).toContain('Show more')
    expect(html).toContain(long)
  })
  it('leaves a short one alone', () => {
    const html = renderToStaticMarkup(<ClampedTitle text="Does sleep affect exam scores?" />)
    expect(html).not.toContain('line-clamp-2')
    expect(html).not.toContain('Show more')
  })
})

describe('the panel has Sources / Outline / Activity; Questions are in the main column', () => {
  const html = page(withReport)
  it('lists three tabs in order, Sources selected, with one tab stop; there is no "Evidence against" tab', () => {
    const tabs = [...html.matchAll(/role="tab" id="ptab-(\w+)"/g)].map(m => m[1])
    expect(tabs).toEqual(['sources', 'outline', 'activity'])
    expect(html).toMatch(/id="ptab-sources"[^>]*aria-selected="true"/)
    expect(html).toMatch(/id="ptab-sources"[^>]*tabindex="0"/)
    expect(html).toMatch(/id="ptab-outline"[^>]*tabindex="-1"/)
    expect(html).not.toContain('Evidence against')
  })
  it('shows a collapsible card for each question with evidence, and one block for the rest', () => {
    expect(html).toContain('Evidence by question')
    expect(html.match(/<details/g)).toHaveLength(1)                                   // only Definition has accepted evidence
    expect(html).toMatch(/<details[^>]*id="question-q1"[^>]*open/)
    expect(html).toContain('2 questions not researched')
    expect(html.match(/No source has been accepted for this question/g)).toBeNull()  // no empty state per card
    expect(html).toContain('No relevant sources')
    expect(html).toContain('Not researched')
  })
  it('Left out is a filter inside Sources and still lists what was left out, with the reason', () => {
    const l = page({ ...withReport, initialSourceFilter: 'left' })
    expect(l).toMatch(/Left out <span class="tabular-nums">1</)
    expect(l).toContain('Off topic paper')
    expect(l).toContain('Left out: off topic')
  })
  it('Contradicts is a filter inside Sources and lists the contradicting sources', () => {
    const a = page({ ...withReport, initialSourceFilter: 'contradicts' })
    expect(a).toContain('Disagreeing paper')
    expect(a).toContain('Contradicts')
  })
  it('Activity is the search log', () => {
    expect(page({ ...withReport, initialPanelView: 'activity' })).toContain('id="ppanel-activity"')
  })
})

describe('Sources tab: filter chips, de-duplication, what each card shows', () => {
  const html = page(withReport)
  it('has Cited / Contradicts / No effect / Off-topic / Left out / All chips with the server\u2019s counts, Cited selected when something is cited', () => {
    const chip = (label: string, n: number) => new RegExp(`>${label} <span class="tabular-nums">${n}<`)
    expect(html).toMatch(/aria-pressed="true"[^>]*>Cited <span class="tabular-nums">2</)
    expect(html).toMatch(chip('Contradicts', 1))
    expect(html).toMatch(chip('No effect', 0))
    expect(html).toMatch(chip('Off-topic', 0))
    expect(html).toMatch(chip('Left out', 1))
    expect(html).toMatch(chip('All', 3))
  })
  it('lists only the cited sources under Cited, and numbers them as the report does', () => {
    expect(html).toContain('[1]')
    expect(html).toContain('Shared source')
    expect(html).not.toContain('Off topic paper')
  })
  it('starts on All when nothing is cited', () => {
    expect(page({}, { ...session, result: { ...session.result!, keyFindings: [] } })).toMatch(/aria-pressed="true"[^>]*>All <span class="tabular-nums">3</)
  })
  it('filters by chip', () => {
    const groups = dedupeByDoi(mergeSourceRows(rows))
    const cited = new Set(['a', 'c'])
    expect(filterSources(groups, 'cited', cited).map(g => g.id)).toEqual(['a', 'c'])
    expect(filterSources(groups, 'all', cited)).toHaveLength(3)
    expect(filterSources(groups, 'contradicts', cited).map(g => g.id)).toEqual(['c'])
    expect(filterSources(groups, 'noEffect', cited)).toEqual([])
    expect(filterSources(groups, 'left', cited).map(g => g.id)).toEqual(['b'])
  })
  it('de-duplicates by DOI, keeping every link and every id, and prefers a verified, accepted copy', () => {
    const dup = mergeSourceRows([
      row({ id: 'x1', doi: '10.1109/ICITISEE.2025.1', title: 'Heuristics Evaluation of Moodle', questionId: 'q1', decision: 'Rejected', verification: 'Unverifiable' }),
      row({ id: 'x2', doi: 'https://doi.org/10.1109/icitisee.2025.1', title: 'Heuristics Evaluation of Moodle', questionId: 'q2' }),
      row({ id: 'x3', doi: null, title: 'No doi paper', year: 2020 }),
      row({ id: 'x4', doi: null, title: 'No DOI  paper!', year: 2020 }),
    ])
    const out = dedupeByDoi(dup)
    expect(out).toHaveLength(2)
    const moodle = out.find(g => g.title.startsWith('Heuristics'))!
    expect(moodle.links).toHaveLength(2)
    expect(moodle.bucket).toBe('used')
    expect(moodle.verification).toBe('Verified')
    expect(moodle.aliases).toEqual(['x2'])
    expect(findGroup(out, 'x2')?.id).toBe('x1')
    expect(out.find(g => g.title.startsWith('No'))?.aliases).toHaveLength(1)
  })
  it('counts the merged paper once on the page', () => {
    const twice = [...rows, row({ id: 'a2', doi: '10.1/a', title: 'Shared source', questionId: 'q2' })]
    expect(page(withReport, session, twice)).toMatch(/>All <span class="tabular-nums">3</)
    expect(page(withReport, session, twice)).toContain('3 found')
  })
  it('a card says supports or disagrees, the study type, the sample when stated, and the region match', () => {
    const [src] = mergeSourceRows([row({ id: 'z', coverage: 'FullText', studyDesign: 'CrossSectional', geography: 'Target', quote: 'Among 412 students at three universities, usability predicted satisfaction.' })])
    const r = renderToStaticMarkup(<ul><SourceRow source={src} selected={false} onSelect={() => {}} cite={3} /></ul>)
    expect(r).toContain('Supports')
    expect(r).toContain('cross-sectional study')
    expect(r).toContain('n = 412')
    expect(r).toContain('In your region')
    expect(r).toContain('[3]')
    expect(r).not.toContain('Moderate evidence')                   // the uniform strength dots are gone from the row
    expect(r).not.toContain('h-2 w-3')
    expect(r).not.toContain('DOI matched')
  })
  it('leaves out an unknown design, region or sample, and shows one stance badge', () => {
    const [plain] = mergeSourceRows([row({ id: 'p', geography: 'Unknown', quote: 'Usability matters.' })])
    const r = renderToStaticMarkup(<ul><SourceRow source={plain} selected={false} onSelect={() => {}} /></ul>)
    expect(r).not.toContain('Design not seen')
    expect(r).not.toContain('Region not stated')
    expect(r).not.toContain('n =')
    const [bad] = mergeSourceRows([row({ id: 'd', polarity: 'Contradicts', geography: 'International' })])
    const d = renderToStaticMarkup(<ul><SourceRow source={bad} selected={false} onSelect={() => {}} /></ul>)
    expect(d).toContain('Contradicts')
    const [off] = mergeSourceRows([row({ id: 'o', decision: 'Rejected', stance: 'OffTopic', relevance: 'OffTopic' })])
    expect(renderToStaticMarkup(<ul><SourceRow source={off} selected={false} onSelect={() => {}} /></ul>)).toContain('Off-topic')
    expect(d).toContain('Elsewhere')
    expect(['Strong', 'Moderate', 'Weak', 'Insufficient', 'Conflicting', ''].map(x => strengthLevel(x).level)).toEqual([4, 3, 2, 1, 2, 0])
    expect(renderToStaticMarkup(<StrengthMeter strength="Weak" />)).toContain('Limited evidence')
    expect(sourceStrength(plain)).toBe('Moderate')
  })
})

describe('the verification card (opened from a row or a citation marker)', () => {
  const [src] = mergeSourceRows([row({ id: 'z', quote: 'A passage.', doi: '10.1/z' })])
  const card = renderToStaticMarkup(<SourceDetail source={src} questions={session.result!.questions} busy={false} added={false} onAdd={() => {}} onUse={() => {}} onExclude={() => {}} onRestore={() => {}} />)
  it('shows the DOI, the record checks (metadata, retraction), the quote and where it is used', () => {
    expect(card).toContain('DOI resolves')
    expect(card).toContain('Metadata matches')
    expect(card).toContain('Not retracted')
    expect(card).toContain('A passage.')
    expect(card).toContain('https://doi.org/10.1/z')
    expect(card).toContain('Why it is here')
    expect(card).toContain('Used for')
  })
  it('is not on the page until something is opened, and the list has no per-source sections', () => {
    const html = page(withReport)
    expect(html).not.toContain('Why it is here')
    expect(html).not.toContain('Supporting quote')
    expect(html).not.toContain('Back to')
  })
  it('opens from a citation marker: the marker is a named button with a pressed state', () => {
    const doc = renderToStaticMarkup(<DeepResearchReportView report={report} part="document" onOpenSource={() => {}} selectedId={null} onExport={() => {}} exporting={false} onAsk={() => {}} />)
    expect(doc).toMatch(/<button[^>]*aria-pressed="false"[^>]*aria-label="Source 1: Shared source\. Open its checks and supporting quote"/)
  })
})

describe('Outline tab: the report headings as a jump list', () => {
  it('lists the headings in reading order, matching the ids the report renders', () => {
    const items = outlineItems(report)
    expect(items.map(i => i.label)).toEqual(['Bottom line', 'Key findings', 'How is usability defined?', 'Contradicting evidence', 'Gaps'])
    const doc = renderToStaticMarkup(<DeepResearchReportView report={report} part="document" onOpenSource={() => {}} selectedId={null} onExport={() => {}} exporting={false} onAsk={() => {}} />)
    for (const i of items) expect(doc, i.id).toContain(`id="${i.id}"`)
  })
  it('renders as a navigation list with the section buttons', () => {
    const html = page({ ...withReport, initialPanelView: 'outline' })
    expect(html).toContain('aria-label="Report outline"')
    for (const l of ['Bottom line', 'Key findings', 'Contradicting evidence', 'Gaps']) expect(html).toContain(`>${l}</button>`)
  })
  it('highlights the section the reader is in: the last heading that has reached the reading line', () => {
    const tops = [{ id: 'a', top: -300 }, { id: 'b', top: 40 }, { id: 'c', top: 600 }]
    expect(currentSection(tops, 140)).toBe('b')
    expect(currentSection([{ id: 'a', top: 400 }, { id: 'b', top: 900 }], 140)).toBe('a')   // above the first heading: the first
    expect(currentSection([], 140)).toBeNull()
  })
})

describe('next steps under the report', () => {
  const stopped: DeepResearchSession = { ...session, status: 'Stopped', completionNote: 'The research reached its limit.' }
  const quote = { canContinue: true, reason: null, answeredQuestions: 1, unansweredQuestions: 2, freshCredits: 14, followUpCredits: 7, depth: 'standard' }
  const html = page({ ...withReport, followUpQuote: quote, onContinue: () => {} }, stopped)

  it('offers the four actions: research the rest, find gaps, export, save sources, with the cost in plain words', () => {
    expect(html).toContain('Research remaining 2 questions')
    expect(html).toContain('Uses 7 credits; unused credits are returned.')
    expect(html).toContain('Find gaps (2)')
    expect(html).toContain('Export report')
    expect(html).toMatch(/Save sources \(\d+\)/)
  })
  it('makes only "Research remaining" the filled chip when it is available', () => {
    expect(primaryButtons(html)).toEqual(['Research remaining 2 questions'])
  })
  it('makes the export the filled chip when nothing can be continued', () => {
    expect(primaryButtons(page(withReport))).toEqual(['Export report'])
  })
  it('counts the sources it would save: accepted, verified, not yet saved; and says when all are saved', () => {
    const groups = dedupeByDoi(mergeSourceRows(rows))
    expect(savableSources(groups, new Set()).map(g => g.id)).toEqual(['a', 'c'])
    expect(savableSources(groups, new Set(['a'])).map(g => g.id)).toEqual(['c'])
    const unverified = dedupeByDoi(mergeSourceRows([row({ id: 'u', verification: 'Unverifiable' })]))
    expect(savableSources(unverified, new Set())).toEqual([])
    expect(renderToStaticMarkup(<DeepResearchResults session={session} rows={rows} busyId={null} addedIds={new Set(['a', 'c'])} onDecide={noop} onAdd={noop} onUse={() => {}}
      onExport={() => {}} exporting={false} onFollowUp={() => {}} onNew={() => {}} {...withReport} />)).toContain('Sources saved')
  })
  it('disables Find gaps when every question is answered and the report lists no gaps', () => {
    const answered = { ...session, result: { ...session.result!, questions: session.result!.questions.map(q => ({ ...q, verdict: 'Answered' as const })) } }
    const none = page({ ...withReport, report: { ...report, gaps: [] } }, answered)
    expect(none).toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>).)*Find gaps/s)
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>).)*Find gaps/s)
  })
  it('keeps Edit question and New research as real, secondary buttons', () => {
    expect(html).toMatch(/<button[^>]*border border-slate-300[^>]*>Edit question<\/button>/)
    expect(html).toMatch(/<button[^>]*border border-slate-300[^>]*>New research<\/button>/)
  })
})

describe('narrow screens: the panel is a bottom sheet', () => {
  const html = page(withReport)
  it('is hidden below lg until opened, and opened from a floating Sources button', () => {
    expect(html).toMatch(/<aside id="selected-source-panel"[^>]*class="[^"]*max-lg:hidden/)
    expect(html).toMatch(/<button[^>]*class="[^"]*fixed bottom-20 right-4[^"]*lg:hidden[^>]*>Sources \(3\)/)
  })
  it('is a side panel from lg up, sticky beside the report', () => {
    expect(html).toMatch(/<aside[^>]*class="[^"]*lg:sticky/)
    expect(html).toContain('lg:grid-cols-[minmax(0,1fr)_380px]')
  })
})

describe('progress, citations and conflicts', () => {
  const progress = renderToStaticMarkup(<ProgressSteps onSelect={() => {}} steps={[
    { title: 'Definition', state: 'done', verdict: 'Answered' }, { title: 'Mechanisms', state: 'partial', verdict: 'Partly answered' },
    { title: 'Effect', state: 'pending', verdict: 'Not researched' }, { title: 'South Africa', state: 'failed', verdict: 'Results off-topic' }]} />)
  it('progress steps are named by question, not numbered, with symbols, and there is no legend that looks clickable', () => {
    for (const t of ['Definition', 'Mechanisms', 'Effect', 'South Africa']) expect(progress).toContain(`>${t}</span>`)
    expect(progress.match(/<button/g)).toHaveLength(4)
    expect(progress).toContain('aria-label="Mechanisms: Partly answered. Go to this question."')
    expect(progress).toContain('✓'); expect(progress).toContain('◐'); expect(progress).toContain('○'); expect(progress).toContain('!')
    expect(progress).not.toContain('Legend')
    expect(page(withReport)).not.toContain('aria-label="Legend"')
  })
  it('a citation preview shows the title and the quote, or says there is none', () => {
    const p = renderToStaticMarkup(<CitationPreview id="t" title="Shared source" quote="Usability is the ease of use of a system." />)
    expect(p).toContain('role="tooltip"'); expect(p).toContain('Shared source'); expect(p).toContain('Usability is the ease')
    expect(renderToStaticMarkup(<CitationPreview id="t" title="X" quote={null} />)).toContain('No supporting sentence was kept')
    expect(previewQuote(mergeSourceRows(rows)[0])).toBe('Usability is the ease of use of a system.')
  })
  it('"Contradicts" and "No effect found" are different badges: a null result is not shown as a contradiction', () => {
    expect(renderToStaticMarkup(<DisagreesBadge />)).toMatch(/<svg.*Contradicts/s)
    expect(renderToStaticMarkup(<DisagreesBadge kind="Null" />)).toContain('No effect found')
    expect(renderToStaticMarkup(<DisagreesBadge kind="Null" />)).not.toContain('orange')
    expect(page(withReport)).toContain('Contradicts')
  })
})

describe('text meets WCAG AA contrast', () => {
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }
  it.each([
    ['slate-600 on white', '#475569', '#ffffff'], ['slate-700 on slate-100', '#334155', '#f1f5f9'], ['purple-deep on purple-tint', '#4c1d95', '#ede9fe'],
    ['white on purple', '#ffffff', '#7c3aed'], ['amber-800 on amber-50', '#92400e', '#fffbeb'], ['orange-900 on orange-50', '#7c2d12', '#fff7ed'],
  ])('%s is at least 4.5:1', (_n, fg, bg) => expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5))
  it('uses no caption text below 12px and no slate-400 text', () => {
    const html = page(withReport)
    expect(html).not.toContain('text-[11px]')
    expect(html).not.toContain('text-slate-400')
  })
})

describe('keyboard and screen-reader support', () => {
  const html = page(withReport)
  it('panel tabs: tablist, controls, roving tab stop', () => {
    expect(html).toContain('role="tablist" aria-label="Research panel"')
    expect(html).toMatch(/id="ptab-sources"[^>]*aria-controls="ppanel-sources"/)
    expect(html).toContain('role="tabpanel" id="ppanel-sources"')
  })
  it('filter chips expose their pressed state', () => {
    expect(html).toContain('role="group" aria-label="Filter sources"')
    expect(html.match(/aria-pressed="(true|false)"/g)!.length).toBeGreaterThan(5)
  })
  it('the panel is a labelled landmark that can take focus; decisions are announced', () => {
    expect(html).toContain('aria-label="Research panel"')
    expect(html).toMatch(/<aside[^>]*tabindex="-1"/)
    expect(html).toContain('role="status" aria-live="polite"')
  })
  it('the outline marks the current section with aria-current', () => {
    // no section is current in a static render, so none is marked; the attribute is only ever on the current one
    expect(page({ ...withReport, initialPanelView: 'outline' })).not.toContain('aria-current="location"')
  })
})
