import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import type { QualAvailability } from '../../api/qualitativeAnalysis'
import { StudyList } from './StudyList'

const features = (over: Partial<QualAvailability> = {}): QualAvailability => ({
  enabled: true, ai: false, agreement: false, audio: false,
  methods: ['ReflexiveTA', 'CodebookTA', 'ContentAnalysis', 'Framework', 'GroundedTheory', 'IPA'],
  retentionDays: 365, maxTranscriptWords: 60000, maxTranscriptsPerStudy: 60, fileTypes: ['.txt', '.docx', '.pdf'], ...over,
})

const html = (f: QualAvailability) => renderToStaticMarkup(<MemoryRouter><StudyList features={f} /></MemoryRouter>)

describe('StudyList', () => {
  it('asks for the data statement, states retention and the limit of de-identification, and starts manual-only', () => {
    const out = html(features())
    expect(out).toContain('I may store and analyse this data here')
    expect(out).toContain('deleted after 365 days without activity')
    expect(out).toContain('it does not make a transcript anonymous')
    expect(out).toMatch(/<input type="radio" name="qa-ai" class="mt-1" checked=""\/> <span>Manual coding only/)
    expect(out).not.toMatch(/type="checkbox"[^>]*checked/) // the statement is never pre-ticked
  })

  it('says the researcher is the analyst, and only mentions AI suggestions when they are available', () => {
    expect(html(features())).toContain('Everything here works without AI.')
    const on = html(features({ ai: true }))
    expect(on).toContain('You are the analyst.')
    expect(on).toContain('proposals that you accept, change or reject')
  })

  it('offers every method, with a note on agreement for the first one', () => {
    const out = html(features())
    for (const label of ['Reflexive thematic analysis', 'Codebook thematic analysis', 'Qualitative content analysis', 'Framework analysis', 'Grounded theory', 'Interpretative phenomenological analysis'])
      expect(out).toContain(label)
    expect(out).toContain('Coding agreement between coders is not used for this method.')
  })

  it('never claims themes emerge or that results are valid or saturated', () => {
    const out = html(features({ ai: true })).toLowerCase()
    for (const word of ['emerge', 'saturat', 'trustworth', ' valid']) expect(out).not.toContain(word)
  })
})
