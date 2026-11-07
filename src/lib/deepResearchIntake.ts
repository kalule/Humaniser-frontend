import type { DeepResearchMode } from '../api/deepResearch'

// The "New research" intake: how deep to go and what it costs, what kind of question this is, and the two
// guards on the question itself. Pure functions only; the form owns the state.

// ── depth ───────────────────────────────────────────────────────────────────────────────────

export type DepthId = 'summary' | 'standard' | 'deep'

export interface DepthTier {
  id: DepthId
  label: string
  blurb: string
  /** Credits held when the run starts. This is the most the run can cost; the rest is returned. */
  credits: number
  /** The floor for a run that did real work. */
  minCharged: number
  /** Typical wall-clock time for the run. */
  minutes: number
}

/**
 * The single source of truth for depth in the UI. The server holds the authoritative copy of the credits and the
 * search/read budget for each id (DeepResearchDepth); it ignores anything it does not recognise and never lets a
 * tier exceed the account's ceilings, so a stale value here can show the wrong price but cannot overspend.
 */
export const DEPTH_TIERS: Record<DepthId, DepthTier> = {
  summary:  { id: 'summary',  label: 'Summary',  blurb: 'A quick read of the strongest papers.',          credits: 8,  minCharged: 5, minutes: 3 },
  standard: { id: 'standard', label: 'Standard', blurb: 'Balanced search with a check for disagreement.', credits: 14, minCharged: 5, minutes: 6 },
  deep:     { id: 'deep',     label: 'Deep',     blurb: 'The widest search, and full text where open.',   credits: 20, minCharged: 5, minutes: 10 },
}
export const DEPTH_ORDER: DepthId[] = ['summary', 'standard', 'deep']
export const DEFAULT_DEPTH: DepthId = 'standard'

export function depthCost(id: DepthId): { credits: number; minCharged: number; minutes: number } {
  const t = DEPTH_TIERS[id] ?? DEPTH_TIERS[DEFAULT_DEPTH]
  return { credits: t.credits, minCharged: t.minCharged, minutes: t.minutes }
}

export function startLabel(id: DepthId): string {
  const { credits, minutes } = depthCost(id)
  return `Start research · ${credits} credits · ~${minutes} min`
}

// ── intent ──────────────────────────────────────────────────────────────────────────────────

const RULES: { mode: DeepResearchMode; test: RegExp }[] = [
  { mode: 'ContradictoryEvidence', test: /\b(conflict\w*|contradict\w*|disagree\w*|counter[- ]?evidence|opposing|fail(s|ed)? to replicate|evidence against|criticis\w+)\b/i },
  { mode: 'ResearchGapInvestigation', test: /\b(research gap|gaps? in|under-?studied|under-?researched|unexplored|little research|lack of research|understudied)\b/i },
  { mode: 'MeasurementInstrument', test: /\b(scales?|instruments?|questionnaires?|inventory|validated (measure|tool)s?|how (do|can|to) (you |we |i )?measure)\b/i },
  { mode: 'TheoreticalFramework', test: /\b(theor(y|ies|etical)|conceptual framework|framework for|framework to)\b/i },
  { mode: 'MethodologyEvidence', test: /\b(methodolog\w*|sampling|sample size|research design|mixed[- ]methods?|regression|interviews? (vs|versus)|appropriate method)\b/i },
  { mode: 'RelationshipInvestigation', test: /\b(influenc\w*|affect\w*|impact\w*|effects? (of|on)|relationship|correlat\w*|associat\w*|predict\w*|lead(s|ing)? to|cause[sd]?)\b/i },
  { mode: 'EvidenceForClaim', test: /\b(evidence (for|that|supports?)|is there (any )?(evidence|support)|prove[sd]?|justif\w+|is it true)\b|^\s*(should|ought)\b/i },
  { mode: 'TopicExploration', test: /^\s*(what|which|how|why)\b/i },
]

/** The kind of research a question looks like, or null when it is too short or does not clearly look like any. */
export function detectIntent(question: string): DeepResearchMode | null {
  const q = question.trim()
  if (q.length < 12) return null
  return RULES.find(r => r.test.test(q))?.mode ?? null
}

/** A question still holding an unfilled `___` slot from a template is not ready to run. */
export const hasUnfilledTemplate = (question: string): boolean => /_{2,}/.test(question)

// ── normative questions ─────────────────────────────────────────────────────────────────────

const NORMATIVE = /^\s*(should|ought|must|is it (right|wrong|fair|unfair|ethical|unethical|moral|immoral|acceptable|justified|good|bad|better|appropriate)|are we (right|justified)|is it okay)\b/i

/** "Should…" and "Is it right to…" ask for a verdict, which literature cannot give. It can report what is known. */
export function isNormativeQuestion(question: string): boolean {
  return NORMATIVE.test(question)
}

/** An evidence-answerable version of a normative question. The student edits it; it is a suggestion, not a rule. */
export function rewriteNormative(question: string): string {
  const q = question.trim().replace(/\?+\s*$/, '')
  const lead = q.match(/^\s*is it (?:right|wrong|fair|unfair|ethical|unethical|moral|immoral|acceptable|justified|good|bad|better|appropriate|okay) to\s+/i)
    ?? q.match(/^\s*(?:should|ought|must)\s+/i)
  if (!lead) return `What does the evidence say about ${lowerFirst(q)}?`
  const rest = q.slice(lead[0].length).trim()
  return /^is it/i.test(lead[0])
    ? `What does the evidence say about whether to ${rest}?`
    : `What does the evidence say about whether ${rest}?`
}

const lowerFirst = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s)

// ── suggested questions ─────────────────────────────────────────────────────────────────────

/** Title case → sentence case, leaving acronyms ("AI", "LMS") and "I" alone. */
function sentenceCase(s: string): string {
  return s.split(/\s+/).map(w => ((w.match(/[A-Z]/g) ?? []).length >= 2 || w === 'I' ? w : w.toLowerCase())).join(' ')
}

/**
 * Up to three starting questions built from a project's title. Deterministic: it reshapes the words the student
 * already chose ("The Correlation Between A and B" → "Does A influence B?"); it adds no claims of its own.
 */
export function suggestQuestions(title: string): string[] {
  const t = title.replace(/\s+/g, ' ').replace(/[.:;,\s]+$/, '').trim()
  if (t.length < 8) return []
  const between = t.match(/^(?:the )?(?:correlation|relationship|association|link|connection) between (.+?) and (.+)$/i)
  const effect = t.match(/^(?:the )?(?:impact|effect|influence)s? of (.+?) on (.+)$/i)
  const pair = between ?? effect
  if (pair) {
    const a = sentenceCase(pair[1]); const b = sentenceCase(pair[2])
    return [
      `Does ${a} influence ${b}?`,
      `What does the evidence say about the relationship between ${a} and ${b}?`,
      `Which studies report no effect of ${a} on ${b}?`,
    ].filter(q => q.length <= 220)
  }
  const topic = sentenceCase(t)
  if (topic.length > 140) return [`What does the literature say about ${topic}?`].filter(q => q.length <= 220)
  return [
    `What does the literature say about ${topic}?`,
    `What factors influence ${topic}?`,
    `Which theories are used to study ${topic}?`,
  ]
}
