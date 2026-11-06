import { describe, expect, it } from 'vitest'
import {
  acceptSentence, alignSentences, buildModel, countSentences, modelText, paragraphContext, replaceSentence,
  restoreAll, restoreSentence, sentences, tokenize,
} from './sentenceEdit'

const sentenceTexts = (text: string) => tokenize(text).filter((t) => t.kind === 'sentence').map((t) => t.text)

describe('tokenize', () => {
  it.each([
    'One sentence.',
    '  Leading and trailing space.  ',
    'First. Second! Third?',
    'Title line\nBody sentence one. Body sentence two.\n\nNext paragraph here.',
    'Windows line.\r\nAnother line.\r\n\r\nLast.',
    'Blank lines\n\n\n\nstay as they are.',
    '',
  ])('rebuilds the exact text from its pieces: %j', (text) => {
    expect(tokenize(text).map((t) => t.text).join('')).toBe(text)
  })

  it('splits ordinary sentences', () => {
    expect(sentenceTexts('Workload rose. Morale fell! Did it recover? Slowly.')).toEqual([
      'Workload rose.', 'Morale fell!', 'Did it recover?', 'Slowly.',
    ])
  })

  it('does not split after abbreviations, initials, decimals or et al.', () => {
    expect(sentenceTexts('Smith et al. (2020) argued this. J. Okello disagreed.')).toEqual([
      'Smith et al. (2020) argued this.', 'J. Okello disagreed.',
    ])
    expect(sentenceTexts('Some factors, e.g. income, matter. The mean was 3.5 percent.')).toEqual([
      'Some factors, e.g. income, matter.', 'The mean was 3.5 percent.',
    ])
    expect(sentenceTexts('See Fig. 2 for detail. It shows a trend.')).toEqual(['See Fig. 2 for detail.', 'It shows a trend.'])
  })

  it('splits after a citation or a closing quotation', () => {
    expect(sentenceTexts('Workload predicts burnout (Okello, 2021). Support buffers it.')).toEqual([
      'Workload predicts burnout (Okello, 2021).', 'Support buffers it.',
    ])
    expect(sentenceTexts('She said "the timetable leaves no room." Then she left.')).toEqual([
      'She said "the timetable leaves no room."', 'Then she left.',
    ])
  })

  it('treats a heading line directly above a paragraph as its own sentence', () => {
    expect(sentenceTexts('The Paradox of Choice\nIn the modern era, choice grew. It also burdened people.')).toEqual([
      'The Paradox of Choice', 'In the modern era, choice grew.', 'It also burdened people.',
    ])
  })
})

describe('alignSentences', () => {
  it('pairs identical lists one to one', () => {
    const s = ['A first sentence here.', 'A second sentence follows.', 'A third closes it.']
    expect(alignSentences(s, s)).toEqual(s)
  })

  it('pairs a reworded sentence with its original', () => {
    const originals = ['The rapid advancement of artificial intelligence has transformed numerous sectors.', 'Universities must adapt.']
    const outputs = ['Artificial intelligence has developed rapidly, reshaping sectors across industry.', 'Universities must adapt.']
    expect(alignSentences(originals, outputs)).toEqual(originals)
  })

  it('leaves an added sentence without an original', () => {
    const originals = ['Workload predicts burnout among nurses.', 'Support buffers the effect.']
    const outputs = ['Workload predicts burnout among nurses.', 'Zebras migrate across the savannah annually.', 'Support buffers the effect.']
    expect(alignSentences(originals, outputs)).toEqual([originals[0], null, originals[1]])
  })

  it('keeps later sentences aligned when one original was dropped', () => {
    const originals = ['Alpha beta gamma delta.', 'Epsilon zeta eta theta.', 'Iota kappa lambda omicron.']
    const outputs = ['Alpha beta gamma delta.', 'Iota kappa lambda omicron.']
    expect(alignSentences(originals, outputs)).toEqual([originals[0], originals[2]])
  })

  it('returns nulls when either side is empty', () => {
    expect(alignSentences([], ['Anything here.'])).toEqual([null])
    expect(alignSentences(['Anything here.'], [])).toEqual([])
  })
})

describe('model', () => {
  const original = 'The Paradox of Choice\nThe rapid advancement of technology has given people many options. This causes decision fatigue.\n\nNothing else changed here.'
  const output = 'The Paradox of Choice\nTechnology has expanded the options people have, and this advancement is rapid. This causes decision fatigue.\n\nNothing else changed here.'

  it('marks unchanged and modified sentences and keeps the layout exactly', () => {
    const m = buildModel(original, output)
    expect(modelText(m)).toBe(output)
    expect(sentences(m).map((s) => s.status)).toEqual(['unchanged', 'modified', 'unchanged', 'unchanged'])
    expect(sentences(m)[1].original).toBe('The rapid advancement of technology has given people many options.')
  })

  it('replaces one sentence and nothing else', () => {
    const m = buildModel(original, output)
    const id = sentences(m)[1].id
    const next = replaceSentence(m, id, 'People now have many options because technology advanced rapidly.')
    expect(modelText(next)).toBe(output.replace(sentences(m)[1].text, 'People now have many options because technology advanced rapidly.'))
    expect(sentences(next).map((s) => s.status)).toEqual(['unchanged', 'modified', 'unchanged', 'unchanged'])
  })

  it('flattens line breaks in a replacement and ignores an empty one', () => {
    const m = buildModel(original, output)
    const id = sentences(m)[1].id
    expect(sentences(replaceSentence(m, id, 'First part\n\nsecond part.'))[1].text).toBe('First part second part.')
    expect(replaceSentence(m, id, '   ')).toBe(m)
  })

  it('accepts a modified sentence and restores the original wording', () => {
    const m = buildModel(original, output)
    const id = sentences(m)[1].id
    expect(sentences(acceptSentence(m, id))[1].status).toBe('accepted')

    const restored = restoreSentence(acceptSentence(m, id), id)
    expect(sentences(restored)[1].text).toBe('The rapid advancement of technology has given people many options.')
    expect(sentences(restored)[1].status).toBe('restored')
    expect(modelText(restored)).toBe(original)
  })

  it('cannot restore a sentence that has no original, and does not accept an unchanged one', () => {
    const m = buildModel('Alpha beta gamma delta.', 'Alpha beta gamma delta. Zebras migrate across the savannah annually.')
    const added = sentences(m)[1]
    expect(added.original).toBeNull()
    expect(restoreSentence(m, added.id)).toEqual(m)
    expect(sentences(acceptSentence(m, sentences(m)[0].id))[0].status).toBe('unchanged')
  })

  it('restores everything that has an original', () => {
    const m = buildModel(original, output)
    expect(modelText(restoreAll(m))).toBe(original)
  })

  it('counts changed, accepted and restored sentences', () => {
    const m = buildModel(original, output)
    const id = sentences(m)[1].id
    expect(countSentences(m)).toEqual({ total: 4, changed: 1, accepted: 0, restored: 0 })
    expect(countSentences(acceptSentence(m, id))).toEqual({ total: 4, changed: 1, accepted: 1, restored: 0 })
    expect(countSentences(restoreSentence(m, id))).toEqual({ total: 4, changed: 0, accepted: 0, restored: 1 })
  })
})

describe('paragraphContext', () => {
  const m = buildModel('x', 'Heading line\nFirst sentence here. Second sentence here.\n\nOther paragraph sentence.')

  it('returns the paragraph the sentence sits in, heading included, and not the next paragraph', () => {
    const second = sentences(m)[2]
    expect(paragraphContext(m, second.id)).toBe('Heading line\nFirst sentence here. Second sentence here.')
  })

  it('returns only its own paragraph for a sentence in a later paragraph', () => {
    expect(paragraphContext(m, sentences(m)[3].id)).toBe('Other paragraph sentence.')
  })

  it('caps the context around the sentence', () => {
    const long = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} is here.`).join(' ')
    const big = buildModel('x', long)
    const mid = sentences(big)[20]
    const ctx = paragraphContext(big, mid.id, 200)
    expect(ctx.length).toBeLessThanOrEqual(200)
    expect(ctx).toContain(mid.text)
  })

  it('returns an empty string for an unknown sentence', () => {
    expect(paragraphContext(m, 'nope')).toBe('')
  })
})
