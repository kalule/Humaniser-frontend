import { describe, expect, it } from 'vitest'
import {
  formatEssayInTextCitation,
  formatEssayReferenceListEntry,
  formatReferenceAuthors,
  formatReferencePages,
  formatReferenceVolumeIssue,
  normalizeReferenceTitle,
  normalizeReferenceVenue,
  tidyEssayCitations,
} from './citationFormat'
import { resolveEssayCitationTokens } from './essayCitationTokens'

// Regression tests from a real generated essay on online learning in South African higher education. Its reference list read
// "C. Azionya, Abyshey Nhedzi (2021) 'THE DIGITAL DIVIDE ...'", and its prose had a space before full stops after citations, a
// narrative citation followed straight by a second one, a parenthetical used as a sentence subject, and "et al. reports".

describe('reference list entries from the reported essay (Harvard)', () => {
  it('puts names in Harvard form, title-cases an ALL-CAPS title and keeps the DOI', () => {
    expect(formatEssayReferenceListEntry({
      title: 'THE DIGITAL DIVIDE AND HIGHER EDUCATION CHALLENGE WITH EMERGENCY ONLINE LEARNING: ANALYSIS OF TWEETS IN THE WAKE OF THE COVID-19 LOCKDOWN',
      authors: 'C. Azionya, Abyshey Nhedzi', year: 2021, venue: 'The Turkish Online Journal of Distance Education', doi: '10.17718/tojde.1002822',
    }, 'Harvard', 0)).toBe(
      "Azionya, C. and Nhedzi, A. (2021) 'The Digital Divide and Higher Education Challenge with Emergency Online Learning: " +
      "Analysis of Tweets in the Wake of the COVID-19 Lockdown', The Turkish Online Journal of Distance Education. doi:10.17718/tojde.1002822.",
    )
  })

  it('handles three authors with middle names and a parallel journal title', () => {
    expect(formatEssayReferenceListEntry({
      title: 'A report of a South African university’s management of undergraduate nursing students’ teaching and learning following the COVID-19 interruptions',
      authors: 'O. Baloyi, Mary Ann Jarvis, N. Mtshali', year: 2022, venue: 'Health SA = SA Gesondheid', doi: '10.4102/hsag.v27i0.1816',
    }, 'Harvard', 0)).toBe(
      "Baloyi, O., Jarvis, M.A. and Mtshali, N. (2022) 'A report of a South African university’s management of undergraduate nursing " +
      "students’ teaching and learning following the COVID-19 interruptions', Health SA. doi:10.4102/hsag.v27i0.1816.",
    )
  })

  it('keeps full names the record gives as initials only', () => {
    expect(formatReferenceAuthors({ title: 'x', authors: 'Maboragane J. Magedi, T. Rakgogo, Onica S. Mnguni, Madikwa H. Segabutla, L. Kgwete' }, 'Harvard'))
      .toBe('Magedi, M.J., Rakgogo, T., Mnguni, O.S., Segabutla, M.H. and Kgwete, L.')
  })

  it('keeps a single author as a single name', () => {
    expect(formatReferenceAuthors({ title: 'x', authors: 'Mondli Hlatshwayo' }, 'Harvard')).toBe('Hlatshwayo, M.')
    expect(formatReferenceAuthors({ title: 'x', authors: 'Cedric Bheki Mpungose' }, 'Harvard')).toBe('Mpungose, C.B.')
  })
})

describe('author blocks in the other styles', () => {
  const two = { title: 'x', authors: 'C. Azionya, Abyshey Nhedzi' }
  it('APA, Chicago, IEEE and Vancouver each use their own form', () => {
    expect(formatReferenceAuthors(two, 'Apa7')).toBe('Azionya, C., & Nhedzi, A.')
    expect(formatReferenceAuthors(two, 'Chicago')).toBe('Azionya, C., and A. Nhedzi')
    expect(formatReferenceAuthors(two, 'Ieee')).toBe('C. Azionya and A. Nhedzi')
    expect(formatReferenceAuthors(two, 'Vancouver')).toBe('Azionya C, Nhedzi A')
  })

  it('keeps a lower-case particle with the family name', () => {
    expect(formatReferenceAuthors({ title: 'x', authors: 'Ana de la Cruz' }, 'Harvard')).toBe('de la Cruz, A.')
  })

  it('reads "Surname, INITIALS" and "Surname INITIALS" shapes', () => {
    expect(formatReferenceAuthors({ title: 'x', authors: 'Smith, J., Jones, K.' }, 'Harvard')).toBe('Smith, J. and Jones, K.')
    expect(formatReferenceAuthors({ title: 'x', authors: 'Smithies TD' }, 'Harvard')).toBe('Smithies, T.D.')
  })

  it('keeps the stored text when "Surname, Given" cannot be told from two authors', () => {
    expect(formatReferenceAuthors({ title: 'x', authors: 'Smith, John' }, 'Harvard')).toBe('Smith, John')
  })

  it('structured authors win over the stored string', () => {
    expect(formatReferenceAuthors({ title: 'x', authors: 'ignored', authorDetails: [{ family: 'Dlamini', given: 'Zanele' }] }, 'Harvard')).toBe('Dlamini, Z.')
  })

  it('returns null when no author is known', () => {
    expect(formatReferenceAuthors({ title: 'x' }, 'Harvard')).toBeNull()
  })
})

describe('title and venue tidy-up', () => {
  it('leaves a normally-cased title exactly as the record has it', () => {
    expect(normalizeReferenceTitle('Continuous Online Assessment at a South African Open Distance and e-Learning Institution'))
      .toBe('Continuous Online Assessment at a South African Open Distance and e-Learning Institution')
  })

  it('title-cases an ALL-CAPS title, keeping acronyms and capitalising after a colon', () => {
    expect(normalizeReferenceTitle('COVID-19 AND ITS IMPACT ON STUDENTS: A SOCIAL JUSTICE EXPRESSION IN SA'))
      .toBe('COVID-19 and Its Impact on Students: A Social Justice Expression in SA')
  })

  it('keeps only the first part of a parallel journal title', () => {
    expect(normalizeReferenceVenue('Health SA = SA Gesondheid')).toBe('Health SA')
    expect(normalizeReferenceVenue('Frontiers in Education')).toBe('Frontiers in Education')
    expect(normalizeReferenceVenue(null)).toBeNull()
  })
})

describe('tidyEssayCitations', () => {
  it('removes the space left before punctuation after a citation', () => {
    expect(tidyEssayCitations('Participation fell (Kwok et al., 2021) . It did not recover (Lee, 2020) , so far.'))
      .toBe('Participation fell (Kwok et al., 2021). It did not recover (Lee, 2020), so far.')
  })

  it('merges a narrative citation that is immediately followed by another', () => {
    expect(tidyEssayCitations('Collaboration improved Al-Rahmi et al. (2014) (Sobaih et al., 2020).'))
      .toBe('Collaboration improved (Al-Rahmi et al., 2014; Sobaih et al., 2020).')
  })

  it('turns a parenthetical used as the sentence subject into a narrative citation', () => {
    expect(tidyEssayCitations('This differs because (Kwok et al., 2021) utilized questionnaires.'))
      .toBe('This differs because Kwok et al. (2021) utilized questionnaires.')
    expect(tidyEssayCitations('(Alnjadat & Smith, 2019) found a difference.')).toBe('Alnjadat and Smith (2019) found a difference.')
  })

  it('does not touch an ordinary parenthetical followed by a non-reporting word', () => {
    const text = 'Participation fell (Kwok et al., 2021) is what the data show.'
    expect(tidyEssayCitations(text)).toBe(text)
  })

  it('gives "et al." and two-author citations a plural verb', () => {
    expect(tidyEssayCitations('Baloyi et al. (2022) reports that the programme moved online.')).toBe('Baloyi et al. (2022) report that the programme moved online.')
    expect(tidyEssayCitations('Azionya and Nhedzi (2021) argues that access did not improve.')).toBe('Azionya and Nhedzi (2021) argue that access did not improve.')
  })

  it('leaves a single author with a singular verb alone', () => {
    expect(tidyEssayCitations('Hlatshwayo (2022) reports that participation fell.')).toBe('Hlatshwayo (2022) reports that participation fell.')
  })

  it('does not merge citations that are not adjacent', () => {
    const text = 'Smith (2019) found that it works, as shown elsewhere (Jones, 2020).'
    expect(tidyEssayCitations(text)).toBe(text)
  })
})

describe('resolveEssayCitationTokens applies the tidy-up', () => {
  const refs = [
    { sourceId: 'S1', title: 'A', authors: 'Maria Kwok, Lee Tan, Wei Chen', year: 2021 },
    { sourceId: 'S2', title: 'B', authors: 'Sam Baloyi', year: 2022 },
  ]

  it('removes a space the model left between a token and the full stop', () => {
    expect(resolveEssayCitationTokens('Participation fell [S1] . It did not recover.', refs, 'Harvard'))
      .toBe('Participation fell (Kwok, Tan and Chen, 2021). It did not recover.')
  })

  it('renders an explicit narrative token without guessing a citation role from prose', () => {
    expect(resolveEssayCitationTokens('[N:S1] found that participation fell.', refs, 'Harvard')).toBe('Kwok, Tan and Chen (2021) found that participation fell.')
  })
})

describe('the "and" / "&" join between two authors', () => {
  const two = { title: 'x', authors: 'Angelo Fynn, Elias Oupa Mashile', year: 2022 }

  it('Harvard and Chicago say "and" in the text, matching their reference lists; APA says "&"', () => {
    expect(formatEssayInTextCitation(two, 'Harvard', 0)).toBe('(Fynn and Mashile, 2022)')
    expect(formatEssayInTextCitation(two, 'Chicago', 0)).toBe('(Fynn and Mashile, 2022)')
    expect(formatEssayInTextCitation(two, 'Apa7', 0)).toBe('(Fynn & Mashile, 2022)')
    expect(formatReferenceAuthors(two, 'Harvard')).toBe('Fynn, A. and Mashile, E.O.')
  })

  it('a merged citation group uses the style\'s own join', () => {
    const text = 'Collaboration improved Smith and Jones (2014) (Sobaih et al., 2020).'
    expect(tidyEssayCitations(text, 'and')).toBe('Collaboration improved (Smith and Jones, 2014; Sobaih et al., 2020).')
    expect(tidyEssayCitations(text, '&')).toBe('Collaboration improved (Smith & Jones, 2014; Sobaih et al., 2020).')
  })
})

describe('one rule for volume, issue and pages', () => {
  it('strips labels and keeps volume(issue)', () => {
    expect(formatReferenceVolumeIssue('Vol. 12', 'No. 3')).toBe(', 12(3)')
    expect(formatReferenceVolumeIssue('12', null)).toBe(', 12')
  })
  it('never renders an issue on its own as a stray "(3)"', () => {
    expect(formatReferenceVolumeIssue(null, '3')).toBe(', no. 3')
    expect(formatReferenceVolumeIssue(null, null)).toBe('')
  })
  it('uses an en dash for ranges, p. for one page and no pp. for article numbers', () => {
    expect(formatReferencePages('pp. 10-20')).toBe(', pp. 10\u201320')
    expect(formatReferencePages('123 - 123')).toBe(', p. 123')
    expect(formatReferencePages('5')).toBe(', p. 5')
    expect(formatReferencePages('e0123456')).toBe(', Article e0123456')
    expect(formatReferencePages('Article 45')).toBe(', Article 45')
    expect(formatReferencePages(null)).toBe('')
  })
})
