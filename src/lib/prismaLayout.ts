import type { PrismaFlow } from '../types/systematicReview'
import { estimateTextWidth, wrapText } from './svgText'

// PRISMA 2020 flow diagram, "new systematic reviews which included searches of databases and
// registers only" template, built from the review's PrismaFlow counts.
//
// Two steps, both pure so they can be tested without a DOM:
//   1. buildPrismaBoxes: decide what each box SAYS, mapping API fields to PRISMA boxes. Nothing is
//      invented: a PRISMA box the data has no field for says "not recorded".
//   2. layoutPrisma: decide where each box GOES, wrapping its text to the box width.

/**
 * Fields the API (PrismaFlowDto) sends that the shared PrismaFlow type does not declare yet. All
 * optional: an older API simply omits them and the diagram says "not recorded".
 */
export interface PrismaFlowExtended extends PrismaFlow {
  fullTextNotRetrieved?: number
  includedStudies?:      number | null
  countsSource?:         string
}

export type PrismaLineKind = 'heading' | 'count' | 'detail' | 'muted'

export interface PrismaLine {
  text: string
  kind: PrismaLineKind
}

export type PrismaBoxId =
  | 'identified' | 'otherMethods' | 'removed'
  | 'screened' | 'excluded'
  | 'sought' | 'notRetrieved'
  | 'assessed' | 'reportsExcluded'
  | 'included'

export interface PrismaBox {
  id:    PrismaBoxId
  lines: PrismaLine[]
}

export interface PrismaModel {
  identified:      PrismaBox
  removed:         PrismaBox
  otherMethods:    PrismaBox | null
  screened:        PrismaBox
  excluded:        PrismaBox
  sought:          PrismaBox
  notRetrieved:    PrismaBox
  assessed:        PrismaBox
  reportsExcluded: PrismaBox
  included:        PrismaBox
  notes:           string[]
}

/** Sources that are trial registers rather than bibliographic databases. */
const REGISTER_SOURCES = new Set(['clinicaltrials.gov', 'ictrp', 'who ictrp', 'isrctn', 'eu ctr'])
/** Citation chaining (backward/forward snowballing) lands imported papers under this source. */
const SNOWBALL_SOURCE = 'snowball'

export const NOT_RECORDED = 'not recorded'

const n = (value: number) => `(n = ${value.toLocaleString('en-US')})`

export interface IdentificationCounts {
  databases:         number
  registers:         number
  otherMethods:      number
  databaseSources:   [string, number][]
  registerSources:   [string, number][]
}

/** Splits retrievedBySource into databases, registers and citation searching (other methods). */
export function splitIdentification(flow: PrismaFlow): IdentificationCounts {
  const entries = Object.entries(flow.retrievedBySource ?? {}).filter(([, count]) => count > 0)
  const databaseSources: [string, number][] = []
  const registerSources: [string, number][] = []
  let otherMethods = 0
  for (const [source, count] of entries) {
    const key = source.trim().toLowerCase()
    if (key === SNOWBALL_SOURCE) otherMethods += count
    else if (REGISTER_SOURCES.has(key)) registerSources.push([source, count])
    else databaseSources.push([source, count])
  }
  databaseSources.sort((a, b) => b[1] - a[1])
  registerSources.sort((a, b) => b[1] - a[1])
  const registers = registerSources.reduce((s, [, c]) => s + c, 0)
  // Retrieved is the count of every imported paper, which is exactly what retrievedBySource
  // groups, so databases is the remainder. Clamped in case an older API sent a partial breakdown.
  const databases = Math.max(0, flow.retrieved - registers - otherMethods)
  return { databases, registers, otherMethods, databaseSources, registerSources }
}

export function buildPrismaBoxes(flow: PrismaFlowExtended): PrismaModel {
  const id = splitIdentification(flow)
  const notes: string[] = []

  // ── Identification ─────────────────────────────────────────────────────────
  const identifiedLines: PrismaLine[] = [
    { text: 'Records identified from:', kind: 'heading' },
    { text: `Databases ${n(id.databases)}`, kind: 'count' },
    ...id.databaseSources.map(([src, c]): PrismaLine => ({ text: `${src} ${n(c)}`, kind: 'detail' })),
    { text: `Registers ${n(id.registers)}`, kind: 'count' },
    ...id.registerSources.map(([src, c]): PrismaLine => ({ text: `${src} ${n(c)}`, kind: 'detail' })),
  ]

  const duplicates = flow.duplicatesRemovedByDoi + flow.duplicatesRemovedByTitle
  const otherReasons = flow.excludedWithoutAbstract + flow.excludedByPublicationDate + flow.excludedByCitationThreshold
  const removedLines: PrismaLine[] = [
    { text: 'Records removed before screening:', kind: 'heading' },
    { text: `Duplicate records removed ${n(duplicates)}`, kind: 'count' },
  ]
  if (flow.duplicatesRemovedByDoi > 0 && flow.duplicatesRemovedByTitle > 0) {
    removedLines.push(
      { text: `By identifier (DOI, PubMed, OpenAlex) ${n(flow.duplicatesRemovedByDoi)}`, kind: 'detail' },
      { text: `By title ${n(flow.duplicatesRemovedByTitle)}`, kind: 'detail' },
    )
  }
  removedLines.push({ text: `Records removed for other reasons ${n(otherReasons)}`, kind: 'count' })
  if (flow.excludedWithoutAbstract > 0) removedLines.push({ text: `No abstract ${n(flow.excludedWithoutAbstract)}`, kind: 'detail' })
  if (flow.excludedByPublicationDate > 0) removedLines.push({ text: `Outside date range ${n(flow.excludedByPublicationDate)}`, kind: 'detail' })
  if (flow.excludedByCitationThreshold > 0) removedLines.push({ text: `Below citation threshold ${n(flow.excludedByCitationThreshold)}`, kind: 'detail' })

  // The stored deduplication run and the live pool can disagree when papers were fetched after
  // deduplication last ran. Say so rather than letting the boxes silently fail to add up.
  const expectedPool = flow.retrieved - duplicates - otherReasons
  const unclassified = flow.readyForScreening - expectedPool
  if (unclassified > 0) {
    notes.push(`${unclassified.toLocaleString('en-US')} record(s) were added after deduplication last ran and have not been deduplicated yet.`)
  }

  const otherMethods: PrismaBox | null = id.otherMethods > 0
    ? {
        id: 'otherMethods',
        lines: [
          { text: 'Records identified from other methods:', kind: 'heading' },
          { text: `Citation searching ${n(id.otherMethods)}`, kind: 'count' },
        ],
      }
    : null
  if (otherMethods) {
    notes.push('Records from citation searching were deduplicated and screened together with database records, so the counts below combine both.')
  }

  // ── Screening: title/abstract ──────────────────────────────────────────────
  // titleAbstractScreened is the POOL size (see PrismaFlowLogic); only pool minus pending was
  // actually screened, so that is the number the "Records screened" box states.
  const taPool = flow.titleAbstractScreened
  const taScreened = Math.max(0, taPool - flow.titleAbstractPending)
  const screenedLines: PrismaLine[] = [{ text: 'Records screened', kind: 'heading' }]
  if (taPool === 0) {
    screenedLines.push({ text: `${n(0)}`, kind: 'count' }, { text: 'Title/abstract screening not yet run', kind: 'muted' })
  } else {
    screenedLines.push({ text: n(taScreened), kind: 'count' })
    if (flow.titleAbstractPending > 0) {
      screenedLines.push(
        { text: `Not yet screened ${n(flow.titleAbstractPending)}`, kind: 'muted' },
        { text: `Screening pool ${n(taPool)}`, kind: 'muted' },
      )
    }
  }

  const excludedLines: PrismaLine[] = [
    { text: 'Records excluded', kind: 'heading' },
    { text: n(flow.titleAbstractExcluded), kind: 'count' },
  ]
  if (flow.titleAbstractNeedsManualReview > 0) {
    excludedLines.push({ text: `Unresolved, awaiting manual review ${n(flow.titleAbstractNeedsManualReview)}`, kind: 'muted' })
  }

  // ── Screening: full text ───────────────────────────────────────────────────
  const ftPool = flow.fullTextAssessed
  const soughtLines: PrismaLine[] = [
    { text: 'Reports sought for retrieval', kind: 'heading' },
    { text: n(ftPool), kind: 'count' },
  ]
  if (ftPool === 0 && flow.titleAbstractIncluded > 0) {
    soughtLines.push({ text: `Full-text stage not yet run (${flow.titleAbstractIncluded.toLocaleString('en-US')} records included at title/abstract)`, kind: 'muted' })
  }

  const notRetrieved = flow.fullTextNotRetrieved
  const notRetrievedLines: PrismaLine[] = [{ text: 'Reports not retrieved', kind: 'heading' }]
  if (notRetrieved === undefined) {
    notRetrievedLines.push({ text: NOT_RECORDED, kind: 'muted' })
  } else {
    notRetrievedLines.push({ text: n(notRetrieved), kind: 'count' })
  }
  if (flow.fullTextNeedsPdf > 0) {
    notRetrievedLines.push({ text: `Still awaiting full text (PDF) ${n(flow.fullTextNeedsPdf)}`, kind: 'muted' })
  }

  const ftAssessed = Math.max(0, ftPool - flow.fullTextPending - (notRetrieved ?? 0))
  const assessedLines: PrismaLine[] = [
    { text: 'Reports assessed for eligibility', kind: 'heading' },
    { text: n(ftAssessed), kind: 'count' },
  ]
  if (flow.fullTextPending > 0) {
    assessedLines.push({ text: `Not yet assessed ${n(flow.fullTextPending)}`, kind: 'muted' })
  }

  const reportsExcludedLines: PrismaLine[] = [
    { text: 'Reports excluded', kind: 'heading' },
    { text: n(flow.fullTextExcluded), kind: 'count' },
  ]
  if (flow.fullTextExcluded > 0) {
    reportsExcludedLines.push({ text: `Reasons: ${NOT_RECORDED} in this export`, kind: 'muted' })
  }
  if (flow.fullTextNeedsManualReview > 0) {
    reportsExcludedLines.push({ text: `Unresolved, awaiting manual review ${n(flow.fullTextNeedsManualReview)}`, kind: 'muted' })
  }

  // ── Included ───────────────────────────────────────────────────────────────
  const includedLines: PrismaLine[] = []
  if (flow.includedStudies !== undefined && flow.includedStudies !== null) {
    includedLines.push(
      { text: `Studies included in review ${n(flow.includedStudies)}`, kind: 'heading' },
      { text: `Reports of included studies ${n(flow.fullTextIncluded)}`, kind: 'count' },
    )
  } else {
    includedLines.push(
      { text: `Studies included in review ${n(flow.fullTextIncluded)}`, kind: 'heading' },
      { text: `Reports of included studies ${n(flow.fullTextIncluded)}`, kind: 'count' },
      { text: 'Counted per report; distinct studies not recorded', kind: 'muted' },
    )
  }

  return {
    identified:      { id: 'identified', lines: identifiedLines },
    removed:         { id: 'removed', lines: removedLines },
    otherMethods,
    screened:        { id: 'screened', lines: screenedLines },
    excluded:        { id: 'excluded', lines: excludedLines },
    sought:          { id: 'sought', lines: soughtLines },
    notRetrieved:    { id: 'notRetrieved', lines: notRetrievedLines },
    assessed:        { id: 'assessed', lines: assessedLines },
    reportsExcluded: { id: 'reportsExcluded', lines: reportsExcludedLines },
    included:        { id: 'included', lines: includedLines },
    notes,
  }
}

// ── Layout ───────────────────────────────────────────────────────────────────

export const PRISMA_FONT = {
  heading: 12,
  count:   12,
  detail:  11,
  muted:   11,
  phase:   13,
  note:    11,
} as const

const LINE_GAP = 1.35
const PAD_X = 10
const PAD_Y = 9

export interface LaidOutLine {
  text:     string
  kind:     PrismaLineKind
  x:        number
  y:        number   // baseline
  fontSize: number
  bold:     boolean
  anchor:   'start' | 'middle'
}

export interface LaidOutBox {
  id:     PrismaBoxId
  x:      number
  y:      number
  width:  number
  height: number
  lines:  LaidOutLine[]
}

export interface PrismaArrow {
  points: [number, number][]
}

export interface PrismaPhase {
  label: string
  x:     number
  y:     number
  width: number
  height: number
}

export interface PrismaLayout {
  width:   number
  height:  number
  boxes:   LaidOutBox[]
  arrows:  PrismaArrow[]
  phases:  PrismaPhase[]
  notes:   LaidOutLine[]
}

const MARGIN = 16
const PHASE_W = 30
const PHASE_GAP = 14
const MAIN_W = 300
const SIDE_W = 300
const COL_GAP = 56
const ROW_GAP = 34
const PHASE_SEP = 10

function wrapBox(box: PrismaBox, width: number, centred: boolean): { lines: Omit<LaidOutLine, 'x' | 'y'>[]; height: number } {
  const inner = width - PAD_X * 2
  const out: Omit<LaidOutLine, 'x' | 'y'>[] = []
  for (const line of box.lines) {
    const fontSize = PRISMA_FONT[line.kind]
    const bold = line.kind === 'heading'
    // Detail lines are indented under their count line.
    const indent = line.kind === 'detail' && !centred ? 12 : 0
    for (const text of wrapText(line.text, inner - indent, fontSize, bold)) {
      out.push({ text, kind: line.kind, fontSize, bold, anchor: centred ? 'middle' : 'start' })
    }
  }
  const height = PAD_Y * 2 + out.reduce((s, l) => s + l.fontSize * LINE_GAP, 0)
  return { lines: out, height }
}

function place(box: PrismaBox, x: number, y: number, width: number, height: number, wrapped: ReturnType<typeof wrapBox>, centred: boolean): LaidOutBox {
  // Vertically centre the text block inside a box that may be taller than its own content.
  let cursor = y + (height - (wrapped.height - PAD_Y * 2)) / 2
  const lines = wrapped.lines.map(l => {
    const lh = l.fontSize * LINE_GAP
    const baseline = cursor + lh * 0.75
    cursor += lh
    const indent = l.kind === 'detail' && !centred ? 12 : 0
    return { ...l, x: centred ? x + width / 2 : x + PAD_X + indent, y: baseline }
  })
  return { id: box.id, x, y, width, height, lines }
}

export function layoutPrisma(model: PrismaModel): PrismaLayout {
  const mainX = MARGIN + PHASE_W + PHASE_GAP
  const sideX = mainX + MAIN_W + COL_GAP
  const otherX = sideX + SIDE_W + COL_GAP
  const width = (model.otherMethods ? otherX + MAIN_W : sideX + SIDE_W) + MARGIN

  const boxes: LaidOutBox[] = []
  const arrows: PrismaArrow[] = []
  const rowSpans: { top: number; bottom: number }[] = []

  type Row = { main: PrismaBox; side: PrismaBox | null; other?: PrismaBox | null }
  const rows: Row[] = [
    { main: model.identified, side: model.removed, other: model.otherMethods },
    { main: model.screened, side: model.excluded },
    { main: model.sought, side: model.notRetrieved },
    { main: model.assessed, side: model.reportsExcluded },
    { main: model.included, side: null },
  ]
  // Identification | Screening (rows 1-3) | Included
  const phaseOfRow = [0, 1, 1, 1, 2]
  const phaseLabels = ['Identification', 'Screening', 'Included']
  // A phase made of one row must still be tall enough for its rotated label.
  const minRowHeight = (i: number) => {
    const single = phaseOfRow.filter(p => p === phaseOfRow[i]).length === 1
    return single ? estimateTextWidth(phaseLabels[phaseOfRow[i]], PRISMA_FONT.phase, true) + 20 : 52
  }

  let y = MARGIN
  const mainBoxes: LaidOutBox[] = []
  rows.forEach((row, i) => {
    if (i > 0 && phaseOfRow[i] !== phaseOfRow[i - 1]) y += PHASE_SEP
    const mainCentred = row.main.id !== 'identified'
    const mw = wrapBox(row.main, MAIN_W, mainCentred)
    const sw = row.side ? wrapBox(row.side, SIDE_W, false) : null
    const ow = row.other ? wrapBox(row.other, MAIN_W, false) : null
    // Main and side boxes in a row share a height so the connecting arrow meets both mid-edge.
    const h = Math.max(mw.height, sw?.height ?? 0, ow?.height ?? 0, minRowHeight(i))
    const main = place(row.main, mainX, y, MAIN_W, h, mw, mainCentred)
    boxes.push(main)
    mainBoxes.push(main)
    if (row.side && sw) {
      boxes.push(place(row.side, sideX, y, SIDE_W, h, sw, false))
      arrows.push({ points: [[mainX + MAIN_W, y + h / 2], [sideX, y + h / 2]] })
    }
    if (row.other && ow) {
      boxes.push(place(row.other, otherX, y, MAIN_W, h, ow, false))
    }
    rowSpans.push({ top: y, bottom: y + h })
    y += h + ROW_GAP
  })

  const midX = mainX + MAIN_W / 2
  for (let i = 0; i < mainBoxes.length - 1; i++) {
    const a = mainBoxes[i]
    const b = mainBoxes[i + 1]
    arrows.push({ points: [[midX, a.y + a.height], [midX, b.y]] })
  }
  if (model.otherMethods) {
    // Other-methods records join the main flow in the gap below the identification row: down,
    // across (through empty space beneath the "removed" box), and into "Records screened".
    const other = boxes.find(b => b.id === 'otherMethods')!
    const joinY = rowSpans[0].bottom + (rowSpans[1].top - rowSpans[0].bottom) / 2
    arrows.push({ points: [[other.x + other.width / 2, other.y + other.height], [other.x + other.width / 2, joinY], [midX + 14, joinY], [midX + 14, rowSpans[1].top]] })
  }

  const phases: PrismaPhase[] = phaseLabels.map((label, p) => {
    const spans = rowSpans.filter((_, i) => phaseOfRow[i] === p)
    const top = spans[0].top
    const bottom = spans[spans.length - 1].bottom
    return { label, x: MARGIN, y: top, width: PHASE_W, height: bottom - top }
  })

  let height = y - ROW_GAP + MARGIN
  const notes: LaidOutLine[] = []
  if (model.notes.length > 0) {
    height += 4
    for (const note of model.notes) {
      for (const text of wrapText(note, width - MARGIN * 2, PRISMA_FONT.note)) {
        height += PRISMA_FONT.note * LINE_GAP
        notes.push({ text, kind: 'muted', x: MARGIN, y: height - PRISMA_FONT.note * 0.35, fontSize: PRISMA_FONT.note, bold: false, anchor: 'start' })
      }
    }
    height += MARGIN / 2
  }

  return { width, height, boxes, arrows, phases, notes }
}
