export type GrammarContext  = 'General' | 'Academic' | 'Business' | 'Creative' | 'Casual';
export type GrammarLanguage = 'AmericanEnglish' | 'BritishEnglish' | 'AustralianEnglish';
export type ErrorCategory   = 'Spelling' | 'Grammar' | 'Punctuation' | 'Style' | 'Clarity' | 'Conciseness' | 'Consistency' | 'Tone';
export type ErrorSeverity   = 'Error' | 'Warning' | 'Suggestion';

export interface GrammarCheckRequest {
  text: string;
  context?: GrammarContext;
  language?: GrammarLanguage;
  enabledCategories?: ErrorCategory[];
}

export interface GrammarPreviewRequest {
  text: string;
  context?: GrammarContext;
  language?: GrammarLanguage;
}

export interface GrammarSuggestion {
  id: string;
  startOffset: number;
  endOffset: number;
  originalText: string;
  replacement: string;
  alternatives: string[];
  category: ErrorCategory;
  categoryColour: string;
  severity: ErrorSeverity;
  shortMessage: string;
  explanation: string;
  correctedSentence: string;
}

export interface GrammarCheckResponse {
  originalText: string;
  suggestions: GrammarSuggestion[];
  suggestionCountByCategory: Record<string, number>;
  totalErrors: number;
  totalWarnings: number;
  totalStyle: number;
  qualityScore: number;
  wordCount: number;
  processingTimeMs: number;
  wordsUsed: number;
  wordsLimit: number;
  wordsRemaining: number;
}

/** Client-side suggestion state — extends API suggestion with UI status. */
export interface ActiveSuggestion extends GrammarSuggestion {
  status: 'pending' | 'accepted' | 'ignored';
}
