// The shared proposal research agent (backend Services/ProposalAgent). Activity lines carry titles and queries only.

export type AgentActivityKind = 'Planned' | 'Found' | 'Read' | 'Added' | 'Wrote' | 'Checked' | 'Rewrote' | 'Gap' | 'Budget'

export interface AgentActivityLine {
  kind: AgentActivityKind | string
  text: string
  sectionCode: string | null
  at: string | null
}

export interface AgentActivity {
  running: boolean
  path: string | null
  sectionCode: string | null
  startedAt: string | null
  lines: AgentActivityLine[]
}

/** Status of a proposal: Proposed (open), Accepted (bound as evidence), Dismissed, Failed (can be retried). */
export type AgentEvidenceProposalStatus = 'Proposed' | 'Accepted' | 'Dismissed' | 'Failed'

export interface AgentEvidenceProposal {
  id: string
  sectionCode: string
  claim: string
  sourceTitle: string
  authors: string
  year: number | null
  doi: string | null
  literatureId: string | null
  sourceIncluded: boolean
  coverage: 'Abstract' | 'FullText' | string
  quote: string
  start: number
  length: number
  status: AgentEvidenceProposalStatus | string
  evidenceId: string | null
  message: string | null
}

export interface AgentEvidenceState {
  status: 'None' | 'Running' | 'Ready' | 'Failed' | string
  preparedAt: string | null
  searches: number
  papersRead: number
  proposals: AgentEvidenceProposal[]
  gaps: string[]
}

export interface AgentEvidenceAcceptResult {
  bound: { id: string; sectionCode: string; status: string; message: string }[]
  sourcesIncluded: number
  bindingsMadeStale: number
  reviewsRun: number
  failed: string[]
}
