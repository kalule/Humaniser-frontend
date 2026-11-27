import { describe, expect, it } from 'vitest'
import type { GapCard, GapRun } from '../types/gapFinder'
import type { GapDossier } from '../types/proposalWorkflow'
import { dossierFromAgent, dossierFromGap, fillEmpty, pickGapCard } from './gapDossierPrefill'

const card = (gapId: string, statement: string): GapCard => ({
  gapId, type: 'insufficient', statement, whatIsKnown: '', evidence: [], suggestedQuestion: '', promptVersion: 'v1',
  verification: { status: 'partly_addressed', queriesRun: [], hitsJudged: 12, closestWorks: [{ title: 'A', doi: null, year: 2020, why: '' } as never] },
  coverage: { papersScreened: 40, papersUsed: 18, abstractsOnly: 11, fullTexts: 7, preprintShare: 0, sources: ['OpenAlex', 'PubMed'], searchDate: '2026-11-01T10:00:00Z', notReviewed: ['Grey literature'], notes: [] },
})

const run = (over: Partial<GapRun>): GapRun => ({
  id: 'r', projectId: 'p', topic: 't', status: 'completed', stage: 'present', statusMessage: '', corpus: null, rejections: [],
  noMoreQualifiedReason: null, failureReason: null, usedGapId: null, caveat: '', createdAt: '2026-11-01T00:00:00Z', completedAt: '2026-11-01T01:00:00Z',
  scope: { concepts: ['mobile money', 'household welfare'], population: 'rural households', location: 'Kenya', queries: [], isComputerScience: false },
  cards: [card('g1', 'First gap'), card('g2', 'Chosen gap')], ...over,
})

const empty: GapDossier = { gap: '', type: '', scope: '', evidenceIds: [], counterEvidenceIds: [], searchQueryIds: [], coverageLimitations: '', counterEvidenceAssessment: '' }

describe('gap dossier prefill (research-platform W4.4)', () => {
  it('uses the gap the student chose in the latest finished run', () => {
    const picked = pickGapCard([run({ id: 'old', completedAt: '2026-10-01T00:00:00Z' }), run({ id: 'new', usedGapId: 'g2' }), run({ id: 'failed', status: 'failed', cards: [] })])
    expect(picked?.run.id).toBe('new')
    expect(picked?.card.statement).toBe('Chosen gap')
    expect(pickGapCard([run({ status: 'running' })])).toBeNull()
  })

  it('states scope, coverage and the follow-up check in plain words', () => {
    const d = dossierFromGap(run({}), card('g1', 'Little is known about X.'))
    expect(d.gap).toBe('Little is known about X.')
    expect(d.type).toBe('Insufficient evidence')
    expect(d.scope).toBe('Concepts: mobile money, household welfare. Population: rural households. Location: Kenya')
    expect(d.coverageLimitations).toContain('Screened 40 papers and used 18; 11 read from the abstract only and 7 in full.')
    expect(d.coverageLimitations).toContain('Not reviewed: Grey literature.')
    expect(d.counterEvidenceAssessment).toBe('A follow-up search found studies that partly address it (12 results judged). Closest work found: 1 study.')
  })

  it('never overwrites what the student wrote', () => {
    const next = fillEmpty({ ...empty, gap: 'My own wording' }, { gap: 'From the finder', scope: 'Kenya' })
    expect(next.gap).toBe('My own wording')
    expect(next.scope).toBe('Kenya')
  })
})

describe('dossierFromAgent', () => {
  const empty = { gap: '', type: '', scope: '', evidenceIds: [], counterEvidenceIds: [], searchQueryIds: [], coverageLimitations: '', counterEvidenceAssessment: '' }
  const draft = { built: true, gap: 'No trial has tested reminders in Pretoria clinics.', scope: 'Setting: Pretoria', coverageLimitations: 'Absence is not proof.', counterEvidenceAssessment: 'Existing studies already show: reminders help.', evidenceIds: ['e1'] }

  it('fills empty fields and adds the confirmed evidence it cites', () => {
    const next = dossierFromAgent(empty, draft)!
    expect(next.gap).toBe(draft.gap)
    expect(next.coverageLimitations).toBe('Absence is not proof.')
    expect(next.evidenceIds).toEqual(['e1'])
    expect(next.type).toBe('') // the student still chooses the gap type
  })

  it('never overwrites what the student (or the Gap Finder) already wrote, nor drops their evidence', () => {
    const mine = { ...empty, gap: 'My own gap.', evidenceIds: ['e0'] }
    const next = dossierFromAgent(mine, draft)!
    expect(next.gap).toBe('My own gap.')
    expect(next.evidenceIds).toEqual(['e0', 'e1'])
  })

  it('adds nothing when the agent built no gap or there is nothing new', () => {
    expect(dossierFromAgent(empty, { ...draft, built: false })).toBeNull()
    expect(dossierFromAgent(empty, null)).toBeNull()
    const full = dossierFromAgent(empty, draft)!
    expect(dossierFromAgent(full, draft)).toBeNull()
  })
})
