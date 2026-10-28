import { describe, expect, it } from 'vitest'
import { resolveEssayCitationTokens } from './essayCitationTokens'

const refs = [
  { sourceId: 'S1', title: 'Mentoring and dropout', authors: 'Smith, J., Jones, K.', year: 2019 },
  { sourceId: 'S2', title: 'Retention in college', authors: 'Garcia, M.', year: 2020 },
  { sourceId: 'S3', title: 'Belonging', authors: 'Lee, A., Wong, B., Khan, C.', year: 2021 },
]

const harvard = (text: string) => resolveEssayCitationTokens(text, refs, 'Harvard')

describe('resolveEssayCitationTokens', () => {
  it('renders parenthetical and narrative tokens in the requested style', () => {
    expect(harvard('Dropout fell [S2].')).toBe('Dropout fell (Garcia, 2020).')
    expect(harvard('[N:S2] found that dropout fell.')).toBe('Garcia (2020) found that dropout fell.')
  })

  it('merges adjacent author-date citations into one group', () => {
    expect(harvard('Dropout fell [S2][S1].')).toBe('Dropout fell (Smith and Jones, 2019; Garcia, 2020).')
  })

  it('resolves the grouped form; a grouped narrative citation names every source narratively', () => {
    expect(harvard('Dropout fell [S2, S3].')).toBe('Dropout fell (Garcia, 2020; Lee, Wong and Khan, 2021).')
    expect(harvard('[N:S2, S3, S1] agree.')).toBe('Garcia (2020), Lee, Wong and Khan (2021) and Smith and Jones (2019) agree.')
    expect(harvard('[N:S1, S2] argue that it fell.')).toBe('Smith and Jones (2019) and Garcia (2020) argue that it fell.')
  })

  it('strips internal case-fact markers', () => {
    expect(harvard('The firm closed [CF3] in 2019 [S2].')).toBe('The firm closed in 2019 (Garcia, 2020).')
  })

  // The real defect: "The study by has a cross-sectional design".
  it('never leaves a narrative citation empty when its source is missing from the reference list', () => {
    expect(harvard('The study by [N:S99] has a cross-sectional design.')).toBe('The study by [Citation needs review: S99] has a cross-sectional design.')
    expect(harvard('[N:S99] found a drop.')).toBe('[Citation needs review: S99] found a drop.')
    expect(harvard('It fell. [N:S99] found a drop.')).toBe('It fell. [Citation needs review: S99] found a drop.')
  })

  it('keeps an unresolved parenthetical citation visible without removing its claim', () => {
    expect(harvard('Dropout fell [S99]. Next sentence.')).toBe('Dropout fell [Citation needs review: S99]. Next sentence.')
    expect(harvard('Dropout fell [S99] and rose later.')).toBe('Dropout fell [Citation needs review: S99] and rose later.')
  })

  it('marks a whole mixed cluster for review instead of silently discarding its missing member', () => {
    expect(harvard('Dropout fell [S2, S99].')).toBe('Dropout fell [Citation needs review: S2, S99].')
  })

  // The real defect: "the nature(Munang, 2022; Kashif, 2013)".
  it('puts a space before a citation that touches the word before it', () => {
    expect(harvard('the nature[S2][S1] of use')).toBe('the nature (Smith and Jones, 2019; Garcia, 2020) of use')
    expect(harvard('consumption[S2], preventing')).toBe('consumption (Garcia, 2020), preventing')
  })

  it('does not touch ordinary parentheses or text without tokens', () => {
    expect(harvard('Growth was steady (see Table 2) overall.')).toBe('Growth was steady (see Table 2) overall.')
    expect(harvard('The function f(x) was used.')).toBe('The function f(x) was used.')
    expect(harvard('Plain prose, no citations.')).toBe('Plain prose, no citations.')
  })

  it('numbers citations by first use in numbered styles', () => {
    expect(resolveEssayCitationTokens('Dropout fell [S2].', refs, 'Ieee')).toBe('Dropout fell [1].')
  })
})
