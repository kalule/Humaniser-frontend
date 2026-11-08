import type {
  DeepResearchReport, DeepResearchReportClaim, DeepResearchReportGap, DeepResearchReportReference, DeepResearchReportSection, DeepResearchSession, EvidenceSource,
} from '../api/deepResearch'
import { strengthLabel } from './deepResearch'
import { stripSeparators } from './deepResearchView'

// Builds the cited report in the browser from what the session already returned: its key findings (which the server
// validated against accepted evidence) and its source list. It exists so a student is never left without a report when
// the server's report endpoint is unavailable (for example a server that has not been restarted with it). It follows the
// same rules as the server's builder: a sentence is kept only if every source it cites is VERIFIED and accepted for its
// own question; anything else is dropped and its question is reported under Gaps. It writes no sentence of its own about
// the topic.

const STRENGTH_RANK: Record<string, number> = { Strong: 4, Moderate: 3, Conflicting: 2, Weak: 2, Insufficient: 1 }
const MAX_BOTTOM_LINE = 2
const DROPPED = 'A statement for this question had no verified source behind it, so it was left out.'

function claim(text: string | null | undefined, sourceIds: string[], caveats: string[] = []): DeepResearchReportClaim | null {
  const t = stripSeparators(text)
  if (!t || sourceIds.length === 0) return null
  return { text: t, sourceIds, caveats: caveats.map(stripSeparators).filter(Boolean) }
}

export function buildReportLocally(session: DeepResearchSession, rows: EvidenceSource[]): DeepResearchReport {
  const result = session.result
  const questions = result?.questions ?? []
  const byId = new Map<string, EvidenceSource>()
  // question id → source id → the row linking them, for sources that are accepted AND verified
  const citable = new Map<string, Map<string, EvidenceSource>>()
  for (const r of rows) {
    if (!byId.has(r.id)) byId.set(r.id, r)
    if (r.decision === 'Accepted' && r.verification === 'Verified') {
      if (!citable.has(r.questionId)) citable.set(r.questionId, new Map())
      citable.get(r.questionId)!.set(r.id, r)
    }
  }

  const sections: DeepResearchReportSection[] = []
  const conflicts: DeepResearchReportClaim[] = []
  const gaps: DeepResearchReportGap[] = []
  const ranked: { claim: DeepResearchReportClaim; strength: number; sources: number }[] = []

  for (const q of questions) {
    const ok = citable.get(q.id) ?? new Map<string, EvidenceSource>()
    const claims: DeepResearchReportClaim[] = []
    const conflictsBefore = conflicts.length
    let dropped = false

    for (const f of (result?.keyFindings ?? []).filter(x => x.evidenceQuestionId === q.id)) {
      const support = [...new Set(f.supportingSourceIds)].filter(id => ok.has(id))
      const against = [...new Set(f.contradictingSourceIds)].filter(id => ok.has(id))
      if (support.length === 0 && against.length === 0) { dropped = true; continue }
      const c = claim(f.statement, [...support, ...against], f.caveats)
      if (!c) continue
      if (support.length > 0) { claims.push(c); ranked.push({ claim: c, strength: STRENGTH_RANK[f.strength] ?? 0, sources: support.length }) }
      else conflicts.push(c)
    }

    // sources that disagree, or found no effect, each get a line in their own words
    for (const [id, link] of ok) {
      if (link.polarity !== 'Contradicts' && link.polarity !== 'Null') continue
      if (conflicts.some(c => c.sourceIds.includes(id))) continue
      const lead = link.polarity === 'Null' ? 'Found no effect' : 'Reported findings that disagree'
      const c = claim(link.quote?.trim() ? `${lead}: “${link.quote.trim()}”` : `${lead} for this question`, [id])
      if (c) conflicts.push(c)
    }

    if (claims.length > 0) sections.push({ questionId: q.id, heading: q.question, sufficiency: q.sufficiency, claims })

    if (q.sufficiency !== 'Sufficient') {
      const neverSearched = q.status === 'Open' && !rows.some(r => r.questionId === q.id)
      const why = neverSearched ? 'Not reached before the research stopped.'
        : q.reasons.find(r => r.trim()) ?? (claims.length > 0 ? 'Partly answered: more evidence is needed.' : 'No verified source answered this question.')
      const text = claims.length > 0 && !neverSearched ? `Partly answered. ${why}` : why
      gaps.push({ questionId: q.id, question: q.question, reason: dropped ? `${text} ${DROPPED}` : text })
    } else if (claims.length === 0 && conflicts.length === conflictsBefore) {
      gaps.push({ questionId: q.id, question: q.question, reason: dropped ? DROPPED : 'No cited statement could be written for this question.' })
    }
  }

  const bottomLine = [...ranked].sort((a, b) => b.strength - a.strength || b.sources - a.sources).slice(0, MAX_BOTTOM_LINE).map(r => r.claim)

  // reference numbers follow first appearance in reading order
  const order: string[] = []
  for (const c of [...bottomLine, ...sections.flatMap(s => s.claims), ...conflicts]) for (const id of c.sourceIds) if (!order.includes(id)) order.push(id)
  const references: DeepResearchReportReference[] = order.map((id, i) => {
    const r = byId.get(id)!
    return { number: i + 1, sourceId: id, title: r.title, authors: r.authors, year: r.year, journal: r.journal, doi: r.doi }
  })

  return {
    sessionId: session.id,
    researchQuestion: session.researchQuestion,
    evidenceStrength: result?.evidenceStrength ?? 'Insufficient',
    bottomLine,
    bottomLineNote: bottomLine.length > 0 ? null : 'No verified source supports a direct answer to this question yet. The gaps below say what is missing.',
    sections, conflicts, gaps, references,
    status: session.status,
    builtLocally: true,
  }
}

// ── Word fallback ───────────────────────────────────────────────────────────────────────────

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * The report as a document Word opens (HTML with Word's namespace, saved as .doc). Used only when the server cannot
 * produce the .docx. Headings, inline [n] citations and the reference list are kept.
 */
export function reportToWordHtml(report: DeepResearchReport): string {
  const num = new Map(report.references.map(r => [r.sourceId, r.number]))
  const marks = (c: DeepResearchReportClaim) => c.sourceIds.map(id => (num.has(id) ? `[${num.get(id)}]` : '')).join('')
  const para = (c: DeepResearchReportClaim) =>
    `<p>${esc(c.text)} ${marks(c)}</p>${(c.caveats ?? []).map(x => `<p><i>${esc(x)} ${marks(c)}</i></p>`).join('')}`
  const out: string[] = [`<h1>${esc(report.researchQuestion)}</h1>`, '<h2>Bottom line</h2>', `<p>Evidence strength: <b>${esc(strengthLabel(report.evidenceStrength))}</b></p>`]
  if (report.bottomLine.length === 0) out.push(`<p>${esc(report.bottomLineNote ?? '')}</p>`)
  for (const c of report.bottomLine) out.push(para(c))
  for (const s of report.sections) out.push(`<h2>${esc(s.heading)}</h2>`, ...s.claims.map(para))
  if (report.conflicts.length > 0) out.push('<h2>Conflicting evidence</h2>', ...report.conflicts.map(para))
  if (report.gaps.length > 0) out.push('<h2>Gaps</h2>', '<ul>' + report.gaps.map(g => `<li>${esc(g.question)} — ${esc(g.reason)}</li>`).join('') + '</ul>')
  if (report.references.length > 0) {
    out.push('<h2>References</h2>')
    for (const r of report.references) {
      const who = r.authors.length === 0 ? 'Unknown authors' : r.authors.slice(0, 3).join(', ') + (r.authors.length > 3 ? ' et al.' : '')
      out.push(`<p>[${r.number}] ${esc(who)} (${r.year ?? 'n.d.'}). ${esc(r.title)}.${r.journal ? ` ${esc(r.journal)}.` : ''}${r.doi ? ` https://doi.org/${esc(r.doi)}` : ''}</p>`)
    }
  }
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${esc(report.researchQuestion)}</title></head><body>${out.join('\n')}</body></html>`
}
