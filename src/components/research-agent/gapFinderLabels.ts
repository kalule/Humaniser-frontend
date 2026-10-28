import type { GapStage, GapType, GapVerificationStatus } from '../../types/gapFinder'

export const GAP_TYPE_LABEL: Record<GapType, string> = {
  insufficient: 'Insufficient evidence',
  unreliable_methods: 'Unreliable methods',
  conflicting: 'Conflicting findings',
  wrong_question: 'Wrong question answered',
}

// Wording rule: say "within the reviewed literature"; never imply that nothing exists.
export const VERIFICATION_LABEL: Record<GapVerificationStatus, string> = {
  no_clear_answer_found: 'No clear answer found in our search',
  partly_addressed: 'Partly addressed by existing work',
  narrowed: 'Narrowed after checking existing work',
  rejected: 'Already addressed',
  not_verified: 'Not verified',
}

export const VERIFICATION_HELP: Record<GapVerificationStatus, string> = {
  no_clear_answer_found: 'We searched against this gap and no retrieved paper clearly answers it. That is not proof that none exists.',
  partly_addressed: 'At least one retrieved paper covers part of this question. Read the closest works before relying on the gap.',
  narrowed: 'The gap was narrowed because retrieved work already covers the wider question.',
  rejected: 'A retrieved paper already addresses this question.',
  not_verified: 'The verification search could not be completed.',
}

export const GAP_STAGES: { id: GapStage; label: string }[] = [
  { id: 'scope', label: 'Reading your topic' },
  { id: 'retrieve', label: 'Searching the literature' },
  { id: 'screen', label: 'Screening papers' },
  { id: 'extract', label: 'Reading evidence' },
  { id: 'candidates', label: 'Looking for gaps' },
  { id: 'verify', label: 'Checking each gap' },
  { id: 'present', label: 'Preparing results' },
]

export const stageIndex = (stage: GapStage): number =>
  Math.max(0, GAP_STAGES.findIndex(s => s.id === stage))

export const percent = (share: number): string => `${Math.round(share * 100)}%`

/** One query per line in the editor; blank lines and duplicates are dropped; the server caps at four. */
export const parseQueryLines = (text: string): string[] => {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of text.split('\n')) {
    const q = raw.trim()
    if (q.length < 5) continue
    const key = q.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(q)
  }
  return out.slice(0, 4)
}

/** DOIs pasted as separated text (commas, spaces, newlines, doi.org URLs): trimmed, deduped, capped at five. */
export const parseDois = (text: string): string[] => {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of text.split(/[\s,;]+/)) {
    const doi = raw.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '').replace(/[.,;)\]]+$/, '')
    if (!/^10\.\d{4,9}\/\S+$/.test(doi)) continue
    const key = doi.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(doi)
  }
  return out.slice(0, 5)
}
