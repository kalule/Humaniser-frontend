import { describe, expect, it } from 'vitest'
import type { CoWriteSession } from '../types/workbench'
import { displayText, groundingFor, isFinished, nextPendingSection, sectionHtml, wordCount } from './essayCoWrite'

const session: CoWriteSession = {
  sessionId: 'sess1', title: 'T', question: 'Q?', thesis: 'Thesis.', citationStyle: 'Harvard',
  sections: [
    { id: 'intro', kind: 'intro', heading: 'Introduction', claim: '', reasoning: '', qualification: '', evidenceIds: [], words: 120, status: 'ready' },
    { id: 's1', kind: 'body', heading: 'Nationalism', claim: 'c', reasoning: '', qualification: '', evidenceIds: ['E1'], words: 250, status: 'ready' },
    { id: 's2', kind: 'body', heading: 'Sanctions', claim: 'c', reasoning: '', qualification: '', evidenceIds: ['E2'], words: 250, status: 'limited' },
    { id: 'conclusion', kind: 'conclusion', heading: 'Conclusion', claim: '', reasoning: '', qualification: '', evidenceIds: [], words: 100, status: 'ready' },
  ],
  passages: [{ id: 'E1', sourceId: 'S1', text: 'The National Party institutionalised apartheid.', claim: 'c', role: 'direct' }],
  references: [{ sourceId: 'S1', title: 'Apartheid history', authors: 'Smith, J.', year: 2020 } as never],
}

describe('nextPendingSection', () => {
  it('starts at the introduction and moves on past accepted and skipped sections', () => {
    expect(nextPendingSection(session, {})?.id).toBe('intro')
    expect(nextPendingSection(session, { intro: 'accepted' })?.id).toBe('s1')
    expect(nextPendingSection(session, { intro: 'accepted', s1: 'skipped' }, 's1')?.id).toBe('s2')
  })

  it('wraps round to an earlier skipped-over section and returns null when everything is done', () => {
    expect(nextPendingSection(session, { s1: 'accepted', s2: 'accepted', conclusion: 'accepted' }, 'conclusion')?.id).toBe('intro')
    const all = { intro: 'accepted', s1: 'accepted', s2: 'skipped', conclusion: 'accepted' } as const
    expect(nextPendingSection(session, all)).toBeNull()
    expect(isFinished(session, all)).toBe(true)
    expect(isFinished(session, { intro: 'accepted' })).toBe(false)
  })
})

describe('sectionHtml', () => {
  it('opens the introduction, the body and the conclusion with their headings, the body heading only once', () => {
    expect(sectionHtml(session.sections[0], 'Intro text.', session, {})).toMatch(/^<h2>INTRODUCTION<\/h2><p>/)
    expect(sectionHtml(session.sections[1], 'Body one.', session, {})).toMatch(/^<h2>MAIN BODY<\/h2><p>/)
    expect(sectionHtml(session.sections[2], 'Body two.', session, { s1: 'accepted' })).toMatch(/^<p>/)
    expect(sectionHtml(session.sections[3], 'The end.', session, {})).toMatch(/^<h2>CONCLUSION<\/h2>/)
  })

  it('turns citation tokens into interactive citations and escapes anything that looks like markup', () => {
    const html = sectionHtml(session.sections[1], 'It was built [S1]. <script>alert(1)</script>', session, {})
    expect(html).toContain('<cite')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('splits paragraphs on blank lines', () => {
    const html = sectionHtml(session.sections[1], 'First.\n\nSecond.', session, { s0: 'accepted' })
    expect(html.match(/<p>/g)).toHaveLength(2)
  })
})

describe('display and grounding', () => {
  it('shows a token as an author-date citation', () => {
    expect(displayText('It was built [S1].', session)).toContain('Smith')
  })

  it('lists the passages that support each cited source', () => {
    const g = groundingFor(session, ['S1', 'S9'], ['E1'])
    expect(g[0].passages.map(p => p.id)).toEqual(['E1'])
    expect(g[1].reference).toBeNull()
    expect(g[1].passages).toEqual([])
  })

  it('counts words', () => {
    expect(wordCount('  three plain words ')).toBe(3)
    expect(wordCount('')).toBe(0)
  })
})
