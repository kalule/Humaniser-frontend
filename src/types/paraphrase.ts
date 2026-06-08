export type ParaphraseMode = 'Standard' | 'Fluency' | 'Formal' | 'Academic' | 'Simple' | 'Expand' | 'Shorten'
export type ParaphraseStrength = 'light' | 'medium' | 'heavy'

export interface ParaphraseRequest {
  text: string
  mode: number   // enum value: Standard=0 ... Shorten=6
  strength: ParaphraseStrength
  includeManifest?: boolean
}

export interface ParaphrasePreviewRequest {
  text: string
  mode: number
}

export interface ParaphraseManifest {
  syntacticChange: string
  lexicalUpgrades: string[]
  wordCountDelta: number
}

export interface ParaphraseResponse {
  originalText: string
  paraphrasedText: string
  originalWordCount: number
  paraphrasedWordCount: number
  mode: string
  strength: string
  processingTimeMs: number
  manifest: ParaphraseManifest | null
  wordsUsed: number
  wordsLimit: number
  wordsRemaining: number
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

export const PARAPHRASE_MODE_DESCRIPTIONS: Record<ParaphraseMode, string> = {
  Standard: 'Same meaning, different wording',
  Fluency:  'Smoother flow and better readability',
  Formal:   'Professional, polished register',
  Academic: 'Scholarly language and precision',
  Simple:   'Plain English for any reader',
  Expand:   'Add context and detail',
  Shorten:  'Trim to the essentials',
}
