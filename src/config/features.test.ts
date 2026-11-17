import { describe, expect, it } from 'vitest'
import { LAUNCH_TOOLS, isToolEnabled } from './features'
import { NAV_ITEMS, TOOLS, TOOL_NAV_ORDER, visibleNavSections, toolForPath } from './navigation'

const LAUNCH_LABELS = ['Documents', 'Editor', 'Humanise', 'AI Content Check', 'Paraphraser', 'Grammar & Style', 'Summariser', 'Verify Citations']
const HIDDEN_LABELS = ['Proposal Studio', 'Systematic Review', 'Reviewer', 'Research Library', 'Document Chat', 'Research Agent', 'Deep Research', 'Data Analyst', 'Similarity Check', 'Citation Generator', 'Flashcards', 'Lecture Notes']

describe('launch visibility', () => {
  it('enables exactly the launch tools for a normal user', () => {
    const enabled = Object.values(TOOLS).filter(t => isToolEnabled(t.id)).map(t => t.label).sort()
    expect(enabled).toEqual([...LAUNCH_LABELS].sort())
    expect(LAUNCH_TOOLS.size).toBe(LAUNCH_LABELS.length)
  })

  it('hides every Phase 2 tool from a normal user and shows all of them to an admin', () => {
    for (const label of HIDDEN_LABELS) {
      const tool = Object.values(TOOLS).find(t => t.label === label)!
      expect(isToolEnabled(tool.id), label).toBe(false)
      expect(isToolEnabled(tool.id, true), label).toBe(true)
    }
  })

  it('groups the launch sidebar as Write / Verify / Improve, with no empty Phase 2 groups', () => {
    const sections = visibleNavSections(id => isToolEnabled(id))
    expect(sections.map(s => [s.section, s.items.map(i => i.label)])).toEqual([
      ['Write', ['Documents', 'Editor']],
      ['Verify', ['Verify Citations', 'AI Content Check']],
      ['Improve', ['Humanise', 'Paraphraser', 'Grammar & Style', 'Summariser']],
    ])
  })

  it('brings the Phase 2 groups back when everything is enabled, with Reviewer under Verify', () => {
    const sections = visibleNavSections(() => true)
    expect(sections.map(s => s.section)).toEqual(['Write', 'Find sources', 'Verify', 'Improve', 'Analyse', 'Study'])
    expect(sections.find(s => s.section === 'Verify')!.items.map(i => i.label)).toContain('Reviewer')
    expect(sections.find(s => s.section === 'Write')!.items.map(i => i.label)).not.toContain('Reviewer')
  })

  it('gives every tool a description and one shared name across sidebar and rail', () => {
    // Short enough to sit on one line in the expanded sidebar without an ellipsis.
    for (const item of NAV_ITEMS) {
      expect(item.description.length, item.label).toBeGreaterThan(0)
      expect(item.description.length, item.label).toBeLessThanOrEqual(30)
    }
    expect(TOOL_NAV_ORDER.every(id => TOOLS[id])).toBe(true)
  })

  it('resolves both citation routes to the single Verify Citations tool', () => {
    expect(toolForPath('/app/citation-check')?.label).toBe('Verify Citations')
    expect(toolForPath('/app/citation-integrity')?.label).toBe('Verify Citations')
  })
})
