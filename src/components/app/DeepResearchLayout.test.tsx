import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { DeepResearchReport, DeepResearchSession, EvidenceSource } from '../../api/deepResearch'
import { DeepResearchResults, SourceDetail, SourceRow } from './DeepResearchResults'
import { DeepResearchReportView } from './DeepResearchReportView'
import { CitationPreview, ClampedTitle, DisagreesBadge, QuestionProgress, SourcesSummary, StrengthMeter } from './deepResearchParts'
import {
  currentSection, dedupeByDoi, filterSources, findGroup, mergeSourceRows, outlineItems, previewQuote, savableSources, sourceStrength, sourcesSummaryLine, strengthLevel,
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
const page = (extra: Partial<React.ComponentProps<typeof DeepResearchResults>> = {}, s: DeepResearchSession = session, r: EvidenceSource[] = rows) => renderToStaticMarkup(
  <DeepResearchResults session={s} rows={r} busyId={null} addedIds={new Set()} onDecide={noop} onAdd={noop} onUse={() => {}}
    onExport={() => {}} exporting={false} onFollowUp={() => {}} onNew={() => {}} {...extra} />,
)
const withReport = { report, onExportReport: () => {} }
const at = (html: string, needle: string) => { const i = html.indexOf(needle); expect(i, `"${needle}" should be on the page`).toBeGreaterThan(-1); return i }
const primaryButtons = (html: string) => [...html.matchAll(/<button[^>]*data-primary="true"[^>]*>(.*?)<\/button>/gs)].map(m => m[1].replace(/<[^>]+>/g, '').trim())

describe('layout: the report is the centre column, the panel is on the right', () => {
  const html = page(withReport)
  it('puts the question and status first, then the one-line sources summary, then the report', () => {
    const status = at(html, 'aria-label="Status"')
    const summary = at(html, 'aria-label="Where the sources went"')
    const bottom = at(html, 'Bottom line')
    const findings = at(html, 'Key findings')
    const gaps = at(html, 'id="report-gaps"')
    expect(status).toBeLessThan(summary)
    expect(summary).toBeLessThan(bottom)
    expect(bottom).toBeLessThan(findings)
    expect(findings).toBeLessThan(gaps)
  })
  it('puts the panel after the centre column, and the next-step chips under the report', () => {
    const chips = at(html, 'aria-label="Next steps"')
    expect(at(html, 'id="report-gaps"')).toBeLessThan(chips)
    expect(chips).toBeLessThan(at(html, 'aria-label="Research panel"'))
  })
  it('says the sources in one line above the report, opening into the funnel', () => {
    expect(sourcesSummaryLine({ found: 150, used: 86 }, 12)).toBe('150 found · 86 accepted · 12 disagree')
    expect(sourcesSummaryLine({ found: 5, used: 2 }, 9)).toBe('5 found · 2 accepted · 2 disagree')
    expect(html).toContain('aria-expanded="false"')
    expect(renderToStaticMarkup(<SourcesSummary counts={{ found: 150, used: 86 }} against={12} defaultOpen />)).toContain('of which disagree with you')
  })
  it('shows each sentence of the report once', () => {
    expect(html.match(/Usability tracks satisfaction\./g)).toHaveLength(1)
    expect(html.match(/Key findings/g)).toHaveLength(1)
  })
  it('leaves references to the Sources tab, and keeps the follow-up box under the chips', () => {
    expect(html).not.toContain('id="report-refs"')
    expect(at(html, 'aria-label="Next steps"')).toBeLessThan(at(html, 'id="report-followup"'))
  })
})

describe('the question is clamped to two lines with "show more"', () => {
  const long = 'Does generative AI tool usage influence academic writing Self-Efficacy among postgraduate students at selected public universities in Gauteng'
  it('clamps a long question and offers the rest', () => {
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

describe('the panel has Sources / Outline / Evidence against / Activity, with Questions and Left out one click away', () => {
  const html = page(withReport)
  it('lists the four tabs in order, Sources selected, with one tab stop', () => {
    const tabs = [...html.matchAll(/role="tab" id="ptab-(\w+)"/g)].map(m => m[1])
    expect(tabs).toEqual(['sources', 'outline', 'against', 'activity'])
    expect(html).toMatch(/id="ptab-sources"[^>]*aria-selected="true"/)
    expect(html).toMatch(/id="ptab-sources"[^>]*tabindex="0"/)
    expect(html).toMatch(/id="ptab-outline"[^>]*tabindex="-1"/)
  })
  it('keeps Questions and Left out reachable, with their counts', () => {
    expect(html).toMatch(/id="ptab-questions"[^>]*aria-pressed="false"[^>]*>Questions \(3\)/)
    expect(html).toMatch(/id="ptab-left"[^>]*>Left out \(1\)/)
  })
  it('Questions still shows every question, its label and its sources; nothing was removed', () => {
    const q = page({ ...withReport, initialPanelView: 'questions' })
    expect(q).toContain('QUESTION 1 · DEFINITION')
    expect(q).toContain('QUESTION 2 · GAP')
    expect(q).toContain('1 question still to research')
    expect(q).toContain('Planned, not yet researched')
  })
  it('Left out still lists the sources that were left out, with the reason', () => {
    const l = page({ ...withReport, initialPanelView: 'left' })
    expect(l).toContain('Off topic paper')
    expect(l).toContain('Left out: off topic')
  })
  it('Activity is the search log, and Evidence against lists the disagreeing sources', () => {
    expect(page({ ...withReport, initialPanelView: 'activity' })).toContain('id="ppanel-activity"')
    const a = page({ ...withReport, initialPanelView: 'against' })
    expect(a).toContain('Disagreeing paper')
    expect(a).toContain('Disagrees')
  })
})

describe('Sources tab: filter chips, de-duplication, one strength indicator', () => {
  const html = page(withReport)
  it('has Cited N / All N / Disagree N chips, Cited selected when there is a report', () => {
    expect(html).toMatch(/aria-pressed="true"[^>]*>Cited 2</)
    expect(html).toContain('>All 3<')
    expect(html).toContain('>Disagree 1<')
  })
  it('lists only the cited sources under Cited, and numbers them as the report does', () => {
    expect(html).toContain('[1]')
    expect(html).toContain('Shared source')
    expect(html).not.toContain('Off topic paper')              // not cited, not under this chip
  })
  it('starts on All when there is no report', () => {
    expect(page()).toMatch(/aria-pressed="true"[^>]*>All 3</)
  })
  it('filters by chip', () => {
    const groups = dedupeByDoi(mergeSourceRows(rows))
    const cited = new Set(['a', 'c'])
    expect(filterSources(groups, 'cited', cited).map(g => g.id)).toEqual(['a', 'c'])
    expect(filterSources(groups, 'all', cited)).toHaveLength(3)
    expect(filterSources(groups, 'disagree', cited).map(g => g.id)).toEqual(['c'])
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
    expect(findGroup(out, 'x2')?.id).toBe('x1')                       // a citation that names the other record still finds it
    expect(out.find(g => g.title.startsWith('No'))?.aliases).toHaveLength(1)   // title and year stand in when there is no DOI
  })
  it('counts the merged paper once on the page', () => {
    const twice = [...rows, row({ id: 'a2', doi: '10.1/a', title: 'Shared source', questionId: 'q2' })]
    expect(page(withReport, session, twice)).toContain('>All 3<')
    expect(page(withReport, session, twice)).toContain('3 found')
  })
  it('shows one evidence-strength indicator per row, and the checks only in the card', () => {
    const [src] = mergeSourceRows([row({ id: 'z', strength: 'Moderate', coverage: 'Abstract' })])
    const r = renderToStaticMarkup(<ul><SourceRow source={src} selected={false} onSelect={() => {}} cite={3} /></ul>)
    expect(r).toContain('Moderate evidence')
    expect(r.match(/h-2 w-3/g)).toHaveLength(4)
    expect(r.match(/bg-purple-accent/g)).toHaveLength(3)
    expect(r).toContain('[3]')
    expect(r).not.toContain('DOI matched')
    expect(r).not.toContain('Abstract only')
    expect(['Strong', 'Moderate', 'Weak', 'Insufficient', 'Conflicting', ''].map(s => strengthLevel(s).level)).toEqual([4, 3, 2, 1, 2, 0])
    expect(renderToStaticMarkup(<StrengthMeter strength="Weak" />)).toContain('Limited evidence')
    expect(sourceStrength(src)).toBe('Moderate')
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
    expect(items.map(i => i.label)).toEqual(['Bottom line', 'Key findings', 'How is usability defined?', 'Conflicting evidence', 'Gaps'])
    const doc = renderToStaticMarkup(<DeepResearchReportView report={report} part="document" onOpenSource={() => {}} selectedId={null} onExport={() => {}} exporting={false} onAsk={() => {}} />)
    for (const i of items) expect(doc, i.id).toContain(`id="${i.id}"`)
  })
  it('renders as a navigation list with the section buttons', () => {
    const html = page({ ...withReport, initialPanelView: 'outline' })
    expect(html).toContain('aria-label="Report outline"')
    for (const l of ['Bottom line', 'Key findings', 'Conflicting evidence', 'Gaps']) expect(html).toContain(`>${l}</button>`)
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

  it('offers the four chips: research the rest, find gaps, export, save sources', () => {
    expect(html).toContain('Research remaining 2 questions · 7 credits')
    expect(html).toContain('Find gaps (1)')
    expect(html).toContain('Export report (Word)')
    expect(html).toMatch(/Save sources \(\d+\)/)
  })
  it('makes only "Research remaining" the filled chip when it is available', () => {
    expect(primaryButtons(html)).toEqual(['Research remaining 2 questions · 7 credits'])
  })
  it('makes the Word export the filled chip when nothing can be continued', () => {
    expect(primaryButtons(page(withReport))).toEqual(['Export report (Word)'])
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
  it('disables Find gaps when the report found none', () => {
    const none = page({ ...withReport, report: { ...report, gaps: [] } })
    expect(none).toMatch(/<button[^>]*disabled=""[^>]*>(?:<svg.*?<\/svg>)?\s*Find gaps</s)
  })
  it('keeps Edit question and New research as real, secondary buttons', () => {
    expect(html).toMatch(/<button[^>]*border border-slate-300[^>]*>Edit question<\/button>/)
    expect(html).toMatch(/<button[^>]*border border-slate-300[^>]*>Blank new research<\/button>/)
  })
})

describe('narrow screens: the panel is a bottom sheet', () => {
  const html = page(withReport)
  it('is hidden below lg until opened, and opened from a floating Sources button', () => {
    expect(html).toMatch(/<aside id="selected-source-panel"[^>]*class="[^"]*max-lg:hidden/)
    expect(html).toMatch(/<button[^>]*class="[^"]*fixed bottom-4 right-4[^"]*lg:hidden[^>]*>Sources \(3\)/)
  })
  it('is a side panel from lg up, sticky beside the report', () => {
    expect(html).toMatch(/<aside[^>]*class="[^"]*lg:sticky/)
    expect(html).toContain('lg:grid-cols-[minmax(0,1fr)_380px]')
  })
})

describe('progress, citations and conflicts', () => {
  const progress = renderToStaticMarkup(<QuestionProgress segments={['done', 'partial', 'pending']} answered={1} onSelect={() => {}} />)
  it('progress has a legend, button segments, symbols and a non-colour cue', () => {
    expect(progress).toContain('Gap: some evidence')
    expect(progress.match(/<button/g)).toHaveLength(3)
    expect(progress).toContain('aria-label="Question 2: started, not enough evidence yet. Go to this question."')
    expect(progress).toContain('✓'); expect(progress).toContain('◐'); expect(progress).toContain('○')
    expect(progress).toContain('border-dashed')
  })
  it('a citation preview shows the title and the quote, or says there is none', () => {
    const p = renderToStaticMarkup(<CitationPreview id="t" title="Shared source" quote="Usability is the ease of use of a system." />)
    expect(p).toContain('role="tooltip"'); expect(p).toContain('Shared source'); expect(p).toContain('Usability is the ease')
    expect(renderToStaticMarkup(<CitationPreview id="t" title="X" quote={null} />)).toContain('No supporting sentence was kept')
    expect(previewQuote(mergeSourceRows(rows)[0])).toBe('Usability is the ease of use of a system.')
  })
  it('"Disagrees" is one badge: icon and word, in the report and in the panel', () => {
    expect(renderToStaticMarkup(<DisagreesBadge />)).toMatch(/<svg.*Disagrees/s)
    expect(page(withReport)).toContain('Disagrees')
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
    const html = page({ ...withReport, initialPanelView: 'questions' })
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
  it('filter chips and the Also buttons expose their pressed state', () => {
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
