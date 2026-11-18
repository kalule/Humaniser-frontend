import { describe, expect, it } from 'vitest'
import { fromEditable, reachedStage, stageIndex, STAGES, toEditable } from './researchPaper'
import { TOOLS, NAV_SECTIONS } from '../config/navigation'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'

describe('citation markers for editing', () => {
  it('numbers each source once and turns markers back into the same tokens', () => {
    const stored = `Sleep matters {{cite:${A}}}{{cite:${B}}}. As {{cite:n:${B}}} note, it matters {{cite:${A}}}.`
    const editable = toEditable(stored)
    expect(editable.text).toBe('Sleep matters [1][2]. As [@2] note, it matters [1].')
    expect(editable.ids).toEqual([A, B])
    expect(fromEditable(editable.text, editable.ids)).toBe(stored)
  })

  it('leaves unknown citations and numbers it has no source for untouched, so nothing is lost', () => {
    const stored = 'Naps help {{cite:unknown:S9}}. See [7] and [2].'
    const editable = toEditable(stored)
    expect(editable.text).toBe(stored)
    expect(fromEditable('Naps help [1] and [3].', [A])).toBe(`Naps help {{cite:${A}}} and [3].`)
  })
})

describe('stages', () => {
  it('opens the stages the paper has reached', () => {
    expect(reachedStage('Question')).toBe(0)
    expect(reachedStage('Screening')).toBe(2)
    expect(reachedStage('Outline')).toBe(reachedStage('Writing'))
    expect(STAGES[reachedStage('Ready')].id).toBe('export')
    expect(stageIndex('check')).toBe(5)
    expect(stageIndex('nonsense')).toBe(0)
  })
})

describe('navigation', () => {
  it('reaches Research Paper from one side-menu item, next to Literature Review', () => {
    expect(TOOLS['research-paper'].link).toBe('/app/research-paper')
    const write = NAV_SECTIONS.find(s => s.section === 'Write')!.items.map(i => i.id)
    expect(write.indexOf('research-paper')).toBe(write.indexOf('literature-review') + 1)
  })
})
