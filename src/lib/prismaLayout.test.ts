import { describe, expect, it } from 'vitest'
import { buildPrismaBoxes, layoutPrisma, splitIdentification, NOT_RECORDED, type PrismaFlowExtended } from './prismaLayout'
import { MIN_SVG_FONT_SIZE, estimateTextWidth } from './svgText'

function flow(overrides: Partial<PrismaFlowExtended> = {}): PrismaFlowExtended {
  return {
    retrieved: 120,
    retrievedBySource: { PubMed: 70, OpenAlex: 30, 'ClinicalTrials.gov': 12, Snowball: 8 },
    duplicatesRemovedByDoi: 15,
    duplicatesRemovedByTitle: 5,
    excludedWithoutAbstract: 4,
    excludedByPublicationDate: 3,
    excludedByCitationThreshold: 0,
    readyForScreening: 93,
    titleAbstractScreened: 93,
    titleAbstractIncluded: 20,
    titleAbstractExcluded: 60,
    titleAbstractNeedsManualReview: 3,
    titleAbstractPending: 10,
    fullTextAssessed: 20,
    fullTextIncluded: 9,
    fullTextExcluded: 6,
    fullTextNeedsManualReview: 1,
    fullTextPending: 2,
    fullTextNeedsPdf: 2,
    fullTextNotRetrieved: 2,
    includedStudies: 8,
    countsSource: 'ledger',
    ...overrides,
  }
}

const text = (lines: { text: string }[]) => lines.map(l => l.text).join(' | ')

describe('splitIdentification', () => {
  it('separates databases, registers and citation searching', () => {
    const id = splitIdentification(flow())
    expect(id.databases).toBe(100)
    expect(id.registers).toBe(12)
    expect(id.otherMethods).toBe(8)
    expect(id.databaseSources.map(([s]) => s)).toEqual(['PubMed', 'OpenAlex'])
  })
})

describe('buildPrismaBoxes', () => {
  it('maps each PRISMA box to its field', () => {
    const m = buildPrismaBoxes(flow())
    expect(text(m.identified.lines)).toContain('Databases (n = 100)')
    expect(text(m.identified.lines)).toContain('Registers (n = 12)')
    expect(text(m.removed.lines)).toContain('Duplicate records removed (n = 20)')
    expect(text(m.removed.lines)).toContain('Records removed for other reasons (n = 7)')
    // Screened = pool minus not-yet-screened, not the pool.
    expect(text(m.screened.lines)).toContain('(n = 83)')
    expect(text(m.screened.lines)).toContain('Not yet screened (n = 10)')
    expect(text(m.excluded.lines)).toContain('(n = 60)')
    expect(text(m.excluded.lines)).toContain('awaiting manual review (n = 3)')
    expect(text(m.sought.lines)).toContain('(n = 20)')
    expect(text(m.notRetrieved.lines)).toContain('(n = 2)')
    // Assessed = sought - pending - not retrieved.
    expect(text(m.assessed.lines)).toContain('(n = 16)')
    expect(text(m.reportsExcluded.lines)).toContain('(n = 6)')
    expect(text(m.included.lines)).toContain('Studies included in review (n = 8)')
    expect(text(m.included.lines)).toContain('Reports of included studies (n = 9)')
  })

  it('shows citation searching as another-methods input only when snowball records exist', () => {
    expect(buildPrismaBoxes(flow()).otherMethods).not.toBeNull()
    const none = buildPrismaBoxes(flow({ retrievedBySource: { PubMed: 120 } }))
    expect(none.otherMethods).toBeNull()
    expect(text(none.identified.lines)).toContain('Databases (n = 120)')
  })

  it('says "not recorded" rather than inventing fields an older API omits', () => {
    const m = buildPrismaBoxes(flow({ fullTextNotRetrieved: undefined, includedStudies: undefined }))
    expect(text(m.notRetrieved.lines)).toContain(NOT_RECORDED)
    expect(text(m.included.lines)).toContain('Studies included in review (n = 9)')
    expect(text(m.included.lines)).toContain('distinct studies not recorded')
  })

  it('reports records added after the last deduplication run', () => {
    const m = buildPrismaBoxes(flow({ readyForScreening: 98 }))
    expect(m.notes.join(' ')).toContain('5 record(s) were added after deduplication')
  })
})

describe('layoutPrisma', () => {
  for (const [name, f] of [['with other methods', flow()], ['databases only', flow({ retrievedBySource: { PubMed: 120 } })]] as const) {
    it(`keeps every line readable and inside its box (${name})`, () => {
      const layout = layoutPrisma(buildPrismaBoxes(f))
      expect(layout.phases.map(p => p.label)).toEqual(['Identification', 'Screening', 'Included'])
      for (const box of layout.boxes) {
        expect(box.x + box.width).toBeLessThanOrEqual(layout.width)
        for (const line of box.lines) {
          expect(line.fontSize).toBeGreaterThanOrEqual(MIN_SVG_FONT_SIZE)
          const w = estimateTextWidth(line.text, line.fontSize, line.bold)
          const left = line.anchor === 'middle' ? line.x - w / 2 : line.x
          expect(left).toBeGreaterThanOrEqual(box.x)
          expect(left + w).toBeLessThanOrEqual(box.x + box.width)
          expect(line.y).toBeGreaterThan(box.y)
          expect(line.y).toBeLessThanOrEqual(box.y + box.height)
        }
      }
      for (const p of layout.phases) {
        expect(estimateTextWidth(p.label, 13, true)).toBeLessThanOrEqual(p.height)
      }
      // Boxes never overlap.
      for (const a of layout.boxes) for (const b of layout.boxes) {
        if (a === b) continue
        const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
        expect(overlap).toBe(false)
      }
    })
  }

  it('lays out 5 main boxes with 4 side boxes and connecting arrows', () => {
    const layout = layoutPrisma(buildPrismaBoxes(flow({ retrievedBySource: { PubMed: 120 } })))
    expect(layout.boxes).toHaveLength(9)
    expect(layout.arrows).toHaveLength(4 + 4)
  })
})
