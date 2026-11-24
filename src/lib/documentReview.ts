import type { ProjectSection, ProposalIssue } from '../types/research'
import { splitTrailingReferences } from './wordCount'
import { CONTRACT_FIELD, listItems, type DesignContract } from './designContract'

/**
 * "Review" in the Document view: a light, deterministic pass over the whole document. It merges
 * the server's own release checks (proposal-issues: DesignConsistencyDetector and friends, no model
 * calls) with checks only the client can make: the text against the student's design contract, and
 * placeholders in text typed since the last save. Each issue points at a section and, where it can,
 * at the exact words, so the list can scroll to them.
 */

export type ReviewIssueKind = 'placeholder' | 'contract' | 'variable_role'

export interface ReviewIssue {
  id:          string
  kind:        ReviewIssueKind
  sectionCode: string
  message:     string
  /** Words to find and select in the section; null when the issue is about what is missing. */
  evidence:    string | null
  /** Counted against export (the gate). Advisory server warnings are listed but not counted. */
  blocking:    boolean
  origin:      'document' | 'server'
}

export const REVIEW_KIND_LABEL: Record<ReviewIssueKind, string> = {
  placeholder:   'Placeholder',
  contract:      'Study decisions',
  variable_role: 'Variables',
}

type Section = Pick<ProjectSection, 'code' | 'title' | 'content' | 'status' | 'displayCode'>

const bodyOf = (s: Section) => splitTrailingReferences(s.content.replace(/\r\n/g, '\n')).body
const labelOf = (s: Section | undefined, code: string) => (s ? `${s.displayCode || s.code} ${s.title}` : code)

// ── Placeholders ────────────────────────────────────────────────────────────────────────────────

const PLACEHOLDERS: { re: RegExp; what: string }[] = [
  { re: /\b(?:TBD|TBC|TBA)\b/g, what: 'an unresolved "to be decided" marker' },
  { re: /\bto be (?:determined|confirmed|decided|added|inserted)\b/gi, what: 'an unresolved "to be determined" note' },
  // Internal field names leaking into prose: "(PrimaryExposureDefinition)", "(PrimaryExposure Definition)".
  { re: /\((?:[A-Z][a-z0-9]+){2,}(?:\s+[A-Z][a-z0-9]+)*\)/g, what: 'an internal field name' },
  { re: /\[(?:insert|add|citation needed|reference|ref|todo|xx+)[^\]]{0,60}\]/gi, what: 'an unfilled bracket placeholder' },
  { re: /\{\{[^}]{1,60}\}\}|<<[^>]{1,60}>>/g, what: 'a template placeholder' },
  { re: /\bX{2,}\b/g, what: 'a placeholder value (XX)' },
  { re: /^\s*(?:\*\*)?\s*(?:DRAFT\b|Draft notice\b|Note to (?:self|student|reviewer)\b|Decision needed:)[^\n]*/gm, what: 'a draft banner or note' },
]

export function placeholderIssues(sections: readonly Section[]): ReviewIssue[] {
  const out: ReviewIssue[] = []
  for (const s of sections) {
    const body = bodyOf(s)
    if (!body.trim()) continue
    const seen = new Set<string>()
    for (const { re, what } of PLACEHOLDERS) {
      for (const m of body.matchAll(re)) {
        const text = m[0].trim()
        if (!text || seen.has(text)) continue
        seen.add(text)
        out.push({ id: `ph:${s.code}:${text}`, kind: 'placeholder', sectionCode: s.code, evidence: text, blocking: true, origin: 'document',
          message: `${labelOf(s, s.code)} contains ${what}: “${text.length > 60 ? `${text.slice(0, 57)}…` : text}”.` })
      }
    }
  }
  return out
}

// ── Text vs design contract ─────────────────────────────────────────────────────────────────────

const SOFTWARE: { name: string; re: RegExp }[] = [
  { name: 'SPSS', re: /\b(?:IBM\s+)?SPSS(?:\s+Statistics)?\b/i },
  { name: 'Stata', re: /\bStata\b/ },
  { name: 'R', re: /\bR(?:Studio)?\b(?=\s*(?:software|statistical|programming|version|\(|package|environment))|\bRStudio\b/ },
  { name: 'NVivo', re: /\bN[Vv]ivo\b/ },
  { name: 'ATLAS.ti', re: /\bATLAS\.ti\b/i },
  { name: 'MAXQDA', re: /\bMAXQDA\b/i },
  { name: 'SAS', re: /\bSAS\b/ },
  { name: 'SmartPLS', re: /\bSmart\s?PLS\b/i },
  { name: 'AMOS', re: /\bAMOS\b/ },
  { name: 'EViews', re: /\bE[Vv]iews\b/ },
  { name: 'Python', re: /\bPython\b/ },
  { name: 'Jamovi', re: /\bjamovi\b/i },
  { name: 'JASP', re: /\bJASP\b/ },
  { name: 'Excel', re: /\b(?:Microsoft\s+)?Excel\b/ },
]

const ASSISTANTS = /\b(?:research\s+assistants?|enumerators?|field\s*workers?|data\s+collectors?|trained\s+interviewers?)\b/i
const RESEARCHER_ONLY = /\b(?:the\s+researcher|I)\b[^.]{0,60}\b(?:personally|alone|myself|him-?\s?or\s?herself|themselves)\b|\bpersonally\b/i

const SAMPLE_NUMBER = /\b(?:n\s*=\s*(\d{2,6})|sample(?:\s+size)?\s+of\s+(\d{2,6})|(\d{2,6})\s+(?:respondents|participants|SMEs|SMMEs|firms|enterprises|businesses|owner-managers|owners|managers|interviewees|households|students|employees))\b/gi

const METHODS: { name: string; re: RegExp }[] = [
  { name: 'interviews', re: /\binterview(?:s|ing|ed)?\b/i },
  { name: 'focus groups', re: /\bfocus\s+groups?\b/i },
  { name: 'a questionnaire survey', re: /\bquestionnaires?\b|\bsurvey(?:s|ed)?\b/i },
  { name: 'observation', re: /\b(?:participant\s+|direct\s+|non-participant\s+)observation\b/i },
  { name: 'document analysis', re: /\bdocument(?:ary)?\s+analysis\b/i },
]

/** Sentence containing the match, for highlighting. */
function sentenceAt(text: string, index: number): string {
  const start = Math.max(text.lastIndexOf('.', index) + 1, text.lastIndexOf('\n', index) + 1)
  const endDot = text.indexOf('.', index)
  const endNl = text.indexOf('\n', index)
  const ends = [endDot === -1 ? text.length : endDot + 1, endNl === -1 ? text.length : endNl]
  return text.slice(start, Math.min(...ends)).trim()
}

function numbersIn(value: string | undefined): Set<string> {
  return new Set([...(value ?? '').matchAll(/\d[\d\s,]*\d|\d/g)].map(m => m[0].replace(/[\s,]/g, '')))
}

export function contractIssues(sections: readonly Section[], contract: DesignContract): ReviewIssue[] {
  const out: ReviewIssue[] = []
  const byCode = new Map(sections.map(s => [s.code, s]))
  const drafted = sections.filter(s => bodyOf(s).trim())

  // Software named in a section but not in the contract.
  if (contract.software) {
    const allowed = SOFTWARE.filter(p => p.re.test(contract.software!)).map(p => p.name)
    for (const s of drafted) {
      const body = bodyOf(s)
      for (const pkg of SOFTWARE) {
        if (allowed.includes(pkg.name)) continue
        const m = pkg.re.exec(body)
        if (!m) continue
        out.push({ id: `ct:software:${s.code}:${pkg.name}`, kind: 'contract', sectionCode: s.code, evidence: m[0], blocking: true, origin: 'document',
          message: `${labelOf(s, s.code)} names ${pkg.name}, but the study decisions give the software as “${contract.software}”.` })
      }
    }
  }

  // Who collects data.
  if (contract.dataCollector) {
    const contractSaysAssistants = ASSISTANTS.test(contract.dataCollector)
    for (const code of CONTRACT_FIELD.dataCollector.sections) {
      const s = byCode.get(code)
      if (!s) continue
      const body = bodyOf(s)
      const hit = contractSaysAssistants ? RESEARCHER_ONLY.exec(body) : ASSISTANTS.exec(body)
      if (!hit) continue
      out.push({ id: `ct:collector:${code}`, kind: 'contract', sectionCode: code, evidence: sentenceAt(body, hit.index), blocking: true, origin: 'document',
        message: `${labelOf(s, code)} says “${hit[0]}” collect${contractSaysAssistants ? 's' : ''} data, but the study decisions say “${contract.dataCollector}”.` })
    }
  }

  // Sample size: a different number stated in a section that states the sample.
  const allowedNumbers = numbersIn(`${contract.sampleSize ?? ''} ${contract.sampleSizeBasis ?? ''}`)
  if (contract.sampleSize && allowedNumbers.size) {
    for (const code of CONTRACT_FIELD.sampleSize.sections) {
      const s = byCode.get(code)
      if (!s) continue
      const body = bodyOf(s)
      for (const m of body.matchAll(SAMPLE_NUMBER)) {
        const n = (m[1] ?? m[2] ?? m[3] ?? '').replace(/[\s,]/g, '')
        if (!n || allowedNumbers.has(n)) continue
        out.push({ id: `ct:sample:${code}:${n}`, kind: 'contract', sectionCode: code, evidence: m[0], blocking: true, origin: 'document',
          message: `${labelOf(s, code)} gives a sample of ${n}, but the study decisions give the sample size as “${contract.sampleSize}”.` })
        break
      }
    }
  }

  // A method named in the design but missing from data collection, timeline or budget.
  const designText = ['5.2', '5.8'].map(c => byCode.get(c)).filter((s): s is Section => !!s).map(bodyOf).join('\n')
    + `\n${contract.designType ?? ''}\n${contract.strands ?? ''}\n${contract.dataSources ?? ''}`
  for (const method of METHODS) {
    if (!method.re.test(designText)) continue
    for (const code of ['5.8', '6.1', '6.2']) {
      const s = byCode.get(code)
      if (!s || !bodyOf(s).trim() || method.re.test(bodyOf(s))) continue
      out.push({ id: `ct:method:${code}:${method.name}`, kind: 'contract', sectionCode: code, evidence: null, blocking: true, origin: 'document',
        message: `The design uses ${method.name}, but ${labelOf(s, code)} does not mention ${method.name === 'a questionnaire survey' ? 'the survey' : method.name}.` })
    }
  }
  return out
}

// ── Variable roles ──────────────────────────────────────────────────────────────────────────────

const lower = (s: string) => s.toLowerCase()

export function variableRoleIssues(sections: readonly Section[], contract: DesignContract): ReviewIssue[] {
  const out: ReviewIssue[] = []
  const byCode = new Map(sections.map(s => [s.code, s]))
  const ivs = listItems(contract.independentVariables)
  const controls = listItems(contract.controls).map(lower)
  const mediators = listItems(contract.mediators)
  const moderators = listItems(contract.moderators)
  const anchor = byCode.has('5.7') ? '5.7' : '3.3'

  // In the contract itself: an independent variable (or a component of one) also listed as a control.
  for (const iv of ivs) {
    const clash = controls.find(c => c === lower(iv) || lower(iv).includes(c) || c.includes(lower(iv)))
    if (clash) out.push({ id: `vr:ivcontrol:${iv}`, kind: 'variable_role', sectionCode: anchor, evidence: null, blocking: true, origin: 'document',
      message: `“${iv}” is an independent variable and also a control (“${clash}”) in the study decisions. A variable has one role.` })
  }
  for (const m of mediators) {
    if (moderators.some(x => lower(x) === lower(m))) out.push({ id: `vr:medmod:${m}`, kind: 'variable_role', sectionCode: anchor, evidence: null, blocking: true, origin: 'document',
      message: `“${m}” is listed as both a mediator and a moderator. State one role, with the matching model term.` })
  }

  // In the text: a control-variable sentence that lists an independent variable.
  const vars = byCode.get('5.7')
  if (vars) {
    const body = bodyOf(vars)
    for (const sentence of body.split(/(?<=[.!?])\s+|\n+/)) {
      if (!/\bcontrol(?:led|ling)?\s+(?:variables?|for)\b|\bcovariates?\b/i.test(sentence)) continue
      for (const iv of ivs) {
        if (lower(sentence).includes(lower(iv))) {
          out.push({ id: `vr:text:${iv}`, kind: 'variable_role', sectionCode: '5.7', evidence: sentence.trim(), blocking: true, origin: 'document',
            message: `5.7 treats “${iv}” as a control, but it is an independent variable in the study decisions.` })
        }
      }
    }
  }

  // Mediator/moderator named without the matching model term in the analysis plan.
  const analysis = byCode.get('5.10')
  const analysisBody = analysis ? bodyOf(analysis) : ''
  if (analysis && analysisBody.trim()) {
    if (mediators.length && !/\bmediat|\bindirect\s+effect|\bPROCESS\b/i.test(analysisBody)) {
      out.push({ id: 'vr:mediation-term', kind: 'variable_role', sectionCode: '5.10', evidence: null, blocking: true, origin: 'document',
        message: `The contract lists mediator${mediators.length === 1 ? '' : 's'} (${mediators.join(', ')}), but 5.10 has no mediation model (indirect effect, mediation analysis).` })
    }
    if (moderators.length && !/\bmoderat|\binteraction\s+term|\binteraction\s+effect|\b[A-Za-z]+\s*[×x*]\s*[A-Za-z]+\b/i.test(analysisBody)) {
      out.push({ id: 'vr:moderation-term', kind: 'variable_role', sectionCode: '5.10', evidence: null, blocking: true, origin: 'document',
        message: `The contract lists moderator${moderators.length === 1 ? '' : 's'} (${moderators.join(', ')}), but 5.10 has no interaction term or moderation analysis.` })
    }
  }
  return out
}

// ── Server issues ───────────────────────────────────────────────────────────────────────────────

const SERVER_KIND: Record<string, ReviewIssueKind> = {
  placeholder_token: 'placeholder', process_note: 'placeholder', sample_size_deferred: 'placeholder', uncosted_budget: 'placeholder',
  software_conflict: 'contract', qualitative_source_conflict: 'contract', sample_link_conflict: 'contract', access_conflict: 'contract',
  unscheduled_method: 'contract',
  variable_role_conflict: 'variable_role', model_term_missing: 'variable_role', variable_without_measure: 'variable_role',
  // Marker review of the regenerated DT/SME proposal (2026-11-23): sample arithmetic, budget and analysis conflicts.
  sample_arithmetic: 'contract', probability_without_frame: 'contract', compensation_conflict: 'contract', transcription_conflict: 'contract',
  outcome_defined_by_exposure: 'variable_role', controls_not_modelled: 'variable_role', framework_construct_unmeasured: 'variable_role',
  score_construction_missing: 'variable_role',
  undecided_wording: 'placeholder', power_basis_missing: 'placeholder',
}

/** The server checks this review is about; everything else (spelling, reference style) stays on the Download step. */
export function fromServerIssues(issues: readonly ProposalIssue[]): ReviewIssue[] {
  const out: ReviewIssue[] = []
  issues.forEach((issue, i) => {
    const short = issue.type.replace(/^section_rule_/, '')
    const kind = SERVER_KIND[short]
    if (!kind) return
    out.push({
      id: `sv:${issue.type}:${issue.sectionKey}:${i}`, kind, sectionCode: issue.sectionKey, origin: 'server',
      message: issue.message, evidence: issue.evidence?.trim() ? issue.evidence.trim() : null,
      blocking: issue.severity === 'Blocking' || kind !== 'placeholder',
    })
  })
  return out
}

/** All checks, deduplicated (the same placeholder found by the server and here is listed once), in document order. */
export function runDocumentReview(
  sections: readonly Section[], contract: DesignContract, serverIssues: readonly ProposalIssue[] = [],
): ReviewIssue[] {
  const local = [...placeholderIssues(sections), ...contractIssues(sections, contract), ...variableRoleIssues(sections, contract)]
  const server = fromServerIssues(serverIssues).filter(sv =>
    !local.some(l => l.sectionCode === sv.sectionCode && l.kind === sv.kind && !!l.evidence && !!sv.evidence
      && (sv.evidence.includes(l.evidence) || l.evidence.includes(sv.evidence))))
  const order = new Map(sections.map((s, i) => [s.code, i]))
  return [...local, ...server].sort((a, b) => (order.get(a.sectionCode) ?? 999) - (order.get(b.sectionCode) ?? 999))
}

export const openIssueCount = (issues: readonly ReviewIssue[], dismissed: ReadonlySet<string> = new Set()) =>
  issues.filter(i => i.blocking && !dismissed.has(i.id)).length
