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

/** The student's own typical run time per depth, from the server. Missing or without data means the configured time stands. */
export type DepthEstimates = { depth: string; minutes: number | null }[] | null | undefined

export function depthCost(id: DepthId, estimates?: DepthEstimates): { credits: number; minCharged: number; minutes: number } {
  const t = DEPTH_TIERS[id] ?? DEPTH_TIERS[DEFAULT_DEPTH]
  const learned = estimates?.find(e => e.depth === t.id)?.minutes
  return { credits: t.credits, minCharged: t.minCharged, minutes: learned && learned > 0 ? learned : t.minutes }
}

export function startLabel(id: DepthId, estimates?: DepthEstimates): string {
  const { credits, minutes } = depthCost(id, estimates)
  return `Start research · ${credits} credits · ~${minutes} min`
}

// ── intent ──────────────────────────────────────────────────────────────────────────────────

/** Rules that point to ONE kind of research when they match. */
const SPECIFIC: { mode: DeepResearchMode; test: RegExp }[] = [
  { mode: 'ContradictoryEvidence', test: /\b(conflict\w*|contradict\w*|disagree\w*|counter[- ]?evidence|opposing|fail(s|ed)? to replicate|evidence against|criticis\w+)\b/i },
  { mode: 'ResearchGapInvestigation', test: /\b(research gap|gaps? in|under-?studied|under-?researched|unexplored|little research|lack of research|understudied)\b/i },
  { mode: 'MeasurementInstrument', test: /\b(scales?|instruments?|questionnaires?|inventory|validated (measure|tool)s?|how (do|can|to) (you |we |i )?measure)\b/i },
  { mode: 'TheoreticalFramework', test: /\b(theor(y|ies|etical)|conceptual framework|framework for|framework to)\b/i },
  { mode: 'MethodologyEvidence', test: /\b(methodolog\w*|sampling|sample size|research design|mixed[- ]methods?|regression|appropriate method)\b/i },
  { mode: 'RelationshipInvestigation', test: /\b(influenc\w*|affect\w*|impact\w*|effects? (of|on)|relationship|correlat\w*|associat\w*|predict\w*|lead(s|ing)? to|cause[sd]?)\b/i },
  { mode: 'EvidenceForClaim', test: /\b(evidence (for|that|supports?)|is there (any )?(evidence|support)|is it true)\b/i },
  { mode: 'TopicExploration', test: /\b(what (do we know|does the (literature|research|evidence) say)|overview of|state of (the )?(research|literature)|literature (on|about))\b/i },
]

const ENGLISH_WORDS = /\b(the|of|in|on|and|does|do|is|are|what|which|how|why|between|for|to|that|among|with|there|can|has|have)\b/i

export interface IntentGuess {
  /** Shown to the student as "Auto: …". Null unless the question clearly points to exactly one kind of research. */
  label: DeepResearchMode | null
  /** What a run uses when the student leaves it on Auto. A guess; never displayed as if it were sure. */
  mode: DeepResearchMode
}

/** Looks like English prose of enough length for the rules to mean anything. */
function looksEnglish(q: string): boolean {
  const letters = q.replace(/[^\p{L}]/gu, '')
  if (letters.length === 0) return false
  const ascii = letters.replace(/[^A-Za-z]/g, '').length
  return ascii / letters.length >= 0.85 && ENGLISH_WORDS.test(q)
}

/**
 * What the question looks like. The label is shown only when ONE specific kind matches; zero matches, several
 * different matches (ambiguous), a very short question or text that does not look English give no label, rather
 * than a guess presented as fact. The fallback mode is still chosen so a run can start.
 */
export function guessIntent(question: string): IntentGuess {
  const q = question.trim()
  const fallback: DeepResearchMode = /^\s*(should|ought|must)\b/i.test(q) ? 'EvidenceForClaim' : 'TopicExploration'
  // Under five words it is a phrase, not yet a question: too little to say what kind of research it is.
  if (q.length < 12 || q.split(/\s+/).length < 5 || !looksEnglish(q)) return { label: null, mode: 'TopicExploration' }
  let hits = SPECIFIC.filter(r => r.test.test(q)).map(r => r.mode)
  // "evidence supports ..." and "what do we know about ..." are generic frames: they only decide when nothing more specific matched.
  const specific = hits.filter(m => m !== 'EvidenceForClaim' && m !== 'TopicExploration')
  if (specific.length > 0) hits = specific
  if (hits.length === 1) return { label: hits[0], mode: hits[0] }
  return { label: null, mode: hits[0] ?? fallback }
}

/** The kind of research to show as detected, or null when it is not clear enough to say. */
export function detectIntent(question: string): DeepResearchMode | null {
  return guessIntent(question).label
}

/** A question still holding an unfilled `___` slot from a template is not ready to run. */
export const hasUnfilledTemplate = (question: string): boolean => /_{2,}/.test(question)

// ── normative questions ─────────────────────────────────────────────────────────────────────

const NORMATIVE = /^\s*(should|ought|must|is it (right|wrong|fair|unfair|ethical|unethical|moral|immoral|acceptable|justified|good|bad|better|appropriate)|are we (right|justified)|is it okay)\b/i

/** "Should…" and "Is it right to…" ask for a verdict, which literature cannot give. It can report what is known. */
export function isNormativeQuestion(question: string): boolean {
  return NORMATIVE.test(question)
}

/**
 * An evidence-answerable version of a normative question. It keeps the student's own words (topic, population, region)
 * and only changes the verdict-seeking frame. When the sentence does not fit a known frame it is quoted whole rather
 * than reshaped. The student edits it; it is a suggestion, not a rule.
 */
export function rewriteNormative(question: string): string {
  const q = question.trim().replace(/\?+\s*$/, '')
  const isTo = q.match(/^\s*is it (?:right|wrong|fair|unfair|ethical|unethical|moral|immoral|acceptable|justified|good|bad|better|appropriate|okay) to\s+/i)
  if (isTo) return `What does the evidence say about whether to ${q.slice(isTo[0].length).trim()}?`
  const should = q.match(/^\s*(?:should|ought|must)\s+/i)
  if (should) return `What does the evidence say about whether ${q.slice(should[0].length).trim()}?`
  return `What does the evidence say about this question: ${q}?`
}


// ── suggested questions ─────────────────────────────────────────────────────────────────────

/** Title case → sentence case, leaving acronyms ("AI", "LMS") and "I" alone. */
function sentenceCase(s: string): string {
  return restorePlaces(s.split(/\s+/).map(w => ((w.match(/[A-Z]/g) ?? []).length >= 2 || w === 'I' ? w : w.toLowerCase())).join(' '))
}

/** Lower-casing a title must not turn "Uganda" or "Gauteng" into common nouns. Only places the product's students study in. */
const PLACES = /\b(south africa(?:n)?|cape town|eastern cape|western cape|northern cape|free state|north west|kwazulu-natal|gauteng|limpopo|mpumalanga|johannesburg|pretoria|durban|soweto|africa(?:n)?|kenya(?:n)?|uganda(?:n)?|nigeria(?:n)?|ghana(?:ian)?|tanzania(?:n)?|rwanda|ethiopia(?:n)?|zambia(?:n)?|zimbabwe(?:an)?|malawi|botswana|namibia|mozambique|lesotho|eswatini|egypt|morocco|cameroon|senegal|europe(?:an)?|asia(?:n)?|india(?:n)?|china|chinese|canada|australia(?:n)?|brazil|usa|uk)\b/gi
const restorePlaces = (s: string) => s.replace(PLACES, m => m.replace(/(^|[\s-])([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase()))

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

// ── study titles ────────────────────────────────────────────────────────────────────────────

const DESIGN_PHRASE = /\b(?:an?\s+)?(?:(?:cross[- ]sectional|longitudinal|qualitative|quantitative|mixed[- ]methods?|descriptive|correlational|exploratory|comparative|empirical|case)\s+)?(?:survey|study|design|analysis|investigation)\b|\b(?:systematic|scoping|narrative|integrative)\s+(?:literature\s+)?review\b|\bmeta-?analysis\b/i
const QUESTION_START = /^\s*(what|which|how|why|who|where|when|does|do|did|is|are|was|were|can|could|will|would|has|have)\b/i

/**
 * Whether the text reads like the title of a study ("…: A Cross-Sectional Survey") rather than a question to research.
 * A title searches badly because its design words and subtitle are about the paper, not the topic.
 */
export function looksLikeStudyTitle(text: string): boolean {
  const t = text.trim()
  if (t.length < 25) return false
  const colon = t.indexOf(':')
  const afterColon = colon > 0 ? t.slice(colon + 1) : ''
  if (colon > 0 && DESIGN_PHRASE.test(afterColon)) return true                              // "…: a cross-sectional survey"
  if (/(?:^|[\s,\u2013\u2014-])an?\s+(?:[\w-]+\s+){0,2}(?:survey|study|review)\s*\??\s*$/i.test(t)) return true   // a design phrase at the end
  if (colon > 0 && !t.includes('?') && afterColon.trim().split(/\s+/).length >= 3) return true   // a plain subtitle on a non-question
  return false
}

/**
 * A research question taken from a study title, using the student's own words: the subtitle and design phrase are
 * dropped, and what is left is turned into a question only if it is not one already.
 */
export function titleToQuestion(text: string): string {
  let main = text.trim().replace(/\?+\s*$/, '')
  const colon = main.indexOf(':')
  if (colon > 0) main = main.slice(0, colon)
  main = main.replace(/[,–—-]?\s*\ba\s+(?:[\w-]+\s+){0,2}(?:survey|study|review|design)\b.*$/i, '').trim()
  if (QUESTION_START.test(main)) return `${main}?`
  const [first] = suggestQuestions(main)
  return first ?? `What does the literature say about ${main}?`
}
