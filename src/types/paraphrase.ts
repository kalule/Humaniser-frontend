export type ParaphraseMode = 'Standard' | 'Fluency' | 'Formal' | 'Academic' | 'Simple' | 'Expand' | 'Shorten'
export type ParaphraseStrength = 'light' | 'medium' | 'heavy'

// Independent length transformation, composed on top of ParaphraseMode's tone by the backend
// (ParaphrasePromptBuilder). ParaphraseMode's own Expand/Shorten members (5, 6) predate this and
// still work standalone for backward compatibility, but the UI no longer selects them directly —
// the Length row below sets this field instead, alongside any of the 5 tone modes.
export type ParaphraseLength = 'None' | 'Expand' | 'Shorten'

export interface ParaphraseRequest {
  text: string
  mode: number   // enum value: Standard=0 ... Shorten=6
  strength: ParaphraseStrength
  length?: number   // ParaphraseLength enum value: None=0, Expand=1, Shorten=2
  includeManifest?: boolean
}

export interface ParaphrasePreviewRequest {
  text: string
  mode: number
}

export interface SentencePair {
  original: string
  rewritten: string
}

export interface ParaphraseManifest {
  syntacticChange: string
  lexicalUpgrades: string[]
  wordCountDelta: number
  sentenceMap?: SentencePair[]
}

export interface WordDiffToken {
  word: string
  changed: boolean
}

export interface ParaphraseResponse {
  originalText: string
  paraphrasedText: string
  originalWordCount: number
  paraphrasedWordCount: number
  mode: string
  strength: string
  /** "Expand" | "Shorten" | null when no length transformation was applied. */
  length: string | null
  processingTimeMs: number
  manifest: ParaphraseManifest | null
  wordDiff: WordDiffToken[]
  changedWordCount: number
  wordsUsed: number
  wordsLimit: number
  wordsRemaining: number
  creditsUsed: number
  creditsLimit: number
  creditsRemaining: number
}

export const PARAPHRASE_MODE_INDEX: Record<ParaphraseMode, number> = {
  Standard: 0,
  Fluency:  1,
  Formal:   2,
  Academic: 3,
  Simple:   4,
  Expand:   5,
  Shorten:  6,
}

export const PARAPHRASE_LENGTH_INDEX: Record<ParaphraseLength, number> = {
  None:    0,
  Expand:  1,
  Shorten: 2,
}

export const PARAPHRASE_MODE_DESCRIPTIONS: Record<ParaphraseMode, string> = {
  Standard: 'Same meaning, different wording',
  Fluency:  'Smoother flow and better readability',
  Formal:   'Professional, polished register',
  Academic: 'Scholarly language and precision',
  Simple:   'Plain English for any reader',
  Expand:   'Add context and detail',
  Shorten:  'Trim to the essentials',
}
