import { describe, expect, it } from 'vitest'
import { inDraftOrder } from './sectionWorkflow'

describe('inDraftOrder', () => {
  it('drafts the conceptual framework after the research questions and objectives', () => {
    expect(inDraftOrder(['3.1', '3.2', '3.3', '4.1', '4.2', '4.3', '5.1']))
      .toEqual(['3.1', '3.2', '4.1', '4.2', '4.3', '3.3', '5.1'])
  })

  it('keeps 3.3 in place when 4.1-4.3 are already written', () => {
    expect(inDraftOrder(['3.3', '5.1', '5.2'])).toEqual(['3.3', '5.1', '5.2'])
  })

  it('waits only for the 4.x sections still to draft', () => {
    expect(inDraftOrder(['3.3', '4.3', '5.1'])).toEqual(['4.3', '3.3', '5.1'])
  })

  it('leaves a list without 3.3 alone', () => {
    expect(inDraftOrder(['4.1', '5.1'])).toEqual(['4.1', '5.1'])
  })
})
