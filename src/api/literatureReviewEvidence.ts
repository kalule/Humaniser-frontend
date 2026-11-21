import client from './client'

/** One cited source of the Literature Review (2.0), described from its stored metadata. */
export interface LiteratureReviewSourceRow {
  sourceId: string
  citation: string
  title: string
  setting: string
  population: string
  design: string
  themes: string[]
  evidenceLevel: string
  sourceType: string
  onTopic: boolean
}

/** A gap sentence, what its paragraph cites, and the retrieved studies that came closest to closing it. */
export interface LiteratureReviewGapRow {
  gapStatement: string
  citedInGapParagraph: string[]
  closestRetrievedSources: string[]
}

export interface LiteratureReviewRuleNote {
  id: string
  code: string
  rule: string
  message: string
  sentence: string
  dismissed: boolean
}

/** Output contract of the Literature Review generation rules. Built by the server from metadata; no model call. */
export interface LiteratureReviewEvidenceTables {
  searchRecord: string
  hasSearchRecord: boolean
  sources: LiteratureReviewSourceRow[]
  gaps: LiteratureReviewGapRow[]
  notes: LiteratureReviewRuleNote[]
}

export const literatureReviewEvidenceApi = {
  get: (projectId: string) =>
    // The client's response interceptor already unwraps the { success, data } envelope.
    client.get<LiteratureReviewEvidenceTables>(
      `/api/v1/research/projects/${projectId}/sections/2.0/evidence-tables`,
    ).then(r => r.data),
}
