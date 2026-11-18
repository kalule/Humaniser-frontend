import { describe, expect, it } from 'vitest'
import {
  cleanList, fromEditable, importSummary, reachedStep, readinessText, shortCite, splitCitations, STEPS, stepIndex, toEditable,
} from './literatureReview'
import { LAUNCH_TOOLS, isToolEnabled } from '../config/features'
import { NAV_SECTIONS, TOOLS, isNavItemActive, resolvePageTitle, toolForPath } from '../config/navigation'

const A = '11111111-1111-1111-1111-111111111111'
const B = '22222222-2222-2222-2222-222222222222'

describe('citations in drafted text', () => {
  it('splits text into plain parts, source citations and unknown citations', () => {
    expect(splitCitations(`Use goes with anxiety {{cite:${A}}}{{cite:${B}}}. Not here {{cite:unknown:S9}}.`)).toEqual([
      { kind: 'text', text: 'Use goes with anxiety ' },
      { kind: 'cite', sourceId: A },
      { kind: 'cite', sourceId: B },
      { kind: 'text', text: '. Not here ' },
      { kind: 'unknown', label: 'S9' },
      { kind: 'text', text: '.' },
    ])
    expect(splitCitations('No citations.')).toEqual([{ kind: 'text', text: 'No citations.' }])
  })

  it('round-trips through the numbered editing markers without losing a citation', () => {
    const stored = `First {{cite:${A}}}. Second {{cite:${B}}}{{cite:${A}}}. Odd {{cite:unknown:S9}}.`
    const { editable, sources } = toEditable(stored)
    expect(editable).toBe('First [@1]. Second [@2][@1]. Odd [@?S9].')
    expect(sources).toEqual([A, B])
    expect(fromEditable(editable, sources)).toBe(stored)
  })

  it('turns a marker the student invented into a visible unknown citation, never a silent drop', () => {
    expect(fromEditable('A claim [@3]. Another [@x].', [A])).toBe('A claim {{cite:unknown:@3}}. Another {{cite:unknown:@x}}.')
  })

  it('labels a source by first author and year', () => {
    expect(shortCite({ authors: 'Nakato, J.; Okello, P.', year: 2019 })).toBe('Nakato and Okello, 2019')
    expect(shortCite({ authors: 'Nakato', year: null })).toBe('Nakato, n.d.')
    expect(shortCite(undefined)).toBe('source not in this review')
  })

  it('names the first author by surname and writes the narrative form', () => {
    expect(shortCite({ authors: 'Christopher Kelly, Alan Karthikesalingam', year: 2019 })).toBe('Kelly and Karthikesalingam, 2019')
    expect(shortCite({ authors: 'Christopher Kelly, Alan Karthikesalingam', year: 2019 }, true)).toBe('Kelly and Karthikesalingam (2019)')
    expect(shortCite({ authors: 'Nakato, J.', year: 2019 }, true)).toBe('Nakato (2019)')
  })

  it('keeps narrative citations through splitting and editing', () => {
    const stored = `{{cite:n:${A}}} report a gap {{cite:${B}}}. {{cite:${A}}} again.`
    expect(splitCitations(stored)[0]).toEqual({ kind: 'cite', sourceId: A, narrative: true })
    expect(splitCitations(stored)[2]).toEqual({ kind: 'cite', sourceId: B })
    const { editable, sources } = toEditable(stored)
    expect(editable).toBe('[@n1] report a gap [@2]. [@1] again.')
    expect(sources).toEqual([A, B])
    expect(fromEditable(editable, sources)).toBe(stored)
    expect(fromEditable('[@n9] said so.', [A])).toBe('{{cite:unknown:@n9}} said so.')
  })
})

describe('workflow', () => {
  it('maps the review status to the furthest step reached', () => {
    expect(reachedStep('Scoping')).toBe(0)
    expect(reachedStep('Extracting')).toBe(2)
    expect(reachedStep('Outlining')).toBe(3)
    expect(reachedStep('Ready')).toBe(STEPS.length - 1)
    expect(stepIndex('draft')).toBe(4)
    expect(stepIndex('nonsense')).toBe(0)
  })

  it('explains why export is not open yet, and says when it is', () => {
    expect(readinessText({ ready: false, blockingOpen: 2, warningsOpen: 1, notDrafted: ['Conclusion'], notVerified: [] }))
      .toBe('Not ready to export: 1 section not written, 2 blocking issues.')
    expect(readinessText({ ready: true, blockingOpen: 0, warningsOpen: 3, notDrafted: [], notVerified: [] })).toBe('Ready to export. 3 warnings to consider.')
    expect(readinessText({ ready: false, blockingOpen: 0, warningsOpen: 0, notDrafted: [], notVerified: [] })).toBe('Not ready to export: build the outline and draft the review first.')
  })

  it('summarises an import, including what was left out and why', () => {
    expect(importSummary({ added: 2, alreadyInPool: 1, withoutAbstract: ['A report'], notFound: 0 }))
      .toBe('2 added, 1 already in the review. Left out because they hold details only, no abstract: A report.')
  })

  it('cleans criteria lists', () => {
    expect(cleanList(['  Peer  reviewed ', 'peer reviewed', '', 'Adults'])).toEqual(['Peer reviewed', 'Adults'])
  })
})

describe('registration', () => {
  it('is one Write item after Systematic Review, a Beta tool hidden at launch', () => {
    const write = NAV_SECTIONS.find(s => s.section === 'Write')!.items.map(i => i.id)
    expect(write.indexOf('literature-review')).toBe(write.indexOf('systematic-review') + 1)
    expect(TOOLS['literature-review']).toMatchObject({ label: 'Literature Review', link: '/app/literature-review', badge: 'Beta' })
    expect(TOOLS['literature-review'].description.length).toBeLessThanOrEqual(30)
    expect(LAUNCH_TOOLS.has('literature-review')).toBe(false)
    expect(isToolEnabled('literature-review', true)).toBe(true)
  })

  it('owns the studio and the Literature Matrix pages, which have no menu item of their own', () => {
    expect(NAV_SECTIONS.flatMap(s => s.items).some(i => i.id === 'literature-matrix')).toBe(false)
    expect(toolForPath('/app/literature-review/abc')?.id).toBe('literature-review')
    expect(toolForPath('/app/literature-matrix/abc')?.id).toBe('literature-review')
    expect(isNavItemActive(TOOLS['literature-review'], '/app/literature-matrix')).toBe(true)
    expect(resolvePageTitle('/app/literature-review')).toBe('Literature Review')
  })
})

describe('shortCite bylines', () => {
  it('names PubMed, Crossref and OpenAlex bylines by surname', () => {
    expect(shortCite({ authors: 'Harbi MH, Xu G, Strom DK', year: 2026 }, true)).toBe('Harbi et al. (2026)')
    expect(shortCite({ authors: 'Ruiz-Martín H', year: 2026 })).toBe('Ruiz-Martín, 2026')
    expect(shortCite({ authors: 'Smith, J., Jones, A.', year: 2020 })).toBe('Smith and Jones, 2020')
    expect(shortCite({ authors: 'Christopher Kelly, Alan Karthikesalingam, Mustafa Suleyman', year: 2019 }, true)).toBe('Kelly et al. (2019)')
    expect(shortCite({ authors: 'Kun-Hsing Yu', year: null })).toBe('Yu, n.d.')
  })
})
