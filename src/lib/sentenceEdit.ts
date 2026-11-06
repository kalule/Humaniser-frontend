// Sentence-level editing of a humanised result.
//
// The output is split into sentences and the whitespace between them ("gaps"), so any edit changes one sentence and
// nothing else: composing the pieces again reproduces the text exactly. Each output sentence is aligned to the
// author's own sentence it came from, which is what "Restore original" puts back and what alternatives are checked
// against on the server. Alignment is best effort: a sentence with no match has no original to restore.

export type SentenceStatus = 'unchanged' | 'modified' | 'accepted' | 'restored'

export interface GapPiece { kind: 'gap'; text: string }
export interface SentencePiece {
  kind: 'sentence'
  id: string
  /** What is in the output now. */
  text: string
  /** The author's sentence this one came from, or null when no counterpart could be found. */
  original: string | null
  status: SentenceStatus
}
export type Piece = GapPiece | SentencePiece
export interface SentenceModel { pieces: Piece[] }

interface Token { kind: 'gap' | 'sentence'; text: string }

// ── Splitting ────────────────────────────────────────────────────────────────

// A full stop after one of these does not end a sentence. Initials (a single capital letter) are handled separately.
const ABBREVIATIONS = new Set([
  'e.g', 'i.e', 'et al', 'al', 'vs', 'cf', 'dr', 'mr', 'mrs', 'ms', 'prof', 'fig', 'figs', 'eq', 'eqs',
  'vol', 'vols', 'pp', 'p', 'ed', 'eds', 'approx', 'ca',
])

function startsSentence(text: string, at: number): boolean {
  return /^["'“‘(\[]*[A-Z0-9À-ÖØ-Þ]/.test(text.slice(at, at + 6))
}

function endsWithAbbreviation(soFar: string): boolean {
  const m = /(?:^|[\s(])((?:[A-Za-z]\.)*[A-Za-z]+)\.$/.exec(soFar)
  if (!m) return false
  return ABBREVIATIONS.has(m[1].toLowerCase()) || /^[A-Z]$/.test(m[1])
}

/**
 * Splits text into sentences and gaps. A line break always ends a sentence (so a heading directly above a paragraph is
 * its own sentence). Concatenating every token's text gives back the input exactly.
 */
export function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  const n = text.length
  let i = 0
  while (i < n && /\s/.test(text[i])) i++
  if (i > 0) tokens.push({ kind: 'gap', text: text.slice(0, i) })
  let start = i

  const pushSentence = (end: number) => { if (end > start) tokens.push({ kind: 'sentence', text: text.slice(start, end) }) }

  while (i < n) {
    const c = text[i]
    if (c === '\n' || c === '\r') {
      let end = i
      while (end > start && /[ \t]/.test(text[end - 1])) end--
      pushSentence(end)
      let k = i
      while (k < n && /\s/.test(text[k])) k++
      tokens.push({ kind: 'gap', text: text.slice(end, k) })
      i = k
      start = k
      continue
    }
    if (c === '.' || c === '!' || c === '?') {
      let j = i + 1
      while (j < n && /[.!?]/.test(text[j])) j++
      const singleStop = c === '.' && j === i + 1
      while (j < n && /["'”’)\]]/.test(text[j])) j++
      if (j < n && /[ \t]/.test(text[j])) {
        let k = j
        while (k < n && /[ \t]/.test(text[k])) k++
        const abbreviation = singleStop && endsWithAbbreviation(text.slice(start, i + 1))
        if (k < n && startsSentence(text, k) && !abbreviation) {
          pushSentence(j)
          tokens.push({ kind: 'gap', text: text.slice(j, k) })
          i = k
          start = k
          continue
        }
      }
      i = j
      continue
    }
    i++
  }

  let end = n
  while (end > start && /\s/.test(text[end - 1])) end--
  pushSentence(end)
  if (end < n) tokens.push({ kind: 'gap', text: text.slice(end) })
  return tokens
}

const sentencesOf = (text: string) => tokenize(text).filter((t) => t.kind === 'sentence').map((t) => t.text)

export function sameText(a: string, b: string): boolean {
  return a.replace(/\s+/g, ' ').trim() === b.replace(/\s+/g, ' ').trim()
}

// ── Alignment ────────────────────────────────────────────────────────────────

const MIN_MATCH = 0.2
// Above this many cells the quadratic alignment is skipped; sentences are then paired by position only when the counts match.
const MAX_CELLS = 4_000_000

function contentWords(s: string): Set<string> {
  const words = s.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? []
  return new Set(words.filter((w) => w.length > 2 || /\d/.test(w)))
}

function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  let shared = 0
  for (const w of a) if (b.has(w)) shared++
  const union = a.size + b.size - shared
  return union === 0 ? 0 : shared / union
}

/** For each output sentence, the author's sentence it most plausibly came from (in order), or null. */
export function alignSentences(originals: string[], outputs: string[]): Array<string | null> {
  const n = originals.length
  const m = outputs.length
  if (n === 0 || m === 0) return outputs.map(() => null)

  if (n * m > MAX_CELLS) return outputs.map((_, j) => (n === m ? originals[j] : null))

  const ow = originals.map(contentWords)
  const nw = outputs.map(contentWords)
  const score = Array.from({ length: n + 1 }, () => new Float64Array(m + 1))
  const sim = (i: number, j: number) => (sameText(originals[i], outputs[j]) ? 1 : similarity(ow[i], nw[j]))

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const s = sim(i - 1, j - 1)
      const match = s >= MIN_MATCH ? score[i - 1][j - 1] + s : -Infinity
      score[i][j] = Math.max(score[i - 1][j], score[i][j - 1], match)
    }
  }

  const result: Array<string | null> = outputs.map(() => null)
  let i = n
  let j = m
  while (i > 0 && j > 0) {
    const s = sim(i - 1, j - 1)
    if (s >= MIN_MATCH && score[i][j] === score[i - 1][j - 1] + s) {
      result[j - 1] = originals[i - 1]
      i--
      j--
    } else if (score[i][j] === score[i - 1][j]) {
      i--
    } else {
      j--
    }
  }
  return result
}

// ── Model ────────────────────────────────────────────────────────────────────

export function buildModel(originalText: string, outputText: string): SentenceModel {
  const aligned = alignSentences(sentencesOf(originalText), sentencesOf(outputText))
  let sentenceIndex = 0
  const pieces: Piece[] = tokenize(outputText).map((t): Piece => {
    if (t.kind === 'gap') return { kind: 'gap', text: t.text }
    const original = aligned[sentenceIndex] ?? null
    const id = `s${sentenceIndex++}`
    const status: SentenceStatus = original !== null && sameText(original, t.text) ? 'unchanged' : 'modified'
    return { kind: 'sentence', id, text: t.text, original, status }
  })
  return { pieces }
}

export const modelText = (model: SentenceModel): string => model.pieces.map((p) => p.text).join('')

export const sentences = (model: SentenceModel): SentencePiece[] =>
  model.pieces.filter((p): p is SentencePiece => p.kind === 'sentence')

function update(model: SentenceModel, id: string, change: (p: SentencePiece) => SentencePiece): SentenceModel {
  return { pieces: model.pieces.map((p) => (p.kind === 'sentence' && p.id === id ? change(p) : p)) }
}

/** Puts new wording into one sentence. Line breaks are flattened so the document layout cannot change. */
export function replaceSentence(model: SentenceModel, id: string, text: string): SentenceModel {
  const clean = text.replace(/\s*[\r\n]+\s*/g, ' ').trim()
  if (!clean) return model
  return update(model, id, (p) => ({ ...p, text: clean, status: p.original !== null && sameText(p.original, clean) ? 'restored' : 'modified' }))
}

/** Marks a change as reviewed and kept. Only a modified sentence has anything to accept. */
export function acceptSentence(model: SentenceModel, id: string): SentenceModel {
  return update(model, id, (p) => (p.status === 'modified' ? { ...p, status: 'accepted' } : p))
}

/** Puts the author's own sentence back. Does nothing when no original could be matched. */
export function restoreSentence(model: SentenceModel, id: string): SentenceModel {
  return update(model, id, (p) => (p.original === null || sameText(p.text, p.original) ? p : { ...p, text: p.original, status: 'restored' }))
}

export function restoreAll(model: SentenceModel): SentenceModel {
  return { pieces: model.pieces.map((p) => (p.kind === 'sentence' && p.original !== null && !sameText(p.text, p.original) ? { ...p, text: p.original, status: 'restored' as const } : p)) }
}

export interface SentenceCounts { total: number; changed: number; accepted: number; restored: number }

export function countSentences(model: SentenceModel): SentenceCounts {
  const all = sentences(model)
  return {
    total: all.length,
    changed: all.filter((s) => s.status === 'modified' || s.status === 'accepted').length,
    accepted: all.filter((s) => s.status === 'accepted').length,
    restored: all.filter((s) => s.status === 'restored').length,
  }
}

const isParagraphBreak = (gap: string) => (gap.match(/\n/g)?.length ?? 0) >= 2

/**
 * The paragraph a sentence sits in, as plain text, for the model to read the sentence in context. A single line break
 * (a heading above its paragraph) does not end the paragraph. Capped at maxChars around the sentence.
 */
export function paragraphContext(model: SentenceModel, id: string, maxChars = 3000): string {
  const idx = model.pieces.findIndex((p) => p.kind === 'sentence' && p.id === id)
  if (idx < 0) return ''
  let from = idx
  let to = idx
  while (from > 0 && !(model.pieces[from - 1].kind === 'gap' && isParagraphBreak(model.pieces[from - 1].text))) from--
  while (to < model.pieces.length - 1 && !(model.pieces[to + 1].kind === 'gap' && isParagraphBreak(model.pieces[to + 1].text))) to++

  const text = (a: number, b: number) => model.pieces.slice(a, b + 1).map((p) => p.text).join('')
  if (text(from, to).length <= maxChars) return text(from, to)

  // Too long: grow outwards from the sentence while it fits.
  let a = idx
  let b = idx
  while (true) {
    const growLeft = a > from && text(a - 1, b).length <= maxChars
    const growRight = b < to && text(a, b + 1).length <= maxChars
    if (!growLeft && !growRight) break
    if (growLeft) a--
    if (growRight && text(a, b + 1).length <= maxChars) b++
  }
  return text(a, b)
}
