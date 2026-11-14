import { describe, expect, it } from 'vitest'
import {
  abbreviation, addOtherItem, addScaleItem, countBySeverity, emptyDocument, moveItem, removeConstruct, removeObjective, removeScale, scaleFromPreset,
  setConstructScale, suggestVariableName, type QuestionnaireDocument,
} from './questionnaire'

const base = (): QuestionnaireDocument => ({
  ...emptyDocument(),
  objectives: ['First', 'Second', 'Third'],
  scales: [{ id: 's1', name: 'Agreement', anchors: [{ value: 1, label: 'No' }, { value: 2, label: 'Yes' }], missingCodes: [] }],
  constructs: [{ id: 'c1', name: 'Academic writing self-efficacy', definition: '', objectiveNumbers: [1, 3] }, { id: 'c2', name: 'Generative AI tool usage', definition: '', objectiveNumbers: [2] }],
})

describe('variable names', () => {
  it('abbreviates a construct name to its initials', () => {
    expect(abbreviation('Academic writing self-efficacy')).toBe('awse')
    expect(abbreviation('Generative AI tool usage')).toBe('gatu')
    expect(abbreviation('2024 cohort')).toBe('') // must start with a letter
    expect(abbreviation('')).toBe('')
  })

  it('suggests the next free name and never one already used, ignoring case', () => {
    const doc = addScaleItem(addScaleItem(base(), 'c1'), 'c1')
    expect(doc.items.map(i => i.variableName)).toEqual(['awse_1', 'awse_2'])
    const renamed = { ...doc, items: doc.items.map((i, n) => (n === 0 ? { ...i, variableName: 'AWSE_3' } : i)) }
    expect(suggestVariableName('awse', renamed)).toBe('awse_1')
    expect(suggestVariableName('', base())).toBe('item_1')
  })
})

describe('editing', () => {
  it('adds a scale item to its construct, with the construct\'s scale, required, not reverse-coded', () => {
    const doc = addScaleItem(base(), 'c1')
    expect(doc.items[0]).toMatchObject({ role: 'Scale', constructId: 'c1', scaleId: 's1', reverseCoded: false, required: true, text: '' })
  })

  it('keeps each construct\'s items together when adding', () => {
    let doc = addScaleItem(base(), 'c1')
    doc = addScaleItem(doc, 'c2')
    doc = addScaleItem(doc, 'c1')
    expect(doc.items.map(i => i.constructId)).toEqual(['c1', 'c1', 'c2'])
  })

  it('gives every new entry its own id', () => {
    let doc = base()
    for (let n = 0; n < 30; n++) doc = addScaleItem(doc, 'c1')
    expect(new Set(doc.items.map(i => i.id)).size).toBe(30)
  })

  it('sets one response scale for all items of a construct', () => {
    let doc = addScaleItem(addScaleItem(addScaleItem(base(), 'c1'), 'c1'), 'c2')
    doc = setConstructScale(doc, 'c1', 's9')
    expect(doc.items.map(i => i.scaleId)).toEqual(['s9', 's9', 's1'])
  })

  it('moves an item only among the items of its own construct', () => {
    let doc = addScaleItem(addScaleItem(addScaleItem(base(), 'c1'), 'c1'), 'c2')
    const [first, second, other] = doc.items.map(i => i.id)
    doc = moveItem(doc, second, -1)
    expect(doc.items.map(i => i.id)).toEqual([second, first, other])
    expect(moveItem(doc, second, -1)).toBe(doc) // already first in its construct
    expect(moveItem(doc, first, 1).items.map(i => i.id)).toEqual([second, first, other]) // will not cross into c2
  })

  it('adds other items with a role-based variable name and no construct', () => {
    const doc = addOtherItem(addOtherItem(base(), 'Demographic'), 'OpenText')
    expect(doc.items.map(i => [i.role, i.variableName, i.constructId])).toEqual([['Demographic', 'demo_1', null], ['OpenText', 'open_1', null]])
  })

  it('removes a construct together with its items', () => {
    const doc = removeConstruct(addScaleItem(addScaleItem(base(), 'c1'), 'c2'), 'c1')
    expect(doc.constructs.map(c => c.id)).toEqual(['c2'])
    expect(doc.items.map(i => i.constructId)).toEqual(['c2'])
  })

  it('removes a scale and leaves its items without one, for the checks to report', () => {
    const doc = removeScale(addScaleItem(base(), 'c1'), 's1')
    expect(doc.scales).toEqual([])
    expect(doc.items[0].scaleId).toBeNull()
  })

  it('removing an objective renumbers the links so constructs stay tied to the same objective text', () => {
    const doc = removeObjective(base(), 1) // remove "Second"
    expect(doc.objectives).toEqual(['First', 'Third'])
    expect(doc.constructs.map(c => c.objectiveNumbers)).toEqual([[1, 2], []]) // c1 was linked to First and Third
  })

  it('offers generic scale presets numbered from 1', () => {
    const scale = scaleFromPreset('freq5', base())
    expect(scale.anchors.map(a => a.value)).toEqual([1, 2, 3, 4, 5])
    expect(scale.anchors[0].label).toBe('Never')
    expect(scaleFromPreset('blank', base()).anchors).toHaveLength(2)
  })
})

describe('countBySeverity', () => {
  it('counts findings and treats no report as zero', () => {
    expect(countBySeverity(null)).toEqual({ error: 0, warning: 0, info: 0 })
    expect(countBySeverity({ findings: [{ code: 'a', severity: 'error', message: '', itemIds: [] }, { code: 'b', severity: 'info', message: '', itemIds: [] }], itemCount: 0, scaleItemCount: 0, estimatedMinutes: 0, canExport: false }))
      .toEqual({ error: 1, warning: 0, info: 1 })
  })
})
