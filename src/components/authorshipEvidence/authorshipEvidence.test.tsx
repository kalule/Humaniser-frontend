import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { NAV_SECTIONS, TOOLS } from '../../config/navigation'
import { LAUNCH_TOOLS } from '../../config/features'
import { failureMessage, type Declaration, type EvidenceDocument, type Report, type TimelineEvent, type UsageEntry } from '../../lib/authorshipEvidence'
import { DeclarationTab } from './DeclarationTab'
import { RegisterTab } from './RegisterTab'
import { ReportBody, ReportTab } from './ReportTab'
import { TimelineTab } from './TimelineTab'
import { VersionsTab } from './VersionsTab'

const event = (over: Partial<TimelineEvent> = {}): TimelineEvent => ({
  id: 'e1', sequence: 1, occurredAt: '2026-11-02T09:00:00Z', type: 'Checkpoint', source: 'Student', evidenceLabel: 'Verified',
  description: '3 saves: 240 characters added, 9 characters removed. The document then held 41 words.', versionNumber: null, wordCount: 41,
  charsAdded: 240, charsRemoved: 9, periodStart: '2026-11-02T08:55:00Z', saves: 3, citationsAdded: 0, citationsRemoved: 0, tool: null,
  usageEntryId: null, fileName: null, ...over,
})

const entry = (over: Partial<UsageEntry> = {}): UsageEntry => ({
  id: 'u1', documentId: 'd1', documentTitle: 'Chapter 2', occurredAt: '2026-11-02T09:05:00Z', tool: 'Grammar & Style', assistanceType: 'Grammar',
  section: null, wordsAffected: 120, inputChars: 700, outputChars: 0, outcome: 'NotRecorded', outcomeLabel: null, evidenceLabel: 'Verified',
  linkLabel: 'Verified', correctsEntryId: null, corrected: false, note: null, hasFullText: false, fullTextPurgeAfter: null, ...over,
})

const declaration = (over: Partial<Declaration> = {}): Declaration => ({
  id: 'x', category: 'Limited', text: 'I used a grammar checker and nothing else.', templateKey: null, draftOrigin: 'Template', confirmed: false,
  accuracyConfirmedAt: null, updatedAt: '2026-11-02T10:00:00Z', warnings: [], ...over,
})

const doc = (over: Partial<EvidenceDocument> = {}): EvidenceDocument => ({
  documentId: 'd1', title: 'Chapter 2', status: 'Recording', origin: 'Created', originFileName: null, documentCreatedAt: '2026-11-02T08:50:00Z',
  recordingStartedAt: '2026-11-02T08:50:00Z', timeline: [event()],
  sessions: [{ number: 1, startedAt: '2026-11-02T08:55:00Z', endedAt: '2026-11-02T09:00:00Z', saves: 3, charsAdded: 240, charsRemoved: 9, wordCountAtEnd: 41 }],
  versions: [], register: [entry()], areas: [], limitations: [], chain: { intact: true, brokenAtSequence: null, eventCount: 1, headHash: 'ab'.repeat(32) },
  declaration: null, reports: [], purgeAfter: '2027-05-01T00:00:00Z', ...over,
})

const report = (over: Partial<Report> = {}): Report => ({
  id: null, documentId: 'd1', reportNumber: null, generatedAt: null, canGenerate: false, blockedReason: 'not confirmed',
  content: {
    studentName: 'Alice Student', studentEmail: 'alice@test.local', documentTitle: 'Chapter 2', origin: 'Existing', originFileName: null,
    documentCreatedAt: '2026-10-01T08:00:00Z', recordingStartedAt: '2026-11-02T08:50:00Z', timeline: [event()], sessions: [], versions: [],
    register: [entry()], usageSummary: [{ tool: 'Grammar & Style', assistanceType: 'Grammar', uses: 1, wordsAffected: 120, first: '2026-11-02T09:05:00Z', last: '2026-11-02T09:05:00Z', evidenceLabel: 'Verified' }],
    revisionActivity: { sessions: 1, saves: 3, charsAdded: 240, charsRemoved: 9, versions: 0, largeInsertions: 0, firstWordCount: 30, lastWordCount: 41 },
    areas: [{ key: 'writing', title: 'Writing development', recorded: ['1 edit session recorded'], missing: ['The document existed before recording began on 2 Nov 2026. How it was written up to then was not recorded.'] }],
    declarationCategory: 'NoAi', declarationText: 'I declare that I did not use generative AI tools.', declarationConfirmedAt: '2026-11-02T10:05:00Z',
    declarationNotes: ['The register lists 1 AI tool use for this document. The report shows them next to this declaration.'],
    limitations: ['Missing evidence means only that something was not recorded. It is not evidence of misconduct.'],
    chain: { intact: true, brokenAtSequence: null, eventCount: 1, headHash: 'ab'.repeat(32) },
  },
  ...over,
})

const noop = async () => {}

describe('Report: nothing is created or exported until the accuracy box is ticked', () => {
  const html = (d: EvidenceDocument) => renderToStaticMarkup(<ReportTab doc={d} reportCredits={5} onReload={noop} onOpenDeclaration={() => {}} />)
  const createButton = (out: string) => out.match(/<button[^>]*>Create report \(5 credits\)<\/button>/)?.[0] ?? ''

  it('disables Create report with no declaration, and says what is needed', () => {
    const out = html(doc())
    expect(createButton(out)).toContain('disabled=""')
    expect(out).toContain('cannot be created or exported until you have written the declaration and ticked')
    expect(out).toContain('You are charged only if the report is created.')
  })

  it('keeps it disabled while the declaration is an unconfirmed draft', () => {
    expect(createButton(html(doc({ declaration: declaration() })))).toContain('disabled=""')
  })

  it('enables it once the declaration is confirmed, with the cost on the button', () => {
    const out = html(doc({ declaration: declaration({ confirmed: true, accuracyConfirmedAt: '2026-11-02T10:05:00Z' }) }))
    expect(createButton(out)).not.toBe('')
    expect(createButton(out)).not.toContain('disabled=""')
    expect(out).not.toContain('cannot be created or exported')
  })

  it('offers PDF and Word only for a report that has been created', () => {
    expect(html(doc())).not.toContain('>PDF</button>')
    const out = html(doc({ reports: [{ id: 'r1', documentId: 'd1', documentTitle: 'Chapter 2', reportNumber: 'AER-20261102-1A2B3C4D', generatedAt: '2026-11-02T10:06:00Z', eventCount: 4 }] }))
    expect(out).toContain('AER-20261102-1A2B3C4D')
    expect(out).toContain('>PDF</button>')
    expect(out).toContain('>Word</button>')
  })
})

describe('Report body', () => {
  it('keeps recorded evidence and the student declaration apart, each with its label, and prints what is missing', () => {
    const out = renderToStaticMarkup(<ReportBody report={report()} />)
    expect(out).toContain('Preview: not yet created, no report ID')
    expect(out).toContain('Existed before recording began')
    expect(out).toContain('How it was written up to then was not recorded.')
    expect(out).toContain('Verified by platform')
    expect(out.indexOf('Student&#x27;s AI use declaration')).toBeGreaterThan(out.indexOf('AI usage (recorded and student-entered)'))
    expect(out).toContain('User supplied')
    // "No AI" is the student's statement; the recorded use is still printed beside it.
    expect(out).toContain('No AI assistance')
    expect(out).toContain('Grammar &amp; Style')
    expect(out).toContain('The register lists 1 AI tool use for this document.')
    expect(out).toContain('It is not evidence of misconduct.')
  })

  it('shows the report ID and confirmation time only for a stored report', () => {
    const out = renderToStaticMarkup(<ReportBody report={report({ id: 'r1', reportNumber: 'AER-20261102-1A2B3C4D', generatedAt: '2026-11-02T10:06:00Z' })} />)
    expect(out).toContain('Report ID AER-20261102-1A2B3C4D')
    expect(out).toContain('Confirmed as accurate by the student on')
  })

  it('never shows a score, a verdict on who wrote the text, or a certificate', () => {
    const out = renderToStaticMarkup(<ReportBody report={report()} />).toLowerCase()
    for (const word of ['human-written', 'ai-free', 'proven original', 'score', 'certificate', '% ', 'likelihood', 'probability'])
      expect(out).not.toContain(word)
  })
})

describe('Timeline', () => {
  it('says plainly when nothing has been recorded', () => {
    const out = renderToStaticMarkup(<TimelineTab doc={doc({ timeline: [], sessions: [] })} />)
    expect(out).toContain('No history has been recorded for this document yet.')
    expect(out).not.toContain('<table')
  })

  it('shows each entry with its source and evidence label, and the session numbers as the server sent them', () => {
    const out = renderToStaticMarkup(<TimelineTab doc={doc({
      timeline: [
        event(),
        event({ id: 'e2', sequence: 2, type: 'DraftImported', source: 'Student', evidenceLabel: 'Imported', description: 'Earlier draft imported by the student as version 2 (300 words).', versionNumber: 2, fileName: 'old.docx' }),
        event({ id: 'e3', sequence: 3, type: 'ToolUsed', source: 'AiAssisted', evidenceLabel: 'UserSupplied', description: 'The student added a register entry: ChatGPT.', tool: 'ChatGPT' }),
      ],
    })} />)
    expect(out).toContain('Edits saved')
    expect(out).toContain('Source: Student')
    expect(out).toContain('>Imported</span>')
    expect(out).toContain('File: old.docx')
    expect(out).toContain('AI tool used: ChatGPT')
    expect(out).toContain('Source: AI-assisted operation')
    expect(out).toContain('>User supplied</span>')
    expect(out).toMatch(/<td[^>]*>240<\/td>/)
    expect(out).toMatch(/<td[^>]*>41<\/td>/)
  })
})

describe('Versions', () => {
  it('labels an imported draft Imported, with the date marked as the one the student gave', () => {
    const out = renderToStaticMarkup(<VersionsTab onChange={() => {}} doc={doc({
      versions: [
        { id: 'v1', versionNumber: 1, createdAt: '2026-11-02T08:50:00Z', reason: 'Created', evidenceLabel: 'Verified', wordCount: 30, charCount: 180, fileName: null, declaredDate: null },
        { id: 'v2', versionNumber: 2, createdAt: '2026-11-02T09:30:00Z', reason: 'ImportedDraft', evidenceLabel: 'Imported', wordCount: 300, charCount: 1800, fileName: 'old.docx', declaredDate: '2026-10-01T00:00:00Z' },
      ],
    })} />)
    expect(out).toContain('Imported draft')
    expect(out).toContain('>Imported</span>')
    expect(out).toContain('date you gave: 1 Oct 2026')
    expect(out).toContain('Compare two versions')
  })
})

describe('Register', () => {
  const html = (entries: UsageEntry[]) => renderToStaticMarkup(<RegisterTab doc={doc({ register: entries })} onReload={noop} />)

  it('says that no recorded use is not proof that none was used', () => {
    expect(html([])).toContain('That does not show that none was used')
  })

  it('lets the student remove only an entry they added themselves', () => {
    expect(html([entry()])).not.toContain('>Remove</button>')
    expect(html([entry({ id: 'u2', tool: 'ChatGPT', evidenceLabel: 'UserSupplied', linkLabel: 'UserSupplied' })])).toContain('>Remove</button>')
  })

  it('keeps a corrected entry on the page, marked as corrected', () => {
    const out = html([entry({ corrected: true }), entry({ id: 'u2', correctsEntryId: 'u1', evidenceLabel: 'UserSupplied', outcome: 'Rejected', outcomeLabel: 'UserSupplied', note: 'I did not keep the result.' })])
    expect(out).toContain('Corrected by a later entry; kept for the record')
    expect(out).toContain('Correction of an earlier entry')
    expect(out).toContain('I did not keep the result.')
  })

  it('does not let an outcome the platform recorded be changed', () => {
    const out = html([entry({ outcome: 'Accepted', outcomeLabel: 'Verified' })])
    expect(out).not.toContain('<select id="ae-outcome-u1"')
    expect(out).toContain('Accepted as it was')
  })
})

describe('Declaration', () => {
  const html = (d: EvidenceDocument) => renderToStaticMarkup(<DeclarationTab doc={d} wordingCredits={3} onReload={noop} onOpenRegister={() => {}} />)

  it('starts by showing what is recorded, and does not pre-select a category before the records are read', () => {
    const out = html(doc())
    expect(out).toContain('What is recorded about AI use in this document')
    expect(out).not.toContain('checked=""')
  })

  it('opens a saved declaration for editing, as a draft', () => {
    const out = html(doc({ declaration: declaration() }))
    expect(out).toContain('Review and edit the declaration')
    expect(out).toContain('This is a draft.')
    expect(out).toContain('I used a grammar checker and nothing else.')
  })
})

describe('Navigation and messages', () => {
  it('lists Authorship Evidence under Verify as a Beta tool that is not in the launch set', () => {
    const tool = TOOLS['authorship-evidence']
    expect(tool.link).toBe('/app/authorship-evidence')
    expect(tool.badge).toBe('Beta')
    expect(NAV_SECTIONS.find(s => s.section === 'Verify')?.items.map(i => i.id)).toContain('authorship-evidence')
    expect(LAUNCH_TOOLS.has('authorship-evidence')).toBe(false)
  })

  it('turns failures into one sentence, and says nothing was charged when credits ran out', () => {
    expect(failureMessage({ response: { status: 402 } }, 'report')).toBe('You do not have enough credits for this. Nothing was charged.')
    expect(failureMessage({ code: 'ERROR', message: 'The declaration must be at least 20 characters.' }, 'save')).toBe('The declaration must be at least 20 characters.')
    expect(failureMessage(new Error('boom'), 'report')).toBe('The report could not be created. Nothing was charged. Try again.')
  })
})
