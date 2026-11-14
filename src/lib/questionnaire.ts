// Types and editing helpers for the Study Design questionnaire builder. Every check shown to the student is run on
// the server; nothing here judges a questionnaire. These helpers only change the document the student is editing.

export interface ScalePoint { value: number; label: string }
export interface QuestionnaireScale { id: string; name: string; anchors: ScalePoint[]; missingCodes: ScalePoint[] }
export interface QuestionnaireConstruct { id: string; name: string; definition: string; objectiveNumbers: number[] }
export type ItemRole = 'Scale' | 'Demographic' | 'Screening' | 'OpenText'
export interface QuestionnaireItem {
  id: string
  text: string
  role: ItemRole
  constructId: string | null
  scaleId: string | null
  variableName: string
  reverseCoded: boolean
  required: boolean
  options: ScalePoint[]
}
export interface QuestionnaireDocument {
  schemaVersion: number
  title: string
  instructions: string
  objectives: string[]
  scales: QuestionnaireScale[]
  constructs: QuestionnaireConstruct[]
  items: QuestionnaireItem[]
}
export interface QuestionnaireFinding { code: string; severity: 'error' | 'warning' | 'info'; message: string; itemIds: string[]; constructId?: string | null; scaleId?: string | null }
export interface QuestionnaireReport { findings: QuestionnaireFinding[]; itemCount: number; scaleItemCount: number; estimatedMinutes: number; canExport: boolean }
export interface QuestionnaireDto {
  id: string | null
  projectId: string | null
  version: number
  updatedAt: string | null
  contentValidityReviewedAt: string | null
  contentValidityNote: string | null
  pilotedAt: string | null
  pilotNote: string | null
  /** The draft label, worded by the server. Shown on the page and carried by every export. */
  banner: string
  document: QuestionnaireDocument
  report: QuestionnaireReport
}

export const emptyDocument = (): QuestionnaireDocument => ({ schemaVersion: 1, title: '', instructions: '', objectives: [], scales: [], constructs: [], items: [] })

let counter = 0
/** A short id that is unique within the document being edited. */
export function newId(prefix: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  let id = ''
  do { counter += 1; id = `${prefix}${Date.now().toString(36)}${counter.toString(36)}` } while (used.has(id))
  return id
}

/**
 * Generic response-scale anchors a student can start from and edit. They are ordinary wording, not taken from any
 * published instrument.
 */
export const SCALE_PRESETS: { key: string; name: string; labels: string[] }[] = [
  { key: 'agree5', name: 'Agreement (5 points)', labels: ['Strongly disagree', 'Disagree', 'Neither agree nor disagree', 'Agree', 'Strongly agree'] },
  { key: 'agree7', name: 'Agreement (7 points)', labels: ['Strongly disagree', 'Disagree', 'Somewhat disagree', 'Neither agree nor disagree', 'Somewhat agree', 'Agree', 'Strongly agree'] },
  { key: 'freq5', name: 'Frequency (5 points)', labels: ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'] },
  { key: 'blank', name: 'Blank scale', labels: ['', ''] },
]

export function scaleFromPreset(key: string, doc: QuestionnaireDocument): QuestionnaireScale {
  const preset = SCALE_PRESETS.find(p => p.key === key) ?? SCALE_PRESETS[0]
  return { id: newId('s', doc.scales.map(s => s.id)), name: preset.key === 'blank' ? '' : preset.name, anchors: preset.labels.map((label, i) => ({ value: i + 1, label })), missingCodes: [] }
}

/** Letters and digits of the first words, lower case: "Academic writing self-efficacy" -> "awse". */
export function abbreviation(name: string): string {
  const letters = (name.match(/[\p{L}\p{N}]+/gu) ?? []).map(w => w[0]).join('').toLowerCase().replace(/[^a-z0-9]/g, '')
  return /^[a-z]/.test(letters) ? letters.slice(0, 8) : ''
}

/** The next free variable name for a stem: awse_1, awse_2, ... Never one already used in the document. */
export function suggestVariableName(stem: string, doc: QuestionnaireDocument): string {
  const base = stem || 'item'
  const taken = new Set(doc.items.map(i => i.variableName.toLowerCase()))
  for (let n = 1; n < 1000; n++) if (!taken.has(`${base}_${n}`)) return `${base}_${n}`
  return `${base}_${Date.now()}`
}

export function addScaleItem(doc: QuestionnaireDocument, constructId: string): QuestionnaireDocument {
  const construct = doc.constructs.find(c => c.id === constructId)
  const siblings = doc.items.filter(i => i.role === 'Scale' && i.constructId === constructId)
  const item: QuestionnaireItem = {
    id: newId('i', doc.items.map(i => i.id)), text: '', role: 'Scale', constructId, scaleId: siblings[0]?.scaleId ?? doc.scales[0]?.id ?? null,
    variableName: suggestVariableName(abbreviation(construct?.name ?? ''), doc), reverseCoded: false, required: true, options: [],
  }
  // Keep a construct's items together: insert after its last item.
  const last = doc.items.map(i => i.id).lastIndexOf(siblings[siblings.length - 1]?.id ?? '')
  const items = [...doc.items]
  items.splice(last >= 0 ? last + 1 : items.length, 0, item)
  return { ...doc, items }
}

export function addOtherItem(doc: QuestionnaireDocument, role: Exclude<ItemRole, 'Scale'>): QuestionnaireDocument {
  const stem = role === 'Demographic' ? 'demo' : role === 'Screening' ? 'screen' : 'open'
  const item: QuestionnaireItem = { id: newId('i', doc.items.map(i => i.id)), text: '', role, constructId: null, scaleId: null, variableName: suggestVariableName(stem, doc), reverseCoded: false, required: false, options: [] }
  return { ...doc, items: [...doc.items, item] }
}

export const updateItem = (doc: QuestionnaireDocument, id: string, patch: Partial<QuestionnaireItem>): QuestionnaireDocument =>
  ({ ...doc, items: doc.items.map(i => (i.id === id ? { ...i, ...patch } : i)) })

/** Sets the response scale for every item in a construct, since items scored together must share one. */
export const setConstructScale = (doc: QuestionnaireDocument, constructId: string, scaleId: string | null): QuestionnaireDocument =>
  ({ ...doc, items: doc.items.map(i => (i.role === 'Scale' && i.constructId === constructId ? { ...i, scaleId } : i)) })

/** Moves an item one place up or down among the items of its own construct (or among the other items). */
export function moveItem(doc: QuestionnaireDocument, id: string, direction: -1 | 1): QuestionnaireDocument {
  const item = doc.items.find(i => i.id === id)
  if (!item) return doc
  const group = doc.items.filter(i => (item.role === 'Scale' ? i.role === 'Scale' && i.constructId === item.constructId : i.role !== 'Scale'))
  const position = group.findIndex(i => i.id === id)
  const neighbour = group[position + direction]
  if (!neighbour) return doc
  const items = [...doc.items]
  const a = items.findIndex(i => i.id === id)
  const b = items.findIndex(i => i.id === neighbour.id)
  ;[items[a], items[b]] = [items[b], items[a]]
  return { ...doc, items }
}

/** Removing a construct removes its items; removing a scale leaves its items without one, which the checks report. */
export const removeConstruct = (doc: QuestionnaireDocument, id: string): QuestionnaireDocument =>
  ({ ...doc, constructs: doc.constructs.filter(c => c.id !== id), items: doc.items.filter(i => !(i.role === 'Scale' && i.constructId === id)) })

export const removeScale = (doc: QuestionnaireDocument, id: string): QuestionnaireDocument =>
  ({ ...doc, scales: doc.scales.filter(s => s.id !== id), items: doc.items.map(i => (i.scaleId === id ? { ...i, scaleId: null } : i)) })

/** Removing an objective renumbers the links that pointed past it, so constructs stay linked to the same text. */
export function removeObjective(doc: QuestionnaireDocument, index: number): QuestionnaireDocument {
  const number = index + 1
  return {
    ...doc,
    objectives: doc.objectives.filter((_, i) => i !== index),
    constructs: doc.constructs.map(c => ({ ...c, objectiveNumbers: c.objectiveNumbers.filter(n => n !== number).map(n => (n > number ? n - 1 : n)) })),
  }
}

export const countBySeverity = (report: QuestionnaireReport | null) => ({
  error: report?.findings.filter(f => f.severity === 'error').length ?? 0,
  warning: report?.findings.filter(f => f.severity === 'warning').length ?? 0,
  info: report?.findings.filter(f => f.severity === 'info').length ?? 0,
})
